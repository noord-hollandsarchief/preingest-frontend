import { Ref } from 'vue';
import { useApi } from '@/plugins/PreingestApi';
import { Collection, Step } from '@/services/PreingestApiService';

export function useStepsRunner(collection: Ref<Collection | undefined>, steps: Ref<Step[]>) {
  const api = useApi();

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
    const workflowSteps = steps.value
      .filter((step) => step.selected)
      .map((step) => ({
        actionName: step.actionName,
        continueOnError: true,
        continueOnFailed: false,
      }));

    if (workflowSteps.length) {
      await api.startExecutionPlan(collection.value?.sessionId, { workflow: workflowSteps });
    }
  };

  return {
    runSelectedSteps,
  };
}
