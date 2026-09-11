'use client';

import { ArrowDown, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { NodeGlyph } from './node-glyph';
import { NeuronExperiment, type useNeuronExperiment } from '@/components/experiments/neuron-experiment';
import { TokenizerExperiment, type useTokenizerExperiment } from '@/components/experiments/tokenizer-experiment';
import { STATE_COPY } from '@/components/session/inspector';
import { stateOf } from '@/lib/graph/frontier';
import type { ConceptGraph, ConceptNode, LearnerModel } from '@/lib/graph/types';

type Props = {
  graph: ConceptGraph; node: ConceptNode; model: LearnerModel;
  neuronExperiment: ReturnType<typeof useNeuronExperiment>;
  tokenizerExperiment: ReturnType<typeof useTokenizerExperiment>;
  playing: boolean; onSelect: (id: string) => void;
  onPlayNeuron: () => void; onPlayTokenizer: () => void;
  onExplainNeuron: () => void; onExplainTokenizer: () => void;
};

/** Every link shown here is an immediate prerequisite edge, never a suggested curriculum edge. */
export function FocusedMap({ graph, node, model, playing, onSelect, onPlayNeuron, onPlayTokenizer, onExplainNeuron, onExplainTokenizer, neuronExperiment, tokenizerExperiment }: Props) {
  const parents = node.prerequisites.map(id => graph.nodes.find(n => n.id === id)!);
  const children = graph.nodes.filter(n => n.prerequisites.includes(node.id));
  const state = stateOf(model, node.id);

  function neighbour(n: ConceptNode) {
    const mark = stateOf(model, n.id);
    return <button key={n.id} onClick={() => onSelect(n.id)} className="focus-neighbour">
      <svg width={14} height={14} aria-hidden className="shrink-0"><NodeGlyph state={mark} cx={7} cy={7} colour={`var(--band-${n.band})`} /></svg>
      <span className="min-w-0 flex-1 text-left"><span className="block text-sm font-medium">{n.label}</span><span className="text-muted-foreground block text-xs">{STATE_COPY[mark]}</span></span>
      <ArrowRight size={15} aria-hidden />
    </button>;
  }

  return <div className="focus-map min-h-0 flex-1 overflow-y-auto pb-5 pr-1">
    <div className="mx-auto max-w-3xl">
      <div className="focus-connections">
        <p className="eyebrow">{parents.length ? 'Builds on' : 'The first connection starts here'}</p>
        {parents.length > 0 && <><div className={`mt-2 grid gap-2 ${parents.length > 1 ? 'sm:grid-cols-2' : ''}`}>{parents.map(neighbour)}</div><ArrowDown className="mx-auto my-3" size={18} aria-hidden /></>}
      </div>
      <div className={`focus-current mt-3 ${playing ? 'focus-current-playing' : ''}`} style={{ borderColor: `var(--band-${node.band})` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">In focus</p>
          <span className="inline-flex items-center gap-2 text-xs"><svg width={14} height={14} aria-hidden><NodeGlyph state={state} cx={7} cy={7} colour={`var(--band-${node.band})`} /></svg>{STATE_COPY[state]}</span>
        </div>
        <button onClick={() => onSelect(node.id)} className="group mt-3 block w-full text-left">
          <h2 className="font-display text-2xl">{node.label}</h2>
          {!playing && <span className="text-muted-foreground mt-1 block text-sm">{node.subtitle}</span>}
          {!playing && <span className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm underline underline-offset-4">Explore this idea <ArrowRight size={15} aria-hidden /></span>}
        </button>
      </div>

      {node.id === 'neuron' && playing && <div className="mt-4"><NeuronExperiment onExplain={onExplainNeuron} experiment={neuronExperiment} /></div>}
      {node.id === 'tokens' && playing && <div className="mt-4"><TokenizerExperiment onExplain={onExplainTokenizer} experiment={tokenizerExperiment} /></div>}

      <div className="focus-connections">
        {children.length > 0 ? <>
          <ArrowDown className="mx-auto my-3" size={18} aria-hidden />
          <p className="eyebrow">Builds into</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{children.map(neighbour)}</div>
          <p className="text-muted-foreground mt-3 text-xs">These ideas use this one. Each keeps its own mark and may have other prerequisites.</p>
        </> : <p className="text-muted-foreground mt-4 text-sm">This is an endpoint in this map. You can explore back along its connections.</p>}
      </div>

      {!playing && node.id === 'tokens' && <button onClick={onPlayTokenizer} className="playable-invitation playable-invitation-language mt-6 w-full text-left">
        <span className="eyebrow inline-flex items-center gap-2"><SlidersHorizontal size={15} aria-hidden />Try this idea</span>
        <span className="font-display mt-2 block text-2xl">What pieces does the model get?</span>
        <span className="mt-2 block text-sm">Type anything. See its actual token pieces and IDs change.</span>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">Open the tokenizer <ArrowRight size={16} aria-hidden /></span>
      </button>}

      {/* One invitation per view: on `tokens` its own experiment is the offer, so the
          general neuron invitation stands down rather than competing beneath it. */}
      {!playing && node.id !== 'tokens' && <button onClick={onPlayNeuron} className="playable-invitation mt-6 w-full text-left">
        <span className="eyebrow inline-flex items-center gap-2"><SlidersHorizontal size={15} aria-hidden />Try a playable idea</span>
        <span className="font-display mt-2 block text-2xl">What does a neuron actually do?</span>
        <span className="mt-2 block text-sm">Two inputs. One output. You control what happens in between.</span>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">Take it apart <ArrowRight size={16} aria-hidden /></span>
      </button>}
    </div>
  </div>;
}
