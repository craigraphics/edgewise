'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ArrowRight, CircleAlert, Play, RotateCcw, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  applyAgentAction,
  bookTitle,
  decide,
  describeDecision,
  executeStep,
  GOAL_COUNT,
  GOAL_MAX_PAGES,
  initialAgentState,
  knownGenre,
  LIBRARY_DATASETS,
  LIBRARY_SCENARIOS,
  MAX_STEPS,
  successMessage,
  untouchedCandidates,
  type LibraryDatasetId,
} from '@/lib/experiments/agents';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useAgentExperiment> };
const STEP_DELAY_MS = 550;


function statusLabel(status: 'candidate' | 'not-a-candidate' | 'confirmed' | 'discarded'): string {
  switch (status) {
    case 'not-a-candidate': return 'Not a candidate';
    case 'candidate': return 'Not checked yet';
    case 'confirmed': return 'Match';
    case 'discarded': return 'Not a match';
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

/** Local tools, real local decisions, and no learner-model access. */
export function AgentExperiment({ onExplain, experiment }: Props) {
  const { state, takeStep, runRemaining, stop, setForceError, changeDataset, reset } = experiment;
  const { progress, log, phase, outcome, autoRunning, forceErrorNext, datasetId } = state;
  const touched = log.length > 0 || outcome !== null;
  const catalogue = LIBRARY_DATASETS[datasetId];
  const last = log[log.length - 1] ?? null;
  const running = phase === 'running';
  const canStop = running || autoRunning;

  const pending = outcome ? null : decide(progress);
  const preview = pending && (pending.kind === 'search' || pending.kind === 'check')
    ? describeDecision(pending, progress)
    : null;
  const unreached = outcome?.kind === 'success' ? untouchedCandidates(progress) : [];

  function rowStatus(id: string) {
    if (!progress.candidateOrder.includes(id)) return 'not-a-candidate' as const;
    if (id in progress.checked) return progress.confirmed.includes(id) ? 'confirmed' as const : 'discarded' as const;
    return 'candidate' as const;
  }

  return <section className="agents-lab" aria-labelledby="agents-lab-title">
    <div>
      <p className="eyebrow">A library helper</p>
      <h3 id="agents-lab-title" tabIndex={-1} className="font-display mt-2 text-xl outline-none sm:text-3xl">What turns one tool call into working towards a goal?</h3>
    </div>

    <div className="agents-cockpit mt-4">
      <div className="agents-goal">
        <p className="eyebrow">The goal</p>
        <p className="font-display mt-1 text-lg">Find {GOAL_COUNT} mystery books under {GOAL_MAX_PAGES} pages that are available now.</p>
        <p className="text-muted-foreground mt-2 text-sm">One helper, two tools, and no sight of the shelves. It only learns by using a tool and reading what comes back.</p>
        <p className="agents-tally mt-2 text-sm">
          <strong className="text-foreground">{progress.confirmed.length} of {GOAL_COUNT}</strong> confirmed so far
          {progress.confirmed.length > 0 && <span className="text-muted-foreground">: {progress.confirmed.map(bookTitle).join(', ')}</span>}
        </p>
      </div>

      {preview
        ? <div className="agents-action">
          <p className="eyebrow">Next step, chosen from what it knows so far</p>
          <p className="font-display mt-1 text-lg">{preview.action}</p>
          <p className="text-muted-foreground mt-1 text-sm">{preview.because}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="touch" onClick={takeStep} disabled={running}>{preview.action} <ArrowRight aria-hidden /></Button>
            {touched && !autoRunning && <Button variant="outline" size="touch" onClick={runRemaining} disabled={running}><Play size={16} aria-hidden />Run the rest</Button>}
            {canStop && <Button variant="outline" size="touch" onClick={stop}><Square size={16} aria-hidden />Stop</Button>}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">Runs entirely in your browser. No account, no borrowing, no live model.</p>
        </div>
        : <div className="agents-action">
          <p className="eyebrow">No next step</p>
          <p className="text-muted-foreground mt-1 text-sm">The loop has stopped, so it is not choosing anything. Start the run again below, or try a different shelf, to watch it decide from scratch.</p>
        </div>}

      <div className="agents-readout" aria-live="polite">
        {running
          ? <p className="text-muted-foreground text-sm">Using the tool…</p>
          : last
            ? <>
              <p className="font-display text-lg">{last.summary}</p>
              <p className="text-muted-foreground mt-1 text-sm">{last.detail}</p>
            </>
            : <p className="text-muted-foreground text-sm">Nothing has come back yet. Whatever a tool returns appears here, and it is all the loop has to go on.</p>}
      </div>
    </div>

    {progress.searched
      ? <div className="agents-catalogue-wrap mt-4">
        <table className="agents-catalogue">
          <caption className="text-muted-foreground pb-2 text-left text-sm">What the loop has found out. Every cell here came back from a tool.</caption>
          <thead><tr><th scope="col">Title</th><th scope="col">Genre</th><th scope="col">Length</th><th scope="col">Available</th><th scope="col">Where it stands</th></tr></thead>
          <tbody>
            {catalogue.map(book => {
              const checked = progress.checked[book.id];
              const status = rowStatus(book.id);
              return <tr key={book.id} data-status={status}>
                <th scope="row">{book.title}</th>
                <td>{knownGenre(progress, book.id) ?? '—'}</td>
                <td>{checked ? `${checked.pages} pages` : '—'}</td>
                <td>{checked ? (checked.available ? 'Yes' : 'No') : '—'}</td>
                <td>{statusLabel(status)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      : <p className="text-muted-foreground mt-4 text-sm">It knows nothing about the shelf yet. Its two tools are <strong className="text-foreground">search the catalogue</strong>, which returns which books are mysteries, and <strong className="text-foreground">check one book</strong>, which returns that book&rsquo;s length and whether it is available.</p>}

    {outcome?.kind === 'success' && <div className="agents-outcome agents-outcome-success mt-4">
      <p className="font-display text-lg">Two matches confirmed. The loop stopped.</p>
      <p className="mt-1 text-sm">{successMessage(progress)}</p>
    </div>}
    {outcome?.kind === 'failure' && <div className="agents-outcome agents-outcome-failure mt-4">
      <p className="font-display text-lg">The task is unfinished.</p>
      <p className="mt-1 text-sm">{outcome.reason}</p>
    </div>}

    {touched && <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Every step so far ({log.length})</h4>
        <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Start this run again</button>
      </div>
      <ol className="agents-log text-muted-foreground mt-2 space-y-2 text-sm">
        {log.map(entry => <li key={entry.id} className={`agents-log-entry agents-log-${entry.status}`}>
          <span className="text-foreground font-medium">{entry.summary}</span> {entry.detail}
        </li>)}
      </ol>
    </div>}

    {outcome && <div className="agents-named mt-4">
      <p className="eyebrow">What made it stop</p>
      <p className="mt-2 text-sm">Nothing in the loop knew the task was finished. It stopped because a person wrote down when to stop: {GOAL_COUNT} confirmed books, or no candidates left, or a hard ceiling of {MAX_STEPS} steps so a stuck run cannot go round forever.</p>
      {unreached.length > 0 && <p className="mt-2 text-sm">
        Notice what did not happen. {unreached.length === 1 ? 'One candidate was' : `${unreached.length} candidates were`} never checked at all: {unreached.map(bookTitle).join(', ')}. Nothing ruled {unreached.length === 1 ? 'it' : 'them'} out. The goal asked for {GOAL_COUNT} books, {GOAL_COUNT} were confirmed, and the rule fired.
      </p>}
      <p className="mt-3 text-sm">Tool use handles one request and its result. An agent is that same step repeated: look at what has come back, choose one action, do it, look again. The loop is the agent, and the loop is ordinary code somebody wrote.</p>
      <p className="mt-2 text-sm">In a real agent the chooser is a language model rather than the small function here, deciding each next action from the results so far. It is the same model doing the same next-word prediction, put in a loop with tools and a stopping rule. The autonomy is the loop, not a new ability in the model.</p>
      <p className="text-muted-foreground mt-3 text-sm">Which is also why agents are hard, and not for the reason people expect. The usual failures are not the model being insufficiently clever. Every step&rsquo;s output becomes the next step&rsquo;s input, so a small error early is carried forward and compounded. The history of every step so far has to be re-sent each time, so the context fills up. And knowing whether the goal has genuinely been met is genuinely difficult, which is why the rule above had to be written by hand.</p>
    </div>}

    <details className="agents-details mt-4">
      <summary className="agents-summary">Try a different shelf</summary>
      <div className="text-muted-foreground space-y-3 pb-2 text-sm">
        <p>Choose a different shelf. This starts the run over, because watching the decisions unfold again against different results is the whole point.</p>
        <div className="agents-scenarios">
          {LIBRARY_SCENARIOS.map(scenario => <button
            key={scenario.id}
            aria-pressed={datasetId === scenario.id}
            onClick={() => changeDataset(scenario.id)}
            className="agents-scenario"
          >
            <span className="font-medium">{scenario.label}</span>
            <span className="text-muted-foreground mt-1 block text-xs">{scenario.blurb}</span>
          </button>)}
        </div>
        <p>A tool can also simply fail to return anything. That is not an answer, and it does not move the run forward.</p>
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
        <p>The chooser here is a small, explicit function, not a language model: search first, then check candidates one at a time, stopping once {GOAL_COUNT} are confirmed or the candidates run out. It is given only what has come back so far, and it has no access to the shelf, so it cannot quietly skip to the answer.</p>
        <p>A language model in its place would choose differently and less predictably, but the surrounding parts would be identical. The app still decides which tools exist, what the model is shown, how many steps are allowed, and when to stop. None of that comes from the model.</p>
      </div>
    </details>

    {outcome && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">What turns one tool call into working towards a goal?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain what decided each next step, in your own words, if you want to. Using this experiment leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}
  </section>;
}
