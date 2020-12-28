<template>
  <div class="collection">
    <div v-if="collection">
      <p>Aanmaakdatum: {{ collection.creationTime }}</p>
      <p>Bestandsgrootte: {{ collection.size }}</p>
      <p>Untar sessie: {{ collection.unpackSessionId ?? 'niet gevonden' }}</p>
    </div>
    <DataTable
      :value="steps"
      :autoLayout="true"
      v-model:selection="selectedSteps"
      v-model:expandedRows="expandedRows"
      @row-select="onStepSelect"
      @row-unselect="onStepUnselect"
      class="p-datatable-sm"
      :rowClass="rowClass"
    >
      <!-- TODO hide expander if not applicable -->
      <!-- TODO this increases the table height, despite class="p-datatable-sm" -->
      <Column :expander="true" headerStyle="width: 3rem" />

      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

      <Column field="name" header="Actie" />

      <Column field="state" header="Status" headerClass="p-text-center" bodyClass="p-text-center">
        <template #body="slotProps">
          <Tag v-if="slotProps.data.selected" severity="info">wachten</Tag>
          <Tag v-else-if="slotProps.data.state === 'RUNNING'" severity="info">bezig</Tag>
          <Tag v-else-if="slotProps.data.state === 'SUCCESS'" severity="success">gereed</Tag>
          <Tag v-else-if="slotProps.data.state === 'ERROR'" severity="danger">fout</Tag>
        </template>
      </Column>

      <template #expansion="slotProps">
        <div class="pre">{{ slotProps.data.result }}</div>
      </template>
    </DataTable>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { useConfirm } from 'primevue/useConfirm';
import { useToast } from 'primevue/usetoast';
import { useApi } from '@/plugins/PreingestApi';
import { ActionResult, Collection } from '@/services/PreingestApiService';
import { DependentItem, getDependencies, getDependents } from '@/utils/dependentList';

interface Step extends DependentItem {
  name: string;
  // The initial or current selection state
  selected?: boolean;
  // A fixed value for selected (false forces the step to always be non-selected)
  fixedSelected?: boolean;
  // Result files default to `<id>Handler.json`, but may need to be more specific for, e.g.,
  // `DroidValidationHandler.csv` and `DroidValidationHandler.planets.xml`
  reportFile?: string;
  state?: 'RUNNING' | 'SUCCESS' | 'ERROR';
  result?: ActionResult | ActionResult[];
}

interface SelectionEvent {
  originalEvent: Event;
  data: Step;
}

export default defineComponent({
  props: {
    filename: {
      type: String,
      required: true,
    },
  },
  async setup(props) {
    const api = useApi();
    const confirm = useConfirm();
    const toast = useToast();
    const expandedRows = ref([]);
    const collection = ref<Collection | undefined>();
    const selectedSteps = ref<Step[]>([]);

    const steps = ref<Step[]>([
      { id: 'check', dependsOn: [], name: 'Checksum berekenen' },
      { id: 'UnpackTar', dependsOn: [], name: 'Archief uitpakken' },
      { id: 'ScanVirus', dependsOn: ['UnpackTar'], name: 'Viruscontrole' },
      { id: 'NamingValidation', dependsOn: ['UnpackTar'], name: 'Bestandsnamen controleren' },
      {
        id: 'SidecarValidation',
        dependsOn: ['UnpackTar'],
        name: 'Mappen en bestanden controleren op sidecarstructuur',
      },
      {
        id: 'DroidValidation',
        reportFile: 'DroidValidationHandler.droid',
        dependsOn: ['UnpackTar'],
        name: 'DROID voorbereiden',
      },
      {
        id: 'droid-csv',
        reportFile: 'DroidValidationHandler.csv',
        dependsOn: ['DroidValidation'],
        name: 'DROID metagegevens exporteren naar CSV',
      },
      {
        id: 'droid-pdf',
        reportFile: 'DroidValidationHandler.pdf',
        dependsOn: ['DroidValidation'],
        name: 'DROID metagegevens exporteren naar PDF/A',
      },
      {
        id: 'droid-xml',
        reportFile: 'DroidValidationHandler.planets.xml',
        dependsOn: ['DroidValidation'],
        name: 'DROID metagegevens exporteren naar XML',
      },
      {
        id: 'GreenList',
        dependsOn: ['droid-csv'],
        name: 'Controleren of alle bestandstypen aan greenlist voldoen',
      },
      { id: 'Encoding', dependsOn: ['UnpackTar'], name: 'Encoding metadatabestanden controleren' },
      {
        id: 'MetadataValidation',
        dependsOn: ['UnpackTar'],
        name: 'Metadata valideren met XML-schema (XSD) en Schematron',
      },
      {
        id: 'Transformation',
        dependsOn: ['UnpackTar'],
        name: 'Metadatabestanden omzetten naar XIP bestandsformaat',
      },
      {
        id: 'sip',
        dependsOn: ['UnpackTar', 'Transformation'],
        name: 'Bestanden omzetten naar SIP bestandsformaat',
      },
    ]);

    // Force `selected` to match `fixSelected`, in case the definition above is not consistent; this
    // does not also force-select/unselect any dependencies or dependents
    steps.value.forEach((step) => (step.selected = step.fixedSelected ?? step.selected));
    selectedSteps.value = steps.value.filter((step) => step.selected);

    // For the demo: try to load the archive's state, to see if it's already unpacked
    api.getCollection(props.filename).then(async (c) => {
      collection.value = c;
      const sessionId = c.unpackSessionId;
      if (sessionId) {
        const unpackStep = steps.value.find((s) => s.id === 'UnpackTar');
        if (unpackStep) {
          unpackStep.selected = true;
          unpackStep.fixedSelected = false;
          selectedSteps.value = steps.value.filter((step) => step.selected);
        }

        const resultFiles = await api.getSessionResults(sessionId);
        resultFiles.forEach((name) => {
          const step = steps.value.find((s) => (s.reportFile ?? s.id + 'Handler.json') === name);
          if (step) {
            step.state = 'SUCCESS';
            if (name.endsWith('.json')) {
              api.getActionResult(sessionId, `${step.id}Handler`).then((json) => {
                step.result = json;
                // TODO Get generic API results or move into definition of steps
                switch (step.id) {
                  case 'MetadataValidation':
                    step.state =
                      Array.isArray(step.result) && step.result.length > 0 ? 'ERROR' : 'SUCCESS';
                    break;
                }
              });
            }
            step.reportFile = name;
          }
        });
      }
    });

    return {
      confirm,
      toast,
      expandedRows,
      steps,
      selectedSteps,
      collection,
    };
  },
  watch: {
    // When selecting/unselecting a single item, this is invoked after onStepSelect/onStepUnselect,
    // after any dependencies have been selected/unselected
    selectedSteps(selected: Step[]) {
      // To avoid endless recursive updates, determine if updating is needed
      const forceUpdate = this.steps
        .filter((step) => step.fixedSelected !== undefined)
        .some((step) => !!selected.find((s) => s.id === step.id) !== step.fixedSelected);

      if (forceUpdate) {
        // Copy the new selection state into the steps, unless the value is fixed
        this.steps.forEach(
          (step: Step) =>
            (step.selected = step.fixedSelected ?? selected.some((item) => item.id === step.id))
        );
        // Triggers this very watch again
        this.selectedSteps = this.steps.filter((step) => step.selected);
      }
    },
  },
  methods: {
    // TODO merge the watcher with the following
    // These events are not emitted when using the select all checkbox
    onStepSelect(event: SelectionEvent) {
      const step = event.data;
      step.selected = true;
      const dependencies = getDependencies(step, this.steps);
      dependencies.forEach((dependency) => (dependency.selected = true));
      // This does not cause the watcher for selectedSteps to be triggered twice
      this.selectedSteps = [...new Set([...this.selectedSteps, ...dependencies])];
    },
    onStepUnselect(event: SelectionEvent) {
      const step = event.data;
      step.selected = false;
      const dependents = getDependents(step, this.steps);
      dependents.forEach((dependent) => (dependent.selected = false));
      this.selectedSteps = this.selectedSteps.filter(
        (step) => !dependents.some((d) => d.id === step.id)
      );
    },
    rowClass(data: Step) {
      return data.fixedSelected !== undefined ? 'selection-disabled' : null;
    },
  },
});
</script>

<style scoped lang="scss">
::v-deep(.selection-disabled .p-selection-column) {
  pointer-events: none;
  opacity: 0.2;
}
</style>
