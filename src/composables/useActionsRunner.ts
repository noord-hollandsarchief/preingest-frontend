import { Ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { Action, Collection } from '@/services/PreingestApiService';

export function useActionsRunner(collection: Ref<Collection | undefined>, actions: Ref<Action[]>) {
  const api = useApi();
  const toast = useToast();

  /**
   * Run the actions that have status `wait` due to some user selection.
   */
  const runWaitingActions = async () => {
    if (!collection.value) {
      return;
    }

    // Simply run in the given order, one by one
    for (const action of actions.value) {
      if (action.status === 'wait') {
        action.status = 'running';
        try {
          console.log('Running action for session', collection.value.unpackSessionId);
          action.status = await (action.triggerFn
            ? action.triggerFn(action)
            : api.triggerActionAndWaitForCompleted(collection.value.unpackSessionId, action));
          action.lastFetchedStatus = action.status;
        } catch (e) {
          toast.add({
            severity: 'error',
            summary: 'Mislukt',
            detail: e,
          });
          action.status = 'failed';
          // TODO Stop processing further results?
        }
        // TODO unselect? If we do, we can no longer tell what we did?
      }
    }
  };

  return {
    runWaitingActions,
  };
}
