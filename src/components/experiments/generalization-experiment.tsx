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
 * sales neither rule has seen are hollow squares — three different
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
        ? `A chart of ${dataset.past.length} past phone sales with both rules drawn through them, and ${dataset.heldOut.length} held-out sales neither rule was built from. Every value is listed on this page.`
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
        <h3 id="generalization-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Can a rule price every past phone perfectly—and still miss the next one?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>

    <p className="mt-3 max-w-2xl text-base">A shop estimates a used phone’s sale price from its age: <strong>age goes in; estimated price comes out.</strong></p>

    <div className="mt-4">
      <p className="text-sm font-medium">The only {dataset.past.length} examples either rule can learn from</p>
      <ul className="generalization-chips mt-2">
        {dataset.past.map(sale => <li key={sale.ageMonths} className="generalization-chip font-mono text-xs tabular-nums">{sale.ageMonths} mo → ${sale.soldFor}</li>)}
      </ul>
    </div>

    <div className="generalization-rules mt-4">
      <div className="generalization-rule">
        <p className="eyebrow inline-flex items-center gap-2"><Swatch kind="line" />Simple: one steady trend</p>
        <p className="mt-2 text-sm">One straight line across all five sales. It cannot bend for an unusual phone.</p>
        {ruleSentence && <p className="mt-2 font-mono text-xs tabular-nums">{ruleSentence}.</p>}
        <p className="generalization-rule-off mt-3">On the examples it learned from: <strong>{linePast ? offPhrase(linePast) : 'nothing to measure'}</strong> on average.</p>
      </div>
      <div className="generalization-rule">
        <p className="eyebrow inline-flex items-center gap-2"><Swatch kind="curve" />Flexible: follows every sale</p>
        <p className="mt-2 text-sm">Enough freedom to pass through all five—even when one does not follow the overall trend.</p>
        <p className="generalization-rule-off mt-3">On the examples it learned from: <strong>{curvePast ? offPhrase(curvePast) : 'nothing to measure'}</strong>{curvePast?.allExact ? ' — every one exactly right' : ' on average'}.</p>
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
      <Button size="touch" onClick={reveal}>Reveal 4 phone sales kept hidden <ArrowRight aria-hidden /></Button>
      <p className="mt-2 max-w-2xl text-sm">{curvePast?.allExact
        ? `One rule matched every example it saw. Does that tell you how it will price a phone it did not see?`
        : `Both rules were built from those ${dataset.past.length} sales. Neither has seen anything else.`}</p>
    </div>}

    <Plot dataset={dataset} outcome={outcome} revealed={revealed} />

    {revealed && <div className="mt-6">
      <h4 id="generalization-new-title" tabIndex={-1} className="font-display text-xl outline-none">{dataset.heldOut.length} phone sales neither rule has seen</h4>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">These were kept hidden while the rules were built. Revealing them lets us check the rules; it does not let either rule learn again.</p>

      <ul className="mt-3 space-y-2">
        {dataset.heldOut.map((sale, index) => <li key={sale.ageMonths} className="generalization-row">
          <span className="generalization-row-fact text-sm"><strong className="font-mono tabular-nums">{sale.ageMonths} months old</strong>. It actually sold for <strong className="font-mono tabular-nums">${sale.soldFor}</strong>.</span>
          <span className="generalization-said">
            <span className="generalization-said-label inline-flex items-center gap-1.5"><Swatch kind="line" />Simple rule</span>
            <strong className="font-mono tabular-nums">{lineHeldOut ? price(lineHeldOut.answers[index]) : '—'}</strong>
            <span className="text-muted-foreground text-xs">{lineHeldOut ? (lineHeldOut.misses[index] < 0.05 ? 'exactly right' : `$${oneDecimal(lineHeldOut.misses[index])} off`) : ''}</span>
          </span>
          <span className="generalization-said">
            <span className="generalization-said-label inline-flex items-center gap-1.5"><Swatch kind="curve" />Flexible rule</span>
            <strong className="font-mono tabular-nums">{curveHeldOut ? price(curveHeldOut.answers[index]) : '—'}</strong>
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
          <p className="generalization-score-head">On examples it learned from</p>
          <p className="generalization-score-head">On sales kept hidden</p>

          <p className="generalization-score-rule inline-flex items-center gap-2"><Swatch kind="line" />Simple rule</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">Learned from</span>{linePast ? offPhrase(linePast) : '—'}</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">Kept hidden</span>{lineHeldOut ? offPhrase(lineHeldOut) : '—'}</p>

          <p className="generalization-score-rule inline-flex items-center gap-2"><Swatch kind="curve" />Flexible rule</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">Learned from</span>{curvePast ? offPhrase(curvePast) : '—'}</p>
          <p className="generalization-score-value font-mono tabular-nums"><span className="generalization-when">Kept hidden</span>{curveHeldOut ? offPhrase(curveHeldOut) : '—'}</p>
        </div>

        <div className="generalization-readout mt-4">
          {verdict === 'line-better' ? <>
            <p className="font-display text-xl">The rule with the perfect past score missed the hidden sales most.</p>
            <p className="mt-2 text-sm">The flexible rule was {curvePast?.allExact ? 'exactly right on every example it learned from' : `${curvePast && offPhrase(curvePast)} on those examples`}, then {curveHeldOut && offPhrase(curveHeldOut)} on the {dataset.heldOut.length} hidden sales. The simple rule started at {linePast && offPhrase(linePast)}, then was {lineHeldOut && offPhrase(lineHeldOut)} on the hidden sales{ratio === null ? '' : ` — ${oneDecimal(ratio)} times closer`}.</p>
            <p className="mt-2 text-sm">The cracked screen happened once; it was not a pattern about all phones of that age. {oddOne && `The ${oddOne.ageMonths}-month-old phone sold for $${oneDecimal(oddOne.off)} less than the steady trend expected. Bending through that accident pulled the flexible rule away from the other phones around that age.`}</p>
          </> : verdict === 'curve-better' ? <>
            <p className="font-display text-xl">This time, the bend was a real pattern.</p>
            <p className="mt-2 text-sm">Phones really did lose value faster while nearly new and more slowly later. The flexible rule was {curveHeldOut && offPhrase(curveHeldOut)} on the hidden sales; the straight line was {lineHeldOut && offPhrase(lineHeldOut)}{ratio === null ? '' : `, about ${oneDecimal(ratio)} times further off`}.</p>
            <p className="mt-2 text-sm">A more detailed rule is not worse by nature. What went wrong in the first example was following something that was not going to happen again.</p>
          </> : <>
            <p className="font-display text-xl">Here both rules do the same thing.</p>
            <p className="mt-2 text-sm">These past sales contain one clean price pattern and no unusual phone, so there is nothing extra for the flexible rule to chase. Free to bend, it comes out straight, and both rules price the hidden phones identically.</p>
            <p className="mt-2 text-sm">Following the examples closely costs nothing when the examples contain nothing but the pattern. The cost appears when they also contain chance.</p>
          </>}
        </div>
      </div>

      {/* The names, only now that both numbers are on screen. */}
      <div className="generalization-name mt-6">
        <p className="eyebrow">The names for this</p>
        <p className="mt-2 text-base">The phone sales a rule is built from are its <strong>training data</strong>. Keeping some sales hidden and only trying them afterwards makes a <strong>held-out</strong> or <strong>test</strong> set. It separates the examples a model could remember from the examples that can reveal whether its rule travels.</p>
        <p className="mt-2 text-base">Matching the training data at the cost of new data is <strong>overfitting</strong>. Doing well on data it has never seen is <strong>generalising</strong>. The number that matters is the second one, and the first is the only one you can see while training.</p>
        <p className="text-muted-foreground mt-2 text-sm">An overfitted rule is not broken. It learned something very well—the cracked phone’s one-off price—as if it were a reusable pattern about age. That is why a perfect training score is a reason to check, not proof of success.</p>
      </div>

      <div className="border-border mt-6 border-t pt-5">
        <p className="font-display text-xl">Why did the cracked phone help one rule on the examples it saw, but hurt it on the sales kept hidden?</p>
        <p className="text-muted-foreground mt-2 text-sm">Explain it in your own words if you want to. Nothing you do in this panel changes a mark on your map; only an explanation you give yourself can do that.</p>
        <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
      </div>
    </div>}

    {!moreExamples
      ? <div className="mt-6">
        <Button size="touch" variant="outline" onClick={openMore}>Try another example <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">Other sets of phone sales, where the same two rules come out differently.</p>
      </div>
      : <div className="mt-6">
        <h4 id="generalization-more-title" tabIndex={-1} className="font-display text-xl outline-none">Other sets of phone sales</h4>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Each set rebuilds both rules from its own five visible sales and keeps another {dataset.heldOut.length} hidden. Everything above updates.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DATASETS.map(option => <Button key={option.label} type="button" size="touch" variant={option.label === dataset.label ? 'default' : 'outline'} onClick={() => chooseDataset(option)}>{option.label}</Button>)}
        </div>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{dataset.note}</p>
      </div>}

    <details className="text-muted-foreground mt-6 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p><strong>The simple rule</strong> is the same straight-line fit as the predictor experiment: of all the straight lines, it picks the one whose misses are smallest overall. Usually no straight line can pass through every sale, so it accepts a small miss to keep one steady trend.</p>
        <p><strong>The flexible rule</strong> is the one curve with exactly enough freedom to pass through every visible sale—five sales give it four bends. Nothing was chosen afterwards to make it look good or bad.</p>
        <p><strong>Both rules receive exactly the same input:</strong> a phone’s age. Both are built from the same five sale prices. The four hidden sales never reach either fitting step; they are used only to check the finished rules.</p>
        <p>“How far off” is the dollar gap between the price a rule estimated and the price the phone actually sold for. Everything is computed in your browser and nothing is sent anywhere.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p><strong>A more detailed rule is not worse by nature.</strong> The early-price-drop set is a case where extra flexibility helps because the bend is real. What decides it is whether what the rule follows will happen again—a fact about the world, not about the rule.</p>
        <p>Real models do not copy rows. A large one has enough flexibility to bend through millions of examples, and the effect is the same one you have just seen at this size.</p>
        <p>Holding data back is the standard check and it is not a guarantee. Hidden sales can share the same quirks as the training ones, and a set consulted often enough starts being fitted to as well.</p>
        <p>Real phone prices depend on model, condition, storage and many other inputs—not age alone. Four held-back sales is far too few to settle anything in real work, and every number here was invented for this panel.</p>
      </div>
    </details>
  </section>;
}
