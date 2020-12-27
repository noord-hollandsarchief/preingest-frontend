<template>
  <div class="home">
    <h1>Sessie {{ $route.params.guid }}</h1>
    <SessionControl :guid="$route.params.guid" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import SessionControl from '@/components/SessionControl.vue';

export default defineComponent({
  name: 'Session',
  components: {
    SessionControl,
  },
});
</script>
