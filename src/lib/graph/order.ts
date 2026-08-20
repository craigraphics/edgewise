import type { ConceptGraph, ConceptNode } from './types';

/**
 * The order the walkthrough teaches in.
 *
 * Deliberately NOT `nextToAsk`. That one refuses to descend past a node the
 * learner does not have, because building a diagnostic on a suspect foundation
 * is the failure it exists to prevent. Teaching has the opposite obligation: the
 * nodes underneath someone's frontier are precisely the ones they came for, so
 * the walk must go through them rather than around.
 *
 * Two traversals over one graph. Keeping them as separate functions is the point
 * — an earlier draft tried to parameterise one and it read as if the rule were
 * arbitrary, when in fact each rule is load-bearing for its own job.
 */

/**
 * Every node, in an order where nothing arrives before its prerequisites.
 *
 * Sorted by authored layer and then row, which is already a valid topological
 * order — `validate-graph` asserts that a node's layer exceeds every
 * prerequisite's. So this reads down the map the way it is drawn, which is what
 * makes the spoken walk and the picture agree.
 */
export function teachingOrder(graph: ConceptGraph): ConceptNode[] {
  return [...graph.nodes].sort((a, b) => a.layer - b.layer || a.row - b.row || a.id.localeCompare(b.id));
}

/** The nodes already walked through, given a position in that order. */
export function coveredBy(graph: ConceptGraph, position: number): Set<string> {
  return new Set(
    teachingOrder(graph)
      .slice(0, Math.max(0, position))
      .map((node) => node.id),
  );
}
