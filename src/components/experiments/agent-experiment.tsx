'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ArrowRight, CircleAlert, Play, RotateCcw, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  applyAgentAction,
  executeStep,
  decide,
  GOAL_MAX_PAGES,
  initialAgentState,
  LIBRARY_DATASETS,
  successMessage,
  type LibraryDatasetId,
} from '@/lib/experiments/agents';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useAgentExperiment> };
const STEP_DELAY_MS = 550;

const SCENARIOS: { id: LibraryDatasetId; label: string; blurb: string }[] = [
  { id: 'default', label: 'Everything goes to plan', blurb: 'The first two matching candidates checked are both available.' },
  { id: 'unavailable', label: 'A book turns out to be unavailable', blurb: 'A candidate that would have matched is checked out. Watch the next action change.' },
  { id: 'no-match', label: 'No second match exists', blurb: 'Only one book in the whole catalogue actually qualifies.' },
];

function statusLabel(status: 'unchecked' | 'candidate' | 'not-a-candidate' | 'confirmed' | 'discarded'): string {
  switch (status) {
    case 'unchecked': return 'Not searched yet';
    case 'not-a-candidate': return 'Not a candidate';
    case 'candidate': return 'Candidate — not checked yet';
    case 'confirmed': return 'Confirmed';
    case 'discarded': return 'Discarded';
  }
}

/** Kept at workspace level so the run survives trips to other views. */
export function useAgentExperiment() {
  const [state, dispatch] = useReducer(applyAgentAction, undefined, () => initialAgentState('default'));
  const stateRef = useRef(state);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  useEffect(() => cancelPending, [cancelPending]);

  const takeStep = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'idle' || current.outcome || timerRef.current !== null) return;
    const decision = decide(current.progress);
    if (decision.kind === 'success' || decision.kind === 'failure') {
      dispatch({ kind: 'settle', decision });
      return;
    }
    const requestId = `step-${current.nextRequestNumber}`;
    const forceError = current.forceErrorNext;
    dispatch({ kind: 'begin', requestId, decision });
    timerRef.current = setTimeout(() => {
      const catalogue = LIBRARY_DATASETS[current.datasetId];
      const outcome = executeStep(catalogue, decision, requestId, forceError);
      dispatch({ kind: 'resolve', outcome });
      timerRef.current = null;
    }, STEP_DELAY_MS);
  }, []);

  /**
   * Auto-run re-fires on every settled state while the flag is on. It stops
   * itself the moment an outcome lands, so a delayed step cannot restart a
   * loop the learner already saw finish.
   */
  useEffect(() => {
    if (state.autoRunning && state.phase === 'idle' && !state.outcome) takeStep();
  }, [state.autoRunning, state.phase, state.outcome, takeStep]);

  const runRemaining = useCallback(() => dispatch({ kind: 'set-auto', value: true }), []);
  const stop = useCallback(() => { cancelPending(); dispatch({ kind: 'set-auto', value: false }); }, [cancelPending]);
  const setForceError = useCallback((value: boolean) => dispatch({ kind: 'set-force-error', value }), []);
  const changeDataset = useCallback((datasetId: LibraryDatasetId) => { cancelPending(); dispatch({ kind: 'change-dataset', datasetId }); }, [cancelPending]);
  const reset = useCallback(() => { cancelPending(); dispatch({ kind: 'reset' }); }, [cancelPending]);

  return { state, takeStep, runRemaining, stop, setForceError, changeDataset, reset };
}

/** Scripted request, real local decisions, and no learner-model access. */
export function AgentExperiment({ onExplain, experiment }: Props) {
  const { state, takeStep, runRemaining, stop, setForceError, changeDataset, reset } = experiment;
  const { progress, log, phase, outcome, autoRunning, forceErrorNext, datasetId } = state;
  const touched = log.length > 0 || outcome !== null;
  const catalogue = LIBRARY_DATASETS[datasetId];
  const last = log[log.length - 1] ?? null;
  const running = phase === 'running';
  const canStop = running || autoRunning;

  function rowStatus(id: string, genre: string) {
    if (genre !== 'mystery') return progress.searched ? 'not-a-candidate' as const : 'unchecked' as const;
    if (id in progress.checked) return progress.confirmed.includes(id) ? 'confirmed' as const : 'discarded' as const;
    if (progress.searched && progress.candidateOrder.includes(id)) return 'candidate' as const;
    return 'unchecked' as const;
  }

  return <section className="agents-lab" aria-labelledby="agents-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A library helper · runs in your browser</p>
        <h3 id="agents-lab-title" tabIndex={-1} className="font-display mt-2 text-xl outline-none sm:text-3xl">What turns one tool call into working towards a goal?</h3>
      </div>
      {touched && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>

    <p className="mt-3 max-w-2xl text-base">This is a scripted agent demonstration. The library, the catalogue, and every decision below run locally in your browser — there is no account, no borrowing, and no live model involved.</p>
    <p className="text-muted-foreground mt-2 max-w-2xl text-sm">Tool use handles one request and its result. An agent repeats that loop toward a goal, using each result to choose what happens next.</p>

    <div className="agents-goal mt-4">
      <p className="eyebrow">Goal</p>
      <p className="font-display mt-1 text-lg">Find two mystery books under {GOAL_MAX_PAGES} pages that are available now.</p>
    </div>

    <div className="agents-catalogue-wrap mt-4">
      <table className="agents-catalogue">
        <caption className="text-muted-foreground pb-2 text-left text-sm">The library catalogue, and what has been learned about each book so far</caption>
        <thead><tr><th scope="col">Title</th><th scope="col">Genre</th><th scope="col">Length</th><th scope="col">Available</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {catalogue.map(book => {
            const checked = progress.checked[book.id];
            const status = rowStatus(book.id, book.genre);
            return <tr key={book.id} data-status={status}>
              <th scope="row">{book.title}</th>
              <td>{book.genre}</td>
              <td>{checked ? `${checked.pages} pages` : '—'}</td>
              <td>{checked ? (checked.available ? 'Yes' : 'No') : '—'}</td>
              <td>{statusLabel(status)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>

    <div className="agents-action mt-4" aria-live="polite" aria-atomic="true">
      {last && <div className="agents-last">
        <p className="font-display text-lg">{last.summary}</p>
        <p className="text-muted-foreground mt-1 text-sm">{last.detail}</p>
      </div>}
      {running && <p className="mt-2 inline-flex items-center gap-2 text-sm">Working on the next step…</p>}
      {outcome?.kind === 'success' && <div className="agents-outcome agents-outcome-success mt-2">
        <p className="font-display text-lg">Done — two matches confirmed.</p>
        <p className="mt-1 text-sm">{successMessage(progress)}</p>
      </div>}
      {outcome?.kind === 'failure' && <div className="agents-outcome agents-outcome-failure mt-2">
        <p className="font-display text-lg">The task is unfinished.</p>
        <p className="mt-1 text-sm">{outcome.reason}</p>
      </div>}
      {!outcome && <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="touch" onClick={takeStep} disabled={running}>Take the next step <ArrowRight aria-hidden /></Button>
        {touched && !autoRunning && <Button variant="outline" size="touch" onClick={runRemaining} disabled={running}><Play size={16} aria-hidden />Run the remaining steps</Button>}
        {canStop && <Button variant="outline" size="touch" onClick={stop}><Square size={16} aria-hidden />Stop</Button>}
      </div>}
    </div>

    {touched && <details className="agents-details mt-4">
      <summary className="agents-summary">See every step so far ({log.length})</summary>
      <ol className="agents-log text-muted-foreground space-y-2 pb-2 text-sm">
        {log.map(entry => <li key={entry.id} className={`agents-log-entry agents-log-${entry.status}`}>
          <span className="text-foreground font-medium">{entry.summary}</span> {entry.detail}
        </li>)}
      </ol>
    </details>}

    <details className="agents-details mt-2">
      <summary className="agents-summary">Try a problem</summary>
      <div className="text-muted-foreground space-y-3 pb-2 text-sm">
        <p>Choose a different catalogue. This starts the run over, because the whole point is watching the decisions unfold again with different results coming back.</p>
        <div className="agents-scenarios">
          {SCENARIOS.map(scenario => <button
            key={scenario.id}
            aria-pressed={datasetId === scenario.id}
            onClick={() => changeDataset(scenario.id)}
            className="agents-scenario"
          >
            <span className="font-medium">{scenario.label}</span>
            <span className="text-muted-foreground mt-1 block text-xs">{scenario.blurb}</span>
          </button>)}
        </div>
        <p>A tool call can also simply fail to return anything. That does not count as an answer, and does not move the run forward.</p>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" checked={forceErrorNext} disabled={phase !== 'idle' || !!outcome} onChange={event => setForceError(event.target.checked)} />
          Make the next step fail, to see what happens
        </label>
        {forceErrorNext && <p className="inline-flex items-center gap-2" role="status"><CircleAlert size={15} aria-hidden />The next step will report a tool error instead of a result.</p>}
      </div>
    </details>

    <details className="agents-details mt-2">
      <summary className="agents-summary">How it works</summary>
      <div className="text-muted-foreground space-y-3 pb-2 text-sm">
        <p>The next action here comes from a small, explicit decision function: search first, then check candidates one at a time, stopping once two are confirmed or the candidates run out. It reads the results and state built up so far — it is not a hidden language model, and there is no independent reasoning happening beneath the arrows.</p>
        <p>Real model-based agents often ask a language model to choose the next action instead of running fixed code. Even then, the surrounding app still manages which tools exist, what information is available, how many steps are allowed, and when to stop. A loop by itself does not make a system reliably autonomous — the common failures are an overflowing context, small errors compounding across steps, and no reliable way to know the goal was actually met.</p>
      </div>
    </details>

    {outcome && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">What turns one tool call into working towards a goal?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain what decided each next step, in your own words, if you want to. Using this experiment leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}
  </section>;
}
