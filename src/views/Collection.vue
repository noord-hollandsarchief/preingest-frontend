<template>
  <div class="home">
    <br />
    <InfoControl :sessionId="$route.params.sessionId" />
    <TabView>
      <TabPanel header="Pre-ingest">
        <PreingestCollectionControl :sessionId="$route.params.sessionId" />
      </TabPanel>
      <TabPanel header="Preservica">
        <PreservicaControl :sessionId="$route.params.sessionId" />
      </TabPanel>
      <TabPanel header="Conversie ToPX naar MDTO">
        <ToPX2MDTOControl :sessionId="$route.params.sessionId" />
      </TabPanel>
      <TabPanel header="Rapportages">
        <RapportagesControl :sessionId="$route.params.sessionId" />
      </TabPanel>
    </TabView>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import InfoControl from '@/components/InfoControl.vue';
import PreingestCollectionControl from '@/components/PreingestCollectionControl.vue';
import ToPX2MDTOControl from '@/components/ToPX2MDTOControl.vue';
import PreservicaControl from '@/components/PreservicaControl.vue';
import RapportagesControl from '@/components/RapportagesControl.vue';

export default defineComponent({
  name: 'Collection',
  components: {
    InfoControl,
    PreingestCollectionControl,
    PreservicaControl,
    ToPX2MDTOControl,
    RapportagesControl,
  },
});
</script>
