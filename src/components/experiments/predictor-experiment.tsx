'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, Plus, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  completeExamples,
  DISTANCE_UNIT,
  fitLine,
  hasContradiction,
  INITIAL_PRESET,
  matchesFittedData,
  MAX_DISTANCE,
  MAX_MINUTES,
  MAX_ROWS,
  MINUTES_UNIT,
  predictAt,
  PRESETS,
  repeatedDistances,
  round,
  type Example,
  type ExampleRow,
  type FitResult,
  type Preset,
} from '@/lib/experiments/regression';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof usePredictorExperiment> };

const INITIAL_QUERY = 7;
const signed = (n: number) => (n === 0 ? '0' : n < 0 ? `−${Math.abs(n)}` : `+${n}`);
const minus = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

/**
 * Row ids double as form-control ids, so they are derived from the preset's
 * position rather than from a counter: the same dataset always produces the
 * same ids, and nothing is generated while rendering.
 */
function rowsFrom(preset: Preset): ExampleRow[] {
  const slot = PRESETS.indexOf(preset);
  return preset.rows.map((row, index) => ({ id: `preset${slot}-row${index}`, distance: row.distance, minutes: row.minutes }));
}

let added = 0;

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the examples, the fitted parameters, or the distance being asked
 * about.
 */
export function usePredictorExperiment() {
  const [rows, setRows] = useState<ExampleRow[]>(() => rowsFrom(INITIAL_PRESET));
  const [presetLabel, setPresetLabel] = useState<string | null>(INITIAL_PRESET.label);
  /**
   * The fit is a snapshot on purpose. Editing an observation must not silently
   * move a prediction: a rule that changed the instant you typed would hide the
   * one step this node is about, which is deriving the rule from the examples.
   */
  const [fit, setFit] = useState<FitResult | null>(null);
  const [queryDistance, setQueryDistance] = useState(INITIAL_QUERY);

  const edit = useCallback((id: string, field: 'distance' | 'minutes', value: number | null) => {
    setRows(current => current.map(row => (row.id === id ? { ...row, [field]: value } : row)));
    setPresetLabel(null);
  }, []);

  const add = useCallback(() => {
    const id = `added${(added += 1)}`;
    setRows(current => (current.length >= MAX_ROWS ? current : [...current, { id, distance: null, minutes: null }]));
    setPresetLabel(null);
  }, []);

  const remove = useCallback((id: string) => {
    setRows(current => current.filter(row => row.id !== id));
    setPresetLabel(null);
  }, []);

  const choosePreset = useCallback((preset: Preset) => {
    setRows(rowsFrom(preset));
    setPresetLabel(preset.label);
  }, []);

  const learn = useCallback(() => setFit(fitLine(completeExamples(rows))), [rows]);

  const reset = useCallback(() => {
    setRows(rowsFrom(INITIAL_PRESET));
    setPresetLabel(INITIAL_PRESET.label);
    setFit(null);
    setQueryDistance(INITIAL_QUERY);
  }, []);

  return { rows, presetLabel, fit, queryDistance, edit, add, remove, choosePreset, learn, reset, setQueryDistance };
}

/** A number field that can genuinely be empty, so a half-typed row is never guessed at. */
function NumberField({ id, label, name, unit, value, max, onChange }: {
  id: string; label: string; name: string; unit: string; value: number | null; max: number; onChange: (value: number | null) => void;
}) {
  return <span className="min-w-0 flex-1">
    <label htmlFor={id} className="text-muted-foreground block text-2xs">{label}</label>
    <span className="mt-1 flex items-center gap-1.5">
      {/* h-10: the shared Input is 32px, below the 40px finger target this project records. */}
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        aria-label={name}
        min={0}
        max={max}
        step={0.5}
        value={value === null ? '' : String(value)}
        onChange={event => {
          const raw = event.target.value;
          if (raw === '') return onChange(null);
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : null);
        }}
        className="h-10 font-mono tabular-nums"
      />
      <span aria-hidden className="text-muted-foreground text-xs">{unit}</span>
    </span>
  </span>;
}

/**
 * The drawing. Examples, the fitted line, and the distance being asked about are
 * three different things and are drawn three different ways: filled dots the
 * learner supplied, a line derived from them, a hollow marker on a line that was
 * never observed. Everything here is also stated in text below, so nothing
 * depends on reading the picture.
 */
function Plot({ examples, fit, queryDistance, prediction, stale }: {
  examples: readonly Example[]; fit: FitResult | null; queryDistance: number; prediction: number | null; stale: boolean;
}) {
  const width = 320;
  const height = 190;
  const pad = { left: 34, right: 10, top: 12, bottom: 26 };
  const xMax = Math.max(10, queryDistance, ...examples.map(e => e.distance)) * 1.1;
  const yMax = Math.max(20, prediction ?? 0, ...examples.map(e => e.minutes)) * 1.15;
  const px = (x: number) => pad.left + (x / xMax) * (width - pad.left - pad.right);
  const py = (y: number) => height - pad.bottom - (y / yMax) * (height - pad.top - pad.bottom);
  const fitted = fit?.status === 'fitted' ? fit : null;

  return <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={
    fitted
      ? `Scatter plot of ${examples.length} past food deliveries with the fitted line drawn through them. Every value is listed in the examples above.`
      : stale
        ? `Scatter plot of ${examples.length} edited food deliveries. The previous fitted line is hidden until the model learns from these examples again.`
        : fit?.status === 'undetermined'
          ? `Scatter plot of ${examples.length} past food deliveries. These examples do not determine a straight-line rule.`
          : `Scatter plot of ${examples.length} past food deliveries. No rule has been worked out yet.`
  }>
    <defs><clipPath id="predictor-plot"><rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} /></clipPath></defs>
    <line x1={pad.left} y1={py(0)} x2={width - pad.right} y2={py(0)} stroke="var(--border)" />
    <line x1={pad.left} y1={pad.top} x2={pad.left} y2={py(0)} stroke="var(--border)" />
    <text x={pad.left} y={height - 6} fontSize={9} fill="var(--muted-foreground)">0</text>
    <text x={width - pad.right} y={height - 6} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">{round(xMax, 0)} {DISTANCE_UNIT}</text>
    <text x={pad.left - 5} y={pad.top + 8} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">{round(yMax, 0)}</text>
    <text x={pad.left - 5} y={py(0)} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">0</text>

    <g clipPath="url(#predictor-plot)">
      {fitted && <line
        x1={px(0)} y1={py(fitted.intercept)} x2={px(xMax)} y2={py(fitted.intercept + fitted.slope * xMax)}
        stroke="var(--band-foundations)" strokeWidth={2}
      />}
      {/* The miss, drawn as the gap it is: observed answer to the rule's answer. */}
      {fitted && fitted.examples.map((example, index) => <line
        key={`miss-${index}`} x1={px(example.distance)} y1={py(example.minutes)} x2={px(example.distance)} y2={py(fitted.predictions[index])}
        stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 2"
      />)}
      {examples.map((example, index) => <circle
        key={`example-${index}`} cx={px(example.distance)} cy={py(example.minutes)} r={4}
        fill="var(--foreground)"
      />)}
      {prediction !== null && <>
        <line x1={px(queryDistance)} y1={py(0)} x2={px(queryDistance)} y2={py(prediction)} stroke="var(--band-foundations)" strokeWidth={1} strokeDasharray="3 3" />
        <circle cx={px(queryDistance)} cy={py(prediction)} r={5.5} fill="var(--surface-0)" stroke="var(--band-foundations)" strokeWidth={2.5} />
      </>}
    </g>
  </svg>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function PredictorExperiment({ onExplain, experiment }: Props) {
  const { rows, presetLabel, fit, queryDistance, edit, add, remove, choosePreset, learn, reset, setQueryDistance } = experiment;
  const examples = completeExamples(rows);
  const incomplete = rows.length - examples.length;
  const current = matchesFittedData(rows, fit);
  const fitted = fit?.status === 'fitted' ? fit : null;
  const prediction = predictAt(fit, queryDistance);
  const queryWasObserved = examples.some(example => example.distance === queryDistance);
  const repeated = repeatedDistances(examples);
  const contradictory = hasContradiction(examples);

  const rate = fitted ? round(fitted.slope, 2) : null;
  const ruleSentence = fitted && rate !== null
    ? `Start at ${round(fitted.intercept, 1)} minutes, then ${rate < 0 ? 'subtract' : 'add'} ${Math.abs(rate)} minutes for every ${DISTANCE_UNIT}`
    : null;

  return <section className="predictor-lab" aria-labelledby="predictor-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="predictor-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Can past food deliveries predict the next one?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>
    <p className="mt-3 max-w-2xl text-base">Imagine a restaurant wants to estimate when a new food order will arrive. Each example below is one earlier delivery: how far the customer was from the restaurant, and how many minutes the food took to arrive.</p>
    <p className="mt-3 max-w-2xl text-base">You are not being tested. You are testing one idea: <strong>changing the past deliveries can change what the model learns and predicts.</strong></p>
    <ol className="text-muted-foreground mt-3 list-decimal space-y-1 pl-5 text-sm">
      <li>Press <strong className="text-foreground">Learn from these examples</strong> to make the first rule.</li>
      <li>Change how long one food delivery took.</li>
      <li>Learn again, then compare the rule and the prediction for a new food delivery.</li>
    </ol>

    <div className="predictor-split mt-5">
      <p className="text-sm font-medium">What stays fixed, and what can change?</p>
      <p className="text-muted-foreground mt-1 text-xs">We have told the model to use a straight line. That part stays fixed. From the food deliveries below, it works out a base time, which could include preparation, and how many minutes to add per {DISTANCE_UNIT} of travel. Those two numbers can change when the deliveries change.</p>
    </div>

    <div className="mt-5">
      <p className="text-sm font-medium">Choose the past food deliveries</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map(preset => <Button key={preset.label} type="button" size="touch" variant={presetLabel === preset.label ? 'default' : 'outline'} onClick={() => choosePreset(preset)}>{preset.label}</Button>)}
      </div>
      {presetLabel && <p className="text-muted-foreground mt-2 text-xs">{PRESETS.find(preset => preset.label === presetLabel)?.note}</p>}
    </div>

    <div className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-xl">The past deliveries it will learn from</h4>
        <p className="text-muted-foreground text-xs">{examples.length} usable · every value editable</p>
      </div>

      <ul className="mt-3 space-y-2">
        {rows.map((row, position0) => {
          const position = position0 + 1;
          const index = rowIndexOf(rows, examples, row.id);
          const outcome = fitted && current && index >= 0 && index < fitted.predictions.length
            ? { predicted: fitted.predictions[index], miss: fitted.residuals[index] }
            : null;
          return <li key={row.id} className="predictor-row">
            <div className="flex flex-wrap items-end gap-2">
              <NumberField id={`${row.id}-distance`} label="Customer distance" name={`Delivery ${position} distance from the restaurant in ${DISTANCE_UNIT}`} unit={DISTANCE_UNIT} value={row.distance} max={MAX_DISTANCE} onChange={value => edit(row.id, 'distance', value)} />
              <NumberField id={`${row.id}-minutes`} label="Minutes to arrive" name={`Delivery ${position} time until the food arrived in minutes`} unit={MINUTES_UNIT} value={row.minutes} max={MAX_MINUTES} onChange={value => edit(row.id, 'minutes', value)} />
              <Button variant="ghost" size="icon-touch" onClick={() => remove(row.id)} aria-label={`Remove delivery ${position}${row.distance === null ? '' : `, for a customer ${row.distance} ${DISTANCE_UNIT} away`}`}><X aria-hidden /></Button>
            </div>
            {row.distance === null || row.minutes === null
              ? <p className="text-muted-foreground mt-1.5 text-xs">Needs both numbers before it can count as an example.</p>
              : outcome
                ? <p className="text-muted-foreground mt-1.5 font-mono text-xs tabular-nums">rule says {round(outcome.predicted, 1)} {MINUTES_UNIT} · miss {signed(round(outcome.miss, 1))}</p>
                : null}
          </li>;
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="touch" onClick={add} disabled={rows.length >= MAX_ROWS}><Plus aria-hidden />Add a delivery</Button>
        {rows.length >= MAX_ROWS && <p className="text-muted-foreground text-xs">{MAX_ROWS} is as many as this panel draws.</p>}
        {incomplete > 0 && <p className="text-muted-foreground text-xs">{incomplete} {incomplete === 1 ? 'row is' : 'rows are'} not counted yet.</p>}
      </div>
    </div>

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button size="touch" onClick={learn} disabled={current}>Learn from these examples <ArrowRight aria-hidden /></Button>
      <p className={cn('text-sm', current ? 'text-muted-foreground' : 'font-medium')}>
        {!fit ? 'No rule yet. Press the button to make one from these examples.'
          : current ? fit.status === 'fitted' ? 'This rule was learned from the examples now on screen.' : 'The model tried these examples, but they did not give it enough information for a rule.'
          : 'You changed the examples. The result below is still the old rule. Learn again to see what changes.'}
      </p>
    </div>

    <Plot examples={examples} fit={current ? fit : null} queryDistance={queryDistance} prediction={current ? prediction : null} stale={Boolean(fit && !current)} />

    <div aria-live="polite" aria-atomic="true" className="mt-4">
      {fit && fit.status === 'undetermined' ? <div className="predictor-undetermined">
        <p className="font-display text-xl">No rule came out of that.</p>
        <p className="mt-2 text-sm">{
          fit.reason === 'no-examples' ? 'There are no complete examples yet, so there is nothing to learn from.'
            : fit.reason === 'one-example' ? 'One delivery gives the line one point to pass through, but it does not show how time changes as distance changes.'
            : `Every delivery has the same distance. Because the distance never changes, these examples cannot show how much extra distance changes the time.`
        }</p>
        <p className="text-muted-foreground mt-2 text-sm">The experiment will not invent a rate the examples did not determine. {fit.reason === 'no-spread' ? 'Add a delivery for a customer at a different distance and learn again.' : 'Add deliveries for customers at two different distances and learn again.'}</p>
      </div> : fitted ? <div className="predictor-rule">
        <p className="eyebrow">What it learned from these examples</p>
        <p className="font-display mt-2 text-xl">{ruleSentence}.</p>
        <p className="mt-2 text-sm">No one typed either number. The fit calculated both from the examples, choosing the straight line that comes closest overall, with larger misses counting more.</p>
        <p className="mt-2 font-mono text-sm tabular-nums">
          {fitted.exact ? 'Average miss 0. Every example reproduced exactly.' : `Average miss ${round(fitted.meanAbsoluteError, 2)} ${MINUTES_UNIT} · worst ${round(Math.max(...fitted.residuals.map(Math.abs)), 1)} ${MINUTES_UNIT}`}
        </p>
      </div> : null}
    </div>

    {contradictory && fitted && current && <div className="predictor-clash mt-4">
      <p className="font-display text-xl">Same distance, different delivery times.</p>
      <p className="mt-2 text-sm">{repeated.length === 1 ? `More than one customer was ${minus(repeated[0])} ${DISTANCE_UNIT} away, but their food arrived at different times.` : `Customers at ${repeated.map(d => `${minus(d)} ${DISTANCE_UNIT}`).join(' and ')} had different delivery times.`} This rule gives only one estimate for each distance, so it cannot match them all. None is discarded: every delivery influences where the line lands, and every miss is shown above.</p>
    </div>}

    <div className="mt-5">
      <h4 className="font-display text-xl">Predict a new food delivery</h4>
      <p className="text-muted-foreground mt-1 text-sm">{
        current && prediction !== null ? 'Now test the rule on a distance that was not in the examples.'
          : fit && !current ? 'The examples have changed. Learn again before predicting a new food delivery.'
          : fit?.status === 'undetermined' ? 'These examples did not produce a rule. Change them and learn again before predicting a new food delivery.'
          : 'After the model learns a rule, come back here to test it on a distance it has not seen.'
      }</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <span className="min-w-[9rem] flex-1">
          <label htmlFor="predictor-query" className="text-muted-foreground block text-2xs">Customer distance</label>
          <input
            id="predictor-query"
            type="range"
            min={0}
            max={MAX_DISTANCE}
            step={0.5}
            value={queryDistance}
            onChange={event => setQueryDistance(Number(event.target.value))}
            aria-valuetext={prediction !== null && current ? `Customer ${queryDistance} ${DISTANCE_UNIT} from the restaurant, predicted delivery time ${round(prediction, 1)} minutes` : `Customer ${queryDistance} ${DISTANCE_UNIT} from the restaurant, no rule to read yet`}
            className="predictor-slider mt-2 w-full"
          />
        </span>
        <span>
          <label htmlFor="predictor-query-number" className="text-muted-foreground block text-2xs">or type it</label>
          <span className="mt-1 flex items-center gap-1.5">
            <Input
              id="predictor-query-number"
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_DISTANCE}
              step={0.5}
              value={String(queryDistance)}
              onChange={event => setQueryDistance(Math.min(MAX_DISTANCE, Math.max(0, Number(event.target.value) || 0)))}
              className="h-10 w-24 font-mono tabular-nums"
            />
            <span aria-hidden className="text-muted-foreground text-xs">{DISTANCE_UNIT}</span>
          </span>
        </span>
      </div>
      <div className="predictor-readout mt-3">
        {current && prediction !== null
          ? <>
            <div className="predictor-result-values">
              <span className="predictor-result-value">
                <span className="predictor-result-label">Customer distance</span>
                <strong className="font-mono tabular-nums">{queryDistance} {DISTANCE_UNIT}</strong>
              </span>
              <ArrowRight className="predictor-result-arrow" aria-hidden />
              <span className="predictor-result-value">
                <span className="predictor-result-label">Predicted arrival</span>
                <strong className="font-mono tabular-nums">{round(prediction, 1)} {MINUTES_UNIT}</strong>
              </span>
            </div>
            <p className="mt-3">{queryWasObserved ? 'That distance is already in the past deliveries. Choose one that is not to test a new prediction.' : 'That distance was not in the past deliveries. The prediction came from the rule the model learned.'} A prediction is not a guarantee, especially beyond the distances in the examples.</p>
          </>
          : fit && !current
            ? <p>Run the fit again to read a rule that matches the examples now on screen.</p>
            : fit?.status === 'undetermined'
              ? <p>No prediction yet. These examples did not determine a rule.</p>
              : <p>No prediction yet. Learn from the examples first.</p>}
      </div>
    </div>

    {fitted && current && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">If nobody typed the final rule, where did this model’s predictions come from?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Running the fit here leaves every mark on your map unchanged; a line that fits some numbers is a numerical relationship, not evidence that anything understood them.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">The arithmetic, if you want it</summary>
      <div className="space-y-2 pt-2">
        <p>The shape is <code>minutes = intercept + slope × distance</code>. &ldquo;Best&rdquo; here means the pair that makes the total of the squared misses as small as it can be, and for a straight line that pair can be written down directly:</p>
        <p className="font-mono text-xs">slope = Σ(d − d̄)(m − m̄) ÷ Σ(d − d̄)²<br />intercept = m̄ − slope × d̄</p>
        <p>The bottom line is the spread of the distances. When every distance is the same it is zero, which is why the panel reports that no rule was determined instead of dividing by it.</p>
        <p>Squared, rather than plain, misses: it makes one large miss count for more than several small ones, and it is what makes the two formulas above exact rather than something to search for.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this model leaves out</summary>
      <div className="space-y-2 pt-2">
        <p>One input, one output, and a shape chosen in advance by us rather than found in the data. Real systems have many inputs, shapes with millions of parameters, and no formula that solves them outright. They are nudged towards a fit step by step instead.</p>
        <p>A fitted line says the observations line up. It does not say distance causes the time, that the rule holds beyond the distances observed, or that anything here understood a delivery. The starting dataset is invented for this panel, not measured.</p>
      </div>
    </details>
  </section>;
}

/** Maps a row back to its position among the complete examples the fit used. */
function rowIndexOf(rows: readonly ExampleRow[], examples: readonly Example[], id: string): number {
  let index = -1;
  for (const row of rows) {
    if (row.distance === null || row.minutes === null) {
      if (row.id === id) return -1;
      continue;
    }
    index += 1;
    if (row.id === id) return index < examples.length ? index : -1;
  }
  return -1;
}
