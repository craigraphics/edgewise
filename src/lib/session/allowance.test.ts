import { beforeEach, describe, expect, it } from 'vitest';

import { absorbAllowance, allowanceToken } from './allowance';

/**
 * The rule that matters here is what an ABSENT field means.
 *
 * Two turns spend nothing and mint nothing: the scripted opening, and a skip.
 * Both hand the token straight back and neither reports a count. If absence
 * were read as null, either would wipe a count the session had earned and the
 * settings menu would go back to claiming the full allowance.
 */

beforeEach(() => {
  absorbAllowance({ sessionToken: null, turnsLeft: null });
});

const read = () => ({ token: allowanceToken() });

describe('absorbAllowance', () => {
  it('takes what a spending turn reports', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    expect(read().token).toBe('signed');
  });

  it('leaves a known count alone when a response does not mention it', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    // The shape of the scripted opening and of a skipped turn.
    absorbAllowance({ sessionToken: 'signed' });
    expect(read().token).toBe('signed');
  });

  it('leaves the token alone when a response does not mention it', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    absorbAllowance({ turnsLeft: 23 });
    expect(read().token).toBe('signed');
  });

  it('takes an explicit null, which is how the free tier says it minted nothing', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    absorbAllowance({ sessionToken: null, turnsLeft: null });
    expect(read().token).toBeNull();
  });

  /* Read at send time rather than closed over, which is what lets three
     components post the same token without passing it between them. */
  it('is readable outside a render, by whichever surface is posting', () => {
    absorbAllowance({ sessionToken: 'from-the-conversation', turnsLeft: 24 });
    expect(allowanceToken()).toBe('from-the-conversation');
    absorbAllowance({ sessionToken: 'from-the-walkthrough', turnsLeft: 23 });
    expect(allowanceToken()).toBe('from-the-walkthrough');
  });
});
