'use client';

import { useCallback, useMemo } from 'react';

import { teachingOrder } from '@/lib/graph/order';
import type { ConceptGraph } from '@/lib/graph/types';
import { usePersisted, useHydrated, writePersisted } from '@/lib/persisted';

/**
 * Where the learner has got to in the walkthrough.
 *
 * Persisted because understanding a hard subject takes more than one sitting,
 * and losing your place is fatal to the habit — twenty-three steps is a lot to
 * find your way back into. Stored as a position in the teaching order rather
 * than a set of node ids: the order is deterministic, so one number says
 * everything, and it cannot drift out of step with the graph.
 */

const KEY = 'edgewise.walkthrough.v1';

type Stored = { graphVersion: number; position: number };

export function useWalkthrough(graph: ConceptGraph) {
  const raw = usePersisted(KEY);
  const hydrated = useHydrated();
  const order = useMemo(() => teachingOrder(graph), [graph]);

  const position = useMemo(() => {
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      // A version bump means the steps themselves changed, so a saved position
      // points at different content than the learner left off in.
      if (parsed.graphVersion !== graph.version) return 0;
      const value = parsed.position;
      return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(0, value), order.length) : 0;
    } catch {
      return 0;
    }
  }, [graph.version, order.length, raw]);

  const seek = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), order.length);
      writePersisted(KEY, JSON.stringify({ graphVersion: graph.version, position: clamped }));
    },
    [graph.version, order.length],
  );

  return {
    hydrated,
    order,
    position,
    /** The node being taught, or null once the walk is finished. */
    current: position < order.length ? order[position] : null,
    finished: position >= order.length,
    advance: useCallback(() => seek(position + 1), [position, seek]),
    back: useCallback(() => seek(position - 1), [position, seek]),
    restart: useCallback(() => seek(0), [seek]),
    seek,
  };
}
