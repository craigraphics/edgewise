import { SignJWT, jwtVerify } from 'jose';

export { FREE_TURN_CAP, FREE_DAILY_CAP } from './limits';

import { FREE_DAILY_CAP, FREE_TURN_CAP } from './limits';

/**
 * A signed count of how many turns a session has spent on the shared key.
 *
 * Google's free tier is metered per project and shared across every user —
 * roughly 1,500 requests a day for everyone together. Without a cap, one
 * enthusiastic session can spend a meaningful slice of that and everyone else
 * sees "try again later", which is a worse experience than a session that
 * politely ends.
 *
 * There is no database in the POC, so the counter travels with the client,
 * signed. That stops casual tampering, which is all it needs to do: a
 * determined person can just supply their own key, which is what we want them
 * to do anyway.
 */

function secret(): Uint8Array | null {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value) return null;
  return new TextEncoder().encode(value);
}

/** UTC day stamp, so the daily allowance rolls over at a predictable moment. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function issue(turns: number, daily: number): Promise<string | null> {
  const key = secret();
  if (!key) return null;

  return new SignJWT({ turns, daily, day: today() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    // Long enough for a sitting, short enough that a token cannot be hoarded.
    .setExpirationTime('6h')
    .sign(key);
}

/**
 * Returns the turns already spent, or 0 for a fresh session.
 *
 * An unreadable or expired token is treated as a fresh session rather than an
 * error — the cost of being wrong is one extra session's worth of a shared
 * quota, and the cost of the alternative is refusing to talk to someone whose
 * tab sat open over lunch.
 */
export type Spend = {
  /** Turns spent in the current session. */
  turns: number;
  /** Turns spent by this browser today, across all its sessions. */
  daily: number;
};

export async function spendSoFar(token: string | null | undefined): Promise<Spend> {
  const key = secret();
  if (!key || !token) return { turns: 0, daily: 0 };

  try {
    const { payload } = await jwtVerify(token, key);
    const count = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

    return {
      turns: count(payload.turns),
      // A token minted on an earlier day carries a spent allowance that has
      // since rolled over; keeping it would lock someone out indefinitely.
      daily: payload.day === today() ? count(payload.daily) : 0,
    };
  } catch {
    return { turns: 0, daily: 0 };
  }
}

/**
 * Both caps, checked together. Returns the error to report, or null to proceed.
 *
 * The two are worth distinguishing to the visitor: one session ending is
 * ordinary, and being out for the day is a different message with a different
 * remedy.
 */
export function overCap(spend: Spend): 'FREE_TURNS_SPENT' | 'FREE_DAILY_SPENT' | null {
  if (spend.daily >= FREE_DAILY_CAP) return 'FREE_DAILY_SPENT';
  if (spend.turns >= FREE_TURN_CAP) return 'FREE_TURNS_SPENT';
  return null;
}

/**
 * True when the shared key is usable at all.
 *
 * Fails closed on a missing secret, and only for the free path: without a
 * signing key there is no cap, and an uncapped shared key is precisely what the
 * cap exists to prevent. Someone with their own key is unaffected.
 */
export function canMeter(): boolean {
  if (secret()) return true;
  console.error('[session] SESSION_SECRET is not set; the free fallback is disabled because it cannot be capped');
  return false;
}
