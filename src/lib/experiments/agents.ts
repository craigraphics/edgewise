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

/**
 * Scenario names describe the shelf, never how the run turns out. A label
 * reading "no second match exists" hands the learner the ending before the
 * loop has taken a step, which is the rule `one-step-at-a-time` records and
 * `agents.test.ts` holds these to.
 */
export const LIBRARY_SCENARIOS: readonly { id: LibraryDatasetId; label: string; blurb: string }[] = [
  { id: 'default', label: 'The full mystery shelf', blurb: 'Six mysteries, all of them on the shelf as the catalogue describes them.' },
  { id: 'unavailable', label: 'One copy is out on loan', blurb: 'The same six books, but somebody has borrowed Whispers in the Library.' },
  { id: 'no-match', label: 'A borrowed copy and a longer edition', blurb: 'Whispers in the Library is out, and The Missing Letter is a 210 page reprint.' },
];

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
    return {
      kind: 'failure',
      reason: `A person set a limit of ${MAX_STEPS} steps, and the loop reached it with only ${progress.confirmed.length} of ${GOAL_COUNT} confirmed. The limit is a rule in the surrounding code. The loop did not decide to give up.`,
    };
  }
  if (!progress.searched) return { kind: 'search' };
  const next = progress.candidateOrder.find(id => !(id in progress.checked));
  if (next) return { kind: 'check', bookId: next };
  return {
    kind: 'failure',
    reason: `Every mystery the search returned has now been checked. Only ${progress.confirmed.length} of ${GOAL_COUNT} met all three conditions, so the goal cannot be met from this catalogue.`,
  };
}

/** What the loop is about to do, and the reason, both read off `decide`. */
export type DecisionPreview = { action: string; because: string };

export function describeDecision(
  decision: Extract<LibraryDecision, { kind: 'search' } | { kind: 'check' }>,
  progress: LibraryProgress,
): DecisionPreview {
  if (decision.kind === 'search') {
    return {
      action: 'Search the catalogue',
      because: `Nothing has been looked up yet, and the goal names a genre. That is the one thing worth asking first.`,
    };
  }
  const title = bookTitle(decision.bookId);
  const left = progress.candidateOrder.filter(id => !(id in progress.checked)).length;
  return {
    action: `Check ${title}`,
    because: `The first candidate not checked yet. Only a check returns a length and an availability, and ${left === 1 ? 'this is the last one untried' : `${left} are still untried`}.`,
  };
}

/** Candidates the loop stopped before reaching. Nothing ruled them out. */
export function untouchedCandidates(progress: LibraryProgress): string[] {
  return progress.candidateOrder.filter(id => !(id in progress.checked));
}

/** Genre is a tool result here, not something the loop was handed. */
export function knownGenre(progress: LibraryProgress, id: string): string | null {
  if (!progress.searched) return null;
  return progress.candidateOrder.includes(id) ? GOAL_GENRE : `not a ${GOAL_GENRE}`;
}

export function successMessage(progress: LibraryProgress): string {
  const [firstId, secondId] = progress.confirmed;
  return `${bookTitle(firstId)} and ${bookTitle(secondId)} are both mysteries, under ${GOAL_MAX_PAGES} pages, and available in the latest check.`;
}

export type StepOutcome =
  | { requestId: string; kind: 'search'; status: 'ok'; candidates: string[]; shelfSize: number }
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
    return { requestId, kind: 'search', status: 'ok', candidates: searchCatalogue(catalogue), shelfSize: catalogue.length };
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

/**
 * Every "what happens next" sentence is read off the decision the loop will
 * actually take, so the readout can never promise a next candidate when the
 * run is already over.
 */
function whatFollows(next: LibraryDecision): string {
  if (next.kind === 'search') return ' Next: search the catalogue.';
  if (next.kind === 'check') return ` Next: check ${bookTitle(next.bookId)}.`;
  if (next.kind === 'success') return ' That is the goal met, so the loop stops.';
  return ' There is nothing left to try, so the loop stops.';
}

function describeSearch(candidates: string[], shelfSize: number, next: LibraryDecision): { summary: string; detail: string } {
  const summary = candidates.length > 0
    ? `Searched the catalogue: ${candidates.length} of the ${shelfSize} books are mysteries.`
    : 'Searched the catalogue: no mystery books came back at all.';
  const detail = candidates.length > 0
    ? `Genre is the only thing that search returns. Nothing is known yet about length or availability.${whatFollows(next)}`
    : `The goal cannot be met from a shelf with no mysteries on it.${whatFollows(next)}`;
  return { summary, detail };
}

function describeCheck(
  bookId: string,
  result: CheckResult,
  confirmedCount: number,
  next: LibraryDecision,
): { summary: string; detail: string; status: 'confirmed' | 'discarded' } {
  const title = bookTitle(bookId);
  const summary = `Checked ${title}: ${result.pages} pages, ${result.available ? 'available now' : 'not available'}.`;
  if (meetsGoal(result)) {
    return { summary, detail: `A match. That is ${confirmedCount} of ${GOAL_COUNT} confirmed.${whatFollows(next)}`, status: 'confirmed' };
  }
  const reason = !result.available ? 'not available right now' : `${result.pages} pages, over the ${GOAL_MAX_PAGES} page limit`;
  return { summary, detail: `Not a match: ${title} is ${reason}.${whatFollows(next)}`, status: 'discarded' };
}

/**
 * A step that meets the goal ends the run on that same step. Requiring one
 * further press would show the loop failing to notice it was finished, which
 * is the opposite of the stopping condition this experiment is about.
 */
function settled(next: LibraryDecision, wasAutoRunning: boolean): Pick<AgentState, 'phase' | 'outcome' | 'autoRunning'> {
  const done = next.kind === 'success' || next.kind === 'failure';
  return { phase: 'idle', outcome: done ? next : null, autoRunning: done ? false : wasAutoRunning };
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
    // A failed attempt consumes a step but teaches nothing, so the decision
    // that comes back is the same one. Saying so is what makes "an error costs
    // nothing but time" visible rather than merely true.
    const unchanged = decide({ ...state.progress, stepsTaken });
    const log: StepLogEntry = {
      id: entryId,
      kind: outcome.kind,
      bookId: outcome.kind === 'check' ? outcome.bookId : null,
      summary: 'Tool error on this step.',
      detail: `${outcome.message} Nothing was learned, so nothing about the next decision changes.${whatFollows(unchanged)}`,
      status: 'error',
    };
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
    const progress = { ...state.progress, searched: true, candidateOrder: outcome.candidates, stepsTaken };
    const next = decide(progress);
    const { summary, detail } = describeSearch(outcome.candidates, outcome.shelfSize, next);
    const log: StepLogEntry = { id: entryId, kind: 'search', bookId: null, summary, detail, status: 'info' };
    return { ...state, ...settled(next, state.autoRunning), pendingRequestId: null, pendingDecision: null, progress, log: [...state.log, log] };
  }

  const confirmed = meetsGoal(outcome.result) ? [...state.progress.confirmed, outcome.bookId] : state.progress.confirmed;
  const progress = { ...state.progress, checked: { ...state.progress.checked, [outcome.bookId]: outcome.result }, confirmed, stepsTaken };
  const next = decide(progress);
  const { summary, detail, status } = describeCheck(outcome.bookId, outcome.result, confirmed.length, next);
  const log: StepLogEntry = { id: entryId, kind: 'check', bookId: outcome.bookId, summary, detail, status };
  return { ...state, ...settled(next, state.autoRunning), pendingRequestId: null, pendingDecision: null, progress, log: [...state.log, log] };
}
