import { Ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { Action, Collection } from '@/services/PreingestApiService';

/**
 * Callback as invoked after each action, allowing the caller to do some housekeeping or even abort
 * further processing.
 *
 * @return `false` to abort, `true` to continue with the next waiting action
 */
type ActionCompleteFn = (action: Action) => boolean;

export function useActionsRunner(collection: Ref<Collection | undefined>, actions: Ref<Action[]>) {
  const api = useApi();
  const toast = useToast();

  /**
   * Run the actions that have status `wait` due to some user selection.
   */
  const runWaitingActions = async (onActionComplete?: ActionCompleteFn) => {
    if (!collection.value) {
      return;
    }

    // Simply run in the given order, one by one
    for (const action of actions.value) {
      if (action.status === 'wait') {
        action.status = 'running';
        try {
          action.status = await (action.triggerFn
            ? action.triggerFn(action)
            : api.triggerActionAndWaitForCompleted(collection.value.sessionId, action));
          action.lastFetchedStatus = action.status;
        } catch (e) {
          toast.add({
            severity: 'error',
            summary: 'Mislukt',
            detail: e,
          });
          action.status = 'failed';
        }
        if (onActionComplete) {
          if (!onActionComplete(action)) {
            toast.add({
              severity: 'error',
              summary: 'Fout in vereiste stap',
              detail: 'Verdere verwerking is afgebroken.',
            });
            return;
          }
        }
      }
    }
  };

  return {
    runWaitingActions,
  };
}
