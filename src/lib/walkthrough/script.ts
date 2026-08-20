import type { ConceptNode, NodeState } from '@/lib/graph/types';

/**
 * The words for one step of the walkthrough, built from authored content.
 *
 * **No model call.** Every sentence here was written by a person and reviewed
 * before anyone heard it, which is the one safety property live generation
 * cannot offer — and teaching something false is this product's worst failure.
 * It is also instant and free, which is what makes a twenty-three step spoken
 * walk viable against a shared free-tier quota.
 *
 * The model is reached for only when the learner says something: a question, or
 * "simpler". Phrasing on demand, content in advance.
 */

export type Step = {
  node: ConceptNode;
  /** Spoken lead-in, varying with what the diagnostic already established. */
  opener: string;
  body: string[];
  /**
   * What this telling costs, when it costs something. Surfaced at the time
   * rather than left to be unlearned later — an unlabelled simplification
   * becomes a misconception the learner has to be rescued from.
   */
  caveat: string | null;
  /** True when we are recapping something they already showed they had. */
  brief: boolean;
};

/**
 * Openers by what we learned in the diagnostic.
 *
 * None of them grade. "You got this one right" is a score, and a walkthrough
 * that keeps reminding you how you did in the test is the test again.
 */
function openerFor(node: ConceptNode, state: NodeState): { opener: string; brief: boolean } {
  switch (state) {
    case 'known':
      // Covered anyway, because the walk goes through everything — but briefly.
      // Re-teaching in full something someone has just demonstrated reads as
      // not having listened.
      return { opener: `${node.label}, which you already had, so just in passing.`, brief: true };
    case 'shaky':
      return { opener: `${node.label}. You were most of the way there on this one.`, brief: false };
    case 'blocked':
      return { opener: `${node.label}. This is one of the ones worth having.`, brief: false };
    default:
      return { opener: `${node.label}.`, brief: false };
  }
}

export function stepFor(node: ConceptNode, state: NodeState): Step {
  const { opener, brief } = openerFor(node, state);

  return {
    node,
    opener,
    // The brief pass drops the worked example and keeps the idea itself.
    body: brief ? [node.explanations.intuition] : [node.explanations.intuition, node.explanations.example],
    caveat: node.simplificationCost,
    brief,
  };
}

/** One string, for the speaker. Written to be heard rather than read. */
export function spokenForm(step: Step): string {
  const parts = [step.opener, ...step.body];
  if (step.caveat) {
    parts.push(`One thing worth flagging, because it will bite you later otherwise. ${step.caveat}`);
  }
  return parts.join(' ');
}
