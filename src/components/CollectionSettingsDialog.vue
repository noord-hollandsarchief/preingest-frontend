<template>
  <Dialog
    header="Instellingen"
    :visible="visible"
    @update:visible="setVisible($event)"
    @show="init"
    :modal="true"
  >
    <div class="p-text-left">
      <!-- Somehow @change or @input from Dropdown does not bubble up here -->
      <div class="p-fluid p-formgrid p-grid" @input="settingsDirty = true">
        <div class="p-field p-col-12">
          <label for="description">Omschrijving</label>
          <Textarea
            id="description"
            v-model="settings.description"
            :class="settingClass('description')"
            rows="1"
            :autoResize="true"
          />
        </div>
        <div class="p-field p-col-12 p-md-3">
          <label for="checksumType">Type checksum</label>
          <Dropdown
            id="checksumType"
            v-model="settings.checksumType"
            :options="checksumTypes"
            optionLabel="name"
            optionValue="code"
            :class="settingClass('checksumType')"
            placeholder="Maak een keuze"
            @change="settingsDirty = true"
          />
        </div>
        <div class="p-field p-col-12 p-md-9">
          <label for="expectedChecksum">Opgegeven checksum</label>
          <InputText
            id="expectedChecksum"
            v-model="settings.checksumValue"
            :class="settingClass('checksumValue')"
            type="text"
            placeholder="De checksum van de zorgdrager"
          />
        </div>
        <div class="p-field p-col-12 p-md-3">
          <label for="preservicaSecurityTag">Standaardtoegang</label>
          <Dropdown
            id="preservicaSecurityTag"
            v-model="settings.preservicaSecurityTag"
            :options="securityTagTypes"
            optionLabel="name"
            optionValue="code"
            :class="settingClass('preservicaSecurityTag')"
            placeholder="Maak een keuze"
            @change="settingsDirty = true"
          />
        </div>
        <div class="p-field p-col-12 p-md-9">
          <label for="preservicaTarget">Preservica doellocatie</label>
          <InputText
            id="preservicaTarget"
            v-model="settings.preservicaTarget"
            :class="settingClass('preservicaTarget')"
            type="text"
            placeholder="Optionele GUID van locatie in Preservica"
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
        label="Opslaan"
        icon="pi pi-save"
        class="p-button-success p-mr-2"
        :disabled="settingsDirty && !saving ? null : 'disabled'"
        @click="save"
      />
      <Button
        v-if="props.onSaveAndRun"
        label="Opslaan en start"
        icon="pi pi-play"
        class="p-button-success p-mr-2"
        :disabled="allRequiredSet() && !saving ? null : 'disabled'"
        @click="saveAndRun"
      />
    </template>
  </Dialog>
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import {
  checksumTypes,
  Collection,
  securityTagTypes,
  Settings,
  SettingsKey,
} from '@/services/PreingestApiService';
export default defineComponent({
  props: {
    visible: {
      type: Boolean,
      // Though this is required, TypeScript does not recognize it when using `v-model:visible=...`,
      // where `v-model` is needed to tell the parent component that the dialog closed
      required: false,
    },
    // collection.settings will be updated when saving
    collection: {
      type: Object as PropType<Collection>,
      required: true,
    },
    requiredSettings: {
      type: Object as PropType<SettingsKey[]>,
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

    const json = ref({});
    return {
      props,
      emit,
      api,
      toast,
      json,
      checksumTypes,
      securityTagTypes,
      settingsDirty,
      settings,
      saving,
    };
  },

  methods: {
    init() {
      this.settings = { ...this.collection.settings };
      this.settingsDirty = false;
      this.saving = false;
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

    async save() {
      this.saving = true;
      // eslint-disable-next-line vue/no-mutating-props
      this.collection.settings = this.settings;
      await this.api.saveSettings(this.collection.sessionId, this.collection.settings);
      // Keeping the dialog open until saved also hides a bit of confusion, where the "Start"
      // button may show "Running" due to the collection's `"overallStatus": "running"` while
      // persisting the settings (rather than truly indicating the actions are running).
      this.close();
    },

    async saveAndRun() {
      await this.save();
      if (this.props.onSaveAndRun) {
        this.props.onSaveAndRun();
      }
    },

    allRequiredSet() {
      return this.props.requiredSettings.every((setting) => !!this.settings[setting]);
    },

    settingClass(setting: SettingsKey) {
      const required = this.props.requiredSettings.find((s) => s === setting);
      return {
        required,
        'p-invalid': required && !this.settings[setting],
      };
    },
  },
});
</script>

<style scoped lang="scss">
::v-deep(.p-dialog) {
  width: 90%;
}
::v-deep(.p-dialog),
::v-deep(.p-dialog-content) {
  // Ensure the dropdowns don't need a scrollbar
  min-height: 350px;
}
</style>
