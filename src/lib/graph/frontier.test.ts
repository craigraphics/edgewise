import { describe, expect, it } from 'vitest';

import { downstreamOf, frontier, leadNode, nextToAsk, progress, stateOf, withMark } from './frontier';
import { GRAPH } from './load';
import type { ConceptGraph, LearnerModel, NodeState } from './types';

/**
 * A tiny synthetic graph, so these assert the traversal rules rather than the
 * current contents of content/graph.json. Authoring a new node should not break
 * a test about how the frontier is derived.
 *
 *        a
 *       / \
 *      b   c
 *       \ /
 *        d
 *        |
 *        e
 */
const TOY: ConceptGraph = {
  version: 1,
  subject: 'toy',
  description: 'toy',
  bands: [{ id: 'x', label: 'X' }],
  nodes: [
    ['a', 0, 1, []],
    ['b', 1, 0, ['a']],
    ['c', 1, 2, ['a']],
    ['d', 2, 1, ['b', 'c']],
    ['e', 3, 1, ['d']],
  ].map(([id, layer, row, prerequisites]) => ({
    id: id as string,
    label: id as string,
    subtitle: id as string,
    band: 'x',
    layer: layer as number,
    row: row as number,
    prerequisites: prerequisites as string[],
    probes: ['?'],
    misconceptions: [],
    explanations: { intuition: 'i', example: 'e' },
    simplificationCost: null,
  })),
};

const model = (states: Record<string, NodeState>): LearnerModel => ({ graphVersion: 1, states });

describe('stateOf', () => {
  it('treats an absent node as unexplored, so a fresh model needs no seeding', () => {
    expect(stateOf(model({}), 'a')).toBe('unexplored');
  });
});

describe('frontier', () => {
  it('starts at the roots, since nothing else has its prerequisites met', () => {
    expect(frontier(TOY, model({})).map((n) => n.id)).toEqual(['a']);
  });

  it('opens both branches once the shared prerequisite is known', () => {
    expect(frontier(TOY, model({ a: 'known' })).map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('keeps a shaky node on the frontier rather than counting it as done', () => {
    // The failure this guards: treating a half-held idea as settled walks the
    // learner straight past the thing that was blocking them.
    expect(frontier(TOY, model({ a: 'shaky' })).map((n) => n.id)).toContain('a');
  });

  it('does not open a node whose prerequisite is only shaky', () => {
    // Building on a foundation we already suspect is the core failure mode.
    expect(frontier(TOY, model({ a: 'shaky' })).map((n) => n.id)).not.toContain('b');
  });

  it('does not open a node whose prerequisite is blocked', () => {
    expect(frontier(TOY, model({ a: 'blocked' })).map((n) => n.id)).toEqual(['a']);
  });

  it('requires every prerequisite, not just one', () => {
    expect(frontier(TOY, model({ a: 'known', b: 'known' })).map((n) => n.id)).not.toContain('d');
    expect(frontier(TOY, model({ a: 'known', b: 'known', c: 'known' })).map((n) => n.id)).toContain('d');
  });

  it('empties only when every node is known', () => {
    const all = model({ a: 'known', b: 'known', c: 'known', d: 'known', e: 'known' });
    expect(frontier(TOY, all)).toEqual([]);
  });
});

describe('leadNode', () => {
  it('returns null when there is nothing left to ask about', () => {
    expect(leadNode(TOY, model({ a: 'known', b: 'known', c: 'known', d: 'known', e: 'known' }))).toBeNull();
  });

  it('prefers a node we have evidence about over one we have merely not asked', () => {
    // c is shallower than b by row, but b is where we already found trouble.
    const lead = leadNode(TOY, model({ a: 'known', b: 'shaky' }));
    expect(lead?.id).toBe('b');
  });

  it('is stable across calls, so the map does not reshuffle between turns', () => {
    const state = model({ a: 'known' });
    expect(leadNode(TOY, state)?.id).toBe(leadNode(TOY, state)?.id);
  });

  it('breaks ties by depth then row, not by array order', () => {
    expect(leadNode(TOY, model({ a: 'known' }))?.id).toBe('b');
  });
});

describe('downstreamOf', () => {
  it('reaches transitively, not just direct dependants', () => {
    expect(downstreamOf(TOY, 'a').map((n) => n.id)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('is empty for a leaf', () => {
    expect(downstreamOf(TOY, 'e')).toEqual([]);
  });
});

describe('progress', () => {
  it('counts only known, so a shaky node does not read as covered', () => {
    expect(progress(TOY, model({ a: 'known', b: 'shaky' }))).toEqual({ known: 1, total: 5 });
  });
});

describe('the authored graph', () => {
  it('parses and exposes a single starting point', () => {
    expect(frontier(GRAPH, { graphVersion: GRAPH.version, states: {} })).toHaveLength(1);
  });

  it('has a reachable path to every node', () => {
    // Walk the whole graph by repeatedly marking the frontier known. If any node
    // is unreachable — an edge to a node that can never be satisfied — this
    // never terminates at the full count.
    const state: Record<string, NodeState> = {};
    for (let step = 0; step < GRAPH.nodes.length + 1; step += 1) {
      const next = frontier(GRAPH, { graphVersion: GRAPH.version, states: state });
      if (next.length === 0) break;
      for (const node of next) state[node.id] = 'known';
    }
    expect(Object.keys(state)).toHaveLength(GRAPH.nodes.length);
  });
});

describe('nextToAsk', () => {
  it('starts at the root', () => {
    expect(nextToAsk(TOY, model({}))?.id).toBe('a');
  });

  it('skips a node we have already resolved as shaky, rather than re-asking it', () => {
    // Re-asking something we already established is the interrogation failure.
    // b stays on the frontier for display, but is not asked about again.
    expect(nextToAsk(TOY, model({ a: 'known', b: 'shaky' }))?.id).toBe('c');
  });

  it('skips a blocked node too', () => {
    expect(nextToAsk(TOY, model({ a: 'known', b: 'blocked' }))?.id).toBe('c');
  });

  it('does not descend past a node that is not known', () => {
    // d requires both b and c; b is blocked, so d must never be asked about.
    expect(nextToAsk(TOY, model({ a: 'known', b: 'blocked', c: 'known' }))).toBeNull();
  });

  it('returns null when every frontier node has been resolved — the session ends', () => {
    expect(nextToAsk(TOY, model({ a: 'shaky' }))).toBeNull();
  });

  it('returns null when everything is known', () => {
    const all = model({ a: 'known', b: 'known', c: 'known', d: 'known', e: 'known' });
    expect(nextToAsk(TOY, all)).toBeNull();
  });
});

describe('withMark', () => {
  it('does not mutate the model it is given', () => {
    const before = model({ a: 'known' });
    withMark(before, 'b', 'shaky');
    expect(before.states).toEqual({ a: 'known' });
  });

  it('lets the caller look ahead without committing', () => {
    const now = model({ a: 'known' });
    expect(nextToAsk(TOY, withMark(now, 'b', 'known'))?.id).toBe('c');
    expect(nextToAsk(TOY, withMark(now, 'b', 'blocked'))?.id).toBe('c');
  });

  it('treats unexplored as removing the mark, not storing one', () => {
    expect(withMark(model({ a: 'known' }), 'a', 'unexplored').states).toEqual({});
  });
});
