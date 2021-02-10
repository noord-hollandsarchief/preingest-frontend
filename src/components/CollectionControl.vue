<template>
  <div v-if="collection">
    <div class="collection card">
      <div>
        <p>Bestandsnaam: {{ collection.name }}</p>
        <p v-if="collection.settings.description">
          Omschrijving: {{ collection.settings.description }}
        </p>
        <p>Aanmaakdatum: {{ formatDateString(collection.creationTime) }}</p>
        <p>Bestandsgrootte: {{ formatFileSize(collection.size) }}</p>
        <p v-if="collection.settings.checksumValue">
          Verwachte checksum: {{ checksumType }},
          {{ collection.settings.checksumValue }}
          &nbsp;<Tag v-if="checksumStatus" severity="success">ok</Tag>
        </p>
        <!-- Only show calculated checksum if different from expected value -->
        <p v-if="collection.calculatedChecksumValue && !checksumStatus">
          Berekende checksum:
          <span>
            <!-- TODO SHA-512 is far too long to display -->
            {{ calculatedChecksumType }},
            {{ collection.calculatedChecksumValue }}
            <!-- If okay, then Tag is shown next to expected value instead -->
            &nbsp;<Tag v-if="checksumStatus === false" severity="danger">fout</Tag>
          </span>
        </p>
        <p v-if="collection.settings.preservicaSecurityTag">
          Standaardtoegang: {{ preservicaSecurityTag }}
        </p>
        <p v-if="collection.settings.preservicaTarget">
          Preservica doellocatie: {{ collection.settings.preservicaTarget }}
        </p>
      </div>
    </div>

    <CollectionSettingsDialog
      v-model:visible="showSettings"
      :collection="collection"
      :required-settings="requiredSettings()"
      :onSaveAndRun="onSaveAndRun"
    />

    <div class="card">
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
        <template #header>
          <div class="p-d-flex datatable-header">
            <Button
              :disabled="!hasSelection || collection.overallStatus === 'Running'"
              :label="collection.overallStatus === 'Running' ? 'Bezig...' : 'Start'"
              icon="pi pi-play"
              class="p-button-primary p-as-start p-mr-2"
              @click="checkSettingsAndRunSelectedSteps"
            />
            <div class="p-ml-auto">
              <Button
                v-if="collection.excelCreatorDownloadUrl"
                :disabled="!collection.excelCreatorDownloadUrl"
                label="Rapportage"
                icon="pi pi-download"
                class="p-button-secondary p-as-start p-mr-2"
                @click="downloadExcel"
              />
              <Button
                :disabled="collection.overallStatus === 'Running'"
                label="Instellingen"
                icon="pi pi-cog"
                class="p-button-secondary p-as-start"
                @click="editSettings"
              />
            </div>
          </div>
        </template>

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
          <!-- TODO styling, especially scrollbars -->
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
import CollectionSettingsDialog from '@/components/CollectionSettingsDialog.vue';

interface SelectionEvent {
  originalEvent: Event;
  data: Step;
}

interface RowExpandEvent {
  data: Step;
}

export default defineComponent({
  components: { CollectionSettingsDialog },
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
    const showSettings = ref(false);
    const onSaveAndRun = ref<Function>();

    const notImplemented = () => {
      toast.add({
        severity: 'error',
        summary: 'Not implemented',
        life: 1000,
      });
    };

    // Copy the definitions into the steps
    const steps = ref<Step[]>(stepDefinitions.map((d) => ({ ...d })));
    // Force `selected` to match `fixSelected`, in case the definition (if any) is not consistent;
    // this does not also force-select/unselect any dependencies or dependents
    steps.value.forEach((step) => (step.selected = step.fixedSelected ?? step.selected));
    selectedSteps.value = steps.value.filter((step) => step.selected);

    const { requiredSettings, missingSettings, runSelectedSteps } = useStepsRunner(
      collection,
      steps
    );

    const { startWatcher, stopWatcher } = useCollectionStatusWatcher(collection, steps);
    startWatcher();
    onUnmounted(() => stopWatcher());

    // Load the file details and existing action states
    api.getCollection(props.sessionId).then(async (c) => {
      collection.value = c;
    });

    const downloadExcel = () => {
      location.href = collection.value?.excelCreatorDownloadUrl || '';
    };

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
      onSaveAndRun,
      showSettings,
      requiredSettings,
      missingSettings,
      runSelectedSteps,
      downloadExcel,
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

    calculatedChecksumType(): string | undefined {
      return checksumTypes.find((t) => t.code === this.collection?.calculatedChecksumType)?.name;
    },

    checksumType(): string | undefined {
      return checksumTypes.find((t) => t.code === this.collection?.settings?.checksumType)?.name;
    },

    preservicaSecurityTag(): string | undefined {
      return securityTagTypes.find(
        (t) => t.code === this.collection?.settings?.preservicaSecurityTag
      )?.name;
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
      if (this.collection) {
        await this.api.getLastActionResults(this.collection.sessionId, event.data);
      }
    },

    rowClass(step: Step) {
      return {
        'selection-disabled': step.fixedSelected !== undefined,
        // The API may already set a value for resultFiles while still running
        'expander-disabled':
          step.status === 'Executing' ||
          (!(step.lastAction?.resultFiles && step.lastAction.resultFiles.length > 0) &&
            !step.result &&
            !step.downloadUrl),
      };
    },

    editSettings() {
      this.onSaveAndRun = undefined;
      this.showSettings = true;
    },

    checkSettingsAndRunSelectedSteps() {
      const missingSettings = this.missingSettings();
      if (missingSettings.length) {
        this.toast.add({
          severity: 'info',
          summary: 'Configuratie incompleet',
          detail: 'Er ontbreken instellingen om alle geselecteerde acties uit te voeren.',
          life: 3000,
        });
        this.onSaveAndRun = this.runSelectedSteps;
        this.showSettings = true;
      } else {
        this.runSelectedSteps();
      }
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
.datatable-header {
  padding-left: 1.5rem;
  padding-right: 0.5rem;
}
</style>
