/**
 * Two phases of the same delivery rule, for the `training-vs-inference` node.
 *
 * The node's misconception is that a model learns from you while you use it. The
 * only way to show otherwise is to let someone change the question repeatedly and
 * watch the rule sit still — so the rule is stored, and every answer on screen is
 * read out of the stored rule rather than recomputed from whatever is in the
 * fields. `answerWith` cannot see the rows at all, which is what makes that
 * guarantee structural rather than a promise in a comment.
 *
 * The fitting itself is the predictor's, unchanged: this node is about when that
 * fit happens, not about how it works.
 */

import {
  completeExamples,
  fitLine,
  matchesFittedData,
  predictAt,
  round,
  type Example,
  type ExampleRow,
  type FittedModel,
} from './regression';

/** The deliveries the opening rule was learned from. Shared with the predictor's first preset. */
export const PAST_DELIVERIES: readonly Example[] = [
  { distance: 2, minutes: 19 },
  { distance: 5, minutes: 26 },
  { distance: 9, minutes: 41 },
  { distance: 14, minutes: 53 },
];

/** The distance the new customer starts at. Not one of the past deliveries, so the first answer is already a new one. */
export const INITIAL_QUERY = 7;

/** The one row that starts empty: a delivery nobody has told it about yet. */
export const FRESH_ROW_ID = 'fresh';

export function initialRows(): ExampleRow[] {
  return [
    ...PAST_DELIVERIES.map((delivery, index) => ({ id: `past${index}`, distance: delivery.distance, minutes: delivery.minutes })),
    { id: FRESH_ROW_ID, distance: null, minutes: null },
  ];
}

/**
 * A rule that has been learned, and how many times learning has happened.
 *
 * `fit` is a `FittedModel`, never an undetermined one: an attempt that could not
 * determine a rule is refused by `learnability` before it runs, so a rule the
 * learner already has can never be destroyed by a half-typed field.
 */
export type Learned = { round: number; fit: FittedModel };

export type Learnability =
  | { ok: true }
  | { ok: false; reason: 'unchanged' | 'too-few' | 'no-spread' };

/**
 * Whether learning from these rows would do anything, and if not, why.
 *
 * `unchanged` is the common case and the important one: pressing the button with
 * the same deliveries is not a no-op to be silently allowed, it is the moment to
 * say that nothing new has been supplied.
 */
export function learnability(rows: readonly ExampleRow[], current: Learned | null): Learnability {
  if (current && matchesFittedData(rows, current.fit)) return { ok: false, reason: 'unchanged' };
  const attempt = fitLine(completeExamples(rows));
  if (attempt.status === 'fitted') return { ok: true };
  return { ok: false, reason: attempt.reason === 'no-spread' ? 'no-spread' : 'too-few' };
}

/** Learns a new rule from the rows, or returns null when there is nothing to learn. */
export function learn(rows: readonly ExampleRow[], current: Learned | null): Learned | null {
  if (!learnability(rows, current).ok) return null;
  const fit = fitLine(completeExamples(rows));
  if (fit.status !== 'fitted') return null;
  return { round: (current?.round ?? 0) + 1, fit };
}

/**
 * The rule read at a distance. The only argument that can move the answer is the
 * distance; the rows are not in scope, so using the rule cannot change it.
 */
export function answerWith(learned: Learned | null, distance: number): number | null {
  return predictAt(learned?.fit ?? null, distance);
}

/** The rule in words. Two unexplained numbers are not a rule anybody can read. */
export function describeRule(learned: Learned | null, unit: string): string | null {
  if (!learned) return null;
  const rate = round(learned.fit.slope, 2);
  return `Start at ${round(learned.fit.intercept, 1)} minutes, then ${rate < 0 ? 'subtract' : 'add'} ${Math.abs(rate)} minutes for every ${unit}`;
}

/**
 * Below the 0.1 minute the panel prints, so a change nobody can see is reported
 * as the same answer rather than as a change.
 */
const VISIBLE = 0.05;

export type Comparison = {
  /** Held fixed across both readings, so the only thing that differs is the rule. */
  distance: number;
  before: number;
  after: number;
  direction: 'later' | 'earlier' | 'same';
  gap: number;
  startMoved: boolean;
  rateMoved: boolean;
};

/** Both rules read at one distance, so the cause of the difference cannot be the question. */
export function compare(before: Learned, after: Learned, distance: number): Comparison | null {
  const was = answerWith(before, distance);
  const now = answerWith(after, distance);
  if (was === null || now === null) return null;
  const gap = now - was;
  return {
    distance,
    before: was,
    after: now,
    direction: Math.abs(gap) < VISIBLE ? 'same' : gap > 0 ? 'later' : 'earlier',
    gap: Math.abs(gap),
    startMoved: Math.abs(after.fit.intercept - before.fit.intercept) >= VISIBLE,
    rateMoved: Math.abs(after.fit.slope - before.fit.slope) >= 0.005,
  };
}

/** What the learner changed, for the optional question after the comparison. */
export type Choice = 'distance' | 'examples';
