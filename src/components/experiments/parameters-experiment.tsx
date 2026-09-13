'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/experiments/number-field';
import { Input } from '@/components/ui/input';
import {
  describeChange,
  fitParams,
  hoursPhrase,
  INITIAL_HOURS,
  INITIAL_RENTAL_SET,
  MAX_DOLLARS,
  MAX_HOURS,
  money,
  parametersOf,
  priceFor,
  RAISED_PER_HOUR,
  RENTAL_SETS,
  round,
  ruleSentence,
  SUPPLIED,
  type ParamFit,
  type Params,
  type RentalSet,
} from '@/lib/experiments/parameters';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useParametersExperiment> };

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the two saved numbers, the customer's hours, or the fit.
 */
export function useParametersExperiment() {
  /**
   * The two saved numbers are held as fields that can genuinely be empty. A
   * cleared price is not a price of zero, so the estimate is withheld and the
   * panel says which number is missing — the same rule the predictor's rows
   * follow, applied to the rule itself.
   */
  const [start, setStart] = useState<number | null>(SUPPLIED.start);
  const [perHour, setPerHour] = useState<number | null>(SUPPLIED.perHour);
  const [hours, setHours] = useState<number | null>(INITIAL_HOURS);
  /** Where the three numbers stood before the latest change, for the sentence underneath. */
  const [previous, setPrevious] = useState<{ params: Params; hours: number } | null>(null);
  /** The first action has been taken, so the rest of the controls are worth showing. */
  const [changedSomething, setChangedSomething] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [setLabel, setSetLabel] = useState(INITIAL_RENTAL_SET.label);
  /**
   * A fit, and the rule as it stood when the fit was run, so the before and
   * after can sit side by side. Cleared when the past rentals change: a fit
   * belongs to the rentals it came from.
   */
  const [fit, setFit] = useState<{ before: Params; label: string; result: ParamFit } | null>(null);
  const [applied, setApplied] = useState(false);

  /**
   * The situation now, or null while one of the three numbers is missing.
   *
   * Memoised because the callbacks below snapshot it: rebuilt every render, it
   * would rebuild each of them on every keystroke as well.
   */
  const situation = useMemo(
    () => (start !== null && perHour !== null && hours !== null ? { params: { start, perHour }, hours } : null),
    [start, perHour, hours],
  );

  /*
   * Snapshot the last COMPLETE reading, not simply the last one.
   *
   * Clearing a field leaves no situation to compare against, and overwriting
   * the snapshot with nothing meant that typing the number back in produced no
   * sentence at all — the learner acted and the panel went quiet. Keeping the
   * last complete reading means a restored field is compared with what the
   * rule was actually doing before it was emptied.
   */
  const remember = useCallback(() => {
    setPrevious(current => situation ?? current);
    setChangedSomething(true);
  }, [situation]);

  const raiseRate = useCallback(() => {
    remember();
    setPerHour(RAISED_PER_HOUR);
    setFit(null);
    setApplied(false);
  }, [remember]);

  /*
   * A hand edit drops any fit on screen. The comparison below is a before and
   * an after of one rule; leaving it up beside a rule somebody has since
   * retyped would show a "before" that was never what the stand was using.
   */
  const editStart = useCallback((value: number | null) => {
    remember();
    setStart(value);
    setFit(null);
    setApplied(false);
  }, [remember]);

  const editPerHour = useCallback((value: number | null) => {
    remember();
    setPerHour(value);
    setFit(null);
    setApplied(false);
  }, [remember]);

  const editHours = useCallback((value: number | null) => {
    remember();
    setHours(value);
  }, [remember]);

  const chooseSet = useCallback((set: RentalSet) => {
    setSetLabel(set.label);
    setFit(null);
  }, []);

  const learn = useCallback(() => {
    if (!situation) return;
    const set = RENTAL_SETS.find(candidate => candidate.label === setLabel) ?? INITIAL_RENTAL_SET;
    setFit({ before: situation.params, label: set.label, result: fitParams(set.rentals) });
  }, [setLabel, situation]);

  const applyFit = useCallback(() => {
    if (!fit || fit.result.status !== 'fitted') return;
    remember();
    setStart(round(fit.result.params.start, 2));
    setPerHour(round(fit.result.params.perHour, 2));
    setApplied(true);
  }, [fit, remember]);

  const reset = useCallback(() => {
    setStart(SUPPLIED.start);
    setPerHour(SUPPLIED.perHour);
    setHours(INITIAL_HOURS);
    setPrevious(null);
    setChangedSomething(false);
    setFitting(false);
    setSetLabel(INITIAL_RENTAL_SET.label);
    setFit(null);
    setApplied(false);
  }, []);

  return {
    start, perHour, hours, previous, changedSomething, fitting, setLabel, fit, applied, situation,
    raiseRate, editStart, editPerHour, editHours, chooseSet, learn, applyFit, reset, setFitting,
  };
}

/** The two numbers the shop keeps, and the one the customer brings. */
function Kept({ params }: { params: Params }) {
  return <div className="parameters-kept mt-3">
    {parametersOf(params).map(entry => <span key={entry.key} className="parameters-number">
      <span className="parameters-number-label">{entry.name}</span>
      <strong className="font-mono tabular-nums">{money(entry.value)}</strong>
    </span>)}
  </div>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function ParametersExperiment({ onExplain, experiment }: Props) {
  const {
    start, perHour, hours, previous, changedSomething, fitting, setLabel, fit, applied, situation,
    raiseRate, editStart, editPerHour, editHours, chooseSet, learn, applyFit, reset, setFitting,
  } = experiment;

  const set = RENTAL_SETS.find(candidate => candidate.label === setLabel) ?? INITIAL_RENTAL_SET;
  const price = situation ? priceFor(situation.params, situation.hours) : null;
  const change = previous && situation ? describeChange(previous, situation) : null;
  const rateIsRaised = perHour === RAISED_PER_HOUR;
  /** The fit, with the rule it replaced, so the before and after can be read as one thing. */
  const fitted = fit && fit.result.status === 'fitted' ? { ...fit.result, before: fit.before } : null;
  const usesFitted = Boolean(fitted && situation && round(fitted.params.start, 2) === situation.params.start && round(fitted.params.perHour, 2) === situation.params.perHour);
  const missing = start === null ? 'a starting price' : perHour === null ? 'a price per hour' : hours === null ? 'a number of hours' : null;

  /** The sentence under the action, worked out from what actually moved. */
  const resultSentence = change === null || situation === null || price === null
    ? null
    : change.changed === 'parameters'
      ? `${hoursPhrase(situation.hours)} now costs ${money(price)}. We changed ${change.moved.length > 1 ? 'both saved numbers' : `one saved number, the ${change.moved[0].toLowerCase()}`}. The customer still wants ${hoursPhrase(situation.hours)}.`
      : change.changed === 'input'
        ? `${hoursPhrase(situation.hours)} costs ${money(price)}. The customer’s input changed. The two saved numbers are still ${money(situation.params.start)} and ${money(situation.params.perHour)}.`
        : change.changed === 'both'
          ? `${hoursPhrase(situation.hours)} costs ${money(price)}. A saved number and the customer’s input both changed.`
          : `${hoursPhrase(situation.hours)} still costs ${money(price)}. Nothing moved.`;

  const openFitting = () => {
    setFitting(true);
    requestAnimationFrame(() => document.getElementById('parameters-fit-title')?.focus());
  };

  return <section className="parameters-lab" aria-labelledby="parameters-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="parameters-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">When a model learns, what does it actually keep?</h3>
      </div>
      {changedSomething && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>

    <p className="mt-3 max-w-2xl text-base">A bike rental shop works out a price from one thing: how many hours you want the bike.</p>

    <div className="parameters-board mt-4">
      <div className="parameters-rule">
        <p className="eyebrow">What the shop keeps</p>
        <p className="font-display mt-1 text-xl">{situation ? ruleSentence(situation.params) : 'The rule needs both of its numbers.'}</p>
        {situation ? <Kept params={situation.params} /> : <p className="text-muted-foreground mt-3 text-sm">Type {missing} to read the rule again.</p>}
        <p className="text-muted-foreground mt-3 text-sm">This price rule is the model. The two saved numbers are its <strong className="text-foreground">parameters</strong>. {applied ? 'These two were worked out from past rentals below.' : 'These two were given to us for this example.'}</p>
      </div>

      {/*
        * The first action sits with the numbers it changes, and above what
        * those numbers produce. On a wide screen the rule and its button hold
        * the left column while the input and the estimate hold the right; at
        * 320px the same order simply stacks. Reading order and visual order are
        * the same at both widths, which is why this is grid placement rather
        * than `order`.
        */}
      <div className="parameters-action">
        <Button size="touch" onClick={raiseRate} disabled={rateIsRaised}>Change the price per hour to {money(RAISED_PER_HOUR)}</Button>
        {rateIsRaised && !changedSomething && <p className="text-muted-foreground mt-2 text-sm">The price per hour is already {money(RAISED_PER_HOUR)}.</p>}
      </div>

      <div className="parameters-flow">
        <div className="parameters-brought">
          <span className="parameters-number-label">This customer’s input</span>
          <strong className="font-mono tabular-nums">{hours === null ? '—' : hoursPhrase(hours)}</strong>
          <span className="text-muted-foreground mt-2 block text-xs">Not kept by the shop.</span>
        </div>
        <div className="parameters-estimate">
          <span className="parameters-number-label">Price for this rental</span>
          <strong className="font-mono tabular-nums">{price === null ? '—' : money(price)}</strong>
        </div>
      </div>
    </div>

    <p className="text-muted-foreground mt-3 max-w-2xl text-sm">This is a tiny teaching example, not a real trained model. What it keeps is the same kind of thing: numbers.</p>

    <div aria-live="polite" aria-atomic="true" className="mt-3">
      {situation === null
        ? <p className="parameters-result">No estimate while the rule is missing {missing}. Nothing has been put in its place.</p>
        : resultSentence ? <p className="parameters-result">{resultSentence}</p> : null}
    </div>

    {changedSomething && <div className="mt-5">
      <h4 className="font-display text-xl">Now change what the customer wants</h4>
      <p className="text-muted-foreground mt-1 text-sm">The two saved numbers stay where they are. Only the hours change.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <span className="min-w-[9rem] flex-1">
          <label htmlFor="parameters-hours" className="text-muted-foreground block text-2xs">Hours wanted</label>
          <input
            id="parameters-hours"
            type="range"
            min={0}
            max={MAX_HOURS}
            step={0.5}
            value={hours ?? 0}
            onChange={event => editHours(Number(event.target.value))}
            aria-valuetext={price === null ? `${hoursPhrase(hours ?? 0)}, no price yet` : `${hoursPhrase(hours ?? 0)}, price ${money(price)}`}
            className="parameters-slider mt-2 w-full"
          />
        </span>
        <span>
          <label htmlFor="parameters-hours-number" className="text-muted-foreground block text-2xs">or type it</label>
          <span className="mt-1 flex items-center gap-1.5">
            <Input
              id="parameters-hours-number"
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_HOURS}
              step={0.5}
              value={hours === null ? '' : String(hours)}
              onChange={event => {
                const raw = event.target.value;
                if (raw === '') return editHours(null);
                const parsed = Number(raw);
                editHours(Number.isFinite(parsed) ? Math.min(MAX_HOURS, Math.max(0, parsed)) : null);
              }}
              className="h-10 w-24 font-mono tabular-nums"
            />
            <span aria-hidden className="text-muted-foreground text-xs">hours</span>
          </span>
        </span>
      </div>

      <div className="parameters-adjust mt-4">
        <p className="text-sm font-medium">Change the saved numbers by hand</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <NumberField id="parameters-start" label="Starting price" name="Starting price in dollars, a saved number" unit="$" value={start} max={MAX_DOLLARS} onChange={editStart} />
          <NumberField id="parameters-per-hour" label="Price per hour" name="Price per hour in dollars, a saved number" unit="$" value={perHour} max={MAX_DOLLARS} onChange={editPerHour} />
        </div>
      </div>
    </div>}

    {changedSomething && !fitting && <div className="mt-5">
      <Button variant="outline" size="touch" onClick={openFitting}>How were these numbers chosen? <ArrowRight aria-hidden /></Button>
    </div>}

    {fitting && <div className="mt-6 border-t border-border pt-5">
      <h4 id="parameters-fit-title" tabIndex={-1} className="font-display text-xl outline-none">How were these numbers chosen?</h4>
      <p className="mt-2 max-w-2xl text-sm">Up to now, those two numbers were simply handed to you. A real shop would work them out from rentals it has already priced.</p>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm">The earlier predictor also learned a few numbers that shaped every new answer.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {RENTAL_SETS.map(candidate => <Button key={candidate.label} type="button" size="touch" variant={candidate.label === set.label ? 'default' : 'outline'} onClick={() => chooseSet(candidate)}>{candidate.label}</Button>)}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{set.note}</p>

      <ul className="parameters-rentals mt-3">
        {set.rentals.map((rental, index) => <li key={index} className="parameters-rental">
          <span className="font-mono tabular-nums">{hoursPhrase(rental.hours)}</span>
          <span className="text-muted-foreground">cost</span>
          <strong className="font-mono tabular-nums">{money(rental.price)}</strong>
        </li>)}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="touch" onClick={learn} disabled={!situation || fit?.label === set.label}>Work out the two numbers from these rentals</Button>
        {!situation && <p className="text-muted-foreground text-sm">Fill the rule’s numbers back in first.</p>}
      </div>

      <div aria-live="polite" aria-atomic="true" className="mt-3">
        {fit && fit.result.status === 'undetermined' ? <div className="parameters-refusal">
          <p className="font-display text-xl">No price per hour came out of that.</p>
          <p className="mt-2 text-sm">{fit.result.reason === 'same-length'
            ? 'Every rental here was two hours long. Nothing in them shows what one extra hour costs, so every price per hour fits them equally well.'
            : 'There are not enough past rentals to work a rule out from.'}</p>
          <p className="text-muted-foreground mt-2 text-sm">This experiment will not invent a number the rentals did not settle. Pick a set with rentals of different lengths.</p>
        </div> : fitted ? <div className="parameters-compare">
          <div className="parameters-rule-card">
            <p className="eyebrow">Before, the rule the shop was using</p>
            <p className="font-display mt-1 text-lg">{ruleSentence(fitted.before)}</p>
            <p className="text-muted-foreground mt-2 text-sm">{hours === null ? 'No hours set.' : `${hoursPhrase(hours)} → ${money(priceFor(fitted.before, hours))}`}</p>
          </div>
          <div className="parameters-rule-card parameters-rule-card-new">
            <p className="eyebrow">After, worked out from {set.rentals.length} past rentals</p>
            <p className="font-display mt-1 text-lg">{ruleSentence(fitted.params)}</p>
            <p className="text-muted-foreground mt-2 text-sm">{hours === null ? 'No hours set.' : `${hoursPhrase(hours)} → ${money(priceFor(fitted.params, hours))}`}</p>
          </div>
        </div> : null}
      </div>

      {fitted && <>
        <p className="parameters-result mt-3">Nobody typed either number. Both came out of the {set.rentals.length} past rentals. The customer’s hours were not part of that: they stayed at {hours === null ? 'whatever you set' : hoursPhrase(hours)} throughout.</p>
        <p className="mt-3 text-sm"><strong>The rule still keeps {parametersOf(fitted.params).length} numbers.</strong> {set.rentals.length} past rentals gave it more to fit, not more to keep. {fitted.exact ? 'It matches every past rental exactly.' : `On average it is ${money(fitted.averageMiss)} away from what a past rental really cost.`}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="touch" variant="outline" onClick={applyFit} disabled={usesFitted}>Use these numbers instead</Button>
          <p className="text-muted-foreground text-sm">{usesFitted ? 'The shop is using these two numbers now.' : 'This replaces the two saved numbers at the top.'}</p>
        </div>
      </>}

      {fitted && <div className="parameters-name mt-5">
        <p className="eyebrow">The word for those numbers</p>
        <p className="font-display mt-1 text-xl">Two numbers here. Billions in a large model.</p>
        <p className="mt-2 text-sm">A large model keeps its parameters the same way: as numbers, used in arithmetic when your words go through it. No single number is a stored fact.</p>
        <p className="mt-2 text-sm">They are not empty, though. Training pushes information from the examples into them, and researchers have pulled pieces of training text back out of trained models.</p>
        <p className="mt-2 text-sm">More numbers means a model <em>can</em> fit more. It does not mean better answers on its own. What it learned from, and how, matters at least as much, and a smaller model trained on better material often does better.</p>
      </div>}
    </div>}

    {changedSomething && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">The price changed twice, for two different reasons. What does the shop keep between customers, and what does it do with it?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Changing numbers here leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">The arithmetic, if you want it</summary>
      <div className="space-y-2 pt-2">
        <p>The rule is <code>price = starting price + price per hour × hours</code>. With the numbers on screen{situation ? <> that is <span className="font-mono">{money(situation.params.start)} + {money(situation.params.perHour)} × {round(situation.hours, 2)} = {money(priceFor(situation.params, situation.hours))}</span></> : ' it needs both saved numbers first'}.</p>
        <p>Working the two numbers out from past rentals uses the same least-squares fit as the predictor experiment: the pair that makes the total of the squared misses as small as it can be. When every rental is the same length there is nothing in the hours to divide by, which is why the panel says nothing was settled instead of printing whatever came out.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p>A real model has billions of parameters arranged in layers, no formula that solves them outright, and they are nudged into place step by step instead. What it keeps between one input and the next is still the same kind of thing: numbers, and nothing else.</p>
        <p>Nor are all of them always in play. Some large models are built so that only a fraction of their saved numbers is used on any one step.</p>
        <p>The rental prices here are invented for this panel, not measured at a real shop. Counting parameters is also a poor guide to what a model can do, which is part of why the number gets quoted so often: it is easy to quote.</p>
      </div>
    </details>
  </section>;
}
