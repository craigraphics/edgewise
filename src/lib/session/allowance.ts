'use client';

import { useMemo } from 'react';

import { usePersisted, writePersisted } from '@/lib/persisted';

/**
 * The shared free allowance, and the signed token that carries it.
 *
 * There used to be three of these. `useSession`, the walkthrough and the
 * explain-back panel each held their own `token` in `useState`, each starting
 * at null — so each surface opened its own 25-turn allowance, and alternating
 * between them got you three. `AGENTS.md` had already recorded the opposite as
 * the intended design: *"Interruptions and explanations now share that
 * allowance."* They did not.
 *
 * It also made the number unprintable. The settings menu said "Shared free
 * allowance · 25 turns" because `FREE_TURN_CAP` was the only figure anything on
 * the client could honestly state; a count read from any one of three
 * disagreeing tokens would have been worse than the constant.
 *
 * So there is one owner, outside React, as an external store — the shape
 * `persisted.ts` gives, and for the reason that file states: a value several
 * components read and write cannot be per-component state without drifting.
 *
 * **Its own key, not the conversation's.** The token was briefly carried inside
 * `StoredConversation`, which fixed the reload case for the conversation and
 * left the other two surfaces untouched. An allowance is not a property of a
 * conversation: it survives a fresh one, it is spent by a walkthrough
 * interruption and by an explanation, and it has nothing to do with the graph
 * version that record is discarded on. Keeping it here also means a reload
 * cannot hand out a new one, which is the property that move was after.
 */

export const ALLOWANCE_KEY = 'edgewise.allowance.v1';

export type Allowance = {
  token: string | null;
  /**
   * Model-backed turns left on the shared allowance, or null when we do not
   * know — before the first turn, and always under a key of their own, where
   * there is no cap to count against.
   */
  turnsLeft: number | null;
};

const EMPTY: Allowance = { token: null, turnsLeft: null };

export function parseAllowance(raw: string | null): Allowance {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<Allowance>;
    return {
      token: typeof parsed.token === 'string' ? parsed.token : null,
      turnsLeft:
        typeof parsed.turnsLeft === 'number' && Number.isFinite(parsed.turnsLeft) && parsed.turnsLeft >= 0
          ? parsed.turnsLeft
          : null,
    };
  } catch {
    return EMPTY;
  }
}

/** Always from storage, never from a render: another tab may have spent a turn. */
function current(): Allowance {
  try {
    return parseAllowance(window.localStorage.getItem(ALLOWANCE_KEY));
  } catch {
    return EMPTY;
  }
}

/**
 * Take whatever a route said about the allowance.
 *
 * Both fields are optional and absence means "unchanged", not "null": the
 * scripted opening and a skipped turn both pass the token straight back and
 * spend nothing, so neither may reset a count the session has already earned.
 */
export function absorbAllowance(response: { sessionToken?: string | null; turnsLeft?: number | null }) {
  const now = current();
  const next: Allowance = {
    token: response.sessionToken === undefined ? now.token : response.sessionToken,
    turnsLeft: response.turnsLeft === undefined ? now.turnsLeft : response.turnsLeft,
  };
  if (next.token === now.token && next.turnsLeft === now.turnsLeft) return;
  writePersisted(ALLOWANCE_KEY, JSON.stringify(next));
}

/** The token to send. Read at send time, so it is never a stale closure. */
export function allowanceToken(): string | null {
  return current().token;
}

export function useAllowance(): Allowance {
  const raw = usePersisted(ALLOWANCE_KEY);
  return useMemo(() => parseAllowance(raw), [raw]);
}
