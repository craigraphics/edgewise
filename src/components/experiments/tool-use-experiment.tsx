'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ArrowRight, Calculator, CircleAlert, RotateCcw } from 'lucide-react';

import { NumberField } from '@/components/experiments/number-field';
import { Button } from '@/components/ui/button';
import {
  applyToolDemoAction,
  BOARD_LENGTH_CM,
  finalShelfAnswer,
  handleCalculatorRequest,
  initialToolDemo,
  MAX_BOARD_COUNT,
  MIN_BOARD_COUNT,
  replacementRequest,
  type CalculatorRequest,
} from '@/lib/experiments/tool-use';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useToolUseExperiment> };
type RunOutcome = 'success' | 'error';
const TOOL_DELAY_MS = 650;

/** Kept at workspace level so the request survives trips to other views. */
export function useToolUseExperiment() {
  const [state, dispatch] = useReducer(applyToolDemoAction, undefined, initialToolDemo);
  const stateRef = useRef(state);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => cancelPending, [cancelPending]);

  const schedule = useCallback((request: CalculatorRequest, outcome: RunOutcome) => {
    if (timerRef.current !== null) return;
    timerRef.current = setTimeout(() => {
      const response = outcome === 'success'
        ? handleCalculatorRequest(request)
        : { requestId: request.id, status: 'error' as const, message: 'The calculator did not return a result.' };
      dispatch({ kind: 'resolve', response });
      timerRef.current = null;
    }, TOOL_DELAY_MS);
  }, []);

  const run = useCallback(() => {
    const request = stateRef.current.request;
    if (!request || stateRef.current.phase !== 'waiting' || timerRef.current !== null) return;
    dispatch({ kind: 'begin', requestId: request.id });
    schedule(request, 'success');
  }, [schedule]);

  const replaceAndRun = useCallback((outcome: RunOutcome) => {
    if (timerRef.current !== null) return;
    const request = replacementRequest(stateRef.current);
    if (!request) return;
    dispatch({ kind: 'replace-and-begin', request });
    schedule(request, outcome);
  }, [schedule]);

  const changeCount = useCallback((count: number | null) => {
    cancelPending();
    dispatch({ kind: 'change-count', count });
  }, [cancelPending]);

  const reset = useCallback(() => {
    cancelPending();
    dispatch({ kind: 'reset' });
  }, [cancelPending]);

  return {
    state,
    run,
    retry: () => replaceAndRun('success'),
    simulateFailure: () => replaceAndRun('error'),
    changeCount,
    reset,
  };
}

function requestJson(request: CalculatorRequest) {
  return JSON.stringify({ tool: request.tool, operation: request.operation, operands: request.operands, unit: request.unit }, null, 2);
}

/** Scripted request and answer, real local arithmetic, and no learner-model access. */
export function ToolUseExperiment({ onExplain, experiment }: Props) {
  const { state, run, retry, simulateFailure, changeCount, reset } = experiment;
  const success = state.response?.status === 'success' ? state.response : null;
  const error = state.response?.status === 'error' ? state.response : null;
  const validCount = state.boardCount !== null
    && Number.isInteger(state.boardCount)
    && state.boardCount >= MIN_BOARD_COUNT
    && state.boardCount <= MAX_BOARD_COUNT;
  const touched = state.hasRun || state.boardCount !== 3;
  const comparison = success && state.previousSuccess
    && (state.previousSuccess.boardCount !== state.boardCount || state.previousSuccess.response.value !== success.value)
    ? state.previousSuccess
    : null;

  return <section className="tool-use-lab" aria-labelledby="tool-use-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A shelf-building task · runs in your browser</p>
        <h3 id="tool-use-lab-title" tabIndex={-1} className="font-display mt-2 text-xl outline-none sm:text-3xl">If a model makes text, who does the actual calculation?</h3>
      </div>
      {touched && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>
    <p className="mt-3 max-w-2xl text-base">Follow one calculation from a request to the finished answer.</p>

    <div className="tool-use-stage mt-5">
      <div className="tool-use-request">
        <p className="eyebrow">1 · Request</p>
        <p className="text-muted-foreground mt-1 text-xs">Scripted model request for this demonstration.</p>
        <p className="font-display mt-3 text-xl">I need {state.boardCount ?? '—'} boards, each {BOARD_LENGTH_CM}cm long. How much wood is that?</p>
        <p className="tool-use-call mt-3"><span>Calculate</span> {state.boardCount ?? '—'} × {BOARD_LENGTH_CM}</p>
        {state.phase === 'waiting' && <Button size="touch" className="mt-3 h-auto max-w-full py-2 text-left whitespace-normal" onClick={run} disabled={!state.request || !validCount}>Run the calculator <ArrowRight aria-hidden /></Button>}
      </div>

      <div className="tool-use-calculator">
        <p className="eyebrow">2 · Calculator result</p>
        <p className="text-muted-foreground mt-1 text-xs">Real local calculation run by app code. No online service.</p>
        <div className="mt-3" aria-live="polite" aria-atomic="true">
          {state.phase === 'waiting' && <p className="text-sm">Waiting for the calculator to run.</p>}
          {state.phase === 'running' && <p className="inline-flex items-center gap-2 text-sm"><Calculator size={17} aria-hidden />Calculator is running…</p>}
          {success && <p className="font-display text-xl">Calculator returned <strong>{success.value}{success.unit}</strong>.</p>}
          {error && <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold"><CircleAlert size={17} aria-hidden />Calculator error</p>
            <p className="mt-2 text-sm">{error.message} The answer cannot claim a new calculated result yet.</p>
          </div>}
        </div>
        {state.phase === 'error' && <Button size="touch" className="mt-3" onClick={retry}>Retry the calculator <ArrowRight aria-hidden /></Button>}
      </div>

      <div className="tool-use-answer">
        <p className="eyebrow">3 · Answer</p>
        <div className="mt-2" aria-live="polite" aria-atomic="true">
          {success
            ? <>
              <p className="font-display text-xl">{finalShelfAnswer(success)}</p>
              <p className="text-muted-foreground mt-2 text-sm">App code supplied the calculator&rsquo;s returned value for this scripted sentence to use.</p>
              {comparison && <dl className="tool-use-compare mt-3">
                <div><dt>Before · {comparison.boardCount} boards</dt><dd>{comparison.response.value}{comparison.response.unit}</dd></div>
                <div><dt>Now · {state.boardCount} boards</dt><dd>{success.value}{success.unit}</dd></div>
              </dl>}
            </>
            : <p className="text-muted-foreground text-sm">No finished answer yet. This step waits for a successful result from the matching request.</p>}
        </div>
      </div>
    </div>

    {state.hasRun && <div className="tool-use-try mt-4">
      <div>
        <p className="font-display text-xl">Try another example</p>
        <p className="text-muted-foreground mt-1 text-sm">Change the number of boards. That creates a new request and puts the old answer aside until you run it.</p>
      </div>
      <NumberField
        id="tool-use-board-count"
        label="Number of boards"
        name={`Number of boards, from ${MIN_BOARD_COUNT} to ${MAX_BOARD_COUNT}`}
        unit="boards"
        value={state.boardCount}
        max={MAX_BOARD_COUNT}
        step={1}
        clamp={false}
        className="max-w-48"
        onChange={changeCount}
      />
      {!validCount && <p className="text-sm" role="alert">Enter a whole number from {MIN_BOARD_COUNT} to {MAX_BOARD_COUNT}. No request has been made from this value.</p>}
    </div>}

    {success && <div className="tool-use-conclusion mt-4">
      <p className="font-display text-xl">The request was not the calculation.</p>
      <p className="mt-2 text-sm">The model can ask for an action in its output. The surrounding app runs it and brings the result back.</p>
      <p className="text-muted-foreground mt-2 text-sm">A structured request still has to pass this app&rsquo;s checks and go through the named calculator handler.</p>
    </div>}

    {state.hasRun && <details className="tool-use-details mt-5">
      <summary className="tool-use-summary">What if it fails?</summary>
      <div className="text-muted-foreground pb-2 text-sm">
        <p>A tool can fail or return something unhelpful. The app should not write a fresh calculated answer until a matching result comes back.</p>
        {state.phase !== 'error' && <Button variant="outline" size="touch" className="mt-3" onClick={simulateFailure} disabled={!validCount || state.phase === 'running'}>Simulate a calculator error</Button>}
      </div>
    </details>}

    <details className="tool-use-details mt-2">
      <summary className="tool-use-summary">How it works</summary>
      <div className="text-muted-foreground space-y-3 pb-2 text-sm">
        <p>The request and final sentence are scripted here so the handoff is easy to see. There is no language model choosing a tool in this panel.</p>
        <p>This handler accepts only the named calculator, multiplication, finite numbers in a small range, and centimetres. It does not run free text or use <code>eval</code>.</p>
        {state.request && <div>
          <p className="text-foreground font-medium">Request seen by the handler</p>
          <pre className="tool-use-json mt-2" aria-label={`Calculator request ${state.request.id}`}>{requestJson(state.request)}</pre>
        </div>}
        <p>This small example leaves out how a real app describes tools to a model, asks for permission, checks outside results, and decides what actions are safe. A tool result is data to inspect, not something that is automatically trustworthy.</p>
      </div>
    </details>

    {success && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">The model request named a calculation. What actually ran it, and how did the returned number reach the answer?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the handoff in your own words if you want to. Using this experiment leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}
  </section>;
}
