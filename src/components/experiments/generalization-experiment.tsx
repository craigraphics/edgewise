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
  onHeldOutSales,
  round,
  timesFurther,
  type Dataset,
  type Outcome,
  type PhoneSale,
  type Score,
} from '@/lib/experiments/generalization';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useGeneralizationExperiment> };

/** "$34.5 off", and "nothing off" when there is genuinely nothing. */
function offPhrase(score: Score): string {
  if (score.allExact) return 'nothing off';
  return `$${score.meanOff.toFixed(1)} off`;
}

const oneDecimal = (value: number) => value.toFixed(1);
const price = (value: number) => `$${oneDecimal(value)}`;

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets which sales are on screen or whether the hidden ones have been
 * tried.
 */
export function useGeneralizationExperiment() {
  const [dataset, setDataset] = useState<Dataset>(INITIAL_DATASET);
  const [revealed, setRevealed] = useState(false);
  const [moreExamples, setMoreExamples] = useState(false);

  /**
   * Switching examples keeps the held-out sales on screen. Having seen what
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
 * The drawing. Past sales are filled dots, the two rules are two strokes, and
 * sales neither rule has seen are hollow squares. These are three different
 * things drawn three different ways, and the gap between a square and a stroke
 * is the miss.
 *
 * Both rules are drawn only across the phone ages they were fitted over. Reading
 * either one far outside that range is a different failure from this one.
 *
 * Optional support: every value here is also printed in the lists below, so
 * nothing depends on reading the picture.
 */
function Plot({ dataset, outcome, revealed }: { dataset: Dataset; outcome: Outcome; revealed: boolean }) {
  const width = 320;
  const height = 172;
  const pad = { left: 34, right: 12, top: 12, bottom: 26 };
  const shown: readonly PhoneSale[] = revealed ? [...dataset.past, ...dataset.heldOut] : dataset.past;
  const low = Math.min(...dataset.past.map(sale => sale.ageMonths));
  const high = Math.max(...dataset.past.map(sale => sale.ageMonths));
  const xMax = Math.max(...shown.map(sale => sale.ageMonths)) * 1.12;
  const yMax = Math.max(...shown.map(sale => sale.soldFor), ...(outcome.curvePast?.answers ?? []), ...(revealed ? outcome.curveHeldOut?.answers ?? [] : [])) * 1.18;
  const px = (x: number) => pad.left + (x / xMax) * (width - pad.left - pad.right);
  const py = (y: number) => height - pad.bottom - (y / yMax) * (height - pad.top - pad.bottom);

  const steps = 72;
  const path = (at: (d: number) => number | null) => {
    const points: string[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const age = low + ((high - low) * i) / steps;
      const value = at(age);
      if (value === null || !Number.isFinite(value)) return null;
      points.push(`${i === 0 ? 'M' : 'L'}${px(age).toFixed(2)} ${py(value).toFixed(2)}`);
    }
    return points.join(' ');
  };

  const linePath = outcome.rules.lineRule ? path(outcome.rules.lineRule) : null;
  const curvePath = outcome.rules.curveRule ? path(age => curveAt(outcome.rules.curve, age)) : null;

  return <div className="mt-4 max-w-[30rem]">
    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
      <span className="inline-flex items-center gap-1.5"><svg width={12} height={12}><circle cx={6} cy={6} r={4} fill="var(--foreground)" /></svg>Sale used to build the rules</span>
      {revealed && <span className="inline-flex items-center gap-1.5"><svg width={12} height={12}><rect x={1.5} y={1.5} width={9} height={9} fill="var(--surface-0)" stroke="var(--foreground)" strokeWidth={2} /></svg>Sale kept hidden</span>}
    </div>
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full" role="img" aria-label={
      revealed
        ? `A chart of ${dataset.past.length} past phone sales with both rules drawn through them, and ${dataset.heldOut.length} new sales that were kept hidden. Every value is listed on this page.`
        : `A chart of ${dataset.past.length} past phone sales with both rules drawn through them. Every value is listed on this page.`
    }>
    <defs><clipPath id="generalization-plot"><rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} /></clipPath></defs>
    <line x1={pad.left} y1={py(0)} x2={width - pad.right} y2={py(0)} stroke="var(--border)" />
    <line x1={pad.left} y1={pad.top} x2={pad.left} y2={py(0)} stroke="var(--border)" />
    <text x={pad.left} y={height - 6} fontSize={9} fill="var(--muted-foreground)">0</text>
    <text x={width - pad.right} y={height - 6} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">{round(xMax, 0)} months old</text>
    <text x={pad.left - 5} y={pad.top + 8} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">${round(yMax, 0)}</text>
    <text x={pad.left - 5} y={py(0)} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">0</text>

    <g clipPath="url(#generalization-plot)">
      {linePath && <path d={linePath} fill="none" stroke="var(--band-learning)" strokeWidth={2.25} />}
      {curvePath && <path d={curvePath} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 3" />}
      {dataset.past.map(sale => <circle key={`past-${sale.ageMonths}`} cx={px(sale.ageMonths)} cy={py(sale.soldFor)} r={4} fill="var(--foreground)" />)}
      {revealed && dataset.heldOut.map(sale => <rect
        key={`held-out-${sale.ageMonths}`}
        x={px(sale.ageMonths) - 4.5} y={py(sale.soldFor) - 4.5} width={9} height={9}
        fill="var(--surface-0)" stroke="var(--foreground)" strokeWidth={2}
      />)}
    </g>
    </svg>
  </div>;
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
  const { linePast, lineHeldOut, curvePast, curveHeldOut } = outcome;
  const ruleSentence = describeLine(outcome.rules.line);
  const verdict = onHeldOutSales(outcome);
  const ratio = timesFurther(outcome);
  /**
   * The past sale the straight line misses by most: the one the flexible
   * rule had to bend furthest to reach. Named from the arithmetic rather than
   * written into the copy, so it stays true if the sales are ever edited.
   */
  const oddOne = linePast && !linePast.allExact
    ? dataset.past.map((sale, index) => ({ ageMonths: sale.ageMonths, off: linePast.misses[index] }))
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
        <h3 id="generalization-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Can a perfect score still lead to bad guesses?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>

    <p className="mt-3 max-w-2xl text-base">A shop uses a phone’s age to guess its sale price.</p>

    <div className="mt-4">
      <p className="text-sm font-medium">The {dataset.past.length} past sales used to build both rules</p>
      <ul className="generalization-chips mt-2">
        {dataset.past.map(sale => <li key={sale.ageMonths} className="generalization-chip font-mono text-xs tabular-nums">{sale.ageMonths} months: ${sale.soldFor}</li>)}
      </ul>
    </div>

    <div className="generalization-rules mt-4">
      <div className="generalization-rule">
        <p className="eyebrow inline-flex items-center gap-2"><Swatch kind="line" />Simple rule: one straight line</p>
        <p className="mt-2 text-sm">It cannot turn to match one unusual phone.</p>
        {ruleSentence && <p className="mt-2 font-mono text-xs tabular-nums">{ruleSentence}.</p>}
        <p className="generalization-rule-off mt-3">Average miss on past sales: <strong>{linePast ? offPhrase(linePast) : 'nothing to measure'}</strong>.</p>
      </div>
      <div className="generalization-rule">
        <p className="eyebrow inline-flex items-center gap-2"><Swatch kind="curve" />Flexible rule: matches every past sale</p>
        <p className="mt-2 text-sm">It bends to touch every past sale, including the cracked phone.</p>
        <p className="generalization-rule-off mt-3">Average miss on past sales: <strong>{curvePast ? offPhrase(curvePast) : 'nothing to measure'}</strong>{curvePast?.allExact ? '. It got all five right' : ''}.</p>
      </div>
    </div>

    {/*
      * The first action sits above the picture, not below it.
      * Measured at 1230x842: the chart stretched to the pane's full 664px and
      * stood 415px tall on its own, which put the button 982px below the panel
      * title and off the bottom of the window. The sibling panels put their
      * first action at 334, 431, 445 and 520. The drawing is optional support
      * and everything it shows is also printed here in words, so it follows the
      * button rather than pushing it down the page.
      */}
    {!revealed && <div className="mt-5">
      <Button size="touch" onClick={reveal}>Show 4 new phone sales <ArrowRight aria-hidden /></Button>
      <p className="mt-2 max-w-2xl text-sm">{curvePast?.allExact
        ? `It got every past sale right. Will it work on new phones?`
        : `Both rules learned from those ${dataset.past.length} sales. They have not seen any other phones.`}</p>
    </div>}

    <Plot dataset={dataset} outcome={outcome} revealed={revealed} />

    {revealed && <div className="mt-6">
      <h4 id="generalization-new-title" tabIndex={-1} className="font-display text-xl outline-none">{dataset.heldOut.length} new phone sales</h4>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">These sales were hidden until both rules were finished. They test the rules. They do not change them.</p>

      <ul className="mt-3 space-y-2">
        {dataset.heldOut.map((sale, index) => <li key={sale.ageMonths} className="generalization-row">
          <span className="generalization-row-fact text-sm"><strong className="font-mono tabular-nums">{sale.ageMonths} months old</strong>. It actually sold for <strong className="font-mono tabular-nums">${sale.soldFor}</strong>.</span>
          <span className="generalization-said">
            <span className="generalization-said-label inline-flex items-center gap-1.5"><Swatch kind="line" />Simple rule</span>
            <strong className="font-mono tabular-nums">{lineHeldOut ? price(lineHeldOut.answers[index]) : 'No result'}</strong>
            <span className="text-muted-foreground text-xs">{lineHeldOut ? (lineHeldOut.misses[index] < 0.05 ? 'exactly right' : `$${oneDecimal(lineHeldOut.misses[index])} off`) : ''}</span>
          </span>
          <span className="generalization-said">
            <span className="generalization-said-label inline-flex items-center gap-1.5"><Swatch kind="curve" />Flexible rule</span>
            <strong className="font-mono tabular-nums">{curveHeldOut ? price(curveHeldOut.answers[index]) : 'No result'}</strong>
            <span className="text-muted-foreground text-xs">{curveHeldOut ? (curveHeldOut.misses[index] < 0.05 ? 'exactly right' : `$${oneDecimal(curveHeldOut.misses[index])} off`) : ''}</span>
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
          <p className="generalization-score-head">Past sales used to build it</p>
          <p className="generalization-score-head">New sales kept hidden</p>

          <p className="generalization-score-rule inline-flex items-center gap-2"><Swatch kind="line" />Simple rule</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">Past sales</span>{linePast ? offPhrase(linePast) : 'No result'}</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">New sales</span>{lineHeldOut ? offPhrase(lineHeldOut) : 'No result'}</p>

          <p className="generalization-score-rule inline-flex items-center gap-2"><Swatch kind="curve" />Flexible rule</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">Past sales</span>{curvePast ? offPhrase(curvePast) : 'No result'}</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">New sales</span>{curveHeldOut ? offPhrase(curveHeldOut) : 'No result'}</p>
        </div>

        <div className="generalization-readout mt-4">
          {verdict === 'line-better' ? <>
            <p className="font-display text-xl">A perfect score on past sales did not mean the rule would work on new phones.</p>
            <p className="mt-2 text-sm">The flexible rule got all five past sales exactly right. On the new sales, it was {curveHeldOut && offPhrase(curveHeldOut)} on average. The simple rule was {linePast && offPhrase(linePast)} on the past sales and {lineHeldOut && offPhrase(lineHeldOut)} on the new sales.{ratio === null ? '' : ` On the new sales, the simple rule was ${oneDecimal(ratio)} times closer.`}</p>
            <p className="mt-2 text-sm">Why? The cracked screen happened once. It was not a pattern about phone age. {oddOne && `The ${oddOne.ageMonths}-month-old phone sold for $${oneDecimal(oddOne.off)} less than the main trend expected. The flexible rule treated that one unusual price as a pattern for other phones around that age. The new phones did not repeat it.`}</p>
          </> : verdict === 'curve-better' ? <>
            <p className="font-display text-xl">This time, the bend is part of the real pattern.</p>
            <p className="mt-2 text-sm">These phones really did lose value faster when almost new and more slowly later. The flexible rule was {curveHeldOut && offPhrase(curveHeldOut)} on the new sales. The simple rule was {lineHeldOut && offPhrase(lineHeldOut)}{ratio === null ? '.' : `. It was ${oneDecimal(ratio)} times further off.`}</p>
            <p className="mt-2 text-sm">More detail can help when the bend is real and appears again in new sales.</p>
          </> : <>
            <p className="font-display text-xl">This time, both rules find the same pattern.</p>
            <p className="mt-2 text-sm">These prices follow one steady pattern. There is no unusual sale for the flexible rule to follow. So it becomes the same straight line as the simple rule. Both rules get the new phones exactly right.</p>
            <p className="mt-2 text-sm">In this experiment, the problem appears when a rule follows a one-off detail that does not happen again.</p>
          </>}
        </div>
      </div>

      {/* The names, only now that both numbers are on screen. */}
      <div className="generalization-name mt-6">
        <p className="eyebrow">What this is called</p>
        <p className="mt-2 text-base">The five past sales are the <strong>training data</strong>. They are the examples used to build each rule. The four new sales are <strong>test data</strong>. They stayed hidden until both rules were finished.</p>
        <p className="mt-2 text-base"><strong>Overfitting</strong> happens when a rule matches its training examples but does not work well on new examples. <strong>Generalising</strong> means the rule also works on examples it has never seen.</p>
        <p className="text-muted-foreground mt-2 text-sm">The flexible rule was not broken. It learned the cracked phone’s unusually low price as if that price were a pattern that would happen again. A perfect training score cannot tell you whether a rule will work on new examples. You have to test it.</p>
      </div>

      <div className="border-border mt-6 border-t pt-5">
        <p className="font-display text-xl">Why did the flexible rule get every past sale right but do worse on the new sales?</p>
        <p className="text-muted-foreground mt-2 text-sm">Say it in your own words if you want. This panel does not change your map. Your own explanation can.</p>
        <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
      </div>
    </div>}

    {!moreExamples
      ? <div className="mt-6">
        <Button size="touch" variant="outline" onClick={openMore}>Try another example <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">See two cases where the same kinds of rule behave differently.</p>
      </div>
      : <div className="mt-6">
        <h4 id="generalization-more-title" tabIndex={-1} className="font-display text-xl outline-none">Other sets of phone sales</h4>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Each case builds both rules from five past sales. Four new sales stay hidden until testing. The results above update when you choose a case.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DATASETS.map(option => <Button key={option.label} type="button" size="touch" variant={option.label === dataset.label ? 'default' : 'outline'} onClick={() => chooseDataset(option)}>{option.label}</Button>)}
        </div>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{dataset.note}</p>
      </div>}

    <details className="text-muted-foreground mt-6 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p><strong>The simple rule</strong> draws the straight line that gets closest to all five past sales. It accepts small misses so it can keep one steady pattern.</p>
        <p><strong>The flexible rule</strong> bends as much as needed to touch all five past sales. Nothing was changed later to make it look good or bad.</p>
        <p><strong>Both rules get exactly the same input:</strong> a phone’s age. Both learn from the same five past prices. The four new prices are only used after the rules are finished.</p>
        <p>“How far off” is the difference between a rule’s guess and the phone’s real sale price. Your browser does all the work. Nothing is sent anywhere.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p><strong>A rule with more detail is not always worse.</strong> In the early price drop case, the curve helps because the bend is real and happens again.</p>
        <p>Real models do not copy rows one by one. But a large model can still learn details that only happen in its training examples. The result is the same problem shown here.</p>
        <p>Testing on hidden examples helps, but it does not guarantee that a rule will work everywhere. The hidden examples can have the same unusual details as the training examples. They can also stop being a fair test if people use them again and again while changing the rule.</p>
        <p>Real phone prices depend on the model, condition, storage, and many other facts. Age alone is not enough. Four new sales are also far too few for a real test. Every number here was made up for this experiment.</p>
      </div>
    </details>
  </section>;
}
