<template v-if="collection">
  <div class="collection card">
    <div>
      <h3>Gegevens</h3>
      <p>Bestandsnaam: {{ filename }}</p>
      <div v-if="collection">
        <p>Aanmaakdatum: {{ formatDateString(collection.creationTime) }}</p>
        <p>Bestandsgrootte: {{ formatFileSize(collection.size) }}</p>
        <p>Untar sessie: {{ collection.unpackSessionId ?? 'niet gevonden' }}</p>
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
          @click="runSelected"
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
          <Tag v-if="slotProps.data.state === 'wait'" severity="info">wachtrij</Tag>
          <Tag v-else-if="slotProps.data.state === 'running'" severity="warning">bezig</Tag>
          <Tag v-else-if="slotProps.data.state === 'success'" severity="success">gereed</Tag>
          <Tag
            v-else-if="slotProps.data.state === 'error'"
            severity="danger"
            v-tooltip="'De actie is uitgevoerd, maar er zijn fouten gevonden'"
            >fout</Tag
          >
          <Tag
            v-else-if="slotProps.data.state === 'failed'"
            severity="danger"
            v-tooltip="'De actie kon niet worden uitgevoerd'"
            >onbekend</Tag
          >
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
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import {
  ActionResult,
  GreenListActionResult,
  Collection,
  checksumTypes,
  Action,
  actions,
} from '@/services/PreingestApiService';
import { getDependencies, getDependents } from '@/utils/dependentList';
import { formatDateString, formatFileSize } from '@/utils/formatters';
import dayjs from 'dayjs';

type StepState = 'wait' | 'running' | 'success' | 'error' | 'failed';

type Step = Action & {
  // The initial or current selection state
  selected?: boolean;
  // A fixed value for selected (false forces the step to always be non-selected)
  fixedSelected?: boolean;
  state?: StepState;
  lastFetchedState?: StepState;
  downloadUrl?: string;
  /**
   * A custom function to trigger an action; if not set then {@link triggerActionAndGetNewResults} is used
   */
  triggerFn?: (step: Step) => Promise<ActionResult | ActionResult[]>;
};

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

    const notImplemented = () => {
      toast.add({
        severity: 'error',
        summary: 'Not implemented',
        life: 1000,
      });
    };

    const calculateChecksum = async (step: Step): Promise<ActionResult> => {
      // TODO enforce
      if (!collection.value || !collection.value.checksumType) {
        throw Error('TODO: enforce checksum type selection');
      }
      const result = await api.getChecksum(collection.value.name, collection.value.checksumType);
      collection.value.calculatedChecksum = result.message;
      return result;
    };

    const unpack = async (step: Step): Promise<ActionResult | ActionResult[]> => {
      if (!collection.value) {
        throw Error('Programming error: unpacking needds a file name');
      }
      // The sessionId is the filename here
      return api.triggerActionAndGetNewResults(encodeURIComponent(collection.value.name), step);
    };

    const hiddenActions = ['reporting/droid'];
    const extendedSteps: Partial<Step>[] = [
      { id: 'calculate', triggerFn: calculateChecksum },
      { id: 'unpack', triggerFn: unpack },
    ];
    const steps = ref<Step[]>(
      actions
        .filter((a) => !hiddenActions.some((ignored) => ignored === a.id))
        .map((a) => ({ ...a, ...extendedSteps.find((e) => e.id === a.id) }))
    );

    // Force `selected` to match `fixSelected`, in case the definition above is not consistent; this
    // does not also force-select/unselect any dependencies or dependents
    steps.value.forEach((step) => (step.selected = step.fixedSelected ?? step.selected));
    selectedSteps.value = steps.value.filter((step) => step.selected);

    // For the demo: try to load the archive's state, to see if it's already unpacked
    api.getCollection(props.filename).then(async (c) => {
      collection.value = c;

      // This may also exist when the checksum was calculated but the archive was not unpacked
      const checksumStep = steps.value.find((s) => s.id === 'calculate');
      if (checksumStep) {
        checksumStep.result = c.tarResultData.find(
          (r) => r.actionName === 'ContainerChecksumHandler'
        );
        // TODO API Why do we get "message": "Geen resultaten."`?
        checksumStep.lastFetchedState =
          checksumStep.result?.message === 'Geen resultaten.' ? 'error' : 'success';
        checksumStep.state = checksumStep.lastFetchedState;
        // E.g. `"message": "SHA1 : cc8d8a7d1de976bc94f7baba4c24409817f296c1"`
        collection.value.calculatedChecksum = checksumStep.result?.message;
      }

      const sessionId = c.unpackSessionId;
      if (sessionId) {
        const unpackStep = steps.value.find((s) => s.id === 'unpack');
        if (unpackStep) {
          unpackStep.selected = true;
          unpackStep.fixedSelected = false;
          selectedSteps.value = steps.value.filter((step) => step.selected);
        }

        const resultFiles = await api.getResultFilenames(sessionId);
        resultFiles.forEach((name) => {
          const step = steps.value.find((s) => s.resultFilename === name);
          if (step) {
            step.state = 'success';
            if (name.endsWith('.json')) {
              api.getActionResult(sessionId, name).then((json) => {
                step.result = json;
                // TODO Get generic API results or move into definition of steps
                switch (step.id) {
                  case 'MetadataValidation':
                    step.state =
                      Array.isArray(step.result) && step.result.length > 0 ? 'error' : 'success';
                    break;
                  case 'GreenList':
                    step.state =
                      Array.isArray(step.result) &&
                      step.result.some((r) => (r as GreenListActionResult).InGreenList === false)
                        ? 'error'
                        : 'success';
                    break;
                }
              });
            } else {
              step.downloadUrl = api.getActionReportUrl(sessionId, name);
            }
            step.resultFilename = name;
            step.lastFetchedState = step.state;
          }
        });
      }
    });

    return {
      api,
      checksumTypes,
      formatDateString,
      formatFileSize,
      confirm,
      toast,
      notImplemented,
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
    // TODO fix updating state tags
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
      step.state = 'wait';
      const dependencies = getDependencies(step, this.steps);
      dependencies.forEach((dependency) => (dependency.selected = true));
      // This does not cause the watcher for selectedSteps to be triggered twice
      // TODO set state for those too?
      this.selectedSteps = [...new Set([...this.selectedSteps, ...dependencies])];
    },
    onStepUnselect(event: SelectionEvent) {
      const step = event.data;
      step.selected = false;
      step.state = step.lastFetchedState;
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
    async runSelected() {
      if (!this.collection) {
        return;
      }
      // TODO freeze GUI
      // Simply run in the given order, one by one
      for (const step of this.steps) {
        // this.selectedSteps does not use the same order as defined in this.steps
        if (this.selectedSteps.find((s) => s.id === step.id)) {
          step.state = 'running';
          try {
            step.result = await (step.triggerFn
              ? step.triggerFn(step)
              : this.api.triggerActionAndGetNewResults(this.collection.unpackSessionId, step));
            // TODO API make fn return the state
            step.state = 'success';
            step.lastFetchedState = step.state;
          } catch (e) {
            this.toast.add({
              severity: 'error',
              summary: 'Mislukt',
              detail: e,
            });
            step.state = 'failed';
            // TODO Stop processing further results?
          }
          // TODO unselect? If we do, we can no longer tell what we did?
        }
      }
    },
    save() {
      // TODO Save file properties
      this.notImplemented();
    },
    runIngest() {
      // TODO Trigger ingest
      this.notImplemented();
    },
    downloadExcel() {
      // TODO Download Excel report
      this.notImplemented();
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
