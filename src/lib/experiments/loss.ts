/**
 * Two ways of scoring a wrong answer, for the `loss` node.
 *
 * The node's misconception is that the loss is an accuracy report for humans,
 * rather than the signal the training process steers by. The only way to show
 * otherwise is to put right-or-wrong beside how-far-off and let someone move a
 * guess: "wrong" says the same thing at 60 minutes and at 31, so it gives the
 * model nowhere to go, while "30 minutes off" and "1 minute off" name a
 * direction.
 *
 * The second half is the other half of the node — that a person chooses the
 * measure, and the choice decides what the model tries to become. So two real
 * measures are computed over the same guesses: the average size of the miss,
 * and the average of each miss multiplied by itself. They are deliberately not
 * the same units, and nothing here pretends otherwise.
 */

import { round } from './regression';

/** The delivery the first screen is about. It really took this long. */
export const ACTUAL_MINUTES = 30;
/** Wrong by a minute. */
export const NEAR_GUESS = 29;
/** Wrong by half an hour, and the one the learner moves. */
export const FAR_GUESS = 60;
export const MAX_GUESS = 90;

export type Judgement = {
  guess: number;
  actual: number;
  /** How far off, never negative. The measure that can tell two wrong guesses apart. */
  off: number;
  /** Whether guess and actual match. The measure that cannot. */
  exact: boolean;
  /** Which side of the truth the guess fell on, for wording rather than for arithmetic. */
  direction: 'over' | 'under' | 'exact';
};

/**
 * Floating point, not taste: a slider stepping in halves can land on a value
 * that differs from the target in the last bit, and calling that "wrong" while
 * printing "0 minutes off" beside it would be the panel contradicting itself.
 */
const EXACT = 1e-9;

export function judge(guess: number, actual: number): Judgement {
  const gap = guess - actual;
  const exact = Math.abs(gap) < EXACT;
  return {
    guess,
    actual,
    off: exact ? 0 : Math.abs(gap),
    exact,
    direction: exact ? 'exact' : gap > 0 ? 'over' : 'under',
  };
}

/** One delivery in the second example. The time it took is fixed; the guess is the learner's. */
export type GuessRow = { id: string; actual: number; guess: number | null };

/** The times the four deliveries in the second example actually took. */
export const ACTUAL_TIMES: readonly number[] = [20, 30, 40, 50];

export const MAX_MINUTES = 180;

export type GuessSet = { label: string; note: string; guesses: readonly number[] };

/**
 * Three sets of guesses, and the first two are the whole argument.
 *
 * They are off by the same amount on average — 5 minutes each — so counting
 * every minute equally cannot separate them. Counting each miss multiplied by
 * itself calls the second four times worse. That tie is asserted in
 * `loss.test.ts` rather than described here, so editing these numbers later
 * cannot quietly remove the point they exist to make.
 */
export const GUESS_SETS: readonly GuessSet[] = [
  {
    label: 'A few minutes out on each',
    note: 'Every guess is 5 minutes off. Two are over, two are under.',
    guesses: [25, 25, 45, 45],
  },
  {
    label: 'Three exact, one badly out',
    note: 'Three guesses match the time exactly. The fourth is 20 minutes out.',
    guesses: [20, 30, 40, 30],
  },
  {
    label: 'Every guess exact',
    note: 'Nothing is off by anything, so there is nothing left for either measure to report.',
    guesses: [20, 30, 40, 50],
  },
];

export const INITIAL_SET = GUESS_SETS[0];

export function rowsFor(set: GuessSet): GuessRow[] {
  return ACTUAL_TIMES.map((actual, index) => ({
    id: `delivery${index}`,
    actual,
    guess: set.guesses[index] ?? null,
  }));
}

export type Counting = {
  /** Signed, guess − actual, for the rows that have a guess. Order follows the rows. */
  misses: readonly number[];
  /** Average of how far off each guess was, in minutes. */
  everyMinuteEqually: number;
  /**
   * Average of each miss multiplied by itself. Deliberately NOT minutes — the
   * units are minutes times minutes — and the panel never prints it as minutes.
   */
  bigMissesCountMore: number;
  /** The largest single miss, in minutes. */
  worst: number;
  allExact: boolean;
  /** How many rows carried a guess. A half-typed row is excluded, never guessed at. */
  counted: number;
};

/** Rows the learner has actually filled in. */
export function completeGuesses(rows: readonly GuessRow[]): GuessRow[] {
  return rows.filter(row => row.guess !== null && Number.isFinite(row.guess));
}

/**
 * Both measures over the same guesses, or `null` when there is nothing to
 * measure. An empty list has no average, and printing 0 for it would say the
 * guesses were perfect when no guess was made.
 */
export function countMistakes(rows: readonly GuessRow[]): Counting | null {
  const complete = completeGuesses(rows);
  if (complete.length === 0) return null;

  const misses = complete.map(row => (row.guess as number) - row.actual);
  const everyMinuteEqually = misses.reduce((sum, miss) => sum + Math.abs(miss), 0) / misses.length;
  const bigMissesCountMore = misses.reduce((sum, miss) => sum + miss * miss, 0) / misses.length;
  const worst = misses.reduce((most, miss) => Math.max(most, Math.abs(miss)), 0);

  return {
    misses,
    everyMinuteEqually,
    bigMissesCountMore,
    worst,
    allExact: worst < EXACT,
    counted: complete.length,
  };
}

/**
 * What changed between two sets of guesses, read at the precision the panel
 * prints. A difference nobody can see on screen is reported as no difference,
 * rather than as a change the learner is then asked to look for.
 */
const VISIBLE = 0.05;

export type CountingComparison = {
  /** The two sets score the same when every minute counts equally. */
  tiedOnEveryMinute: boolean;
  /** They score the same when big misses count more. */
  tiedOnBigMisses: boolean;
  /** Set when exactly one measure separates them: the interesting case, and the one the presets build. */
  disagree: 'only-big-misses' | 'only-every-minute' | null;
  everyMinuteGap: number;
  bigMissesGap: number;
};

export function compareCounting(before: Counting, after: Counting): CountingComparison {
  const everyMinuteGap = after.everyMinuteEqually - before.everyMinuteEqually;
  const bigMissesGap = after.bigMissesCountMore - before.bigMissesCountMore;
  const tiedOnEveryMinute = Math.abs(everyMinuteGap) < VISIBLE;
  const tiedOnBigMisses = Math.abs(bigMissesGap) < VISIBLE;
  return {
    tiedOnEveryMinute,
    tiedOnBigMisses,
    disagree: tiedOnEveryMinute && !tiedOnBigMisses
      ? 'only-big-misses'
      : tiedOnBigMisses && !tiedOnEveryMinute
        ? 'only-every-minute'
        : null,
    everyMinuteGap,
    bigMissesGap,
  };
}

/**
 * How many times bigger the later "big misses count more" score is than the
 * earlier one. Undefined against a perfect set, and said so rather than printed
 * as Infinity.
 *
 * Returned unrounded. Rounding here and inverting afterwards printed "3.3 times
 * worse" where the honest answer was 4: 25 ÷ 100 rounds to 0.3, and 1 ÷ 0.3 is
 * not 4. Display rounding belongs at the point of display.
 */
export function timesWorse(before: Counting, after: Counting): number | null {
  if (before.bigMissesCountMore < EXACT || after.bigMissesCountMore < EXACT) return null;
  return after.bigMissesCountMore / before.bigMissesCountMore;
}

export { round };
