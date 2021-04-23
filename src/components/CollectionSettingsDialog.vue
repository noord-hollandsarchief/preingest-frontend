<template>
  <!-- Dummy form, just to make some browsers (but not Chrome and Safari?) offer autocomplete -->
  <form onsubmit="return false">
    <Dialog
      header="Instellingen"
      :visible="visible"
      @update:visible="setVisible($event)"
      @show="init"
      :modal="true"
      :dismissableMask="true"
    >
      <div class="p-text-left">
        <div class="p-fluid p-formgrid p-grid">
          <div :class="settingClass('environment')" class="p-field p-col-12 p-md-3">
            <label for="environment"
              >Omgeving
              <!-- <Tag v-if="settings.environment === 'prod'" severity="warning">productie</Tag>-->
              <i
                v-if="settings.environment === 'prod'"
                :style="{ color: 'red' }"
                class="pi pi-bell"
                title="Let op: productie"
              ></i>
            </label>
            <Dropdown
              id="environment"
              v-model="settings.environment"
              :options="environments"
              optionLabel="name"
              optionValue="code"
              placeholder="maak een keuze"
            />
          </div>
          <div :class="settingClass('securityTag')" class="p-field p-col-12 p-md-3">
            <label for="securityTag">Standaardtoegang</label>
            <Dropdown
              id="securityTag"
              v-model="settings.securityTag"
              :options="securityTags"
              optionLabel="name"
              optionValue="code"
              placeholder="maak een keuze"
            />
          </div>
          <div :class="settingClass('owner')" class="p-field p-col-12 p-md-3">
            <label for="owner">Eigenaar</label>
            <InputText id="owner" v-model="settings.owner" placeholder="Afkorting in e-Depot" />
          </div>
          <div :class="settingClass('prewash')" class="p-field p-col-12 p-md-3">
            <label for="prewash">Voorbewerking</label>
            <Dropdown
              id="prewash"
              v-model="settings.prewash"
              :options="prewashStylesheets"
              :optionLabel="(name) => name.replace(/_/g, ' ')"
              :filter="true"
              filterPlaceholder="zoek script"
              :placeholder="settingClass('prewash')['p-invalid'] ? 'maak een keuze' : ''"
              :showClear="true"
            />
          </div>
          <div :class="settingClass('checksumType')" class="p-field p-col-12 p-md-3">
            <label for="checksumType">Type controlegetal</label>
            <Dropdown
              id="checksumType"
              v-model="settings.checksumType"
              :options="checksumTypes"
              optionLabel="name"
              optionValue="code"
              placeholder="maak een keuze"
            />
          </div>
          <div :class="settingClass('checksumValue')" class="p-field p-col-12 p-md-9">
            <label for="expectedChecksum">Opgegeven controlegetal</label>
            <InputText
              id="expectedChecksum"
              v-model="settings.checksumValue"
              type="text"
              placeholder="De checksum van de zorgdrager"
            />
          </div>
          <div :class="settingClass('collectionStatus')" class="p-field p-col-12 p-md-3">
            <label for="collectionStatus">Doelcollectie</label>
            <Dropdown
              id="collectionStatus"
              v-model="settings.collectionStatus"
              :options="collectionStatuses"
              optionLabel="name"
              optionValue="code"
              placeholder="maak een keuze"
            />
          </div>
          <div v-if="settings.collectionStatus !== 'SAME'" class="p-col-12 p-md-9"></div>
          <div
            v-if="settings.collectionStatus === 'SAME'"
            :class="settingClass('collectionRef')"
            class="p-field p-col-12 p-md-9"
          >
            <label for="collectionRef">Referentie bestaande collectie</label>
            <InputText
              id="collectionRef"
              v-model="settings.collectionRef"
              type="text"
              placeholder="GUID van collectie in e-Depot"
            />
          </div>
          <div :class="settingClass('description')" class="p-field p-col-12">
            <label for="description">Omschrijving</label>
            <!-- TODO fix padding after upgrading PrimeVUE (or remove `description` altogether) -->
            <Textarea id="description" v-model="settings.description" rows="1" :autoResize="true" />
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
        <!-- Even though <button> defaults to type="submit", Firefox needs it to offer autocomplete -->
        <Button
          type="submit"
          :label="saving && !savingForRun ? 'Bezig...' : 'Opslaan'"
          icon="pi pi-save"
          :class="`p-button-${props.onSaveAndRun ? 'secondary' : 'primary'} p-mr-2`"
          :disabled="settingsDirty && !saving ? null : 'disabled'"
          @click="save"
        />
        <Button
          type="submit"
          v-if="props.onSaveAndRun"
          :label="savingForRun ? 'Bezig...' : 'Opslaan en starten'"
          icon="pi pi-play"
          :class="`${
            settings.environment === 'prod' ? 'p-button-warning' : 'p-button-primary'
          } p-mr-2`"
          :disabled="allRequiredSet() && !saving ? null : 'disabled'"
          @click="saveAndRun"
        />
      </template>
    </Dialog>
  </form>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref } from 'vue';
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
    lockedSettings: {
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
    const saving = ref(false);
    const savingForRun = ref(false);
    const prewashStylesheets = ref<string[]>([]);

    const settingsDirty = computed<boolean>(() => {
      return !isEqual(settings.value, props.collection.settings);
    });

    return {
      props,
      emit,
      api,
      toast,
      checksumTypes,
      collectionStatuses,
      environments,
      securityTags,
      prewashStylesheets,
      settingsDirty,
      settings,
      saving,
      savingForRun,
    };
  },

  methods: {
    init() {
      this.settings = { ...this.collection.settings };
      this.settings.checksumType = this.settings.checksumType ?? 'SHA1';
      this.settings.collectionStatus = this.settings.collectionStatus ?? 'NEW';
      this.saving = false;
      this.savingForRun = false;
      this.api.getPrewashStylesheets().then((stylesheets) => {
        this.prewashStylesheets = stylesheets;
      });
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
      const locked = this.props.lockedSettings(this.settings).find((s) => s === setting);
      return {
        'p-invalid': required && !this.settings[setting],
        'p-disabled': locked,
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
