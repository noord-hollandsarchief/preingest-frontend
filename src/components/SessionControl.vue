<template>
  <div class="session">
    <div class="pre">{{ results }}</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { useApi } from '@/plugins/PreingestApi';

export default defineComponent({
  props: {
    guid: {
      type: String,
      required: true,
    },
  },
  async setup(props) {
    const results = ref(await useApi().getSessionResults(props.guid));
    return { results };
  },
});
</script>

<style scoped lang="scss"></style>
