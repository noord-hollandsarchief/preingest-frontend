<template>
  <div class="card">
    <DataTable
      :value="collections"
      :autoLayout="true"
      v-model:selection="selectedCollections"
      dataKey="sessionId"
      :filters="filters"
      sortField="creationTime"
      :sortOrder="-1"
      :rowHover="true"
    >
      <template #header>
        <div class="p-d-flex datatable-header">
          <div>
            <Button
              v-if="hasSelection"
              :disabled="!hasSelection || resetting || deleting"
              :label="resetting ? 'Bezig...' : 'Wis resultaten'"
              icon="pi pi-replay"
              class="p-button-warning p-mr-2"
              @click="resetCollections"
            />
            <Button
              v-if="hasSelection"
              :disabled="!hasSelection || resetting || deleting"
              :label="
                deleting
                  ? 'Bezig...'
                  : `Verwijder bestand${selectedCollections.length > 1 ? 'en' : ''}`
              "
              icon="pi pi-trash"
              class="p-button-danger p-mr-2"
              @click="removeCollections"
            />
          </div>
          <div class="p-ml-auto">
            <!-- TODO matching search somehow moves focus to selection checkbox -->
            <!-- TODO clear search icon -->
            <span class="p-input-icon-left">
              <i class="pi pi-search"></i>
              <!-- This searches in the original data (unless excluded) -->
              <InputText v-model="filters['global']" placeholder="Zoek" />
            </span>
          </div>
        </div>
      </template>

      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

      <Column field="name" header="Naam" :sortable="true" filterMatchMode="contains">
        <template #body="slotProps">
          <router-link :to="`/s/${slotProps.data.sessionId}`">
            {{ slotProps.data.name }}
          </router-link>
        </template>
      </Column>

      <Column
        field="creationTime"
        header="Aanmaakdatum"
        :sortable="true"
        :excludeGlobalFilter="true"
      >
        <template #body="slotProps">
          {{ formatDateString(slotProps.data.creationTime) }}
        </template>
      </Column>

      <!-- TODO What defines "last access"? This may not be the last action date at all? -->
      <!--      <Column-->
      <!--        field="lastAccessTime"-->
      <!--        header="Verwerkingsdatum"-->
      <!--        :sortable="true"-->
      <!--        :excludeGlobalFilter="true"-->
      <!--      >-->
      <!--        <template #body="slotProps">-->
      <!--          {{ formatDateString(slotProps.data.lastAccessTime) }}-->
      <!--        </template>-->
      <!--      </Column>-->

      <Column field="size" header="Grootte" :sortable="true" :excludeGlobalFilter="true">
        <template #body="slotProps">
          {{ formatFileSize(slotProps.data.size) }}
        </template>
      </Column>

      <Column
        field="overallStatus"
        header="Status"
        :sortable="true"
        headerClass="p-text-center"
        bodyClass="p-text-center"
      >
        <template #body="slotProps">
          <Tag v-if="slotProps.data.overallStatus === 'New'" severity="info">nieuw</Tag>
          <Tag v-else-if="slotProps.data.overallStatus === 'Running'" severity="warning">bezig</Tag>
          <Tag
            v-else-if="slotProps.data.overallStatus === 'Success'"
            severity="success"
            v-tooltip="'Alle geselecteerde acties zijn zonder fouten uitgevoerd'"
            >gereed</Tag
          >
          <Tag
            v-else-if="slotProps.data.overallStatus === 'Error'"
            severity="danger"
            v-tooltip="'Alle geselecteerde acties zijn uitgevoerd, maar er zijn fouten gevonden'"
            >fout</Tag
          >
          <Tag
            v-else-if="slotProps.data.overallStatus === 'Failed'"
            severity="danger"
            v-tooltip="'Een of meer acties konden niet worden uitgevoerd'"
            >mislukt</Tag
          >
        </template>
      </Column>

      <Column
        header="Voortgang"
        :sortable="false"
        :excludeGlobalFilter="true"
        headerClass="p-text-center"
        bodyClass="p-text-center"
      >
        <template #body="slotProps">
          <SessionProgress :preingestActions="slotProps.data.preingest" />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script lang="ts">
import { defineComponent, onUnmounted, ref } from 'vue';
import { useConfirm } from 'primevue/useConfirm';
import { useToast } from 'primevue/components/toast/useToast';
import SessionProgress from '@/components/SessionProgress.vue';
import { useCollectionsWatcher } from '@/composables/useCollectionsWatcher';
import { useApi } from '@/plugins/PreingestApi';
import { Collection } from '@/services/PreingestApiService';
import { formatDateString, formatFileSize } from '@/utils/formatters';

export default defineComponent({
  components: { SessionProgress },
  async setup() {
    const api = useApi();
    const confirm = useConfirm();
    const toast = useToast();
    const filters = ref({});
    const collections = ref<Collection[] | undefined>();
    const selectedCollections = ref<Collection[]>([]);
    const resetting = ref(false);
    const deleting = ref(false);

    const { startWatcher, stopWatcher } = useCollectionsWatcher(collections);
    startWatcher();
    onUnmounted(() => stopWatcher());

    api.getCollections().then(async (c) => {
      collections.value = c;
    });

    return {
      api,
      formatDateString,
      formatFileSize,
      confirm,
      toast,
      collections,
      selectedCollections,
      filters,
      resetting,
      deleting,
    };
  },
  computed: {
    hasSelection(): boolean {
      return this.selectedCollections.length > 0;
    },
  },
  methods: {
    async removeCollections() {
      // TODO block UI
      const count = this.selectedCollections.length;
      const names = this.selectedCollections
        .map((c) => `"${c.name}"`)
        .join(', ')
        .replace(/^(.*)(, )([^,]*)$/, '$1 en $3');

      this.confirm.require({
        header: `Bestand${count > 1 ? 'en' : ''} en resultaten definitief verwijderen`,
        message: `${
          count === 1 ? 'Het bestand' : `De ${count} bestanden`
        } ${names} en bijbehorende resultaten definitief van disk verwijderen?`,
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Verwijderen',
        rejectLabel: 'Annuleren',
        accept: async () => {
          this.deleting = true;

          for (const collection of this.selectedCollections) {
            await this.api.removeSessionAndFile(collection.sessionId);
            this.selectedCollections = this.selectedCollections.filter(
              (c) => c.sessionId !== collection.sessionId
            );
          }

          this.collections = await this.api.getCollections();
          this.deleting = false;

          this.toast.add({
            severity: 'info',
            summary: `${count} bestand${count > 1 ? 'en' : ''}  met resultaten verwijderd`,
            life: 5000,
          });
        },
        reject: () => {
          // User canceled
        },
      });
    },

    // TODO DRY
    async resetCollections() {
      // TODO block UI
      const count = this.selectedCollections.length;
      const names = this.selectedCollections
        .map((c) => `"${c.name}"`)
        .join(', ')
        .replace(/^(.*)(, )([^,]*)$/, '$1 en $3');

      this.confirm.require({
        header: `Resultaten wissen`,
        message: `De resultaten van ${
          count === 1 ? 'het bestand' : `de ${count} bestanden`
        } ${names} wissen? ${count === 1 ? 'Het bestand blijft' : 'De bestanden blijven'} bestaan.`,
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-warning',
        acceptLabel: 'Wis resultaten',
        rejectLabel: 'Annuleren',
        accept: async () => {
          this.resetting = true;

          for (const collection of this.selectedCollections) {
            await this.api.resetSession(collection.sessionId);
            this.selectedCollections = this.selectedCollections.filter(
              (c) => c.sessionId !== collection.sessionId
            );
          }

          this.collections = await this.api.getCollections();
          this.resetting = false;

          this.toast.add({
            severity: 'info',
            summary: `Resultaten van ${count} bestand${count > 1 ? 'en' : ''} gewist`,
            life: 5000,
          });
        },
        reject: () => {
          // User canceled
        },
      });
    },
  },
});
</script>

<style scoped lang="scss">
a,
a:visited {
  color: inherit;
}
</style>
