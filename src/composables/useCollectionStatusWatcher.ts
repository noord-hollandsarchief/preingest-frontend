import { Ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { Collection, Step } from '@/services/PreingestApiService';
import { formatDateDifference } from '@/utils/formatters';

/**
 * Helpers to watch a collection on the API and to update the status of its steps.
 */
export function useCollectionStatusWatcher(
  collection: Ref<Collection | undefined>,
  steps: Ref<Step[]>
) {
  const api = useApi();
  const toast = useToast();
  let running = false;
  let lastPoll = 0;
  let cached: Collection | undefined = undefined;

  /**
   * Update the collection whenever called (to update any duration of running steps), and poll the
   * API for new details using the interval defined in `VUE_APP_COLLECTION_POLL_INTERVAL_MS`.
   *
   * In the future just subscribe to some WebSocket (but even then still ensure to update `duration`
   * at least every second), but simply poll for now. To sync multiple windows, we need to poll even
   * if nothing seems to be waiting or running right now. And for smooth display of duration we need
   * to update at least once per second, even when we poll less. When not implementing a WebSocket
   * any time soon, we could add some backoff when nothing changed for some time.
   */
  const update = async () => {
    if (!collection.value) {
      return;
    }

    if (Date.now() - lastPoll > process.env.VUE_APP_COLLECTION_POLL_INTERVAL_MS) {
      // Do not update the collection itself, to preserve transient details such as the last
      // checksum and any unsaved user input
      cached = await api.getCollection(collection.value.sessionId);
      lastPoll = Date.now();
    }

    // TODO similar code in SessionProgress.vue and CollectionControl
    // The fetched collection only knows about the current execution plan (if any) and all executed
    // Actions, not all available Steps. Also, it may include the same action multiple times; merge
    // the collection's Actions into the Steps
    for (const step of steps.value) {
      // TODO API is this indeed sorted?
      const lastAction = cached?.preingest
        ?.filter((action) => action.name === step.actionName)
        .pop();

      const scheduledAction = cached?.scheduledPlan?.find(
        (scheduled) => scheduled.actionName === step.actionName
      );

      // TODO For checksum, copy the result
      // collection.value.calculatedChecksum = ...

      // TODO Clear the checkbox when completed

      // If any scheduled step reports Done while its action reports Failed, then the execution
      // plan will stop, possibly leaving items in Pending state. We could wipe the execution plan,
      // but that would only happen then when the failure happens while the detail page is open.
      if (
        scheduledAction?.status === 'Done' &&
        lastAction?.actionStatus === 'Failed' &&
        step.status !== 'Failed'
      ) {
        toast.add({
          severity: 'error',
          summary: 'Onverwachte fout bij uitvoering',
          detail: 'Verdere verwerking is afgebroken.',
        });
      }

      // TODO remove reference to step.lastStart and all else from the comment below
      // // If a step has just been restarted (for which the application in this browser window will
      // // have set `step.lastStart`, and will have cleared `step.lastTriggerActionResult` and
      // // `step.lastAction`), even fresh API details may refer to a previous invocation; compare the
      // // expected `actionId` if applicable:
      // if (
      //   lastAction &&
      //   (!step.lastTriggerActionResult ||
      //     step.lastTriggerActionResult.actionId === lastAction.processId)
      // ) {
      //         // The server does not know about 'Wait', so for actions that are restarted we
      //         // step.status = step.status === 'Wait' ? step.status : lastAction?.actionStatus;

      // Copy Pending and Executing from the scheduled plan, or the last result otherwise
      step.status =
        scheduledAction?.status && scheduledAction.status !== 'Done'
          ? scheduledAction.status
          : lastAction?.actionStatus;
      step.lastAction = lastAction;
      step.lastStart = lastAction?.summary?.start || lastAction?.creation || step.lastStart;
      // TODO validate comment and improve calculation if possible
      // When completed at this point, this may round down a second, which is a bit confusing
      step.lastDuration = step.lastStart
        ? formatDateDifference(step.lastStart, lastAction?.summary?.end)
        : undefined;
    }
  };

  /**
   * Start the watcher for the configured collection.
   */
  const startWatcher = async () => {
    running = true;
    return await new Promise((resolve) => {
      const interval = setInterval(async () => {
        await update();
        if (!running) {
          resolve();
          clearInterval(interval);
        }
      }, 500);
    });
  };

  const stopWatcher = () => (running = false);

  return {
    startWatcher,
    stopWatcher,
  };
}
