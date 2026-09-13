/**
 * One number, improved a step at a time — for the `gradient-descent` node.
 *
 * The node's recorded misconception is the rolling-ball landscape: a picture
 * that implies somebody can see the surface and aim at its lowest point. So
 * there is no landscape here and nothing rolls. There is one guess, a score
 * saying how far off it is, and the one fact the update is actually allowed to
 * use — whether nudging the guess up or down makes that score smaller, and how
 * fast it is changing right at this guess.
 *
 * The update is the real thing: `guess ← guess − step × slope`, with the slope
 * taken from a squared error. Nothing here selects a prepared sequence of
 * numbers, which is why overshooting and running away are things the panel can
 * report rather than claim.
 *
 * The delivery is the one from `loss`: the same 30 minutes, the next idea along.
 */

import { ACTUAL_MINUTES } from './loss';
import { round } from './regression';

export { ACTUAL_MINUTES, round };

/** Where the model's estimate starts. Ten minutes too long, and it is told so. */
export const START_GUESS = 40;

/**
 * Outside this range the guess has stopped being a delivery time at all — a
 * delivery cannot take less than no time. When a step would land outside it the
 * step is refused and the value it would have reached is reported, rather than
 * clamped into something that still looks reasonable. "The numbers ran away" is
 * the honest end of a step that is far too big, and hiding it would teach the
 * opposite of this node.
 */
export const MIN_SENSIBLE_GUESS = 0;
export const MAX_SENSIBLE_GUESS = 180;

/** As many steps as this panel keeps. Enough to watch a pattern, not a training run. */
export const MAX_STEPS = 16;
/** The optional short run: this many steps, and a Stop button the whole time. */
export const RUN_STEPS = 6;
export const RUN_INTERVAL_MS = 700;

/**
 * Floating point, not taste. A guess that differs from the delivery time in the
 * last bit must not print "0 minutes off" beside the word "further away".
 */
const EXACT = 1e-9;

export type StepSizeId = 'small' | 'bigger' | 'much-bigger';
export type StepSize = { id: StepSizeId; label: string; size: number };

/**
 * Three sizes, and the labels say how big they are rather than how they will
 * turn out. What each one does is reported after it has been taken.
 */
export const STEP_SIZES: readonly StepSize[] = [
  { id: 'small', label: 'Small step', size: 0.1 },
  { id: 'bigger', label: 'Bigger step', size: 0.6 },
  { id: 'much-bigger', label: 'Much bigger step', size: 1.5 },
];

export const DEFAULT_SIZE: StepSizeId = 'small';

export function sizeOf(id: StepSizeId): StepSize {
  return STEP_SIZES.find(size => size.id === id) ?? STEP_SIZES[0];
}

/** How far off, squared. The score the step is trying to make smaller. */
export function scoreAt(guess: number, actual = ACTUAL_MINUTES): number {
  const off = guess - actual;
  return off * off;
}

/**
 * How fast the score changes per minute of guess, right at this guess.
 *
 * Positive means raising the guess raises the score, so the helpful direction is
 * down. For a squared error this is exactly twice the gap — which is why a step
 * covers a fixed fraction of the remaining distance here, and why `travelOf`
 * can say what that fraction is without measuring anything.
 */
export function slopeAt(guess: number, actual = ACTUAL_MINUTES): number {
  return 2 * (guess - actual);
}

/**
 * How much of the remaining distance one step of this size covers: 0.2 of the
 * way, 1.2 of the way, 3 times as far. It is a consequence of the slope being
 * proportional to the gap in this one-number example, not a rule anybody wrote
 * down, and `steps.test.ts` holds it to what the update actually does.
 */
export function travelOf(size: number): number {
  return 2 * size;
}

export type Outcome = {
  /** The guess passed the delivery time and came out on the other side. */
  crossed: boolean;
  landed: 'exact' | 'closer' | 'further' | 'same';
  /** Which way the guess itself moved. */
  moved: 'down' | 'up' | 'none';
};

export function outcomeOf(before: number, after: number, actual = ACTUAL_MINUTES): Outcome {
  const gapBefore = before - actual;
  const gapAfter = after - actual;
  const change = after - before;
  const moved = Math.abs(change) < EXACT ? 'none' : change < 0 ? 'down' : 'up';

  if (Math.abs(gapAfter) < EXACT) return { crossed: false, landed: 'exact', moved };

  const crossed = Math.abs(gapBefore) > EXACT && Math.sign(gapAfter) !== Math.sign(gapBefore);
  const closerBy = Math.abs(gapBefore) - Math.abs(gapAfter);
  const landed = closerBy > EXACT ? 'closer' : closerBy < -EXACT ? 'further' : 'same';
  return { crossed, landed, moved };
}

export type Step = {
  /** 1-based, and counted across every size the learner has used. */
  index: number;
  sizeId: StepSizeId;
  size: number;
  before: number;
  after: number;
  /** How far off, never negative, on each side of the step. */
  offBefore: number;
  offAfter: number;
  scoreBefore: number;
  scoreAfter: number;
  slope: number;
  /** after − before. Negative when the step lowered the guess. */
  change: number;
  outcome: Outcome;
};

export type Attempt =
  | { ok: true; step: Step }
  | { ok: false; wouldBe: number; side: 'below' | 'above' };

/**
 * One step of gradient descent on one number, or a refusal.
 *
 * The refusal carries the value the step would have reached, because that value
 * is the whole point: a step big enough to take a delivery estimate to minus
 * fifty minutes has not failed quietly, it has run away, and the learner should
 * see the number it ran to.
 */
export function attemptStep(guess: number, sizeId: StepSizeId, index: number, actual = ACTUAL_MINUTES): Attempt {
  const { size } = sizeOf(sizeId);
  const slope = slopeAt(guess, actual);
  const change = -size * slope;
  const after = guess + change;

  if (!Number.isFinite(after) || after < MIN_SENSIBLE_GUESS || after > MAX_SENSIBLE_GUESS) {
    return { ok: false, wouldBe: after, side: after < MIN_SENSIBLE_GUESS ? 'below' : 'above' };
  }

  return {
    ok: true,
    step: {
      index,
      sizeId,
      size,
      before: guess,
      after,
      offBefore: Math.abs(guess - actual),
      offAfter: Math.abs(after - actual),
      scoreBefore: scoreAt(guess, actual),
      scoreAfter: scoreAt(after, actual),
      slope,
      change,
      outcome: outcomeOf(guess, after, actual),
    },
  };
}

/** Where the guess stands now. The steps taken are the only state there is. */
export function guessAfter(steps: readonly Step[]): number {
  return steps.length === 0 ? START_GUESS : steps[steps.length - 1].after;
}

/**
 * Whether the last two steps were the same size, both moved towards the answer
 * without passing it, and the second moved the guess less than the first.
 *
 * That is the thing worth pointing out about a small step and it is worth
 * pointing out only when it happened, so it is measured from the steps rather
 * than written into the copy.
 */
export function shrinking(steps: readonly Step[]): boolean {
  if (steps.length < 2) return false;
  const [previous, latest] = steps.slice(-2);
  if (previous.sizeId !== latest.sizeId) return false;
  if (previous.outcome.crossed || latest.outcome.crossed) return false;
  if (previous.outcome.landed !== 'closer' || latest.outcome.landed !== 'closer') return false;
  return Math.abs(latest.change) < Math.abs(previous.change) - EXACT;
}
