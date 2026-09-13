'use client';

import { useEffect, useRef } from 'react';

/**
 * The URL hash, as something to subscribe to.
 *
 * `persisted.ts` and `use-media.ts` read their external systems with
 * `useSyncExternalStore`, because a component renders from those values. This
 * one is different in kind: nothing renders from the hash. A link is an
 * *event* — somebody arrived, pasted, reloaded, or pressed back — and the app
 * responds by moving. So the shape here is a subscription with a callback,
 * which is also the shape React asks for when an effect has to set state from
 * outside.
 *
 * The hash that is already in the address bar is delivered through that same
 * callback rather than read separately on mount. One path in, so a pasted link
 * and a hand-edited one are handled by the same code, and there is no second
 * place for the two to disagree.
 */

/** The current hash, including its leading `#`, or the empty string. */
export function readHash(): string {
  return window.location.hash;
}

/**
 * Put a hash in the address bar without adding a history entry.
 *
 * Selecting an idea is panel state, not a page: pushing would bury the back
 * button under twenty-three entries and make leaving the site a chore. The URL
 * is here so it can be copied, reloaded and sent — not so it can be stepped
 * through.
 */
export function writeHash(hash: string) {
  if (hash === readHash()) return;
  // `replaceState` with an empty string keeps the existing hash and `'#'`
  // leaves a bare one dangling in the address bar, so clearing is spelled out
  // as the path and query with no fragment at all.
  const url = hash || window.location.pathname + window.location.search;
  window.history.replaceState(window.history.state, '', url);
}

/**
 * Call `onHash` with the hash now, and again whenever the browser changes it.
 *
 * `replaceState` fires no event, so this never hears the app's own writes —
 * which is what makes the caller's "have I already applied this?" check
 * straightforward rather than a loop to break.
 */
export function useHashRoute(onHash: (hash: string) => void) {
  const latest = useRef(onHash);
  useEffect(() => { latest.current = onHash; });

  useEffect(() => {
    const deliver = () => latest.current(readHash());
    // A microtask, so the first delivery lands after the mount commit and
    // before the browser paints: a link opens on the idea it names rather than
    // flashing the ordinary first screen on the way there.
    queueMicrotask(deliver);
    // `hashchange` covers a hand-edited address bar; `popstate` covers back
    // and forward across a real navigation.
    window.addEventListener('hashchange', deliver);
    window.addEventListener('popstate', deliver);
    return () => {
      window.removeEventListener('hashchange', deliver);
      window.removeEventListener('popstate', deliver);
    };
  }, []);
}
