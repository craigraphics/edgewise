'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  curveAt,
  DATASETS,
  describeLine,
  evaluate,
  INITIAL_DATASET,
  onNewDeliveries,
  round,
  timesFurther,
  type Dataset,
  type Delivery,
  type Outcome,
  type Score,
} from '@/lib/experiments/generalization';
import { DISTANCE_UNIT, MINUTES_UNIT } from '@/lib/experiments/regression';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useGeneralizationExperiment> };

/** "3.0 minutes off", and "nothing off" when there is genuinely nothing. */
function offPhrase(score: Score): string {
  if (score.allExact) return 'nothing off';
  const shown = score.meanOff.toFixed(1);
  return `${shown === '1.0' ? '1 minute' : `${shown} minutes`} off`;
}

const oneDecimal = (value: number) => value.toFixed(1);

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets which deliveries are on screen or whether the new ones have been
 * tried.
 */
export function useGeneralizationExperiment() {
  const [dataset, setDataset] = useState<Dataset>(INITIAL_DATASET);
  const [revealed, setRevealed] = useState(false);
  const [moreExamples, setMoreExamples] = useState(false);

  /**
   * Switching deliveries keeps the new ones on screen. Having already seen what
   * the button does, re-earning the reveal on every switch would put a step in
   * front of the comparison the other datasets exist to make.
   */
  const chooseDataset = useCallback((next: Dataset) => setDataset(next), []);

  const reset = useCallback(() => {
    setDataset(INITIAL_DATASET);
    setRevealed(false);
    setMoreExamples(false);
  }, []);

  return { dataset, revealed, moreExamples, chooseDataset, setRevealed, setMoreExamples, reset };
}

/**
 * The drawing. Past deliveries are filled dots, the two rules are two strokes,
 * and deliveries neither rule has seen are hollow squares — three different
 * things drawn three different ways, and the gap between a square and a stroke
 * is the miss.
 *
 * Both rules are drawn only across the distances they were fitted over. Reading
 * either one far outside that range is a different failure from the one this
 * panel is about, and drawing it would invite the wrong explanation.
 *
 * Optional support: every value here is also printed in the lists below, so
 * nothing depends on reading the picture.
 */
function Plot({ dataset, outcome, revealed }: { dataset: Dataset; outcome: Outcome; revealed: boolean }) {
  const width = 320;
  const height = 200;
  const pad = { left: 34, right: 12, top: 12, bottom: 26 };
  const shown: readonly Delivery[] = revealed ? [...dataset.past, ...dataset.fresh] : dataset.past;
  const low = Math.min(...dataset.past.map(d => d.distance));
  const high = Math.max(...dataset.past.map(d => d.distance));
  const xMax = Math.max(...shown.map(d => d.distance)) * 1.12;
  const yMax = Math.max(...shown.map(d => d.minutes), ...(outcome.curvePast?.answers ?? []), ...(revealed ? outcome.curveFresh?.answers ?? [] : [])) * 1.18;
  const px = (x: number) => pad.left + (x / xMax) * (width - pad.left - pad.right);
  const py = (y: number) => height - pad.bottom - (y / yMax) * (height - pad.top - pad.bottom);

  const steps = 72;
  const path = (at: (d: number) => number | null) => {
    const points: string[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const distance = low + ((high - low) * i) / steps;
      const minutes = at(distance);
      if (minutes === null || !Number.isFinite(minutes)) return null;
      points.push(`${i === 0 ? 'M' : 'L'}${px(distance).toFixed(2)} ${py(minutes).toFixed(2)}`);
    }
    return points.join(' ');
  };

  const linePath = outcome.rules.lineRule ? path(outcome.rules.lineRule) : null;
  const curvePath = outcome.rules.curveRule ? path(distance => curveAt(outcome.rules.curve, distance)) : null;

  return <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={
    revealed
      ? `A chart of ${dataset.past.length} past deliveries with both rules drawn through them, and ${dataset.fresh.length} new deliveries neither rule was built from. Every value is listed in the tables on this page.`
      : `A chart of ${dataset.past.length} past deliveries with both rules drawn through them. Every value is listed in the lists on this page.`
  }>
    <defs><clipPath id="generalization-plot"><rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} /></clipPath></defs>
    <line x1={pad.left} y1={py(0)} x2={width - pad.right} y2={py(0)} stroke="var(--border)" />
    <line x1={pad.left} y1={pad.top} x2={pad.left} y2={py(0)} stroke="var(--border)" />
    <text x={pad.left} y={height - 6} fontSize={9} fill="var(--muted-foreground)">0</text>
    <text x={width - pad.right} y={height - 6} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">{round(xMax, 0)} {DISTANCE_UNIT}</text>
    <text x={pad.left - 5} y={pad.top + 8} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">{round(yMax, 0)}</text>
    <text x={pad.left - 5} y={py(0)} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">0</text>

    <g clipPath="url(#generalization-plot)">
      {linePath && <path d={linePath} fill="none" stroke="var(--band-learning)" strokeWidth={2.25} />}
      {curvePath && <path d={curvePath} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 3" />}
      {dataset.past.map(delivery => <circle key={`past-${delivery.distance}`} cx={px(delivery.distance)} cy={py(delivery.minutes)} r={4} fill="var(--foreground)" />)}
      {revealed && dataset.fresh.map(delivery => <rect
        key={`fresh-${delivery.distance}`}
        x={px(delivery.distance) - 4.5} y={py(delivery.minutes) - 4.5} width={9} height={9}
        fill="var(--surface-0)" stroke="var(--foreground)" strokeWidth={2}
      />)}
    </g>
  </svg>;
}

/** A swatch drawn the way the chart draws that rule, so the key sits with the rule. */
function Swatch({ kind }: { kind: 'line' | 'curve' }) {
  return <svg width={26} height={10} aria-hidden className="shrink-0">
    {kind === 'line'
      ? <line x1={1} y1={5} x2={25} y2={5} stroke="var(--band-learning)" strokeWidth={2.25} />
      : <path d="M1 8 Q7 -2 13 5 T25 3" fill="none" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 3" />}
  </svg>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function GeneralizationExperiment({ onExplain, experiment }: Props) {
  const { dataset, revealed, moreExamples, chooseDataset, setRevealed, setMoreExamples, reset } = experiment;
  const outcome = evaluate(dataset);
  const { linePast, lineFresh, curvePast, curveFresh } = outcome;
  const ruleSentence = describeLine(outcome.rules.line, DISTANCE_UNIT);
  const verdict = onNewDeliveries(outcome);
  const ratio = timesFurther(outcome);
  /**
   * The past delivery the straight line misses by most: the one the flexible
   * rule had to bend furthest to reach. Named from the arithmetic rather than
   * written into the copy, so it stays true if the deliveries are ever edited.
   */
  const oddOne = linePast && !linePast.allExact
    ? dataset.past.map((delivery, index) => ({ distance: delivery.distance, off: linePast.misses[index] }))
      .reduce((worst, candidate) => (candidate.off > worst.off ? candidate : worst))
    : null;

  const openMore = () => {
    setMoreExamples(true);
    requestAnimationFrame(() => document.getElementById('generalization-more-title')?.focus());
  };

  const reveal = () => {
    setRevealed(true);
    requestAnimationFrame(() => document.getElementById('generalization-new-title')?.focus());
  };

  return <section className="generalization-lab" aria-labelledby="generalization-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="generalization-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Does getting every past delivery right mean it will get the next one right?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>

    <p className="mt-3 max-w-2xl text-base">A restaurant has {dataset.past.length} past deliveries: how far each customer was, and how long the food took. Two rules were worked out from those {dataset.past.length} deliveries, and from nothing else.</p>

    <div className="mt-4">
      <p className="text-sm font-medium">The past deliveries both rules were built from</p>
      <ul className="generalization-chips mt-2">
        {dataset.past.map(delivery => <li key={delivery.distance} className="generalization-chip font-mono text-xs tabular-nums">{delivery.distance} {DISTANCE_UNIT} → {delivery.minutes} {MINUTES_UNIT}</li>)}
      </ul>
    </div>

    <div className="generalization-rules mt-4">
      <div className="generalization-rule">
        <p className="eyebrow inline-flex items-center gap-2"><Swatch kind="line" />A simple rule</p>
        <p className="mt-2 text-sm">One straight line. It cannot bend, so it settles for the line that comes closest to all of them at once.</p>
        {ruleSentence && <p className="mt-2 font-mono text-xs tabular-nums">{ruleSentence}.</p>}
        <p className="generalization-rule-off mt-3">On the past deliveries: <strong>{linePast ? offPhrase(linePast) : 'nothing to measure'}</strong> on average.</p>
      </div>
      <div className="generalization-rule">
        <p className="eyebrow inline-flex items-center gap-2"><Swatch kind="curve" />A rule that follows them closely</p>
        <p className="mt-2 text-sm">A curve free to bend as much as it needs to, so it can pass through every past delivery instead of settling.</p>
        <p className="mt-2 font-mono text-xs tabular-nums">Bends through all {dataset.past.length} of them.</p>
        <p className="generalization-rule-off mt-3">On the past deliveries: <strong>{curvePast ? offPhrase(curvePast) : 'nothing to measure'}</strong>{curvePast?.allExact ? ' — every one exactly right' : ' on average'}.</p>
      </div>
    </div>

    <Plot dataset={dataset} outcome={outcome} revealed={revealed} />

    {!revealed && <div className="mt-4">
      <Button size="touch" onClick={reveal}>Try both rules on new deliveries <ArrowRight aria-hidden /></Button>
      <p className="mt-2 max-w-2xl text-sm">{curvePast?.allExact
        ? `One rule matched every past delivery. Does that tell you how it will do on the next one?`
        : `Both rules were built from those ${dataset.past.length} deliveries. Neither has seen anything else.`}</p>
    </div>}

    {revealed && <div className="mt-6">
      <h4 id="generalization-new-title" tabIndex={-1} className="font-display text-xl outline-none">{dataset.fresh.length} deliveries neither rule has seen</h4>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">These happened after the rules were worked out. Neither rule was built from them, and looking at them here changes nothing about either rule.</p>

      <ul className="mt-3 space-y-2">
        {dataset.fresh.map((delivery, index) => <li key={delivery.distance} className="generalization-row">
          <span className="generalization-row-fact text-sm">A customer <strong className="font-mono tabular-nums">{delivery.distance} {DISTANCE_UNIT}</strong> away. The food took <strong className="font-mono tabular-nums">{delivery.minutes} {MINUTES_UNIT}</strong>.</span>
          <span className="generalization-said">
            <span className="generalization-said-label inline-flex items-center gap-1.5"><Swatch kind="line" />Simple rule</span>
            <strong className="font-mono tabular-nums">{lineFresh ? oneDecimal(lineFresh.answers[index]) : '—'} {MINUTES_UNIT}</strong>
            <span className="text-muted-foreground text-xs">{lineFresh ? (lineFresh.misses[index] < 0.05 ? 'exactly right' : `${oneDecimal(lineFresh.misses[index])} off`) : ''}</span>
          </span>
          <span className="generalization-said">
            <span className="generalization-said-label inline-flex items-center gap-1.5"><Swatch kind="curve" />Close-following rule</span>
            <strong className="font-mono tabular-nums">{curveFresh ? oneDecimal(curveFresh.answers[index]) : '—'} {MINUTES_UNIT}</strong>
            <span className="text-muted-foreground text-xs">{curveFresh ? (curveFresh.misses[index] < 0.05 ? 'exactly right' : `${oneDecimal(curveFresh.misses[index])} off`) : ''}</span>
          </span>
        </li>)}
      </ul>

      <div aria-live="polite" aria-atomic="true">
        {/*
          * The 2x2. Each value also carries its own column heading inline,
          * hidden with `display: none` above 460px, because below that the
          * heading row is dropped and each value becomes a label-left,
          * value-right row instead.
          *
          * A real span switched with `display`, rather than `sr-only` or a
          * `::before`: exactly one label is in the accessibility tree at each
          * width, and this project has already paid for an `sr-only` inside a
          * scrolling pane escaping the shell's clip and adding page scroll.
          */}
        <div className="generalization-scores mt-4">
          <p className="generalization-score-head" />
          <p className="generalization-score-head">On the past deliveries</p>
          <p className="generalization-score-head">On the new ones</p>

          <p className="generalization-score-rule inline-flex items-center gap-2"><Swatch kind="line" />Simple rule</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">On the past deliveries</span>{linePast ? offPhrase(linePast) : '—'}</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">On the new ones</span>{lineFresh ? offPhrase(lineFresh) : '—'}</p>

          <p className="generalization-score-rule inline-flex items-center gap-2"><Swatch kind="curve" />Close-following rule</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">On the past deliveries</span>{curvePast ? offPhrase(curvePast) : '—'}</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">On the new ones</span>{curveFresh ? offPhrase(curveFresh) : '—'}</p>
        </div>

        <div className="generalization-readout mt-4">
          {verdict === 'line-better' ? <>
            <p className="font-display text-xl">The rule that matched the past best did worst on the new ones.</p>
            <p className="mt-2 text-sm">The close-following rule was {curvePast?.allExact ? 'exactly right on every past delivery' : `${curvePast && offPhrase(curvePast)} on the past deliveries`}, and {curveFresh && offPhrase(curveFresh)} on the {dataset.fresh.length} it had never seen. The straight line was {linePast && offPhrase(linePast)} on the past deliveries and {lineFresh && offPhrase(lineFresh)} on the new ones{ratio === null ? '' : `, which is ${oneDecimal(ratio)} times closer`}.</p>
            <p className="mt-2 text-sm">It matched the old delays closely, but those delays did not repeat. {oddOne && `The ${oddOne.distance} ${DISTANCE_UNIT} delivery sits ${oneDecimal(oddOne.off)} minutes off the straight line — bending to pass through it meant bending away from everything near it.`}</p>
          </> : verdict === 'curve-better' ? <>
            <p className="font-display text-xl">This time, following the past deliveries closely helped.</p>
            <p className="mt-2 text-sm">Here delivery time genuinely does not rise in a straight line, so the extra bend was picking up a real shape rather than a chance delay. The close-following rule was {curveFresh && offPhrase(curveFresh)} on the new deliveries; the straight line was {lineFresh && offPhrase(lineFresh)}{ratio === null ? '' : `, about ${oneDecimal(ratio)} times further`}.</p>
            <p className="mt-2 text-sm">A more detailed rule is not worse by nature. What went wrong in the first example was following something that was not going to happen again.</p>
          </> : <>
            <p className="font-display text-xl">Here both rules do the same thing.</p>
            <p className="mt-2 text-sm">These past deliveries have no chance delays in them at all, so there is nothing for the flexible rule to chase. Free to bend, it comes out straight, and both rules answer identically on deliveries neither has seen.</p>
            <p className="mt-2 text-sm">Following the examples closely costs nothing when the examples contain nothing but the pattern. The cost appears when they also contain chance.</p>
          </>}
        </div>
      </div>

      {/* The names, only now that both numbers are on screen. */}
      <div className="generalization-name mt-6">
        <p className="eyebrow">The names for this</p>
        <p className="mt-2 text-base">The past deliveries a rule is built from are its <strong>training data</strong>. Keeping some deliveries back and only trying them afterwards is a <strong>held-out</strong> or <strong>test</strong> set, and it is the ordinary way anyone finds out whether a rule learned the pattern or the examples.</p>
        <p className="mt-2 text-base">Matching the training data at the cost of new data is <strong>overfitting</strong>. Doing well on data it has never seen is <strong>generalising</strong>. The number that matters is the second one, and the first is the only one you can see while training.</p>
        <p className="text-muted-foreground mt-2 text-sm">An overfitted rule is not broken and it did not fail at its job. It learned something very well — a set of chance delays that happened once. That is why a perfect score on the examples is read as a warning rather than as success.</p>
      </div>

      <div className="border-border mt-6 border-t pt-5">
        <p className="font-display text-xl">What did the past deliveries fail to tell us about how this rule would work next time?</p>
        <p className="text-muted-foreground mt-2 text-sm">Explain it in your own words if you want to. Nothing you do in this panel changes a mark on your map; only an explanation you give yourself can do that.</p>
        <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
      </div>
    </div>}

    {!moreExamples
      ? <div className="mt-6">
        <Button size="touch" variant="outline" onClick={openMore}>Try another example <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">Other weeks of deliveries, where the same two rules come out differently.</p>
      </div>
      : <div className="mt-6">
        <h4 id="generalization-more-title" tabIndex={-1} className="font-display text-xl outline-none">Other weeks of deliveries</h4>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Each one refits both rules from its own past deliveries and holds its own {dataset.fresh.length} back. Everything above updates.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DATASETS.map(option => <Button key={option.label} type="button" size="touch" variant={option.label === dataset.label ? 'default' : 'outline'} onClick={() => chooseDataset(option)}>{option.label}</Button>)}
        </div>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{dataset.note}</p>
      </div>}

    <details className="text-muted-foreground mt-6 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p><strong>The simple rule</strong> is the same straight-line fit as the predictor experiment: of all the straight lines, it picks the one whose misses are smallest overall. With a real spread in the deliveries there is usually no straight line through all of them, so it accepts a miss on each.</p>
        <p><strong>The close-following rule</strong> is the one curve of exactly the right flexibility to pass through every past delivery — with {dataset.past.length} deliveries, a curve with {dataset.past.length - 1} bends available. There is only one such curve, so nothing was chosen to make it look good or bad. It is worked out by divided differences, which is exact rather than searched for.</p>
        <p><strong>Both rules are built from the past deliveries and nothing else.</strong> The held-back deliveries are not passed to either fitting step — the functions cannot see them. They are only ever asked afterwards.</p>
        <p>How far off means the same thing here as in the how-far-off experiment: the size of the gap, ignoring whether the guess was too long or too short. Everything is computed in your browser and nothing is sent anywhere.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p><strong>A more detailed rule is not worse by nature.</strong> The second week of deliveries above is a case where the extra flexibility helps, because the shape it picks up is real. What decides it is whether what the rule follows will happen again — and that is a fact about the world, not about the rule.</p>
        <p>Real models do not copy rows. A large one has enough flexibility to bend through millions of examples, and the effect is the same one you have just seen at this size.</p>
        <p>Holding data back is the standard check and it is not a guarantee. Held-out deliveries can share the same quirks as the training ones, and a set consulted often enough starts being fitted to as well.</p>
        <p>Four held-back deliveries is far too few to settle anything in real work, and every number in this panel is invented for it rather than measured.</p>
      </div>
    </details>
  </section>;
}
