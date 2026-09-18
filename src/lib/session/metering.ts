import { fallbackKey } from '@/lib/provider';

import { FREE_DAILY_CAP, FREE_TURN_CAP } from './limits';
import { canMeter, issue, overCap, spendSoFar } from './token';

/**
 * One turn's worth of the shared free allowance, spent or refused.
 *
 * The three model-backed routes carried a byte-identical copy of this: check
 * the secret, read the signed spend, refuse if either cap is reached, take the
 * shared key, mint the next token. Three copies of a rule that decides who gets
 * refused is three places for them to drift apart.
 *
 * It also answers the question the copies could not: how much is left. That
 * number used to be the constant 25, printed in the settings menu and never
 * moving, because nothing computed the real one — while every one of these
 * routes had it in hand and threw it away.
 */

export type Metered =
  | { ok: false; error: 'FREE_TIER_UNAVAILABLE' | 'FREE_TURNS_SPENT' | 'FREE_DAILY_SPENT'; status: 429 | 503; cap: number | null }
  | { ok: true; apiKey: string; token: string | null; turnsLeft: number };

/**
 * What is left after this turn — the *binding* cap, not the session one.
 *
 * A session allows 25 and a browser allows 60 a day, so late in a day the
 * smaller number is the one that will actually stop somebody. Reporting 20 when
 * the day's allowance runs out in 3 is the same dishonesty as the fixed 25, in
 * a form that is harder to notice.
 *
 * Never negative: the caller has already been let through, so "none left" is 0
 * rather than a debt.
 */
export function turnsLeftAfter(turns: number, daily: number): number {
  return Math.max(0, Math.min(FREE_TURN_CAP - turns, FREE_DAILY_CAP - daily));
}

export async function meterFreeTurn(sessionToken: string | null): Promise<Metered> {
  if (!canMeter()) return { ok: false, error: 'FREE_TIER_UNAVAILABLE', status: 503, cap: null };

  const spend = await spendSoFar(sessionToken);
  const over = overCap(spend);
  if (over) {
    return {
      ok: false,
      error: over,
      status: 429,
      cap: over === 'FREE_DAILY_SPENT' ? FREE_DAILY_CAP : FREE_TURN_CAP,
    };
  }

  const shared = fallbackKey();
  if (!shared) return { ok: false, error: 'FREE_TIER_UNAVAILABLE', status: 503, cap: null };

  const turns = spend.turns + 1;
  const daily = spend.daily + 1;
  return { ok: true, apiKey: shared, token: await issue(turns, daily), turnsLeft: turnsLeftAfter(turns, daily) };
}
