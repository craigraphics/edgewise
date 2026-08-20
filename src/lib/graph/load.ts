import raw from '@/../content/graph.json';

import { conceptGraph, type ConceptGraph } from './types';

/**
 * The parsed graph.
 *
 * Parsed once at module load and shared. It is static content checked into the
 * repo, so there is nothing to invalidate — and validating here rather than at
 * each use means a malformed graph fails at import, where it is obvious, rather
 * than three turns into someone's session.
 */
export const GRAPH: ConceptGraph = conceptGraph.parse(raw);
