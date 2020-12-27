import { PluginFunction } from 'vue';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}

// TODO remove workaround; see https://github.com/primefaces/primevue/issues/767
// TS2345: Argument of type 'typeof import("(...)/node_modules/primevue/confirmationservice")'
// is not assignable to parameter of type 'Plugin_2'. Property 'install' is missing in type
// 'typeof import("(...)/node_modules/primevue/confirmationservice")' but required in type
// '{ install: PluginInstallFunction; }'.
declare module 'primevue/confirmationservice' {
  export const install: PluginFunction<{}>;
}
