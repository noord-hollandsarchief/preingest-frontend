<template>
  <Dialog
    header="Instellingen"
    :visible="visible"
    @update:visible="setVisible($event)"
    @show="init"
    :modal="true"
    :dismissableMask="true"
  >
    <div class="p-text-left">
      <!-- Somehow @change or @input from Dropdown does not bubble up here -->
      <div class="p-fluid p-formgrid p-grid" @input="settingsDirty = true">
        <div class="p-field p-col-12 p-md-3">
          <label for="environment">Omgeving</label>
          <Dropdown
            id="environment"
            v-model="settings.environment"
            :options="environments"
            optionLabel="name"
            optionValue="code"
            :class="settingClass('environment')"
            placeholder="maak een keuze"
            @change="settingsDirty = true"
          />
        </div>
        <div class="p-field p-col-12 p-md-6">
          <label for="owner">Eigenaar</label>
          <InputText
            id="owner"
            v-model="settings.owner"
            :class="settingClass('owner')"
            placeholder="Exacte naam in e-Depot"
          />
        </div>
        <div class="p-field p-col-12 p-md-3">
          <label for="securityTag">Standaardtoegang</label>
          <Dropdown
            id="securityTag"
            v-model="settings.securityTag"
            :options="securityTags"
            optionLabel="name"
            optionValue="code"
            :class="settingClass('securityTag')"
            placeholder="maak een keuze"
            @change="settingsDirty = true"
          />
        </div>
        <div class="p-field p-col-12 p-md-3">
          <label for="checksumType">Type controlegetal</label>
          <Dropdown
            id="checksumType"
            v-model="settings.checksumType"
            :options="checksumTypes"
            optionLabel="name"
            optionValue="code"
            :class="settingClass('checksumType')"
            placeholder="maak een keuze"
            @change="settingsDirty = true"
          />
        </div>
        <div class="p-field p-col-12 p-md-9">
          <label for="expectedChecksum">Opgegeven controlegetal</label>
          <InputText
            id="expectedChecksum"
            v-model="settings.checksumValue"
            :class="settingClass('checksumValue')"
            type="text"
            placeholder="De checksum van de zorgdrager"
          />
        </div>
        <div class="p-field p-col-12 p-md-3">
          <label for="collectionStatus">Doelcollectie</label>
          <Dropdown
            id="collectionStatus"
            v-model="settings.collectionStatus"
            :options="collectionStatuses"
            optionLabel="name"
            optionValue="code"
            :class="settingClass('collectionStatus')"
            placeholder="maak een keuze"
            @change="settingsDirty = true"
          />
        </div>
        <div v-if="!settings.collectionStatus" class="p-col-12 p-md-9"></div>
        <div v-if="settings.collectionStatus === 'NEW'" class="p-field p-col-12 p-md-3">
          <label for="collectionCode">Collectiecode</label>
          <InputText
            id="collectionCode"
            v-model="settings.collectionCode"
            :class="settingClass('collectionCode')"
            type="text"
            placeholder="Code nieuwe collectie"
          />
        </div>
        <div v-if="settings.collectionStatus === 'NEW'" class="p-field p-col-12 p-md-6">
          <label for="collectionTitle">Collectienaam</label>
          <InputText
            id="collectionTitle"
            v-model="settings.collectionTitle"
            :class="settingClass('collectionTitle')"
            type="text"
            placeholder="Naam nieuwe collectie"
          />
        </div>
        <div v-if="settings.collectionStatus === 'SAME'" class="p-field p-col-12 p-md-9">
          <label for="collectionRef">Referentie bestaande collectie</label>
          <InputText
            id="collectionRef"
            v-model="settings.collectionRef"
            :class="settingClass('collectionRef')"
            type="text"
            placeholder="GUID van collectie in e-Depot"
          />
        </div>
        <div class="p-field p-col-12">
          <label for="description">Omschrijving</label>
          <!-- TODO fix padding after upgrading PrimeVUE (or remove `description` altogether) -->
          <Textarea
            id="description"
            v-model="settings.description"
            :class="settingClass('description')"
            rows="1"
            :autoResize="true"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        label="Annuleren"
        icon="pi pi-times"
        class="p-button-text"
        :disabled="!saving ? null : 'disabled'"
        @click="cancel"
      />
      <Button
        :label="saving && !savingForRun ? 'Bezig...' : 'Opslaan'"
        icon="pi pi-save"
        :class="`p-button-${props.onSaveAndRun ? 'secondary' : 'primary'} p-mr-2`"
        :disabled="settingsDirty && !saving ? null : 'disabled'"
        @click="save"
      />
      <Button
        v-if="props.onSaveAndRun"
        :label="savingForRun ? 'Bezig...' : 'Opslaan en starten'"
        icon="pi pi-play"
        class="p-button-primary p-mr-2"
        :disabled="allRequiredSet() && !saving ? null : 'disabled'"
        @click="saveAndRun"
      />
    </template>
  </Dialog>
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { isEqual } from 'lodash-es';
import { useApi } from '@/plugins/PreingestApi';
import {
  Action,
  checksumTypes,
  Collection,
  securityTags,
  Settings,
  SettingsKey,
  collectionStatuses,
  environments,
} from '@/services/PreingestApiService';
export default defineComponent({
  props: {
    visible: {
      type: Boolean,
      // Though this is required, TypeScript does not recognize it when using `v-model:visible=...`,
      // where `v-model` is needed to tell the parent component that the dialog closed
      required: false,
    },
    collection: {
      // The is actually a reactive value
      type: Object as PropType<Collection>,
      required: true,
    },
    requiredSettings: {
      type: Function as PropType<(settings: Settings) => SettingsKey[]>,
      required: true,
    },
    onSaveAndRun: {
      type: Function,
      required: false,
    },
  },
  async setup(props, { emit }) {
    const toast = useToast();
    const api = useApi();
    const settings = ref<Settings>({});
    const settingsDirty = ref(false);
    const saving = ref(false);
    const savingForRun = ref(false);

    const json = ref({});
    return {
      props,
      emit,
      api,
      toast,
      json,
      checksumTypes,
      collectionStatuses,
      environments,
      securityTags,
      settingsDirty,
      settings,
      saving,
      savingForRun,
    };
  },

  methods: {
    init() {
      this.settings = { ...this.collection.settings };
      this.settings.environment = this.settings.environment ?? 'test';
      this.settings.checksumType = this.settings.checksumType ?? 'SHA1';
      this.settings.collectionStatus = this.settings.collectionStatus ?? 'NEW';
      this.settingsDirty = !isEqual(this.settings, this.collection.settings);
      this.saving = false;
      this.savingForRun = false;
    },

    close() {
      // Avoid `ESLint: Unexpected mutation of "visible" prop.(vue/no-mutating-props)` when using
      // the shorthand `v-model:visible="visible"`, or when changing the property in code here. This
      // does not propagate to `setVisible`. See also
      // https://v3.vuejs.org/guide/component-basics.html#using-v-model-on-components
      this.emit('update:visible', false);
    },

    cancel() {
      if (!this.saving) {
        this.close();
      }
    },

    // Only invoked when user hits Escape or the close button (so, ALWAYS with value `false`), for
    // which one cannot bind a callback to PrimeVue's Dialog.
    setVisible(visible: boolean) {
      if (!visible) {
        this.cancel();
      }
    },

    /**
     * Save the settings in the backend, relying on {@link useCollectionStatusWatcher} to also
     * update the settings in the collection when done.
     */
    async save() {
      this.saving = true;

      // Though SIP Creator should ignore excessive settings, let's be defensive
      if (this.settings.collectionStatus === 'NEW') {
        delete this.settings.collectionRef;
      } else if (this.settings.collectionStatus === 'SAME') {
        delete this.settings.collectionCode;
        delete this.settings.collectionTitle;
      }

      const result = await this.api.saveSettings(this.collection.sessionId, this.settings);

      // TODO trim values

      // The API handles this like any other action: it reports it has accepted the request but may
      // not have completed executing it. Ensure it's done before returning; this relies on
      // `useCollectionStatusWatcher` to update `preingest`.
      await this.api.repeatUntilResult(async () => {
        const lastAction = this.collection.preingest
          .filter(
            (action: Action) =>
              action.processId === result.actionId && action.actionStatus !== 'Executing'
          )
          .pop();

        if (lastAction) {
          // Done
          return true;
        }
        // Repeat
        return undefined;
      });
      this.saving = false;

      // Keeping the dialog open until saved also hides a bit of confusion, where the "Start"
      // button may show "Running" due to the collection's `"overallStatus": "running"` while
      // persisting the settings (rather than truly indicating the actions are running).
      this.close();
    },

    async saveAndRun() {
      this.savingForRun = true;
      await this.save();
      this.savingForRun = false;
      if (this.props.onSaveAndRun) {
        this.props.onSaveAndRun();
      }
    },

    allRequiredSet() {
      return this.props
        .requiredSettings(this.settings)
        .every((setting) => !!this.settings[setting]);
    },

    settingClass(setting: SettingsKey) {
      const required = this.props.requiredSettings(this.settings).find((s) => s === setting);
      return {
        'p-invalid': required && !this.settings[setting],
      };
    },
  },
});
</script>

<style scoped lang="scss">
// TODO Remove if we keep description
::v-deep(.p-dialog),
::v-deep(.p-dialog-content) {
  // Ensure the dropdowns don't need a scrollbar
  // min-height: 350px;
}

.p-dialog-mask.p-component-overlay {
  // The default 0.4 is quite dark for presentations
  background-color: rgba(0, 0, 0, 0.1);
}
</style>
