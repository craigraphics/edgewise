import type { ConceptNode } from '@/lib/graph/types';

/**
 * The scripted first line of a diagnostic.
 *
 * It used to say "Starting somewhere near the bottom" every time. That is true
 * of an empty map, whose first question is the root, and false the moment
 * somebody comes back with marks: `nextToAsk` then begins at their frontier,
 * which can be halfway down. A sentence that misdescribes where we are, on the
 * first thing a returning learner hears, reads as the product not having looked
 * at their map.
 */

const INVITATION =
  "Let's work out where your understanding of this currently sits — there are no right answers here, and \"I don't know\" is genuinely useful.";

export function openingFor(first: ConceptNode): string {
  const where =
    first.layer === 0 ? 'Starting somewhere near the bottom:' : 'Picking up from where your map already reaches:';
  return `${INVITATION} ${where} ${first.probes[0]}`;
}
