import { indexNodes } from './frontier';
import type { ConceptGraph } from './types';

/**
 * What a node rests on, and what rests on it.
 *
 * The map draws 33 edges over 23 nodes, and around `attention` and
 * `next-token-prediction` six of them cross within forty pixels of each other.
 * Drawn all at once they are unreadable, which meant the two questions a
 * prerequisite graph exists to answer — what does this rest on, what rests on
 * this — could only be answered by tracing a curve with a finger.
 *
 * So the picture answers them instead: touch a node and its two cones light up
 * while everything else recedes. That is a rendering decision, but the
 * traversal underneath it is a fact about the graph, so it lives here with the
 * other pure traversals rather than inside the component.
 */

export type Focus = {
  /** The node itself, everything it rests on, and everything resting on it. */
  nodes: ReadonlySet<string>;
  /** Edge ids (`from->to`) that lie within one of the two cones. */
  edges: ReadonlySet<string>;
};

/** Everything `nodeId` transitively depends on. Excludes the node itself. */
export function ancestorsOf(graph: ConceptGraph, nodeId: string): Set<string> {
  const index = indexNodes(graph);
  const found = new Set<string>();

  const visit = (id: string) => {
    for (const prerequisite of index.get(id)?.prerequisites ?? []) {
      if (!index.has(prerequisite) || found.has(prerequisite)) continue;
      found.add(prerequisite);
      visit(prerequisite);
    }
  };

  visit(nodeId);
  return found;
}

/**
 * Everything that transitively depends on `nodeId`. Excludes the node itself.
 *
 * `downstreamOf` in `frontier.ts` answers the same question but returns sorted
 * nodes, because it feeds a sentence a learner reads ("11 later ideas rest on
 * this one, including…"). This returns a set, because it feeds a lookup run
 * once per node per render. Same traversal, different shape, and merging them
 * would make one of the two callers pay for the other's needs.
 */
export function descendantsOf(graph: ConceptGraph, nodeId: string): Set<string> {
  const found = new Set<string>();

  const visit = (id: string) => {
    for (const node of graph.nodes) {
      if (!node.prerequisites.includes(id) || found.has(node.id)) continue;
      found.add(node.id);
      visit(node.id);
    }
  };

  visit(nodeId);
  return found;
}

/**
 * The two cones, plus the edges inside them.
 *
 * An edge counts only when both of its ends are in the SAME cone. An edge from
 * an ancestor straight to a descendant is a real edge that bypasses the node
 * entirely, and lighting it up would claim the focused node is on a path it is
 * not on — which is exactly the kind of confident wrongness the map cannot
 * afford.
 */
export function focusOn(graph: ConceptGraph, nodeId: string): Focus {
  const ancestors = ancestorsOf(graph, nodeId);
  const descendants = descendantsOf(graph, nodeId);

  const above = new Set([...ancestors, nodeId]);
  const below = new Set([...descendants, nodeId]);

  const edges = new Set<string>();
  for (const node of graph.nodes) {
    for (const prerequisite of node.prerequisites) {
      const withinAbove = above.has(prerequisite) && above.has(node.id);
      const withinBelow = below.has(prerequisite) && below.has(node.id);
      if (withinAbove || withinBelow) edges.add(`${prerequisite}->${node.id}`);
    }
  }

  return { nodes: new Set([...above, ...below]), edges };
}
