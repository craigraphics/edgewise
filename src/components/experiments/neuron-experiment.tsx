'use client';

import { useState } from 'react';
import { ArrowRight, Film, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BASELINE, BIAS, compareOutput, INITIAL_WEIGHTS, INPUTS, runNeuron, type Prediction, type Weights } from '@/lib/experiments/neuron';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useNeuronExperiment> };
const signed = (n: number) => n < 0 ? `−${Math.abs(n)}` : String(n);

/** Kept at workspace level so map/view navigation never resets an experiment. */
export function useNeuronExperiment() {
  const [weights, setWeights] = useState<Weights>(INITIAL_WEIGHTS);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [result, setResult] = useState<ReturnType<typeof runNeuron> | null>(null);
  const changed = weights.some((w, i) => w !== INITIAL_WEIGHTS[i]);

  function changeWeight(index: number, value: number) {
    setWeights(previous => index === 0 ? [value, previous[1]] : [previous[0], value]);
    setPrediction(null);
    setResult(null);
  }

  const reset = () => { setWeights(INITIAL_WEIGHTS); setPrediction(null); setResult(null); };
  return { weights, prediction, result, changed, changeWeight, setPrediction, run: () => { if (changed && prediction) setResult(runNeuron(weights)); }, reset };
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function NeuronExperiment({ onExplain, experiment }: Props) {
  const { weights, prediction, result, changed, changeWeight, setPrediction, run, reset } = experiment;
  const resultComparedWithStart = result ? compareOutput(result.output) : null;

  return <section className="neuron-lab" aria-labelledby="neuron-lab-title">
    {/*
     * No Reset in this header. It used to sit here ungated, so the first
     * interactive control in the panel was one that undid nothing — and at
     * narrow widths it wrapped onto its own row, which meant showing it once
     * something had changed would have pushed the sliders further down. It
     * lives below the action now, where appearing cannot move anything above it.
     */}
    <p className="eyebrow">A quick experiment · runs in your browser</p>
    <h3 id="neuron-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">How does one neuron score a movie?</h3>
    <p className="mt-3 max-w-2xl text-base">One neuron turns a movie’s two numbers into a single match score — without ever seeing the film.</p>

    {/* The setup: what the neuron is given, and what it does with it untouched.
        Side by side once there is room, because neither is the thing to read. */}
    <div className="neuron-setup mt-5">
      <div className="neuron-movie">
        <div className="neuron-movie-title">
          <span className="neuron-movie-icon" aria-hidden><Film size={22} /></span>
          <span><span className="eyebrow block">Tonight’s movie</span><strong className="mt-1 block">A comedy mystery</strong></span>
        </div>
        <div className="neuron-features" aria-label="The movie represented as two numbers">
          <span><span className="text-muted-foreground text-xs">Comedy</span><strong className="font-display">2</strong></span>
          <span><span className="text-muted-foreground text-xs">Mystery</span><strong className="font-display">1</strong></span>
        </div>
      </div>

      <div className="neuron-baseline flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">Untouched</span>
        <span>both count once</span><ArrowRight size={15} aria-hidden />
        <span>score <strong className="font-mono">{BASELINE.output}</strong></span>
      </div>
    </div>

    <fieldset className="mt-5 min-w-0">
      <legend className="text-sm font-medium">1. Change what matters</legend>
      <p className="text-muted-foreground mt-1 text-sm">These are the neuron’s <strong className="text-foreground">weights</strong>: how strongly each number counts.</p>
      <div className="neuron-machine mt-3">
        <div className="space-y-3">
          {INPUTS.map((input, i) => <div key={i} className="neuron-input">
            <div className="flex items-center justify-between gap-3">
              <span><span className="text-muted-foreground block text-xs">{i === 0 ? 'Comedy' : 'Mystery'} · number {input}</span><label htmlFor={`neuron-weight-${i}`} className="text-sm font-medium">How much it counts</label></span>
              <output htmlFor={`neuron-weight-${i}`} className="neuron-weight-value font-mono font-medium">{signed(weights[i])}×</output>
            </div>
            <input id={`neuron-weight-${i}`} type="range" min={-2} max={2} step={0.5} value={weights[i]} aria-label={`How much ${i === 0 ? 'comedy' : 'mystery'} counts`} aria-valuetext={`${weights[i]} times the movie number ${input}`} onChange={e => changeWeight(i, Number(e.target.value))} className="neuron-slider mt-2 w-full" />
            <div aria-hidden className="text-muted-foreground flex justify-between text-xs"><span>Counts against</span><span>Ignore</span><span>Counts toward</span></div>
          </div>)}
        </div>
        <div className="neuron-operator" aria-hidden><span>×</span><span>+</span><span>↗</span></div>
        <div className="neuron-output">
          <p className="eyebrow">One match score</p>
          <div className={cn('neuron-output-value font-display', result && 'neuron-reveal')} key={result ? `${weights}` : 'hidden'} aria-hidden>{result ? signed(result.output) : '?'}</div>
          <p className="text-muted-foreground text-xs">The neuron’s output</p>
        </div>
      </div>
    </fieldset>

    <fieldset className="mt-5" disabled={!changed || result !== null}>
      <legend className="text-sm font-medium">2. Compared with the starting score of 1, will the new score be…</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['higher', 'lower', 'same'] as const).map(choice => <label key={choice} className={cn('neuron-choice', prediction === choice && 'neuron-choice-selected')}>
          <input type="radio" name="neuron-prediction" value={choice} checked={prediction === choice} onChange={() => setPrediction(choice)} />
          {choice === 'same' ? 'The same' : choice === 'higher' ? 'Higher' : 'Lower'}
        </label>)}
      </div>
    </fieldset>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button size="touch" disabled={!changed || !prediction || result !== null} onClick={() => { run(); requestAnimationFrame(() => document.getElementById('neuron-result')?.scrollIntoView({ block: 'nearest' })); }}>Score the movie <ArrowRight aria-hidden /></Button>
      <p className="text-muted-foreground text-sm">{result ? 'Move either setting to try again.' : changed ? 'Make a prediction, then see what happens.' : 'Move either slider to begin. Arrow keys work too.'}</p>
      {/* Offered only once a weight has moved: a Reset on an untouched screen
          is a control with nothing to do. `changed` is the same flag the
          prediction and the score button already wait for. */}
      {changed && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>

    <div aria-live="polite" aria-atomic="true">
      {result && <div id="neuron-result" className="neuron-result mt-5">
        <p className="font-display text-xl">{resultComparedWithStart === prediction ? 'That’s what happened.' : `You expected ${prediction === 'same' ? 'the same score' : `a ${prediction} score`}. Here’s what happened.`} The match score is {result.output}{resultComparedWithStart === 'same' ? ', still the same.' : `, ${resultComparedWithStart} than 1.`}</p>

        <div className="neuron-arithmetic mt-4">
          <p className="eyebrow">How two numbers became one</p>
          <ol className="mt-3 space-y-2 text-sm">
            <li><span className="neuron-step">1</span><span>Comedy contributes <strong className="font-mono">{signed(result.contributions[0])}</strong>: movie number 2 × weight {signed(weights[0])}.</span></li>
            <li><span className="neuron-step">2</span><span>Mystery contributes <strong className="font-mono">{signed(result.contributions[1])}</strong>: movie number 1 × weight {signed(weights[1])}.</span></li>
            <li><span className="neuron-step">3</span><span>Add both contributions and a fixed starting number of {signed(BIAS)}: the total is <strong className="font-mono">{signed(result.total)}</strong>.</span></li>
            <li><span className="neuron-step">4</span><span>{result.total < 0 ? `The last rule turns a negative total into zero, so ${signed(result.total)} becomes 0.` : `The last rule keeps zero or anything above it, so ${signed(result.total)} stays ${signed(result.output)}.`}</span></li>
          </ol>
        </div>

        <div className="neuron-takeaway mt-4">
          <p className="font-display text-xl">That small calculation is an artificial neuron.</p>
          <p className="mt-2 text-sm">Numbers come in. A weight makes each one count more, less, or against the result. The neuron adds them, applies one simple last rule, and sends one number out. The last rule used here is called <strong>ReLU</strong>.</p>
          <p className="mt-2 text-sm"><strong>No tiny brain judged the movie.</strong> The movie story only gives the arithmetic familiar names.</p>
        </div>

        <Button className="mt-4" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground mt-2 text-xs">Trying the experiment leaves your map unchanged. Your own explanation is what can move this idea.</p>
      </div>}
    </div>
    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">Where the movie example stops</summary>
      <p className="pt-2">This is a made-up scorer with two inputs, a fixed starting number (the <strong className="text-foreground">bias</strong>) of −2, and one final rule (the <strong className="text-foreground">activation function</strong>) called ReLU. A real network has many neurons with many inputs. During training, their weights and biases are learned rather than moved by hand. One neuron does not understand or recognise a movie, and a whole recommendation system does much more than this one calculation.</p>
    </details>
  </section>;
}
