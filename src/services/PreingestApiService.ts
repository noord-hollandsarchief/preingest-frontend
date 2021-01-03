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
import { formatDateDifference } from '@/utils/formatters';
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

// 'wait' is currently only known in the frontend, which controls the queue
export type ActionStatus = 'wait' | 'running' | 'success' | 'error' | 'failed';

export type Action = DependentItem & {
  name: string;
  description: string;
  info?: string;
  resultFilename: string;
  // The HTTP method, default POST
  method?: string;
  result?: ActionResult | ActionResult[];
  lastStartDateTime?: string;
  lastEndDateTime?: string;
  lastDuration?: string;
  status?: ActionStatus;
  lastFetchedStatus?: ActionStatus;
  hasResultFile?: boolean;
  /**
   * A custom function to trigger an action; if not set then {@link triggerActionAndWaitForCompleted}
   * is used.
   */
  triggerFn?: (action: Action) => Promise<ActionStatus>;
};

/**
 * The actions supported by this API. The `id` must match the URL path, like `virusscan` in
 * `/preingest/virusscan/:guid` and like `reporting/pdf` for `/preingest/reporting/:type/:guid`
 * The `name` must match the name in the status results, like `Virusscan` and `Droid - PDF report`.
 */
export const actions: Action[] = [
  {
    id: 'calculate',
    dependsOn: [],
    // TODO validate name as soon as API supports this
    name: 'TODO calculate',
    // TODO not correct; this is currently ../filename.json
    resultFilename: 'ContainerChecksumHandler.json',
    method: 'GET',
    description: 'Checksum berekenen',
  },
  {
    id: 'unpack',
    // TODO remove dependency when checksum not needed to get the folder session
    dependsOn: ['calculate'],
    name: 'Unpack',
    resultFilename: 'UnpackTarHandler.json',
    description: 'Archief uitpakken',
  },
  {
    id: 'virusscan',
    dependsOn: ['unpack'],
    name: 'Virusscan',
    resultFilename: 'ScanVirusValidationHandler.json',
    description: 'Viruscontrole',
    // As set in `allowRestart: true` in the CollectionControl component
    info: 'In de demo kan de viruscontrole meerdere keren gestart worden',
  },
  {
    id: 'naming',
    dependsOn: ['unpack'],
    name: 'Naming',
    resultFilename: 'NamingValidationHandler.json',
    description: 'Bestandsnamen controleren',
  },
  {
    id: 'sidecar',
    dependsOn: ['unpack'],
    name: 'Sidecar',
    // TODO API multiple files? We (also) need single file for result
    resultFilename: 'SidecarValidationHandler_Samenvatting.json',
    description: 'Mappen en bestanden controleren op sidecarstructuur',
  },
  {
    id: 'profiling',
    dependsOn: ['unpack'],
    name: 'Droid - Profiling',
    resultFilename: 'DroidValidationHandler.droid',
    description: 'DROID bestandsclassificatie voorbereiden',
  },
  {
    id: 'exporting',
    dependsOn: ['profiling'],
    name: 'Droid - CSV report',
    resultFilename: 'DroidValidationHandler.csv',
    description: 'DROID metagegevens exporteren naar CSV',
  },
  {
    id: 'reporting/droid',
    dependsOn: ['profiling'],
    // TODO validate name as soon API supports this
    name: 'TODO Droid - Droid report',
    resultFilename: 'DroidValidationHandler.droid',
    description: 'DROID metagegevens exporteren',
  },
  {
    id: 'reporting/pdf',
    dependsOn: ['profiling'],
    name: 'Droid - PDF report',
    resultFilename: 'DroidValidationHandler.pdf',
    description: 'DROID metagegevens exporteren naar PDF',
  },
  {
    id: 'reporting/planets',
    dependsOn: ['profiling'],
    name: 'Droid - Planets XML report',
    resultFilename: 'DroidValidationHandler.planets.xml',
    description: 'DROID metagegevens exporteren naar XML',
  },
  {
    id: 'greenlist',
    dependsOn: ['exporting'],
    name: 'Greenlist',
    resultFilename: 'GreenListHandler.json',
    description: 'Controleren of alle bestandstypen aan greenlist voldoen',
  },
  {
    id: 'encoding',
    dependsOn: ['unpack'],
    name: 'Encoding',
    resultFilename: 'EncodingHandler.json',
    description: 'Encoding metadatabestanden controleren',
  },
  {
    id: 'validate',
    dependsOn: ['unpack'],
    name: 'Metadata',
    resultFilename: 'MetadataValidationHandler.json',
    description: 'Metadata valideren met XML-schema (XSD) en Schematron',
  },
  {
    id: 'transform',
    // If ever running tasks in parallel, then greenlist needs to be run first, if selected
    dependsOn: ['unpack'],
    name: 'TransformXIP',
    resultFilename: 'TransformationHandler.json',
    description: 'Metadatabestanden omzetten naar XIP bestandsformaat',
    info:
      'Dit verandert de mapinhoud, dus heeft effect op de controle van de greenlist als die pas later wordt uitgevoerd',
  },
  {
    id: 'sip',
    dependsOn: ['transform'],
    // TODO validate name when API supports this
    name: 'TODO SIP',
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

// A simplified response of the /api/status/result/:actionGuid API, excluding all GUIDs
export type StatusResult = {
  // Failed is often/always followed by Completed
  name: 'Started' | 'Failed' | 'Completed';
  // API why not creationTimestamp to match other APIs?
  creation: string;
};

// TODO API Why are there so many GUIDs in this response, requiring excessive nesting?
// A simplified response of the /api/status/complete/:guid API, excluding all GUIDs
export type CompleteStatusResult = {
  session: {
    // A name like `Virusscan` and `Droid - PDF report`
    name: string;
  };
  status: StatusResult;
  message?: {
    description: string;
  };
};

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
        // To easily show the elapsed time, we cannot use some, e.g., exponential backoff
        await this.delay(750);
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

    // The above collection.tarResultData may include a ContainerChecksumHandler which includes a
    // sessionId, but that sessionId is not related to any folder of the unpacked archive! So, the
    // following will not do:
    //
    //   const sessionId =
    //     collection.tarResultData.find((data) => data.actionName === 'ContainerChecksumHandler')
    //       ?.sessionId;
    //
    // Instead, we really need to iterate the sessions and get the UnpackTarHandler.json for each of
    // them. Some may fail with 500 Internal Server Error, so swallow any error.

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

  // TODO remove when API returns status
  private getFakeActionStatus = async (
    sessionId: string,
    action: Action
  ): Promise<ActionStatus | undefined> => {
    if (['greenlist', 'validate'].some((name) => name === action.id)) {
      if (action.resultFilename.endsWith('.json')) {
        // We could store it in the action, but not for this demo workaround
        const result = await this.getActionResult(sessionId, action.resultFilename);
        switch (action.id) {
          case 'greenlist':
            return Array.isArray(result) &&
              result.some((r) => (r as GreenListActionResult).InGreenList === false)
              ? 'error'
              : 'success';
          case 'validate':
            return Array.isArray(result) && result.length > 0 ? 'error' : 'success';
        }
      }
    }
  };

  updateActionResults = async (
    sessionId: string,
    actions: Action[],
    checkResultFiles = false
  ): Promise<void> => {
    // actions.forEach((a) => (a.status = undefined));

    const [results, resultFiles] = (await Promise.all([
      this.fetchWithDefaults(`status/complete/${sessionId}`),
      checkResultFiles ? this.getResultFilenames(sessionId) : Promise.resolve([]),
    ])) as [CompleteStatusResult[], string[]];

    for (const action of actions) {
      // The full status results include all start, complete and error events for all invocation of
      // each action. So: filter to get the last, if any.
      const actionResults = results.filter((result) => result.session.name === action.name);
      // TODO API is this sorted?
      if (actionResults.length > 0) {
        // If an action fails badly, then the API will return Started, Failed and Completed. If an
        // action completes normally, then ... TODO API what to expect?
        const lastStart = actionResults.reduce((acc, result) => {
          return result.status.name === 'Started' && result.status.creation > acc.status.creation
            ? result
            : acc;
        });
        const lastFailed = actionResults.find((action) => {
          return (
            action.status.name === 'Failed' && action.status.creation >= lastStart.status.creation
          );
        });
        const lastCompleted = actionResults.find((action) => {
          return (
            action.status.name === 'Completed' &&
            action.status.creation >= lastStart.status.creation
          );
        });
        action.lastFetchedStatus =
          (await this.getFakeActionStatus(sessionId, action)) ||
          (lastFailed ? 'failed' : lastCompleted ? 'success' : 'running');
        action.status = action.status === 'wait' ? action.status : action.lastFetchedStatus;

        // TODO API remove timezone workaround
        action.lastStartDateTime = lastStart.status.creation + 'Z';
        action.lastEndDateTime = lastFailed?.status?.creation || lastCompleted?.status?.creation;
        if (action.lastEndDateTime) {
          // TODO API remove workaround
          action.lastEndDateTime += 'Z';
        }
        // Will yield the time up to now if not Completed/Failed yet
        action.lastDuration = formatDateDifference(
          action.lastStartDateTime,
          action.lastEndDateTime
        );

        action.hasResultFile = resultFiles.some((name) => name === action.resultFilename);
        // TODO copy the message as well? Especially for (fatal) errors?
      }
    }
  };

  /**
   * Send an API command to trigger an action, and poll for its (new) results.
   *
   * TODO For the demo, to unpack an archive sessionId must be set to the filename
   */
  triggerActionAndWaitForCompleted = async (
    folderOrSessionId: string,
    action: Action
  ): Promise<ActionStatus> => {
    // TODO API this assume no old results exist; for some handlers we could get a timestamp
    // but not for, e.g., the greenlist
    // TODO remove after demo?

    const triggerResult = await this.fetchWithDefaults<TriggerActionResult>(
      `preingest/${action.id}/${folderOrSessionId}`,
      {
        method: action.method || 'POST',
      }
    );

    // For most actions, `triggerResult.sessionId` is just the same as `folderOrSessionId`. But for
    // UnpackTarHandler we didn't have the session yet when triggering the action, so use the
    // one we got above.
    // TODO preserve sessionId for unpack
    const sessionId = triggerResult.sessionId;

    // TODO API is an action always accepted?

    // TODO maybe these also need to be cleared when using custom triggerFn?
    action.result = undefined;
    action.hasResultFile = false;
    action.lastStartDateTime = dayjs().toISOString();
    action.lastEndDateTime = undefined;

    // TODO maybe delay just a bit here?
    return this.repeatUntilResult(async () => {
      // Compute duration up to now
      action.lastDuration = formatDateDifference(action.lastStartDateTime || '');
      const results: StatusResult[] = await this.fetchWithDefaults(
        `status/result/${triggerResult.actionId}`
      );
      const lastResult = results[results.length - 1];
      if (lastResult.name === 'Completed') {
        // TODO remove timezone workaround
        action.lastEndDateTime = lastResult.creation + 'Z';
        action.lastDuration = formatDateDifference(
          action.lastStartDateTime || '',
          action.lastEndDateTime
        );

        // TODO merge with other code that determines this
        action.hasResultFile = true;

        // TODO make API return success/error
        // We may have gotten Started, Failed, Completed
        return (await this.getFakeActionStatus(sessionId, action)) ||
          results.some((result) => result.name === 'Failed')
          ? 'error'
          : 'success';
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
    // if (Array.isArray(data)) {
    //   this.toast.add({
    //     severity: 'info',
    //     summary: path ?? 'Pre-ingest API',
    //     detail: `${data.length} ${data.length === 1 ? 'resultaat' : 'resultaten'}`,
    //     life: 2000,
    //   });
    // }
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
