'use client';

import { useCallback, useMemo } from 'react';

import { emptyModel, withMark } from '@/lib/graph/frontier';
import { usePersisted, useHydrated, writePersisted } from '@/lib/persisted';
import { plausibleLearner } from '@/lib/graph/fixtures';
import type { ConceptGraph, LearnerModel, NodeState } from '@/lib/graph/types';

/**
 * The learner model, persisted in localStorage.
 *
 * The boundary is the point: everything above this file treats the model as
 * opaque state, so swapping localStorage for a database row later touches only
 * this module. Storage is read through `usePersisted`, which keeps every
 * consumer on the same value rather than giving each its own drifting copy.
 */

const KEY = 'edgewise.learner.v1';

/**
 * Turns whatever was in storage into a usable model, discarding it if it was
 * written against a different graph.
 *
 * Discarding rather than migrating is deliberate. A version bump means node
 * content changed materially, and a mark of "known" made against a probe that no
 * longer exists is worse than no mark — it is a confident claim about the
 * learner with nothing behind it.
 */
export function parseStored(graph: ConceptGraph, raw: string | null): LearnerModel {
  if (!raw) return emptyModel(graph);

  try {
    const parsed = JSON.parse(raw) as Partial<LearnerModel>;
    if (parsed.graphVersion !== graph.version || typeof parsed.states !== 'object' || !parsed.states) {
      return emptyModel(graph);
    }

    // Drop marks for nodes that no longer exist, so a renamed id cannot leave a
    // state nothing can ever clear.
    const ids = new Set(graph.nodes.map((node) => node.id));
    const states = Object.fromEntries(
      Object.entries(parsed.states).filter(([id, state]) => ids.has(id) && VALID.has(state as NodeState)),
    ) as Record<string, NodeState>;

    return { graphVersion: graph.version, states };
  } catch {
    // Corrupt storage is not worth crashing a session over.
    return emptyModel(graph);
  }
}

const VALID = new Set<NodeState>(['known', 'shaky', 'blocked', 'unexplored']);

export function useLearnerModel(graph: ConceptGraph) {
  const raw = usePersisted(KEY);
  const hydrated = useHydrated();

  const model = useMemo(() => parseStored(graph, raw), [graph, raw]);

  const commit = useCallback((next: LearnerModel) => {
    writePersisted(KEY, JSON.stringify(next));
  }, []);

  /*
   * Derives the next model from what is actually stored rather than from the
   * rendered one. Two marks landing in the same tick — the agent settling a node
   * while someone clicks another by hand — would otherwise both build on the
   * same stale snapshot and one would be lost.
   */
  const mark = useCallback(
    (nodeId: string, state: NodeState) => {
      const current = parseStored(graph, read(KEY));
      writePersisted(KEY, JSON.stringify(withMark(current, nodeId, state)));
    },
    [graph],
  );

  const reset = useCallback(() => commit(emptyModel(graph)), [commit, graph]);
  const loadFixture = useCallback(() => commit(plausibleLearner(graph)), [commit, graph]);

  return { model, hydrated, mark, reset, loadFixture };
}

/** Synchronous read for the write path, where a hook cannot be used. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
