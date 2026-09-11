/** A two-input ReLU neuron. Bias is fixed so the experiment isolates weights. */
export const INPUTS = [2, 1] as const;
export const BIAS = -2;
export const INITIAL_WEIGHTS = [1, 1] as const;
export type Weights = readonly [number, number];
export type Prediction = 'higher' | 'lower' | 'same';

export function runNeuron(weights: Weights) {
  const contributions = [INPUTS[0] * weights[0], INPUTS[1] * weights[1]] as const;
  const total = contributions[0] + contributions[1] + BIAS;
  return { contributions, total, output: Math.max(0, total) };
}

export const BASELINE = runNeuron(INITIAL_WEIGHTS);

export function compareOutput(output: number): Prediction {
  return output > BASELINE.output ? 'higher' : output < BASELINE.output ? 'lower' : 'same';
}
