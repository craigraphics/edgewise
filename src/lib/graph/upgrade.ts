import type { NodeState } from './types';

/**
 * Whether explaining something back has earned a better standing.
 *
 * Two rules, both deliberate.
 *
 * **Being taught something never moves it.** Only an explanation the learner
 * produces themselves can, which is the whole reason the walkthrough and the
 * learner model are separate systems. Listening to a good explanation feels
 * exactly like understanding one, and a map that confused the two would be
 * confidently wrong about the thing it exists to be right about.
 *
 * **Trying can never cost you.** An attempt that reveals less than we already
 * recorded leaves the record alone. Someone who volunteers an explanation and
 * gets marked down for it will not volunteer a second one, and the willingness
 * to try out loud is worth more than the precision of any single mark.
 */

/**
 * How much understanding a state claims.
 *
 * `blocked` and `unexplored` rank equal on purpose: they differ in what we know
 * about the learner, not in what the learner knows. One means we asked, the
 * other means we did not.
 */
const CLAIM: Record<NodeState, number> = {
  unexplored: 0,
  blocked: 0,
  shaky: 1,
  known: 2,
};

export function upgrade(current: NodeState, earned: NodeState): NodeState {
  return CLAIM[earned] > CLAIM[current] ? earned : current;
}

export function isUpgrade(current: NodeState, earned: NodeState): boolean {
  return CLAIM[earned] > CLAIM[current];
}
