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

export type ChecksumType = 'MD5' | 'SHA1' | 'SHA256' | 'SHA512';

// TODO move elsewhere when trashing NewSessionDialog
export const checksumTypes: { name: string; code: ChecksumType }[] = [
  { name: 'MD-5', code: 'MD5' },
  { name: 'SHA-1', code: 'SHA1' },
  { name: 'SHA-256', code: 'SHA256' },
  { name: 'SHA-512', code: 'SHA512' },
];

// `Wait` is currently only known in the frontend, which controls the queue, but that will change.
// In the future this will also need some "Ready for ingest" and "Done" states.
export type ActionStatus = 'Wait' | 'Executing' | 'Success' | 'Error' | 'Failed';

export type ActionSummary = {
  processed: number;
  accepted: number;
  rejected: number;
  start: string;
  end: string;
};

/**
 * Partial definition of the action results in the responses of `/api/output/collection` and
 * `/api/output/collections`.
 *
 * Note that a single Action can occur more than once in the API responses, if executed multiple
 * times for a single Step, or if multiple Steps use the same action with different parameters.
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
  // The HTTP method, default POST
  method?: string;
  /**
   * A custom function to trigger an action; if not set then {@link triggerStepAndWaitForCompleted}
   * is used.
   */
  triggerFn?: (step: Step) => Promise<ActionStatus>;
  allowRestart?: boolean;

  // Transient details.
  // The status as shown in the frontend, including `Waiting` or no status at all
  status?: ActionStatus;
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
 * The Steps used in this frontend. The `id` must match the URL path, like `virusscan` in
 * `/preingest/virusscan/:guid` and like `reporting/pdf` for `/preingest/reporting/:type/:guid`
 * The `actionName` must match the name in the status results, like `UnpackTarHandler` and `Droid - PDF report`.
 */
export const stepDefinitions: Step[] = [
  {
    id: 'calculate',
    dependsOn: [],
    actionName: 'ContainerChecksumHandler',
    method: 'GET',
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
    actionName: 'Droid - Profiling',
    description: 'DROID bestandsclassificatie voorbereiden',
  },
  {
    id: 'exporting',
    dependsOn: ['profiling'],
    actionName: 'Droid - CSV report',
    description: 'DROID metagegevens exporteren naar CSV',
  },
  {
    id: 'reporting/pdf',
    dependsOn: ['profiling'],
    actionName: 'Droid - PDF report',
    description: 'DROID metagegevens exporteren naar PDF',
  },
  {
    id: 'reporting/planets',
    dependsOn: ['profiling'],
    actionName: 'Droid - Planets XML report',
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
    id: 'sip',
    dependsOn: ['transform'],
    // TODO API validate name when API supports this
    actionName: 'TODO SIP',
    description: 'Bestanden omzetten naar SIP bestandsformaat',
  },
  {
    id: 'excelcreator',
    dependsOn: [],
    actionName: 'ExcelCreatorHandler',
    description: 'Excel rapportage',
  },
];

export type Collection = {
  // The file name
  name: string;
  // Also the folder name on the file system
  sessionId: string;
  creationTime: string;
  size: number;
  overallStatus: ActionStatus;
  preingest: Action[];
  // The following attributes are not (yet) fetched from the API, but populated in the frontend
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

/**
 * A partial definition of the results returned in `/api/output/json/:actionguid`
 */
export type ActionResult = {
  summary: ActionSummary;
  actionResult: {
    // TODO API in `/api/output/json/:actionguid` this is called resultValue, and do we need the nesting?
    name: ActionStatus;
  };
  actionData?: string[];
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

    return collection;
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
   * Get the existing checksum result, if any.
   */
  getLastCalculatedChecksum = async (collection: Collection): Promise<string | undefined> => {
    const checksumStep = collection.preingest.find((a) => a.name === 'ContainerChecksumHandler');
    if (checksumStep) {
      const actionResult = await this.getActionResult(
        collection.sessionId,
        checksumStep.resultFiles
      );
      if (actionResult) {
        return actionResult.actionData?.join(', ');
      }
    }
  };

  /**
   * Send an API command to trigger the Action for a Step, and poll for its (new) results.
   */
  triggerStepAndWaitForCompleted = async (
    sessionId: string,
    step: Step,
    actionSuffix = ''
  ): Promise<ActionStatus> => {
    const triggerResult = await this.fetchWithDefaults<TriggerActionResult>(
      `preingest/${step.id}${actionSuffix ? '/' + actionSuffix : ''}/${sessionId}`,
      {
        method: step.method || 'POST',
      }
    );

    // TODO API is an action always accepted?

    // TODO maybe these also need to be cleared when using custom triggerFn?
    step.result = undefined;
    step.lastAction = undefined;
    step.lastStart = dayjs().toISOString();

    // TODO maybe delay just a bit here?
    return this.repeatUntilResult(async () => {
      // Compute duration up to now
      step.lastDuration = formatDateDifference(step.lastStart || '');

      // We could also only get `status/result/${triggerResult.actionId}` but then we'd need to
      // derive the last status ourselves. So just get the full collection.
      const collection = await this.getCollection(sessionId);
      const lastResult = collection.preingest.find(
        (action) => action.processId === triggerResult.actionId
      );

      step.lastAction = lastResult;

      // When completed at this point, we could copy the summary's start time into action.lastStart,
      // and even calculate a more precise duration using the summary's start and end, but that may
      // also round down a second, which is just confusing.

      // Return a result when done, or undefined to repeat
      return lastResult?.actionStatus === 'Executing' ? undefined : lastResult?.actionStatus;
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

    return await res.json();
  };
}
