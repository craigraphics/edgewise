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
function Plot({ examples, fit, queryDistance, prediction }: {
  examples: readonly Example[]; fit: FitResult | null; queryDistance: number; prediction: number | null;
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
      ? `Scatter plot of ${examples.length} example trips with the fitted line drawn through them. Every value is listed in the examples below.`
      : `Scatter plot of ${examples.length} example trips. No rule has been worked out yet.`
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
  const repeated = repeatedDistances(examples);
  const contradictory = hasContradiction(examples);

  const ruleSentence = fitted
    ? `${round(fitted.intercept, 1)} minutes to start, ${round(fitted.slope, 2)} minutes for every ${DISTANCE_UNIT}`
    : null;

  return <section className="predictor-lab" aria-labelledby="predictor-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A playable idea · runs in your browser</p>
        <h3 id="predictor-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Nobody writes the rule.</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>
    <p className="mt-3 max-w-2xl text-base">These are past deliveries: how far, and how long it actually took. Change a time, or add a trip of your own, then ask for a rule and see what comes out.</p>

    <div className="predictor-split mt-5">
      <p className="text-sm font-medium">We chose the shape. Your examples choose the numbers.</p>
      <p className="text-muted-foreground mt-1 text-xs">The shape is fixed here: one straight line, <em>a start, plus a rate for every {DISTANCE_UNIT}</em>. Nothing in this panel decides what the start and the rate are. They are worked out from whatever examples are in the list, by the same least-squares method underneath every button.</p>
    </div>

    <div className="mt-5">
      <p className="text-sm font-medium">Start from a set of observations</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map(preset => <Button key={preset.label} type="button" size="touch" variant={presetLabel === preset.label ? 'default' : 'outline'} onClick={() => choosePreset(preset)}>{preset.label}</Button>)}
      </div>
      {presetLabel && <p className="text-muted-foreground mt-2 text-xs">{PRESETS.find(preset => preset.label === presetLabel)?.note}</p>}
    </div>

    <div className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-xl">The examples you are giving it</h4>
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
              <NumberField id={`${row.id}-distance`} label="Distance" name={`Example ${position} distance in ${DISTANCE_UNIT}`} unit={DISTANCE_UNIT} value={row.distance} max={MAX_DISTANCE} onChange={value => edit(row.id, 'distance', value)} />
              <NumberField id={`${row.id}-minutes`} label="Time it took" name={`Example ${position} observed time in minutes`} unit={MINUTES_UNIT} value={row.minutes} max={MAX_MINUTES} onChange={value => edit(row.id, 'minutes', value)} />
              <Button variant="ghost" size="icon-touch" onClick={() => remove(row.id)} aria-label={`Remove example ${position}${row.distance === null ? '' : `, at ${row.distance} ${DISTANCE_UNIT}`}`}><X aria-hidden /></Button>
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
        <Button variant="outline" size="touch" onClick={add} disabled={rows.length >= MAX_ROWS}><Plus aria-hidden />Add an example</Button>
        {rows.length >= MAX_ROWS && <p className="text-muted-foreground text-xs">{MAX_ROWS} is as many as this panel draws.</p>}
        {incomplete > 0 && <p className="text-muted-foreground text-xs">{incomplete} {incomplete === 1 ? 'row is' : 'rows are'} not counted yet.</p>}
      </div>
    </div>

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button size="touch" onClick={learn} disabled={current}>Learn from these examples <ArrowRight aria-hidden /></Button>
      <p className={cn('text-sm', current ? 'text-muted-foreground' : 'font-medium')}>
        {!fit ? 'No rule yet. Nothing has been worked out from these numbers.'
          : current ? fit.status === 'fitted' ? 'The rule below was worked out from exactly these examples.' : 'That ran on exactly these examples, and no rule came out of them.'
          : 'The examples have changed. The rule below still comes from the old ones.'}
      </p>
    </div>

    <Plot examples={examples} fit={current ? fit : null} queryDistance={queryDistance} prediction={current ? prediction : null} />

    <div aria-live="polite" aria-atomic="true" className="mt-4">
      {fit && fit.status === 'undetermined' ? <div className="predictor-undetermined">
        <p className="font-display text-xl">No rule came out of that.</p>
        <p className="mt-2 text-sm">{
          fit.reason === 'no-examples' ? 'There are no complete examples to work from. With nothing to fit, there is nothing to fit to.'
            : fit.reason === 'one-example' ? 'One example fixes a single point. Every rate you can imagine passes through it, so the examples do not say which one is right.'
            : `Every example is at the same distance, so nothing in this data shows what happens when the distance changes. Any rate at all fits these observations equally well.`
        }</p>
        <p className="text-muted-foreground mt-2 text-sm">Rather than show a made-up rate, this reports that the examples did not determine one. {fit.reason === 'no-spread' ? 'Add a trip at a different distance and run it again.' : 'Add examples at two different distances and run it again.'}</p>
      </div> : fitted ? <div className="predictor-rule">
        <p className="eyebrow">The rule that came out</p>
        <p className="font-display mt-2 text-xl">{ruleSentence}.</p>
        <p className="mt-2 text-sm">Neither number was typed by anyone. They are the pair that leaves the smallest total miss across the {fitted.examples.length} examples it was given.</p>
        <p className="mt-2 font-mono text-sm tabular-nums">
          {fitted.exact ? 'Average miss 0 — every example reproduced exactly.' : `Average miss ${round(fitted.meanAbsoluteError, 2)} ${MINUTES_UNIT} · worst ${round(Math.max(...fitted.residuals.map(Math.abs)), 1)} ${MINUTES_UNIT}`}
        </p>
      </div> : null}
    </div>

    {contradictory && fitted && current && <div className="predictor-clash mt-4">
      <p className="font-display text-xl">One distance, two different answers.</p>
      <p className="mt-2 text-sm">{repeated.length === 1 ? `${minus(repeated[0])} ${DISTANCE_UNIT} appears more than once with different observed times.` : `${repeated.map(d => `${minus(d)} ${DISTANCE_UNIT}`).join(' and ')} each appear more than once with different observed times.`} The rule returns one number for a given distance, so it cannot match both. It is not discarding either: it sits between them, and both misses show in the list above.</p>
    </div>}

    <div className="mt-5">
      <h4 className="font-display text-xl">Ask it about a trip it never saw</h4>
      <p className="text-muted-foreground mt-1 text-sm">This reads the rule above. It only changes when you run the fit again.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <span className="min-w-[9rem] flex-1">
          <label htmlFor="predictor-query" className="text-muted-foreground block text-2xs">New distance</label>
          <input
            id="predictor-query"
            type="range"
            min={0}
            max={MAX_DISTANCE}
            step={0.5}
            value={queryDistance}
            onChange={event => setQueryDistance(Number(event.target.value))}
            aria-valuetext={prediction !== null && current ? `${queryDistance} ${DISTANCE_UNIT}, rule predicts ${round(prediction, 1)} minutes` : `${queryDistance} ${DISTANCE_UNIT}, no rule to read yet`}
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
      <p className="predictor-readout mt-3">
        {current && prediction !== null
          ? <>At <strong className="font-mono tabular-nums">{queryDistance} {DISTANCE_UNIT}</strong> the rule predicts <strong className="font-mono tabular-nums">{round(prediction, 1)} {MINUTES_UNIT}</strong>. No delivery in the list has to be at that distance — the rule answers anywhere.</>
          : fit && !current
            ? <>Run the fit again to read a rule that matches the examples now on screen.</>
            : <>Nothing to read yet. Run the fit and this answers for any distance.</>}
      </p>
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
        <p>One input, one output, and a shape chosen in advance by us rather than found in the data. Real systems have many inputs, shapes with millions of parameters, and no formula that solves them outright — they are nudged towards a fit step by step instead.</p>
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
