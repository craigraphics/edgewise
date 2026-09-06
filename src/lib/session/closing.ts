import { downstreamOf, leadNode } from '@/lib/graph/frontier';
import type { ConceptGraph, LearnerModel } from '@/lib/graph/types';

/**
 * What the map now says, in one sentence — and how much of it has been earned.
 *
 * The half that is load-bearing is structural: *"eleven of the later ideas rest
 * on this one"*. That is the thing a chat assistant cannot tell anybody, it is
 * the whole reason the graph exists, and it is true the moment the frontier is
 * known.
 *
 * The half that follows it — *"which is why so much of the rest has probably
 * felt slippery"* — is not structural. It is an interpretation of somebody's
 * history, and it was being said after **one answer**. A single "I don't know"
 * on the root marks the root as not-known, `nextToAsk` will not descend past a
 * node in that state, and so the session correctly ends immediately — and then
 * told the learner why their last few years had felt the way they did.
 *
 * So the interpretation is now conditional on there being enough behind it, and
 * the one-answer case says plainly why it stopped rather than leaving an abrupt
 * ending to be read as the product breaking its promise of "a few questions".
 *
 * Nothing here decides anything: the lead node and the count come from
 * `leadNode` and `downstreamOf`, the same as everywhere else.
 */

/** Below this many marks, the map has structure to report and nothing more. */
export const ENOUGH_TO_INTERPRET = 3;

export const NOTHING_LEFT = "There's nothing left for me to ask about — you've got the whole map.";

/** How many nodes this session actually placed. */
export function answered(learner: LearnerModel): number {
  return Object.keys(learner.states).length;
}

export function closingFor(graph: ConceptGraph, learner: LearnerModel): string {
  const lead = leadNode(graph, learner);
  if (!lead) return NOTHING_LEFT;

  const resting = downstreamOf(graph, lead.id).length;
  const placed = answered(learner);

  /*
   * One answer, and it was decisive. Saying so is the difference between an
   * ending that reads as the product working and one that reads as it giving
   * up: everything on this map rests on the idea we just asked about, so there
   * was genuinely nothing else worth asking.
   */
  const opening =
    placed <= 1
      ? 'That one answer is enough, because everything else on the map rests on it.'
      : 'That gives me what I needed.';

  if (resting === 0) return `${opening} ${lead.label} is the place to start from. It is highlighted for you.`;

  /*
   * The interpretation is held back until several answers are behind it. It is
   * the sentence that produces recognition when it lands and a verdict when it
   * does not, and one "I don't know" is not enough to know which.
   */
  const why =
    placed >= ENOUGH_TO_INTERPRET ? ', which is why so much of the rest has probably felt slippery' : '';

  return `${opening} ${lead.label} is the place to start from — ${resting} of the later ideas rest on it${why}. It is highlighted for you.`;
}

/**
 * Opening a session with nothing left to ask.
 *
 * Separate copy, for two reasons. Nothing has been asked, so "that gives me
 * what I needed" would be a lie. And the condition is much weaker than it
 * sounds: `nextToAsk` considers only `unexplored` nodes, so this fires as soon
 * as every node the frontier has opened carries any mark at all — which is
 * emphatically not the same as knowing the whole map. Saying "you've got the
 * whole map" to someone holding three of twenty-three read as the app being
 * broken, and fairly.
 */
export function nothingToAsk(graph: ConceptGraph, learner: LearnerModel): string {
  const lead = leadNode(graph, learner);
  if (!lead) return NOTHING_LEFT;

  const resting = downstreamOf(graph, lead.id).length;
  const rests = resting > 0 ? ` — ${resting} of the later ideas rest on it` : '';

  return `Everything I would have asked about already has a mark on the map, so there is nothing new to place. ${lead.label} is still the place to start from${rests}. It is highlighted for you.`;
}
