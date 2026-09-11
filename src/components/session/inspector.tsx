'use client';

import { XIcon } from 'lucide-react';

import { NodeGlyph } from '@/components/map/node-glyph';
import { Caveat } from '@/components/session/caveat';
import { ExplainBack } from '@/components/session/explain-back';
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
  /**
   * `f` has been pressed and the screen is about to be turned around. Every
   * control goes — the marks most of all. Watching someone click "Not yet"
   * against you is the most direct possible way to make a diagnosis feel like a
   * grading, which is the failure this product is least able to survive.
   */
  presenting?: boolean;
  /** False mid-session: withholds the explanation for anything not yet settled. */
  reveal: boolean;
  /** The walkthrough has been through this one, so there is nothing left to withhold. */
  covered?: boolean;
  config: SessionConfig;
  onEarned: (nodeId: string, state: NodeState) => void;
  onMark: (nodeId: string, state: NodeState) => void;
  onClose: () => void;
  onSelect?: (id: string) => void;
  onPlay?: () => void;
  explainRequest?: number;
};

/**
 * The state, drawn the way the map draws it.
 *
 * A plain grey `Badge` saying "Not yet" gave the panel and the map two
 * unrelated vocabularies for the same fact. Reusing `NodeGlyph` means the mark
 * you just read on a node is the mark you see here, and it cannot drift.
 */
function StateBadge({ state, band }: { state: NodeState; band: string }) {
  return (
    <span className="bg-surface-2 border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs">
      <svg width={11} height={11} aria-hidden className="shrink-0 overflow-visible">
        <NodeGlyph state={state} cx={5.5} cy={5.5} colour={`var(--band-${band})`} />
      </svg>
      {STATE_COPY[state]}
    </span>
  );
}

export function Inspector({
  graph,
  node,
  model,
  marking,
  presenting = false,
  reveal,
  covered,
  config,
  onEarned,
  onMark,
  onClose, onSelect, onPlay, explainRequest = 0,
}: Props) {
  const blocked = downstreamOf(graph, node.id);
  const state = stateOf(model, node.id);

  return (
    // The guide owns scrolling, including its padding. A second scroller here
    // strands the lower controls when the pointer is outside this inner box.
    <div className="shrink-0 space-y-4 pr-1">
      <div>
        <div className="flex items-start justify-between gap-2">
          {/*
           * The state badge is a mark, so it goes with the rest of them when
           * the screen is turned around. Showing someone "Not yet" against the
           * idea they are being asked about is the grading this mode exists to
           * prevent.
           */}
          {presenting ? (
            <span />
          ) : (
            <StateBadge state={state} band={node.band} />
          )}
          {presenting ? null : (
            <Button
              variant="ghost"
              size="icon-touch"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="-mt-1 -mr-1"
            >
              <XIcon />
            </Button>
          )}
        </div>
        <h2 id="concept-title" tabIndex={-1} className="font-display mt-3 text-2xl font-semibold outline-none">{node.label}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{node.subtitle}</p>
      </div>

      {!marking && !presenting && (node.id === 'neuron' || node.id === 'tokens') && onPlay && <Button variant="outline" size="touch" onClick={onPlay}>{node.id === 'tokens' ? 'Try the tokenizer playground' : 'Try the neuron experiment'}</Button>}

      {!presenting && <div className="starting-point">
        <p className="eyebrow">What connects here</p>
        <p className="mt-2 text-sm">{node.prerequisites.length ? 'Builds on' : 'This is the foundation of the map.'}</p>
        <div className="mt-1 flex flex-wrap gap-x-3">
          {node.prerequisites.map(id => <button key={id} onClick={() => onSelect?.(id)} className="min-h-10 text-left text-sm underline underline-offset-4">{graph.nodes.find(n => n.id === id)!.label}</button>)}
        </div>
        {blocked.length > 0 && <p className="text-muted-foreground mt-3 text-sm">{blocked.length} later ideas build on this one. That describes the connections, not how many you know.</p>}
      </div>}

      {marking && presenting ? null : marking ? (
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
            <p className="text-muted-foreground text-2xs font-medium uppercase">Ask them</p>
            <ul className="mt-1.5 space-y-2">
              {node.probes.map((probe) => (
                <li key={probe} className="text-base leading-relaxed">
                  {probe}
                </li>
              ))}
            </ul>
          </div>

          {node.misconceptions.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-2xs font-medium uppercase">Listen for</p>
              <ul className="mt-1.5 space-y-2">
                {node.misconceptions.map((misconception) => (
                  <li key={misconception} className="text-muted-foreground text-base leading-relaxed">
                    {misconception}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : !reveal && !covered && state === 'unexplored' ? (
        <p className="text-muted-foreground text-base leading-relaxed">
          Not gone into yet. Whatever you already have here is what the conversation is trying to find out.
        </p>
      ) : (
        <>
          <p className="font-display text-read">{node.explanations.intuition}</p>
          <p className="text-muted-foreground text-base leading-relaxed">{node.explanations.example}</p>

          {/*
           * Surfaced with the explanation rather than buried. A simplification
           * labelled with what it costs is a ladder; unlabelled, it becomes
           * something the learner has to be rescued from later.
           */}
          {node.simplificationCost ? (
            <Caveat title="What this telling costs" band={node.band}>
              {node.simplificationCost}
            </Caveat>
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
      {!marking && !presenting && (reveal || covered) ? (
        <ExplainBack openRequest={explainRequest} prompt={explainRequest > 0 ? node.id === 'tokens' ? 'Why can the number of tokens differ from the number of words?' : node.id === 'neuron' ? 'What did changing the weight do? How did the inputs become one output? Explain it in your own words.' : undefined : undefined} node={node} state={state} config={config} onEarned={onEarned} />
      ) : null}


    </div>
  );
}
