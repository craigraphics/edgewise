'use client';

import { useSyncExternalStore } from 'react';

/**
 * The shared free allowance, and the signed token that carries it.
 *
 * There used to be three of these. `useSession`, the walkthrough and the
 * explain-back panel each held their own `token` in `useState`, each starting at
 * null — so each surface opened its own 25-turn allowance, and alternating
 * between them got you three of them. `AGENTS.md` had already recorded the
 * opposite as the intended design: *"Interruptions and explanations now share
 * that allowance."* They did not.
 *
 * It also made the number unprintable. The settings menu said "Shared free
 * allowance · 25 turns" because `FREE_TURN_CAP` was the only figure anything on
 * the client could honestly state; a count read from any one of three
 * disagreeing tokens would have been worse than the constant.
 *
 * So the token lives outside React, in one place, as an external store — the
 * shape `persisted.ts` already uses, and for the same reason it gives: a value
 * several components read and write cannot be per-component state without
 * drifting.
 *
 * **In memory, deliberately.** It is not in `localStorage`: the token expires in
 * six hours, belongs to this tab's sitting, and putting it in storage would make
 * a reload a different thing from a fresh visit for no gain. Losing it on reload
 * costs one browser one extra session of a shared quota, which is the same trade
 * `token.ts` already records for an expired token.
 */

type Allowance = {
  token: string | null;
  /**
   * Model-backed turns left on the shared allowance, or null when we do not
   * know — before the first turn, and always under a key of their own, where
   * there is no cap to count against.
   */
  turnsLeft: number | null;
};

let current: Allowance = { token: null, turnsLeft: null };

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const snapshot = () => current;
/* Server and first client render must agree, and nothing is known either way. */
const EMPTY: Allowance = { token: null, turnsLeft: null };
const server = () => EMPTY;

/**
 * Take whatever a route said about the allowance.
 *
 * Both fields are optional and absence means "unchanged", not "null": the
 * scripted opening and a skipped turn both pass the token straight back and
 * spend nothing, so neither may reset a count the session has already earned.
 */
export function absorbAllowance(response: { sessionToken?: string | null; turnsLeft?: number | null }) {
  const token = response.sessionToken === undefined ? current.token : response.sessionToken;
  const turnsLeft = response.turnsLeft === undefined ? current.turnsLeft : response.turnsLeft;
  if (token === current.token && turnsLeft === current.turnsLeft) return;

  current = { token, turnsLeft };
  for (const listener of listeners) listener();
}

/** The token to send. Read outside a render, so it is never a stale closure. */
export function allowanceToken(): string | null {
  return current.token;
}

export function useAllowance(): Allowance {
  return useSyncExternalStore(subscribe, snapshot, server);
}
