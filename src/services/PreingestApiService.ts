/**
 * Provide helpers for HTTP calls towards the API of the pre-ingest tooling.
 *
 * All class methods use arrow function expressions to ensure `this` is preserved and destructuring
 * works, like:
 *
 * ```typescript
 * const { getCollections, getChecksum, unpack } = useApi();
 * ```
 */

// TODO Module not found: Error: [CaseSensitivePathsPlugin] `[..]/node_modules/primevue/useToast.js`
// does not match the corresponding path on disk `usetoast.js`.
import { useToast } from 'primevue/usetoast';

export type AnyJson = string | number | boolean | null | JsonMap | JsonArray;
export type JsonMap = { [key: string]: AnyJson };
export type JsonArray = AnyJson[];

export type Collection = {
  tarResultData: JsonMap[];
  [index: string]: AnyJson;
};

export type TriggerActionResult = {
  message: string;
  sessionId: string;
  actionId: string;
};

export type ActionResult = {
  // TODO Change API to use consitent casing
  SessionId: string;
  Code: string;
  ActionName: string;
  CollectionName: string;
  Message: string;
  CreationTimestamp: string;
};

export class PreingestApiService {
  private toast = useToast();
  private baseUrl = process.env.VUE_APP_PREINGEST_API;
  private delay = (timeout: number) => new Promise((res) => setTimeout(res, timeout));

  private async repeatUntilResult<T>(
    fn: () => Promise<T | undefined>,
    delay = 1000,
    maxTries = 10
  ): Promise<T> {
    // TODO improve max tries, exponential backoff and all
    while (maxTries > 0) {
      maxTries--;
      await this.delay(delay);
      try {
        const result = await fn();
        if (result) {
          return result;
        }
      } catch (e) {
        this.toast.add({
          severity: 'error',
          summary: 'Programming error',
          detail: e,
          life: delay,
        });
        throw e;
      }
    }
    this.toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'No result',
      life: 30000,
    });
    throw 'No result';
  }

  getCollections = async (): Promise<Collection[]> => {
    return this.fetchWithDefaults('output/collections');
  };

  getActionResult = async (sessionId: string, action: string): Promise<ActionResult> => {
    return this.fetchWithDefaults(`output/json/${sessionId}/${action}.json`);
  };

  getSessions = async (): Promise<string[]> => {
    return this.fetchWithDefaults('output/sessions');
  };

  getSessionResults = async (guid: string): Promise<string[]> => {
    return this.fetchWithDefaults(`output/results/${guid}`);
  };

  /**
   * Send an API command to trigger calculating the checksum, and poll for its results.
   */
  // TODO typing 'MD5' | 'SHA1' | 'SHA256' | 'SHA512'
  getChecksum = async (filename: string, checksumType: string): Promise<string> => {
    // TODO Change API to validate parameters
    // TODO Change API to rephrase "Geen resultaat." to some generic code
    // TODO Change API to get results for single file
    // After firing the request to calculate the checksum, it seems we need to get the list of all
    // files to get the result of the file we need?

    const path = `preingest/calculate/${checksumType}/${encodeURIComponent(filename)}`;
    const action = await this.fetchWithDefaults<TriggerActionResult>(path);

    return this.repeatUntilResult(async () => {
      const collections = await this.getCollections();
      const checksumSession = collections.filter(
        (c) =>
          c?.name === filename && c.tarResultData?.filter((r) => r.sessionId === action.sessionId)
      )[0];
      if (checksumSession) {
        const message = checksumSession.tarResultData[0].message as string;
        // E.g. `"message": "SHA1 : cc8d8a7d1de976bc94f7baba4c24409817f296c1"`
        if (message && message.startsWith(checksumType)) {
          return message.split(':')[1].trim();
        }
      }
      // Repeat
      return undefined;
    });
  };

  /**
   * Send an API command to trigger unpacking the given archive, and poll for its results.
   */
  unpack = async (filename: string): Promise<string> => {
    const path = `preingest/unpack/${encodeURIComponent(filename)}`;
    const action = await this.fetchWithDefaults<TriggerActionResult>(path, { method: 'POST' });

    // TODO this may be generic for other actions too?
    // After firing the request to unpack the archive, it seems we need to know we need to get a
    // a specific JSON result file?
    const actionName = 'UnpackTarHandler';
    const successCode = 'Unpack';
    return this.repeatUntilResult(
      async () => {
        try {
          const actionResult = await this.getActionResult(action.sessionId, actionName);
          // TODO how do we know if there's a failure?
          if (actionResult?.Code === successCode) {
            return action.sessionId;
          }
          // Repeat
          return undefined;
        } catch (e) {
          // TODO Fix API, which throws 500 when not ready yet?
          // Repeat
          console.error('Failed to get unpack status', e);
          return undefined;
        }
      },
      5000,
      25
    );
  };

  private fetchWithDefaults = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const defaults = {
      headers: {
        Accept: 'application/json',
      },
    };

    const res = await fetch(this.baseUrl + path, {
      ...defaults,
      ...init,
      headers: {
        ...defaults.headers,
        ...init?.headers,
      },
    }).catch((reason) => {
      // For security reasons, specifics about what went wrong with a CORS request are not available
      // to JavaScript code. All the code knows is that an error occurred. The only way to determine
      // what specifically went wrong is to look at the browser's console for details.
      this.toast.add({
        severity: 'error',
        summary: 'Failed to connect to server',
        detail: reason,
      });
      throw new Error('Failed to connect to server');
    });

    if (!res.ok) {
      this.toast.add({
        severity: 'error',
        // HTTP/2 connections do not support res.statusText
        // See also https://fetch.spec.whatwg.org/#concept-response-status-message
        summary: `Error ${res.status}`,
        detail: (await res.text()) || path,
        // Set some max lifetime, as very wide error messages may hide the toast's close button
        life: 10000,
      });
      console.error(res);
      throw new Error(res.statusText);
    }

    const result = await res.json();
    this.debug(result, path);
    return result;
  };

  // TODO remove debug toast
  private debug = (data: { [index: string]: unknown }, path?: string) => {
    if (Array.isArray(data)) {
      this.toast.add({
        severity: 'info',
        summary: path ?? 'Pre-ingest API',
        detail: `${data.length} ${data.length === 1 ? 'resultaat' : 'resultaten'}`,
        life: 2000,
      });
    }
  };
  //   const keys = Object.keys(data);
  //   const firstChild = data[keys[0]];
  //   if (keys.length === 1 && Array.isArray(firstChild)) {
  //     this.toast.add({
  //       severity: 'info',
  //       summary: 'API',
  //       detail: `${firstChild.length} ${firstChild.length === 1 ? 'resultaat' : 'resultaten'}`,
  //       life: 1000,
  //     });
  //   }
  // };
}