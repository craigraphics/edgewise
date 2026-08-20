'use client';

import { Button } from '@/components/ui/button';
import { stateOf } from '@/lib/graph/frontier';
import type { ConceptGraph, LearnerModel } from '@/lib/graph/types';

/**
 * The end of the walkthrough.
 *
 * Two versions, and which one appears is the point. Being walked through
 * twenty-three ideas is a real thing to have done — it takes attention and
 * time, and saying so is fair. It is not the same as understanding them, and
 * telling someone it is would undo the one distinction this whole product rests
 * on. So the celebration is honest about which of the two just happened, and
 * the bigger one is reserved for the map actually being solid.
 */

type Props = {
  graph: ConceptGraph;
  model: LearnerModel;
  onRestart: () => void;
  onExplainMore: () => void;
};

export function Completion({ graph, model, onRestart, onExplainMore }: Props) {
  const total = graph.nodes.length;
  const solid = graph.nodes.filter((node) => stateOf(model, node.id) === 'known').length;
  const everything = solid === total;

  return (
    <div className="edgewise-rise space-y-5">
      <Tick />

      {everything ? (
        <>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">That is the whole thing.</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              All {total} of {total}, and every one of them explained back in your own words.
            </p>
          </div>

          <p className="text-sm leading-relaxed">
            The map is completely solid — which means you did not just sit through it. You said each of these
            back, in your own words, and it held up. That is a different thing from having read about them, and it
            is the harder one.
          </p>

          <p className="text-muted-foreground text-sm leading-relaxed">
            From prediction from examples all the way to agents. Worth looking at the shape of it before you close
            the tab.
          </p>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">You got through all {total}.</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Start to finish, from learning from examples through to agents.
            </p>
          </div>

          <p className="text-sm leading-relaxed">
            That is the whole map covered — no small thing, and most people bounce off this material long before
            the end of it.
          </p>

          {/*
           * Stated plainly rather than glossed. Someone who thinks they have
           * finished, when the map still shows most of it unheld, has been
           * misled by their own sense of a completed task — and that is exactly
           * the confusion between being told and knowing.
           */}
          <div className="border-foreground/15 border-l-2 pl-4">
            <p className="text-sm leading-relaxed">
              <span className="font-medium">
                {solid} of {total}
              </span>{' '}
              are marked solid so far. The rest are ideas you have now been through, but have not put back into
              your own words yet — and that second part is what actually makes them stick.
            </p>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Pick any box on the map and try explaining it. Clumsy everyday language is fine; it beats the right
            terminology.
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {!everything ? (
          <Button size="touch" onClick={onExplainMore}>
            Explain one back
          </Button>
        ) : null}
        <Button size="touch" variant={everything ? 'default' : 'outline'} onClick={onRestart}>
          Go through it again
        </Button>
      </div>
    </div>
  );
}

function Tick() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="edgewise-check size-12"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="22" className="stroke-foreground/15" strokeWidth="2" />
      <path
        d="M14 24.5 L21 31.5 L34 17"
        className="stroke-foreground"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
