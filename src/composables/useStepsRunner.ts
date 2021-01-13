import { Ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { Collection, Step } from '@/services/PreingestApiService';

/**
 * Callback as invoked after each action, allowing the caller to do some housekeeping or even abort
 * further processing.
 *
 * @return `false` to abort, `true` to continue with the next waiting action
 */
type StepCompleteFn = (action: Step) => boolean;

export function useStepsRunner(collection: Ref<Collection | undefined>, steps: Ref<Step[]>) {
  const api = useApi();
  const toast = useToast();

  /**
   * Run the steps that have status `wait` due to some user selection.
   */
  const runWaitingSteps = async (onStepComplete?: StepCompleteFn) => {
    if (!collection.value) {
      return;
    }

    // Simply run in the given order, one by one
    for (const step of steps.value) {
      if (step.status === 'Wait') {
        step.status = 'Executing';
        try {
          step.status = await (step.triggerFn
            ? step.triggerFn(step)
            : api.triggerStepAndWaitForCompleted(collection.value.sessionId, step));
        } catch (e) {
          toast.add({
            severity: 'error',
            summary: 'Mislukt',
            detail: e,
          });
          step.status = 'Failed';
        }
        if (onStepComplete) {
          if (!onStepComplete(step)) {
            toast.add({
              severity: 'error',
              summary: 'Onverwachte fout bij uitvoering',
              detail: 'Verdere verwerking is afgebroken.',
            });
            return;
          }
        }
      }
    }
  };

  return {
    runWaitingSteps,
  };
}
