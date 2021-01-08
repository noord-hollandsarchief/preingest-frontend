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
import { ActionSummary, actions, Action } from '@/services/PreingestApiService';

export default defineComponent({
  name: 'SessionProgress',
  props: {
    summaries: {
      type: Object as PropType<ActionSummary[]>,
    },
  },
  setup(props) {
    const { summaries } = toRefs(props);

    const steps = computed<Action[]>(() => {
      // TODO remove the unused action from the service
      return actions
        .filter((action) => action.id !== 'reporting/droid')
        .map((action) => {
          // Local copy to allow for setting its status
          const step = { ...action };
          const summary = summaries?.value?.find((summary) => summary.name === action.name);
          step.status = summary ? summary.lastFetchedStatus : undefined;
          return step;
        });
    });

    const stateClass = (action?: Action) => {
      return {
        none: !action?.status,
        success: action?.status === 'success',
        error: action?.status === 'error',
        failed: action?.status === 'failed',
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
  color: gray;
}
</style>
