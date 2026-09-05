import { ancestorsOf, focusOn } from '@/lib/graph/relations';
import { indexNodes } from '@/lib/graph/frontier';
import type { ConceptGraph } from '@/lib/graph/types';

/**
 * Focus, but ordered — how far each node in the two cones sits from the one
 * being focused, measured in prerequisite steps.
 *
 * `focusOn` answers *which* nodes are on a path through this one. It cannot
 * answer *in what order*, and order is the part a still picture cannot show.
 * Lighting the whole cone at once says "these are related"; lighting it outward
 * a step at a time says "this rests on that, which rests on that" — which is
 * the sentence the graph exists to make, and the learner watches it being
 * built rather than being told it.
 *
 * Membership here is exactly `focusOn`'s, and there is a test asserting the two
 * agree. The traversal has to stay honest about the rule that matters: an edge
 * belongs to the cascade only when both of its ends are in the same cone, so an
 * ancestor-to-descendant edge that bypasses the focused node never lights.
 */

export type CascadeEdge = {
  /** Which step of the cascade this edge lights on. Always at least 1. */
  step: number;
  /**
   * True when the edge lies in the ancestor cone, so it should be drawn from
   * its dependant end back towards its prerequisite — the direction the eye is
   * travelling, up the map towards what this rests on.
   */
  upward: boolean;
};

export type Cascade = {
  /** Node id → steps from the focused node. The focused node itself is 0. */
  nodes: ReadonlyMap<string, number>;
  edges: ReadonlyMap<string, CascadeEdge>;
  /** The furthest step reached, so a caller can time what happens afterwards. */
  steps: number;
};

const EMPTY: Cascade = { nodes: new Map(), edges: new Map(), steps: 0 };

export function cascadeFrom(graph: ConceptGraph, nodeId: string): Cascade {
  const index = indexNodes(graph);
  if (!index.has(nodeId)) return EMPTY;

  const dependants = new Map<string, string[]>();
  for (const node of graph.nodes) {
    for (const prerequisite of node.prerequisites) {
      if (!index.has(prerequisite)) continue;
      dependants.set(prerequisite, [...(dependants.get(prerequisite) ?? []), node.id]);
    }
  }

  /*
   * Breadth-first in both directions at once, from the focused node. A node
   * cannot appear in both cones — that would be a cycle, and `validate-graph`
   * asserts the graph is acyclic — so the two walks cannot disagree about a
   * depth.
   */
  const depth = new Map<string, number>([[nodeId, 0]]);
  const walk = (next: (id: string) => Iterable<string>) => {
    let frontier = [nodeId];
    let step = 0;
    while (frontier.length > 0) {
      step += 1;
      const found: string[] = [];
      for (const id of frontier) {
        for (const neighbour of next(id)) {
          if (depth.has(neighbour)) continue;
          depth.set(neighbour, step);
          found.push(neighbour);
        }
      }
      frontier = found;
    }
  };

  walk((id) => (index.get(id)?.prerequisites ?? []).filter((p) => index.has(p)));
  walk((id) => dependants.get(id) ?? []);

  /*
   * The ancestor cone decides an edge's direction. The focused node is in it
   * as well as in the descendant cone — it is the one place the two meet — so
   * an edge with the focused node at one end still counts as upward when its
   * other end is a prerequisite.
   */
  const above = new Set([...ancestorsOf(graph, nodeId), nodeId]);

  const edges = new Map<string, CascadeEdge>();
  for (const id of focusOn(graph, nodeId).edges) {
    const [from, to] = id.split('->');
    /*
     * An edge lights when its FURTHER end lights, never before: drawing a line
     * to a node that is not there yet is the map claiming something it has not
     * yet shown.
     */
    const step = Math.max(depth.get(from) ?? 0, depth.get(to) ?? 0);
    edges.set(id, { step, upward: above.has(from) && above.has(to) });
  }

  return { nodes: depth, edges, steps: Math.max(0, ...depth.values()) };
}
