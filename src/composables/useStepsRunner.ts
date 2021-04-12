import { Ref } from 'vue';
import { useApi } from '@/plugins/PreingestApi';
import { Collection, Settings, SettingsKey, Step } from '@/services/PreingestApiService';

export function useStepsRunner(collection: Ref<Collection | undefined>, steps: Ref<Step[]>) {
  const api = useApi();

  const selectedSteps = () => steps.value.filter((step) => step.selected);

  /**
   * Add the required settings (possibly none) for the given `step` to the given accumulator `acc`,
   * taking dependent settings into account.
   *
   * @param acc accumulator to which to add the (possibly zero) required settings
   * @param step
   * @param settings optional transient values from a settings dialog; if not set the collection's
   *        persisted values are used
   */
  const addRequiredAndDependentSettings = (
    acc: Set<SettingsKey>,
    step: Step,
    settings?: Settings
  ) => {
    for (const setting of step.requiredSettings || []) {
      acc.add(setting);
      if (step.dependentSettings) {
        const value = (settings || collection.value?.settings)?.[setting];
        const dependent = step.dependentSettings[setting]?.find((s) => s.value === value);
        if (dependent) {
          dependent.requiredSettings.forEach((setting) => acc.add(setting));
        }
      }
    }
    return acc;
  };

  /**
   * Return a (possibly empty) list of settings that are required for the selected actions, like the
   * checksum type when calculating the checksum. This takes dependent settings into account.
   *
   * @param settings optional transient values from a settings dialog; if not set the collection's
   *        persisted values are used
   */
  const requiredSettings = (settings?: Settings) => {
    return Array.from(
      selectedSteps().reduce((acc, step) => {
        return addRequiredAndDependentSettings(acc, step, settings);
      }, new Set<SettingsKey>())
    );
  };

  /**
   * Return a (possibly empty) list of settings that cannot be changed given completed actions that
   * are not allowed a restart or which explicitly lock other steps upon success.
   *
   * @param settings optional transient values from a settings dialog; if not set the collection's
   *        persisted values are used
   */
  const lockedSettings = (settings?: Settings): SettingsKey[] => {
    return Array.from(
      steps.value
        .filter((step) => step.status === 'Success' && !step.allowRestart)
        .reduce((acc, step) => {
          addRequiredAndDependentSettings(acc, step, settings);
          step.lockSteps?.reduce((acc, stepId: string) => {
            const lockStep = steps.value.find((s) => s.id === stepId);
            if (lockStep) {
              addRequiredAndDependentSettings(acc, lockStep, settings);
            } else {
              console.error('Programming error: step not found; id=' + stepId);
            }
            return acc;
          }, acc);
          return acc;
        }, new Set<SettingsKey>())
    );
  };

  /**
   * Return a (possibly empty) list of {@link requiredSettings} that are missing a value in the
   * collection's settings.
   */
  const missingSettings = () => {
    return requiredSettings().reduce((acc, setting) => {
      if (!collection.value?.settings?.[setting]) {
        acc.push(setting);
      }
      return acc;
    }, [] as SettingsKey[]);
  };

  /**
   * Run the steps that have been selected by the user.
   *
   * Any parameters should already have been set using {@link saveSettings}.
   */
  const runSelectedSteps = async () => {
    if (!collection.value) {
      return;
    }

    // Simply schedule in the given order, one by one.
    const workflowSteps = selectedSteps().map((step) => ({
      actionName: step.actionName,
      startOnError: step.startOnError ?? true,
      continueOnError: step.continueOnError ?? true,
      continueOnFailed: step.continueOnFailed ?? false,
    }));

    if (workflowSteps.length) {
      await api.startExecutionPlan(collection.value?.sessionId, { workflow: workflowSteps });
    }
  };

  return {
    requiredSettings,
    missingSettings,
    lockedSettings,
    runSelectedSteps,
  };
}
