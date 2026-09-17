import { nextToAsk, withMark } from '@/lib/graph/frontier';
import type { ConceptGraph, ConceptNode, LearnerModel } from '@/lib/graph/types';

import { closingFor } from './closing';

/**
 * "Skip" is always valid and always advances.
 *
 * It used to go to the model like any other answer, which judged "skip" as an
 * answer that did not address the question — `unclear` — and asked the same
 * node again. That is the one outcome `AGENTS.md` rules out: "I don't know" and
 * "skip" must always advance the diagnostic and never read as failure.
 *
 * So the rule lives here, in code, and the route applies it before any model
 * call. Rewording the prompt would have been hoping; this is enforcing. A skip
 * is recorded exactly as "I don't know" is — `blocked`, which means "not yet"
 * and is a fact about where to begin rather than a verdict on an answer.
 *
 * Matching is on the WHOLE answer, never a word inside one. "The next word is
 * picked by…" is an answer about next-token prediction, and treating it as a
 * request to move on would throw away the most useful thing somebody said.
 */

const SKIP_PHRASES = new Set([
  'skip',
  'skip it',
  'skip this',
  'skip this one',
  'skip that',
  'skip please',
  'please skip',
  'pass',
  'i pass',
  'pass please',
  'next',
  'next one',
  'next question',
  'next please',
  'move on',
  'lets move on',
  'can we move on',
  'move on please',
]);

/** Lower-case, apostrophes dropped, punctuation to spaces, whitespace collapsed. */
function normalise(answer: string): string {
  return answer
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSkip(answer: string): boolean {
  return SKIP_PHRASES.has(normalise(answer));
}

/** Said before the next question after a skip. Never mentions the idea skipped. */
export const SKIP_ACKNOWLEDGEMENT = "That's fine — let's leave that one.";

/**
 * Said before the scripted closing, in place of the model's own last line.
 *
 * The final generated acknowledgement read "We have reached a point where the
 * mechanics aren't clear" — a verdict, in the cheapest model's words, at the
 * one moment the tone matters most. The closing is scripted, so the sentence
 * leading into it is too.
 */
export const FINAL_ACKNOWLEDGEMENT = 'Thank you — that gives me enough to draw your map.';

export type SkipTurn = {
  done: boolean;
  say: string;
  closing: string | null;
  mark: { nodeId: string; state: 'blocked' };
  nodeId: string | null;
  followUps: 0;
};

/**
 * The whole turn for a skip, with no model involved: mark the node as an
 * "I don't know" would be marked, then ask whatever the prerequisite structure
 * says comes next.
 */
export function skipTurn(graph: ConceptGraph, learner: LearnerModel, current: ConceptNode): SkipTurn {
  const after = withMark(learner, current.id, 'blocked');
  const next = nextToAsk(graph, after);

  return {
    done: next === null,
    say: next ? `${SKIP_ACKNOWLEDGEMENT} ${next.probes[0]}` : FINAL_ACKNOWLEDGEMENT,
    closing: next ? null : closingFor(graph, after),
    mark: { nodeId: current.id, state: 'blocked' },
    nodeId: next?.id ?? null,
    followUps: 0,
  };
}
