import type { Decision } from './schema';

/**
 * Reconciles the model's verdict with its own answers to the two checks.
 *
 * This exists because prompt-only versions of these rules measurably drifted.
 * Three rounds of rewording moved the false-pass rate from 0 to 2 to 3 out of
 * 48 — the instructions were there each time, and a small model applied them
 * inconsistently. Making the checks required schema fields forces the model to
 * commit to them before it picks a verdict; this function then holds it to what
 * it wrote.
 *
 * Shared by the route and by `pnpm calibrate`, so the harness measures the
 * assessor that actually ships rather than a more permissive version of it.
 */

export type Settlement = {
  verdict: Decision['verdict'];
  /** Set when the checks contradicted the model's own choice. */
  overriddenFrom: Decision['verdict'] | null;
};

export function settle(decision: Decision): Settlement {
  const { verdict, answeredTheQuestion, mechanismDescribed } = decision;

  /*
   * Not addressing the question is not evidence about the learner.
   *
   * `blocked` is exempt: "I don't know" does not address the question either,
   * and it is the most informative answer someone can give. Rewriting it to
   * `unclear` would send the tutor back to re-ask something they have just
   * told you they cannot answer.
   */
  if (!answeredTheQuestion && verdict !== 'blocked') {
    return { verdict: 'unclear', overriddenFrom: verdict === 'unclear' ? null : verdict };
  }

  // Correct-sounding vocabulary with no mechanism behind it is not knowing it.
  if (verdict === 'known' && mechanismDescribed === null) {
    return { verdict: 'shaky', overriddenFrom: 'known' };
  }

  return { verdict, overriddenFrom: null };
}
