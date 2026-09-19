import { describe, expect, it } from 'vitest';

import {
  ACTUAL_MINUTES,
  attemptStep,
  DEFAULT_SIZE,
  guessAfter,
  MAX_SENSIBLE_GUESS,
  MAX_STEPS,
  MIN_SENSIBLE_GUESS,
  outcomeOf,
  scoreAt,
  shrinking,
  sizeOf,
  slopeAt,
  START_GUESS,
  STEP_SIZES,
  travelOf,
  type Step,
  type StepSizeId,
} from './steps';

/**
 * Every expectation below is arithmetic written out by hand, not a second call
 * to the code under test. Asserting an update rule against itself is the trap
 * the tokenizer closed by decoding `bpe_ranks` independently, the predictor by
 * checking the least-squares conditions, and the representation playground by
 * brute force. This one closes it with numbers anybody can check on paper:
 * the delivery took 30, the guess starts at 40, so the gap is 10, the score is
 * 100 and the slope is 20.
 */

/** Walks the update for a while, so the sequences below can be read off. */
function walk(sizeId: StepSizeId, count: number, from = START_GUESS): { guesses: number[]; refusedAt: number | null; wouldBe: number | null } {
  const guesses: number[] = [from];
  let guess = from;
  for (let index = 1; index <= count; index += 1) {
    const attempt = attemptStep(guess, sizeId, index);
    if (!attempt.ok) return { guesses, refusedAt: index, wouldBe: attempt.wouldBe };
    guess = attempt.step.after;
    guesses.push(guess);
  }
  return { guesses, refusedAt: null, wouldBe: null };
}

const near = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 9);

describe('the score and the slope', () => {
  it('scores the opening guess at 100, because it is 10 minutes off', () => {
    expect(scoreAt(START_GUESS)).toBe(100);
    expect(scoreAt(ACTUAL_MINUTES)).toBe(0);
  });

  it('scores a miss the same size either way identically', () => {
    expect(scoreAt(25)).toBe(scoreAt(35));
  });

  it('reports the slope as twice the gap, positive when the guess is too long', () => {
    expect(slopeAt(START_GUESS)).toBe(20);
    expect(slopeAt(25)).toBe(-10);
    expect(slopeAt(ACTUAL_MINUTES)).toBe(0);
  });

  /**
   * The slope has to be the real rate of change of the score, or the panel is
   * describing one thing and doing another. Checked against the score itself
   * over a tiny nudge each way, which is the finite-difference definition and
   * is independent of the analytic expression `slopeAt` uses.
   */
  it('matches how the score actually changes over a tiny nudge', () => {
    for (const guess of [40, 35, 31, 22, 5]) {
      const h = 1e-6;
      const measured = (scoreAt(guess + h) - scoreAt(guess - h)) / (2 * h);
      expect(measured).toBeCloseTo(slopeAt(guess), 4);
    }
  });
});

describe('one step', () => {
  it('lowers a guess that is too long', () => {
    const attempt = attemptStep(START_GUESS, 'small', 1);
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    // slope 20, step 0.1, so the guess moves 2 minutes down: 40 → 38.
    near(attempt.step.after, 38);
    near(attempt.step.change, -2);
    near(attempt.step.offBefore, 10);
    near(attempt.step.offAfter, 8);
    near(attempt.step.scoreAfter, 64);
    expect(attempt.step.outcome).toEqual({ crossed: false, landed: 'closer', moved: 'down' });
  });

  it('raises a guess that is too short', () => {
    const attempt = attemptStep(20, 'small', 1);
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    // slope −20, so the step adds 2 minutes: 20 → 22.
    near(attempt.step.after, 22);
    expect(attempt.step.outcome.moved).toBe('up');
    expect(attempt.step.outcome.landed).toBe('closer');
  });

  it('does nothing at all once the guess is exactly right', () => {
    const attempt = attemptStep(ACTUAL_MINUTES, 'much-bigger', 1);
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    near(attempt.step.change, 0);
    expect(attempt.step.outcome.landed).toBe('exact');
    expect(attempt.step.outcome.moved).toBe('none');
  });

  it('carries the step size it was taken with, so a mixed history stays readable', () => {
    const attempt = attemptStep(START_GUESS, 'bigger', 4);
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.step.index).toBe(4);
    expect(attempt.step.sizeId).toBe('bigger');
    expect(attempt.step.size).toBe(0.6);
  });
});

describe('the three step sizes, which are the three things that can happen', () => {
  it('improves steadily on a small step and never passes the answer', () => {
    // The gap keeps four fifths of itself each time: 10, 8, 6.4, 5.12, 4.096,
    // so the guess goes 40, 38, 36.4, 35.12, 34.096 and never reaches 30.
    const { guesses } = walk('small', 4);
    [40, 38, 36.4, 35.12, 34.096].forEach((expected, index) => near(guesses[index], expected));
  });

  it('goes past the answer on a bigger step, and still lands closer', () => {
    // The gap flips and keeps a fifth of itself: 10, −2, 0.4, −0.08.
    const { guesses } = walk('bigger', 3);
    [40, 28, 30.4, 29.92].forEach((expected, index) => near(guesses[index], expected));

    const first = attemptStep(START_GUESS, 'bigger', 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.step.outcome).toEqual({ crossed: true, landed: 'closer', moved: 'down' });
  });

  it('goes past and lands further away on a much bigger step', () => {
    // The gap doubles and flips: 10, −20, 40 — then −80, which is refused.
    const { guesses } = walk('much-bigger', 3);
    [40, 10, 70].forEach((expected, index) => near(guesses[index], expected));

    const first = attemptStep(START_GUESS, 'much-bigger', 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.step.outcome).toEqual({ crossed: true, landed: 'further', moved: 'down' });
    near(first.step.offAfter, 20);
  });

  it('refuses the step that would take the estimate below no time at all', () => {
    const { refusedAt, wouldBe } = walk('much-bigger', 6);
    expect(refusedAt).toBe(3);
    near(wouldBe as number, -50);

    const refused = attemptStep(70, 'much-bigger', 3);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.side).toBe('below');
  });

  it('refuses a step that would run away upwards too', () => {
    // A delivery that really took 100 minutes, guessed at 0: the step overshoots
    // to 300, which is not a delivery time either.
    const refused = attemptStep(0, 'much-bigger', 1, 100);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.side).toBe('above');
    near(refused.wouldBe, 300);
  });
});

describe('how far a step travels', () => {
  /**
   * The panel says a small step covers about a fifth of the remaining distance.
   * That is a consequence of the update, not a rule of its own, so it is held to
   * the update rather than stated twice.
   */
  it('covers the fraction of the remaining distance the panel claims', () => {
    for (const size of STEP_SIZES) {
      for (const guess of [40, 36, 22, 31.5]) {
        const attempt = attemptStep(guess, size.id, 1);
        expect(attempt.ok, `${size.id} from ${guess}`).toBe(true);
        if (!attempt.ok) continue;
        const gap = guess - ACTUAL_MINUTES;
        near(attempt.step.change, -travelOf(size.size) * gap);
      }
    }
    expect(travelOf(0.1)).toBeCloseTo(0.2, 12);
    expect(travelOf(0.6)).toBeCloseTo(1.2, 12);
    expect(travelOf(1.5)).toBeCloseTo(3, 12);
  });
});

describe('what a step is reported as', () => {
  it('names the four things that can happen to the distance', () => {
    expect(outcomeOf(40, 38)).toEqual({ crossed: false, landed: 'closer', moved: 'down' });
    expect(outcomeOf(40, 28)).toEqual({ crossed: true, landed: 'closer', moved: 'down' });
    expect(outcomeOf(40, 10)).toEqual({ crossed: true, landed: 'further', moved: 'down' });
    expect(outcomeOf(40, 30)).toEqual({ crossed: false, landed: 'exact', moved: 'down' });
  });

  it('calls a move away from the answer further away even though nothing was passed', () => {
    expect(outcomeOf(40, 50)).toEqual({ crossed: false, landed: 'further', moved: 'up' });
  });

  it('calls a jump to the mirror image neither closer nor further', () => {
    expect(outcomeOf(40, 20)).toEqual({ crossed: true, landed: 'same', moved: 'down' });
  });

  it('never calls floating-point drift a wrong answer', () => {
    expect(outcomeOf(40, ACTUAL_MINUTES + 1e-12).landed).toBe('exact');
    expect(outcomeOf(40, 40 + 1e-12).moved).toBe('none');
  });
});

describe('the steps getting smaller', () => {
  const stepsOf = (sizeId: StepSizeId, count: number): Step[] => {
    const steps: Step[] = [];
    let guess = START_GUESS;
    for (let index = 1; index <= count; index += 1) {
      const attempt = attemptStep(guess, sizeId, index);
      if (!attempt.ok) break;
      steps.push(attempt.step);
      guess = attempt.step.after;
    }
    return steps;
  };

  it('is only claimed once two small steps have actually shrunk', () => {
    expect(shrinking(stepsOf('small', 1))).toBe(false);
    // 2 minutes then 1.6 minutes.
    expect(shrinking(stepsOf('small', 2))).toBe(true);
    expect(shrinking(stepsOf('small', 5))).toBe(true);
  });

  it('is not claimed when the guess passed the answer', () => {
    expect(shrinking(stepsOf('bigger', 3))).toBe(false);
    expect(shrinking(stepsOf('much-bigger', 2))).toBe(false);
  });

  it('is not claimed across a change of step size', () => {
    const mixed = stepsOf('small', 2);
    const next = attemptStep(mixed[mixed.length - 1].after, 'bigger', 3);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(shrinking([...mixed, next.step])).toBe(false);
  });
});

describe('the panel can never print an unusable number', () => {
  it('keeps every guess a sensible delivery time, whatever the learner does', () => {
    for (const sizeId of STEP_SIZES.map(size => size.id)) {
      let guess = START_GUESS;
      for (let index = 1; index <= MAX_STEPS * 3; index += 1) {
        const attempt = attemptStep(guess, sizeId, index);
        if (!attempt.ok) {
          expect(Number.isFinite(attempt.wouldBe)).toBe(true);
          break;
        }
        guess = attempt.step.after;
        expect(Number.isFinite(guess)).toBe(true);
        expect(guess).toBeGreaterThanOrEqual(MIN_SENSIBLE_GUESS);
        expect(guess).toBeLessThanOrEqual(MAX_SENSIBLE_GUESS);
      }
    }
  });

  /**
   * The panel says a small step never quite arrives. It has to still be true at
   * the end of everything the panel will let anybody do.
   */
  it('never reaches the answer exactly on small steps, within the cap', () => {
    const { guesses } = walk('small', MAX_STEPS);
    expect(guesses).toHaveLength(MAX_STEPS + 1);
    const last = guesses[guesses.length - 1];
    expect(last).toBeGreaterThan(ACTUAL_MINUTES);
    // 10 × 0.8^16 = 0.28 minutes off: close, and not there.
    expect(last - ACTUAL_MINUTES).toBeCloseTo(0.2814749767, 6);
  });

  it('starts from the guess the last step left behind', () => {
    expect(guessAfter([])).toBe(START_GUESS);
    const attempt = attemptStep(START_GUESS, 'small', 1);
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    near(guessAfter([attempt.step]), 38);
  });
});

describe('the step sizes on offer', () => {
  it('offers one that improves steadily, one that passes the answer, and one that runs away', () => {
    expect(STEP_SIZES.map(size => size.id)).toEqual(['small', 'bigger', 'much-bigger']);
    expect(sizeOf(DEFAULT_SIZE).size).toBe(0.1);
  });

  it('labels them by how big they are, never by how they will turn out', () => {
    for (const size of STEP_SIZES) {
      const label = size.label.toLowerCase();
      for (const verdict of ['too far', 'past', 'worse', 'wrong', 'runs away', 'best']) {
        expect(label, size.id).not.toContain(verdict);
      }
    }
  });
});
