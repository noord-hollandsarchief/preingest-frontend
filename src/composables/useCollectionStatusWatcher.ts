import { Ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { ChecksumType, Collection, Step } from '@/services/PreingestApiService';
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
      // Do not update the full collection itself, to preserve transient details such as the last
      // checksum and any unsaved user input
      const fetched = await api.getCollection(collection.value.sessionId);
      collection.value.overallStatus = fetched.overallStatus;
      collection.value.scheduledPlan = fetched.scheduledPlan;
      collection.value.preingest = fetched.preingest;
      lastPoll = Date.now();
    }

    // TODO similar code in SessionProgress.vue
    // The fetched collection only knows about the current or last execution plan (if any) and all
    // executed Actions, not all available Steps. Also, it may include the same action multiple
    // times if Steps were restarted; merge the collection's Actions into the Steps.
    for (const step of steps.value) {
      // TODO API is this indeed sorted?
      const lastAction = collection.value.preingest
        ?.filter((action) => action.name === step.actionName)
        .pop();

      const scheduledAction = collection.value.scheduledPlan?.find(
        (scheduled) => scheduled.actionName === step.actionName
      );

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

      // Deselect when done (if running in the window that started the scheduled actions), ensuring
      // steps can be re-selected for restart even though the API will still return the last
      // scheduled plan when it completed or failed.
      if (
        step.selected &&
        step.status &&
        ['Pending', 'Executing'].includes(step.status) &&
        scheduledAction?.status === 'Done'
      ) {
        step.selected = false;
      }

      // Copy Pending and Executing from the scheduled plan, or the last result otherwise
      step.status =
        scheduledAction?.status && scheduledAction.status !== 'Done'
          ? scheduledAction.status
          : lastAction?.actionStatus;

      step.fixedSelected = !step.allowRestart && step.status === 'Success' ? false : undefined;
      step.selected = step.fixedSelected ?? step.selected;

      step.lastStart = lastAction?.summary?.start || lastAction?.creation || step.lastStart;
      // TODO validate comment and improve calculation if possible
      // When completed at this point, this may round down a second, which is a bit confusing
      step.lastDuration = step.lastStart
        ? formatDateDifference(step.lastStart, lastAction?.summary?.end)
        : undefined;

      if (
        (!scheduledAction || scheduledAction.status === 'Done') &&
        lastAction &&
        lastAction.processId !== step.lastActionProcessId
      ) {
        step.lastAction = lastAction;
        step.lastActionProcessId = lastAction.processId;

        switch (lastAction.name) {
          case 'ContainerChecksumHandler':
            // Update the last known checksum value (supporting two browser windows for the same
            // session, and supporting page refresh)
            // await api.getLastCalculatedChecksum(collection.value);
            await api.getLastActionResults(collection.value.sessionId, step);
            // Without user input for expected value (and user-selected SHA1):
            //
            //     "actionData": [
            //       "SHA1",
            //       "cc8d8a7d1de976bc94f7baba4c24409817f296c1"
            //     ]
            //
            // Matching values (where user input was upper case):
            //
            //     "actionData": [
            //       "SHA1",
            //       "cc8d8a7d1de976bc94f7baba4c24409817f296c1",
            //       "CC8D8A7D1DE976BC94F7BABA4C24409817F296C1 = cc8d8a7d1de976bc94f7baba4c24409817f296c1"
            //     ]
            //
            // Non-matching values:
            //
            //     "actionData": [
            //       "SHA1",
            //       "cc8d8a7d1de976bc94f7baba4c24409817f296c1",
            //       "d2970bcfa7717d2bdad34ed7a8ac649c ≠ cc8d8a7d1de976bc94f7baba4c24409817f296c1"
            //     ]
            collection.value.calculatedChecksumType = step.result?.actionData?.[0] as ChecksumType;
            collection.value.calculatedChecksumValue = step.result?.actionData?.[1];

            break;

          case 'ExcelCreatorHandler':
            // Actually, the name of the download is not likely to change; just be future-proof
            collection.value.excelCreatorDownloadUrl = undefined;
            // We could also simply construct the URL without fetching the full action results:
            //   url = api.getActionReportUrl(collection.value.sessionId, step.name + '.xlsx')
            // ...but let's be future-proof here too:
            await api.getLastActionResults(collection.value.sessionId, step);
            collection.value.excelCreatorDownloadUrl = step.downloadUrl;
            break;

          default:
            step.result = undefined;
            step.downloadUrl = undefined;
        }
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
