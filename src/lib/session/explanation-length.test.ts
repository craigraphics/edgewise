import { describe, expect, it } from 'vitest';

import { explanationReadiness, wordCount } from './explanation-length';

describe('explanationReadiness', () => {
  it('holds back "ok" and says why', () => {
    const result = explanationReadiness('ok');
    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/more words/);
  });

  it('holds back an empty field with its own reason', () => {
    expect(explanationReadiness('   ')).toEqual({ ready: false, reason: expect.stringMatching(/sentence/) });
  });

  it('accepts a short sentence that is genuinely an explanation', () => {
    expect(explanationReadiness('It multiplies each input by a weight').ready).toBe(true);
  });

  it('does not count punctuation as words', () => {
    expect(wordCount('ok . . — !')).toBe(1);
  });

  it('never grades the attempt in its reason', () => {
    for (const text of ['', 'ok', 'yes it does']) {
      expect(explanationReadiness(text).reason).not.toMatch(/\b(wrong|incorrect|fail|score|bad)\b/i);
    }
  });
});
