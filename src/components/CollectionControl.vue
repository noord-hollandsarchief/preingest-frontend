<template>
  <div v-if="collection">
    <div class="collection card">
      <div>
        <h3>Gegevens</h3>
        <p>Bestandsnaam: {{ collection.name }}</p>
        <div>
          <p>Aanmaakdatum: {{ formatDateString(collection.creationTime) }}</p>
          <p>Bestandsgrootte: {{ formatFileSize(collection.size) }}</p>
          <!-- TODO SHA-512 is far too long to display -->
          <p>
            Checksum:
            <span v-if="collection.calculatedChecksumValue">
              {{ collection.calculatedChecksumType }}, {{ collection.calculatedChecksumValue }}
              <Tag v-if="checksumStatus" severity="success">ok</Tag>
              <Tag v-if="checksumStatus === false" severity="danger">fout</Tag>
            </span>
            <span v-else>niet berekend</span>
          </p>
          <!-- Somehow @change or @input from Dropdown does not bubble up here -->
          <div class="p-fluid p-formgrid p-grid" @input="settingsDirty = true">
            <div class="p-field p-col-12">
              <label for="description">Omschrijving</label>
              <Textarea
                id="description"
                v-model="collection.settings.description"
                rows="1"
                :autoResize="true"
              />
            </div>
            <div class="p-field p-col-12 p-md-3">
              <label for="checksumType">Type checksum</label>
              <Dropdown
                id="checksumType"
                v-model="collection.settings.checksumType"
                :options="checksumTypes"
                optionLabel="name"
                optionValue="code"
                placeholder="Maak een keuze"
                @change="settingsDirty = true"
              />
            </div>
            <div class="p-field p-col-12 p-md-9">
              <label for="expectedChecksum">Opgegeven checksum</label>
              <InputText
                id="expectedChecksum"
                v-model="collection.settings.checksumValue"
                type="text"
                placeholder="De checksum van de zorgdrager"
              />
            </div>
            <div class="p-field p-col-12 p-md-3">
              <label for="preservicaSecurityTag">Preservica security</label>
              <Dropdown
                id="preservicaSecurityTag"
                v-model="collection.settings.preservicaSecurityTag"
                :options="securityTagTypes"
                optionLabel="name"
                optionValue="code"
                placeholder="Maak een keuze"
                @change="settingsDirty = true"
              />
            </div>
            <div class="p-field p-col-12 p-md-9">
              <label for="preservicaTarget">Preservica doellocatie</label>
              <InputText
                id="preservicaTarget"
                v-model="collection.settings.preservicaTarget"
                type="text"
                placeholder="Optionele GUID van locatie in Preservica"
              />
            </div>
          </div>
          <Button
            label="Opslaan"
            icon="pi pi-save"
            class="p-button-success p-mr-2"
            :disabled="settingsDirty ? null : 'disabled'"
            @click="save"
          />
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Verwerken</h3>

      <Toolbar class="p-mb-4">
        <template #left>
          <Button
            :disabled="!hasSelection || collection.overallStatus === 'Running'"
            :label="collection.overallStatus === 'Running' ? 'Bezig...' : 'Start'"
            icon="pi pi-play"
            class="p-button-success p-mr-2"
            @click="checkSettingsAndRunSelectedSteps"
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
          field="lastStart"
          header="Start"
          headerClass="p-text-center"
          bodyClass="p-text-center"
        >
          <template #body="slotProps">
            {{ formatDateString(slotProps.data.lastStart) }}
          </template>
        </Column>

        <Column
          field="lastDuration"
          header="Duur"
          headerClass="p-text-center"
          bodyClass="p-text-center"
        ></Column>

        <Column
          field="actionStatus"
          header="Status"
          headerClass="p-text-center"
          bodyClass="p-text-center"
        >
          <template #body="slotProps">
            <Tag v-if="slotProps.data.status === 'Pending'" severity="info">wachtrij</Tag>
            <Tag v-else-if="slotProps.data.status === 'Executing'" severity="warning">bezig</Tag>
            <Tag v-else-if="slotProps.data.status === 'Success'" severity="success">gereed</Tag>
            <Tag
              v-else-if="slotProps.data.status === 'Error'"
              severity="danger"
              v-tooltip="'De actie is uitgevoerd, maar er zijn fouten gevonden'"
              >fout</Tag
            >
            <Tag
              v-else-if="slotProps.data.status === 'Failed'"
              severity="danger"
              v-tooltip="'De actie kon niet worden uitgevoerd'"
              >mislukt</Tag
            >
          </template>
        </Column>

        <template #expansion="slotProps">
          <a v-if="slotProps.data.downloadUrl" :href="slotProps.data.downloadUrl">Download</a>
          <div class="pre">{{ slotProps.data.result }}</div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onUnmounted, ref } from 'vue';
import { useConfirm } from 'primevue/useConfirm';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { useCollectionStatusWatcher } from '@/composables/useCollectionStatusWatcher';
import { useStepsRunner } from '@/composables/useStepsRunner';
import {
  Collection,
  Step,
  checksumTypes,
  stepDefinitions,
  securityTagTypes,
} from '@/services/PreingestApiService';
import { getDependencies, getDependents } from '@/utils/dependentList';
import { formatDateString, formatFileSize } from '@/utils/formatters';

interface SelectionEvent {
  originalEvent: Event;
  data: Step;
}

interface RowExpandEvent {
  data: Step;
}

export default defineComponent({
  props: {
    sessionId: {
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

    // TODO move settings into their own component that cannot have settings be null, making watching possible
    // TODO add dirty warning on navigation
    const settingsDirty = ref(false);

    const notImplemented = () => {
      toast.add({
        severity: 'error',
        summary: 'Not implemented',
        life: 1000,
      });
    };

    // Action(s) that allow for special handling in the frontend
    const extendedSteps: Partial<Step>[] = [
      { id: 'calculate', allowRestart: true },
      { id: 'virusscan', allowRestart: true },
      { id: 'sipcreator', allowRestart: true },
      { id: 'excelcreator', allowRestart: true },
    ];

    // Copy the definition of the actions into steps
    const steps = ref<Step[]>(
      stepDefinitions.map((a) => ({ ...a, ...extendedSteps.find((e) => e.id === a.id) }))
    );

    // Force `selected` to match `fixSelected`, in case the extension above is not consistent; this
    // does not also force-select/unselect any dependencies or dependents
    steps.value.forEach((step) => (step.selected = step.fixedSelected ?? step.selected));
    selectedSteps.value = steps.value.filter((step) => step.selected);

    const { missingSettings, runSelectedSteps } = useStepsRunner(collection, steps);

    const { startWatcher, stopWatcher } = useCollectionStatusWatcher(collection, steps);
    startWatcher();
    onUnmounted(() => stopWatcher());

    // Load the file details and existing action states
    api.getCollection(props.sessionId).then(async (c) => {
      collection.value = c;
    });

    return {
      api,
      checksumTypes,
      securityTagTypes,
      formatDateString,
      formatFileSize,
      confirm,
      toast,
      notImplemented,
      expandedRows,
      steps,
      selectedSteps,
      collection,
      settingsDirty,
      missingSettings,
      runSelectedSteps,
    };
  },
  computed: {
    hasSelection(): boolean {
      return this.selectedSteps.length > 0;
    },

    checksumStatus(): boolean | undefined {
      if (!this.collection?.calculatedChecksumValue || !this.collection?.settings?.checksumValue) {
        return undefined;
      }
      return (
        this.collection.calculatedChecksumValue.trim().toLowerCase() ===
          this.collection.settings.checksumValue.trim().toLowerCase() &&
        this.collection.calculatedChecksumType === this.collection.settings.checksumType
      );
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
      });

      // To avoid endless recursive updates, only change `selectedSteps` if needed
      if (this.steps.some((step) => step.selected !== inSelected(step))) {
        // Eventually triggers this very watch again
        this.selectedSteps = this.steps.filter((step) => step.selected);
      }
    },

    steps: {
      deep: true,
      handler: function (newSteps: Step[]) {
        this.selectedSteps = this.selectedSteps.filter((selectedStep) =>
          newSteps.some((step) => step.selected && step.id === selectedStep.id)
        );
      },
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

    async onStepExpand(event: RowExpandEvent) {
      const step = event.data;
      // We may already have loaded the result/link earlier
      if (this.collection && step.lastAction && !step.result && !step.downloadUrl) {
        // Assume at most one JSON result and one download link
        const resultFiles = Array.isArray(step.lastAction.resultFiles)
          ? step.lastAction.resultFiles
          : step.lastAction.resultFiles.split(';');

        for (const resultFile of resultFiles) {
          if (resultFile.endsWith('.json')) {
            step.result = await this.api.getActionResult(this.collection.sessionId, resultFile);
          } else {
            step.downloadUrl = this.api.getActionReportUrl(this.collection.sessionId, resultFile);
          }
        }
      }
    },

    rowClass(step: Step) {
      return {
        'selection-disabled': step.fixedSelected !== undefined,
        // The API may already set a value for resultFiles while still running
        'expander-disabled':
          step.status === 'Executing' ||
          (!step.lastAction?.resultFiles && !step.result && !step.downloadUrl),
      };
    },

    save() {
      if (this.collection?.settings) {
        this.api.saveSettings(this.collection.sessionId, this.collection.settings);
        this.settingsDirty = false;
      }
    },

    checkSettingsAndRunSelectedSteps() {
      const missingSettings = this.missingSettings();
      if (missingSettings.length) {
        // TODO show settings dialog
        alert(`De volgende instellingen ontbreken: ${missingSettings.join(', ')}`);
      } else {
        this.runSelectedSteps();
      }
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
