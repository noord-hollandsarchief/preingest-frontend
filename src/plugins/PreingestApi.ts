/**
 * Provide global access to the pre-ingest API service.
 *
 * Usage in a component:
 *
 * ```typescript
 * export default defineComponent({
 *   setup() {
 *     const api = useApi();
 *     ...
 *     return { api, ... };
 *   }
 * }
 * ```
 */
import { inject, provide } from 'vue';
import { PreingestApiService } from '@/services/PreingestApiService';

const preingestApiSymbol = Symbol();

export function provideApi() {
  provide(preingestApiSymbol, new PreingestApiService());
}

export function useApi(): PreingestApiService {
  const api = inject<PreingestApiService>(preingestApiSymbol);
  if (!api) {
    throw Error(
      "Programming error: plugins/PreingestApi not provided in App.vue, or using useApi() outside component's setup()?"
    );
  }
  return api;
}
