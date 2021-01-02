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
// See https://github.com/primefaces/primevue/issues/813
import { useToast } from 'primevue/components/toast/useToast';
import { DependentItem } from '@/utils/dependentList';
import dayjs from 'dayjs';

export type AnyJson = string | number | boolean | null | JsonMap | JsonArray;
export type JsonMap = { [key: string]: AnyJson };
export type JsonArray = AnyJson[];

// export type ActionState = 'none' | 'running' | 'success' | 'error';
export type ChecksumType = 'MD5' | 'SHA1' | 'SHA256' | 'SHA512';

// TODO move elsewhere when trashing NewSessionDialog
export const checksumTypes: { name: string; code: ChecksumType }[] = [
  { name: 'MD-5', code: 'MD5' },
  { name: 'SHA-1', code: 'SHA1' },
  { name: 'SHA-256', code: 'SHA256' },
  { name: 'SHA-512', code: 'SHA512' },
];

export type ActionStatus = 'wait' | 'running' | 'success' | 'error' | 'failed';

export type Action = DependentItem & {
  description: string;
  info?: string;
  resultFilename: string;
  // The HTTP method, default POST
  method?: string;
  result?: ActionResult | ActionResult[];
  status?: ActionStatus;
  lastFetchedStatus?: ActionStatus;
};

/**
 * The actions supported by this API. The `id` must match the URL path, like `virusscan` in
 * `/preingest/virusscan/:guid` and like `reporting/pdf` for `/preingest/reporting/:type/:guid`
 */
export const actions: Action[] = [
  {
    id: 'calculate',
    dependsOn: [],
    resultFilename: 'ContainerChecksumHandler.json',
    method: 'GET',
    description: 'Checksum berekenen',
  },
  {
    id: 'unpack',
    dependsOn: [],
    resultFilename: 'UnpackTarHandler.json',
    description: 'Archief uitpakken',
    info:
      'Omdat de resultaten worden opgeslagen in het uitgepakte archief, kan een archiefbestand na uitpakken niet opnieuw worden uitgepakt',
  },
  {
    id: 'virusscan',
    dependsOn: ['unpack'],
    resultFilename: 'ScanVirusValidationHandler.json',
    description: 'Viruscontrole',
  },
  {
    id: 'naming',
    dependsOn: ['unpack'],
    resultFilename: 'NamingValidationHandler.json',
    description: 'Bestandsnamen controleren',
  },
  {
    id: 'sidecar',
    dependsOn: ['unpack'],
    // TODO API multiple files? We (also) need single file for result
    resultFilename: 'SidecarValidationHandler_Samenvatting.json',
    description: 'Mappen en bestanden controleren op sidecarstructuur',
  },
  {
    id: 'profiling',
    dependsOn: ['unpack'],
    resultFilename: 'DroidValidationHandler.droid',
    description: 'DROID bestandsclassificatie voorbereiden',
  },
  {
    id: 'exporting',
    dependsOn: ['profiling'],
    resultFilename: 'DroidValidationHandler.csv',
    description: 'DROID metagegevens exporteren naar CSV',
  },
  {
    id: 'reporting/droid',
    dependsOn: ['profiling'],
    resultFilename: 'DroidValidationHandler.droid',
    description: 'DROID metagegevens exporteren',
  },
  {
    id: 'reporting/pdf',
    dependsOn: ['profiling'],
    resultFilename: 'DroidValidationHandler.pdf',
    description: 'DROID metagegevens exporteren naar PDF',
  },
  {
    id: 'reporting/planets',
    dependsOn: ['profiling'],
    resultFilename: 'DroidValidationHandler.planets.xml',
    description: 'DROID metagegevens exporteren naar XML',
  },
  {
    id: 'greenlist',
    dependsOn: ['exporting'],
    resultFilename: 'GreenListHandler.json',
    description: 'Controleren of alle bestandstypen aan greenlist voldoen',
  },
  {
    id: 'encoding',
    dependsOn: ['unpack'],
    resultFilename: 'EncodingHandler.json',
    description: 'Encoding metadatabestanden controleren',
  },
  {
    id: 'validate',
    dependsOn: ['unpack'],
    resultFilename: 'MetadataValidationHandler.json',
    description: 'Metadata valideren met XML-schema (XSD) en Schematron',
  },
  {
    id: 'transform',
    // If ever running tasks in parallel, then greenlist needs to be run first, if selected
    dependsOn: ['unpack'],
    resultFilename: 'TransformationHandler.json',
    description: 'Metadatabestanden omzetten naar XIP bestandsformaat',
    info:
      'Dit verandert de mapinhoud, dus heeft effect op de controle van de greenlist als die pas later wordt uitgevoerd',
  },
  {
    id: 'sip',
    dependsOn: ['transform'],
    resultFilename: 'TODO',
    description: 'Bestanden omzetten naar SIP bestandsformaat',
  },
];

export type Collection = {
  name: string;
  creationTime: string;
  size: number;
  // TODO API Implicit session, or create session when requesting the list of collections
  unpackSessionId: string;
  tarResultData: ActionResult[];
  // TODO Just for the demo here, as it needs to be fetched differently than the other results
  calculatedChecksum?: string;
  // TODO Add to API
  checksumType?: ChecksumType;
  expectedChecksum?: string;
  description?: string;
  greenlist?: string;
};

export type TriggerActionResult = {
  message: string;
  sessionId: string;
  actionId: string;
};

export type ActionResult = {
  // TODO Change API to use consistent casing (lower case in Collection#tarResultData)
  SessionId: string;
  sessionId: string;
  Code: string;
  ActionName: string;
  actionName: string;
  // The filename
  CollectionItem: string;
  Message: string;
  message: string;
  CreationTimestamp: string;
  // Too bad, TS2589: Type instantiation is excessively deep and possibly infinite.
  // [index: string]: AnyJson;
  // item?: JsonMap;
};

export type GreenListActionResult = ActionResult & { InGreenList?: boolean };

export class PreingestApiService {
  private toast = useToast();
  private baseUrl = process.env.VUE_APP_PREINGEST_API;
  private delay = (timeout: number) => new Promise((res) => setTimeout(res, timeout));

  // TODO Increase default timeout in .env?
  private async repeatUntilResult<T>(
    fn: () => Promise<T | undefined>,
    maxSeconds = process.env.VUE_APP_POLL_MAX_SECONDS
  ): Promise<T> {
    const startTime = dayjs();
    const endTime = startTime.add(maxSeconds, 's');
    let tries = 0;
    while (dayjs().isBefore(endTime)) {
      if (tries > 0) {
        // TODO maybe a (small) initial delay is useful too, when an action has just been fired?
        // Simple exponential backoff, with a maximum of 5 seconds between retries
        await this.delay(Math.min(10 ** tries, 5000));
      }
      tries++;
      try {
        const result = await fn();
        if (result) {
          return result;
        }
      } catch (e) {
        // If important, then this should already have been reported by whatever function we invoked
      }
    }
    throw `Geen resultaat na ${tries} pogingen in ${dayjs().diff(startTime, 'm')} minuten.`;
  }

  /**
   * TODO Replace with proper API call
   *
   * For the demo:
   *
   * - get all collections and filter on the one we want
   * - get all guids
   * - try to get the UnpackTarHandler that goes with one of those sessions, if any; this may also
   *   exist when the checksum was calculated but the archive was not unpacked
   */
  getCollection = async (filename: string): Promise<Collection> => {
    const [collections, sessions] = await Promise.all([this.getCollections(), this.getSessions()]);
    const collection = collections.find((c) => c.name === filename);

    if (!collection) {
      this.toast.add({
        severity: 'error',
        summary: `Bestand bestaat niet`,
        detail: `Het bestand ${filename} bestaat niet`,
      });
      throw new Error('No such file ' + filename);
    }

    // Some may fail with 500 Internal Server Error, so catch any error
    const unpackResults = await Promise.all(
      sessions.map((id) => this.getActionResult(id, 'UnpackTarHandler.json').catch((e) => e))
    );

    const unpackResult = unpackResults.find((r) => r.CollectionItem === filename);

    collection.unpackSessionId = unpackResult?.SessionId;
    return collection;
  };

  getCollections = async (): Promise<Collection[]> => {
    return this.fetchWithDefaults('output/collections');
  };

  // UnpackTarHandler.json, DroidValidationHandler.pdf and so on.
  getActionResult = async (
    sessionId: string,
    resultFileName: string
  ): Promise<ActionResult | ActionResult[]> => {
    return this.fetchWithDefaults(`output/json/${sessionId}/${resultFileName}`);
  };

  getActionReportUrl = (sessionId: string, name: string) => {
    return `${this.baseUrl}/output/report/${sessionId}/${name}`;
  };

  getSessions = async (): Promise<string[]> => {
    return this.fetchWithDefaults('output/sessions');
  };

  getResultFilenames = async (guid: string): Promise<string[]> => {
    return this.fetchWithDefaults(`output/results/${guid}`);
  };

  /**
   * Send an API command to trigger calculating the checksum, and poll for its results.
   */
  // TODO typing 'MD5' | 'SHA1' | 'SHA256' | 'SHA512'
  getChecksum = async (filename: string, checksumType: string): Promise<ActionResult> => {
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
        return checksumSession.tarResultData[0];
      }
      // Repeat
      return undefined;
    });
  };

  /**
   * Get (the first) CreationTimestamp from the result(s), if defined.
   */
  getTime = (result: ActionResult | ActionResult[]): dayjs.Dayjs | undefined => {
    return Array.isArray(result)
      ? dayjs(result[0].CreationTimestamp)
      : result
      ? dayjs(result.CreationTimestamp)
      : undefined;
  };

  /**
   * Send an API command to trigger an action, and poll for its (new) results.
   *
   * TODO For the demo, to unpack an archive sessionId must be set to the filename
   */
  triggerActionAndGetNewResults = async (
    sessionId: string,
    action: Action
  ): Promise<ActionResult | ActionResult[]> => {
    // TODO API this assume no old results exist; for some handlers we could get a timestamp
    // but not for, e.g., the greenlist
    // TODO remove after demo?

    // For the UnpackTarHandler, for which we do not know the sessionId yet and hence use the
    // filename in the URL, this would fail with a 400 Bad Request as the API expects a GUID. For
    // many or all other handlers the API will fail with a 500 error if the file does not exist.
    // So, swallow any exception and default to the current time.
    const oldResult = await this.getActionResult(sessionId, action.resultFilename).catch((e) => e);
    const oldTimestamp = this.getTime(oldResult) || dayjs();

    const triggerResult = await this.fetchWithDefaults<TriggerActionResult>(
      `preingest/${action.id}/${sessionId}`,
      {
        method: action.method || 'POST',
      }
    );

    // TODO API is an action always accepted?

    // TODO maybe delay just a bit here?
    return this.repeatUntilResult(async () => {
      // For most actions, `triggerResult.sessionId` is just the same as `sessionId`. But for
      // UnpackTarHandler we didn't have the session yet when triggering the action, so use the
      // one we got above. Also, the following throws a 500 error as long as unpacking is not done:
      // "Data folder with session guid '/data/2077f60f-d33e-48dc-a9bd-e57a397ae890' not found!"
      // And if the folder exists, then requesting a non-existing result file will still throw a
      // 500 rather than a 404. For all these cases, repeatUntilResult will schedule another try.
      const result = await this.getActionResult(triggerResult.sessionId, action.resultFilename);

      // At this point we may still have received the previous results
      if (this.getTime(result)?.isAfter(oldTimestamp)) {
        return result;
      }
      // Repeat
      return undefined;
    });
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
