import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';

import { panelAlreadyShows, returnFocusSelector } from './panel';

const OPEN = { selectedId: 'neuron', nodeId: 'neuron' };

describe('whether the panel already shows an idea', () => {
  it('says no while nothing is selected, which is the one state the offer is for', () => {
    expect(panelAlreadyShows({ selectedId: null, nodeId: 'neuron', compact: false, surface: 'guide' })).toBe(false);
    expect(panelAlreadyShows({ selectedId: null, nodeId: 'neuron', compact: true, surface: 'map' })).toBe(false);
  });

  it('says no for a different idea, however the workspace is laid out', () => {
    for (const compact of [true, false]) {
      for (const surface of ['map', 'guide'] as const) {
        expect(panelAlreadyShows({ selectedId: 'tokens', nodeId: 'neuron', compact, surface })).toBe(false);
      }
    }
  });

  /** Side by side, the panel is on screen whichever surface was last asked for. */
  it('says yes for the open idea on a wide window, whatever the surface says', () => {
    expect(panelAlreadyShows({ ...OPEN, compact: false, surface: 'guide' })).toBe(true);
    expect(panelAlreadyShows({ ...OPEN, compact: false, surface: 'map' })).toBe(true);
  });

  /**
   * The narrow layout is the reason this is not simply an id comparison. Pressing
   * it while the map is showing swaps to the panel, which is a real change and
   * the way back to the idea's text from inside an experiment.
   */
  it('still offers the press on a narrow window while the map is the visible surface', () => {
    expect(panelAlreadyShows({ ...OPEN, compact: true, surface: 'map' })).toBe(false);
    expect(panelAlreadyShows({ ...OPEN, compact: true, surface: 'guide' })).toBe(true);
  });
});

describe('returnFocusSelector', () => {
  it('names the element for the idea that was open', () => {
    expect(returnFocusSelector('neuron')).toBe('[data-node="neuron"]');
  });

  it('falls back to the map section when no idea was open', () => {
    expect(returnFocusSelector(null)).toBe('#concept-map');
  });

  /* Every id in the graph has to survive this, or closing lands nowhere. */
  it('accepts every id the graph actually uses', () => {
    for (const node of GRAPH.nodes) {
      expect(returnFocusSelector(node.id)).toBe(`[data-node="${node.id}"]`);
    }
  });

  it('refuses to build a selector out of anything that is not an id', () => {
    for (const hostile of ['"] , [autofocus] , [', 'a b', 'node]', '']) {
      expect(returnFocusSelector(hostile)).toBe('#concept-map');
    }
  });
});
