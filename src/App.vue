<template>
  <div id="nav">
    <router-link to="/">start</router-link> |
    <router-link to="/help">help</router-link>
  </div>
  <Suspense>
    <template #default>
      <router-view />
    </template>
    <template #fallback>
      <div>Een ogenblik...</div>
    </template>
  </Suspense>
  <Toast />
  <ConfirmDialog />
</template>

<script lang="ts">
import { provideApi } from '@/plugins/PreingestApi';

export default {
  setup() {
    provideApi();
  },
};
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;

  a {
    font-weight: bold;
    color: #2c3e50;

    &.router-link-exact-active {
      color: #42b983;
    }
  }
}

.pre {
  display: block;
  font-family: Monaco, 'lucida console', Consolas, monospace;
  font-size: 0.7em;
  overflow: scroll;
  text-align: left;
  unicode-bidi: embed;
  white-space: pre;
}
</style>
