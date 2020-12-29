<template v-if="collection">
  <div class="collection card">
    <div>
      <h3>Gegevens</h3>
      <p>Bestandsnaam: {{ filename }}</p>
      <p>Aanmaakdatum: {{ formatDateString(collection.creationTime) }}</p>
      <p>Bestandsgrootte: {{ formatFileSize(collection.size) }}</p>
      <!-- <p>Untar sessie: {{ collection.unpackSessionId ?? 'niet gevonden' }}</p> -->
      <p>Checksum: {{ collection.calculatedChecksum ?? 'niet berekend' }}</p>
      <div class="p-fluid p-formgrid p-grid">
        <div class="p-field p-col-12 p-md-3">
          <label for="checksumType">Type checksum</label>
          <Dropdown
            id="checksumType"
            v-model="collection.checksumType"
            :options="checksumTypes"
            optionLabel="name"
            optionValue="code"
            placeholder="Maak een keuze"
          />
        </div>
        <div class="p-field p-col-12 p-md-9">
          <label for="expectedChecksum">Opgegeven checksum</label>
          <InputText
            id="expectedChecksum"
            v-model="collection.expectedChecksum"
            type="text"
            placeholder="De checksum van de zorgdrager"
          />
        </div>
        <div class="p-field p-col-12">
          <label for="greenlist">Greenlist</label>
          <!-- TODO the actual types would need to be far more specific? -->
          <Chips
            v-model="collection.greenlist"
            separator=","
            id="greenlist"
            placeholder="Toegestane documenttypes, kommagescheiden: doc,xls,pdf"
          />
        </div>
        <div class="p-field p-col-12">
          <label for="description">Omschrijving</label>
          <Textarea id="description" rows="2" :autoResize="true" />
        </div>
      </div>
      <Button label="Opslaan" icon="pi pi-save" class="p-button-success p-mr-2" @click="save" />
    </div>
  </div>

  <div class="card">
    <h3>Verwerken</h3>

    <Toolbar class="p-mb-4">
      <template #left>
        <Button
          :disabled="!hasSelection"
          label="Start"
          icon="pi pi-play"
          class="p-button-success p-mr-2"
          @click="run"
        />
      </template>

      <template #right>
        <Button
          :disabled="true"
          label="Ingest"
          icon="pi pi-upload"
          class="p-button-help p-mx-2"
          @click="runIngest"
        />
        <Button
          label="Excel rapport"
          icon="pi pi-download"
          class="p-button-help"
          @click="downloadExcel"
        />
      </template>
    </Toolbar>

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
      <Column :expander="true" headerStyle="width: 1rem" bodyStyle="padding: 0" />

      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

      <Column field="name" header="Actie">
        <template #body="slotProps">
          <span v-tooltip="slotProps.data.info">
            {{ slotProps.data.name }} <i v-if="slotProps.data.info" class="pi pi-info-circle"></i>
          </span>
        </template>
      </Column>

      <Column field="state" header="Status" headerClass="p-text-center" bodyClass="p-text-center">
        <template #body="slotProps">
          <Tag v-if="slotProps.data.selected" severity="info">wachtrij</Tag>
          <Tag v-else-if="slotProps.data.state === 'RUNNING'" severity="info">bezig</Tag>
          <Tag v-else-if="slotProps.data.state === 'SUCCESS'" severity="success">gereed</Tag>
          <Tag v-else-if="slotProps.data.state === 'ERROR'" severity="danger">fout</Tag>
        </template>
      </Column>

      <template #expansion="slotProps">
        <div class="pre">{{ slotProps.data.result }}</div>
        <a v-if="slotProps.data.downloadUrl" :href="slotProps.data.downloadUrl">Download</a>
      </template>
    </DataTable>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { useConfirm } from 'primevue/useConfirm';
import { useToast } from 'primevue/usetoast';
import { useApi } from '@/plugins/PreingestApi';
import { ActionResult, Collection, checksumTypes } from '@/services/PreingestApiService';
import { DependentItem, getDependencies, getDependents } from '@/utils/dependentList';
import { formatDateString, formatFileSize } from '@/utils/formatters';

interface Step extends DependentItem {
  name: string;
  info?: string;
  // The initial or current selection state
  selected?: boolean;
  // A fixed value for selected (false forces the step to always be non-selected)
  fixedSelected?: boolean;
  // Result files default to `<id>Handler.json`, but may need to be more specific for, e.g.,
  // `DroidValidationHandler.csv` and `DroidValidationHandler.planets.xml`
  reportFile?: string;
  state?: 'RUNNING' | 'SUCCESS' | 'ERROR';
  result?: ActionResult | ActionResult[];
  downloadUrl?: string;
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
      { id: 'ContainerChecksum', dependsOn: [], name: 'Checksum berekenen' },
      { id: 'UnpackTar', dependsOn: [], name: 'Archief uitpakken' },
      { id: 'ScanVirusValidation', dependsOn: ['UnpackTar'], name: 'Viruscontrole' },
      { id: 'NamingValidation', dependsOn: ['UnpackTar'], name: 'Bestandsnamen controleren' },
      {
        id: 'SidecarValidation',
        reportFile: 'SidecarValidationHandler_Samenvatting.json',
        dependsOn: ['UnpackTar'],
        name: 'Mappen en bestanden controleren op sidecarstructuur',
      },
      {
        id: 'DroidValidation',
        reportFile: 'DroidValidationHandler.droid',
        dependsOn: ['UnpackTar'],
        name: 'DROID bestandsclassificatie voorbereiden',
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
        // If ever running tasks in parallel, then GreenList needs to be run first, if selected
        dependsOn: ['UnpackTar'],
        name: 'Metadatabestanden omzetten naar XIP bestandsformaat',
        info:
          'Dit verandert de mapinhoud, dus heeft effect op de controle van de greenlist als die pas later wordt uitgevoerd',
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

        const checksumStep = steps.value.find((s) => s.id === 'ContainerChecksum');
        if (checksumStep) {
          checksumStep.result = c.tarResultData.find(
            (r) => r.actionName === 'ContainerChecksumHandler'
          );
          // TODO API Why do we get "message": "Geen resultaten."`?
          checksumStep.state =
            checksumStep.result?.message === 'Geen resultaten.' ? 'ERROR' : 'SUCCESS';
          // E.g. `"message": "SHA1 : cc8d8a7d1de976bc94f7baba4c24409817f296c1"`
          collection.value.calculatedChecksum = checksumStep.result?.message;
        }

        const resultFiles = await api.getSessionResults(sessionId);
        resultFiles.forEach((name) => {
          const step = steps.value.find((s) => (s.reportFile ?? s.id + 'Handler.json') === name);
          if (step) {
            step.state = 'SUCCESS';
            if (name.endsWith('.json')) {
              api.getActionResult(sessionId, name).then((json) => {
                step.result = json;
                // TODO Get generic API results or move into definition of steps
                switch (step.id) {
                  case 'MetadataValidation':
                    step.state =
                      Array.isArray(step.result) && step.result.length > 0 ? 'ERROR' : 'SUCCESS';
                    break;
                  case 'GreenList':
                    step.state =
                      Array.isArray(step.result) && step.result.some((r) => r.InGreenList === false)
                        ? 'ERROR'
                        : 'SUCCESS';
                    break;
                }
              });
            } else {
              step.downloadUrl = api.getActionReportUrl(sessionId, name);
            }
            step.reportFile = name;
          }
        });
      }
    });

    return {
      checksumTypes,
      formatDateString,
      formatFileSize,
      confirm,
      toast,
      expandedRows,
      steps,
      selectedSteps,
      collection,
    };
  },
  computed: {
    hasSelection(): boolean {
      return this.selectedSteps.length > 0;
    },
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
      return {
        'selection-disabled': data.fixedSelected !== undefined,
        'expander-disabled': !data.result && !data.downloadUrl,
      };
    },
    downloadExcel() {
      // TODO Download Excel report
    },
  },
});
</script>

<style scoped lang="scss">
::v-deep(.selection-disabled .p-selection-column) {
  pointer-events: none;
  opacity: 0.2;
}
::v-deep(.expander-disabled .p-row-toggler) {
  pointer-events: none;
  opacity: 0.2;
}
</style>
