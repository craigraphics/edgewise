import { describe, expect, it } from 'vitest';

import { settleExplanation, type Assessment } from './explain-back';

const assessment = (over: Partial<Assessment>): Assessment => ({
  mechanismDescribed: 'they said the inputs get multiplied by weights and summed, then squashed',
  carriesMisconception: false,
  verdict: 'solid',
  say: 'say',
  ...over,
});

describe('settleExplanation', () => {
  it('clears a block when the explanation carries a mechanism', () => {
    expect(settleExplanation(assessment({}))).toEqual({ state: 'known', overridden: false });
  });

  it('refuses solid when nothing but names were offered', () => {
    // Reciting correct terminology is the easiest thing in the world to do
    // without understanding, and it is what this whole product exists to catch.
    expect(settleExplanation(assessment({ mechanismDescribed: null }))).toEqual({
      state: 'shaky',
      overridden: true,
    });
  });

  it('refuses solid when the explanation carries a wrong model', () => {
    // A wrong model has to be dropped before anything can be built on it, so
    // however fluent it is, it cannot count as having the idea.
    expect(settleExplanation(assessment({ carriesMisconception: true }))).toEqual({
      state: 'shaky',
      overridden: true,
    });
  });

  it('maps partly to shaky', () => {
    expect(settleExplanation(assessment({ verdict: 'partly' })).state).toBe('shaky');
  });

  it('maps not-yet to blocked', () => {
    expect(settleExplanation(assessment({ verdict: 'not-yet' })).state).toBe('blocked');
  });

  it('does not require a mechanism for the lower verdicts', () => {
    // The override only guards the claim of understanding; below that, an absent
    // mechanism is the point rather than a contradiction.
    expect(settleExplanation(assessment({ verdict: 'partly', mechanismDescribed: null }))).toEqual({
      state: 'shaky',
      overridden: false,
    });
    expect(settleExplanation(assessment({ verdict: 'not-yet', mechanismDescribed: null })).overridden).toBe(
      false,
    );
  });
});
