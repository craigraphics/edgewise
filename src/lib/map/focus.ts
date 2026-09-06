/**
 * Focus, done by addition rather than by subtraction.
 *
 * The map used to answer "what rests on this" by dropping everything outside
 * the focused cone to 22% opacity. Measured against the real tokens, that put a
 * node's label at **1.62:1** in light and 1.84:1 in dark — under the 3:1 floor
 * for a non-text graphic, let alone the 4.5:1 for text. Twenty-three ideas
 * carefully placed at 17.66:1 were then multiplied by 0.22 at runtime.
 *
 * The interesting part is that no opacity fixes it. At 0.65 — barely dimmed at
 * all — the muted foreground that every `unexplored` node uses, which is most of
 * an unmarked map, is still at 2.79:1. Recede and legible are not both
 * available on the same dial.
 *
 * So nothing recedes. The focused path is raised instead: a ring on the node,
 * heavier and brighter edges along the two cones, and a pool of the band colour
 * behind them. Only edges soften, because an edge carries no text and losing one
 * costs a line rather than a word.
 *
 * There is a second reason beyond legibility, and it is the one that would
 * matter even if the numbers had passed. This is a map of what somebody does not
 * know yet. Making the unvisited parts of it disappear says they are excluded
 * rather than ahead, and it removes the comparison the view exists to support.
 *
 * These live here rather than in the components so `focus.test.ts` can hold the
 * rule: **focus must never lower a label's contrast**. Reintroducing a dim
 * anywhere fails that test rather than shipping.
 */

/** Cards and labels never change opacity, in any state. Asserted, not assumed. */
export const NODE_OPACITY = 1;

/** Edges may recede: they carry no text, and the cone has to be readable. */
export const EDGE_IN_CONE = 1;
export const EDGE_OUT_OF_CONE = 0.3;

/** How much the focused node lifts. Small enough not to move its neighbours. */
export const FOCAL_SCALE = 1.03;

/** Stroke widths, so the lit path reads as raised rather than merely coloured. */
export const EDGE_WIDTH_LIT = 2.4;
export const EDGE_WIDTH_SATISFIED = 1.6;
export const EDGE_WIDTH_RESTING = 1.1;

/**
 * How an edge draws while something is focused.
 *
 * `satisfied` — the prerequisite is known — still decides the resting weight,
 * because the solid path someone is standing on is legible at a glance and that
 * should not depend on what they happen to be hovering.
 */
export function edgeStyle(options: { focused: boolean; inCone: boolean; satisfied: boolean }): {
  opacity: number;
  width: number;
} {
  const { focused, inCone, satisfied } = options;
  const width = satisfied ? EDGE_WIDTH_SATISFIED : EDGE_WIDTH_RESTING;
  if (!focused) return { opacity: 1, width };
  if (inCone) return { opacity: EDGE_IN_CONE, width: EDGE_WIDTH_LIT };
  return { opacity: EDGE_OUT_OF_CONE, width };
}
