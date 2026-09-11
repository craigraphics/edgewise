import { describe, expect, it } from 'vitest';
import { BASELINE, compareOutput, runNeuron } from './neuron';

describe('the playable neuron', () => {
  it('starts at one and distinguishes each input’s influence', () => {
    expect(BASELINE.output).toBe(1);
    expect(runNeuron([1.5, 1]).output).toBe(2);
    expect(runNeuron([1, 1.5]).output).toBe(1.5);
  });

  it('keeps zero and positive totals, and bends every negative total to zero', () => {
    for (let a = -2; a <= 2; a += 0.5) {
      for (let b = -2; b <= 2; b += 0.5) {
        const result = runNeuron([a, b]);
        expect(result.output).toBeGreaterThanOrEqual(0);
        expect(result.output).toBe(result.total < 0 ? 0 : result.total);
      }
    }
    expect(runNeuron([-2, -2])).toEqual({ contributions: [-4, -2], total: -8, output: 0 });
    expect(runNeuron([0.5, 1]).output).toBe(0);
  });

  it('allows different weights to produce the same output', () => {
    expect(compareOutput(runNeuron([0.5, 2]).output)).toBe('same');
    expect(compareOutput(runNeuron([2, 2]).output)).toBe('higher');
    expect(compareOutput(runNeuron([0, 0]).output)).toBe('lower');
  });
});
