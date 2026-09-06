import { stateOf } from '@/lib/graph/frontier';
import type { LearnerModel } from '@/lib/graph/types';

/**
 * What the unlock wave is allowed to run on.
 *
 * The wave travels down a node's dependants and says "this just opened a
 * chain". That is true exactly when the learner's own explanation moved the
 * node to `known`, and false the moment it fires because they were *taught*
 * something — which is the product's central distinction and the reason the
 * walkthrough and `explain-back` are separate systems:
 *
 *   | | Changes the map? |
 *   |---|---|
 *   | The walkthrough teaches you an idea | **No** |
 *   | You explain it back and it holds up | **Yes** |
 *
 * Listening to a good explanation feels almost exactly like understanding one.
 * A celebration that cannot tell those apart would be the interface asserting
 * the one thing the map exists to be right about, and asserting it wrongly.
 *
 * So the wave takes a before and an after and works it out, rather than taking
 * a node id from whoever happened to call it. Wiring it to "the walkthrough
 * covered a node" then cannot compile into something that fires: covering
 * changes no state, so this returns false.
 */
export function unlockedBy(before: LearnerModel, after: LearnerModel, nodeId: string): boolean {
  return stateOf(before, nodeId) !== 'known' && stateOf(after, nodeId) === 'known';
}

/** Every node that just became solid. Normally one; never assumed to be. */
export function unlockedNodes(before: LearnerModel, after: LearnerModel): string[] {
  return Object.keys(after.states).filter((id) => unlockedBy(before, after, id));
}
