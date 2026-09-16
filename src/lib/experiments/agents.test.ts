import { describe, expect, it } from 'vitest';

import {
  applyAgentAction,
  checkBook,
  decide,
  executeStep,
  GOAL_COUNT,
  GOAL_MAX_PAGES,
  initialAgentState,
  initialProgress,
  LIBRARY_DATASETS,
  MAX_STEPS,
  meetsGoal,
  searchCatalogue,
  successMessage,
  type AgentState,
  type LibraryProgress,
} from './agents';

function driveOneRun(datasetId: keyof typeof LIBRARY_DATASETS, forceErrorOnStep?: number) {
  let state: AgentState = initialAgentState(datasetId);
  let requestNumber = 0;
  for (let guard = 0; guard < MAX_STEPS + 2; guard++) {
    if (state.outcome) return state;
    const decision = decide(state.progress);
    if (decision.kind === 'success' || decision.kind === 'failure') {
      state = applyAgentAction(state, { kind: 'settle', decision });
      continue;
    }
    requestNumber += 1;
    const requestId = `step-${requestNumber}`;
    state = applyAgentAction(state, { kind: 'begin', requestId, decision });
    const forceError = forceErrorOnStep === requestNumber;
    const outcome = executeStep(LIBRARY_DATASETS[datasetId], decision, requestId, forceError);
    state = applyAgentAction(state, { kind: 'resolve', outcome });
  }
  throw new Error('run did not settle');
}

describe('the two tools', () => {
  it('search returns only mystery candidates, in catalogue order', () => {
    const ids = searchCatalogue(LIBRARY_DATASETS.default);
    expect(ids).toEqual(['silver-key', 'midnight-murder', 'locked-door', 'library-whispers', 'missing-letter', 'nile-path']);
    expect(ids).not.toContain('herbs-cookbook');
    expect(ids).not.toContain('garden-basics');
  });

  it('check reads one book and nothing else', () => {
    expect(checkBook(LIBRARY_DATASETS.default, 'silver-key')).toEqual({ pages: 180, available: true });
    expect(checkBook(LIBRARY_DATASETS.default, 'not-a-real-id')).toBeNull();
  });

  it('meetsGoal requires both the page limit and current availability', () => {
    expect(meetsGoal({ pages: 199, available: true })).toBe(true);
    expect(meetsGoal({ pages: 200, available: true })).toBe(false);
    expect(meetsGoal({ pages: 100, available: false })).toBe(false);
  });
});

describe('decide — reads only accumulated results, never the catalogue', () => {
  it('takes no catalogue argument at all, so it cannot see unchecked truth', () => {
    expect(decide.length).toBe(1);
  });

  it('starts by searching', () => {
    expect(decide(initialProgress())).toEqual({ kind: 'search' });
  });

  it('a search hit alone is not confirmed availability', () => {
    const progress: LibraryProgress = { searched: true, candidateOrder: ['silver-key'], checked: {}, confirmed: [], stepsTaken: 1 };
    expect(decide(progress)).toEqual({ kind: 'check', bookId: 'silver-key' });
  });

  it('checks candidates in order, skipping ones already checked', () => {
    const progress: LibraryProgress = {
      searched: true,
      candidateOrder: ['a', 'b', 'c'],
      checked: { a: { pages: 90, available: true } },
      confirmed: ['a'],
      stepsTaken: 2,
    };
    expect(decide(progress)).toEqual({ kind: 'check', bookId: 'b' });
  });

  it('succeeds only once two distinct candidates are confirmed', () => {
    const progress: LibraryProgress = { searched: true, candidateOrder: ['a', 'b'], checked: {}, confirmed: ['a', 'b'], stepsTaken: 3 };
    expect(decide(progress)).toEqual({ kind: 'success' });
  });

  it('reports failure once every candidate is checked and fewer than two match', () => {
    const progress: LibraryProgress = {
      searched: true,
      candidateOrder: ['a', 'b'],
      checked: { a: { pages: 90, available: true }, b: { pages: 300, available: true } },
      confirmed: ['a'],
      stepsTaken: 3,
    };
    const decision = decide(progress);
    expect(decision.kind).toBe('failure');
    if (decision.kind === 'failure') expect(decision.reason).toMatch(/1 of 2/);
  });

  it('bounds the number of steps', () => {
    const progress: LibraryProgress = { searched: false, candidateOrder: [], checked: {}, confirmed: [], stepsTaken: MAX_STEPS };
    expect(decide(progress).kind).toBe('failure');
  });
});

describe('a full run — default catalogue', () => {
  it('confirms two distinct, real matches and names them as evidence', () => {
    const state = driveOneRun('default');
    expect(state.outcome).toEqual({ kind: 'success' });
    expect(state.progress.confirmed).toEqual(['silver-key', 'library-whispers']);
    expect(new Set(state.progress.confirmed).size).toBe(GOAL_COUNT);
    expect(successMessage(state.progress)).toBe('The Silver Key and Whispers in the Library are both mysteries, under 200 pages, and available in the latest check.');
    // Stops as soon as it has two — the remaining candidates were never checked.
    expect(state.progress.checked['missing-letter']).toBeUndefined();
    expect(state.progress.checked['nile-path']).toBeUndefined();
  });

  it('never confirms a book outside the genre or over the page limit', () => {
    const state = driveOneRun('default');
    for (const id of state.progress.confirmed) {
      const result = state.progress.checked[id];
      expect(result.pages).toBeLessThan(GOAL_MAX_PAGES);
      expect(result.available).toBe(true);
    }
  });
});

describe('a full run — a candidate turns out to be unavailable', () => {
  it('adapts: the next action changes, and it still succeeds', () => {
    const state = driveOneRun('unavailable');
    expect(state.outcome).toEqual({ kind: 'success' });
    expect(state.progress.checked['library-whispers']).toEqual({ pages: 190, available: false });
    expect(state.progress.confirmed).toEqual(['silver-key', 'missing-letter']);
  });
});

describe('a full run — no second match exists', () => {
  it('reports the task as unfinished rather than declaring success', () => {
    const state = driveOneRun('no-match');
    expect(state.outcome?.kind).toBe('failure');
    expect(state.progress.confirmed).toEqual(['silver-key']);
    if (state.outcome?.kind === 'failure') expect(state.outcome.reason).toMatch(/1 of 2/);
  });
});

describe('the reducer', () => {
  it('ignores a stale or duplicate resolve', () => {
    let state = initialAgentState('default');
    state = applyAgentAction(state, { kind: 'begin', requestId: 'step-1', decision: { kind: 'search' } });
    const outcome = executeStep(LIBRARY_DATASETS.default, { kind: 'search' }, 'step-1', false);
    const resolved = applyAgentAction(state, { kind: 'resolve', outcome });
    expect(resolved.progress.searched).toBe(true);
    // A second, delayed delivery of the same result must not double-apply.
    const resolvedAgain = applyAgentAction(resolved, { kind: 'resolve', outcome });
    expect(resolvedAgain).toBe(resolved);
  });

  it('ignores a response for a request that is no longer pending', () => {
    const state = initialAgentState('default');
    const staleOutcome = executeStep(LIBRARY_DATASETS.default, { kind: 'search' }, 'ghost-request', false);
    const next = applyAgentAction(state, { kind: 'resolve', outcome: staleOutcome });
    expect(next).toBe(state);
  });

  it('a tool error does not advance progress, and can be retried', () => {
    let state = initialAgentState('default');
    state = applyAgentAction(state, { kind: 'begin', requestId: 'step-1', decision: { kind: 'search' } });
    const errorOutcome = executeStep(LIBRARY_DATASETS.default, { kind: 'search' }, 'step-1', true);
    state = applyAgentAction(state, { kind: 'resolve', outcome: errorOutcome });
    expect(state.progress.searched).toBe(false);
    expect(state.phase).toBe('idle');
    expect(state.log.at(-1)?.status).toBe('error');
    // The very next decision is unchanged — the failed attempt did not consume the search.
    expect(decide(state.progress)).toEqual({ kind: 'search' });
  });

  it('a repeated tool error eventually bounds the run to an honest failure', () => {
    let state = initialAgentState('default');
    for (let i = 0; i < MAX_STEPS + 1 && !state.outcome; i++) {
      const decision = decide(state.progress);
      if (decision.kind === 'success' || decision.kind === 'failure') {
        state = applyAgentAction(state, { kind: 'settle', decision });
        continue;
      }
      const requestId = `err-${i}`;
      state = applyAgentAction(state, { kind: 'begin', requestId, decision });
      const outcome = executeStep(LIBRARY_DATASETS.default, decision, requestId, true);
      state = applyAgentAction(state, { kind: 'resolve', outcome });
    }
    expect(state.outcome?.kind).toBe('failure');
  });

  it('reset returns to the initial state for the current dataset', () => {
    let state = initialAgentState('unavailable');
    state = applyAgentAction(state, { kind: 'begin', requestId: 'step-1', decision: { kind: 'search' } });
    state = applyAgentAction(state, { kind: 'reset' });
    expect(state).toEqual(initialAgentState('unavailable'));
  });

  it('changing the dataset resets progress and keeps the new dataset', () => {
    const state = applyAgentAction(initialAgentState('default'), { kind: 'change-dataset', datasetId: 'no-match' });
    expect(state).toEqual(initialAgentState('no-match'));
  });

  it('a delayed result after reset cannot recreate old progress', () => {
    let state = initialAgentState('default');
    state = applyAgentAction(state, { kind: 'begin', requestId: 'step-1', decision: { kind: 'search' } });
    const outcome = executeStep(LIBRARY_DATASETS.default, { kind: 'search' }, 'step-1', false);
    const afterReset = applyAgentAction(state, { kind: 'reset' });
    const afterLateResolve = applyAgentAction(afterReset, { kind: 'resolve', outcome });
    expect(afterLateResolve).toBe(afterReset);
  });

  it('a manual step cannot begin while one is already running', () => {
    let state = initialAgentState('default');
    state = applyAgentAction(state, { kind: 'begin', requestId: 'step-1', decision: { kind: 'search' } });
    const again = applyAgentAction(state, { kind: 'begin', requestId: 'step-2', decision: { kind: 'search' } });
    expect(again).toBe(state);
  });

  it('stops after success or failure — settle is a no-op once an outcome exists', () => {
    let state = initialAgentState('no-match');
    state = { ...state, outcome: { kind: 'failure', reason: 'already done' } };
    const again = applyAgentAction(state, { kind: 'settle', decision: { kind: 'success' } });
    expect(again).toBe(state);
  });
});
