import { describe, expect, it } from 'vitest';

import type { Decision } from './schema';
import { settle } from './verdict';

/**
 * These encode the rules that three rounds of prompt rewriting failed to hold.
 * The prompt asks for the checks; this is what enforces them.
 */

const decision = (over: Partial<Decision>): Decision => ({
  answeredTheQuestion: true,
  mechanismDescribed: 'they described the weights being nudged toward less error',
  verdict: 'known',
  because: 'because',
  misconception: false,
  say: 'say',
  ...over,
});

describe('settle', () => {
  it('leaves a well-supported verdict alone', () => {
    expect(settle(decision({}))).toEqual({ verdict: 'known', overriddenFrom: null });
  });

  it('downgrades known to shaky when no mechanism was described', () => {
    // The parroted case: fluent, accurate, and evidence of nothing.
    expect(settle(decision({ mechanismDescribed: null }))).toEqual({
      verdict: 'shaky',
      overriddenFrom: 'known',
    });
  });

  it('allows shaky without a mechanism, since that is what shaky means', () => {
    expect(settle(decision({ verdict: 'shaky', mechanismDescribed: null })).verdict).toBe('shaky');
  });

  it('rewrites any verdict to unclear when the question was not answered', () => {
    // Nothing was said about this idea, so nothing about the learner follows.
    for (const verdict of ['known', 'shaky'] as const) {
      expect(settle(decision({ verdict, answeredTheQuestion: false })).verdict).toBe('unclear');
    }
  });

  it('records what it overrode, so a wrong mark can be traced', () => {
    expect(settle(decision({ verdict: 'shaky', answeredTheQuestion: false })).overriddenFrom).toBe('shaky');
  });

  it('does not report an override when the verdict was already unclear', () => {
    expect(settle(decision({ verdict: 'unclear', answeredTheQuestion: false })).overriddenFrom).toBeNull();
  });

  it('leaves blocked alone even though "I do not know" does not answer the question', () => {
    // The exemption that matters: rewriting this to unclear would send the tutor
    // back to re-ask something they have just said they cannot answer.
    expect(settle(decision({ verdict: 'blocked', answeredTheQuestion: false }))).toEqual({
      verdict: 'blocked',
      overriddenFrom: null,
    });
  });

  it('does not require a mechanism for blocked', () => {
    expect(
      settle(decision({ verdict: 'blocked', mechanismDescribed: null, answeredTheQuestion: false })).verdict,
    ).toBe('blocked');
  });
});
