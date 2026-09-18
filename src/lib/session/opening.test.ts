import { describe, expect, it } from 'vitest';

import { emptyModel, nextToAsk, withMark } from '@/lib/graph/frontier';
import { GRAPH } from '@/lib/graph/load';

import { openingFor } from './opening';

describe('openingFor', () => {
  it('says it starts near the bottom when the first question is the root', () => {
    const first = nextToAsk(GRAPH, emptyModel(GRAPH))!;
    expect(first.layer).toBe(0);
    expect(openingFor(first)).toContain('near the bottom');
    expect(openingFor(first)).toContain(first.probes[0]);
  });

  it('does not claim the bottom when resuming at a mid-map frontier', () => {
    const root = nextToAsk(GRAPH, emptyModel(GRAPH))!;
    const first = nextToAsk(GRAPH, withMark(emptyModel(GRAPH), root.id, 'known'))!;
    expect(first.layer).toBeGreaterThan(0);
    expect(openingFor(first)).not.toMatch(/bottom|beginning|start/i);
    expect(openingFor(first)).toContain(first.probes[0]);
  });
});
