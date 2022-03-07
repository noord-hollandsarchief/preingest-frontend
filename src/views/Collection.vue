<template>
  <div class="home">
    <br />
    <InfoControl :sessionId="$route.params.sessionId" />
    <TabView ref="tabView" v-model:active-index="activeOne">
      <TabPanel header="Pre-ingest">
        <PreingestCollectionControl :sessionId="$route.params.sessionId" />
      </TabPanel>
      <TabPanel header="Conversie ToPX naar MDTO">
        <ToPX2MDTOControl :sessionId="$route.params.sessionId" />
      </TabPanel>
      <TabPanel header="Preservica">
        <PreservicaControl :sessionId="$route.params.sessionId" />
      </TabPanel>
      <TabPanel header="Rapportages">
        <RapportagesControl :sessionId="$route.params.sessionId" />
      </TabPanel>
      <TabPanel header="Collectie inhoud">
        <TreeStructureControl :sessionId="$route.params.sessionId" />
      </TabPanel>
    </TabView>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import PreingestCollectionControl from '@/components/PreingestCollectionControl.vue';
import InfoControl from '@/components/InfoControl.vue';
import ToPX2MDTOControl from '@/components/ToPX2MDTOControl.vue';
import PreservicaControl from '@/components/PreservicaControl.vue';
import RapportagesControl from '@/components/RapportagesControl.vue';
import TreeStructureControl from '@/components/TreeStructureControl.vue';

export default defineComponent({
  setup() {
    const activeOne = ref(0);
    return { activeOne };
  },

  name: 'Collection',
  components: {
    PreingestCollectionControl,
    InfoControl,
    PreservicaControl,
    ToPX2MDTOControl,
    RapportagesControl,
    TreeStructureControl,
  },

  methods: {},
});
</script>
