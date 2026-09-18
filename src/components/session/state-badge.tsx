import { NodeGlyph } from '@/components/map/node-glyph';
import type { NodeState } from '@/lib/graph/types';

export const STATE_COPY: Record<NodeState, string> = {
  known: 'Solid',
  shaky: 'Half-held',
  blocked: 'Not yet',
  unexplored: 'Not looked at',
};

/**
 * The state, drawn the way the map draws it.
 *
 * A plain grey `Badge` saying "Not yet" gave the panel and the map two
 * unrelated vocabularies for the same fact. Reusing `NodeGlyph` means the mark
 * you just read on a node is the mark you see here, and it cannot drift.
 */
export function StateBadge({ state, band }: { state: NodeState; band: string }) {
  return (
    <span className="bg-surface-2 border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs">
      <svg width={11} height={11} aria-hidden className="shrink-0 overflow-visible">
        <NodeGlyph state={state} cx={5.5} cy={5.5} colour={`var(--band-${band})`} />
      </svg>
      {STATE_COPY[state]}
    </span>
  );
}
