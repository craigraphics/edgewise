'use client';

import { ModeSwitch, type Mode } from '@/components/shell/mode-switch';
import { ProgressRing } from '@/components/shell/progress-ring';
import { ToolsMenu } from '@/components/shell/tools-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import type { ConceptGraph, ConceptNode } from '@/lib/graph/types';

/**
 * A slim bar, and the one line that must never scroll away.
 *
 * The progress line — where you are, and what the map says is worth having next
 * — used to be 12px muted text under the title, which is the smallest and
 * quietest thing on the page. It is now the ring plus the count plus the lead
 * node's name, and it is the second thing in the header.
 *
 * On a phone it moves out of here entirely: the header can only hold the
 * wordmark and the controls at that width, and cramming the position in gave
 * three rows of chrome above a 250px map.
 */

type Props = {
  graph: ConceptGraph;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  solid: ReadonlySet<string>;
  order: readonly ConceptNode[];
  lead: ConceptNode | null;
  marking: boolean;
  onLeaveMarking: () => void;
  tools: { label: string; onSelect: () => void; separated?: boolean }[];
};

export function AppHeader({
  graph,
  mode,
  onModeChange,
  solid,
  order,
  lead,
  marking,
  onLeaveMarking,
  tools,
}: Props) {
  return (
    <header className="border-border bg-surface-0/85 supports-[backdrop-filter]:bg-surface-0/70 shrink-0 border-b backdrop-blur-xl">
      {/*
       * One row from 640 up. Below that the mode switch takes a row of its own
       * rather than squeezing the subject down to "How …", which is what a
       * single row produced at 390: the two long labels plus two icon buttons
       * left the title 58px. Two 44px rows is 10% of a phone viewport, against
       * the 330px — 39% — that the wrapping buttons used to take.
       */}
      <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:h-14 sm:flex-nowrap sm:py-0 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="font-display truncate text-lg font-semibold">{graph.subject}</h1>
          {/* Aligned on the title's baseline and set not to shrink, so a
              narrow window truncates the subject rather than the byline. */}
          <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
            by William Craig
          </span>
        </div>

        <Position
          graph={graph}
          solid={solid}
          order={order}
          lead={lead}
          className="ml-2 hidden lg:flex"
        />

        {/*
         * Order matters here, and it bit once already: with the tools group
         * taking the free space first, the mode switch was pushed off the right
         * edge of the window. Exactly one thing gets `ml-auto` per row.
         */}
        {marking ? (
          <Button
            variant="outline"
            size="touch"
            onClick={onLeaveMarking}
            className="order-last w-full sm:order-none sm:ml-auto sm:w-auto"
          >
            Done marking
          </Button>
        ) : (
          <ModeSwitch
            value={mode}
            onChange={onModeChange}
            className="order-last w-full sm:order-none sm:ml-auto sm:w-auto"
          />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <ToolsMenu items={tools} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * The count, the ring, and the name of the idea the map is pointing at.
 *
 * Exported because on a phone it belongs in the panel rather than the header —
 * the position is worth the space at any size, but the header does not have it.
 */
export function Position({
  graph,
  solid,
  order,
  lead,
  className,
}: {
  graph: ConceptGraph;
  solid: ReadonlySet<string>;
  order: readonly ConceptNode[];
  lead: ConceptNode | null;
  className?: string;
}) {
  return (
    <div className={`min-w-0 items-center gap-2.5 ${className ?? 'flex'}`}>
      <ProgressRing graph={graph} solid={solid} order={order} />
      <p className="text-muted-foreground min-w-0 truncate text-xs">
        <span className="text-foreground tabular font-medium">
          {solid.size} of {graph.nodes.length}
        </span>{' '}
        solid
        {lead ? (
          <>
            {' · next: '}
            <span className="text-foreground font-medium">{lead.label}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
