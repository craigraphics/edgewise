import { isExperimentId, type ExperimentId } from '@/lib/experiments/registry';
import type { ConceptGraph } from '@/lib/graph/types';

/**
 * Where in the map a URL is asking for.
 *
 * Everything on this page is one route and a pile of component state, so
 * "which idea am I reading" and "which experiment is open" were reachable only
 * by clicking there. A link to the tokenizer playground could not be sent to
 * anyone, and reloading lost the place.
 *
 * Two forms, both readable and both hand-typable:
 *
 *   #idea/tokens   the idea's own text, in the guide panel
 *   #play/tokens   its experiment, open and playing
 *
 * A bare `#tokens` is accepted as the idea, because that is what somebody
 * types, and it is rewritten to the canonical form once the app has it.
 */
export type DeepLink = { kind: 'idea'; id: string } | { kind: 'play'; id: ExperimentId };

/**
 * The link a hash is asking for, or null.
 *
 * An id that is not in the graph returns null rather than a link to nothing: a
 * stale or mistyped URL should land on the ordinary first screen, not on an
 * empty panel that looks like the app failed to load.
 *
 * `#play/<id>` for an idea that has no experiment falls back to the idea
 * itself. Experiments are added one at a time, so a link written today for an
 * idea that has not been built yet, or one whose experiment is later removed,
 * still arrives somewhere true.
 */
export function parseDeepLink(hash: string, graph: ConceptGraph): DeepLink | null {
  const path = decode(hash).replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (!path) return null;

  const segments = path.split('/');
  const kind = segments.length > 1 ? segments[0] : 'idea';
  const id = segments.length > 1 ? segments.slice(1).join('/') : segments[0];

  if (kind !== 'idea' && kind !== 'play') return null;
  if (!graph.nodes.some(node => node.id === id)) return null;

  return kind === 'play' && isExperimentId(id) ? { kind: 'play', id } : { kind: 'idea', id };
}

/** The hash that names a link, or the empty string for the ordinary first screen. */
export function hashFor(link: DeepLink | null): string {
  return link ? `#${link.kind}/${link.id}` : '';
}

function decode(hash: string): string {
  try {
    return decodeURIComponent(hash);
  } catch {
    // A hand-edited URL can carry a stray percent sign, which throws rather
    // than returning anything. An undecodable hash names no idea, so it falls
    // through to null the same way an unknown id does.
    return '';
  }
}
