import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import { parseStored } from './store';

/**
 * These cover the ways stored state can be wrong, all of which are silent.
 * A learner model that survives when it should not is worse than none: it makes
 * confident claims about someone with nothing behind them.
 */

const stored = (value: unknown) => JSON.stringify(value);

describe('parseStored', () => {
  it('returns an empty model when nothing is stored', () => {
    expect(parseStored(GRAPH, null).states).toEqual({});
  });

  it('keeps marks written against the current graph version', () => {
    const raw = stored({ graphVersion: GRAPH.version, states: { tokens: 'known' } });
    expect(parseStored(GRAPH, raw).states).toEqual({ tokens: 'known' });
  });

  it('discards everything when the graph version has moved on', () => {
    // A version bump means node content changed materially, so a "known" mark
    // was made against a probe that may no longer exist.
    const raw = stored({ graphVersion: GRAPH.version + 1, states: { tokens: 'known' } });
    expect(parseStored(GRAPH, raw).states).toEqual({});
  });

  it('drops marks for nodes that no longer exist', () => {
    const raw = stored({ graphVersion: GRAPH.version, states: { tokens: 'known', 'renamed-away': 'known' } });
    expect(parseStored(GRAPH, raw).states).toEqual({ tokens: 'known' });
  });

  it('drops states that are not part of the vocabulary', () => {
    const raw = stored({ graphVersion: GRAPH.version, states: { tokens: 'excellent' } });
    expect(parseStored(GRAPH, raw).states).toEqual({});
  });

  it('survives corrupt JSON rather than throwing mid-session', () => {
    expect(parseStored(GRAPH, '{not json').states).toEqual({});
  });

  it('survives a stored value of the wrong shape', () => {
    expect(parseStored(GRAPH, stored({ graphVersion: GRAPH.version })).states).toEqual({});
    expect(parseStored(GRAPH, stored('nonsense')).states).toEqual({});
  });

  it('always reports the current graph version, never the stored one', () => {
    const raw = stored({ graphVersion: 99, states: {} });
    expect(parseStored(GRAPH, raw).graphVersion).toBe(GRAPH.version);
  });
});
