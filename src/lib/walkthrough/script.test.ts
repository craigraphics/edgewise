import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import type { ConceptNode } from '@/lib/graph/types';

import { spokenForm, stepFor } from './script';

const node = (id: string): ConceptNode => GRAPH.nodes.find((entry) => entry.id === id)!;

const neuron = node('neuron'); // has a simplificationCost
const tokens = node('tokens'); // has none

describe('stepFor', () => {
  it('gives a node the learner already had a brief pass, not the full teach', () => {
    // Re-teaching in full something they have just demonstrated reads as not
    // having listened.
    const step = stepFor(neuron, 'known');
    expect(step.brief).toBe(true);
    expect(step.body).toHaveLength(1);
  });

  it('teaches everything else in full, including what they got wrong', () => {
    // The walkthrough goes through every node — being blocked on one is the
    // reason to cover it, not a reason to skip it.
    for (const state of ['shaky', 'blocked', 'unexplored'] as const) {
      const step = stepFor(neuron, state);
      expect(step.brief).toBe(false);
      expect(step.body).toHaveLength(2);
    }
  });

  it('never says how they did', () => {
    // No scoring, in any state. A walkthrough that keeps reporting your
    // diagnostic result is the diagnostic again.
    const graded = /\b(correct|wrong|right|failed|score|mistake|incorrect)\b/i;
    for (const state of ['known', 'shaky', 'blocked', 'unexplored'] as const) {
      expect(stepFor(neuron, state).opener).not.toMatch(graded);
    }
  });

  it('carries the simplification cost whenever the node declares one', () => {
    expect(stepFor(neuron, 'blocked').caveat).toBe(neuron.simplificationCost);
    expect(stepFor(tokens, 'blocked').caveat).toBeNull();
  });

  it('carries the cost even on the brief pass', () => {
    // Someone who already holds the idea can still be holding the misleading
    // version of it, so the caveat is exactly what they need.
    expect(stepFor(neuron, 'known').caveat).toBe(neuron.simplificationCost);
  });
});

describe('spokenForm', () => {
  it('reads as one continuous utterance', () => {
    const spoken = spokenForm(stepFor(neuron, 'blocked'));
    expect(spoken).toContain(neuron.explanations.intuition);
    expect(spoken).toContain(neuron.explanations.example);
    expect(spoken).not.toContain('\n');
  });

  it('flags the caveat aloud rather than dropping it', () => {
    expect(spokenForm(stepFor(neuron, 'blocked'))).toContain(neuron.simplificationCost!);
  });

  it('omits the flag entirely when there is nothing to flag', () => {
    expect(spokenForm(stepFor(tokens, 'blocked'))).not.toContain('worth flagging');
  });

  it('contains no markdown, since it is spoken', () => {
    for (const entry of GRAPH.nodes) {
      expect(spokenForm(stepFor(entry, 'unexplored'))).not.toMatch(/[#*_`]|^- /m);
    }
  });
});
