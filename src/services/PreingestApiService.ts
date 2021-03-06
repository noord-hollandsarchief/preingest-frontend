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
export type JsonMap = { [index: string]: AnyJson };
export type JsonArray = AnyJson[];

export type ChecksumType = 'MD5' | 'SHA1' | 'SHA256' | 'SHA512';
export const checksumTypes: { name: string; code: ChecksumType }[] = [
  { name: 'MD-5', code: 'MD5' },
  { name: 'SHA-1', code: 'SHA1' },
  { name: 'SHA-256', code: 'SHA256' },
  { name: 'SHA-512', code: 'SHA512' },
];

/**
 * The default security tag Preservica will apply when not given in the XIP `<SecurityTag>`. Maps
 * to the SIP Creator `-securitytag` parameter if not set to `none`.
 */
export type SecurityTag = 'open' | 'closed' | 'none';
export const securityTags: { name: string; code: SecurityTag }[] = [
  { name: 'openbaar', code: 'open' },
  { name: 'niet-openbaar', code: 'closed' },
  // To not use the SIP Creator `securitytag` setting at all
  { name: 'geen', code: 'none' },
];

/**
 * The target Preservica environment/instance.
 */
export type Environment = 'test' | 'prod';
export const environments: { name: string; code: Environment }[] = [
  { name: 'testomgeving', code: 'test' },
  { name: 'productieomgeving', code: 'prod' },
];

/**
 * The target Preservica collection type: a new collection, or an existing one.
 */
export type CollectionStatus = 'NEW' | 'SAME';
export const collectionStatuses: { name: string; code: CollectionStatus }[] = [
  { name: 'nieuwe collectie', code: 'NEW' },
  { name: 'bestaande collectie', code: 'SAME' },
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
 *   "resultFiles": ["ContainerChecksumHandler.json"],
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
  // The handler name, like `UnpackTarHandler`, `ContainerChecksumHandler` or `ReportingPdfHandler`
  name: string;
  // Like ["ExcelCreatorHandler.json", "ExcelCreatorHandler.xslx"]
  resultFiles: string[];
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
  // Whether a scheduled plan should start if any of the previous actions in the same plan reported
  // an error or failure; default true
  startOnError?: boolean;
  // Whether a scheduled plan should continue if a (validation) error was found; default true
  continueOnError?: boolean;
  // Whether a scheduled plan should continue if a failure prevented proper execution; default false
  continueOnFailed?: boolean;
  requiredSettings?: SettingsKey[];
  dependentSettings?: DependentSettings;

  // Transient details.
  // The status as shown in the frontend, which may be no status at all
  status?: ActionStatus | WorkflowItemStatus;
  // The last action that was executed for this (possibly restarted) step
  lastAction?: Action;
  lastActionProcessId?: string;
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
    description: 'Controlegetal berekenen',
    allowRestart: true,
    info: 'Het controlegetal kan altijd opnieuw worden berekend',
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
    allowRestart: true,
    info: 'De viruscontrole kan altijd opnieuw worden uitgevoerd',
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
    description: 'DROID resultaten exporteren naar CSV',
  },
  {
    id: 'reporting/planets',
    dependsOn: ['profiling'],
    // actionName: 'ReportingDroidXmlHandler - Droid XML report',
    // TODO There is also some ReportingDroidXmlHandler :-(
    actionName: 'ReportingPlanetsXmlHandler',
    description: 'DROID resultaten exporteren naar XML',
  },
  {
    id: 'reporting/pdf',
    dependsOn: ['profiling'],
    // actionName: 'ReportingHandler - Droid PDF report',
    actionName: 'ReportingPdfHandler',
    description: 'DROID PDF-rapportage',
  },
  {
    id: 'greenlist',
    dependsOn: ['exporting'],
    actionName: 'GreenListHandler',
    description: 'Controleren of alle bestandstypen op voorkeurslijst staan',
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
    description: 'Metadatabestanden valideren met XML-schema (XSD) en Schematron',
  },
  {
    id: 'transform',
    // If ever running tasks in parallel, then greenlist needs to be run first, if selected
    dependsOn: ['unpack'],
    requiredSettings: ['owner'],
    actionName: 'TransformationHandler',
    description: 'Metadatabestanden omzetten van ToPX naar XIP',
    info:
      'Dit verandert de metadata in de sidecarbestanden; opnieuw uitvoeren na fouten heeft meestal geen zin',
  },
  {
    id: 'sipcreator',
    dependsOn: ['transform'],
    requiredSettings: ['collectionStatus', 'securityTag'],
    dependentSettings: {
      collectionStatus: [
        {
          value: 'NEW',
          requiredSettings: ['collectionCode', 'collectionTitle'],
        },
        { value: 'SAME', requiredSettings: ['collectionRef'] },
      ],
    },
    actionName: 'SipCreatorHandler',
    description: 'Resultaat exporteren in SIP bestandsformaat',
    allowRestart: true,
    info:
      'Exporteren naar SIP kan altijd opnieuw worden uitgevoerd, om nieuwe resultaten van eerdere stappen te verwerken',
  },
  {
    id: 'validatesip',
    dependsOn: ['sipcreator'],
    actionName: 'SipZipMetadataValidationHandler',
    description: 'SIP metadatabestanden controleren',
    allowRestart: true,
    info:
      'De validatie kan altijd opnieuw worden uitgevoerd, omdat dat ook geldt voor exporteren naar SIP',
  },
  {
    id: 'excelcreator',
    dependsOn: [],
    actionName: 'ExcelCreatorHandler',
    description: 'Excelrapportage',
    allowRestart: true,
    info: 'De rapportage kan altijd opnieuw gemaakt worden',
  },
  {
    id: 'transferagent',
    dependsOn: ['sipcreator'],
    // Do not start if other actions in the same plan reported an error or failure (but allow for
    // overriding that if (re-)scheduled by itself without the troublesome actions)
    startOnError: false,
    requiredSettings: ['environment'],
    actionName: 'SipZipCopyHandler',
    description: 'SIP kopiëren naar Transfer Agent',
    allowRestart: true,
    info:
      'Deze actie krijgt status "mislukt" als eerdere acties in dezelfde selectie fouten rapporteerden. De kopieeractie kan altijd opnieuw worden uitgevoerd, bijvoorbeeld als er een andere e-Depotomgeving (test of productie) ingesteld wordt.',
  },
];

export type Settings = {
  description?: string;
  checksumType?: ChecksumType;
  checksumValue?: string;

  environment?: Environment;
  // The owner name, also used as prefix in, e.g., `<SecurityTag>Tag_owner_Publiek</SecurityTag>`
  owner?: string;
  securityTag?: SecurityTag;
  // This may be defined implicitly by other parameters, but for UX we need this anyway
  collectionStatus?: CollectionStatus;
  // A reference to an existing collection, for target type SAME
  collectionRef?: string;
  // Code and title for a new collection, for target type NEW
  collectionCode?: string;
  collectionTitle?: string;
};

export type SettingsKey = keyof Settings;

/**
 * Define required dependent settings, given a specific value of a given "parent" setting.
 */
export type DependentSettings = {
  [index in SettingsKey]?: { value: Settings[index]; requiredSettings: SettingsKey[] }[];
};

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
  excelCreatorDownloadUrl?: string;
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
  private baseUrl = process.env.VUE_APP_PREINGEST_API || '/api/';
  private delay = (timeout: number) => new Promise((res) => setTimeout(res, timeout));

  async repeatUntilResult<T>(
    fn: () => Promise<T | undefined>,
    maxSeconds = +(process.env.VUE_APP_STEP_MAX_SECONDS || 600)
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

    // TODO Remove the need for the default (and likewise in useCollectionStatusWatcher)
    // The API may return `"settings": null` but the forms expect an object
    return { ...collection, settings: collection.settings ?? {} };
  };

  // UnpackTarHandler.json and so on.
  getActionResult = async (sessionId: string, resultFileName: string): Promise<ActionResult> => {
    // TODO this may fail with 500 Internal Server Error if results don't exist
    return await this.fetchWithDefaults(`output/json/${sessionId}/${resultFileName}`);
  };

  // DroidValidationHandler.pdf and so on.
  getActionReportUrl = (sessionId: string, name: string) => {
    return `${this.baseUrl}output/report/${sessionId}/${name}`;
  };

  /**
   * Ensure the given `step`'s JSON result and/or single download link are set using its
   * {@link Step.lastAction}, or fetch those details if not known yet.
   */
  getLastActionResults = async (sessionId: string, step: Step) => {
    // We may already have loaded the result/link earlier
    if (step.lastAction && !step.result && !step.downloadUrl) {
      step.result = undefined;
      step.downloadUrl = undefined;

      for (const resultFile of step.lastAction.resultFiles) {
        // Assume at most one JSON result and one download link
        if (resultFile.endsWith('.json')) {
          step.result = await this.getActionResult(sessionId, resultFile);
        } else {
          step.downloadUrl = this.getActionReportUrl(sessionId, resultFile);
        }
      }
    }
  };

  /**
   * Force (re-)populating the given `step`'s JSON result and/or single download link given its
   * {@link Step.lastAction}.
   */
  refreshLastActionResults = async (sessionId: string, step: Step) => {
    step.result = undefined;
    step.downloadUrl = undefined;
    return this.getLastActionResults(sessionId, step);
  };

  /**
   * Save the settings. Note that this does NOT make sure that the backend has completed doing so.
   */
  saveSettings = async (sessionId: string, settings: Settings): Promise<TriggerActionResult> => {
    return await this.fetchWithDefaults<TriggerActionResult>(`preingest/settings/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  };

  resetSession = async (sessionId: string): Promise<void> => {
    await this.fetchWithDefaults<TriggerActionResult>(`Status/reset/${sessionId}`, {
      method: 'DELETE',
    });
  };

  removeSessionAndFile = async (sessionId: string): Promise<void> => {
    await this.fetchWithDefaults<TriggerActionResult>(`Status/remove/${sessionId}`, {
      method: 'DELETE',
    });
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
