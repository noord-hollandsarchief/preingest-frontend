<template>
  <div class="home">
    <h1>Pre-ingest</h1>
    <Collections />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Collections from '@/components/Collections.vue';

export default defineComponent({
  name: 'Home',
  components: {
    Collections,
  },
});
</script>
