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
export const SHEET_QUERY = '(max-width: 1279px)';
/** Below this the panel opens at full height, because there is no room to share. */
export const PHONE_QUERY = '(max-width: 767px)';
