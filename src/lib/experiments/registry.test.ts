import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import {
  EMPTY_EXPLAIN_REQUESTS,
  EXPERIMENT_ACTION,
  EXPERIMENT_HEADLINE,
  EXPERIMENT_IDS,
  EXPERIMENT_PROMPT,
  EXPERIMENT_TITLE_ID,
  isExperimentId,
} from './registry';

describe('the experiment registry', () => {
  it('names concepts that actually exist in the graph', () => {
    for (const id of EXPERIMENT_IDS) {
      expect(GRAPH.nodes.some(node => node.id === id), `${id} is not a concept`).toBe(true);
    }
  });

  it('carries every piece of copy the shell looks up', () => {
    for (const id of EXPERIMENT_IDS) {
      for (const table of [EXPERIMENT_ACTION, EXPERIMENT_HEADLINE, EXPERIMENT_PROMPT, EXPERIMENT_TITLE_ID]) {
        expect(table[id]?.length ?? 0).toBeGreaterThan(0);
      }
      expect(EMPTY_EXPLAIN_REQUESTS[id]).toBe(0);
    }
  });

  it('recognises only those ids', () => {
    expect(isExperimentId('prediction-from-examples')).toBe(true);
    expect(isExperimentId('neuron')).toBe(true);
    expect(isExperimentId('attention')).toBe(false);
    expect(isExperimentId(null)).toBe(false);
    expect(isExperimentId(undefined)).toBe(false);
  });

  /**
   * The prompt opens the existing explanation form. It has to ask for the
   * mechanism, and it must never hand the learner a verdict or an answer to
   * repeat back — the same rule the walkthrough openers are held to.
   */
  it('asks for a mechanism and never grades', () => {
    for (const id of EXPERIMENT_IDS) {
      const prompt = EXPERIMENT_PROMPT[id].toLowerCase();
      expect(prompt).toContain('?');
      for (const banned of ['correct', 'wrong', 'score', 'well done', 'you got']) {
        expect(prompt, `${id} prompt`).not.toContain(banned);
      }
    }
  });
});
