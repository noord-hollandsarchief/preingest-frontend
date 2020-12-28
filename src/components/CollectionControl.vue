<template>
  <div class="collection">
    <DataTable
      :value="steps"
      :autoLayout="true"
      v-model:selection="selectedSteps"
      v-model:expandedRows="expandedRows"
      @row-select="onStepSelect"
      @row-unselect="onStepUnselect"
      class="p-datatable-sm"
    >
      <!-- TODO hide expander if not applicable -->
      <!-- TODO this increases the table height, despite class="p-datatable-sm" -->
      <Column :expander="true" headerStyle="width: 3rem" />

      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

      <Column field="name" header="Actie" />
      <Column field="state" header="Status">
        <template #body="slotProps">
          <Tag v-if="slotProps.data.selected" severity="success">wachten</Tag>
        </template>
      </Column>

      <template #expansion="slotProps">
        <div class="collection-sessions">
          <DataTable :value="slotProps.data.tarResultData">
            <Column field="sessionId" header="Sessie" sortable></Column>
            <Column field="code" header="Code" sortable></Column>
            <Column field="creationTimestamp" header="Datum" sortable>
              <template #body="slotProps">
                {{ formatDateString(slotProps.data.creationTimestamp) }}
              </template>
            </Column>
            <Column field="actionName" header="Actie" sortable></Column>
            <Column headerStyle="width:4rem">
              <template #body="slotProps">
                <router-link :to="`/session/${slotProps.data.sessionId}`">
                  <Button
                    icon="pi pi-search"
                    class="p-button-sm p-button-rounded"
                    @click="showSession(slotProps.data.sessionId)"
                    v-tooltip="'Bekijk de resultaten'"
                  />
                </router-link>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </DataTable>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { useConfirm } from 'primevue/useConfirm';
import { useToast } from 'primevue/usetoast';
import { DependentItem, getDependencies, getDependents } from '@/utils/dependentList';

interface Step extends DependentItem {
  name: string;
  selected?: boolean;
  result?: string;
}

interface SelectionEvent {
  originalEvent: Event;
  data: Step;
}

export default defineComponent({
  async setup() {
    const confirm = useConfirm();
    const toast = useToast();
    const expandedRows = ref([]);
    const selectedSteps = ref<Step[]>([]);

    // This assumes all dependencies are declared before they're needed
    const steps = ref<Step[]>([
      { id: 'check', dependsOn: [], name: 'Checksum berekenen' },
      { id: 'unpack', dependsOn: [], name: 'Archief uitpakken' },
      { id: 'virus', dependsOn: ['unpack'], name: 'Viruscontrole' },
      { id: 'filenames', dependsOn: ['unpack'], name: 'Bestandsnamen controleren' },
      {
        id: 'sidecar',
        dependsOn: ['unpack'],
        name: 'Mappen en bestanden controleren op sidecarstructuur',
      },
      { id: 'droid', dependsOn: ['unpack'], name: 'DROID voorbereiden' },
      { id: 'droid-csv', dependsOn: ['droid'], name: 'DROID metagegevens exporteren naar CSV' },
      { id: 'droid-pdf', dependsOn: ['droid'], name: 'DROID metagegevens exporteren naar PDF/A' },
      { id: 'droid-xml', dependsOn: ['droid'], name: 'DROID metagegevens exporteren naar XML' },
      {
        id: 'greenlist',
        dependsOn: ['droid-csv'],
        name: 'Controleren of alle bestandstypen aan greenlist voldoen',
      },
      { id: 'encoding', dependsOn: ['unpack'], name: 'Encoding metadatabestanden controleren' },
      {
        id: 'schematron',
        dependsOn: ['unpack'],
        name: 'Metadata valideren met XML-schema (XSD) en Schematron',
      },
      {
        id: 'xip',
        dependsOn: ['unpack'],
        name: 'Metadatabestanden omzetten naar XIP bestandsformaat',
      },
      {
        id: 'sip',
        dependsOn: ['unpack', 'xip'],
        name: 'Bestanden omzetten naar SIP bestandsformaat',
      },
    ]);

    return {
      confirm,
      toast,
      expandedRows,
      steps,
      selectedSteps,
    };
  },
  watch: {
    // When selecting/unselecting a single item, this is invoked after onStepSelect/onStepUnselect,
    // after any dependencies have been selected/unselected
    selectedSteps(selected: Step[]) {
      this.steps.forEach((step) => (step.selected = selected.some((v) => v.name === step.name)));
    },
  },
  methods: {
    // These events are not emitted when using the select all checkbox
    onStepSelect(event: SelectionEvent) {
      const step = event.data;
      const dependencies = getDependencies(step, this.steps);
      // This does not cause the watcher for selectedSteps to be triggered twice
      this.selectedSteps = [...new Set([...this.selectedSteps, ...dependencies])];
    },
    onStepUnselect(event: SelectionEvent) {
      const step = event.data;
      const dependents = getDependents(step, this.steps);
      this.selectedSteps = this.selectedSteps.filter(
        (step) => !dependents.some((d) => d.id === step.id)
      );
    },
  },
});
</script>

<style scoped lang="scss"></style>
