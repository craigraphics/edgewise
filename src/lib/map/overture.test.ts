import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';

import { downstreamOf, leadNode, stateOf } from '@/lib/graph/frontier';

import {
  ACTS,
  CAPTIONS,
  type OvertureFrame,
  actAt,
  cameraAt,
  captionOpacity,
  edgeWindow,
  layerBase,
  nodeWindow,
  overtureModel,
  progressIn,
} from './overture';

const MAX_LAYER = Math.max(...GRAPH.nodes.map((node) => node.layer));

const FRAME: OvertureFrame = {
  content: { width: 904, height: 1038 },
  pane: { width: 1280, height: 800 },
  root: { x: 452, y: 51 },
  lead: { x: 300, y: 250 },
  cone: { centre: { x: 380, y: 640 }, size: { width: 690, height: 800 } },
};

describe('the acts', () => {
  it('partition the whole scroll with no gap and no overlap', () => {
    expect(ACTS[0].start).toBe(0);
    expect(ACTS[ACTS.length - 1].end).toBe(1);
    for (let i = 1; i < ACTS.length; i += 1) {
      expect(ACTS[i].start).toBe(ACTS[i - 1].end);
    }
  });

  it('names an act and a position inside it for every point in the scroll', () => {
    for (let t = 0; t <= 1; t += 0.001) {
      const { act, local } = actAt(t);
      const spec = ACTS.find((entry) => entry.id === act)!;
      expect(local).toBeGreaterThanOrEqual(0);
      expect(local).toBeLessThanOrEqual(1);
      expect(t).toBeGreaterThanOrEqual(spec.start - 1e-9);
      expect(t).toBeLessThanOrEqual(spec.end + 1e-9);
    }
  });
});

describe('the build', () => {
  /*
   * The one thing this sequence exists to say is that the ideas come in an
   * order. A layer arriving before a shallower one would be the animation
   * contradicting the graph.
   */
  it('reveals layers strictly in prerequisite order', () => {
    for (let layer = 1; layer <= MAX_LAYER; layer += 1) {
      expect(layerBase(layer, MAX_LAYER)).toBeGreaterThan(layerBase(layer - 1, MAX_LAYER));
    }
  });

  it('draws the edge into a node before the node lands on it', () => {
    for (let layer = 1; layer <= MAX_LAYER; layer += 1) {
      const [edgeFrom] = edgeWindow(layer, MAX_LAYER);
      const [nodeFrom] = nodeWindow(layer, MAX_LAYER);
      expect(edgeFrom).toBeLessThan(nodeFrom);
    }
  });

  /*
   * Everything must have arrived before the act that shows the whole terrain,
   * or the wide shot is of a map that is still assembling — which is a promise
   * broken in the only frame that has to be complete.
   */
  it('finishes every node and edge before the terrain is shown', () => {
    const terrain = ACTS.find((act) => act.id === 'terrain')!.start;
    for (const node of GRAPH.nodes) {
      expect(nodeWindow(node.layer, MAX_LAYER)[1]).toBeLessThanOrEqual(terrain);
      expect(edgeWindow(node.layer, MAX_LAYER)[1]).toBeLessThanOrEqual(terrain);
    }
  });

  it('holds the root alone for the whole opening act', () => {
    const openingEnds = ACTS[0].end;
    expect(nodeWindow(0, MAX_LAYER)[1]).toBeLessThan(openingEnds);
    for (const node of GRAPH.nodes) {
      if (node.layer === 0) continue;
      expect(nodeWindow(node.layer, MAX_LAYER)[0]).toBeGreaterThanOrEqual(openingEnds);
    }
  });
});

describe('the camera', () => {
  /*
   * Continuity is the whole illusion. A jump anywhere — most likely at a
   * keyframe join — turns one continuous place into a slideshow, and the claim
   * that the map is a single drawing you are moving around inside is the claim
   * this sequence is making with its camera rather than with words.
   */
  it('never jumps, anywhere in the scroll', () => {
    let previous = cameraAt(0, FRAME);
    for (let t = 0.001; t <= 1; t += 0.001) {
      const camera = cameraAt(t, FRAME);
      const view = FRAME.pane.width / camera.scale;
      const moved = Math.hypot(camera.x - previous.x, camera.y - previous.y);
      /* A thousandth of the scroll must never move the frame by more than a
         fiftieth of what is on screen. */
      expect(moved).toBeLessThan(view / 50);
      expect(Math.abs(Math.log(camera.scale / previous.scale))).toBeLessThan(0.02);
      previous = camera;
    }
  });

  it('opens close on the root and pulls back to the whole map', () => {
    const opening = cameraAt(0, FRAME);
    const wide = cameraAt(0.6, FRAME);
    expect(opening.scale).toBeGreaterThan(wide.scale * 3);

    /* Centred horizontally, and lifted into the top third so the opening
       sentence has the bottom half of the screen to itself. */
    expect(opening.x + FRAME.pane.width / opening.scale / 2).toBeCloseTo(FRAME.root.x, 6);
    const down = (FRAME.root.y - opening.y) / (FRAME.pane.height / opening.scale);
    expect(down).toBeGreaterThan(0.25);
    expect(down).toBeLessThan(0.4);
  });

  it('pulls back monotonically through the build, never re-zooming', () => {
    let previous = cameraAt(0, FRAME).scale;
    for (let t = 0; t <= 0.52; t += 0.002) {
      const scale = cameraAt(t, FRAME).scale;
      expect(scale).toBeLessThanOrEqual(previous + 1e-9);
      previous = scale;
    }
  });

  it('lands the dive on the lead node', () => {
    const camera = cameraAt(0.8, FRAME);
    expect(camera.x + FRAME.pane.width / camera.scale / 2).toBeCloseTo(FRAME.lead.x, 6);
    expect(camera.y + FRAME.pane.height / camera.scale / 2).toBeCloseTo(FRAME.lead.y, 6);
  });

  /* The closing shot has to contain what the closing line counts. */
  it('ends framing everything that rests on the lead node', () => {
    const camera = cameraAt(1, FRAME);
    const view = { width: FRAME.pane.width / camera.scale, height: FRAME.pane.height / camera.scale };
    expect(view.width).toBeGreaterThanOrEqual(FRAME.cone.size.width);
    expect(view.height).toBeGreaterThanOrEqual(FRAME.cone.size.height);
  });

  it('survives a pane that has not been measured yet', () => {
    expect(cameraAt(0.4, { ...FRAME, pane: { width: 0, height: 0 } })).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
  });
});

describe('the frame you land on', () => {
  /*
   * Everything else here is about what happens as you scroll. This is about
   * what is on screen before you do — and a hero that composes only once it is
   * scrolled is a black rectangle with the word SCROLL on it.
   */
  it('has the first idea already drawn', () => {
    expect(progressIn(0, nodeWindow(0, MAX_LAYER))).toBe(1);
  });

  it('has the opening sentence already said', () => {
    expect(captionOpacity(0, CAPTIONS[0])).toBe(1);
  });

  it('has nothing else on screen yet', () => {
    for (const node of GRAPH.nodes) {
      if (node.layer === 0) continue;
      expect(progressIn(0, nodeWindow(node.layer, MAX_LAYER))).toBe(0);
    }
    for (const caption of CAPTIONS.slice(1)) {
      expect(captionOpacity(0, caption)).toBe(0);
    }
  });
});

describe('the captions', () => {
  it('run in order and stay inside the scroll', () => {
    for (const [index, caption] of CAPTIONS.entries()) {
      /* The opening one starts before zero on purpose — see below. */
      expect(caption.at[0]).toBeGreaterThanOrEqual(-0.1);
      expect(caption.at[1]).toBeLessThanOrEqual(1);
      expect(caption.at[0]).toBeLessThan(caption.at[1]);
      if (index > 0) expect(caption.at[0]).toBeGreaterThan(CAPTIONS[index - 1].at[0]);
    }
  });

  /* Two lines of forty-point type on top of each other is not a crossfade, it
     is a mistake. Whatever overlap exists has to be one fading as one rises. */
  it('never shows two captions at full strength at once', () => {
    for (let t = 0; t <= 1; t += 0.002) {
      const full = CAPTIONS.filter((caption) => captionOpacity(t, caption) > 0.9);
      expect(full.length).toBeLessThanOrEqual(1);
    }
  });

  it('opens and closes each caption at nothing', () => {
    for (const caption of CAPTIONS) {
      expect(captionOpacity(caption.at[0], caption)).toBe(0);
      expect(captionOpacity(caption.at[1], caption)).toBe(0);
      expect(captionOpacity((caption.at[0] + caption.at[1]) / 2, caption)).toBeGreaterThan(0.9);
    }
  });

  it('leaves no stretch of the scroll silent for long', () => {
    let silent = 0;
    let longest = 0;
    for (let t = 0; t <= 1; t += 0.002) {
      const loud = CAPTIONS.some((caption) => captionOpacity(t, caption) > 0.05);
      silent = loud ? 0 : silent + 0.002;
      longest = Math.max(longest, silent);
    }
    expect(longest).toBeLessThan(0.08);
  });
});

describe('progressIn', () => {
  it('clamps outside its window', () => {
    expect(progressIn(-1, [0.2, 0.4])).toBe(0);
    expect(progressIn(0.3, [0.2, 0.4])).toBeCloseTo(0.5, 9);
    expect(progressIn(9, [0.2, 0.4])).toBe(1);
  });

  it('treats an empty window as a switch rather than dividing by zero', () => {
    expect(progressIn(0.19, [0.2, 0.2])).toBe(0);
    expect(progressIn(0.2, [0.2, 0.2])).toBe(1);
  });
});

describe('the marks the dive is told against', () => {
  const model = overtureModel(GRAPH);
  const lead = leadNode(GRAPH, model)!;

  /*
   * The fourth act says "one of them is where you stop" and then flies to it.
   * If that landed on the root, the sequence would be telling a first-time
   * visitor they know nothing — which is the one tone this product cannot
   * survive, and it would be doing it in forty-point type.
   */
  it('lands on a real gap under the foundations, not on the root', () => {
    expect(lead).toBeDefined();
    expect(lead.layer).toBeGreaterThan(0);
    expect(stateOf(model, lead.id)).not.toBe('known');
  });

  it('lands somewhere enough rests on for the closing line to be worth saying', () => {
    expect(downstreamOf(GRAPH, lead.id).length).toBeGreaterThanOrEqual(8);
  });

  it('leaves the foundations above it settled, so the gap reads as a gap', () => {
    for (const prerequisite of lead.prerequisites) {
      expect(stateOf(model, prerequisite)).toBe('known');
    }
  });
});
