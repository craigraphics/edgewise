import { beforeEach, describe, expect, it } from 'vitest';

import { ALLOWANCE_KEY, absorbAllowance, allowanceToken, parseAllowance } from './allowance';

/**
 * The rule that matters here is what an ABSENT field means.
 *
 * Two turns spend nothing and mint nothing: the scripted opening, and a skip.
 * Both hand the token straight back and neither reports a count. If absence
 * were read as null, either would wipe a count the session had earned and the
 * settings menu would go back to claiming the full allowance.
 *
 * The suite is deliberately browser-free, so storage is a stub rather than
 * jsdom. What is under test is the merge rule and the parsing, both of which
 * are the same code a browser runs.
 */

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      addEventListener() {},
      removeEventListener() {},
    },
  });
});

describe('absorbAllowance', () => {
  it('takes what a spending turn reports', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    expect(allowanceToken()).toBe('signed');
    expect(parseAllowance(store.get(ALLOWANCE_KEY) ?? null).turnsLeft).toBe(24);
  });

  it('leaves a known count alone when a response does not mention it', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    // The shape of the scripted opening and of a skipped turn.
    absorbAllowance({ sessionToken: 'signed' });
    expect(parseAllowance(store.get(ALLOWANCE_KEY) ?? null)).toEqual({ token: 'signed', turnsLeft: 24 });
  });

  it('leaves the token alone when a response does not mention it', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    absorbAllowance({ turnsLeft: 23 });
    expect(parseAllowance(store.get(ALLOWANCE_KEY) ?? null)).toEqual({ token: 'signed', turnsLeft: 23 });
  });

  it('takes an explicit null, which is how a key of their own says there is no cap', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 24 });
    absorbAllowance({ sessionToken: null, turnsLeft: null });
    expect(allowanceToken()).toBeNull();
  });

  /* Read at send time rather than closed over, which is what lets three
     components post the same token without passing it between them — and what
     lets a second tab's spending be seen by this one. */
  it('is readable outside a render, by whichever surface is posting', () => {
    absorbAllowance({ sessionToken: 'from-the-conversation', turnsLeft: 24 });
    expect(allowanceToken()).toBe('from-the-conversation');
    absorbAllowance({ sessionToken: 'from-the-walkthrough', turnsLeft: 23 });
    expect(allowanceToken()).toBe('from-the-walkthrough');
  });

  it('survives a reload, which is what stops one handing out a fresh allowance', () => {
    absorbAllowance({ sessionToken: 'signed', turnsLeft: 20 });
    // A reload is a new module instance reading the same storage.
    expect(parseAllowance(store.get(ALLOWANCE_KEY) ?? null)).toEqual({ token: 'signed', turnsLeft: 20 });
  });
});

describe('parseAllowance', () => {
  it('treats nothing stored, and corrupt storage, as nothing known', () => {
    expect(parseAllowance(null)).toEqual({ token: null, turnsLeft: null });
    expect(parseAllowance('{nope')).toEqual({ token: null, turnsLeft: null });
  });

  it('refuses a count that is not a real number rather than printing it', () => {
    for (const bad of ['"twenty"', 'null', 'NaN', '-3']) {
      expect(parseAllowance(`{"token":"t","turnsLeft":${bad}}`).turnsLeft).toBeNull();
    }
  });
});
