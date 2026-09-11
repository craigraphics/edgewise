'use client';

import { useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
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
  return <section className="neuron-lab" aria-labelledby="neuron-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A playable idea · about a minute</p>
        <h3 id="neuron-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl sm:text-3xl">Make one number move.</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>
    <p className="mt-3 max-w-xl text-base">A neuron takes numbers in and gives one number out. Change how much each input counts. What happens on the other side?</p>

    <div className="neuron-baseline mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">Our starting point</span>
      <span>Both weights at 1</span><ArrowRight size={15} aria-hidden />
      <span>Output <strong className="font-mono">{BASELINE.output}</strong></span>
    </div>

    <fieldset className="mt-5 min-w-0">
      <legend className="text-sm font-medium">1. Change a weight</legend>
      <div className="neuron-machine mt-3">
        <div className="space-y-3">
          {INPUTS.map((input, i) => <div key={i} className="neuron-input">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Input {i === 0 ? 'A' : 'B'} <strong className="ml-2 font-mono text-xl">{input}</strong></span>
              <label htmlFor={`neuron-weight-${i}`} className="text-sm">Weight {i === 0 ? 'A' : 'B'} <output className="ml-1 inline-block min-w-9 text-right font-mono font-medium">{signed(weights[i])}</output></label>
            </div>
            <input id={`neuron-weight-${i}`} type="range" min={-2} max={2} step={0.5} value={weights[i]} aria-label={`Weight ${i === 0 ? 'A' : 'B'}`} aria-valuetext={`${weights[i]} times input ${input}`} onChange={e => changeWeight(i, Number(e.target.value))} className="neuron-slider mt-2 w-full" />
            <div aria-hidden className="text-muted-foreground flex justify-between text-xs"><span>−2 · subtract</span><span>0 · ignore</span><span>2 · add</span></div>
          </div>)}
        </div>
        <div className="neuron-operator" aria-hidden><span>×</span><span>+</span><span>↗</span></div>
        <div className="neuron-output">
          <p className="eyebrow">One output</p>
          <div className={cn('neuron-output-value font-display', result && 'neuron-reveal')} key={result ? `${weights}` : 'hidden'} aria-hidden>{result ? signed(result.output) : '?'}</div>
          <p className="text-muted-foreground text-xs">Multiply → add → bend</p>
        </div>
      </div>
    </fieldset>

    <fieldset className="mt-5" disabled={!changed || result !== null}>
      <legend className="text-sm font-medium">2. Compared with 1, will the output be…</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['higher', 'lower', 'same'] as const).map(choice => <label key={choice} className={cn('neuron-choice', prediction === choice && 'neuron-choice-selected')}>
          <input type="radio" name="neuron-prediction" value={choice} checked={prediction === choice} onChange={() => setPrediction(choice)} />
          {choice === 'same' ? 'The same' : choice === 'higher' ? 'Higher' : 'Lower'}
        </label>)}
      </div>
    </fieldset>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button size="touch" disabled={!changed || !prediction || result !== null} onClick={() => { run(); requestAnimationFrame(() => document.getElementById('neuron-result')?.scrollIntoView({ block: 'nearest' })); }}>Run the neuron <ArrowRight aria-hidden /></Button>
      <p className="text-muted-foreground text-sm">{result ? 'Move either weight to try again.' : changed ? 'Make a prediction, then see what happens.' : 'Move either slider to begin. Arrow keys work too.'}</p>
    </div>

    <div aria-live="polite" aria-atomic="true">
      {result && <div id="neuron-result" className="neuron-result mt-5">
        <p className="font-display text-xl">{compareOutput(result.output) === prediction ? 'That’s what happened.' : `You expected ${prediction === 'same' ? 'the same output' : `a ${prediction} output`}. Here’s what happened.`} The output is {result.output}{compareOutput(result.output) === 'same' ? ', still the same.' : `, ${compareOutput(result.output)} than 1.`}</p>
        <p className="mt-3 text-sm">Input A contributes {signed(result.contributions[0])} (2 × {signed(weights[0])}). Input B contributes {signed(result.contributions[1])} (1 × {signed(weights[1])}). Add them and the fixed bias ({signed(BIAS)}): the total is {signed(result.total)}.</p>
        <p className="mt-2 text-sm">{result.total < 0 ? `The final rule replaces a negative total with zero. So ${signed(result.total)} becomes 0.` : `The final rule keeps zero and positive totals and replaces negative ones with zero. So ${signed(result.total)} stays ${signed(result.output)}.`} This bend is called ReLU.</p>
        <Button className="mt-4" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground mt-2 text-xs">Trying the experiment leaves your map unchanged. Your own explanation is what can move this idea.</p>
      </div>}
    </div>
    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this model leaves out</summary>
      <p className="pt-2">Two inputs, a fixed bias of −2, and one particular bending function (ReLU). Real networks use many inputs and neurons, and other functions too. During training, weights and biases are learned. Here you adjust weights by hand to see the arithmetic; nothing is learning, thinking, or recognising an object.</p>
    </details>
  </section>;
}
