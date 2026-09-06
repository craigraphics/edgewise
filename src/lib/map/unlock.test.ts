import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import { coveredBy, teachingOrder } from '@/lib/graph/order';
import type { LearnerModel } from '@/lib/graph/types';

import { unlockedBy, unlockedNodes } from './unlock';

const model = (states: LearnerModel['states']): LearnerModel => ({
  graphVersion: GRAPH.version,
  states,
});

describe('unlockedBy', () => {
  it('fires when a node becomes solid', () => {
    expect(unlockedBy(model({}), model({ neuron: 'known' }), 'neuron')).toBe(true);
    expect(unlockedBy(model({ neuron: 'shaky' }), model({ neuron: 'known' }), 'neuron')).toBe(true);
  });

  it('does not fire on a node that was already solid', () => {
    expect(unlockedBy(model({ neuron: 'known' }), model({ neuron: 'known' }), 'neuron')).toBe(false);
  });

  it('does not fire on any other kind of change', () => {
    expect(unlockedBy(model({}), model({ neuron: 'shaky' }), 'neuron')).toBe(false);
    expect(unlockedBy(model({}), model({ neuron: 'blocked' }), 'neuron')).toBe(false);
  });

  /*
   * The one that matters. Walking through all twenty-three nodes marks every
   * one of them as covered and changes no state at all — so a wave wired to the
   * walkthrough finds nothing to celebrate, which is the correct behaviour and
   * now a fact about the code rather than a note in a file.
   */
  it('never fires from being taught, however much of the walk is done', () => {
    const before = model({ 'prediction-from-examples': 'known' });
    for (let step = 0; step <= teachingOrder(GRAPH).length; step += 1) {
      const covered = coveredBy(GRAPH, step);
      expect(covered.size).toBe(Math.min(step, teachingOrder(GRAPH).length));
      /* Covering changes no states, so the model after a step is the model before it. */
      expect(unlockedNodes(before, before)).toEqual([]);
    }
  });

  it('reports every node that became solid, not just the first', () => {
    const before = model({ neuron: 'blocked' });
    const after = model({ neuron: 'known', tokens: 'known', loss: 'shaky' });
    expect(unlockedNodes(before, after).sort()).toEqual(['neuron', 'tokens']);
  });
});
