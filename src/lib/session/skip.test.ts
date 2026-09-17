import { describe, expect, it } from 'vitest';

import { nextToAsk, withMark } from '@/lib/graph/frontier';
import { GRAPH } from '@/lib/graph/load';
import type { LearnerModel } from '@/lib/graph/types';

import { FINAL_ACKNOWLEDGEMENT, isSkip, skipTurn } from './skip';

const empty: LearnerModel = { graphVersion: GRAPH.version, states: {} };
const ROOT = GRAPH.nodes.find((node) => node.prerequisites.length === 0)!;

describe('isSkip', () => {
  it('recognises the four intents, whatever the case or punctuation', () => {
    for (const answer of ['skip', 'SKIP', 'Skip.', ' pass ', 'Pass!', 'next', 'Next?', 'move on', 'Move on.', "Let's move on", 'skip this one', 'Next question']) {
      expect(isSkip(answer), answer).toBe(true);
    }
  });

  /*
   * The costly mistake is the other direction: an answer that happens to use
   * one of these words is an answer, and discarding it as a skip throws away
   * the most useful thing somebody said.
   */
  it('never treats a real answer containing those words as a skip', () => {
    for (const answer of [
      'It predicts the next word from the ones before it',
      'You pass the input through each layer',
      'I would skip the maths and say it nudges the weights',
      'move on to the next layer',
      'skipping',
      'bypass',
      '',
    ]) {
      expect(isSkip(answer), answer).toBe(false);
    }
  });
});

describe('skipTurn', () => {
  it('records the skipped node exactly as "I don\'t know" is recorded', () => {
    const turn = skipTurn(GRAPH, empty, ROOT);
    expect(turn.mark).toEqual({ nodeId: ROOT.id, state: 'blocked' });
    expect(turn.followUps).toBe(0);
  });

  /* The reported failure: "skip" came back as unclear and the same node was asked again. */
  it('never asks the skipped node again', () => {
    let learner = withMark(empty, ROOT.id, 'known');
    let steps = 0;

    for (let current = nextToAsk(GRAPH, learner); current; steps++) {
      const turn = skipTurn(GRAPH, learner, current);
      expect(turn.nodeId).not.toBe(current.id);
      learner = withMark(learner, turn.mark.nodeId, turn.mark.state);
      current = turn.nodeId ? GRAPH.nodes.find((node) => node.id === turn.nodeId)! : null;
      expect(steps).toBeLessThan(GRAPH.nodes.length);
    }

    expect(steps).toBeGreaterThan(1);
  });

  it('asks the next node’s first probe after a short acknowledgement', () => {
    const learner = withMark(empty, ROOT.id, 'known');
    const current = nextToAsk(GRAPH, learner)!;
    const turn = skipTurn(GRAPH, learner, current);
    const next = GRAPH.nodes.find((node) => node.id === turn.nodeId)!;

    expect(turn.done).toBe(false);
    expect(turn.say.endsWith(next.probes[0])).toBe(true);
    expect(turn.closing).toBeNull();
  });

  it('ends on the scripted acknowledgement and closing when nothing is left to ask', () => {
    const turn = skipTurn(GRAPH, empty, ROOT);
    expect(turn.done).toBe(true);
    expect(turn.nodeId).toBeNull();
    expect(turn.say).toBe(FINAL_ACKNOWLEDGEMENT);
    expect(turn.closing).toMatch(/is the place to start from/);
  });

  it('never grades in its own words', () => {
    const learner = withMark(empty, ROOT.id, 'known');
    const turn = skipTurn(GRAPH, learner, nextToAsk(GRAPH, learner)!);
    for (const line of [turn.say, FINAL_ACKNOWLEDGEMENT]) {
      expect(line).not.toMatch(/wrong|correct|fail|score|unclear|aren.t clear/i);
    }
  });
});
