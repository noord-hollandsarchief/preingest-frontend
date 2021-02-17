import { Ref } from 'vue';
import { useApi } from '@/plugins/PreingestApi';
import { Collection, Settings, SettingsKey, Step } from '@/services/PreingestApiService';

export function useStepsRunner(collection: Ref<Collection | undefined>, steps: Ref<Step[]>) {
  const api = useApi();

  const selectedSteps = () => steps.value.filter((step) => step.selected);

  /**
   * Return a (possibly empty) list of settings that are required for the selected actions, like the
   * checksum type when calculating the checksum. This takes dependent settings into account.
   *
   * @param settings values from a settings dialog; if not set the collection's settings are used
   */
  const requiredSettings = (settings?: Settings) => {
    return selectedSteps().reduce((acc, step) => {
      for (const setting of step.requiredSettings || []) {
        acc.push(setting);
        if (step.dependentSettings) {
          const value = (settings || collection.value?.settings)?.[setting];
          const dependent = step.dependentSettings[setting]?.find((s) => s.value === value);
          if (dependent) {
            acc = acc.concat(...dependent.requiredSettings);
          }
        }
      }
      return acc;
    }, [] as SettingsKey[]);
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
      continueOnError: true,
      continueOnFailed: false,
    }));

    if (workflowSteps.length) {
      await api.startExecutionPlan(collection.value?.sessionId, { workflow: workflowSteps });
    }
  };

  return {
    requiredSettings,
    missingSettings,
    runSelectedSteps,
  };
}
