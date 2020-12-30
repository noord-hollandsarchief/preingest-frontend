<template>
  <div class="card">
    <DataTable
      :value="collections"
      :autoLayout="true"
      :filters="filters"
      sortField="creationTime"
      :sortOrder="1"
    >
      <template #header>
        <div style="text-align: right">
          <i class="pi pi-search" style="margin: 4px 4px 0 0"></i>
          <!-- This searches in the original data (unless excluded) -->
          <InputText v-model="filters['global']" placeholder="Zoek" size="50" />
        </div>
      </template>

      <Column field="name" header="Naam" :sortable="true" filterMatchMode="contains" />

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
      <Column
        field="lastAccessTime"
        header="Verwerkingsdatum"
        :sortable="true"
        :excludeGlobalFilter="true"
      >
        <template #body="slotProps">
          {{ formatDateString(slotProps.data.lastAccessTime) }}
        </template>
      </Column>

      <Column field="size" header="Grootte" :sortable="true" :excludeGlobalFilter="true">
        <template #body="slotProps">
          {{ formatFileSize(slotProps.data.size) }}
        </template>
      </Column>

      <Column
        header="Status"
        :sortable="true"
        headerClass="p-text-center"
        bodyClass="p-text-center"
      >
        <template #body="slotProps">
          <Tag v-if="!slotProps.data.tarResultData" severity="info">nieuw</Tag>
          <Tag v-else severity="warning">onbekend </Tag>
        </template>
      </Column>

      <Column headerStyle="width:8rem">
        <template #body="slotProps">
          <router-link :to="`/file/${slotProps.data.name}`" style="text-decoration: none">
            <Button
              v-if="slotProps.data.tarResultData"
              icon="pi pi-search"
              class="p-button-sm p-button-rounded"
              v-tooltip="'Bekijk de resultaten'"
            />
            <Button
              v-else
              icon="pi pi-play"
              class="p-button-sm p-button-rounded p-button-success"
              v-tooltip="'Start verwerking van dit bestand'"
            />
          </router-link>

          <Button
            icon="pi pi-trash"
            class="p-button-sm p-button-rounded p-button-danger p-ml-2"
            @click="deleteFile($event, slotProps.data.name)"
            v-tooltip="'Verwijder het bestand en de resultaten'"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { useConfirm } from 'primevue/useConfirm';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { formatDateString, formatFileSize } from '@/utils/formatters';

export default defineComponent({
  async setup() {
    const confirm = useConfirm();
    const toast = useToast();
    const filters = ref({});
    const multiSortMeta = ref([{ field: 'creationTime', order: 1 }]);

    const collections = await useApi().getCollections();

    return {
      formatDateString,
      formatFileSize,
      confirm,
      toast,
      collections,
      filters,
      multiSortMeta,
    };
  },
  methods: {
    deleteFile(event: Event, name: string) {
      this.confirm.require({
        header: 'Bestand en resultaten definitief verwijderen',
        message: `Het bestand "${name}" en bijbehorende resultaten definitief van disk verwijderen?`,
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Verwijderen',
        rejectLabel: 'Annuleren',
        accept: () => {
          // TODO Invoke API to delete the file
          this.toast.add({
            severity: 'info',
            summary: `TODO Delete file ${name}`,
            life: 2000,
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
.collection-sessions {
  // TODO sass param
  margin-left: 1.3 * 3rem;
}
</style>
