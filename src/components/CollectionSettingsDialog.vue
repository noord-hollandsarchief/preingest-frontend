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
        <Divider align="left">
          <div class="p-d-inline-flex p-ai-center">
            <p>
              <i class="pi pi-check-square p-mr-2"></i>
              <b>Controlegetal</b>
            </p>
          </div>
        </Divider>
        <div class="p-fluid p-formgrid p-grid">
          <div :class="settingClass('checksumType')" class="p-field p-col-2 p-md-6">
            <label
              for="checksumType"
              v-tooltip.right="'Kies een type algoritme om te calculeren en te vergelijken'"
              >Type controlegetal</label
            >
            <Dropdown
              id="checksumType"
              v-model="settings.checksumType"
              :options="checksumTypes"
              optionLabel="name"
              optionValue="code"
              placeholder="maak een keuze"
            />
          </div>
          <br />
          <div :class="settingClass('checksumValue')" class="p-field p-col-2 p-md-12">
            <label
              for="checksumValue"
              v-tooltip.right="'Voer hierin de (aangeleverde) checksum waarde van het bestand'"
              >Opgegeven controlegetal</label
            >
            <Textarea
              id="checksumValue"
              v-model="settings.checksumValue"
              placeholder="De checksum van de zorgdrager"
              rows="5"
              cols="60"
              :autoResize="false"
            />
          </div>
        </div>
        <Divider align="left">
          <div class="p-d-inline-flex p-ai-center">
            <p>
              <i class="pi pi-user-edit p-mr-2"></i>
              <b>Voorbewerking (ToPX / MDTO)</b>
            </p>
          </div>
        </Divider>
        <div class="p-fluid p-formgrid p-grid">
          <div :class="settingClass('prewash')" class="p-field p-col-2 p-md-6">
            <label
              for="prewash"
              v-tooltip.right="
                'Kies een stylesheet om ToPX of MDTO metadata bestanden bij te werken. Bijvoorbeeld de omschrijving of beveiliging. Styelsheet bestanden zijn te vinden in [prewash] map met .xslt extensie'
              "
              >Transformatiebestand</label
            >
            <Dropdown
              id="prewash"
              v-model="settings.prewash"
              :options="prewashStylesheets"
              :optionLabel="(name) => name.replace(/_/g, ' ')"
              :filter="true"
              filterPlaceholder="zoek script"
              placeholder="maak een keuze"
              :showClear="true"
            />
          </div>
        </div>
        <Divider align="left">
          <div class="p-d-inline-flex p-ai-center">
            <p>
              <i class="pi pi-clone p-mr-2"></i>
              <b>Constructie (OPEX)</b>
            </p>
          </div>
        </Divider>
        <div class="p-fluid p-formgrid p-grid">
          <div :class="settingClass('mergeRecordAndFile')" class="p-field p-col-2 p-md-6">
            <label
              for="mergeRecordAndFile"
              v-tooltip.right="
                'Kies [Ja] om metadata van Record (ToPX) of Archiefstuk (MDTO) samen te voegen onder niveau Bestand. Default is [Nee]'
              "
              >Samenvoegen (Record / Archiefstuk in Bestand)
            </label>
            <Dropdown
              id="mergeRecordAndFile"
              v-model="settings.mergeRecordAndFile"
              :options="mergeOpexOptions"
              :optionLabel="(name) => name.replace(/_/g, ' ')"
              :filter="true"
              filterPlaceholder="zoek script"
              placeholder="maak een keuze"
              :showClear="true"
            />
          </div>
        </div>
        <Divider align="left">
          <div class="p-d-inline-flex p-ai-center">
            <p>
              <i class="pi pi-user-edit p-mr-2"></i>
              <b>Nabewerking (OPEX)</b>
            </p>
          </div>
        </Divider>
        <div class="p-fluid p-formgrid p-grid">
          <div :class="settingClass('polish')" class="p-field p-col-2 p-md-6">
            <label
              for="polish"
              v-tooltip.right="
                'Kies een stylesheet om OPEX bestanden bij te werken. Bijvoorbeeld de omschrijving of beveiliging. Styelsheet bestanden zijn te vinden in [prewash] map met .xsl extensie'
              "
              >Transformatiebestand</label
            >
            <Dropdown
              id="polish"
              v-model="settings.polish"
              :options="polishStylesheets"
              :optionLabel="(name) => name.replace(/_/g, ' ')"
              :filter="true"
              filterPlaceholder="zoek script"
              placeholder="maak een keuze"
              :showClear="true"
            />
          </div>
        </div>
        <Divider align="left">
          <div class="p-d-inline-flex p-ai-center">
            <p>
              <i class="pi pi-book p-mr-2"></i>
              <b>Metadata indexeren</b>
            </p>
          </div>
        </Divider>
        <div class="p-fluid p-formgrid p-grid">
          <div :class="settingClass('schemaToValidate')" class="p-field p-col-3 p-md-6">
            <label for="schemaToValidate" v-tooltip.right="'Kies een XSD schema om te valideren'"
              >Validatie schema</label
            >
            <Dropdown
              id="schemaToValidate"
              v-model="settings.schemaToValidate"
              :options="schemas"
              :optionLabel="(name) => name.replace(/_/g, ' ')"
              :filter="true"
              filterPlaceholder="zoek schema"
              placeholder="maak een keuze"
              :showClear="true"
            />
          </div>
          <div :class="settingClass('ignoreValidation')" class="p-field p-col-3 p-md-6">
            <label
              for="ignoreValidation"
              v-tooltip.top="
                'Indien een fout wordt geconstateerd tijdens het valideren met een schema, dan faalt de stap. Optie [Ja] worden de validatie foutmeldingen genegeerd. Default is [Nee]'
              "
              >Fouten negeren</label
            >
            <Dropdown
              id="ignoreValidation"
              v-model="settings.ignoreValidation"
              :options="ignoreValidationOptions"
              :optionLabel="(name) => name.replace(/_/g, ' ')"
              :filter="true"
              filterPlaceholder="zoek script"
              placeholder="maak een keuze"
              :showClear="true"
            />
          </div>
          <br />
          <div :class="settingClass('rootNames')" class="p-field p-col-3 p-md-12">
            <label
              for="rootNamesExtraXml"
              v-tooltip.right="
                'XML bestanden (non-metadata bestanden) meenemen voor indexering, meerdere root namen mogelijk door middel van een scheidingsteken (punt-komma)'
              "
              >Extra XML (optioneel)</label
            >
            <Textarea
              id="rootNamesExtraXml"
              v-model="settings.rootNamesExtraXml"
              placeholder="Root namen van de gewenste XML bestanden"
              rows="5"
              cols="60"
              :autoResize="false"
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
            settings.mergeRecordAndFile === 'Ja' ? 'p-button-warning' : 'p-button-primary'
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
    const polishStylesheets = ref<string[]>([]);
    const mergeOpexOptions = ref<string[]>([]);
    const schemas = ref<string[]>([]);
    const ignoreValidationOptions = ref<string[]>([]);
    const settingsDirty = computed<boolean>(() => {
      return !isEqual(settings.value, props.collection.settings);
    });

    return {
      props,
      emit,
      api,
      toast,
      checksumTypes,
      prewashStylesheets,
      polishStylesheets,
      mergeOpexOptions,
      schemas,
      ignoreValidationOptions,
      settingsDirty,
      settings,
      saving,
      savingForRun,
    };
  },

  methods: {
    init() {
      this.settings = { ...this.collection.settings };
      this.settings.mergeRecordAndFile = this.settings.mergeRecordAndFile ?? 'Nee';
      this.settings.ignoreValidation = this.settings.ignoreValidation ?? 'Ja';
      this.saving = false;
      this.savingForRun = false;
      this.api.getPrewashStylesheets().then((stylesheets) => {
        this.prewashStylesheets = stylesheets;
      });
      this.api.getMergeOpexOptions().then((options) => {
        this.mergeOpexOptions = options;
      });
      this.api.getSchemas().then((options) => {
        this.schemas = options;
      });
      this.api.getPolishStylesheets().then((stylesheets) => {
        this.polishStylesheets = stylesheets;
      });
      this.api.getIgnoreValidationOptions().then((options) => {
        this.ignoreValidationOptions = options;
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
.p-dialog-mask.p-component-overlay {
  // The default 0.4 is quite dark for presentations
  background-color: rgba(0, 0, 0, 0.1);
}
</style>
