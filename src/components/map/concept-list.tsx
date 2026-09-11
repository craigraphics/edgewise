'use client';

import { NodeGlyph } from './node-glyph';
import { STATE_COPY } from '@/components/session/inspector';
import { stateOf } from '@/lib/graph/frontier';
import { teachingOrder } from '@/lib/graph/order';
import type { ConceptGraph, LearnerModel } from '@/lib/graph/types';

/** A second reading of the same graph. Prerequisites are data, not visual guesses. */
export function ConceptList({ graph, model, selectedId, onSelect }: {
  graph: ConceptGraph;
  model: LearnerModel;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="concept-list min-h-0 flex-1 overflow-y-auto" aria-label="Ideas in prerequisite order">
      {teachingOrder(graph).map((node) => {
        const state = stateOf(model, node.id);
        const prerequisites = node.prerequisites.map(id => graph.nodes.find(n => n.id === id)!.label);
        return (
          <li key={node.id} className="border-border border-b">
            <button
              data-list-node={node.id}
              aria-current={selectedId === node.id ? 'true' : undefined}
              onClick={() => onSelect(node.id)}
              className="hover:bg-surface-2 flex w-full items-start gap-4 px-3 py-4 text-left"
            >
              <svg width="18" height="18" className="mt-1 shrink-0" aria-hidden>
                <NodeGlyph state={state} cx={9} cy={9} colour="var(--foreground)" />
              </svg>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-base font-medium">{node.label}</span>
                  <span className="text-muted-foreground text-xs">{STATE_COPY[state]}</span>
                </span>
                <span className="text-muted-foreground mt-1 block text-sm">
                  {prerequisites.length ? `Builds on ${prerequisites.join(' · ')}` : 'The foundation of this map'}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
