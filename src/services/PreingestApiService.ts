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
import dayjs from 'dayjs';
import { DependentItem } from '@/utils/dependentList';

export type AnyJson = string | number | boolean | null | JsonMap | JsonArray;
export type JsonMap = { [key: string]: AnyJson };
export type JsonArray = AnyJson[];

export type ChecksumType = 'MD5' | 'SHA1' | 'SHA256' | 'SHA512';

// TODO move elsewhere when trashing NewSessionDialog
export const checksumTypes: { name: string; code: ChecksumType }[] = [
  { name: 'MD-5', code: 'MD5' },
  { name: 'SHA-1', code: 'SHA1' },
  { name: 'SHA-256', code: 'SHA256' },
  { name: 'SHA-512', code: 'SHA512' },
];

export type SecurityTag = 'open' | 'closed';

export const securityTagTypes: { name: string; code: SecurityTag }[] = [
  { name: 'Open', code: 'open' },
  { name: 'Besloten', code: 'closed' },
];

// In the future this may also need some "Ready for ingest" and "Done" states.
export type OverallStatus = 'New' | 'Running' | 'Success' | 'Error' | 'Failed';
export type ActionStatus = 'Executing' | 'Success' | 'Error' | 'Failed';
export type WorkflowItemStatus = 'Pending' | 'Executing' | 'Done';

export type ActionSummary = {
  processed: number;
  accepted: number;
  rejected: number;
  start: string;
  end: string;
};

/**
 * Partial definition of the action results in the responses of `api/status/action/:actionGuid`,
 * `/api/output/collection/:sessionId` and `/api/output/collections`.
 *
 * Note that a single Action can occur more than once in the API responses, if executed multiple
 * times for a single Step, or if multiple Steps use the same action with different parameters.
 *
 * Also beware that the server time and browser time may not be exact, and even the timestamps in
 * `summary` and `states` may differ a bit:
 *
 * ```json
 * {
 *   "actionStatus": "Success",
 *   "creation": "2021-01-17T19:26:59.4226082+00:00",
 *   "description": "Container file 4e70c523-63f9-5940-90fb-bcacc4fc37b3.tar.gz",
 *   "folderSessionId": "b56f1128-df58-7d5f-988a-9ec48c559257",
 *   "name": "ContainerChecksumHandler",
 *   "processId": "e7920e0b-95c8-4b94-bc95-dc0c0bf6748d",
 *   "resultFiles": "ContainerChecksumHandler.json",
 *   "summary": {
 *     "processed": 1,
 *     "accepted": 1,
 *     "rejected": 0,
 *     "start": "2021-01-17T19:26:59.5031101+00:00",
 *     "end": "2021-01-17T19:26:59.9968424+00:00"
 *   },
 *   "states": [
 *     {
 *       "statusId": "6c905b16-a8e8-4ba1-a17c-ebd7d58f160c",
 *       "name": "Started",
 *       "creation": "2021-01-17T19:26:59.6090829+00:00"
 *     },
 *     {
 *       "statusId": "c6d1976b-0f1b-4941-8e75-19a38181ac8a",
 *       "name": "Completed",
 *       "creation": "2021-01-17T19:27:00.057838+00:00"
 *     }
 *   ]
 * }
 * ```
 */
export type Action = {
  // The status of the actual execution, but not (yet) including `Waiting`
  actionStatus: ActionStatus;
  creation: string;
  // The handler name, like `UnpackTarHandler`, `ContainerChecksumHandler` or `Droid - PDF report`
  name: string;
  // Like ContainerChecksumHandler.json and UnpackTarHandler.json
  // TODO API singular
  resultFiles: string;
  // TODO API rename to actionId?
  processId: string;
  summary?: ActionSummary;
};

/**
 * A _possible_ Action with parameters (a single Action can be defined in multiple Steps with
 * different parameters), enriched with fixed details for API calls, for frontend display and about
 * dependencies on other steps, and hydrated with current frontend state (like being selected to be
 * executed, or being locked to prevent selection) and the data from an actually executed action if
 * available. If a Step was executed multiple times, then a Step will only care about the last
 * occurrence of the linked Action.
 */
export type Step = DependentItem & {
  // The action name. This must match the name in the API status results, like `UnpackTarHandler`,
  // `ContainerChecksumHandler` and `Droid - PDF report`.
  actionName: string;
  description: string;
  // Tooltip help text
  info?: string;
  allowRestart?: boolean;
  requiredSettings?: SettingsKey[];

  // Transient details.
  // The status as shown in the frontend, which may be no status at all
  status?: ActionStatus | WorkflowItemStatus;
  // The last action that was executed for this (possibly restarted) step
  lastAction?: Action;
  lastStart?: string;
  lastDuration?: string;
  // The initial or current selection state
  selected?: boolean;
  /**
   * A fixed value for selected (`false` forces the step to always be non-selected), typically set
   * to `false` when a step has completed unless `allowRestart` is enabled.
   */
  fixedSelected?: boolean;
  result?: ActionResult;
  downloadUrl?: string;
};

/**
 * The Steps used in this frontend.
 *
 * The `actionName` must match the name in the status results, like `UnpackTarHandler` and `Droid - PDF report`.
 */
export const stepDefinitions: Step[] = [
  {
    id: 'calculate',
    dependsOn: [],
    requiredSettings: ['checksumType', 'checksumValue'],
    actionName: 'ContainerChecksumHandler',
    description: 'Checksum berekenen',
  },
  {
    id: 'unpack',
    dependsOn: [],
    actionName: 'UnpackTarHandler',
    description: 'Archief uitpakken',
  },
  {
    id: 'virusscan',
    dependsOn: ['unpack'],
    actionName: 'ScanVirusValidationHandler',
    description: 'Viruscontrole',
    // As set in `allowRestart: true` in the CollectionControl component
    info: 'In de demo kan de viruscontrole meerdere keren gestart worden',
  },
  {
    id: 'naming',
    dependsOn: ['unpack'],
    actionName: 'NamingValidationHandler',
    description: 'Bestandsnamen controleren',
  },
  {
    id: 'sidecar',
    dependsOn: ['unpack'],
    actionName: 'SidecarValidationHandler',
    description: 'Mappen en bestanden controleren op sidecarstructuur',
  },
  {
    id: 'profiling',
    dependsOn: ['unpack'],
    // TODO Do we still need the old name in the action results?
    // actionName: 'ProfilesHandler - Droid Profiling',
    actionName: 'ProfilesHandler',
    description: 'DROID bestandsclassificatie voorbereiden',
  },
  {
    id: 'exporting',
    dependsOn: ['profiling'],
    // actionName: 'ExportingHandler - Droid CSV report',
    actionName: 'ExportingHandler',
    description: 'DROID metagegevens exporteren naar CSV',
  },
  {
    id: 'reporting/pdf',
    dependsOn: ['profiling'],
    // actionName: 'ReportingHandler - Droid PDF report',
    actionName: 'ReportingPdfHandler',
    description: 'DROID metagegevens exporteren naar PDF',
  },
  {
    id: 'reporting/planets',
    dependsOn: ['profiling'],
    // actionName: 'ReportingDroidXmlHandler - Droid XML report',
    // TODO There is also some ReportingDroidXmlHandler :-(
    actionName: 'ReportingPlanetsXmlHandler',
    description: 'DROID metagegevens exporteren naar XML',
  },
  {
    id: 'greenlist',
    dependsOn: ['exporting'],
    actionName: 'GreenListHandler',
    description: 'Controleren of alle bestandstypen aan greenlist voldoen',
  },
  {
    id: 'encoding',
    dependsOn: ['unpack'],
    actionName: 'EncodingHandler',
    description: 'Encoding metadatabestanden controleren',
  },
  {
    id: 'validate',
    dependsOn: ['unpack'],
    actionName: 'MetadataValidationHandler',
    description: 'Metadata valideren met XML-schema (XSD) en Schematron',
  },
  {
    id: 'transform',
    // If ever running tasks in parallel, then greenlist needs to be run first, if selected
    dependsOn: ['unpack'],
    actionName: 'TransformationHandler',
    description: 'Metadatabestanden omzetten naar XIP bestandsformaat',
    info:
      'Dit verandert de mapinhoud, dus heeft effect op de controle van de greenlist als die pas later wordt uitgevoerd',
  },
  {
    id: 'sipcreator',
    dependsOn: ['transform'],
    requiredSettings: ['preservicaSecurityTag'],
    actionName: 'SipCreatorHandler',
    description: 'Bestanden omzetten naar SIP bestandsformaat',
  },
  {
    id: 'excelcreator',
    dependsOn: [],
    actionName: 'ExcelCreatorHandler',
    description: 'Excel rapportage',
  },
];

export type Settings = {
  description?: string;
  checksumType?: ChecksumType;
  checksumValue?: string;
  preservicaSecurityTag?: string;
  preservicaTarget?: string;
};

export type SettingsKey = keyof Settings;

export type WorkflowItem = {
  status?: WorkflowItemStatus;
  actionName: string;
  continueOnError: boolean;
  continueOnFailed: boolean;
};

export type ExecutionPlan = {
  workflow: WorkflowItem[];
};

export type Collection = {
  // The file name
  name: string;
  // Also the folder name on the file system
  sessionId: string;
  creationTime: string;
  size: number;
  overallStatus: OverallStatus;
  preingest: Action[];
  // This may be null in the API response (though that is fixed after fetching)
  settings?: Settings;
  scheduledPlan?: WorkflowItem[];

  // Transient details, not fetched from the API directly, but populated in the frontend
  calculatedChecksumType?: ChecksumType;
  calculatedChecksumValue?: string;
  calculatedChecksumProcessId?: string;
};

export type TriggerActionResult = {
  message: string;
  sessionId: string;
  actionId: string;
};

/**
 * A partial definition of the results returned in `/api/output/json/:actionguid`
 */
export type ActionResult = {
  summary: ActionSummary;
  actionResult: {
    // TODO API do we need the nesting?
    resultValue: ActionStatus;
  };
  actionData?: string[];
};

export class PreingestApiService {
  private toast = useToast();
  private baseUrl = process.env.VUE_APP_PREINGEST_API;
  private delay = (timeout: number) => new Promise((res) => setTimeout(res, timeout));

  private async repeatUntilResult<T>(
    fn: () => Promise<T | undefined>,
    maxSeconds = process.env.VUE_APP_STEP_MAX_SECONDS
  ): Promise<T> {
    const startTime = dayjs();
    const endTime = startTime.add(maxSeconds, 's');
    let tries = 0;
    while (dayjs().isBefore(endTime)) {
      if (tries > 0) {
        // To easily show the elapsed time, we cannot use some, e.g., exponential backoff
        await this.delay(500);
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

  getCollections = async (): Promise<Collection[]> => {
    return this.fetchWithDefaults('output/collections');
  };

  getCollection = async (sessionId: string): Promise<Collection> => {
    const collection = await this.fetchWithDefaults<Collection>(`output/collection/${sessionId}`);

    if (!collection) {
      this.toast.add({
        severity: 'error',
        summary: `Bestand bestaat niet`,
        detail: `Het bestand voor sessie ${sessionId} bestaat niet`,
      });
      throw new Error('No such session ' + sessionId);
    }

    // The API may return `"settings": null` but the forms expect an object
    return { ...collection, settings: collection.settings ?? {} };
  };

  // UnpackTarHandler.json and so on.
  getActionResult = async (sessionId: string, resultFileName: string): Promise<ActionResult> => {
    // TODO this may fail with 500 Internal Server Error if results don't exist
    return this.fetchWithDefaults(`output/json/${sessionId}/${resultFileName}`);
  };

  // DroidValidationHandler.pdf and so on.
  getActionReportUrl = (sessionId: string, name: string) => {
    return `${this.baseUrl}/output/report/${sessionId}/${name}`;
  };

  /**
   * Get the existing checksum result, if any, and update the collection with those details.
   */
  getLastCalculatedChecksum = async (collection: Collection): Promise<void> => {
    const checksumStep = collection.preingest.find((a) => a.name === 'ContainerChecksumHandler');
    if (checksumStep) {
      const actionResult = await this.getActionResult(
        collection.sessionId,
        checksumStep.resultFiles
      );
      if (actionResult) {
        // Without user input for expected value (and user-selected SHA1):
        //
        //     "actionData": [
        //       "SHA1",
        //       "cc8d8a7d1de976bc94f7baba4c24409817f296c1"
        //     ]
        //
        // Matching values (where user input was upper case):
        //
        //     "actionData": [
        //       "SHA1",
        //       "cc8d8a7d1de976bc94f7baba4c24409817f296c1",
        //       "CC8D8A7D1DE976BC94F7BABA4C24409817F296C1 = cc8d8a7d1de976bc94f7baba4c24409817f296c1"
        //     ]
        //
        // Non-matching values:
        //
        //     "actionData": [
        //       "SHA1",
        //       "cc8d8a7d1de976bc94f7baba4c24409817f296c1",
        //       "d2970bcfa7717d2bdad34ed7a8ac649c ≠ cc8d8a7d1de976bc94f7baba4c24409817f296c1"
        //     ]
        collection.calculatedChecksumType = actionResult.actionData?.[0] as ChecksumType;
        collection.calculatedChecksumValue = actionResult.actionData?.[1];
      }
    }
  };

  /**
   * Save the settings and make sure that the backend has completed doing so.
   */
  saveSettings = async (sessionId: string, settings: Settings): Promise<Action> => {
    const result = await this.fetchWithDefaults<TriggerActionResult>(
      `preingest/settings/${sessionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      }
    );

    // The API handles this like any other action: it reports it has accepted the request but may
    // not have completed executing it. Ensure it's done before returning.
    return this.repeatUntilResult(async () => {
      // We could also rely on `useCollectionStatusWatcher` which will update `preingest`
      const status = await this.fetchWithDefaults<Action>(`status/action/${result.actionId}`);
      // Right after triggering save, this may return:
      //
      //     {
      //       "creation": "2021-02-03T08:59:57.5748151+00:00",
      //       "description": "Save user input setting(s) for folder 1bff9806-4c59-50d5-b761-2bf6cfb18472",
      //       "sessionId": "1bff9806-4c59-50d5-b761-2bf6cfb18472",
      //       "name": "SettingsHandler",
      //       "actionId": "c7bbfff4-9e58-4470-80b8-e4cfdaf62e75",
      //       "resultFiles": [
      //         "SettingsHandler.json"
      //       ],
      //       "actionStatus": null
      //     }
      if (status.actionStatus === 'Success') {
        // Done; return the results of the action; won't be used
        return status;
      }
      // Repeat
      return undefined;
    });
  };

  resetSession = async (sessionId: string): Promise<void> => {
    // TODO API should wipe details from Plan table
    await this.cancelExecutionPlan(sessionId);

    await this.fetchWithDefaults<TriggerActionResult>(`Status/reset/${sessionId}`, {
      method: 'DELETE',
    });

    await this.delay(1000);
    // Recreate the session folder (and any other missing session folder)
    await this.getCollections();
  };

  /**
   * Schedule the execution of the given actions, wiping any existing or completed plan. Any
   * parameters should already have been set using {@link saveSettings}.
   */
  startExecutionPlan = async (
    sessionId: string,
    executionPlan: ExecutionPlan
  ): Promise<TriggerActionResult> => {
    // The startplan endpoint will silently ignore any new plan if a (completed) plan exists
    await this.cancelExecutionPlan(sessionId);

    return this.fetchWithDefaults<TriggerActionResult>(`Service/startplan/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(executionPlan),
    });
  };

  cancelExecutionPlan = async (sessionId: string): Promise<void> => {
    await this.fetchWithDefaults<TriggerActionResult>(`Service/cancelplan/${sessionId}`, {
      method: 'DELETE',
    });
  };

  private fetchWithDefaults = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const defaults = {
      headers: {
        'Content-Type': 'application/json',
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
        summary: `Error ${res.status} for ${path}`,
        detail: await res.text(),
        // Set some max lifetime, as very wide error messages may hide the toast's close button
        life: 10000,
      });
      console.error(res);
      throw new Error(res.statusText);
    }

    // The API may return 200 OK along with Content-Length: 0 (rather than 204 No Content)
    return res.headers.get('Content-Length') === '0'
      ? undefined
      : await res.json().catch((reason) => {
          this.toast.add({
            severity: 'error',
            summary: `Failed to parse response for ${path}`,
            detail: reason,
            // Set some max lifetime, as very wide error messages may hide the toast's close button
            life: 10000,
          });
          console.error(reason);
          throw new Error(`Failed to parse response for ${path}`);
        });
  };
}
