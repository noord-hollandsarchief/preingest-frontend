/* eslint-disable prettier/prettier */
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

export type ChecksumType = 'MD5' | 'SHA1' | 'SHA224' | 'SHA256' | 'SHA384' | 'SHA512';
export const checksumTypes: { name: string; code: ChecksumType }[] = [
  { name: 'MD-5', code: 'MD5' },
  { name: 'SHA-1', code: 'SHA1' },
  { name: 'SHA-224', code: 'SHA224' },
  { name: 'SHA-256', code: 'SHA256' },
  { name: 'SHA-384', code: 'SHA384' },
  { name: 'SHA-512', code: 'SHA512' },
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
  // Steps that can no longer be executed when this step has been executed successfully, even if
  // they have allowRestart enabled
  lockSteps?: string[];

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
  // A fixed value for `selected` (`false` forces the step to always be non-selected), typically set
  // to `false` when a step has completed successfully but does not have `allowRestart` enabled or
  // explicitly has `lockSteps` defined
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
    info:
      'De viruscontrole kan altijd opnieuw worden uitgevoerd, en de Preservica ingest doet ook altijd een eigen controle',
  },
  {
    id: 'prewash',
    dependsOn: ['unpack'],
    requiredSettings: ['prewash'],
    actionName: 'PrewashHandler',
    description: 'Voorbewerking',
    allowRestart: true,
    info:
      'Optioneel: Zolang ToPX of MDTO niet is omgezet naar Opex kan de voorbewerking meerdere keren worden uitgevoerd, ook met verschillende instellingen',
  },
  {
    id: 'indexing',
    dependsOn: ['unpack'],
    requiredSettings: ['schemaToValidate'],
    actionName: 'IndexMetadataHandler',
    description: 'MS Excel - Metadatabestanden indexeren',
    allowRestart: true,
    info: 'MS Excel overzicht kan altijd opnieuw gemaakt worden',
  },
  {
    id: 'profiling',
    dependsOn: ['unpack'],
    // TODO Do we still need the old name in the action results?
    actionName: 'ProfilesHandler',
    description: 'DROID - bestandsclassificatie voorbereiden',
    // Just in case excessive files, such as .DS_Store or Thumbs.db files, are removed and we want to validate again
    allowRestart: true,
    info:
      'De classificatie kan meerdere keren worden uitgevoerd, bijvoorbeeld wanneer .DS_Store of Thumbs.db bestanden verwijderd zijn',
  },
  {
    id: 'exporting',
    dependsOn: ['profiling'],
    actionName: 'ExportingHandler',
    description: 'DROID - resultaten exporteren naar CSV',
    // See comment above
    allowRestart: true,
  },
  {
    id: 'reporting/pdf',
    dependsOn: ['profiling'],
    actionName: 'ReportingPdfHandler',
    description: 'DROID - PDF-rapportage',
    // See comment above
    allowRestart: true,
  },
  {
    id: 'naming',
    dependsOn: ['unpack'],
    actionName: 'NamingValidationHandler',
    allowRestart: true,
    description: 'Bestandsnamen controleren',
  },
  {
    id: 'greenlist',
    dependsOn: ['exporting'],
    actionName: 'GreenListHandler',
    description: 'Controleren of alle bestandstypen op voorkeurslijst staan',
    // See comment above
    allowRestart: true,
  },
  {
    id: 'encoding',
    dependsOn: ['unpack'],
    actionName: 'EncodingHandler',
    description: 'Encoding metadatabestanden controleren',
    // See comment above
    allowRestart: true,
  }, 
  {
    id: 'validate',
    dependsOn: ['unpack'],
    actionName: 'MetadataValidationHandler',
    description: 'Metadatabestanden valideren met XML-schema (XSD) en Schematron',
    allowRestart: true,
    info:
      'Deze controle kan meerdere keren worden uitgevoerd, bijvoorbeeld na uitvoeren van voorbewerkingen, maar niet meer nadat ToPX is omgezet naar XIP',
  },
  {
    id: 'sidecar',
    dependsOn: ['unpack'],
    actionName: 'SidecarValidationHandler',
    description: 'Mappen en bestanden controleren op sidecarstructuur',
    allowRestart: true,
    info:
      'Deze controle verwacht ToPX of MDTO, dus kan niet meer worden uitgevoerd nadat ToPX of MDTO is omgezet naar Opex',
  },
  {
    id: 'checksum',
    dependsOn: ['unpack'],
    actionName: 'FilesChecksumHandler',
    description: 'Fixity waarde uit metadatabestanden extraheren, berekenen en vergelijken',
    allowRestart: true,
  }, 
  {
    id: 'detection',
    dependsOn: ['exporting'],
    actionName: 'PasswordDetectionHandler',
    description: 'Detecteren van bestanden met wachtwoord beveiliging',
    info: 'Let op! Alleen bij Adobe PDF en MS Office documenten',
    allowRestart: true,
  },  
  {
    id: 'buildopex',
    dependsOn: ['unpack'],
    actionName: 'BuildOpexHandler',
    description: 'OPEX - ToPX of MDTO omzetten naar OPEX',
    info:
      'Metadatabestanden omzetten naar OPEX, het resultaat wordt hiermee naar de bucket verstuurd voor ingest',
  }, 
  {
    id: 'polish',
    dependsOn: ['buildopex'],
    requiredSettings: ['polish'],
    actionName: 'PolishHandler',
    description: 'OPEX - OPEX bestanden nabewerken d.m.v. XSL(T) transformatie.',
    allowRestart: true,
    info: 'Optioneel: OPEX bestanden ervoor nabewerken, voor het verzenden naar de bucket',
  },
  {
    id: 'clearbucket',
    dependsOn: [],
    actionName: 'ClearBucketHandler',
    description: 'BUCKET - legen',
    allowRestart: true,
    info:
    'Inhoud van de bucket legen. Actie kan altijd opnieuw uitgevoerd worden. Let wel op, actie houdt geen rekening mee met bestaande inhoud en/of processen in en naar de bucket',
  },
  {
    id: 'showbucket',
    dependsOn: [],
    actionName: 'ShowBucketHandler',
    description: 'BUCKET - raadplegen en weergeven',
    allowRestart: true,
    info:
      'Inhoud van de bucket raadplegen en tonen. Actie kan altijd opnieuw uitgevoerd worden',
  },
  {
    id: 'upload2bucket',
    dependsOn: ['buildopex'],
    actionName: 'UploadBucketHandler',
    description: 'BUCKET - upload',
    info: 'OPEX output verzenden naar bucket',
    allowRestart: true,
  },
  {
    id: 'excelcreator',
    dependsOn: [],
    actionName: 'ExcelCreatorHandler',
    description: 'MS Excel - Eindrapportage',
    allowRestart: true,
    info: 'De rapportage kan altijd opnieuw gemaakt worden',
  },  
  {
    id: 'start_conversion',
    dependsOn: ['unpack'],
    actionName: 'ToPX2MDTOHandler',
    description: 'ToPX metadata omzetten naar MDTO metadata',
    allowRestart: true,
    info: 'Omzetten gaat uit van ToPX versie 2.3.2 naar MDTO versie 1.0',
  },
  {
    id: 'update_fileformat',
    dependsOn: ['start_conversion', 'exporting'],
    actionName: 'PronomPropsHandler',
    description: 'MDTO bestandType bijwerken met PRONOM informatie',
    allowRestart: true,
    info: 'Alle metadatabestanden met bestandType bijwerken met PRONOM informatie',
  },
  {
    id: 'update_fixity',
    dependsOn: ['start_conversion'],
    actionName: 'FixityPropsHandler',
    description: 'MDTO bestandType fixity bijwerken (met SHA-256)',
    allowRestart: true,
    info: 'Alle metadatabestanden met bestandType bijwerken met checksum algoritme (SHA-256) en waarde',
  },
  {
    id: 'update_relationship',
    dependsOn: ['start_conversion'],
    actionName: 'RelationshipHandler',
    description: 'MDTO relatie referenties bijwerken',
    allowRestart: true,
    info: 'Alle referenties (heeftRepresentatie, isOnderdeelVan, bevatOnderdeel, isRepresentatieVan) bijwerken in de huidige collectie',
  }
];

export type Settings = { 
  checksumType?: ChecksumType;
  checksumValue?: string;
  // This may be defined implicitly by other parameters, but for UX we need this anyway
  //collectionStatus?: CollectionStatus;
  // A reference to an existing collection, only used for collectionStatus SAME
  // The name of the optional pre-wash XSLT script, without any extension
  prewash?: string;
  polish?: string;
  mergeRecordAndFile?: string;
  schemaToValidate?:string;
  rootNamesExtraXml?:string;
  ignoreValidation?:string;
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
  indexMetadataDownloadUrl?: string;
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
  private prewashStylesheetList: string[] = [];
  private polishStylesheetList: string[] = [];
  private mergeOpexOptions: string[] = [];
  private schemaList: string[] = [];
  private ignoreValidationOptions: string[] = [];

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

  // UnpackTarHandler.json, SipCreatorHandler.log (not JSON), and so on.
  getActionResult = async (sessionId: string, resultFileName: string): Promise<ActionResult> => {
    // TODO this may fail with 500 Internal Server Error if results don't exist
    if (resultFileName.endsWith('.json')) {
      return await this.fetchWithDefaults(`output/json/${sessionId}/${resultFileName}`);
    }
    return await this.fetchWithDefaults(`output/report/${sessionId}/${resultFileName}`, {
      headers: {
        Accept: '*',
      },
    });
  };

  // DroidValidationHandler.csv, DroidValidationHandler.pdf, and so on.
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
        // Assume at most one JSON or plain text result, and at most one download link.
        if (/\.(json|log)$/i.test(resultFile)) {
          // For SipCreatorHandler, the log is not JSON, but `SipCreatorHandler.log`.
          step.result = await this.getActionResult(sessionId, resultFile);
        } else {
          // For actions that create a downloadable result, such as a DROID report or the Preservica
          // SIP, the filename is already set when starting the action. So it may not have been
          // created or be incomplete when running into errors.
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
   * Get a sorted list of XSLT stylesheets available on the server for use in pre-wash transformations.
   */
  getPrewashStylesheets = async (): Promise<string[]> => {
    if (!this.prewashStylesheetList.length) {
      // This may include non-XSLT files like `Thumbs.db` or `.DS_Store`, and helper transformations
      // starting with an underscore, most typically `_prewash-identity-transform.xslt`.
      this.prewashStylesheetList = (
        await this.fetchWithDefaults<{ filename: string; name: string }[]>('output/stylesheets')
      )
        .filter((file) => file.filename.match(/^[^_].+\.xslt$/i))
        .map((file) => file.filename)
        .sort();
    }
    return this.prewashStylesheetList;
  };

  getMergeOpexOptions = async(): Promise<string[]> =>{
    this.mergeOpexOptions = ['Nee', 'Ja'];
    return this.mergeOpexOptions;  
  }

  getIgnoreValidationOptions = async(): Promise<string[]> =>{
    this.ignoreValidationOptions = ['Nee', 'Ja'];
    return this.ignoreValidationOptions;  
  }

  getSchemas = async (): Promise<string[]> => {
    if (!this.schemaList.length) {
      this.schemaList = (
        await this.fetchWithDefaults<{ filename: string; name: string }[]>('output/schemas')
      ).map((file) => file.filename).sort();
    }
    return this.schemaList;
  };

  getPolishStylesheets = async (): Promise<string[]> => {
    if (!this.polishStylesheetList.length) {
      // This may include non-XSLT files like `Thumbs.db` or `.DS_Store`, and helper transformations
      // starting with an underscore, most typically `_prewash-identity-transform.xslt`.
      this.polishStylesheetList = (
        await this.fetchWithDefaults<{ filename: string; name: string }[]>('output/stylesheets')
      )
        .filter((file) => file.filename.match(/^[^_].+\.xsl$/i))
        .map((file) => file.filename)
        .sort();
    }
    return this.polishStylesheetList;
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
      //console.error(res);
      throw new Error(res.statusText);
    }

    // The API may return 200 OK along with Content-Length: 0 (rather than 204 No Content)
    if (res.headers.get('Content-Length') === '0') {
      return (undefined as never) as T;
    }

    // This may include a charset, like `application/json; charset=utf-8`, so just look for `json`
    const isJson = /json/i.test(res.headers.get('Content-Type') || '');
    return await (isJson ? res.json() : res.text()).catch((reason) => {
      this.toast.add({
        severity: 'error',
        summary: `Failed to parse response for ${path}`,
        detail: reason,
        // Set some max lifetime, as very wide error messages may hide the toast's close button
        life: 10000,
      });
      //console.error(reason);
      throw new Error(`Failed to parse response for ${path}`);
    });
  };
}
