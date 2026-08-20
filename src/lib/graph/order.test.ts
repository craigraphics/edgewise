import { describe, expect, it } from 'vitest';

import { GRAPH } from './load';
import { coveredBy, teachingOrder } from './order';

describe('teachingOrder', () => {
  const order = teachingOrder(GRAPH);

  it('covers every node, unlike the diagnostic traversal', () => {
    // The whole point of the walkthrough: nothing is skipped for being blocked.
    expect(order).toHaveLength(GRAPH.nodes.length);
    expect(new Set(order.map((n) => n.id)).size).toBe(GRAPH.nodes.length);
  });

  it('never reaches a node before its prerequisites', () => {
    const seen = new Set<string>();
    for (const node of order) {
      for (const prerequisite of node.prerequisites) {
        expect(seen.has(prerequisite)).toBe(true);
      }
      seen.add(node.id);
    }
  });

  it('starts at the root', () => {
    expect(order[0].prerequisites).toEqual([]);
  });

  it('reads down the map, so the spoken walk and the picture agree', () => {
    for (let i = 1; i < order.length; i += 1) {
      const [previous, current] = [order[i - 1], order[i]];
      expect(previous.layer < current.layer || (previous.layer === current.layer && previous.row <= current.row)).toBe(
        true,
      );
    }
  });

  it('is stable across calls', () => {
    expect(teachingOrder(GRAPH).map((n) => n.id)).toEqual(order.map((n) => n.id));
  });
});

describe('coveredBy', () => {
  it('is empty before the walk starts', () => {
    expect(coveredBy(GRAPH, 0).size).toBe(0);
  });

  it('grows one node at a time, in teaching order', () => {
    const order = teachingOrder(GRAPH);
    expect([...coveredBy(GRAPH, 3)]).toEqual(order.slice(0, 3).map((n) => n.id));
  });

  it('clamps rather than throwing on a position outside the walk', () => {
    expect(coveredBy(GRAPH, -5).size).toBe(0);
    expect(coveredBy(GRAPH, 999).size).toBe(GRAPH.nodes.length);
  });
});
