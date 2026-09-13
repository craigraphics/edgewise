'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/experiments/number-field';
import {
  ACTUAL_MINUTES,
  compareCounting,
  countMistakes,
  FAR_GUESS,
  GUESS_SETS,
  INITIAL_SET,
  judge,
  MAX_GUESS,
  MAX_MINUTES,
  NEAR_GUESS,
  round,
  rowsFor,
  timesWorse,
  type Counting,
  type GuessRow,
  type GuessSet,
} from '@/lib/experiments/loss';
import { MINUTES_UNIT } from '@/lib/experiments/regression';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useLossExperiment> };

/** "1 minute off", "30 minutes off" — the phrase this whole panel turns on. */
function minutesOff(value: number): string {
  const shown = round(value, 1);
  return `${shown} ${shown === 1 ? 'minute' : 'minutes'} off`;
}

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the guess, the four deliveries, or the set being compared against.
 */
export function useLossExperiment() {
  const [guess, setGuess] = useState(FAR_GUESS);
  const [rows, setRows] = useState<GuessRow[]>(() => rowsFor(INITIAL_SET));
  const [setLabel, setSetLabel] = useState<string | null>(INITIAL_SET.label);
  /**
   * The set of guesses that was on screen before the current one, so the two
   * ways of counting can be read side by side. Captured only when a whole set is
   * swapped, and cleared on a hand edit: after one number changes there is no
   * named "before" left to put in the column heading.
   */
  const [previous, setPrevious] = useState<{ label: string; counting: Counting } | null>(null);
  const [secondExample, setSecondExample] = useState(false);

  const chooseSet = useCallback((set: GuessSet) => {
    const wasCounting = countMistakes(rows);
    setPrevious(setLabel && wasCounting && setLabel !== set.label ? { label: setLabel, counting: wasCounting } : null);
    setRows(rowsFor(set));
    setSetLabel(set.label);
  }, [rows, setLabel]);

  const editGuess = useCallback((id: string, value: number | null) => {
    setRows(current => current.map(row => (row.id === id ? { ...row, guess: value } : row)));
    setSetLabel(null);
    setPrevious(null);
  }, []);

  const reset = useCallback(() => {
    setGuess(FAR_GUESS);
    setRows(rowsFor(INITIAL_SET));
    setSetLabel(INITIAL_SET.label);
    setPrevious(null);
    setSecondExample(false);
  }, []);

  return { guess, rows, setLabel, previous, secondExample, setGuess, chooseSet, editGuess, reset, setSecondExample };
}

/** One guess, with right-or-wrong beside how-far-off. The comparison is the lesson. */
function GuessCard({ eyebrow, guess, children }: { eyebrow: string; guess: number; children?: ReactNode }) {
  const verdict = judge(guess, ACTUAL_MINUTES);
  return <div className="loss-guess">
    <p className="eyebrow">{eyebrow}</p>
    <p className="font-display mt-1 text-2xl">{guess} {MINUTES_UNIT}</p>
    <div className="loss-verdicts mt-3">
      <span className="loss-verdict">
        <span className="loss-verdict-label">Right or wrong?</span>
        <strong>{verdict.exact ? 'Right' : 'Wrong'}</strong>
      </span>
      <span className="loss-verdict loss-verdict-distance">
        <span className="loss-verdict-label">How far off</span>
        <strong>{minutesOff(verdict.off)}</strong>
      </span>
    </div>
    {children}
  </div>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function LossExperiment({ onExplain, experiment }: Props) {
  const { guess, rows, setLabel, previous, secondExample, setGuess, chooseSet, editGuess, reset, setSecondExample } = experiment;

  const started = judge(FAR_GUESS, ACTUAL_MINUTES);
  const now = judge(guess, ACTUAL_MINUTES);
  const moved = guess !== FAR_GUESS;
  const closer = now.off < started.off;

  const counting = countMistakes(rows);
  const comparison = previous && counting ? compareCounting(previous.counting, counting) : null;
  const ratio = previous && counting ? timesWorse(previous.counting, counting) : null;

  const openSecondExample = () => {
    setSecondExample(true);
    requestAnimationFrame(() => document.getElementById('loss-second-title')?.focus());
  };

  return <section className="loss-lab" aria-labelledby="loss-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="loss-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Are all wrong answers equally wrong?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>

    <p className="mt-3 max-w-2xl text-base">A food delivery took <strong>{ACTUAL_MINUTES} minutes</strong>. Here are two guesses about it. Neither one is right.</p>
    <p className="text-muted-foreground mt-2 max-w-2xl text-sm">Every number here describes a guess the model made. None of it is about you.</p>

    <div className="loss-guesses mt-4">
      <GuessCard eyebrow="First guess" guess={NEAR_GUESS} />
      <GuessCard eyebrow="Second guess" guess={guess}>
        <div className="mt-3">
          <label htmlFor="loss-guess" className="block text-sm font-medium">Move this guess closer to the {ACTUAL_MINUTES} minutes it took</label>
          <input
            id="loss-guess"
            type="range"
            min={0}
            max={MAX_GUESS}
            step={1}
            value={guess}
            onChange={event => setGuess(Number(event.target.value))}
            aria-valuetext={`Guess ${guess} minutes, ${now.exact ? 'right' : 'wrong'}, ${minutesOff(now.off)}`}
            className="loss-slider mt-2 w-full"
          />
        </div>
      </GuessCard>
    </div>

    <div aria-live="polite" aria-atomic="true" className="loss-readout mt-4">
      {!moved
        ? <>
          <p className="font-display text-xl">Both are wrong. One is nearly right.</p>
          <p className="mt-2 text-sm">“Right or wrong?” says exactly the same thing about a guess of {NEAR_GUESS} minutes and a guess of {FAR_GUESS} minutes. “How far off” says {minutesOff(judge(NEAR_GUESS, ACTUAL_MINUTES).off)} for one and {minutesOff(started.off)} for the other. Move the second guess and watch which of the two changes.</p>
        </>
        : now.exact
          ? <>
            <p className="font-display text-xl">Now it is not wrong at all.</p>
            <p className="mt-2 text-sm">Nothing off. This is the one guess with nothing left to improve, and it is the only point where “Right or wrong?” finally said something different.</p>
          </>
          : <>
            <p className="font-display text-xl">{closer ? 'Still wrong, but closer.' : 'Still wrong, and further away.'}</p>
            <p className="mt-2 text-sm">{FAR_GUESS} minutes was {minutesOff(started.off)}. {guess} minutes is {minutesOff(now.off)}. The guess is {now.direction === 'over' ? 'still too long' : 'now too short'}.</p>
            <p className="mt-2 text-sm">“Right or wrong?” has said <strong>Wrong</strong> the whole way. It cannot tell you that you are getting warmer, so on its own it gives a model nowhere to go. “How far off” changed with every step.</p>
          </>}
    </div>

    {!secondExample
      ? <div className="mt-5">
        <Button size="touch" variant="outline" onClick={openSecondExample}>Try another example <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">Four deliveries this time, and two different ways of adding the mistakes up.</p>
      </div>
      : <div className="mt-6">
        <h4 id="loss-second-title" tabIndex={-1} className="font-display text-xl outline-none">Four deliveries, two ways of counting</h4>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Each row is one delivery: how long it really took, and what the model guessed. Change a guess, or pick a ready-made set below, and watch both totals.</p>

        <ul className="mt-3 space-y-2">
          {rows.map((row, index) => {
            const miss = row.guess === null ? null : judge(row.guess, row.actual);
            return <li key={row.id} className="loss-row">
              <span className="loss-row-actual text-sm">Delivery {index + 1} took <strong className="font-mono tabular-nums">{row.actual} {MINUTES_UNIT}</strong></span>
              <NumberField
                id={`${row.id}-guess`}
                label="The model guessed"
                name={`Minutes the model guessed for delivery ${index + 1}, which took ${row.actual} minutes`}
                unit={MINUTES_UNIT}
                value={row.guess}
                max={MAX_MINUTES}
                step={1}
                className="loss-field"
                onChange={value => editGuess(row.id, value)}
              />
              <span className="loss-row-miss text-sm">{miss === null ? <span className="text-muted-foreground">No guess yet, so this delivery is left out.</span> : miss.exact ? 'Exactly right' : minutesOff(miss.off)}</span>
            </li>;
          })}
        </ul>

        <div className="mt-4">
          <p className="text-sm font-medium">Ready-made sets of guesses</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {GUESS_SETS.map(set => <Button key={set.label} type="button" size="touch" variant={setLabel === set.label ? 'default' : 'outline'} onClick={() => chooseSet(set)}>{set.label}</Button>)}
          </div>
          {setLabel && <p className="text-muted-foreground mt-2 text-sm">{GUESS_SETS.find(set => set.label === setLabel)?.note}</p>}
        </div>

        <div aria-live="polite" aria-atomic="true">
          {counting ? <>
            <div className="loss-measures mt-4">
              <div className="loss-measure">
                <p className="loss-measure-label">Count every minute the same</p>
                <strong className="loss-measure-value font-mono tabular-nums">{round(counting.everyMinuteEqually, 1)} {MINUTES_UNIT}</strong>
                <p className="text-muted-foreground mt-2 text-sm">How far off each guess was, averaged over the {counting.counted === 1 ? 'one delivery' : `${counting.counted} deliveries`}. Still minutes.</p>
              </div>
              <div className="loss-measure">
                <p className="loss-measure-label">Make big misses count more</p>
                <strong className="loss-measure-value font-mono tabular-nums">{round(counting.bigMissesCountMore, 1)}</strong>
                <p className="text-muted-foreground mt-2 text-sm">Each miss multiplied by itself first, then averaged. This one is a score, not a number of minutes.</p>
              </div>
            </div>
            {counting.allExact && <p className="mt-3 text-sm">Every guess matches. Both ways of counting agree there is nothing to improve — which is the one case where the choice between them does not matter.</p>}
            {counting.counted < rows.length && <p className="text-muted-foreground mt-3 text-sm">{rows.length - counting.counted} of the {rows.length} deliveries have no guess, so neither total includes them.</p>}
          </> : <p className="loss-readout mt-4">No guesses to measure yet. Fill in at least one, or pick a ready-made set.</p>}
        </div>

        {previous && counting && comparison && <div className="loss-compare mt-4">
          <p className="eyebrow">Before and after</p>
          <div className="loss-compare-grid mt-2">
            <div className="loss-compare-side">
              <p className="loss-measure-label">{previous.label}</p>
              <p className="mt-1 font-mono text-sm tabular-nums">{round(previous.counting.everyMinuteEqually, 1)} {MINUTES_UNIT} · score {round(previous.counting.bigMissesCountMore, 1)}</p>
            </div>
            <div className="loss-compare-side loss-compare-now">
              <p className="loss-measure-label">{setLabel ?? 'The set now on screen'}</p>
              <p className="mt-1 font-mono text-sm tabular-nums">{round(counting.everyMinuteEqually, 1)} {MINUTES_UNIT} · score {round(counting.bigMissesCountMore, 1)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm">{comparison.disagree === 'only-big-misses'
            ? <>Both sets are {round(counting.everyMinuteEqually, 1)} minutes off on average, so the first way of counting cannot choose between them. The second way {ratio === null ? 'separates them' : ratio > 1 ? `calls the set now on screen ${round(ratio, 1)} times worse` : `calls the earlier set ${round(1 / ratio, 1)} times worse`}, because one large miss, multiplied by itself, outweighs several small ones put together.</>
            : comparison.disagree === 'only-every-minute'
              ? <>The two sets score the same when big misses count more, but not when every minute counts the same. The two measures are ranking these guesses differently.</>
              : comparison.tiedOnEveryMinute && comparison.tiedOnBigMisses
                ? <>Both ways of counting give these two sets the same totals, so neither one has a reason to prefer either.</>
                : <>Both ways of counting moved, and both moved in the same direction. These two sets do not pull them apart — the first two ready-made sets do.</>}</p>
        </div>}

        {/* The name, only now that both measures are on screen with numbers in them. */}
        {counting && <div className="loss-name mt-6">
          <p className="eyebrow">The name for this number</p>
          <p className="mt-2 text-base">A <strong>loss</strong> is a number that measures how far off the model is. Choosing how to count mistakes changes what it tries to improve.</p>
          <p className="mt-2 text-base">Neither of the two above is more correct than the other. Counting every minute the same treats a delivery estimate that is 20 minutes out as four 5-minute misses put together. Making big misses count more says one badly wrong answer is worse than several slightly wrong ones. A person picks, and the training then works towards whichever was picked.</p>
          <p className="text-muted-foreground mt-2 text-sm">That is also where blind spots come from. Whatever the chosen number does not notice, the model has no reason to fix.</p>
        </div>}

        {counting && <div className="border-border mt-6 border-t pt-5">
          <p className="font-display text-xl">Why would “wrong by this much” be more useful than just “wrong”?</p>
          <p className="text-muted-foreground mt-2 text-sm">Explain it in your own words if you want to. Nothing you do in this panel changes a mark on your map; only an explanation you give yourself can do that.</p>
          <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
        </div>}
      </div>}

    <details className="text-muted-foreground mt-6 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p>One miss is <code>guess − actual</code>. The sign only says whether the guess was too long or too short, so both measures use the size of the miss and ignore the sign.</p>
        <p><strong>Count every minute the same.</strong> Take how far off each guess was, add those up, divide by how many guesses there were. The answer is in minutes. Statisticians call it the mean absolute error.</p>
        <p><strong>Make big misses count more.</strong> Multiply each miss by itself, add those up, divide by how many there were. Multiplying by itself is what makes a 20-minute miss count sixteen times a 5-minute one rather than four times. The answer is in minutes multiplied by minutes, which is not a length of time and is never printed here as one. Statisticians call it the mean squared error.</p>
        <p>Both are computed here in your browser, from the numbers on screen. Nothing is sent anywhere.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p>A low number here means these guesses were close to these four deliveries. It does not mean the model would do well on a delivery it has not seen, at a time of day nobody measured, or for a customer unlike these ones. A measure can only report on what it was given.</p>
        <p>The number also does not say what to change. It says how far off the model is now; working out which setting to move, and in which direction, is a separate step, and it is the next idea along on the map.</p>
        <p>Real systems rarely measure something as readable as minutes. A language model is scored on how surprised it was by the next piece of text, which is much harder to picture and works the same way: one number, chosen by a person, that the training then chases.</p>
        <p>The deliveries here are invented for this panel, not measured.</p>
      </div>
    </details>
  </section>;
}
