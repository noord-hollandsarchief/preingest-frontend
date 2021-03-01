<template>
  <div class="progress">
    <span v-for="step in steps" :key="step.id" v-tooltip.left="step.description">
      <span :class="statusClass(step)">
        <span v-if="step.status">&#x25A0;</span>
        <span v-else>&#x25A1;</span>
      </span>
    </span>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, toRefs, computed } from 'vue';
import { stepDefinitions, Action, Step } from '@/services/PreingestApiService';

export default defineComponent({
  name: 'SessionProgress',
  props: {
    preingestActions: {
      type: Object as PropType<Action[]>,
    },
  },
  setup(props) {
    const { preingestActions } = toRefs(props);

    // Hydrate a list of possible steps with the status of their last executed action, if any
    const steps = computed<Step[]>(() => {
      return stepDefinitions.map((step) => {
        const summaries = preingestActions?.value?.filter(
          (summary) => summary.name === step.actionName
        );
        // Local copy to allow for setting its status
        return {
          ...step,
          status: summaries ? summaries.pop()?.actionStatus : undefined,
        };
        // TODO does the above "as" hide an error?
      });
    });

    const stateClass = (step?: Step) => {
      return {
        none: !step?.status,
        executing: step?.status === 'Executing',
        success: step?.status === 'Success',
        error: step?.status === 'Error',
        failed: step?.status === 'Failed',
      };
    };

    return {
      steps,
      statusClass: stateClass,
    };
  },
});
</script>

<style scoped lang="scss">
.progress {
  cursor: default;
  font-family: Arial, serif;
  font-size: 1.6vw;
}
.executing {
  color: $infoButtonBg;
}
.success {
  color: $successButtonBg;
}
.error {
  color: $warningButtonBg;
}
.failed {
  color: $dangerButtonBg;
}
.none {
  color: lightgray;
}
</style>
