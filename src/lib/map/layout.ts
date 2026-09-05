import type { ConceptGraph, ConceptNode } from '@/lib/graph/types';

/**
 * The map's geometry, and the maths for panning and zooming it.
 *
 * Positions still come from the graph's authored `layer`/`row`. Nothing here
 * computes a layout — `validate-graph` asserts the authored layer equals the
 * real prerequisite depth, and a drawing that reshuffles between renders cannot
 * produce the recognition moment the product exists for. Zoom moves the camera;
 * it never moves a node relative to another node.
 *
 * Everything in this file is pure so it can be tested without a browser, which
 * matters most for the pan clamping — an off-by-one there strands the map
 * somewhere you cannot scroll back from, and that is not visible in a
 * screenshot.
 */

export const NODE_WIDTH = 156;
export const NODE_HEIGHT = 58;
export const NODE_RADIUS = 10;
/** The band-coloured bar down the leading edge. */
export const ACCENT_WIDTH = 3;
/** The state glyph's centre, and the label's left edge, inside the card. */
export const GLYPH_X = 20;
export const GLYPH_RADIUS = 4.5;
export const LABEL_X = 36;
export const LABEL_SIZE = 13;
export const LABEL_LINE_HEIGHT = 15;
/** What is left for the label once the glyph and the right-hand padding are taken. */
export const LABEL_WIDTH = NODE_WIDTH - LABEL_X - 12;

const ROW_GAP = 176;
const LAYER_GAP = 104;
const PADDING = 22;

/**
 * The scale below which the map stops shrinking to fit and starts panning.
 *
 * Expressed as the point where the label hits 12px rather than as a pixel width
 * of the map, because legibility is the actual constraint. The previous build
 * had this as a hard 760px floor with the same intent; stating it in terms of
 * the thing being protected means it stays correct if the label size or the
 * node geometry ever changes.
 */
export const LEGIBLE_SCALE = 12 / 13;

/**
 * Zoom is a camera control, not a design control.
 *
 * The floor is set by a requirement, not by taste: the whole map has to be able
 * to fit a phone. It is 928 content units wide against a 390px viewport, so
 * anything above 0.42 makes "fit the whole thing" impossible and strands
 * someone on a map whose corners they cannot reach. 0.3 leaves headroom below
 * that.
 *
 * At the floor the labels are genuinely too small to read cold. That is what an
 * overview is — the shape of the terrain and where you are in it — and tapping
 * any node still opens its full name and text in the panel.
 */
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2.5;

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** The camera: the content coordinate at the pane's top-left, and the scale. */
export type Camera = { x: number; y: number; scale: number };

export type FitMode = 'legible' | 'width' | 'all';

export type MapLayout = {
  points: Map<string, Point>;
  edges: { id: string; from: string; to: string }[];
  width: number;
  height: number;
};

/** Top-left of a node's card, in content coordinates. */
export function originOf(node: ConceptNode, minRow: number): Point {
  return {
    x: PADDING + (node.row - minRow) * ROW_GAP,
    y: PADDING + node.layer * LAYER_GAP,
  };
}

export function centreOf(node: ConceptNode, minRow: number): Point {
  const origin = originOf(node, minRow);
  return { x: origin.x + NODE_WIDTH / 2, y: origin.y + NODE_HEIGHT / 2 };
}

/**
 * A vertical cubic curve between two nodes.
 *
 * Curved rather than straight because with 33 edges over 10 layers, straight
 * lines through intermediate rows are ambiguous about which node they touch.
 *
 * The control points now sit at a fixed fraction of the gap rather than at the
 * midpoint. At the midpoint a long diagonal leaves a node almost horizontally
 * and swept straight across the labels of whatever sat between; pulling the
 * handles down to a third and two thirds makes every edge leave the bottom of
 * one card and arrive at the top of the next travelling vertically, so it
 * crosses the row between them rather than running along it.
 */
export function edgePath(from: Point, to: Point): string {
  const start = { x: from.x, y: from.y + NODE_HEIGHT / 2 };
  const end = { x: to.x, y: to.y - NODE_HEIGHT / 2 };
  const drop = end.y - start.y;
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + drop * 0.42}, ${end.x} ${end.y - drop * 0.42}, ${end.x} ${end.y}`;
}

/**
 * The band-coloured bar down a card's leading edge.
 *
 * It is narrower than the card's corner radius, so its left edge is not a
 * straight line — it has to follow the card's own top-left and bottom-left
 * arcs, or the band colour leaves the box it belongs to.
 *
 * The version this replaced got the arcs wrong in a way worth recording: an
 * SVG arc between two points admits two centres, and the sweep flag picks
 * which. It asked for the sweep that puts the centre on the *outside* of the
 * corner, so instead of hugging the card the arc bulged away from it and drew a
 * wedge of band colour sticking out past the card's own outline at both
 * corners. It read as a rendering fault in the map rather than as a design.
 *
 * So the arc is stated by its endpoints instead of trusted to a flag: the bar's
 * top-right corner is exactly where the card's corner circle crosses
 * `ACCENT_WIDTH`, which is what `inset` is.
 */
export function accentPath(): string {
  const r = NODE_RADIUS;
  /* Where the corner circle, centred (r, r), crosses x = ACCENT_WIDTH. */
  const inset = r - Math.round(Math.sqrt(r * r - (r - ACCENT_WIDTH) ** 2) * 1000) / 1000;
  const bottom = NODE_HEIGHT - inset;
  return [
    `M ${ACCENT_WIDTH} ${inset}`,
    `A ${r} ${r} 0 0 0 0 ${r}`,
    `L 0 ${NODE_HEIGHT - r}`,
    `A ${r} ${r} 0 0 0 ${ACCENT_WIDTH} ${bottom}`,
    'Z',
  ].join(' ');
}

export function layoutGraph(graph: ConceptGraph): MapLayout {
  const ids = new Set(graph.nodes.map((node) => node.id));
  const minRow = Math.min(...graph.nodes.map((node) => node.row));
  const maxRow = Math.max(...graph.nodes.map((node) => node.row));
  const maxLayer = Math.max(...graph.nodes.map((node) => node.layer));

  const points = new Map(graph.nodes.map((node) => [node.id, centreOf(node, minRow)]));

  const edges = graph.nodes.flatMap((node) =>
    node.prerequisites
      .filter((id) => ids.has(id))
      .map((id) => ({ id: `${id}->${node.id}`, from: id, to: node.id })),
  );

  return {
    points,
    edges,
    width: PADDING * 2 + (maxRow - minRow) * ROW_GAP + NODE_WIDTH,
    height: PADDING * 2 + maxLayer * LAYER_GAP + NODE_HEIGHT,
  };
}

export const clampZoom = (scale: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));

/**
 * The scale at which the content fits the pane.
 *
 * Three modes, because the map is doing three different jobs.
 *
 * `legible` is the desktop default, with the panel beside the map. The map is
 * authored a little taller than a laptop screen, so fitting both axes would
 * shrink the labels to about nine pixels to buy a view of the whole thing at
 * once. This keeps the labels at or above twelve and pans the remainder — the
 * trade the previous build measured and got right, when it expressed the same
 * rule as a 760px floor.
 *
 * `width` is for the layouts where the panel floats over the map. It shows the
 * full width always and pans vertically. Flooring it at legibility instead
 * clipped the right-hand column mid-node at tablet sizes, which reads as a
 * broken drawing rather than as something you can scroll — a failure the
 * previous build already measured and fixed once.
 *
 * `all` is what the Fit control does, and the phone default: the whole shape at
 * once. At that size the labels are genuinely too small to read cold, which is
 * what an overview is — tapping any node still opens its full text in the panel.
 */
export function fitScale(content: Size, pane: Size, mode: FitMode): number {
  if (pane.width <= 0 || pane.height <= 0) return 1;
  const byWidth = Math.min(1, pane.width / content.width);

  // Capped at 1 in every mode: a pane larger than the map should give it air,
  // not enlarge it.
  if (mode === 'all') return clampZoom(Math.min(byWidth, pane.height / content.height));
  if (mode === 'width') return clampZoom(byWidth);
  return clampZoom(Math.max(LEGIBLE_SCALE, byWidth));
}

/**
 * Where the camera is allowed to sit.
 *
 * When the view is larger than the content on an axis, the map cannot be
 * dragged on that axis — otherwise a map smaller than its pane could be flung
 * into a corner and look lost. But the two axes settle differently, and that is
 * deliberate:
 *
 * - **Horizontally it centres.** There is no reading direction across the map;
 *   an off-centre drawing just looks misplaced.
 * - **Vertically it sits at the top.** The map reads downwards — the root is the
 *   thing everything else rests on — so the root belongs at the top of the pane.
 *   Centring put it 360px down on a tablet, under a sheet that hid the bottom
 *   half, so the first thing on screen was empty space.
 */
export function panBounds(content: Size, pane: Size, scale: number) {
  const view = { width: pane.width / scale, height: pane.height / scale };

  const slack = (contentLength: number, viewLength: number) => contentLength - viewLength;

  const x = slack(content.width, view.width);
  const y = slack(content.height, view.height);

  return {
    minX: x < 0 ? x / 2 : 0,
    maxX: x < 0 ? x / 2 : x,
    minY: y < 0 ? y : 0,
    maxY: 0 < y ? y : 0,
  };
}

export function clampCamera(camera: Camera, content: Size, pane: Size): Camera {
  const scale = clampZoom(camera.scale);
  const bounds = panBounds(content, pane, scale);
  return {
    scale,
    x: Math.min(bounds.maxX, Math.max(bounds.minX, camera.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, camera.y)),
  };
}

/**
 * Zoom about a point in the pane, keeping whatever is under that point still.
 *
 * Zooming about the centre instead is the difference between a map that follows
 * your cursor and one that squirms away from it.
 */
export function zoomAt(camera: Camera, pointer: Point, factor: number, content: Size, pane: Size): Camera {
  const scale = clampZoom(camera.scale * factor);
  const anchor = {
    x: camera.x + pointer.x / camera.scale,
    y: camera.y + pointer.y / camera.scale,
  };
  return clampCamera(
    { scale, x: anchor.x - pointer.x / scale, y: anchor.y - pointer.y / scale },
    content,
    pane,
  );
}

/** The camera that shows `content` fitted to `pane`, centred. */
export function fitCamera(content: Size, pane: Size, mode: FitMode): Camera {
  const scale = fitScale(content, pane, mode);
  return clampCamera({ scale, x: 0, y: 0 }, content, pane);
}

/** Move the camera so a node sits inside the view, without changing the scale. */
export function cameraShowing(camera: Camera, target: Point, content: Size, pane: Size): Camera {
  const view = { width: pane.width / camera.scale, height: pane.height / camera.scale };
  const margin = NODE_HEIGHT;

  const shift = (position: number, start: number, length: number) => {
    if (position - margin < start) return position - margin;
    if (position + margin > start + length) return position + margin - length;
    return start;
  };

  return clampCamera(
    {
      scale: camera.scale,
      x: shift(target.x, camera.x, view.width),
      y: shift(target.y, camera.y, view.height),
    },
    content,
    pane,
  );
}

/** The `viewBox` for a camera. */
export function viewBoxFor(camera: Camera, pane: Size): string {
  const width = pane.width / camera.scale;
  const height = pane.height / camera.scale;
  return `${camera.x} ${camera.y} ${width} ${height}`;
}
