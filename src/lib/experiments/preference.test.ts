import { describe, expect, it } from 'vitest';

import {
  applyAction,
  chances,
  howFarOff,
  indexOfReply,
  initialChooser,
  learnFrom,
  OPENING_SCORES,
  percent,
  QUESTION,
  REPLIES,
  STEP,
  type Chooser,
  type Reply,
} from './preference';

/**
 * The expectations here are never taken from the functions being tested.
 *
 * The step is checked against a finite difference of the loss, which shares no
 * arithmetic with the closed-form gradient, and the opening round is worked out
 * on paper below. That is the "do not assert a measure against itself" rule this
 * project keeps: the tokenizer decoded `bpe_ranks` independently, the predictor
 * checked the least-squares conditions, the representation playground
 * brute-forced all 65,536 pictures, the loss panel used hand arithmetic, the
 * generalization panel used answers worked out on paper, word-neighbours pinned
 * to a published file, attention recomputed from literal `Math.exp` calls, and
 * the transformer kept a second implementation in its test file.
 */

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** The loss, written out again from its definition rather than imported. */
const lossByHand = (scores: readonly number[], chosen: number) => {
  const raised = scores.map(score => Math.exp(score));
  return -Math.log(raised[chosen] / sum(raised));
};

describe('turning scores into chances', () => {
  it('gives the opening scores the chances the panel opens on', () => {
    const opening = chances(OPENING_SCORES);
    expect(opening.map(value => Math.round(value * 100))).toEqual([55, 25, 20]);
  });

  it('always adds up to one', () => {
    for (const scores of [OPENING_SCORES, [0, 0, 0], [-4, 9, 0.5], [7, 7, 7], [1000, -1000, 0]]) {
      expect(sum(chances(scores))).toBeCloseTo(1, 12);
    }
  });

  it('never produces a number that is not a number, however large the scores', () => {
    for (const scores of [[1000, 1000, 1000], [-1000, -1000, -1000], [1e6, 0, -1e6]]) {
      for (const value of chances(scores)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps a bigger score on a bigger chance', () => {
    const value = chances([0.5, 2, -1]);
    expect(value[1]).toBeGreaterThan(value[0]);
    expect(value[0]).toBeGreaterThan(value[2]);
  });

  it('gives equal scores equal chances', () => {
    expect(chances([3, 3, 3])).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });
});

describe('how far off a choice was', () => {
  it('is nothing when that reply already had all the chance', () => {
    expect(howFarOff([100, 0, 0], 0)).toBeCloseTo(0, 6);
  });

  it('matches the loss written out independently', () => {
    for (const scores of [OPENING_SCORES, [0, 0, 0], [-2, 1, 0.25]]) {
      for (let chosen = 0; chosen < 3; chosen += 1) {
        expect(howFarOff(scores, chosen)).toBeCloseTo(lossByHand(scores, chosen), 10);
      }
    }
  });

  it('is larger for a reply with less chance', () => {
    expect(howFarOff(OPENING_SCORES, 2)).toBeGreaterThan(howFarOff(OPENING_SCORES, 0));
  });
});

describe('one step of learning', () => {
  /**
   * The independent check. The step claims to move each score against the
   * gradient of the loss; a central difference measures that gradient without
   * sharing a line of arithmetic with the closed form.
   */
  it('moves each score against the measured slope of the loss', () => {
    const h = 1e-5;
    for (const scores of [OPENING_SCORES, [0, 0, 0], [-1.5, 0.75, 2]]) {
      for (let chosen = 0; chosen < 3; chosen += 1) {
        const after = learnFrom(scores, chosen, STEP);
        for (let index = 0; index < scores.length; index += 1) {
          const up = scores.map((value, at) => (at === index ? value + h : value));
          const down = scores.map((value, at) => (at === index ? value - h : value));
          const slope = (lossByHand(up, chosen) - lossByHand(down, chosen)) / (2 * h);
          expect(after[index] - scores[index]).toBeCloseTo(-STEP * slope, 6);
        }
      }
    }
  });

  /** Worked out on paper: p = [0.550295, 0.247263, 0.202442] from the opening scores. */
  it('lands where the arithmetic says, on the opening round', () => {
    const after = learnFrom(OPENING_SCORES, 1, 1);
    expect(after[0]).toBeCloseTo(1 - 0.550295, 5);
    expect(after[1]).toBeCloseTo(0.2 + (1 - 0.247263), 5);
    expect(after[2]).toBeCloseTo(0 - 0.202442, 5);
    expect(chances(after).map(value => Math.round(value * 100))).toEqual([31, 52, 16]);
  });

  it('raises the chosen reply and lowers the others, whichever one is chosen', () => {
    for (let chosen = 0; chosen < REPLIES.length; chosen += 1) {
      const before = chances(OPENING_SCORES);
      const after = chances(learnFrom(OPENING_SCORES, chosen));
      expect(after[chosen]).toBeGreaterThan(before[chosen]);
      for (let index = 0; index < REPLIES.length; index += 1) {
        if (index !== chosen) expect(after[index]).toBeLessThan(before[index]);
      }
    }
  });

  it('raises the chosen reply for every step size a panel could use', () => {
    for (const step of [0.05, 0.1, 0.25, 0.5, 1, 1.5, 2]) {
      const before = chances(OPENING_SCORES);
      const after = chances(learnFrom(OPENING_SCORES, 1, step));
      expect(after[1], `step ${step}`).toBeGreaterThan(before[1]);
      expect(howFarOff(learnFrom(OPENING_SCORES, 1, step), 1)).toBeLessThan(howFarOff(OPENING_SCORES, 1));
    }
  });

  it('keeps raising it over repeated rounds, and keeps the chances normalised', () => {
    let scores: readonly number[] = OPENING_SCORES;
    let last = chances(scores)[1];
    for (let round = 0; round < 12; round += 1) {
      scores = learnFrom(scores, 1);
      const now = chances(scores);
      expect(sum(now)).toBeCloseTo(1, 12);
      expect(now[1]).toBeGreaterThan(last);
      last = now[1];
    }
    expect(last).toBeLessThan(1);
  });

  it('returns one score per supplied reply, and never adds or removes one', () => {
    expect(OPENING_SCORES).toHaveLength(REPLIES.length);
    let scores: readonly number[] = OPENING_SCORES;
    for (let round = 0; round < 5; round += 1) {
      scores = learnFrom(scores, round % REPLIES.length);
      expect(scores).toHaveLength(REPLIES.length);
    }
  });
});

describe('pointing at a reply, and learning from it', () => {
  const learned = (state: Chooser, times: number) => {
    let current = state;
    for (let round = 0; round < times; round += 1) current = applyAction(current, { kind: 'learn' });
    return current;
  };

  it('opens with nothing chosen, nothing learned, and the opening scores', () => {
    const state = initialChooser();
    expect(state.scores).toBe(OPENING_SCORES);
    expect(state.chosen).toBeNull();
    expect(state.before).toBeNull();
    expect(state.rounds).toBe(0);
    expect(state.lastLearned).toBeNull();
  });

  /** The structural half of "no updates while merely inspecting or choosing". */
  it('leaves the scores untouched by reference when a reply is pointed at', () => {
    const state = initialChooser();
    const pointed = applyAction(state, { kind: 'select', id: 'first-step' });
    expect(pointed.chosen).toBe('first-step');
    expect(pointed.scores).toBe(state.scores);
    expect(pointed.rounds).toBe(0);
    expect(pointed.before).toBeNull();
  });

  it('leaves the scores untouched however many times the choice changes', () => {
    let state = initialChooser();
    for (const id of ['fuller', 'more-questions', 'first-step', 'fuller', 'first-step']) {
      state = applyAction(state, { kind: 'select', id });
      expect(state.scores).toBe(OPENING_SCORES);
    }
    expect(state.rounds).toBe(0);
  });

  it('does nothing at all when asked to learn with nothing chosen', () => {
    const state = initialChooser();
    expect(applyAction(state, { kind: 'learn' })).toBe(state);
  });

  it('ignores a reply that is not one of the three', () => {
    const state = initialChooser();
    expect(applyAction(state, { kind: 'select', id: 'bicycle-repair' })).toBe(state);
    expect(indexOfReply('bicycle-repair')).toBe(-1);
  });

  it('applies exactly one step per press, in order, with none lost or repeated', () => {
    const pointed = applyAction(initialChooser(), { kind: 'select', id: 'first-step' });
    for (const presses of [1, 2, 3, 7]) {
      const state = learned(pointed, presses);
      let expected: readonly number[] = OPENING_SCORES;
      for (let round = 0; round < presses; round += 1) expected = learnFrom(expected, 1);
      expect(state.scores, `${presses} presses`).toEqual(expected);
      expect(state.rounds).toBe(presses);
    }
  });

  it('remembers the chances from immediately before the last press', () => {
    const pointed = applyAction(initialChooser(), { kind: 'select', id: 'first-step' });
    const once = applyAction(pointed, { kind: 'learn' });
    expect(once.before).toEqual(chances(OPENING_SCORES));
    const twice = applyAction(once, { kind: 'learn' });
    expect(twice.before).toEqual(chances(once.scores));
    expect(twice.lastLearned).toBe('first-step');
  });

  it('goes all the way back on reset, from any state', () => {
    let state = applyAction(initialChooser(), { kind: 'select', id: 'fuller' });
    state = learned(state, 4);
    state = applyAction(state, { kind: 'select', id: 'more-questions' });
    state = learned(state, 2);
    const back = applyAction(state, { kind: 'reset' });
    expect(back).toEqual(initialChooser());
    expect(back.scores).toEqual(OPENING_SCORES);
  });
});

describe('what this can and cannot learn', () => {
  /**
   * The panel's stated limit, held to the code. Only the chance of choosing
   * among the supplied replies moves; no reply text and nothing about the
   * subject of the question is touched, so nothing here can improve an answer
   * to a question these three replies do not already answer.
   */
  it('never changes a single word of the question or the replies', () => {
    const question = QUESTION;
    const replies = structuredClone(REPLIES) as Reply[];
    let state = applyAction(initialChooser(), { kind: 'select', id: 'first-step' });
    for (let round = 0; round < 20; round += 1) state = applyAction(state, { kind: 'learn' });
    expect(QUESTION).toBe(question);
    expect(REPLIES).toEqual(replies);
  });

  it('has exactly one score per prepared reply, and every reply is distinct', () => {
    expect(REPLIES).toHaveLength(3);
    expect(new Set(REPLIES.map(reply => reply.id)).size).toBe(3);
    expect(new Set(REPLIES.map(reply => reply.text)).size).toBe(3);
    expect(initialChooser().scores).toHaveLength(REPLIES.length);
  });

  it('opens with the reply that answers nothing on the most chance', () => {
    const opening = chances(OPENING_SCORES);
    expect(indexOfReply('more-questions')).toBe(0);
    expect(opening[0]).toBeGreaterThan(opening[1]);
    expect(opening[0]).toBeGreaterThan(opening[2]);
  });

  it('has two replies that both answer, so a preference between them is about manner', () => {
    expect(REPLIES[1].text.startsWith('Stop riding and check which tyre is flat.')).toBe(true);
    expect(REPLIES[2].text.startsWith('Stop riding and check which tyre is flat.')).toBe(true);
    expect(REPLIES[2].text.length).toBeGreaterThan(REPLIES[1].text.length * 2);
  });
});

describe('the percentage on screen', () => {
  it('reads as a whole percentage', () => {
    expect(percent(0.550295)).toBe('55%');
    expect(percent(0.520916)).toBe('52%');
    expect(percent(0)).toBe('0%');
    expect(percent(1)).toBe('100%');
  });

  /**
   * Both of these are reachable by pressing again, and both would claim
   * something the model is not saying: a reply that is really still in it does
   * not print as ruled out, and a reply that has not taken everything does not
   * print as having taken everything.
   */
  it('never rounds a chance that is really there down to nothing', () => {
    expect(percent(0.004)).toBe('under 1%');
    expect(percent(0.0000001)).toBe('under 1%');
    expect(percent(0.005)).toBe('1%');
  });

  it('never rounds a chance that is not everything up to everything', () => {
    expect(percent(0.997)).toBe('over 99%');
    expect(percent(0.9949)).toBe('99%');
  });

  /** Measured: a loser drops under half a percent on round 72, the chosen one passes 99.5% on round 134. */
  it('describes states this model really reaches, and never one it does not', () => {
    const after = (rounds: number) => {
      let scores: readonly number[] = OPENING_SCORES;
      for (let round = 0; round < rounds; round += 1) scores = learnFrom(scores, 1);
      return chances(scores);
    };
    expect(percent(after(72)[0])).toBe('under 1%');
    expect(percent(after(71)[0])).toBe('1%');
    expect(percent(after(134)[1])).toBe('over 99%');
    expect(percent(after(133)[1])).toBe('99%');
    // And it never actually arrives: every reply keeps some chance for ever.
    const far = after(500);
    expect(far[0]).toBeGreaterThan(0);
    expect(far[1]).toBeLessThan(1);
  });
});
