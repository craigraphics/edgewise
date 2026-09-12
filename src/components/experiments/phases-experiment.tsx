'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/experiments/number-field';
import {
  answerWith,
  compare,
  describeRule,
  FRESH_ROW_ID,
  INITIAL_QUERY,
  initialRows,
  learn,
  learnability,
  PAST_DELIVERIES,
  type Choice,
  type Learned,
} from '@/lib/experiments/phases';
import { DISTANCE_UNIT, MAX_DISTANCE, MAX_MINUTES, MINUTES_UNIT, round, type ExampleRow } from '@/lib/experiments/regression';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof usePhasesExperiment> };

/** The opening rule really is learned from the opening deliveries, not written down. */
function openingRule(): Learned {
  const learned = learn(initialRows(), null);
  if (!learned) throw new Error('the opening deliveries must determine a rule');
  return learned;
}

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the rule, the deliveries, or the distance being asked about.
 */
export function usePhasesExperiment() {
  const [rows, setRows] = useState<ExampleRow[]>(initialRows);
  /**
   * The rule is stored, and every answer on screen is read out of it. That is the
   * whole point of this node: editing the deliveries below cannot move an answer,
   * because the answer never looks at them.
   */
  const [learned, setLearned] = useState<Learned>(openingRule);
  const [previous, setPrevious] = useState<Learned | null>(null);
  const [queryDistance, setQueryDistance] = useState(INITIAL_QUERY);
  /** Answers read out of the rule now in force, starting with the one on screen. */
  const [answers, setAnswers] = useState(1);
  const [teaching, setTeaching] = useState(false);
  /**
   * The distance captured when learning happened. While a comparison is open the
   * distance is held there, so the only thing that differs between the two
   * answers is the rule.
   */
  const [comparing, setComparing] = useState<number | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);

  const ask = useCallback((distance: number) => {
    if (distance === queryDistance) return;
    setQueryDistance(distance);
    setAnswers(count => count + 1);
  }, [queryDistance]);

  const edit = useCallback((id: string, field: 'distance' | 'minutes', value: number | null) => {
    setRows(current => current.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  }, []);

  const learnAgain = useCallback(() => {
    const next = learn(rows, learned);
    if (!next) return;
    setPrevious(learned);
    setLearned(next);
    setComparing(queryDistance);
    setAnswers(1);
    setChoice(null);
  }, [learned, queryDistance, rows]);

  const reset = useCallback(() => {
    setRows(initialRows());
    setLearned(openingRule());
    setPrevious(null);
    setQueryDistance(INITIAL_QUERY);
    setAnswers(1);
    setTeaching(false);
    setComparing(null);
    setChoice(null);
  }, []);

  return {
    rows, learned, previous, queryDistance, answers, teaching, comparing, choice,
    ask, edit, learnAgain, reset, setTeaching, setComparing, setChoice,
  };
}

const LEARN_BLOCKED: Record<'unchanged' | 'too-few' | 'no-spread', string> = {
  unchanged: 'These are the same deliveries it already learned from, so there is nothing new in them. Change one of the times to give it something new.',
  'too-few': 'It needs at least two deliveries with both numbers filled in. Fill one back in to learn again.',
  'no-spread': 'Every delivery with both numbers is the same distance away, so these cannot show what an extra kilometre does.',
};

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function PhasesExperiment({ onExplain, experiment }: Props) {
  const { rows, learned, previous, queryDistance, answers, teaching, comparing, choice, ask, edit, learnAgain, reset, setTeaching, setComparing, setChoice } = experiment;

  const rule = describeRule(learned, DISTANCE_UNIT);
  const answer = answerWith(learned, queryDistance);
  const ready = learnability(rows, learned);
  const locked = comparing !== null;
  const comparison = previous && comparing !== null ? compare(previous, learned, comparing) : null;
  const taught = learned.round > 1;
  const fresh = rows.find(row => row.id === FRESH_ROW_ID);

  const openTeaching = () => {
    setTeaching(true);
    requestAnimationFrame(() => document.getElementById('phases-teaching-title')?.focus());
  };

  return <section className="phases-lab" aria-labelledby="phases-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="phases-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">If the answer changes, did the model learn something new?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>
    <p className="mt-3 max-w-2xl text-base">The same food deliveries as before. A restaurant has a rule for estimating when an order will arrive, worked out from four past deliveries. That rule is finished. Now a new customer orders.</p>

    {/* The rule, in words. Two unexplained numbers are not a rule anybody can read. */}
    <div className="phases-rule mt-5">
      <p className="eyebrow">The rule it has already learned</p>
      <p className="font-display mt-2 text-xl">{rule}.</p>
      <p className="text-muted-foreground mt-2 text-sm">{taught
        ? `Worked out ${learned.round === 2 ? 'twice' : `${learned.round} times`} now, most recently from the deliveries you edited below.`
        : 'Worked out once, from four past deliveries. Nobody typed either number.'}</p>
    </div>

    {/* The first action, with its result beside it. */}
    <div className="mt-5">
      <h4 className="font-display text-xl">Ask it about a new customer</h4>
      <p className="text-muted-foreground mt-1 text-sm">Change how far away the customer is. The estimate is beside it.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <span className="min-w-[9rem] flex-1">
          <label htmlFor="phases-query" className="text-muted-foreground block text-2xs">How far away is the customer?</label>
          <input
            id="phases-query"
            type="range"
            min={0}
            max={MAX_DISTANCE}
            step={0.5}
            value={queryDistance}
            disabled={locked}
            aria-describedby={locked ? 'phases-locked' : undefined}
            onChange={event => ask(Number(event.target.value))}
            aria-valuetext={answer === null
              ? `Customer ${queryDistance} ${DISTANCE_UNIT} away`
              : `Customer ${queryDistance} ${DISTANCE_UNIT} away, estimated arrival ${round(answer, 1)} minutes`}
            className="phases-slider mt-2 w-full"
          />
        </span>
        <span>
          <label htmlFor="phases-query-number" className="text-muted-foreground block text-2xs">or type it</label>
          <span className="mt-1 flex items-center gap-1.5">
            <Input
              id="phases-query-number"
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_DISTANCE}
              step={0.5}
              value={String(queryDistance)}
              disabled={locked}
              aria-describedby={locked ? 'phases-locked' : undefined}
              onChange={event => ask(Math.min(MAX_DISTANCE, Math.max(0, Number(event.target.value) || 0)))}
              className="h-10 w-24 font-mono tabular-nums"
            />
            <span aria-hidden className="text-muted-foreground text-xs">{DISTANCE_UNIT}</span>
          </span>
        </span>
      </div>

      <div className="phases-readout mt-3">
        <div className="phases-values">
          <span className="phases-value">
            <span className="phases-value-label">Customer distance</span>
            <strong className="font-mono tabular-nums">{queryDistance} {DISTANCE_UNIT}</strong>
          </span>
          <ArrowRight className="phases-arrow" aria-hidden />
          <span className="phases-value">
            <span className="phases-value-label">Estimated arrival</span>
            <strong className="font-mono tabular-nums">{answer === null ? '—' : `${round(answer, 1)} ${MINUTES_UNIT}`}</strong>
          </span>
        </div>
        {/* Never tell somebody to move a control that is locked while they compare. */}
        {locked
          ? <p className="mt-3 text-sm">That is what the new rule says at the distance you were already asking about. Both answers are side by side below.</p>
          : answers > 1
            ? <>
              <p className="font-display mt-3 text-xl">New distance. New answer. Same rule.</p>
              <p className="mt-2 text-sm">That makes {answers} answers read out of the one rule above since it last learned anything. Nothing about the rule changed on any of them.</p>
            </>
            : <p className="mt-3 text-sm">Move the slider, or type a distance, then look back at the rule above to see whether anything about it changed.</p>}
      </div>

      {locked && <p id="phases-locked" className="text-muted-foreground mt-3 text-sm">The distance is held at {comparing} {DISTANCE_UNIT} while you compare the two rules below, so the only thing that differs is what the model learned from.</p>}
    </div>

    {/* The second action, behind a button, so the first screen carries one thing to do. */}
    {!teaching
      ? <div className="mt-5">
        {answers > 2 && <p className="text-muted-foreground mb-3 max-w-2xl text-sm">Changing the distance asks a new question. It does not hand the model anything new to learn from. To do that, change the deliveries the rule came from.</p>}
        <Button size="touch" variant="outline" onClick={openTeaching}>Teach it with another delivery <ArrowRight aria-hidden /></Button>
      </div>
      : <div className="mt-6">
        <h4 id="phases-teaching-title" tabIndex={-1} className="font-display text-xl outline-none">What it learned from</h4>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Change how long one past delivery took, or fill in a delivery it has never seen. Nothing about the rule moves until you press Learn again.</p>

        <ul className="mt-3 space-y-2">
          {/* The first four rows are the past deliveries, in the order `initialRows` builds them, so the index finds what this one started as. */}
          {rows.map((row, index) => {
            if (row.id === FRESH_ROW_ID) return null;
            const original = PAST_DELIVERIES[index];
            return <li key={row.id} className="phases-row">
              <span className="text-sm">A customer <strong className="font-mono tabular-nums">{row.distance} {DISTANCE_UNIT}</strong> away</span>
              <NumberField
                id={`${row.id}-minutes`}
                label="Took this many minutes"
                name={`Minutes the delivery to the customer ${row.distance} ${DISTANCE_UNIT} away took`}
                unit={MINUTES_UNIT}
                value={row.minutes}
                max={MAX_MINUTES}
                step={1}
                className="phases-field"
                onChange={value => edit(row.id, 'minutes', value)}
              />
              {original && row.minutes !== original.minutes && <span className="text-muted-foreground w-full text-xs">You changed this from {original.minutes} {MINUTES_UNIT}.</span>}
            </li>;
          })}
          {fresh && <li className="phases-row phases-row-fresh">
            <span className="w-full text-sm">A delivery it has never seen <span className="text-muted-foreground">(optional)</span></span>
            <NumberField id="phases-fresh-distance" label="Customer distance" name="Distance of the delivery it has never seen" unit={DISTANCE_UNIT} value={fresh.distance} max={MAX_DISTANCE} className="phases-field" onChange={value => edit(FRESH_ROW_ID, 'distance', value)} />
            <NumberField id="phases-fresh-minutes" label="Took this many minutes" name="Minutes the delivery it has never seen took" unit={MINUTES_UNIT} value={fresh.minutes} max={MAX_MINUTES} step={1} className="phases-field" onChange={value => edit(FRESH_ROW_ID, 'minutes', value)} />
          </li>}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="touch" onClick={learnAgain} disabled={!ready.ok}>Learn again <ArrowRight aria-hidden /></Button>
          <p className={cn('max-w-lg text-sm', ready.ok ? 'font-medium' : 'text-muted-foreground')}>
            {ready.ok ? 'Ready. This works the rule out again from the deliveries above, and replaces it.' : LEARN_BLOCKED[ready.reason]}
          </p>
        </div>

        <div aria-live="polite" aria-atomic="true">
          {comparison && <div className="phases-compare mt-4">
            <p className="eyebrow">Before and after</p>
            <p className="font-display mt-2 text-xl">This time the rule itself changed.</p>
            <div className="phases-compare-grid mt-3">
              <div className="phases-compare-side">
                <p className="phases-value-label">The rule before</p>
                <p className="mt-1 text-sm">{describeRule(previous, DISTANCE_UNIT)}.</p>
                <p className="mt-2 font-mono text-sm tabular-nums">{round(comparison.before, 1)} {MINUTES_UNIT} at {comparison.distance} {DISTANCE_UNIT}</p>
              </div>
              <div className="phases-compare-side phases-compare-now">
                <p className="phases-value-label">The rule now</p>
                <p className="mt-1 text-sm">{rule}.</p>
                <p className="mt-2 font-mono text-sm tabular-nums">{round(comparison.after, 1)} {MINUTES_UNIT} at {comparison.distance} {DISTANCE_UNIT}</p>
              </div>
            </div>
            <p className="mt-3 text-sm">{comparison.direction === 'same'
              ? `At ${comparison.distance} ${DISTANCE_UNIT} the two rules happen to agree, so the answer did not move. They are still different rules, and they part company at other distances.`
              : `Same customer, same ${comparison.distance} ${DISTANCE_UNIT}, and the answer is ${round(comparison.gap, 1)} ${MINUTES_UNIT} ${comparison.direction}. The question did not change. What the model learned from did, so the rule did too.`}</p>
            <Button className="mt-3" size="touch" variant="outline" onClick={() => setComparing(null)}>Change the distance again</Button>
          </div>}
        </div>
      </div>}

    {/* The optional question, asked only once both kinds of change are on screen. */}
    {taught && <div className="mt-6">
      <p className="font-display text-xl">Which change gave the model something new to learn from?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="touch" variant={choice === 'distance' ? 'default' : 'outline'} onClick={() => setChoice('distance')}>Changing the customer’s distance</Button>
        <Button size="touch" variant={choice === 'examples' ? 'default' : 'outline'} onClick={() => setChoice('examples')}>Changing the past deliveries</Button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {choice && <p className="mt-3 max-w-2xl text-sm">{choice === 'examples'
          ? 'That is the one. The past deliveries are what the rule is worked out from, so changing one of them changes the rule. The distance is only the question being asked.'
          : 'Changing the distance did change the answer, and that is worth noticing. But the rule stayed exactly as it was, so nothing about the model was different afterwards. The change that gave it something new was editing the past deliveries.'}</p>}
      </div>
    </div>}

    {/* The names, only now that the difference between the two is on screen. */}
    {taught && <div className="phases-names mt-6">
      <p className="eyebrow">Two names for what you just did</p>
      <p className="mt-2 text-base">Working the rule out from examples is called <strong>training</strong>. Reading an answer out of the finished rule is called <strong>inference</strong>. You have trained it {learned.round === 2 ? 'twice' : `${learned.round} times`}, and read answers out of it many more times than that.</p>
      <p className="mt-2 text-base">This is why a chatbot that seems to remember what you said a minute ago has not learned it. Your earlier words are sent in again as part of the question, the way a distance is here. The rule reading them is the same rule as before.</p>
      <p className="text-muted-foreground mt-2 text-sm">This is the common setup, not a law. Models are retrained later on new data, and some are handed extra information at the moment you ask. What does not happen is a deployed model quietly rewriting itself from your conversation as it goes.</p>
    </div>}

    {taught && <div className="border-border mt-6 border-t pt-5">
      <p className="font-display text-xl">When the answer changes, what has actually changed — the question, or the rule? How can you tell?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Nothing you do in this panel changes a mark on your map; only an explanation you give yourself can do that.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="text-muted-foreground mt-6 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p>The rule has the shape <code>minutes = start + rate × distance</code>. <strong>Learning</strong> looks at every past delivery at once and picks the start and the rate whose estimates come closest to the observed times overall, with bigger misses counting for more. That is the only step that writes those two numbers.</p>
        <p><strong>Using</strong> the rule puts a distance into it and reads the answer out. The two numbers are not touched, which is why this panel can read a thousand answers out of one rule and leave it exactly as it was.</p>
        <p>Both steps happen here in your browser. The fit is the same ordinary least squares as the predictor experiment on the previous idea — this one is about when that step runs, not how.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p>Two numbers, learned in a millisecond. A large language model has hundreds of billions of them, and working them out takes weeks of computing that costs millions. That asymmetry is why the two phases are separated in practice: the expensive step happens once, and the cheap step happens for every person who asks.</p>
        <p>Real systems are not frozen for ever either. They get retrained or fine-tuned on new data, a new version replaces the old one, and some are given documents or stored notes at the moment you ask. Those are all deliberate acts by the people running the system, and each one is a training or retrieval step rather than the model learning from you mid-sentence.</p>
        <p>The deliveries here are invented for this panel, not measured.</p>
      </div>
    </details>
  </section>;
}
