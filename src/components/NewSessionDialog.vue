<template>
  <Dialog
    header="Start verwerking"
    :visible="visible"
    @update:visible="setVisible($event)"
    :modal="true"
  >
    <div class="p-text-left">
      <!-- TODO share with overview in CollectionControl, if we keep this dialog -->
      <h3>Start verwerking {{ filename }}</h3>
      <div class="p-fluid p-formgrid p-grid">
        <div class="p-field p-col-12 p-md-3">
          <label for="checksumType">Type checksum</label>
          <Dropdown
            :disabled="state === 'RUNNING'"
            id="checksumType"
            v-model="checksumType"
            :options="checksumTypes"
            optionLabel="name"
            optionValue="code"
            placeholder="Maak een keuze"
          />
        </div>
        <div class="p-field p-col-12 p-md-9">
          <label for="expectedChecksum">Opgegeven checksum</label>
          <InputText
            :disabled="state === 'RUNNING'"
            id="expectedChecksum"
            type="text"
            placeholder="De checksum van de zorgdrager"
          />
        </div>
        <div class="p-field p-col-12">
          <label for="description">Omschrijving</label>
          <Textarea :disabled="state === 'RUNNING'" id="description" rows="4" :autoResize="true" />
        </div>
      </div>
    </div>

    <router-link v-if="sessionId" :to="`/session/${sessionId}`">Go to the new session</router-link>

    <div class="pre">{{ json }}</div>

    <template #footer>
      <Button
        v-if="state === 'NEW'"
        label="Annuleren"
        icon="pi pi-times"
        class="p-button-text"
        @click="cancel"
      />
      <Button
        v-if="state !== 'DONE'"
        :disabled="state === 'RUNNING'"
        label="Start"
        icon="pi pi-play"
        autofocus
        @click="createSession"
      />
      <Button v-else label="Sluiten" icon="pi pi-check" autofocus @click="done" />
    </template>
  </Dialog>
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from 'vue';
import { useToast } from 'primevue/components/toast/useToast';
import { useApi } from '@/plugins/PreingestApi';
import { checksumTypes } from '@/services/PreingestApiService';

export default defineComponent({
  props: {
    visible: {
      type: Boolean,
      // Though this is required, TypeScript does not recognize it when using `v-model:visible=...`,
      // where `v-model` is needed to tell the parent component that the dialog closed
      required: false,
    },
    filename: {
      type: String,
      required: true,
    },
    onClose: {
      type: Function as PropType<(guid?: string) => void>,
      required: false,
    },
  },
  async setup(props, { emit }) {
    const toast = useToast();
    const api = useApi();

    const state = ref<'NEW' | 'RUNNING' | 'DONE'>('NEW');
    // Just the code
    const checksumType = ref('');
    const expectedChecksum = ref('');
    const description = ref('');
    const sessionId = ref('');

    // TODO remove debug
    const json = ref({});

    return {
      props,
      emit,
      api,
      toast,
      state,
      json,
      expectedChecksum,
      checksumType,
      checksumTypes,
      description,
      sessionId,
    };
  },
  methods: {
    close(guid?: string) {
      // To avoid `ESLint: Unexpected mutation of "visible" prop.(vue/no-mutating-props)` when using
      // the shorthand `v-model:visible="visible"` or when changing the property in code here. This
      // does not propagate to `setVisible`. See also
      // https://v3.vuejs.org/guide/component-basics.html#using-v-model-on-components
      this.emit('update:visible', false);
      if (this.onClose) {
        this.onClose(guid);
      }

      // TODO Either reset state here, or ensure the parent uses `v-if`, or something much better
      // Reset state for the next usage of this component
      this.state = 'NEW';
      this.json = {};
    },

    cancel() {
      this.close();
    },

    done() {
      this.close('some guid');
    },

    async createSession() {
      this.state = 'RUNNING';

      // TODO compare checksum
      const checksum = await this.api.getChecksum(this.props.filename, this.checksumType);
      this.json = `Got checksum: ${checksum}`;

      this.sessionId = await this.api.unpack(this.props.filename);
      this.json += `\n\nUnpacked archive: ${this.sessionId}`;

      this.toast.add({
        severity: 'info',
        summary: `Created session`,
        life: 2000,
      });

      this.state = 'DONE';
    },

    // Only invoked when user hits Escape or the close button (so, ALWAYS with value `false`), for
    // which one cannot bind a callback to PrimeVue's Dialog.
    setVisible(visible: boolean) {
      if (!visible) {
        this.cancel();
      }
    },
  },
});
</script>

<style scoped lang="scss"></style>
