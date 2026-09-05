import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import { focusOn } from '@/lib/graph/relations';

import { cascadeFrom } from './cascade';

describe('cascadeFrom', () => {
  /*
   * The cascade is an ordering laid over `focusOn`, so the two must always
   * agree about membership. If they ever drift, the map animates a set of
   * relationships that is not the set it then leaves lit — which would be the
   * picture contradicting itself mid-transition.
   */
  it('lights exactly what focusOn lights, for every node', () => {
    for (const node of GRAPH.nodes) {
      const focus = focusOn(GRAPH, node.id);
      const cascade = cascadeFrom(GRAPH, node.id);
      expect([...cascade.nodes.keys()].sort()).toEqual([...focus.nodes].sort());
      expect([...cascade.edges.keys()].sort()).toEqual([...focus.edges].sort());
    }
  });

  it('puts the focused node at the start', () => {
    for (const node of GRAPH.nodes) {
      expect(cascadeFrom(GRAPH, node.id).nodes.get(node.id)).toBe(0);
    }
  });

  it('never lights an edge before both of its ends', () => {
    for (const node of GRAPH.nodes) {
      const cascade = cascadeFrom(GRAPH, node.id);
      for (const [id, edge] of cascade.edges) {
        const [from, to] = id.split('->');
        expect(edge.step).toBe(Math.max(cascade.nodes.get(from)!, cascade.nodes.get(to)!));
        expect(edge.step).toBeGreaterThanOrEqual(1);
      }
    }
  });

  /*
   * Direction is what makes the animation readable rather than decorative: an
   * upward edge draws towards the prerequisite it rests on. Both ends of an
   * upward edge must therefore be prerequisites of the focused node, or the
   * animation would be pointing the wrong way up the map.
   */
  it('marks an edge upward only when both ends are prerequisites', () => {
    for (const node of GRAPH.nodes) {
      const cascade = cascadeFrom(GRAPH, node.id);
      const ancestors = focusOn(GRAPH, node.id);
      for (const [id, edge] of cascade.edges) {
        if (!edge.upward) continue;
        const [from, to] = id.split('->');
        expect(ancestors.nodes.has(from)).toBe(true);
        expect(ancestors.nodes.has(to)).toBe(true);
        /* An upward edge from the focused node itself would be a cycle. */
        expect(from === node.id && to === node.id).toBe(false);
      }
    }
  });

  it('measures distance in prerequisite steps, not layers', () => {
    /*
     * The root is a prerequisite of everything eventually, but not of
     * everything directly — so its cascade has real depth rather than one
     * step, and that depth is what the animation spends its time on.
     */
    const root = GRAPH.nodes.find((node) => node.prerequisites.length === 0)!;
    const cascade = cascadeFrom(GRAPH, root.id);
    expect(cascade.steps).toBeGreaterThan(1);
    expect(cascade.nodes.size).toBe(GRAPH.nodes.length);
  });

  it('returns nothing for a node that is not in the graph', () => {
    const cascade = cascadeFrom(GRAPH, 'not-a-node');
    expect(cascade.nodes.size).toBe(0);
    expect(cascade.edges.size).toBe(0);
    expect(cascade.steps).toBe(0);
  });
});
