import type { ConceptGraph, LearnerModel } from '@/lib/graph/types';

import { type Camera, type Point, type Size, fitScale } from './layout';

/**
 * The overture: the map assembling itself, as a function of one number.
 *
 * The product's argument has never been made anywhere. The interface states it
 * — twenty-three ideas, each resting on the ones before it — and then asks
 * someone to believe it before they have seen it. But the graph is not a claim
 * that needs asserting; it is a shape, and a shape can be shown. Built in front
 * of you in prerequisite order, the sentence makes itself: this rests on that,
 * which rests on that, and here is where yours stops.
 *
 * Everything here is a pure function of `t`, the scroll progress in [0, 1].
 * That is the whole design:
 *
 * - It cannot drift out of sync with itself, because there is no second clock.
 *   Scrubbing backwards is the same function, so the sequence runs in reverse
 *   as faithfully as forwards.
 * - Nobody is held hostage. There is no autoplay to wait through and no
 *   hijacked scroll; the reader sets the pace, and stopping halfway leaves a
 *   coherent frame rather than a half-finished animation.
 * - It is testable without a browser, which is the only reason a five-act
 *   cinematic can be trusted not to lose a node somewhere in the middle.
 *
 * Nothing in here decides anything about the graph. The layout, the states and
 * the lead node all arrive from the same code the real map uses.
 */

export type Act = 'one' | 'chain' | 'terrain' | 'block' | 'turn';

/** The acts, as a partition of [0, 1]. `overture.test.ts` asserts it is one. */
export const ACTS: { id: Act; start: number; end: number }[] = [
  /* One idea, alone and very large. */
  { id: 'one', start: 0, end: 0.14 },
  /* Everything that rests on it, arriving in prerequisite order. */
  { id: 'chain', start: 0.14, end: 0.52 },
  /* The whole terrain, held still. */
  { id: 'terrain', start: 0.52, end: 0.68 },
  /* The dive: one node, and what rests on it. */
  { id: 'block', start: 0.68, end: 0.88 },
  /* The turn, and the way in. */
  { id: 'turn', start: 0.88, end: 1 },
];

const CHAIN_FROM = 0.17;
const CHAIN_TO = 0.44;
/** How long an edge takes to draw itself, in units of `t`. */
export const EDGE_DRAW = 0.05;
/** How long a node takes to arrive once its edge has reached it. */
export const NODE_FADE = 0.045;

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** `t` mapped onto [0, 1] across a window, flat outside it. */
export function progressIn(t: number, [from, to]: readonly [number, number]): number {
  return to <= from ? (t >= to ? 1 : 0) : clamp01((t - from) / (to - from));
}

/** Smoothstep. Used for the camera so every hold starts and ends at rest. */
export const ease = (u: number): number => u * u * (3 - 2 * u);

export function actAt(t: number): { act: Act; local: number } {
  const clamped = clamp01(t);
  const found = ACTS.find((act) => clamped < act.end) ?? ACTS[ACTS.length - 1];
  return { act: found.id, local: progressIn(clamped, [found.start, found.end]) };
}

/**
 * When a layer's turn comes.
 *
 * Layer 0 is the opening shot, so it arrives almost immediately and then holds
 * alone for the whole first act. The rest are spread evenly through the second,
 * which is what makes the build read as prerequisite order rather than as a
 * diagram fading in.
 */
export function layerBase(layer: number, maxLayer: number): number {
  /*
   * Negative, so the root is already fully drawn in the frame you land on.
   * A hero that has to be scrolled before it composes is a blank screen with a
   * word on it, and this one gets about a second and a half of somebody's
   * attention to be worth the rest of the page.
   */
  if (layer <= 0) return -0.055;
  const span = CHAIN_TO - CHAIN_FROM;
  return CHAIN_FROM + ((layer - 1) / Math.max(1, maxLayer - 1)) * span;
}

/** An edge draws before the node it points at exists. The line arrives first,
 *  and the box lands on the end of it — which is the order the graph is in. */
export function edgeWindow(toLayer: number, maxLayer: number): readonly [number, number] {
  const base = layerBase(toLayer, maxLayer);
  return [base, base + EDGE_DRAW] as const;
}

export function nodeWindow(layer: number, maxLayer: number): readonly [number, number] {
  const base = layerBase(layer, maxLayer);
  const start = layer <= 0 ? base : base + EDGE_DRAW * 0.6;
  return [start, start + NODE_FADE] as const;
}

/** How far into the dive we are. Completes before the act ends, then holds. */
export function blockProgress(t: number): number {
  return progressIn(t, [0.68, 0.79]);
}

export type OvertureFrame = {
  content: Size;
  pane: Size;
  /** Where the opening shot sits: the root node's centre. */
  root: Point;
  /** Where the dive lands: the lead node's centre. */
  lead: Point;
  /**
   * The lead node and everything resting on it, as a box in content units.
   *
   * The closing shot has to show what the closing line claims. "Ten later ideas
   * rest on it" over a close-up of one box is a caption arguing with its own
   * picture, and the picture wins.
   */
  cone: { centre: Point; size: Size };
};

/**
 * The camera, as a function of `t`.
 *
 * Keyframes interpolated with smoothstep, centre linearly and scale
 * geometrically — half way between 0.5x and 2x is 1x, and the arithmetic
 * version makes a long zoom dawdle at the wide end and then lunge.
 *
 * Deliberately NOT clamped to the content. Every other camera in this product
 * is, because a map you can strand yourself off the edge of is broken. Here the
 * frame is composed rather than driven: the opening shot is meant to sit past
 * the top of the drawing, in empty space, because one idea alone is the thing
 * being said.
 */
export function cameraAt(t: number, frame: OvertureFrame): Camera {
  const { content, pane, root, lead, cone } = frame;
  if (pane.width <= 0 || pane.height <= 0) return { x: 0, y: 0, scale: 1 };

  const fit = fitScale(content, pane, 'all');
  const middle = { x: content.width / 2, y: content.height / 2 };
  /* Not `fitScale`, which caps at 1 so the real map is never blown up. The cone
     is a smaller subject and is allowed to fill the frame. */
  const coneFit = Math.min(pane.width / cone.size.width, pane.height / cone.size.height);

  /*
   * `lift` is how far up the frame the subject sits, as a fraction of the view.
   * It is part of the camera rather than a layout tweak in the component,
   * because the words and the picture are sharing one screen: the acts that
   * speak in forty-point type push the drawing into the top third and take the
   * bottom half for the sentence. Interpolated like everything else, so the
   * composition drifts rather than snapping when the talking starts.
   */
  const keys = [
    { t: 0, centre: root, scale: fit * 3.4, lift: 0.17 },
    { t: 0.14, centre: root, scale: fit * 2.3, lift: 0.17 },
    /*
     * The wide shot sits deliberately inside `fit` rather than at it. Fitted
     * exactly, the map touches the top and bottom of the stage and there is
     * nowhere for the words to go — and the shot is saying "look how much of
     * this there is", which needs air around it to land.
     */
    { t: 0.52, centre: middle, scale: fit * 0.72, lift: 0.1 },
    { t: 0.68, centre: middle, scale: fit * 0.72, lift: 0.1 },
    /* The close-up: one box, most of the screen, and a hold on it. */
    { t: 0.78, centre: lead, scale: fit * 2.1, lift: 0 },
    { t: 0.8, centre: lead, scale: fit * 2.1, lift: 0 },
    /*
     * Then back out onto everything resting on it, which is what the last
     * sentence is about. The map never returns to the neutral wide shot: the
     * page ends on its subject rather than on its diagram.
     *
     * The pull-back takes a tenth of the scroll rather than the seventieth it
     * first took. That was not a taste call — at the shorter span the frame was
     * moving fast enough to fail the continuity test below, which is what a
     * lurch looks like before you have seen it.
     */
    { t: 0.9, centre: cone.centre, scale: coneFit * 0.62, lift: 0.15 },
    { t: 1, centre: cone.centre, scale: coneFit * 0.58, lift: 0.16 },
  ];

  const clamped = clamp01(t);
  let index = keys.length - 2;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (clamped < keys[i + 1].t) {
      index = i;
      break;
    }
  }

  const from = keys[index];
  const to = keys[index + 1];
  const u = ease(progressIn(clamped, [from.t, to.t]));

  const scale = from.scale * (to.scale / from.scale) ** u;
  const centre = {
    x: from.centre.x + (to.centre.x - from.centre.x) * u,
    y: from.centre.y + (to.centre.y - from.centre.y) * u,
  };
  const lift = from.lift + (to.lift - from.lift) * u;
  const view = { width: pane.width / scale, height: pane.height / scale };

  return {
    scale,
    x: centre.x - view.width / 2,
    y: centre.y - view.height / 2 + lift * view.height,
  };
}

/**
 * The words, on the same clock as the picture.
 *
 * Here rather than in the component because the copy IS the argument, and the
 * argument is the thing under review — it should be readable in one place,
 * against the timings it is spoken over, without reading JSX.
 *
 * `{lead}` and `{rests}` are filled from the graph at render time. Writing the
 * number by hand is how a page ends up claiming something the graph stopped
 * saying three edits ago.
 */
export type Caption = {
  at: readonly [number, number];
  kicker?: string;
  line: string;
  sub?: string;
  size: 'hero' | 'lead';
  /**
   * Set on every caption said while a specific node is singled out.
   *
   * The sequence used to say "One of them is where you stop", spotlight a node
   * and conclude "which is why so much of the rest has felt slippery" — to
   * somebody who had not said a word. That is a verdict delivered before the
   * diagnosis, on a product whose largest recorded risk is being diagnosed
   * feeling like being graded. The reasoning that the marks were only an
   * illustration existed in a comment in this file and never reached the
   * screen.
   *
   * So the flag drives a visible ILLUSTRATIVE MAP badge, and
   * `overture.test.ts` asserts both that every caption over a spotlit node
   * carries it and that no caption anywhere claims to know the viewer's state.
   */
  illustrative?: boolean;
};

export const CAPTIONS: Caption[] = [
  {
    /* Starts before the scroll does, for the same reason the root does. */
    at: [-0.05, 0.13],
    kicker: 'How AI actually works',
    line: 'It starts with one idea.',
    sub: 'That a machine can be shown examples, and get better at something nobody wrote the rules for.',
    size: 'hero',
  },
  {
    at: [0.18, 0.35],
    line: 'Then everything that rests on it.',
    sub: 'Not a syllabus. An order — each idea needs the ones above it to mean anything.',
    size: 'lead',
  },
  {
    at: [0.38, 0.5],
    line: 'Twenty-three of them. Ten deep.',
    sub: 'From what a neuron is to why a model makes things up. No maths, no code.',
    size: 'lead',
  },
  {
    at: [0.54, 0.66],
    line: 'This is the whole subject.',
    sub: 'You have almost certainly met most of these. That is not the same as holding them.',
    size: 'lead',
  },
  {
    at: [0.69, 0.83],
    kicker: 'An example',
    line: 'Somebody stops here.',
    sub: 'Not at the hardest idea — at the earliest one they never quite got. Everything after it was built on the gap.',
    size: 'lead',
    illustrative: true,
  },
  {
    at: [0.87, 0.965],
    kicker: 'In this example — {lead}',
    line: '{rests} later ideas depend on it.',
    sub: 'That is the shape of a gap: not one missing fact, but everything standing on it.',
    size: 'hero',
    illustrative: true,
  },
];

/**
 * The handoff, which is a promise rather than a finding.
 *
 * It closes on the product's own sharpest sentence — the one the first-run
 * dialog has always opened with — because that is the honest version of what
 * this sequence has just shown: not "here is your gap", but "you cannot ask a
 * good question about something you do not understand yet, so this works out
 * the question first".
 */
export const HANDOFF = {
  line: 'You cannot ask a good question about something you do not understand yet.',
  sub: 'So this finds the question first. Two minutes. No score — “I don’t know” is the most useful answer there is.',
  action: 'Find my starting point',
};

/**
 * The short version, for a first visit.
 *
 * Same timeline, same graph, same functions — only the driver changes: `/intro`
 * scrubs `t` from the scroll, this runs it on a clock over about twenty-two
 * seconds and stops before the dive. That matters because the two cannot then
 * drift: there is one description of how the map assembles, and both readings
 * of it are the same code.
 *
 * It stops at the terrain deliberately. The long sequence's fourth act singles
 * out a node, and singling one out is the part that has to be earned by
 * answers — so the thing shown to somebody in their first ten seconds makes the
 * structural argument and then offers, rather than illustrating a gap at them
 * before they have said anything.
 */
export const PRELUDE_END = 0.6;

export const PRELUDE: Caption[] = [
  {
    /* Starts before zero so the opening frame is already composed, exactly as
       the long version's does. */
    at: [-0.06, 0.2],
    line: 'AI makes more sense as a chain of ideas.',
    size: 'hero',
  },
  {
    at: [0.24, 0.44],
    line: 'Twenty-three of them, each resting on the ones before it.',
    size: 'lead',
  },
  {
    at: [0.46, 0.6],
    line: 'We will find the first link worth strengthening.',
    sub: 'A few questions, spoken or typed. Two minutes. Nothing is scored.',
    size: 'hero',
  },
];

/**
 * A cone standing for "no cone" — the whole drawing.
 *
 * `cameraAt` needs one for its closing keyframes even when nothing is being
 * singled out, and the prelude never reaches those keyframes. Passing the whole
 * content is the honest stand-in: it is what the camera would frame if the
 * subject were everything.
 */
export function emptyCone(content: Size): { centre: Point; size: Size } {
  return {
    centre: { x: content.width / 2, y: content.height / 2 },
    size: { width: content.width, height: content.height },
  };
}

/** The badge shown for the whole time a single node is singled out. */
export const ILLUSTRATIVE_LABEL = 'Illustrative map';

/** When the badge is on screen: from the first illustrative caption onwards. */
export function illustrativeFrom(): number {
  return Math.min(...CAPTIONS.filter((caption) => caption.illustrative).map((caption) => caption.at[0]));
}

/** Fades a caption in over the first 18% of its window and out over the last. */
export function captionOpacity(t: number, caption: Caption): number {
  const [from, to] = caption.at;
  const span = to - from;
  const inward = progressIn(t, [from, from + span * 0.18]);
  const outward = progressIn(t, [to - span * 0.18, to]);
  return inward * (1 - outward);
}

/**
 * The marks the dive is told against.
 *
 * The sequence has to land on a node that is genuinely blocked with a
 * genuinely large amount resting on it, and an empty map's lead is the root —
 * which makes the fourth act say "you do not know anything yet", the exact tone
 * this product cannot survive. So it is told about someone who has the
 * foundations and one gap underneath them: the classic one, where "a neuron is
 * like a brain cell" has been standing in for a mechanism for years.
 *
 * The lead and the count are still computed by `leadNode` and `downstreamOf`
 * from these marks rather than written down. A page that hard-codes the number
 * ends up claiming something the graph stopped saying three edits ago.
 */
export function overtureModel(graph: ConceptGraph): LearnerModel {
  const settled = new Set([
    ...graph.nodes.filter((node) => node.layer <= 1).map((node) => node.id),
    'tokens',
    'generalization-overfitting',
    'gradient-descent',
  ]);
  return {
    graphVersion: graph.version,
    states: Object.fromEntries(
      graph.nodes.filter((node) => settled.has(node.id)).map((node) => [node.id, 'known' as const]),
    ),
  };
}
