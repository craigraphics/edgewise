import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';

import {
  LABEL_SIZE,
  LABEL_WIDTH,
  LEGIBLE_SCALE,
  MAX_ZOOM,
  MIN_ZOOM,
  cameraShowing,
  clampCamera,
  clampZoom,
  fitCamera,
  fitScale,
  layoutGraph,
  panBounds,
  viewBoxFor,
  zoomAt,
} from './layout';
import { textWidth, truncate, wrapLabel } from './text';

const CONTENT = { width: 904, height: 1038 };
const PANE = { width: 904, height: 790 };

describe('layoutGraph', () => {
  it('places every node and draws every prerequisite as an edge', () => {
    const layout = layoutGraph(GRAPH);
    expect(layout.points.size).toBe(GRAPH.nodes.length);
    expect(layout.edges.length).toBe(GRAPH.nodes.reduce((n, node) => n + node.prerequisites.length, 0));
  });

  it('derives its size from the authored rows and layers', () => {
    const layout = layoutGraph(GRAPH);
    expect(layout.width).toBe(904);
    expect(layout.height).toBe(1038);
  });

  /*
   * The property `validate-graph` guarantees, restated where the drawing
   * depends on it: an edge that pointed upwards would read as a mistake in the
   * subject rather than a mistake in the file.
   */
  it('never draws an edge pointing back up the map', () => {
    const layout = layoutGraph(GRAPH);
    for (const edge of layout.edges) {
      expect(layout.points.get(edge.from)!.y).toBeLessThan(layout.points.get(edge.to)!.y);
    }
  });
});

describe('clampZoom', () => {
  it('holds the ends', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1)).toBe(1);
  });
});

describe('fitScale', () => {
  it('fits the width at 1:1 when the map is exactly its pane', () => {
    expect(fitScale(CONTENT, PANE, 'legible')).toBe(1);
  });

  /*
   * The rule the desktop label size depends on. A 1280 laptop with the panel
   * beside the map cannot show all 904 units at once; it shrinks as far as
   * twelve-pixel labels and then pans the last few units rather than shrinking
   * into illegibility, which is what the previous build's 760px floor was for.
   */
  it('legible stops shrinking at the point the labels reach 12px', () => {
    const scale = fitScale(CONTENT, { width: 700, height: 790 }, 'legible');
    expect(scale).toBe(LEGIBLE_SCALE);
    expect(scale * LABEL_SIZE).toBeCloseTo(12, 6);
  });

  /*
   * Under a sheet the opposite rule applies: the full width has to be visible,
   * because clipping the right-hand column mid-node reads as a broken drawing
   * rather than as something you can pan. So `width` has no legibility floor.
   */
  it('width always shows the whole width, however narrow the pane', () => {
    for (const paneWidth of [390, 640, 768, 820, 1024]) {
      const scale = fitScale(CONTENT, { width: paneWidth, height: 900 }, 'width');
      expect(paneWidth / scale).toBeGreaterThanOrEqual(CONTENT.width - 0.001);
    }
  });

  it.each(['legible', 'width', 'all'] as const)(
    'never blows the map up past its authored size in %s mode',
    (mode) => {
      expect(fitScale(CONTENT, { width: 2400, height: 1400 }, mode)).toBe(1);
    },
  );

  it('fitting all is never larger than fitting the width', () => {
    expect(fitScale(CONTENT, PANE, 'all')).toBeLessThanOrEqual(fitScale(CONTENT, PANE, 'width'));
  });

  it('fits a phone-sized pane inside the zoom range', () => {
    const scale = fitScale(CONTENT, { width: 390, height: 600 }, 'all');
    expect(scale).toBeGreaterThanOrEqual(MIN_ZOOM);
    expect(scale).toBeLessThanOrEqual(MAX_ZOOM);
  });

  it('survives a pane that has not been measured yet', () => {
    expect(fitScale(CONTENT, { width: 0, height: 0 }, 'legible')).toBe(1);
  });
});

describe('panBounds', () => {
  it('pins an axis the view already covers, so a small map cannot be flung into a corner', () => {
    const bounds = panBounds(CONTENT, PANE, 1);
    expect(bounds.minX).toBe(bounds.maxX);
  });

  it('allows exactly the overflow on an axis the view does not cover', () => {
    const bounds = panBounds(CONTENT, PANE, 1);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(CONTENT.height - PANE.height);
  });
});

describe('clampCamera', () => {
  it('pulls a camera dragged past the end back to the end', () => {
    const camera = clampCamera({ x: 0, y: 9999, scale: 1 }, CONTENT, PANE);
    expect(camera.y).toBe(CONTENT.height - PANE.height);
  });

  it('pulls a camera dragged before the start back to the start', () => {
    expect(clampCamera({ x: 0, y: -500, scale: 1 }, CONTENT, PANE).y).toBe(0);
  });

  it('clamps the scale as well as the position', () => {
    expect(clampCamera({ x: 0, y: 0, scale: 40 }, CONTENT, PANE).scale).toBe(MAX_ZOOM);
  });

  it('leaves a camera already in bounds alone', () => {
    const camera = { x: 0, y: 100, scale: 1 };
    expect(clampCamera(camera, CONTENT, PANE)).toEqual(camera);
  });
});

describe('zoomAt', () => {
  /*
   * The property that makes zooming feel like a camera rather than a slider:
   * whatever was under the pointer stays under the pointer.
   */
  it('keeps the content under the pointer fixed', () => {
    const before = { x: 100, y: 200, scale: 1 };
    const pointer = { x: 300, y: 400 };
    const contentUnder = {
      x: before.x + pointer.x / before.scale,
      y: before.y + pointer.y / before.scale,
    };

    const after = zoomAt(before, pointer, 1.5, { width: 4000, height: 4000 }, PANE);

    expect(after.x + pointer.x / after.scale).toBeCloseTo(contentUnder.x, 6);
    expect(after.y + pointer.y / after.scale).toBeCloseTo(contentUnder.y, 6);
  });

  it('cannot be zoomed past the limits however hard it is pushed', () => {
    let camera = { x: 0, y: 0, scale: 1 };
    for (let i = 0; i < 50; i += 1) camera = zoomAt(camera, { x: 10, y: 10 }, 1.4, CONTENT, PANE);
    expect(camera.scale).toBe(MAX_ZOOM);

    for (let i = 0; i < 50; i += 1) camera = zoomAt(camera, { x: 10, y: 10 }, 0.7, CONTENT, PANE);
    expect(camera.scale).toBe(MIN_ZOOM);
  });

  it('leaves the camera in bounds after zooming out at an edge', () => {
    const camera = zoomAt({ x: 0, y: 260, scale: 1 }, { x: 0, y: 0 }, 0.5, CONTENT, PANE);
    const bounds = panBounds(CONTENT, PANE, camera.scale);
    expect(camera.y).toBeGreaterThanOrEqual(bounds.minY);
    expect(camera.y).toBeLessThanOrEqual(bounds.maxY);
  });
});

describe('fitCamera and viewBoxFor', () => {
  it('shows the whole map when fitting all of it', () => {
    const pane = { width: 390, height: 600 };
    const camera = fitCamera(CONTENT, pane, 'all');
    const [, , width, height] = viewBoxFor(camera, pane).split(' ').map(Number);
    expect(width).toBeGreaterThanOrEqual(CONTENT.width - 0.001);
    expect(height).toBeGreaterThanOrEqual(CONTENT.height - 0.001);
  });

  it('starts at the top when fitting the width', () => {
    expect(fitCamera(CONTENT, PANE, 'legible').y).toBe(0);
  });
});

describe('cameraShowing', () => {
  it('scrolls down to a node below the view', () => {
    const camera = cameraShowing({ x: 0, y: 0, scale: 1 }, { x: 400, y: 1000 }, CONTENT, PANE);
    expect(camera.y).toBeGreaterThan(0);
  });

  it('does not move for a node already in view', () => {
    const camera = { x: 0, y: 0, scale: 1 };
    expect(cameraShowing(camera, { x: 400, y: 300 }, CONTENT, PANE)).toEqual(camera);
  });

  it('never changes the scale', () => {
    expect(cameraShowing({ x: 0, y: 0, scale: 1.7 }, { x: 0, y: 1040 }, CONTENT, PANE).scale).toBe(1.7);
  });
});

describe('wrapLabel', () => {
  it('leaves a label that already fits on one line', () => {
    expect(wrapLabel('Attention', LABEL_WIDTH, LABEL_SIZE)).toEqual(['Attention']);
  });

  it('wraps the label that forced this to exist', () => {
    expect(wrapLabel('Blame, spread backwards', LABEL_WIDTH, LABEL_SIZE)).toEqual([
      'Blame, spread',
      'backwards',
    ]);
  });

  it('fills the first line rather than balancing the two', () => {
    expect(wrapLabel('Learning from examples', LABEL_WIDTH, LABEL_SIZE)).toEqual([
      'Learning from',
      'examples',
    ]);
  });

  it('never returns more lines than it was allowed', () => {
    for (const concept of GRAPH.nodes) {
      expect(wrapLabel(concept.label, LABEL_WIDTH, LABEL_SIZE).length).toBeLessThanOrEqual(2);
    }
  });

  /* The whole point: every line the map draws has to fit the card it is in. */
  it('fits every real label inside the card', () => {
    for (const concept of GRAPH.nodes) {
      for (const line of wrapLabel(concept.label, LABEL_WIDTH, LABEL_SIZE)) {
        expect(textWidth(line, LABEL_SIZE)).toBeLessThanOrEqual(LABEL_WIDTH);
      }
    }
  });

  it('loses no words on any real label', () => {
    for (const concept of GRAPH.nodes) {
      expect(wrapLabel(concept.label, LABEL_WIDTH, LABEL_SIZE).join(' ')).toBe(concept.label);
    }
  });

  it('truncates a single word too long to break', () => {
    const [line] = wrapLabel('Supercalifragilisticexpialidocious', 60, LABEL_SIZE, 1);
    expect(line.endsWith('…')).toBe(true);
    expect(textWidth(line, LABEL_SIZE)).toBeLessThanOrEqual(60);
  });

  it('puts everything left over on the final line rather than dropping it', () => {
    const lines = wrapLabel('one two three four five six', 40, LABEL_SIZE, 2);
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('handles an empty label without crashing', () => {
    expect(wrapLabel('', LABEL_WIDTH, LABEL_SIZE)).toEqual(['']);
  });
});

describe('textWidth', () => {
  it('scales linearly with the font size', () => {
    expect(textWidth('Attention', 26)).toBeCloseTo(textWidth('Attention', 13) * 2, 6);
  });

  it('is zero for an empty string', () => {
    expect(textWidth('', 13)).toBe(0);
  });

  /*
   * Calibrated against the real Geist face — these are what
   * `CanvasRenderingContext2D.measureText` returned at 500 13px Geist.
   *
   * The estimator must never come in UNDER the browser: that is the direction
   * that overflows a card. A few per cent over is kerning, and is the safe
   * side. If either bound starts failing, the table is stale rather than the
   * test being wrong.
   */
  it.each([
    ['Blame, spread backwards', 156],
    ['Learning from examples', 146.3],
    ['Memorising vs. learning', 143.7],
    ['Becoming an assistant', 138.3],
    ['Everything is numbers', 134.9],
  ])('estimates %s within kerning slack of the measured width', (label, measured) => {
    const estimate = textWidth(label, 13);
    expect(estimate).toBeGreaterThanOrEqual(measured);
    expect(estimate).toBeLessThanOrEqual(measured * 1.05);
  });
});

describe('truncate', () => {
  it('leaves text that fits', () => {
    expect(truncate('Agents', LABEL_WIDTH, LABEL_SIZE)).toBe('Agents');
  });

  it('always fits what it returns', () => {
    for (const concept of GRAPH.nodes) {
      expect(textWidth(truncate(concept.label, 50, LABEL_SIZE), LABEL_SIZE)).toBeLessThanOrEqual(50);
    }
  });
});
