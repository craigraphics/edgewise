'use client';

import type { ConceptGraph } from '@/lib/graph/types';
import { cn } from '@/lib/utils';

/**
 * Where you are, and what the map says is worth having next.
 *
 * This was a 12px muted line in the header — "6 of 23 solid · next: …" — and it
 * is the most important sentence on the page, so it is now drawn.
 *
 * A segmented ring rather than a bar or a percentage, and the distinction
 * matters. A bar reads as a task you are partway through; a percentage is a
 * score, and this product has no score. Twenty-three segments read as
 * twenty-three ideas, which is what they are, and a segment is either filled or
 * it is not — the same binary the map uses.
 *
 * Segments are drawn in the band colours, in teaching order, so the ring is a
 * miniature of the map rather than a second, unrelated visualisation.
 */

type Props = {
  graph: ConceptGraph;
  /** Node ids that are `known`, in any order. */
  solid: ReadonlySet<string>;
  /** In teaching order — the ring reads round the way the walk goes. */
  order: readonly { id: string; band: string }[];
  size?: number;
  className?: string;
};

export function ProgressRing({ graph, solid, order, size = 30, className }: Props) {
  const radius = size / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const segment = circumference / order.length;
  // A hairline of ground between segments, so twenty-three reads as twenty-three
  // rather than as one continuous arc.
  const gap = Math.min(1.6, segment * 0.28);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={`${solid.size} of ${graph.nodes.length} ideas solid`}
    >
      {/* Rotated so the first idea starts at the top rather than at three
          o'clock, which is where SVG's zero angle is. */}
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {order.map((node, index) => {
          const held = solid.has(node.id);
          return (
            <circle
              key={node.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={held ? `var(--band-${node.band})` : 'var(--muted-foreground)'}
              strokeOpacity={held ? 1 : 0.25}
              strokeWidth={held ? 3.5 : 2.5}
              strokeDasharray={`${Math.max(0.5, segment - gap)} ${circumference}`}
              strokeDashoffset={-index * segment}
              strokeLinecap="butt"
              className="transition-all duration-[--dur-slow] ease-[--ease]"
            />
          );
        })}
      </g>
    </svg>
  );
}
