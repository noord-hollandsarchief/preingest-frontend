import { Ref } from 'vue';
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
    // The fetched collection only knows about executed Actions, not all available Steps, and may
    // include the same Action multiple times; merge the collection's Actions into the Steps
    for (const step of steps.value) {
      // TODO API is this indeed sorted?
      const lastAction = cached?.preingest
        ?.filter((action) => action.name === step.actionName)
        .pop();

      // If a step has just been restarted (for which the application in this browser window will
      // have set `step.lastStart`, and will have cleared `step.lastTriggerActionResult` and
      // `step.lastAction`), even fresh API details may refer to a previous invocation; compare the
      // expected `actionId` if applicable:
      if (
        lastAction &&
        (!step.lastTriggerActionResult ||
          step.lastTriggerActionResult.actionId === lastAction.processId)
      ) {
        step.status = step.status === 'Wait' ? step.status : lastAction?.actionStatus;
        step.lastAction = lastAction;
        step.lastStart = lastAction.summary?.start || step.lastStart;
        // When completed at this point, this may round down a second, which is a bit confusing
        step.lastDuration = formatDateDifference(step.lastStart || '', lastAction.summary?.end);
      } else {
        // Always update the duration
        step.lastDuration = step.lastStart ? formatDateDifference(step.lastStart) : undefined;
      }
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
