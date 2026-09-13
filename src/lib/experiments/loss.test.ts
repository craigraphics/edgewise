import { describe, expect, it } from 'vitest';

import {
  ACTUAL_MINUTES,
  ACTUAL_TIMES,
  compareCounting,
  completeGuesses,
  countMistakes,
  FAR_GUESS,
  GUESS_SETS,
  judge,
  NEAR_GUESS,
  rowsFor,
  round,
  timesWorse,
  type Counting,
  type GuessRow,
} from './loss';

/**
 * The expectations are written out by hand rather than by calling the function
 * under test with different arguments. Asserting a measure against itself is the
 * trap the tokenizer and predictor work closed by two other routes; this one
 * closes it by arithmetic anybody can check in their head.
 */
function rows(actuals: readonly number[], guesses: readonly (number | null)[]): GuessRow[] {
  return actuals.map((actual, index) => ({ id: `r${index}`, actual, guess: guesses[index] ?? null }));
}

describe('judging one guess', () => {
  it('calls an exact guess exact and nothing off', () => {
    const verdict = judge(ACTUAL_MINUTES, ACTUAL_MINUTES);
    expect(verdict.exact).toBe(true);
    expect(verdict.off).toBe(0);
    expect(verdict.direction).toBe('exact');
  });

  /** The whole first screen: right-or-wrong says the same thing about both of these. */
  it('separates two wrong guesses that right-or-wrong cannot', () => {
    const near = judge(NEAR_GUESS, ACTUAL_MINUTES);
    const far = judge(FAR_GUESS, ACTUAL_MINUTES);
    expect(near.exact).toBe(false);
    expect(far.exact).toBe(false);
    expect(near.off).toBe(1);
    expect(far.off).toBe(30);
  });

  it('treats over and under by the same amount as equally far off', () => {
    expect(judge(ACTUAL_MINUTES + 7, ACTUAL_MINUTES).off).toBe(judge(ACTUAL_MINUTES - 7, ACTUAL_MINUTES).off);
    expect(judge(ACTUAL_MINUTES + 7, ACTUAL_MINUTES).direction).toBe('over');
    expect(judge(ACTUAL_MINUTES - 7, ACTUAL_MINUTES).direction).toBe('under');
  });

  /**
   * A slider stepping in halves can land a last-bit away from the target. The
   * panel would otherwise print "0 minutes off" beside the word "Wrong".
   */
  it('does not call floating-point noise a wrong answer', () => {
    const drifted = 30 + 1e-12; // 30, give or take a rounding error
    expect(drifted).not.toBe(30);
    expect(judge(drifted, 30).exact).toBe(true);
    expect(judge(drifted, 30).off).toBe(0);
  });
});

describe('the two ways of counting mistakes', () => {
  it('reports nothing when no guess has been made', () => {
    expect(countMistakes([])).toBeNull();
    expect(countMistakes(rows([20, 30], [null, null]))).toBeNull();
  });

  it('gives zero on both measures when every guess is exact', () => {
    const counting = countMistakes(rows([20, 30, 40, 50], [20, 30, 40, 50]))!;
    expect(counting.everyMinuteEqually).toBe(0);
    expect(counting.bigMissesCountMore).toBe(0);
    expect(counting.worst).toBe(0);
    expect(counting.allExact).toBe(true);
  });

  it('scores a miss the same size in either direction identically', () => {
    const over = countMistakes(rows([30, 30], [34, 36]))!;
    const under = countMistakes(rows([30, 30], [26, 24]))!;
    expect(over.everyMinuteEqually).toBe(under.everyMinuteEqually);
    expect(over.bigMissesCountMore).toBe(under.bigMissesCountMore);
    expect(over.worst).toBe(under.worst);
  });

  it('is the real average miss and the real average of miss times miss', () => {
    // Misses of +5, −5, +5, −5. |miss| averages to 5. miss² is 25 every time.
    const counting = countMistakes(rows([20, 30, 40, 50], [25, 25, 45, 45]))!;
    expect(counting.misses).toEqual([5, -5, 5, -5]);
    expect(counting.everyMinuteEqually).toBe(5);
    expect(counting.bigMissesCountMore).toBe(25);
    expect(counting.worst).toBe(5);
  });

  it('leaves a row without a guess out rather than guessing at it', () => {
    const counting = countMistakes(rows([20, 30, 40], [25, null, 45]))!;
    expect(counting.counted).toBe(2);
    expect(counting.misses).toEqual([5, 5]);
    expect(counting.everyMinuteEqually).toBe(5);
  });

  it('never produces a number that is not a number', () => {
    const awkward: GuessRow[][] = [
      rows([0], [0]),
      rows([0, 0], [0, 0]),
      rows([20, 30], [Number.NaN, 30]),
      rows([20, 30, 40, 50], [20, null, null, 90]),
    ];
    for (const set of awkward) {
      const counting = countMistakes(set);
      if (!counting) continue;
      for (const value of [counting.everyMinuteEqually, counting.bigMissesCountMore, counting.worst, ...counting.misses]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('drops a guess that is not a finite number', () => {
    expect(completeGuesses(rows([20, 30], [Number.NaN, 30]))).toHaveLength(1);
  });
});

/**
 * The point of the second example, held to arithmetic rather than to copy. If
 * these numbers are ever edited so the two sets stop tying on one measure, the
 * panel would be claiming a disagreement that is not there.
 */
describe('the guess sets make the argument they claim to', () => {
  const counting = (index: number): Counting => countMistakes(rowsFor(GUESS_SETS[index]))!;

  it('has one set of spread misses and one with a single large miss', () => {
    expect(counting(0).worst).toBe(5);
    expect(counting(1).worst).toBe(20);
    expect(counting(1).misses.filter(miss => miss === 0)).toHaveLength(3);
  });

  it('ties the first two sets when every minute counts equally', () => {
    expect(counting(0).everyMinuteEqually).toBe(5);
    expect(counting(1).everyMinuteEqually).toBe(5);
  });

  it('separates them by four times when big misses count more', () => {
    expect(counting(0).bigMissesCountMore).toBe(25);
    expect(counting(1).bigMissesCountMore).toBe(100);
    expect(timesWorse(counting(0), counting(1))).toBe(4);
    /*
     * Both directions, because the panel inverts this to say "the earlier set
     * was N times worse". The first version rounded to one decimal before
     * inverting, so 25 ÷ 100 became 0.3 and the panel printed 3.3 where the
     * answer was 4.
     */
    expect(timesWorse(counting(1), counting(0))).toBe(0.25);
    expect(round(1 / timesWorse(counting(1), counting(0))!, 1)).toBe(4);
  });

  it('makes the third set exact on both measures', () => {
    expect(counting(2).allExact).toBe(true);
    expect(counting(2).everyMinuteEqually).toBe(0);
    expect(counting(2).bigMissesCountMore).toBe(0);
  });

  it('gives every set a guess for every delivery', () => {
    for (const set of GUESS_SETS) {
      expect(set.guesses).toHaveLength(ACTUAL_TIMES.length);
      expect(rowsFor(set).every(row => row.guess !== null)).toBe(true);
    }
  });
});

describe('comparing two sets of guesses', () => {
  it('names the case where only one measure separates them', () => {
    const spread = countMistakes(rowsFor(GUESS_SETS[0]))!;
    const blunder = countMistakes(rowsFor(GUESS_SETS[1]))!;
    const comparison = compareCounting(spread, blunder);
    expect(comparison.tiedOnEveryMinute).toBe(true);
    expect(comparison.tiedOnBigMisses).toBe(false);
    expect(comparison.disagree).toBe('only-big-misses');
  });

  it('reports no disagreement when both measures move', () => {
    const before = countMistakes(rows([20, 30], [25, 35]))!;
    const after = countMistakes(rows([20, 30], [40, 50]))!;
    expect(compareCounting(before, after).disagree).toBeNull();
  });

  /**
   * Both measures are printed to one decimal, so both use the same threshold —
   * but squaring amplifies, and a nudge invisible in minutes is not always
   * invisible in the squared score. The first draft of this test used ±0.01 and
   * failed here: 0.01 of a minute is 0.1 of the squared score, which the panel
   * does print. Worth keeping, because it is the same asymmetry the second
   * example exists to show, turning up in the tolerance.
   */
  it('calls a difference nobody can see on screen no difference', () => {
    const before = countMistakes(rows([30, 30], [35, 25]))!;
    const after = countMistakes(rows([30, 30], [35.001, 24.999]))!;
    const comparison = compareCounting(before, after);
    expect(comparison.tiedOnEveryMinute).toBe(true);
    expect(comparison.tiedOnBigMisses).toBe(true);
    expect(comparison.disagree).toBeNull();
  });

  it('declines to state a ratio against a perfect set', () => {
    const exact = countMistakes(rowsFor(GUESS_SETS[2]))!;
    const missed = countMistakes(rowsFor(GUESS_SETS[0]))!;
    expect(timesWorse(exact, missed)).toBeNull();
    expect(timesWorse(missed, exact)).toBeNull();
  });
});
