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
          @click="runActions"
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
      </template>
    </Toolbar>

    <DataTable
      :value="steps"
      :autoLayout="true"
      v-model:selection="selectedSteps"
      v-model:expandedRows="expandedRows"
      @row-select="onStepSelect"
      @row-unselect="onStepUnselect"
      @row-expand="onStepExpand"
      class="p-datatable-sm"
      :rowClass="rowClass"
    >
      <Column :expander="true" headerStyle="width: 1rem" bodyStyle="padding: 0" />

      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

      <Column field="description" header="Actie">
        <template #body="slotProps">
          <span v-tooltip="slotProps.data.info">
            {{ slotProps.data.description }}
            <i v-if="slotProps.data.info" class="pi pi-info-circle"></i>
          </span>
        </template>
      </Column>

      <Column
        field="lastStartDateTime"
        header="Start"
        headerClass="p-text-center"
        bodyClass="p-text-center"
      >
        <template #body="slotProps">
          {{ formatDateString(slotProps.data.lastStartDateTime) }}
        </template>
      </Column>

      <Column
        field="lastDuration"
        header="Duur"
        headerClass="p-text-center"
        bodyClass="p-text-center"
      ></Column>

      <Column field="status" header="Status" headerClass="p-text-center" bodyClass="p-text-center">
        <template #body="slotProps">
          <Tag v-if="slotProps.data.status === 'wait'" severity="info">wachtrij</Tag>
          <Tag v-else-if="slotProps.data.status === 'running'" severity="warning">bezig</Tag>
          <Tag v-else-if="slotProps.data.status === 'success'" severity="success">gereed</Tag>
          <Tag
            v-else-if="slotProps.data.status === 'error'"
            severity="danger"
            v-tooltip="'De actie is uitgevoerd, maar er zijn fouten gevonden'"
            >fout</Tag
          >
          <Tag
            v-else-if="slotProps.data.status === 'failed'"
            severity="danger"
            v-tooltip="'De actie kon niet worden uitgevoerd'"
            >mislukt</Tag
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
import { useActionsRunner } from '@/composables/useActionsRunner';
import {
  Collection,
  checksumTypes,
  ActionStatus,
  Action,
  actions,
} from '@/services/PreingestApiService';
import { getDependencies, getDependents } from '@/utils/dependentList';
import { formatDateString, formatFileSize } from '@/utils/formatters';

type Step = Action & {
  // The initial or current selection state
  selected?: boolean;
  /**
   * A fixed value for selected (`false` forces the step to always be non-selected), typically set
   * to `false` when a step has completed unless `allowRestart` is enabled.
   */
  fixedSelected?: boolean;
  allowRestart?: boolean;
  downloadUrl?: string;
};

interface SelectionEvent {
  originalEvent: Event;
  data: Step;
}

interface RowExpandEvent {
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

    const calculateChecksum = async (action: Action): Promise<ActionStatus> => {
      // TODO enforce user choice rather than using default
      if (!collection.value) {
        throw Error('TODO: enforce checksum type selection');
      }
      const result = await api.getChecksum(
        collection.value.name,
        collection.value?.checksumType || 'SHA1'
      );
      collection.value.calculatedChecksum = result.message;
      return 'success';
    };

    // TODO Remove when API uses single session for each file name
    const unpack = async (action: Action): Promise<ActionStatus> => {
      if (!collection.value) {
        throw Error('Programming error: unpacking needs a file name');
      }

      // For the demo, unlike the other actions, the sessionId is the filename here
      const unpackStatus = await api.triggerActionAndWaitForCompleted(
        encodeURIComponent(collection.value.name),
        action
      );

      // For the demo unpacking depends on calculation of the checksum, so we can now call
      // getCollection which also fetches the checksum result which gives us the folder session id
      // (which is also given in the triggerResult for unpack, but that's not returned by the
      // service here).
      const updatedCollection = await api.getCollection(collection.value.name);
      collection.value.unpackSessionId = updatedCollection.unpackSessionId;

      return unpackStatus;
    };

    const hiddenActions = ['reporting/droid'];
    const extendedSteps: Partial<Step>[] = [
      // TODO custom function for calculate checksum needed?
      { id: 'calculate', allowRestart: true, triggerFn: calculateChecksum },
      { id: 'unpack', triggerFn: unpack },
      { id: 'virusscan', allowRestart: true },
      { id: 'excel', allowRestart: true },
    ];
    const steps = ref<Step[]>(
      actions
        .filter((a) => !hiddenActions.some((ignored) => ignored === a.id))
        .map((a) => ({ ...a, ...extendedSteps.find((e) => e.id === a.id) }))
    );

    // Force `selected` to match `fixSelected`, in case the extension above is not consistent; this
    // does not also force-select/unselect any dependencies or dependents
    steps.value.forEach((step) => (step.selected = step.fixedSelected ?? step.selected));
    selectedSteps.value = steps.value.filter((step) => step.selected);

    const { runWaitingActions } = useActionsRunner(collection, steps);

    // For the demo: try to load the archive's state, to see if it's already unpacked
    api.getCollection(props.filename).then(async (c) => {
      collection.value = c;

      // This may also exist when the checksum was calculated but the archive was not unpacked
      // TODO API make this work like any other action
      const checksumStep = steps.value.find((s) => s.id === 'calculate');
      if (c.tarResultData && checksumStep) {
        checksumStep.result = c.tarResultData.find(
          (r) => r.actionName === 'ContainerChecksumHandler'
        );
        // TODO API Why do we get "message": "Geen resultaten."`?
        checksumStep.lastFetchedStatus =
          checksumStep.result?.message === 'Geen resultaten.' ? 'error' : 'success';
        checksumStep.status = checksumStep.lastFetchedStatus;
        // E.g. `"message": "SHA1 : cc8d8a7d1de976bc94f7baba4c24409817f296c1"`
        collection.value.calculatedChecksum = checksumStep.result?.message;
      }

      // TODO we rely on the unpack session to get the session id

      const sessionId = c.unpackSessionId;
      if (sessionId) {
        await api.updateActionResults(sessionId, steps.value, true);
        steps.value.forEach(
          // Allow the checksum to be recalculated any time
          (step) =>
            (step.fixedSelected =
              !step.allowRestart && step.status === 'success' ? false : undefined)
        );
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
      runWaitingActions,
    };
  },
  computed: {
    hasSelection(): boolean {
      return this.selectedSteps.length > 0;
    },
  },
  watch: {
    /**
     * Propagate (un)selection (including the Select All checkbox) into the Steps' `selected`
     * attributes, and ensure no steps are (un)selected that are frozen due to `fixedSelected`.
     *
     * When (un)selecting a single item, this watch is invoked after onStepSelect/onStepUnselect,
     * so after `selectedSteps` has already been altered for any dependencies/dependents.
     */
    selectedSteps(selected: Step[]) {
      const inSelected = (step: Step) => selected.some((s) => s.id === step.id);

      this.steps.forEach((step: Step) => {
        step.selected = step.fixedSelected ?? inSelected(step);
        // If `selectedSteps` is changed while running the selected steps, then this watcher may be
        // invoked after a next step's state was already set to `running`. Make sure not to set it
        // back to `waiting`.
        if (step.status !== 'running') {
          step.status = step.selected ? 'wait' : step.lastFetchedStatus;
        }
      });

      // To avoid endless recursive updates, only change `selectedSteps` if needed
      if (this.steps.some((step) => step.selected !== inSelected(step))) {
        // Eventually triggers this very watch again
        this.selectedSteps = this.steps.filter((step) => step.selected);
      }
    },
  },
  methods: {
    // TODO merge the watcher with the following
    // These events are not emitted when using the Select All checkbox
    onStepSelect(event: SelectionEvent) {
      const dependencies = getDependencies(event.data, this.steps);
      // This triggers the watcher for selectedSteps
      this.selectedSteps = [...new Set([...this.selectedSteps, ...dependencies])];
    },
    onStepUnselect(event: SelectionEvent) {
      const dependents = getDependents(event.data, this.steps);
      this.selectedSteps = this.selectedSteps.filter(
        (step) => !dependents.some((d) => d.id === step.id)
      );
    },
    onStepExpand(event: RowExpandEvent) {
      const step = event.data;
      if (this.collection && step.hasResultFile && !step.result && !step.downloadUrl) {
        if (step.resultFilename.endsWith('.json')) {
          this.api
            .getActionResult(this.collection.unpackSessionId, step.resultFilename)
            .then((json) => {
              step.result = json;
            });
        } else {
          step.downloadUrl = this.api.getActionReportUrl(
            this.collection.unpackSessionId,
            step.resultFilename
          );
        }
      }
    },
    rowClass(step: Step) {
      return {
        'selection-disabled': step.fixedSelected !== undefined,
        'expander-disabled': !step.hasResultFile && !step.result && !step.downloadUrl,
      };
    },
    save() {
      // TODO Save file properties
      this.notImplemented();
    },
    runActions() {
      // TODO lock UI
      this.runWaitingActions((step: Step) => {
        if (step.status !== 'failed') {
          step.selected = false;
          this.selectedSteps = this.selectedSteps.filter((s) => s.id !== step.id);
          if (step.status === 'success') {
            // Fix the state to not-selected (unless this step allows for restarting)
            step.fixedSelected = step.allowRestart ? step.fixedSelected : false;
          }
        }
        // Abort if something failed (but not in case an error was found)
        return step.status !== 'failed';
      });
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
