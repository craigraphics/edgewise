'use client';

import { ExplainBack } from '@/components/session/explain-back';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { downstreamOf, stateOf } from '@/lib/graph/frontier';
import type { ConceptGraph, ConceptNode, LearnerModel, NodeState } from '@/lib/graph/types';
import type { SessionConfig } from '@/lib/session/config';

export const STATE_COPY: Record<NodeState, string> = {
  known: 'Solid',
  shaky: 'Half-held',
  blocked: 'Not yet',
  unexplored: 'Not looked at',
};

/** Order matches the 1–4 keyboard shortcuts. */
export const MARKS: NodeState[] = ['known', 'shaky', 'blocked', 'unexplored'];

type Props = {
  graph: ConceptGraph;
  node: ConceptNode;
  model: LearnerModel;
  /** Facilitator mode: show the probes and let them be marked by hand. */
  marking: boolean;
  /** False mid-session: withholds the explanation for anything not yet settled. */
  reveal: boolean;
  /** The walkthrough has been through this one, so there is nothing left to withhold. */
  covered?: boolean;
  config: SessionConfig;
  onEarned: (nodeId: string, state: NodeState) => void;
  onMark: (nodeId: string, state: NodeState) => void;
  onClose: () => void;
};

export function Inspector({ graph, node, model, marking, reveal, covered, config, onEarned, onMark, onClose }: Props) {
  const blocked = downstreamOf(graph, node.id);
  const state = stateOf(model, node.id);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary">{STATE_COPY[state]}</Badge>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
          >
            Close
          </button>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{node.label}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{node.subtitle}</p>
      </div>

      {marking ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {MARKS.map((mark, index) => (
              <Button
                key={mark}
                size="touch"
                variant={state === mark ? 'default' : 'outline'}
                onClick={() => onMark(node.id, mark)}
              >
                <span className="tabular-nums opacity-50">{index + 1}</span>
                {STATE_COPY[mark]}
              </Button>
            ))}
          </div>

          {/*
           * Probes and misconceptions are facilitator-only. Showing someone the
           * list of things you are checking them against turns the conversation
           * into an exam, which is the failure this product is least able to
           * survive.
           */}
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Ask them</p>
            <ul className="mt-1.5 space-y-2">
              {node.probes.map((probe) => (
                <li key={probe} className="text-sm leading-relaxed">
                  {probe}
                </li>
              ))}
            </ul>
          </div>

          {node.misconceptions.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Listen for</p>
              <ul className="mt-1.5 space-y-2">
                {node.misconceptions.map((misconception) => (
                  <li key={misconception} className="text-muted-foreground text-sm leading-relaxed">
                    {misconception}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : !reveal && !covered && state === 'unexplored' ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Not gone into yet. Whatever you already have here is what the conversation is trying to find out.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{node.explanations.intuition}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">{node.explanations.example}</p>

          {/*
           * Surfaced with the explanation rather than buried. A simplification
           * labelled with what it costs is a ladder; unlabelled, it becomes
           * something the learner has to be rescued from later.
           */}
          {node.simplificationCost ? (
            <div className="border-foreground/15 border-l-2 pl-4">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                What this telling costs
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">{node.simplificationCost}</p>
            </div>
          ) : null}
        </>
      )}

      {/*
       * The downstream count is the argument for the map existing. "You do not
       * have this yet" is uninteresting; "eleven later ideas are waiting on it"
       * is the thing a chat assistant structurally cannot tell you.
       */}
      {/*
       * Available on every node, not only the one being taught. Clearing a
       * block is the learner's to attempt whenever they feel ready, and
       * confining it to a position in the walkthrough would make it a step in
       * someone else's flow rather than something they chose.
       */}
      {!marking && (reveal || covered) ? (
        <ExplainBack node={node} state={state} config={config} onEarned={onEarned} />
      ) : null}

      {blocked.length > 0 && state !== 'known' ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          <span className="text-foreground font-medium">{blocked.length} later ideas</span> rest on this one,
          including {blocked.slice(0, 3).map((entry) => entry.label).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
