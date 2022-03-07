<template>
  <div class="card">
    <Dialog
      header="Metadata bestand"
      v-model:visible="displayBasic"
      :style="{ width: '95vw' }"
      :position="position"
    >
      <h3>Eigenschappen</h3>
      <div>
        <p>Naam: {{ props.name }}</p>
        <p>Locatie: {{ props.location }}</p>
        <p>Gemaakt op: {{ props.creationDateTime }}</p>
        <p>Laatst bewerkt op: {{ props.lastModified }}</p>
        <p>Bestandsgrootte: {{ props.size }}</p>
        <div v-if="props.fileProperties">
          <hr />
          <p>Naam: {{ props.fileProperties.name }}</p>
          <p>Locatie: {{ props.fileProperties.location }}</p>
          <p>Gemaakt op: {{ props.fileProperties.creationDateTime }}</p>
          <p>Laatst bewerkt op: {{ props.fileProperties.lastModified }}</p>
          <p>Bestandsgrootte: {{ props.fileProperties.size }}</p>
        </div>
      </div>
      <h3>Inhoud</h3>
      <Textarea
        v-model="content"
        disabled
        :autoResize="true"
        cols="150"
        style="border: none; color: #dc0714"
      ></Textarea>
      <template #footer>
        <Button label="Sluiten" icon="pi pi-times" class="p-button-text" @click="closeBasic" />
      </template>
    </Dialog>
    <Tree :value="nodes" v-if="showTree">
      <template #url="{ node }">
        <a style="text-decoration: none; color: #1c3e61" href="#" @click="openBasic(node.data)">{{
          node.label
        }}</a>
      </template>
    </Tree>
    <ProgressSpinner v-if="!showTree" />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from '@vue/runtime-core';
import { useToast } from 'primevue/components/toast/useToast';
import { HubConnectionBuilder } from '@microsoft/signalr';
export default defineComponent({
  setup(properties) {
    const displayBasic = ref(false);
    const position = ref('center');
    const content = ref('');
    const props = ref('');
    const toast = useToast();
    const nodes = ref([]);
    const showTree = ref(true);
    const eventHubUrl = process.env.VUE_APP_PREINGEST_EVENTHUB || '/preingestEventHub/';
    const connection = new HubConnectionBuilder().withUrl(eventHubUrl).build();

    async function getItemContent(base64Data: string) {
      try {
        const baseUrl = process.env.VUE_APP_PREINGEST_API || '/api/';
        const fullUrl = `${baseUrl}output/item_content/${base64Data}`;
        const defaults = {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        };
        return await fetch(fullUrl, {
          ...defaults,
          headers: {
            ...defaults.headers,
          },
        })
          .then((res) => res.json())
          .catch((reason) =>
            toast.add({
              severity: 'error',
              summary: `Failed to parse response for ${fullUrl}`,
              detail: reason,
              // Set some max lifetime, as very wide error messages may hide the toast's close button
              life: 10000,
            })
          )
          .then((d) => (content.value = atob(d.data)));
      } catch (error) {
        console.log(error);
      }
    }

    async function getItemProps(base64Data: string) {
      try {
        const baseUrl = process.env.VUE_APP_PREINGEST_API || '/api/';
        const fullUrl = `${baseUrl}output/item_properties/${base64Data}`;
        const defaults = {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        };
        return await fetch(fullUrl, {
          ...defaults,
          headers: {
            ...defaults.headers,
          },
        })
          .then((res) => res.json())
          .catch((reason) =>
            toast.add({
              severity: 'error',
              summary: `Failed to parse response for ${fullUrl}`,
              detail: reason,
              // Set some max lifetime, as very wide error messages may hide the toast's close button
              life: 10000,
            })
          )
          .then((d) => (props.value = d.data));
      } catch (error) {
        console.log(error);
      }
    }

    async function getData(sessionId: string) {
      try {
        const baseUrl = process.env.VUE_APP_PREINGEST_API || '/api/';
        const fullUrl = `${baseUrl}output/view_structure/${sessionId}`;
        const defaults = {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        };
        return await fetch(fullUrl, {
          ...defaults,
          headers: {
            ...defaults.headers,
          },
        })
          .then((res) => res.json())
          .catch((reason) =>
            toast.add({
              severity: 'error',
              summary: `Failed to parse response for ${fullUrl}`,
              detail: reason,
              // Set some max lifetime, as very wide error messages may hide the toast's close button
              life: 10000,
            })
          )
          .then((d) => {
            nodes.value = d.root;
          });
      } catch (error) {
        console.log(error);
      }
    }

    function handleEvent(json: string) {
      const objJson = JSON.parse(json.toString());
      if (
        (objJson.name == 'UnpackTarHandler' ||
          objJson.name == 'ToPX2MDTOHandler' ||
          objJson.name == 'BuildOpexHandler') &&
        objJson.state == 'Completed'
      ) {
        // toast.add({
        //   severity: 'info',
        //   summary: objJson.name + ' ' + properties.sessionId,
        //   life: 5000,
        // });
        getData(properties.sessionId);
      }

      if (objJson.state == 'Completed' || objJson.state == 'Failed') {
        showTree.value = true;
      } else {
        showTree.value = false;
      }
    }

    const closeBasic = () => {
      displayBasic.value = false;
    };

    const openBasic = (data: string) => {
      //position.value = 'topright';
      displayBasic.value = true;
      getItemProps(data);
      getItemContent(data);
    };

    const connect = async () => {
      // This does not emit events for new/reset/deleted collections unless some other change happens
      connection.on('SendNoticeEventToClient', handleEvent);
      await connection.start();
    };

    const disconnect = async () => {
      await connection.stop();
    };

    return {
      displayBasic,
      openBasic,
      closeBasic,
      position,
      content,
      props,
      toast,
      eventHubUrl,
      connection,
      connect,
      disconnect,
      getData,
      nodes,
      showTree,
    };
  },
  data() {
    return {
      display: false,
    };
  },

  props: {
    sessionId: {
      type: String,
      required: true,
    },
  },

  async created() {
    await this.getData(this.sessionId);
    this.connect();
  },

  unmounted() {
    this.disconnect();
  },
});
</script>
