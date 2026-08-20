'use client';

import { useCallback, useMemo } from 'react';

import { DEFAULT_MODEL, type ModelId } from '@/lib/models';
import { usePersisted, useHydrated, writePersisted } from '@/lib/persisted';

/**
 * The learner's key and model choice.
 *
 * Kept in localStorage rather than a cookie so it is never attached to a request
 * automatically. It goes to our server only on the turns that need it, and the
 * server uses it for that request and discards it. Say all of this in the UI —
 * asking someone for an API key without saying what happens to it is not a
 * reasonable thing to do.
 */

const KEY = 'edgewise.config.v1';

export type SessionConfig = {
  apiKey: string;
  model: ModelId;
};

const EMPTY: SessionConfig = { apiKey: '', model: DEFAULT_MODEL };

export function useSessionConfig() {
  const raw = usePersisted(KEY);
  const hydrated = useHydrated();

  const config = useMemo<SessionConfig>(() => {
    if (!raw) return EMPTY;
    try {
      const parsed = JSON.parse(raw) as Partial<SessionConfig>;
      return {
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
        model: (parsed.model as ModelId) ?? DEFAULT_MODEL,
      };
    } catch {
      // Corrupt storage just means starting on the free path.
      return EMPTY;
    }
  }, [raw]);

  const save = useCallback((next: SessionConfig) => writePersisted(KEY, JSON.stringify(next)), []);
  const forget = useCallback(() => writePersisted(KEY, null), []);

  return { config, hydrated, save, forget };
}
