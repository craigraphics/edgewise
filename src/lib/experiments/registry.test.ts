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
    expect(isExperimentId('hallucination')).toBe(false);
    expect(isExperimentId(null)).toBe(false);
    expect(isExperimentId(undefined)).toBe(false);
  });

  /**
   * The prompt opens the existing explanation form. It has to ask for the
   * mechanism, and it must never hand the learner a verdict or an answer to
   * repeat back — the same rule the walkthrough openers are held to.
   *
   * The judging words are checked against the prompt's OWN words, with anything
   * it quotes removed first. The `loss` node's whole subject is the difference
   * between "wrong" and "wrong by this much", so a flat ban on the string would
   * have forced that node to ask its question in words it does not use. What is
   * being banned is a verdict on the learner, not a piece of vocabulary, and
   * the verdict phrases below are still checked against the entire prompt.
   */
  const unquoted = (prompt: string) => prompt.replace(/[“"][^”"]*[”"]/g, ' ');

  it('asks for a mechanism and never grades', () => {
    for (const id of EXPERIMENT_IDS) {
      const prompt = EXPERIMENT_PROMPT[id].toLowerCase();
      expect(prompt).toContain('?');
      for (const banned of ['correct', 'wrong', 'score', 'well done', 'you got']) {
        expect(unquoted(prompt), `${id} prompt`).not.toContain(banned);
      }
      for (const verdict of ['well done', 'you got', 'your answer', 'you are right', 'you are wrong', 'incorrect']) {
        expect(prompt, `${id} prompt`).not.toContain(verdict);
      }
    }
  });

  /** The quote-stripping must not be a way round the rule it relaxes. */
  it('still rejects a verdict that happens to sit inside quotation marks', () => {
    expect(unquoted('that was “correct”, well done')).toContain('well done');
    expect(unquoted('was your answer “wrong”?')).toContain('your answer');
  });

  it('has complete copy and reset entries for every playable idea', () => {
    const graphIds = new Set(GRAPH.nodes.map(node => node.id));
    const tables = [
      EMPTY_EXPLAIN_REQUESTS,
      EXPERIMENT_TITLE_ID,
      EXPERIMENT_ACTION,
      EXPERIMENT_HEADLINE,
      EXPERIMENT_PROMPT,
    ];

    for (const id of EXPERIMENT_IDS) {
      expect(graphIds.has(id), id).toBe(true);
      for (const table of tables) expect(Object.hasOwn(table, id), id).toBe(true);
      expect(EXPERIMENT_TITLE_ID[id], id).not.toBe('');
      expect(EXPERIMENT_ACTION[id], id).not.toBe('');
      expect(EXPERIMENT_HEADLINE[id], id).not.toBe('');
      expect(EXPERIMENT_PROMPT[id], id).not.toBe('');
    }
    expect(new Set(Object.values(EXPERIMENT_TITLE_ID)).size).toBe(EXPERIMENT_IDS.length);
  });

  it('registers the working-backwards experiment with its learner-facing copy', () => {
    expect(EXPERIMENT_IDS).toContain('backprop-intuition');
    expect(EXPERIMENT_TITLE_ID['backprop-intuition']).toBe('backprop-lab-title');
    expect(EXPERIMENT_ACTION['backprop-intuition']).toBe('Try the working-backwards experiment');
    expect(EXPERIMENT_HEADLINE['backprop-intuition']).toBe('One difference, worked back through two settings.');
    expect(EXPERIMENT_PROMPT['backprop-intuition']).toBe('How did the difference at the end tell us which way to move both earlier settings, and what happened before the settings changed?');
  });
});
