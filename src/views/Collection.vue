<template>
  <div class="home">
    <br />
    <InfoControl :sessionId="$route.params.sessionId" />
    <PreingestCollectionControl :sessionId="$route.params.sessionId" />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import PreingestCollectionControl from '@/components/PreingestCollectionControl.vue';
import InfoControl from '@/components/InfoControl.vue';

export default defineComponent({
  setup() {
    const activeOne = ref(0);
    return { activeOne };
  },

  name: 'Collection',
  components: {
    PreingestCollectionControl,
    InfoControl,
  },

  methods: {},
});
</script>
