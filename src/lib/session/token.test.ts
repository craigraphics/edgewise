import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canMeter, issue, overCap, spendSoFar } from './token';
import { FREE_DAILY_CAP, FREE_TURN_CAP } from './limits';

/**
 * The turn cap is the only thing standing between one enthusiastic session and
 * the shared daily quota everyone else is using. Every failure here is silent —
 * a cap that stops counting looks exactly like a cap that is working.
 */

const SECRET = 'test-secret-that-is-long-enough-to-sign-with';

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
});

describe('spendSoFar', () => {
  it('round-trips a count through a signed token', async () => {
    const token = await issue(7, 19);
    expect(await spendSoFar(token)).toEqual({ turns: 7, daily: 19 });
  });

  it('treats a missing token as a fresh session', async () => {
    expect(await spendSoFar(null)).toEqual({ turns: 0, daily: 0 });
    expect(await spendSoFar(undefined)).toEqual({ turns: 0, daily: 0 });
  });

  it('rejects a token signed with a different secret', async () => {
    // The whole point: a client cannot mint itself more turns.
    const forged = await new SignJWT({ turns: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('6h')
      .sign(new TextEncoder().encode('not-the-real-secret'));

    expect((await spendSoFar(forged)).turns).toBe(0);
  });

  it('rejects a tampered payload rather than trusting it', async () => {
    const token = await issue(24, 24);
    const [header, , signature] = token!.split('.');
    const payload = Buffer.from(JSON.stringify({ turns: 0 })).toString('base64url');

    expect((await spendSoFar(`${header}.${payload}.${signature}`)).turns).toBe(0);
  });

  it('treats an expired token as a fresh session rather than an error', async () => {
    // Costs at most one extra session against a shared quota, versus refusing
    // to talk to someone whose tab sat open over lunch.
    const stale = await new SignJWT({ turns: 20 })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));

    expect((await spendSoFar(stale)).turns).toBe(0);
  });

  it('ignores a non-numeric or negative count', async () => {
    const odd = await new SignJWT({ turns: -5 })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('6h')
      .sign(new TextEncoder().encode(SECRET));

    expect((await spendSoFar(odd)).turns).toBe(0);
  });
});

describe('the daily allowance', () => {
  it('carries a per-browser count alongside the per-session one', async () => {
    expect(await spendSoFar(await issue(3, 41))).toEqual({ turns: 3, daily: 41 });
  });

  it('discards a daily count minted on an earlier day', async () => {
    // Keeping it would lock someone out permanently once they hit the cap:
    // the allowance rolls over, so a stale count must not survive with it.
    const yesterday = await new SignJWT({ turns: 2, daily: FREE_DAILY_CAP, day: '2020-01-01' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('6h')
      .sign(new TextEncoder().encode(SECRET));

    const spend = await spendSoFar(yesterday);
    expect(spend.daily).toBe(0);
    // The session count is not dated and survives, which is correct — that
    // session is still the same session.
    expect(spend.turns).toBe(2);
  });
});

describe('overCap', () => {
  it('lets an ordinary session through', () => {
    expect(overCap({ turns: 3, daily: 3 })).toBeNull();
  });

  it('ends the session at the per-session cap', () => {
    expect(overCap({ turns: FREE_TURN_CAP, daily: 0 })).toBe('FREE_TURNS_SPENT');
  });

  it('reports the daily cap first, because it has a different remedy', () => {
    // "Come back tomorrow, or bring a key" is a different message from "this
    // session is over", and reporting the wrong one sends people looking for
    // a problem they do not have.
    expect(overCap({ turns: FREE_TURN_CAP, daily: FREE_DAILY_CAP })).toBe('FREE_DAILY_SPENT');
  });
});

describe('canMeter', () => {
  it('is true when a signing secret is configured', () => {
    expect(canMeter()).toBe(true);
  });

  it('fails closed without one, because an uncapped shared key is the thing the cap prevents', () => {
    delete process.env.SESSION_SECRET;
    expect(canMeter()).toBe(false);
  });

  it('issues nothing without a secret', async () => {
    delete process.env.SESSION_SECRET;
    expect(await issue(1, 1)).toBeNull();
  });
});
