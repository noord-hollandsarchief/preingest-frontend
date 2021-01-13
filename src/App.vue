<template>
  <div id="header" class="p-d-flex">
    <div id="nav">
      <!-- TODO v-if="$router.currentRoute.name != 'routeNameHere'" -->
      <span v-if="$route.path !== '/'">
        <router-link to="/">&laquo; overzicht</router-link>
      </span>
    </div>
    <div id="logo" class="p-ml-auto"></div>
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
body {
  background-color: $bodyBg;
  margin: 2vw;
  padding: 0;
}

// As used in index.html
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: $textColor;
}

#header {
  height: 10vw;
  max-height: 80px;
}

#logo {
  // We need to grow the empty element to show the background image (it seems PrimeFlex has no
  // helper class for this)
  flex-grow: 1;
  // Somehow the shorthand yields different results: background: url($logo-url) no-repeat right
  background: url($logo-url);
  background-repeat: no-repeat;
  background-position: right;
  background-size: contain;
}

#nav {
  a {
    font-weight: bold;
    color: $linkColor;

    &.router-link-exact-active {
      color: $linkActiveColor;
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

.card {
  background-color: $panelContentBg;
  padding: $cardBodyPadding;
  -webkit-box-shadow: $cardShadow;
  box-shadow: $cardShadow;
  border-radius: 4px;
  margin-bottom: 2rem;
  text-align: left;
}
</style>
