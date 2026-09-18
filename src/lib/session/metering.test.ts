import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { meterFreeTurn, turnsLeftAfter } from './metering';
import { FREE_DAILY_CAP, FREE_TURN_CAP } from './limits';
import { issue } from './token';

/**
 * The three model-backed routes used to carry a copy of this each. A cap that
 * drifts between copies fails silently — one route keeps letting somebody
 * through after the other two have stopped — and the number it reports is now
 * printed in the interface, so being wrong is visible rather than theoretical.
 */

const SECRET = 'test-secret-that-is-long-enough-to-sign-with';
const KEY = 'test-shared-key';

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = KEY;
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
});

describe('turnsLeftAfter', () => {
  it('counts down the session allowance', () => {
    expect(turnsLeftAfter(1, 1)).toBe(FREE_TURN_CAP - 1);
  });

  /*
   * The whole reason this is not just `FREE_TURN_CAP - turns`. Late in a day
   * the daily allowance is what will actually stop somebody, and saying "20
   * left" when the answer is 3 is the dishonesty this replaced.
   */
  it('reports the binding cap when the daily allowance is the smaller one', () => {
    expect(turnsLeftAfter(1, FREE_DAILY_CAP - 3)).toBe(3);
  });

  it('never reports a negative allowance', () => {
    expect(turnsLeftAfter(FREE_TURN_CAP + 5, FREE_DAILY_CAP + 5)).toBe(0);
  });

  it('reports none left on the turn that reaches the cap', () => {
    expect(turnsLeftAfter(FREE_TURN_CAP, 1)).toBe(0);
  });
});

describe('meterFreeTurn', () => {
  it('spends a turn and hands back the shared key', async () => {
    const metered = await meterFreeTurn(null);
    expect(metered).toMatchObject({ ok: true, apiKey: KEY, turnsLeft: FREE_TURN_CAP - 1 });
  });

  it('counts the turn it is granting, not the one before it', async () => {
    const first = await meterFreeTurn(null);
    if (!first.ok) throw new Error('expected the first turn to be granted');
    const second = await meterFreeTurn(first.token);
    expect(second).toMatchObject({ ok: true, turnsLeft: FREE_TURN_CAP - 2 });
  });

  it('refuses once the session allowance is spent, and says which cap', async () => {
    const spent = await issue(FREE_TURN_CAP, 1);
    expect(await meterFreeTurn(spent)).toEqual({ ok: false, error: 'FREE_TURNS_SPENT', status: 429, cap: FREE_TURN_CAP });
  });

  it('refuses on the daily allowance before the session one', async () => {
    const spent = await issue(0, FREE_DAILY_CAP);
    expect(await meterFreeTurn(spent)).toEqual({ ok: false, error: 'FREE_DAILY_SPENT', status: 429, cap: FREE_DAILY_CAP });
  });

  /* An unreadable token is a fresh session, not an error — `spendSoFar`'s
     contract, restated here because this is now the only caller of it. */
  it('treats a token it cannot read as a fresh session', async () => {
    const metered = await meterFreeTurn('not-a-token');
    expect(metered).toMatchObject({ ok: true, turnsLeft: FREE_TURN_CAP - 1 });
  });

  it('fails closed when there is no secret to cap with', async () => {
    delete process.env.SESSION_SECRET;
    expect(await meterFreeTurn(null)).toMatchObject({ ok: false, error: 'FREE_TIER_UNAVAILABLE', status: 503 });
  });

  it('refuses rather than pretending, when there is no shared key to spend', async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(await meterFreeTurn(null)).toMatchObject({ ok: false, error: 'FREE_TIER_UNAVAILABLE', status: 503 });
  });
});
