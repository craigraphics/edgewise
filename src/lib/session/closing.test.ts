import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import type { LearnerModel, NodeState } from '@/lib/graph/types';

import { ENOUGH_TO_INTERPRET, closingFor, nothingToAsk } from './closing';

const model = (states: Record<string, NodeState>): LearnerModel => ({
  graphVersion: GRAPH.version,
  states,
});

const ROOT = GRAPH.nodes.find((node) => node.prerequisites.length === 0)!;

describe('closingFor', () => {
  /*
   * The reported failure, exactly. One "I don't know" on the root ends the
   * session — correctly, because nothing below an unknown root can be asked
   * about — and the closing then explained to the learner why their last few
   * years had felt the way they did.
   */
  it('does not interpret the learner’s history after a single answer', () => {
    const line = closingFor(GRAPH, model({ [ROOT.id]: 'blocked' }));
    expect(line).not.toMatch(/felt slippery/);
    expect(line).not.toMatch(/probably/);
  });

  it('says why one answer was enough, so the ending does not read as giving up', () => {
    const line = closingFor(GRAPH, model({ [ROOT.id]: 'blocked' }));
    expect(line).toMatch(/one answer is enough/i);
    expect(line).toMatch(/everything else on the map rests on it/i);
  });

  /* The structural half is always said: it is the thing the graph exists for. */
  it('always names the place to start and what rests on it', () => {
    for (const state of ['blocked', 'shaky', 'unexplored'] as const) {
      const line = closingFor(GRAPH, model({ [ROOT.id]: state }));
      expect(line).toMatch(/is the place to start from/);
      expect(line).toMatch(/\d+ of the later ideas rest on it/);
    }
  });

  it('earns the interpretation once several answers are behind it', () => {
    const states: Record<string, NodeState> = {};
    for (const node of GRAPH.nodes.slice(0, ENOUGH_TO_INTERPRET)) states[node.id] = 'known';
    expect(closingFor(GRAPH, model(states))).toMatch(/felt slippery/);
  });

  it('withholds it right up to the threshold', () => {
    const states: Record<string, NodeState> = {};
    for (const node of GRAPH.nodes.slice(0, ENOUGH_TO_INTERPRET - 1)) states[node.id] = 'known';
    expect(closingFor(GRAPH, model(states))).not.toMatch(/felt slippery/);
  });

  it('never says the interpretation without the structure that grounds it', () => {
    const states: Record<string, NodeState> = {};
    for (const node of GRAPH.nodes) {
      states[node.id] = 'known';
      const line = closingFor(GRAPH, model(states));
      if (!line.includes('felt slippery')) continue;
      expect(line).toMatch(/\d+ of the later ideas rest on it/);
    }
  });

  /*
   * Never a score and never a count of the learner. The one number allowed is a
   * fact about the graph — how many ideas rest on the frontier — so the check
   * is for the SHAPES a score takes, not for words. "Getting less wrong" is a
   * node label, and an earlier version of this test failed on it, which is the
   * useful reminder that the rule is about what a sentence claims rather than
   * about a vocabulary list.
   */
  it('never reads as a score', () => {
    const states: Record<string, NodeState> = {};
    for (const node of GRAPH.nodes) {
      states[node.id] = 'known';
      const line = closingFor(GRAPH, model(states));
      expect(line).not.toMatch(/\b\d+\s*(of|out of|\/)\s*\d+\b/);
      expect(line).not.toMatch(/%|\bscore\b|\bmarks?\b|\bresult\b/i);
    }
  });
});

describe('nothingToAsk', () => {
  it('does not claim the learner has the whole map', () => {
    const line = nothingToAsk(GRAPH, model({ [ROOT.id]: 'shaky' }));
    expect(line).not.toMatch(/whole map/);
    expect(line).toMatch(/nothing new to place/);
  });
});
