<template>
  <div class="home">
    <h1>Verwerking</h1>
    <CollectionControl :filename="$route.params.filename" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import CollectionControl from '@/components/CollectionControl.vue';

export default defineComponent({
  name: 'Collection',
  components: {
    CollectionControl,
  },
});
</script>
