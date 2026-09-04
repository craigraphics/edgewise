'use client';

import { useState } from 'react';

import { NodeGlyph } from '@/components/map/node-glyph';
import { STATE_COPY } from '@/components/session/inspector';
import type { ConceptGraph, NodeState } from '@/lib/graph/types';
import { cn } from '@/lib/utils';

/**
 * What the marks on the map mean, drawn exactly as the map draws them.
 *
 * The previous legend explained the six BANDS and nothing else, and it sat
 * below the full 1050px height of the map inside the map's own scroll
 * container — so at a laptop size you had to scroll 250px past the last node to
 * find it. Nobody does that.
 *
 * The four states are what the product is actually about, so they are what the
 * legend teaches, and it sits above the map where it is read before the drawing
 * rather than after it. The bands move into a popover: which part of the
 * subject a node belongs to is answered by the node's own label most of the
 * time, and by the rail down the left edge otherwise.
 *
 * The glyphs are the real `NodeGlyph`, not a drawing of one. A legend that
 * approximates its own map is a legend that will drift from it.
 */

const ORDER: NodeState[] = ['known', 'shaky', 'blocked', 'unexplored'];

export function MapLegend({ graph, className }: { graph: ConceptGraph; className?: string }) {
  const [bandsOpen, setBandsOpen] = useState(false);

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {ORDER.map((state) => (
        <span key={state} className="text-muted-foreground flex items-center gap-1.5 text-2xs">
          <svg width={13} height={13} aria-hidden className="shrink-0 overflow-visible">
            {/* The neutral band colour: the legend teaches the state, and
                showing it in one of the six hues would imply the state and the
                band were related. */}
            <NodeGlyph state={state} cx={6.5} cy={6.5} colour="var(--foreground)" />
          </svg>
          {STATE_COPY[state]}
        </span>
      ))}

      <div className="relative ml-auto">
        <button
          type="button"
          onClick={() => setBandsOpen((open) => !open)}
          aria-expanded={bandsOpen}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-2xs transition-colors duration-[--dur-fast]"
        >
          <span className="flex gap-px" aria-hidden>
            {graph.bands.map((band) => (
              <span
                key={band.id}
                className="inline-block h-2.5 w-1 rounded-[1px]"
                style={{ backgroundColor: `var(--band-${band.id})` }}
              />
            ))}
          </span>
          {graph.bands.length} parts
        </button>

        {bandsOpen ? (
          <div className="edgewise-raised border-border absolute right-0 bottom-full z-30 mb-2 w-56 rounded-lg border p-2">
            <ul className="space-y-1.5">
              {graph.bands.map((band) => (
                <li key={band.id} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-3.5 w-1 shrink-0 rounded-[1px]"
                    style={{ backgroundColor: `var(--band-${band.id})` }}
                  />
                  {band.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
