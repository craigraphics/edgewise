/**
 * A deliberately small goal-directed loop for the `agents` experiment.
 *
 * There is no language model here. `decide` is a plain function of what the
 * loop has learned so far — which candidates a search returned, which of them
 * have been checked, and which are confirmed. It never reads the catalogue
 * directly, which is the structural claim this node exists to teach: the next
 * action comes from tool results and state, not from privileged knowledge of
 * the answer. `searchCatalogue` and `checkBook` are the two tools, and they
 * take the catalogue and nothing else, so a request for one candidate's
 * availability cannot see or change any other candidate's.
 */

export type BookGenre = 'mystery' | 'cookbook' | 'gardening';

export type Book = {
  id: string;
  title: string;
  genre: BookGenre;
  pages: number;
  available: boolean;
};

export const GOAL_GENRE: BookGenre = 'mystery';
export const GOAL_MAX_PAGES = 200;
export const GOAL_COUNT = 2;

/** Bounds both the number of real steps and any retries after a tool error. */
export const MAX_STEPS = 12;

const BASE_CATALOGUE: readonly Book[] = [
  { id: 'silver-key', title: 'The Silver Key', genre: 'mystery', pages: 180, available: true },
  { id: 'midnight-murder', title: 'Murder at Midnight', genre: 'mystery', pages: 210, available: true },
  { id: 'locked-door', title: 'The Locked Door', genre: 'mystery', pages: 150, available: false },
  { id: 'library-whispers', title: 'Whispers in the Library', genre: 'mystery', pages: 190, available: true },
  { id: 'herbs-cookbook', title: 'Cooking with Herbs', genre: 'cookbook', pages: 120, available: true },
  { id: 'missing-letter', title: 'The Missing Letter', genre: 'mystery', pages: 95, available: true },
  { id: 'garden-basics', title: 'Garden Design Basics', genre: 'gardening', pages: 300, available: true },
  { id: 'nile-path', title: 'Death on the Nile Path', genre: 'mystery', pages: 199, available: false },
];

export type LibraryDatasetId = 'default' | 'unavailable' | 'no-match';

function withOverrides(overrides: Partial<Record<string, Partial<Pick<Book, 'pages' | 'available'>>>>): Book[] {
  return BASE_CATALOGUE.map(book => (overrides[book.id] ? { ...book, ...overrides[book.id] } : book));
}

/**
 * Three scenarios over the same eight books. `unavailable` changes one
 * candidate's returned availability so the next action genuinely changes,
 * rather than replaying the same sequence with a different label.
 * `no-match` removes every remaining candidate's eligibility, so the loop
 * runs out of candidates and has to report failure instead of success.
 */
export const LIBRARY_DATASETS: Record<LibraryDatasetId, readonly Book[]> = {
  default: BASE_CATALOGUE,
  unavailable: withOverrides({ 'library-whispers': { available: false } }),
  'no-match': withOverrides({ 'library-whispers': { available: false }, 'missing-letter': { pages: 210 } }),
};

/** Title and genre never vary between scenarios, so the log can name a book without touching the catalogue. */
export const BOOK_META: Record<string, { title: string; genre: BookGenre }> = Object.fromEntries(
  BASE_CATALOGUE.map(book => [book.id, { title: book.title, genre: book.genre }]),
);

export function bookTitle(id: string): string {
  return BOOK_META[id]?.title ?? id;
}

/** The search tool: which books are even candidates, by genre. */
export function searchCatalogue(catalogue: readonly Book[]): string[] {
  return catalogue.filter(book => book.genre === GOAL_GENRE).map(book => book.id);
}

export type CheckResult = { pages: number; available: boolean };

/** The check tool: one candidate's current length and availability. */
export function checkBook(catalogue: readonly Book[], id: string): CheckResult | null {
  const book = catalogue.find(entry => entry.id === id);
  return book ? { pages: book.pages, available: book.available } : null;
}

export function meetsGoal(result: CheckResult): boolean {
  return result.pages < GOAL_MAX_PAGES && result.available;
}

/** Everything the loop has learned so far — never the catalogue itself. */
export type LibraryProgress = {
  searched: boolean;
  candidateOrder: string[];
  checked: Record<string, CheckResult>;
  confirmed: string[];
  stepsTaken: number;
};

export function initialProgress(): LibraryProgress {
  return { searched: false, candidateOrder: [], checked: {}, confirmed: [], stepsTaken: 0 };
}

export type LibraryDecision =
  | { kind: 'search' }
  | { kind: 'check'; bookId: string }
  | { kind: 'success' }
  | { kind: 'failure'; reason: string };

/**
 * Recomputed from `progress` every time, never from a fixed step index. A
 * search hit alone never counts as confirmed — only `checked` results that
 * pass `meetsGoal` do.
 */
export function decide(progress: LibraryProgress): LibraryDecision {
  if (progress.confirmed.length >= GOAL_COUNT) return { kind: 'success' };
  if (progress.stepsTaken >= MAX_STEPS) {
    return { kind: 'failure', reason: `Stopped after ${MAX_STEPS} steps without a second match. The task is unfinished.` };
  }
  if (!progress.searched) return { kind: 'search' };
  const next = progress.candidateOrder.find(id => !(id in progress.checked));
  if (next) return { kind: 'check', bookId: next };
  return {
    kind: 'failure',
    reason: `Checked every mystery candidate that came back. Only ${progress.confirmed.length} of ${GOAL_COUNT} met every condition — under ${GOAL_MAX_PAGES} pages and available now. No second match was found.`,
  };
}

export function successMessage(progress: LibraryProgress): string {
  const [firstId, secondId] = progress.confirmed;
  return `${bookTitle(firstId)} and ${bookTitle(secondId)} are both mysteries, under ${GOAL_MAX_PAGES} pages, and available in the latest check.`;
}

export type StepOutcome =
  | { requestId: string; kind: 'search'; status: 'ok'; candidates: string[] }
  | { requestId: string; kind: 'search'; status: 'error'; message: string }
  | { requestId: string; kind: 'check'; bookId: string; status: 'ok'; result: CheckResult }
  | { requestId: string; kind: 'check'; bookId: string; status: 'error'; message: string };

/**
 * Runs the tool named by `decision` against `catalogue`. `forceError`
 * simulates a tool that did not return a result — the loop's only job is to
 * not treat that as a real answer.
 */
export function executeStep(
  catalogue: readonly Book[],
  decision: Extract<LibraryDecision, { kind: 'search' } | { kind: 'check' }>,
  requestId: string,
  forceError: boolean,
): StepOutcome {
  if (decision.kind === 'search') {
    if (forceError) return { requestId, kind: 'search', status: 'error', message: 'The catalogue search did not return a result.' };
    return { requestId, kind: 'search', status: 'ok', candidates: searchCatalogue(catalogue) };
  }
  if (forceError) return { requestId, kind: 'check', bookId: decision.bookId, status: 'error', message: `The availability check for ${bookTitle(decision.bookId)} did not return a result.` };
  const result = checkBook(catalogue, decision.bookId);
  if (!result) return { requestId, kind: 'check', bookId: decision.bookId, status: 'error', message: `${bookTitle(decision.bookId)} is not in this catalogue.` };
  return { requestId, kind: 'check', bookId: decision.bookId, status: 'ok', result };
}

export type StepLogEntry = {
  id: string;
  kind: 'search' | 'check';
  bookId: string | null;
  summary: string;
  detail: string;
  status: 'info' | 'confirmed' | 'discarded' | 'error';
};

export type AgentPhase = 'idle' | 'running';

export type AgentState = {
  datasetId: LibraryDatasetId;
  progress: LibraryProgress;
  log: StepLogEntry[];
  phase: AgentPhase;
  pendingRequestId: string | null;
  pendingDecision: Extract<LibraryDecision, { kind: 'search' } | { kind: 'check' }> | null;
  nextRequestNumber: number;
  autoRunning: boolean;
  forceErrorNext: boolean;
  outcome: Extract<LibraryDecision, { kind: 'success' } | { kind: 'failure' }> | null;
};

export function initialAgentState(datasetId: LibraryDatasetId = 'default'): AgentState {
  return {
    datasetId,
    progress: initialProgress(),
    log: [],
    phase: 'idle',
    pendingRequestId: null,
    pendingDecision: null,
    nextRequestNumber: 1,
    autoRunning: false,
    forceErrorNext: false,
    outcome: null,
  };
}

export type AgentAction =
  | { kind: 'change-dataset'; datasetId: LibraryDatasetId }
  | { kind: 'reset' }
  | { kind: 'set-auto'; value: boolean }
  | { kind: 'set-force-error'; value: boolean }
  | { kind: 'begin'; requestId: string; decision: Extract<LibraryDecision, { kind: 'search' } | { kind: 'check' }> }
  | { kind: 'settle'; decision: Extract<LibraryDecision, { kind: 'success' } | { kind: 'failure' }> }
  | { kind: 'resolve'; outcome: StepOutcome };

function describeSearch(candidates: string[]): { summary: string; detail: string } {
  const summary = `Searched the catalogue → found ${candidates.length} mystery ${candidates.length === 1 ? 'candidate' : 'candidates'}.`;
  const detail = candidates.length > 0
    ? 'None checked yet. Check the first candidate’s length and availability next.'
    : 'No mystery books came back at all. The task is unfinished.';
  return { summary, detail };
}

function describeCheck(bookId: string, result: CheckResult, confirmedCount: number): { summary: string; detail: string; status: 'confirmed' | 'discarded' } {
  const title = bookTitle(bookId);
  const summary = `Checked ${title} → ${result.pages} pages, ${result.available ? 'available' : 'not available'}.`;
  if (meetsGoal(result)) {
    const detail = confirmedCount >= GOAL_COUNT
      ? `That’s ${confirmedCount} of ${GOAL_COUNT} confirmed.`
      : `That’s ${confirmedCount} of ${GOAL_COUNT} confirmed. Check the next candidate.`;
    return { summary, detail, status: 'confirmed' };
  }
  const reason = !result.available ? 'not available right now' : `too long — ${result.pages} pages`;
  return { summary, detail: `Discarded — ${title} is ${reason}. Check the next candidate.`, status: 'discarded' };
}

export function applyAgentAction(state: AgentState, action: AgentAction): AgentState {
  if (action.kind === 'change-dataset') return initialAgentState(action.datasetId);
  if (action.kind === 'reset') return initialAgentState(state.datasetId);
  if (action.kind === 'set-auto') return { ...state, autoRunning: action.value };
  if (action.kind === 'set-force-error') {
    if (state.phase !== 'idle' || state.outcome) return state;
    return { ...state, forceErrorNext: action.value };
  }

  if (action.kind === 'begin') {
    if (state.phase !== 'idle' || state.outcome) return state;
    return {
      ...state,
      phase: 'running',
      pendingRequestId: action.requestId,
      pendingDecision: action.decision,
      nextRequestNumber: state.nextRequestNumber + 1,
      forceErrorNext: false,
    };
  }

  if (action.kind === 'settle') {
    if (state.phase !== 'idle' || state.outcome) return state;
    return { ...state, outcome: action.decision, autoRunning: false };
  }

  // resolve
  if (state.phase !== 'running' || !state.pendingRequestId || action.outcome.requestId !== state.pendingRequestId) return state;
  const outcome = action.outcome;
  const stepsTaken = state.progress.stepsTaken + 1;
  const entryId = outcome.requestId;

  if (outcome.status === 'error') {
    const log: StepLogEntry = { id: entryId, kind: outcome.kind, bookId: outcome.kind === 'check' ? outcome.bookId : null, summary: `Tool error on this step.`, detail: outcome.message, status: 'error' };
    return {
      ...state,
      phase: 'idle',
      pendingRequestId: null,
      pendingDecision: null,
      progress: { ...state.progress, stepsTaken },
      log: [...state.log, log],
    };
  }

  if (outcome.kind === 'search') {
    const { summary, detail } = describeSearch(outcome.candidates);
    const log: StepLogEntry = { id: entryId, kind: 'search', bookId: null, summary, detail, status: 'info' };
    return {
      ...state,
      phase: 'idle',
      pendingRequestId: null,
      pendingDecision: null,
      progress: { ...state.progress, searched: true, candidateOrder: outcome.candidates, stepsTaken },
      log: [...state.log, log],
    };
  }

  const confirmed = meetsGoal(outcome.result) ? [...state.progress.confirmed, outcome.bookId] : state.progress.confirmed;
  const { summary, detail, status } = describeCheck(outcome.bookId, outcome.result, confirmed.length);
  const log: StepLogEntry = { id: entryId, kind: 'check', bookId: outcome.bookId, summary, detail, status };
  return {
    ...state,
    phase: 'idle',
    pendingRequestId: null,
    pendingDecision: null,
    progress: { ...state.progress, checked: { ...state.progress.checked, [outcome.bookId]: outcome.result }, confirmed, stepsTaken },
    log: [...state.log, log],
  };
}
