'use client';

import { useSyncExternalStore } from 'react';

/**
 * localStorage as a React external store.
 *
 * The obvious version of this — `useState` plus an effect that reads storage on
 * mount — has two problems beyond the lint rule that flags it. It cascades an
 * extra render on every mount, and each caller gets its own private copy, so two
 * components reading the same key drift apart the moment one of them writes.
 *
 * `useSyncExternalStore` is the shape React provides for exactly this: a value
 * that lives outside React, is read synchronously, and can change underneath it.
 * It also handles the server case explicitly rather than by accident.
 */

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

/**
 * One subscribe function per key, cached.
 *
 * `useSyncExternalStore` re-subscribes whenever this identity changes, so
 * building it inline would tear down and re-attach a listener on every single
 * render. Caching keeps the subscription stable for the life of the key.
 */
const subscribers = new Map<string, (listener: () => void) => () => void>();

function subscribe(key: string) {
  const cached = subscribers.get(key);
  if (cached) return cached;

  const fn = (listener: () => void) => {
    const forKey = listeners.get(key) ?? new Set<() => void>();
    forKey.add(listener);
    listeners.set(key, forKey);

    // `storage` only fires in OTHER tabs, so same-tab writes go through
    // `notify`. Both are needed: a session open in two tabs should not have
    // one of them quietly working from stale marks.
    window.addEventListener('storage', listener);

    return () => {
      forKey.delete(listener);
      window.removeEventListener('storage', listener);
    };
  };

  subscribers.set(key, fn);
  return fn;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing or disabled storage. Behaves as "nothing stored".
    return null;
  }
}

export function writePersisted(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The session still works; it just will not survive a reload.
  }
  notify(key);
}

/** The raw stored string, or null. Always null on the server and during hydration. */
export function usePersisted(key: string): string | null {
  return useSyncExternalStore(
    subscribe(key),
    () => read(key),
    // Server and first client render must agree, or hydration mismatches.
    () => null,
  );
}

const NEVER = () => () => {};

/**
 * False on the server and during hydration, true afterwards.
 *
 * Used to hold back anything derived from storage for one paint, so marks do
 * not flash in from empty.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    NEVER,
    () => true,
    () => false,
  );
}
