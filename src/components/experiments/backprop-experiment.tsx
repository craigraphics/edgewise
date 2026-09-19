'use client';

import { useCallback, useReducer } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { NumberField } from '@/components/experiments/number-field';
import { Button } from '@/components/ui/button';
import {
  backpropReducer,
  INITIAL_MEASURED_LITRES,
  INITIAL_SETTINGS,
  initialBackpropState,
  LEARNING_STEP,
  litres,
  MAX_MEASURED_LITRES,
  number,
  resultSentence,
  RUN_MINUTES,
  validMeasuredLitres,
  wateringEstimate,
  type BackwardAdvice,
} from '@/lib/experiments/backprop';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useBackpropExperiment> };

const percentage = (share: number) => `${number(share * 100, 1)}%`;

function direction(change: number, noun: string): string {
  if (change === 0) return `leave the ${noun} where it is`;
  return `${change > 0 ? 'increase' : 'decrease'} the ${noun}`;
}

function differenceSentence(advice: BackwardAdvice): string {
  if (advice.difference === 0) return `The estimate already matches the ${litres(advice.measuredLitres)} measured.`;
  return `The estimate is ${litres(Math.abs(advice.difference))} too ${advice.difference < 0 ? 'low' : 'high'}. That one difference is worked backward through both settings.`;
}

/**
 * Kept at workspace level so visiting another idea or the explanation and
 * coming back does not reset the measurement, advice, or applied change.
 */
export function useBackpropExperiment() {
  const [state, dispatch] = useReducer(backpropReducer, undefined, initialBackpropState);
  const workBack = useCallback(() => dispatch({ type: 'work-back' }), []);
  const apply = useCallback(() => dispatch({ type: 'apply' }), []);
  const setMeasuredLitres = useCallback((value: number | null) => dispatch({ type: 'set-measured', value }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  return { state, workBack, apply, setMeasuredLitres, reset };
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function BackpropExperiment({ onExplain, experiment }: Props) {
  const { state, workBack, apply, setMeasuredLitres, reset } = experiment;
  const { settings, measuredLitres, advice, result, hasCompletedFirstRun, applyError } = state;
  const estimateNow = wateringEstimate(settings);
  const dirty = advice !== null || result !== null || measuredLitres !== INITIAL_MEASURED_LITRES;
  const validMeasurement = validMeasuredLitres(measuredLitres);
  const shareChange = advice ? -LEARNING_STEP * advice.gradients.plantShare : 0;
  const tapChange = advice ? -LEARNING_STEP * advice.gradients.litresPerMinute : 0;
  const noChange = advice?.difference === 0;

  const status = measuredLitres === null
    ? 'Enter a measured amount before working backward. Nothing has been put in its place.'
    : result
      ? resultSentence(result)
      : advice
        ? noChange
          ? 'The estimate already matches the measurement. Both pieces of advice are zero, so there is no change to apply.'
          : `Advice only: ${direction(shareChange, 'splitter share')} by ${number(Math.abs(shareChange) * 100, 1)} percentage points and ${direction(tapChange, 'tap estimate')} by ${number(Math.abs(tapChange))} litres per minute. The saved settings are still ${number(advice.settings.litresPerMinute)} litres per minute and ${percentage(advice.settings.plantShare)}.`
        : `The model estimates ${litres(estimateNow)}. The measured amount is ${litres(measuredLitres)}.`;

  return <section className="backprop-lab" aria-labelledby="backprop-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="backprop-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">If the final amount is wrong, how do we work back to the earlier settings?</h3>
      </div>
      {dirty && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>

    <p className="mt-3 max-w-2xl text-base">For a <strong>{RUN_MINUTES}-minute run</strong>, this model saves two estimates: tap speed and the plant&apos;s share. They are not real plumbing.</p>

    <div className="backprop-board mt-4">
      <div className="backprop-run">
        <p className="eyebrow">One unchanged {RUN_MINUTES}-minute run</p>
        {validMeasurement ? <p className="font-display mt-2 text-xl">We expected {litres(estimateNow)}. The plant received {litres(measuredLitres)}.</p> : <p className="font-display mt-2 text-xl">The measured amount is empty.</p>}
        <p className="text-muted-foreground mt-2 text-sm">From a tap estimate of {number(settings.litresPerMinute)} litres per minute and a splitter estimate of {percentage(settings.plantShare)}.</p>
        {!advice && <div className="mt-3">
          <Button className="h-auto min-h-10 w-full justify-between whitespace-normal text-left" size="touch" onClick={workBack} disabled={!validMeasurement}>Work back from the difference <ArrowRight className="shrink-0" aria-hidden /></Button>
          <p className="text-muted-foreground mt-2 text-sm">{validMeasurement ? 'First calculate the advice. Both saved settings stay put.' : 'Add the measured amount first.'}</p>
        </div>}
      </div>

      <div className="backprop-settings">
        <p className="eyebrow">Saved model estimates</p>
        <p className="text-muted-foreground mt-1 text-xs">{result ? 'After the learning step' : 'Supplied for this teaching example'}</p>
        <div className="backprop-setting-list mt-3">
          <div className="backprop-setting">
            <p className="backprop-setting-label">Tap estimate</p>
            <p><strong>{number(settings.litresPerMinute)} litres per minute</strong></p>
          </div>
          <div className="backprop-setting">
            <p className="backprop-setting-label">Splitter estimate</p>
            <p><strong>{percentage(settings.plantShare)} reaches this plant</strong></p>
          </div>
        </div>
      </div>
    </div>

    <p className="backprop-connection mt-3 max-w-2xl text-sm">Getting less wrong showed how a small change can help. Here we work out the change for settings earlier in the chain.</p>

    <p aria-live="polite" aria-atomic="true" className="backprop-status mt-4 text-sm">{status}</p>

    {advice && <div className="backprop-advice mt-4">
      <p className="eyebrow">Work backward from the result</p>
      <p className="font-display mt-2 text-xl">{differenceSentence(advice)}</p>

      <ol className="mt-4 space-y-3">
        <li className="backprop-advice-row">
          <span className="backprop-advice-number" aria-hidden="true">1</span>
          <div>
            <p className="font-medium">Splitter setting first</p>
            {shareChange === 0
              ? <p className="text-muted-foreground mt-1 text-sm">The final amount is already right, so changing the splitter cannot improve this run. The advice is zero.</p>
              : <p className="text-muted-foreground mt-1 text-sm">With the tap estimate held at {number(advice.settings.litresPerMinute)} litres per minute, sending a larger share to this plant raises the final amount. The advice is to {direction(shareChange, 'share')} by <strong className="text-foreground">{number(Math.abs(shareChange) * 100, 1)} percentage points</strong>.</p>}
          </div>
        </li>
        <li className="backprop-advice-row">
          <span className="backprop-advice-number" aria-hidden="true">2</span>
          <div>
            <p className="font-medium">Tap setting next</p>
            {tapChange === 0
              ? <p className="text-muted-foreground mt-1 text-sm">The final amount is already right, so changing the tap estimate cannot improve this run. The advice is zero.</p>
              : <p className="text-muted-foreground mt-1 text-sm">With the splitter estimate held at {percentage(advice.settings.plantShare)}, a faster tap raises the final amount. The advice is to {direction(tapChange, 'tap estimate')} by <strong className="text-foreground">{number(Math.abs(tapChange))} litres per minute</strong>.</p>}
          </div>
        </li>
      </ol>

      <div className="backprop-name mt-4">
        <p className="font-medium">The settings have not changed yet.</p>
        <p className="text-muted-foreground mt-1 text-sm">Both pieces of advice came from the same {litres(advice.estimate)} estimate. The backward pass did not make a second prediction or update one setting halfway through.</p>
        <p className="mt-2 text-sm"><strong>Backpropagation</strong> works backward to calculate how sensitive the error score is to each saved setting. It calculates the advice. The learning step applies it afterwards.</p>
      </div>

      {!result && !noChange && <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="touch" onClick={apply}>Apply one small change <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground text-sm">This panel uses a small step of {LEARNING_STEP}, chosen for this teaching example.</p>
      </div>}
      {!result && noChange && <p className="text-muted-foreground mt-4 text-sm">There is no change to apply because this run has no final difference.</p>}
      {applyError && <p role="alert" className="backprop-refusal mt-3 text-sm"><strong>No change was applied.</strong> That step would make one of the plumbing estimates physically impossible. The panel refuses it instead of hiding the problem.</p>}
    </div>}

    {result && <div className="backprop-result mt-4">
      <p className="eyebrow">Before and after</p>
      <div className="backprop-estimates mt-3">
        <div className="backprop-estimate">
          <p className="backprop-setting-label">Before the learning step</p>
          <p><strong>{litres(result.estimateBefore)}</strong></p>
        </div>
        <ArrowRight className="backprop-result-arrow" aria-hidden />
        <div className="backprop-estimate backprop-estimate-now">
          <p className="backprop-setting-label">After the learning step</p>
          <p><strong>{litres(result.estimateAfter)}</strong></p>
        </div>
      </div>
      <p className="font-display mt-3 text-xl">{resultSentence(result)}</p>
      <p className="text-muted-foreground mt-2 text-sm">The tap estimate moved from {number(result.before.litresPerMinute)} to {number(result.after.litresPerMinute)} litres per minute. The splitter estimate moved from {percentage(result.before.plantShare)} to {percentage(result.after.plantShare)}. Both used advice from the same old run.</p>
      <p className="mt-2 text-sm">This is a two-setting teaching model. Real networks have many settings and much longer chains, but the backward pass serves the same job.</p>
    </div>}

    {hasCompletedFirstRun && <details className="backprop-another text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">Try another measured amount</summary>
      <div className="pt-2">
        <p>Changing this starts again from the supplied tap and splitter estimates, so only the measured amount differs.</p>
        <NumberField
          id="backprop-measured"
          label="Measured at the plant"
          name="Measured litres received by the plant"
          unit="litres"
          value={measuredLitres}
          max={MAX_MEASURED_LITRES}
          step={0.1}
          clamp={false}
          className="mt-3 block max-w-xs"
          onChange={setMeasuredLitres}
        />
        <p className="mt-2 text-xs">This panel accepts 0 to {MAX_MEASURED_LITRES} litres. The field can be empty while you type; an empty field is never treated as zero.</p>
      </div>
    </details>}

    {hasCompletedFirstRun && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">How did the difference at the end tell us which way to move both earlier settings, and what happened before the settings changed?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain it in your own words if you want to. Nothing in this experiment changes a mark on your map; only an explanation you give yourself can do that.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p>The estimate is <code>{RUN_MINUTES} minutes × tap estimate × splitter estimate</code>. In the opening run, {RUN_MINUTES} × {number(INITIAL_SETTINGS.litresPerMinute)} × {number(INITIAL_SETTINGS.plantShare)} = 3 litres.</p>
        <p>First the model needs a number for how far off it was. Here the error score, often called the <strong>loss</strong>, is <code>0.5 × (estimate − measured)²</code>. For 3 instead of 4, that score is 0.5.</p>
        <p>Holding the splitter at 0.6, the score changes at a rate of −6 as the tap estimate changes. Holding the tap at 0.5, it changes at a rate of −5 as the splitter share changes. These are the two gradients, both calculated from the unchanged opening run.</p>
        <p>The learning step subtracts {LEARNING_STEP} times each gradient. That makes the tap estimate 0.56 and the splitter share 0.65 at the same time. The next prediction is {RUN_MINUTES} × 0.56 × 0.65 = 3.64 litres.</p>
        <p>The gradients are sensitivities, not percentages or shares of blame. They do not have to add to 100, and there is no leftover blame being passed backward as a conserved substance. The blame metaphor names the job but not the chain-rule calculation.</p>
        <p>Every number is calculated in your browser from the values on screen. Nothing is sent anywhere.</p>
      </div>
    </details>
  </section>;
}
