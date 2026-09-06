'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * A media query as an external store.
 *
 * The same shape as `persisted.ts`, and for the same reasons: the value lives
 * outside React, is read synchronously, and changes underneath it. `useState`
 * plus an effect would cascade a render on every mount and give each caller its
 * own copy.
 *
 * On the server it reports `false`, so the desktop layout — which is the one
 * written without a media query — is what renders first and what a bot or a
 * no-JS reader gets.
 */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below this the panel becomes a sheet over the map rather than a column beside it. */
/**
 * Below this, the panel is a sheet over the map. Above it, a column beside one.
 *
 * It was 1279, and that was measured on the wrong machine. A 14-inch laptop
 * reports about 1230 CSS pixels of viewport at its default scaling, so the
 * two-column layout never appeared on the most common screen this will ever be
 * used on — everybody got the sheet, and a sheet at full desktop width reads as
 * a phone pattern stretched, which is exactly how it was described in review.
 *
 * 1100 is where the two-column layout starts being honest rather than where a
 * breakpoint list happens to have a name: the panel is 28rem, and the map needs
 * roughly 620px before its labels drop under the legible floor and it starts
 * panning instead of fitting.
 */
export const SHEET_QUERY = '(max-width: 1099px)';
/* Must equal `--breakpoint-panel` in globals.css. The layout is chosen here and
   drawn there, and when the two drifted the panel rendered over the map. */
/** Below this the panel opens at full height, because there is no room to share. */
export const PHONE_QUERY = '(max-width: 767px)';
