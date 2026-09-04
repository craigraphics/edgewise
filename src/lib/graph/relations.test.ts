import { describe, expect, it } from 'vitest';

import { GRAPH } from './load';
import { ancestorsOf, descendantsOf, focusOn } from './relations';
import type { ConceptGraph } from './types';

/**
 * A diamond with a bypass edge, which is the case the edge rule exists for:
 *
 *      root
 *      /  \
 *   left  right
 *      \  /  \
 *      join   \
 *        \     \
 *         tail—' (root -> tail, skipping everything)
 */
const node = (id: string, layer: number, prerequisites: string[]) => ({
  id,
  label: id,
  subtitle: id,
  band: 'a',
  layer,
  row: 0,
  prerequisites,
  probes: ['?'],
  misconceptions: [],
  explanations: { intuition: 'i', example: 'e' },
  simplificationCost: null,
});

const DIAMOND: ConceptGraph = {
  version: 1,
  subject: 's',
  description: 'd',
  bands: [{ id: 'a', label: 'A' }],
  nodes: [
    node('root', 0, []),
    node('left', 1, ['root']),
    node('right', 1, ['root']),
    node('join', 2, ['left', 'right']),
    node('tail', 3, ['join', 'root']),
  ],
};

describe('ancestorsOf', () => {
  it('walks the whole prerequisite chain, not just one step', () => {
    expect(ancestorsOf(DIAMOND, 'tail')).toEqual(new Set(['join', 'left', 'right', 'root']));
  });

  it('excludes the node itself', () => {
    expect(ancestorsOf(DIAMOND, 'join').has('join')).toBe(false);
  });

  it('is empty at the root', () => {
    expect(ancestorsOf(DIAMOND, 'root').size).toBe(0);
  });

  it('reaches every ancestor once when two paths converge', () => {
    expect(ancestorsOf(DIAMOND, 'join')).toEqual(new Set(['left', 'right', 'root']));
  });
});

describe('descendantsOf', () => {
  it('walks the whole dependant chain', () => {
    expect(descendantsOf(DIAMOND, 'root')).toEqual(new Set(['left', 'right', 'join', 'tail']));
  });

  it('is empty at a leaf', () => {
    expect(descendantsOf(DIAMOND, 'tail').size).toBe(0);
  });
});

describe('focusOn', () => {
  it('includes the node, its ancestors and its descendants', () => {
    expect(focusOn(DIAMOND, 'join').nodes).toEqual(new Set(['join', 'left', 'right', 'root', 'tail']));
  });

  /*
   * The rule that matters. `root -> tail` connects an ancestor of `join` to a
   * descendant of `join` without passing through `join`. Lighting it up would
   * tell the learner that `join` is on that path, which is false.
   */
  it('excludes an edge that bypasses the focused node', () => {
    expect(focusOn(DIAMOND, 'join').edges.has('root->tail')).toBe(false);
  });

  it('includes edges within the ancestor cone', () => {
    const { edges } = focusOn(DIAMOND, 'join');
    expect(edges.has('root->left')).toBe(true);
    expect(edges.has('left->join')).toBe(true);
  });

  it('includes edges within the descendant cone', () => {
    expect(focusOn(DIAMOND, 'join').edges.has('join->tail')).toBe(true);
  });

  it('keeps the bypass edge when the focused node is one of its ends', () => {
    expect(focusOn(DIAMOND, 'root').edges.has('root->tail')).toBe(true);
  });
});

describe('against the real graph', () => {
  it('agrees with the prerequisite lists it was built from', () => {
    for (const concept of GRAPH.nodes) {
      for (const prerequisite of concept.prerequisites) {
        expect(ancestorsOf(GRAPH, concept.id).has(prerequisite)).toBe(true);
        expect(descendantsOf(GRAPH, prerequisite).has(concept.id)).toBe(true);
      }
    }
  });

  it('is symmetric: an ancestor of X has X as a descendant', () => {
    for (const concept of GRAPH.nodes) {
      for (const ancestor of ancestorsOf(GRAPH, concept.id)) {
        expect(descendantsOf(GRAPH, ancestor).has(concept.id)).toBe(true);
      }
    }
  });

  /*
   * The root of a single-rooted DAG reaches everything, which is what makes
   * "22 of the later ideas rest on it" true — and that sentence is the whole
   * argument for the map existing.
   */
  it('reaches all 22 other nodes from the root', () => {
    expect(descendantsOf(GRAPH, 'prediction-from-examples').size).toBe(GRAPH.nodes.length - 1);
  });

  it('never puts a node in its own ancestry', () => {
    for (const concept of GRAPH.nodes) {
      expect(ancestorsOf(GRAPH, concept.id).has(concept.id)).toBe(false);
    }
  });
});
