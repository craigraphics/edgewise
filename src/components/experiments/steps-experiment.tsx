'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ACTUAL_MINUTES,
  attemptStep,
  DEFAULT_SIZE,
  guessAfter,
  MAX_STEPS,
  RUN_INTERVAL_MS,
  RUN_STEPS,
  round,
  shrinking,
  sizeOf,
  slopeAt,
  START_GUESS,
  STEP_SIZES,
  travelOf,
  type Attempt,
  type Step,
  type StepSizeId,
} from '@/lib/experiments/steps';
import { MINUTES_UNIT } from '@/lib/experiments/regression';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useStepsExperiment> };

/** After this many steps the panel offers a choice of step size. Before that there is one action. */
const REVEAL_AFTER = 3;

/** A real minus sign, so a runaway guess does not print as a hyphen. */
const minutes = (value: number) => `${round(value, 2)} ${MINUTES_UNIT}`.replace(/^-/, '−');
/**
 * "1 minute off", "8 minutes off" — the phrase the whole panel turns on.
 *
 * A distance small enough to round away at the printed precision is said to be
 * under it rather than shown as nothing. A run of bigger steps converges fast
 * enough to reach that in a dozen moves, and printing "0 off → 0 off" beside
 * the words "past it, and closer" would be the panel contradicting itself about
 * the one thing it is for.
 */
function minutesOff(value: number): string {
  const shown = round(value, PLACES);
  if (value > 0 && shown === 0) return `under ${SMALLEST} minutes off`;
  return `${shown} ${shown === 1 ? 'minute' : 'minutes'} off`;
}

/** Everything on screen is printed to this many places, and the words respect it. */
const PLACES = 2;
const SMALLEST = 0.01;
const belowDisplay = (value: number) => value > 0 && round(value, PLACES) === 0;

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the steps taken, the chosen step size, or a refused step.
 *
 * The steps taken ARE the state: the guess is read off the last one, so there is
 * no second copy of it to drift out of agreement with the history on screen.
 */
export function useStepsExperiment() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [sizeId, setSizeId] = useState<StepSizeId>(DEFAULT_SIZE);
  const [refusal, setRefusal] = useState<Extract<Attempt, { ok: false }> | null>(null);
  /**
   * The step number the optional short run should stop at, or null when nothing
   * is running. Whether it IS running is derived from this rather than stored,
   * so a run that ends because it hit the cap or was refused cannot leave a Stop
   * button on screen with no timer behind it.
   */
  const [runUntil, setRunUntil] = useState<number | null>(null);

  const guess = guessAfter(steps);
  const capped = steps.length >= MAX_STEPS;
  const running = runUntil !== null && !refusal && !capped && steps.length < runUntil;

  const take = useCallback(() => {
    setSteps(current => {
      if (current.length >= MAX_STEPS) return current;
      const attempt = attemptStep(guessAfter(current), sizeId, current.length + 1);
      if (!attempt.ok) {
        setRefusal(attempt);
        setRunUntil(null);
        return current;
      }
      setRefusal(null);
      return [...current, attempt.step];
    });
  }, [sizeId]);

  /**
   * The run is a chain of timeouts rather than one interval: each is scheduled
   * from the state the previous step left behind, so a refusal or the cap ends
   * it on the spot instead of firing into a panel that has stopped moving.
   */
  useEffect(() => {
    if (!running || steps.length >= MAX_STEPS) return;
    const timer = setTimeout(take, RUN_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [running, take, steps.length]);

  const choose = useCallback((next: StepSizeId) => {
    setSizeId(next);
    setRefusal(null);
  }, []);

  const run = useCallback(() => {
    setRefusal(null);
    setRunUntil(Math.min(MAX_STEPS, steps.length + RUN_STEPS));
  }, [steps.length]);

  const stop = useCallback(() => setRunUntil(null), []);

  const reset = useCallback(() => {
    setSteps([]);
    setSizeId(DEFAULT_SIZE);
    setRefusal(null);
    setRunUntil(null);
  }, []);

  return { steps, sizeId, refusal, guess, running, capped, take, choose, run, stop, reset };
}

/** One guess, with how far off it is beside it. */
function GuessCard({ eyebrow, guess, accent, note }: { eyebrow: string; guess: number; accent?: boolean; note?: string }) {
  const off = Math.abs(guess - ACTUAL_MINUTES);
  return <div className={cn('steps-guess', accent && 'steps-guess-now')}>
    <p className="eyebrow">{eyebrow}</p>
    <p className="font-display mt-1 text-2xl">{minutes(guess)}</p>
    <p className="mt-1 text-sm">{off === 0 ? 'Exactly right' : minutesOff(off)}</p>
    {note && <p className="text-muted-foreground mt-1 text-sm">{note}</p>}
  </div>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function StepsExperiment({ onExplain, experiment }: Props) {
  const { steps, sizeId, refusal, guess, running, capped, take, choose, run, stop, reset } = experiment;

  const latest = steps.length > 0 ? steps[steps.length - 1] : null;
  const optionsOpen = steps.length >= REVEAL_AFTER;
  const slope = slopeAt(guess);
  const settled = slope === 0;
  const size = sizeOf(sizeId);
  const stepsShrinking = useMemo(() => shrinking(steps), [steps]);

  const direction = settled
    ? 'The guess already matches the time it took, so neither direction makes it better. There is nothing left for a step to do.'
    : slope > 0
      ? 'Right now, moving the guess down makes it less wrong. Moving it up makes it more wrong.'
      : 'Right now, moving the guess up makes it less wrong. Moving it down makes it more wrong.';

  const headline = !latest
    ? 'Nothing has moved yet.'
    : latest.outcome.landed === 'exact'
      ? 'It landed exactly on the time it took.'
      : latest.outcome.crossed
        ? latest.outcome.landed === 'closer'
          ? 'It went past the answer, and still landed closer.'
          : latest.outcome.landed === 'further'
            ? 'It went past the answer and landed further away.'
            : 'It went past the answer and landed just as far off on the other side.'
        : latest.outcome.landed === 'closer'
          ? latest.outcome.moved === 'down' ? 'It lowered the guess. The answer got closer.' : 'It raised the guess. The answer got closer.'
          : 'It moved away from the answer.';

  return <section className="steps-lab" aria-labelledby="steps-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="steps-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">How can a model improve an answer a little at a time?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>

    <p className="mt-3 max-w-2xl text-base">A food delivery took <strong>{ACTUAL_MINUTES} minutes</strong>. The model guessed <strong>{START_GUESS} minutes</strong> — ten minutes too long. Nobody tells it the right answer: it is told only how far off it is, and which way to move to make that smaller.</p>

    <div className="steps-guesses mt-4">
      {latest
        ? <>
          <GuessCard eyebrow="Before this step" guess={latest.before} />
          <GuessCard eyebrow="After this step" guess={latest.after} accent note={`Moved ${minutes(Math.abs(latest.change))} ${latest.outcome.moved === 'down' ? 'down' : latest.outcome.moved === 'up' ? 'up' : 'nowhere'}`} />
        </>
        : <GuessCard eyebrow="The model’s guess" guess={guess} accent />}
    </div>

    {/* The one fact a step is allowed to act on, next to the control that acts on it. */}
    <p className="steps-direction mt-3 max-w-2xl">{direction}</p>

    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button size="touch" onClick={take} disabled={capped || settled || running}>Take one step <ArrowRight aria-hidden /></Button>
      <p className="text-muted-foreground text-sm">
        {capped ? `${MAX_STEPS} steps is as many as this panel keeps. Reset to start again.`
          : settled ? 'The guess is exactly right, so a step would move it by nothing.'
          : steps.length === 0 ? 'One step, then look at what changed.'
          : `${steps.length} ${steps.length === 1 ? 'step' : 'steps'} so far.`}
      </p>
    </div>

    {optionsOpen && <div className="steps-options mt-4">
      <p className="text-sm font-medium">Try a bigger step</p>
      <p className="text-muted-foreground mt-1 text-sm">The direction stays the same. Only how far each step moves changes.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {STEP_SIZES.map(option => <Button
          key={option.id}
          type="button"
          size="touch"
          variant={sizeId === option.id ? 'default' : 'outline'}
          onClick={() => choose(option.id)}
        >{option.label}</Button>)}
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        {size.label} follows the same direction as before. Here that comes to {describeTravel(travelOf(size.size))}, each time.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {running
          ? <Button size="touch" variant="outline" onClick={stop}>Stop</Button>
          : <Button size="touch" variant="outline" onClick={run} disabled={capped || settled}>Run {RUN_STEPS} steps</Button>}
        <p className="text-muted-foreground text-sm">{running ? 'Running one step at a time. Stop whenever you want to look.' : 'Or take them one at a time above.'}</p>
      </div>
    </div>}

    <div aria-live="polite" aria-atomic="true" className="steps-readout mt-4">
      <p className="font-display text-xl">{headline}</p>
      {!latest
        ? <p className="mt-2 text-sm">Take one step and the guess will move, in whichever direction makes it less wrong. Nothing else on this screen will change by itself.</p>
        : <>
          <p className="mt-2 text-sm">
            {minutes(latest.before)} was {minutesOff(latest.offBefore)}. {minutes(latest.after)} is {latest.outcome.landed === 'exact' ? 'not off at all' : minutesOff(latest.offAfter)}.
          </p>
          {latest.outcome.crossed && latest.outcome.landed !== 'exact' && <p className="mt-2 text-sm">
            The direction was right — {latest.outcome.moved === 'down' ? 'down' : 'up'} was the way that helps — but the step was bigger than the distance it had to cover, so the guess went past and came out on the other side. It is {latest.after > ACTUAL_MINUTES ? 'too long' : 'too short'} now instead of {latest.before > ACTUAL_MINUTES ? 'too long' : 'too short'}.
          </p>}
          {stepsShrinking && <p className="mt-2 text-sm">The steps are getting smaller on their own. The closer the guess gets, the more gently the score changes, so the same step size moves it less.</p>}
          {latest.outcome.landed === 'exact' && <p className="mt-2 text-sm">There is nothing left to improve, so every step from here would move it by nothing at all.</p>}
          {belowDisplay(latest.offAfter) && <p className="mt-2 text-sm">The guess is now closer than this panel can print. The steps carry on, and they carry on getting smaller — which is the ordinary ending, rather than landing exactly on the answer.</p>}
        </>}
      {refusal && <p className="steps-refusal mt-3 text-sm">
        <strong>No step was taken.</strong> From {minutes(guess)}, a {size.label.toLowerCase()} would have taken the guess to <strong>{minutes(refusal.wouldBe)}</strong>, which {refusal.side === 'below' ? 'is less than no time at all' : 'is no longer a delivery time'}. That is where steps this big end up: the guess never settles, it runs away. Choose a smaller step to carry on from here.
      </p>}
    </div>

    {steps.length > 0 && <div className="mt-5">
      <h4 className="font-display text-xl">Every step so far</h4>
      <p className="text-muted-foreground mt-1 text-sm">Oldest first, so you can follow what each step did.</p>
      <ol className="mt-3 space-y-2">
        {steps.map(step => <li key={step.index} className="steps-row">
          <span className="steps-row-index">Step {step.index}{optionsOpen ? ` · ${sizeOf(step.sizeId).label.toLowerCase()}` : ''}</span>
          <span className="steps-row-move font-mono tabular-nums">{round(step.before, 2)} → {round(step.after, 2)} {MINUTES_UNIT}</span>
          <span className="steps-row-off font-mono tabular-nums">{belowDisplay(step.offBefore) ? `<${SMALLEST}` : round(step.offBefore, PLACES)} off → {belowDisplay(step.offAfter) ? `<${SMALLEST}` : round(step.offAfter, PLACES)} off</span>
          <span className="steps-row-verdict">{step.outcome.landed === 'exact' ? 'exactly right' : step.outcome.landed === 'closer' ? (step.outcome.crossed ? 'past it, and closer' : 'closer') : step.outcome.landed === 'further' ? (step.outcome.crossed ? 'past it, and further away' : 'further away') : 'the same distance, other side'}</span>
        </li>)}
      </ol>
    </div>}

    {/* The names, only now that the thing they name has happened on screen a few times. */}
    {optionsOpen && <div className="steps-name mt-6">
      <p className="eyebrow">The names for this</p>
      <p className="mt-2 text-base">Each move is a <strong>step</strong>. How far it moves is the <strong>step size</strong>, which is usually called the <strong>learning rate</strong>. The direction and the steepness it follows — which way makes the score smaller, and how fast the score is changing right here — is the <strong>gradient</strong>. Taking small steps against it, over and over, is <strong>gradient descent</strong>.</p>
      <p className="mt-2 text-base">This is a tiny example with one number to adjust. A real model has millions, and one step nudges all of them at once, each by its own amount.</p>
      <p className="text-muted-foreground mt-2 text-sm">Nothing here is aiming at the best possible answer. A step only knows which way is better from where it is standing. Where a real training run stops is a place it stopped improving, not a proof that nothing better exists.</p>
    </div>}

    {optionsOpen && <div className="border-border mt-6 border-t pt-5">
      <p className="font-display text-xl">Why can a step in the helpful direction still leave the guess further away, if the step is too big?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain it in your own words if you want to. Nothing you do in this panel changes a mark on your map; only an explanation you give yourself can do that.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="text-muted-foreground mt-6 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p>The score is how far off the guess is, multiplied by itself — the “big misses count more” measure from the idea before this one. At {START_GUESS} minutes the guess is 10 off, so the score is 100.</p>
        <p>The slope is how fast that score changes per minute of guess, right at the guess it is standing on. For this score it works out to twice the gap: 20 at {START_GUESS} minutes. Positive means going up makes things worse, so the step goes down.</p>
        <p>A step is <code>guess − step size × slope</code>. A small step is 0.1, and 0.1 × 20 = 2, so {START_GUESS} becomes 38.</p>
        <p>Because the slope here is proportional to how far off the guess is, a step of 0.1 always covers a fifth of the remaining distance, 0.6 covers a little more than all of it, and 1.5 covers three times it. That neat relationship belongs to this one-number example, not to training in general.</p>
        <p>All of it is computed in your browser from the numbers on screen. Nothing is sent anywhere.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p><strong>One number.</strong> A real model adjusts millions at once, and a step size that suits one of them can be far too big for another.</p>
        <p><strong>A clear view of the score.</strong> Here the delivery time is known, so the score and its slope can be worked out exactly. A real model measures them on a handful of examples at a time, so each step points in a roughly right direction rather than the right one.</p>
        <p><strong>Any promise.</strong> Nothing here says every step improves the answer, or that a long run finds the best setting available. A step that is too big makes things worse; a run of good steps reaches somewhere it stops improving, which is not the same thing as the best place there is.</p>
        <p><strong>The hillside.</strong> This is often explained as a ball rolling downhill. That picture is left out on purpose: it suggests a landscape somebody could look at and a lowest point to aim for. A real model has millions of directions at once, and nothing can see the shape of it — only the slope underfoot.</p>
        <p>The delivery is invented for this panel, not measured.</p>
      </div>
    </details>
  </section>;
}

/** How much of the remaining distance a step covers, in words rather than as a ratio. */
function describeTravel(travel: number): string {
  if (travel < 1) return `about ${travel === 0.2 ? 'a fifth' : `${round(travel * 100, 0)} per cent`} of the distance left to cover`;
  if (travel <= 1.05) return 'the whole distance left to cover';
  if (travel < 2) return `a little more than the distance left to cover — ${round(travel, 1)} times it`;
  return `${round(travel, 1)} times the distance left to cover`;
}
