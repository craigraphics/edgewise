'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The panel, as a sheet, on anything narrower than a desktop.
 *
 * Below 1280 the two regions used to stack, which measured badly in both
 * directions: on a tablet the map got 530px underneath a panel that gave no
 * hint anything followed it, and on a phone the two split one non-scrolling
 * viewport into a 250px map and a 250px panel, neither of which is usable.
 *
 * A sheet fixes both because it makes the split adjustable by the person using
 * it. The map gets the whole area; the panel sits over it and is dragged to
 * whatever share of the screen the current moment needs. Reading a long
 * explanation, take the screen. Looking at where you are, push it down.
 *
 * Three stops rather than free positioning: a sheet you can leave at any height
 * is a sheet you have to keep adjusting.
 *
 * Deliberately not `motion`'s drag. Height is animated by a CSS transition that
 * is switched off for the duration of a drag, which keeps the sheet exactly
 * under the finger — a spring following a drag lags behind it, and on a control
 * you are physically holding, lag reads as broken rather than as smooth.
 */

export type Snap = 'peek' | 'half' | 'full';

/** Enough to show the handle and the first line of whatever is inside. */
const PEEK_HEIGHT = 96;
const HALF_FRACTION = 0.58;

export function snapHeights(containerHeight: number): Record<Snap, number> {
  return {
    peek: Math.min(PEEK_HEIGHT, containerHeight),
    half: Math.max(PEEK_HEIGHT, Math.round(containerHeight * HALF_FRACTION)),
    full: containerHeight,
  };
}

/** The stop closest to a dragged height. */
export function nearestSnap(height: number, heights: Record<Snap, number>): Snap {
  return (Object.keys(heights) as Snap[]).reduce((best, snap) =>
    Math.abs(heights[snap] - height) < Math.abs(heights[best] - height) ? snap : best,
  );
}

type Props = {
  snap: Snap;
  onSnapChange: (snap: Snap) => void;
  /** The height of the region the sheet sits in. 0 until measured. */
  containerHeight: number;
  children: React.ReactNode;
  className?: string;
};

export function PanelSheet({ snap, onSnapChange, containerHeight, children, className }: Props) {
  const heights = snapHeights(containerHeight);
  const [dragged, setDragged] = useState<number | null>(null);
  const drag = useRef<{ pointerId: number; y: number; height: number } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      drag.current = { pointerId: event.pointerId, y: event.clientY, height: heights[snap] };
      setDragged(heights[snap]);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [heights, snap],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const started = drag.current;
      if (!started || started.pointerId !== event.pointerId) return;
      // Dragging up grows the sheet, so the delta is inverted.
      const next = started.height - (event.clientY - started.y);
      setDragged(Math.min(heights.full, Math.max(heights.peek, next)));
    },
    [heights],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current = null;
      if (dragged !== null) onSnapChange(nearestSnap(dragged, heights));
      setDragged(null);
    },
    [dragged, heights, onSnapChange],
  );

  /* Escape drops the sheet rather than doing nothing, so there is always a way
     back to the map without finding the handle. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && snap === 'full') onSnapChange('half');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSnapChange, snap]);

  const height = dragged ?? heights[snap];

  return (
    <aside
      // `relative` so the voice halo, raised from inside the conversation,
      // lights this panel's edges rather than the content box it is declared in.
      className={cn(
        'bg-surface-1 border-border z-20 flex flex-col overflow-hidden rounded-t-2xl border-t shadow-[0_-8px_32px_-16px_oklch(0_0_0/25%)]',
        dragged === null && 'transition-[height] duration-[--dur-slow] ease-[--ease]',
        className,
      )}
      style={{ height: containerHeight > 0 ? height : undefined }}
    >
      <div
        role="separator"
        aria-label="Resize the panel"
        aria-orientation="horizontal"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          // The handle is operable without a pointer: the stops are ordered, so
          // up and down step through them.
          const stops: Snap[] = ['peek', 'half', 'full'];
          const step = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
          if (step === 0) return;
          event.preventDefault();
          onSnapChange(stops[Math.min(2, Math.max(0, stops.indexOf(snap) + step))]);
        }}
        className="relative flex h-9 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span className="bg-border h-1 w-9 rounded-full" aria-hidden />
      </div>

      {/*
       * A named way back to the map.
       *
       * On a phone the panel opens over the whole map, and the only way down
       * was to find the grab handle and drag it — which is a gesture you have
       * to already suspect exists. The map is the product; there has to be a
       * word for it.
       */}
      <button
        type="button"
        onClick={() => onSnapChange(snap === 'peek' ? 'full' : 'peek')}
        className="text-muted-foreground hover:text-foreground absolute top-0 right-2 z-10 flex h-10 items-center gap-1 rounded-md px-3 text-2xs transition-colors duration-[--dur-fast]"
      >
        {snap === 'peek' ? (
          <>
            <ChevronUpIcon className="size-3" />
            Back
          </>
        ) : (
          <>
            <ChevronDownIcon className="size-3" />
            Map
          </>
        )}
      </button>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6">{children}</div>
    </aside>
  );
}
