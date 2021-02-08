import { Ref } from 'vue';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { Collection } from '@/services/PreingestApiService';

/**
 * Helpers to watch all collections known to the API.
 */
export function useCollectionsWatcher(collections: Ref<Collection[] | undefined>) {
  const eventHubUrl = process.env.VUE_APP_PREINGEST_EVENTHUB || '/preingestEventHub/';
  const connection = new HubConnectionBuilder().withUrl(eventHubUrl).build();

  const handleUpdate = (json: string) => {
    if (!collections.value) {
      throw new Error('Got update while not having any collections');
    }
    const updatedCollections: Collection[] = JSON.parse(json);

    // We cannot just replace the collections, as they may be referenced in selected items in the
    // overview's data table. So, first remove the ones that are no longer known:
    collections.value = collections.value.filter((collection) =>
      updatedCollections.some(
        (updatedCollection) => updatedCollection.sessionId === collection.sessionId
      )
    );

    // ...and next, merge the new data into the existing items:
    updatedCollections.forEach((current) => {
      const existing = collections.value?.find(
        (collection) => collection.sessionId === current.sessionId
      );
      if (existing) {
        Object.assign(existing, current);
      } else if (collections.value) {
        collections.value.push(current);
      }
    });
  };

  const connect = async () => {
    // This does not emit events for new/reset/deleted collections unless some other change happens
    connection.on('CollectionsStatus', handleUpdate);
    await connection.start();
  };

  const disconnect = async () => {
    await connection.stop();
  };

  /**
   * Start the watcher for all collections.
   */
  const startWatcher = async () => {
    await connect();
  };

  const stopWatcher = async () => {
    await disconnect();
  };

  return {
    startWatcher,
    stopWatcher,
  };
}
