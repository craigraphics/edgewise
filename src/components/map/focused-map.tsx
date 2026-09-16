'use client';

import { ArrowDown, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { NodeGlyph } from './node-glyph';
import { NeuronExperiment, type useNeuronExperiment } from '@/components/experiments/neuron-experiment';
import { TokenizerExperiment, type useTokenizerExperiment } from '@/components/experiments/tokenizer-experiment';
import { PredictorExperiment, type usePredictorExperiment } from '@/components/experiments/predictor-experiment';
import { RepresentationExperiment, type useRepresentationExperiment } from '@/components/experiments/representation-experiment';
import { PhasesExperiment, type usePhasesExperiment } from '@/components/experiments/phases-experiment';
import { LossExperiment, type useLossExperiment } from '@/components/experiments/loss-experiment';
import { StepsExperiment, type useStepsExperiment } from '@/components/experiments/steps-experiment';
import { GeneralizationExperiment, type useGeneralizationExperiment } from '@/components/experiments/generalization-experiment';
import { EmbeddingsExperiment, type useEmbeddingsExperiment } from '@/components/experiments/embeddings-experiment';
import { HoldoutExperiment, type useHoldoutExperiment } from '@/components/experiments/holdout-experiment';
import { ParametersExperiment, type useParametersExperiment } from '@/components/experiments/parameters-experiment';
import { BackpropExperiment, type useBackpropExperiment } from '@/components/experiments/backprop-experiment';
import { AttentionExperiment, type useAttentionExperiment } from '@/components/experiments/attention-experiment';
import { TransformerExperiment, type useTransformerExperiment } from '@/components/experiments/transformer-experiment';
import { ContextExperiment, type useContextExperiment } from '@/components/experiments/context-experiment';
import { NextTokenExperiment, type useNextTokenExperiment } from '@/components/experiments/next-token-experiment';
import { RagExperiment, type useRagExperiment } from '@/components/experiments/rag-experiment';
import { SamplingExperiment, type useSamplingExperiment } from '@/components/experiments/sampling-experiment';
import { PreferenceExperiment, type usePreferenceExperiment } from '@/components/experiments/preference-experiment';
import { HallucinationExperiment, type useHallucinationExperiment } from '@/components/experiments/hallucination-experiment';
import { ToolUseExperiment, type useToolUseExperiment } from '@/components/experiments/tool-use-experiment';
import { AgentExperiment, type useAgentExperiment } from '@/components/experiments/agent-experiment';
import { STATE_COPY } from '@/components/session/inspector';
import { stateOf } from '@/lib/graph/frontier';
import { EXPERIMENT_ACTION, isExperimentId, type ExperimentId } from '@/lib/experiments/registry';
import type { ConceptGraph, ConceptNode, LearnerModel } from '@/lib/graph/types';
import { cn } from '@/lib/utils';

type Props = {
  graph: ConceptGraph; node: ConceptNode; model: LearnerModel;
  neuronExperiment: ReturnType<typeof useNeuronExperiment>;
  tokenizerExperiment: ReturnType<typeof useTokenizerExperiment>;
  predictorExperiment: ReturnType<typeof usePredictorExperiment>;
  representationExperiment: ReturnType<typeof useRepresentationExperiment>;
  phasesExperiment: ReturnType<typeof usePhasesExperiment>;
  lossExperiment: ReturnType<typeof useLossExperiment>;
  stepsExperiment: ReturnType<typeof useStepsExperiment>;
  generalizationExperiment: ReturnType<typeof useGeneralizationExperiment>;
  embeddingsExperiment: ReturnType<typeof useEmbeddingsExperiment>;
  holdoutExperiment: ReturnType<typeof useHoldoutExperiment>;
  parametersExperiment: ReturnType<typeof useParametersExperiment>;
  backpropExperiment: ReturnType<typeof useBackpropExperiment>;
  attentionExperiment: ReturnType<typeof useAttentionExperiment>;
  transformerExperiment: ReturnType<typeof useTransformerExperiment>;
  contextExperiment: ReturnType<typeof useContextExperiment>;
  nextTokenExperiment: ReturnType<typeof useNextTokenExperiment>;
  ragExperiment: ReturnType<typeof useRagExperiment>;
  samplingExperiment: ReturnType<typeof useSamplingExperiment>;
  preferenceExperiment: ReturnType<typeof usePreferenceExperiment>;
  hallucinationExperiment: ReturnType<typeof useHallucinationExperiment>;
  toolUseExperiment: ReturnType<typeof useToolUseExperiment>;
  agentExperiment: ReturnType<typeof useAgentExperiment>;
  playing: boolean;
  /** The panel is already showing this idea, so offering to open it would do nothing. */
  alreadyOpen: boolean;
  onSelect: (id: string) => void;
  onPlay: (id: ExperimentId) => void;
  onExplain: (id: ExperimentId) => void;
};

/**
 * One invitation per view. The concept in focus offers its own experiment; only
 * where there is none does the general neuron invitation stand in, so two
 * unrelated calls to action never stack.
 */
const INVITATIONS: Record<ExperimentId, { tint: string; title: string; blurb: string; action: string }> = {
  neuron: { tint: '', title: 'How does one neuron score a movie?', blurb: 'Give two movie traits more or less influence, then watch them become one match score.', action: 'Score a movie' },
  tokens: { tint: 'playable-invitation-language', title: 'What pieces does the model get?', blurb: 'Type anything. See its actual token pieces and IDs change.', action: 'Open the tokenizer' },
  'prediction-from-examples': { tint: 'playable-invitation-foundations', title: 'Can past food deliveries predict the next one?', blurb: 'Fit a delivery-time rule, change how long one order took, and see the next prediction change.', action: 'Try the experiment' },
  'features-and-representation': { tint: 'playable-invitation-foundations', title: 'How can an H and a T become the same number?', blurb: 'Follow two pixel letters into the model, then change which details their numbers preserve.', action: 'Open the playground' },
  'training-vs-inference': { tint: 'playable-invitation-foundations', title: 'If the answer changes, did it learn something?', blurb: 'Change a customer’s distance and the delivery estimate moves. The rule behind it does not.', action: 'Try the experiment' },
  loss: { tint: 'playable-invitation-learning', title: 'Are all wrong answers equally wrong?', blurb: 'A delivery took 30 minutes. Two guesses were wrong. Move one closer and watch what changes.', action: 'Try the experiment' },
  'gradient-descent': { tint: 'playable-invitation-learning', title: 'How can a model improve an answer a little at a time?', blurb: 'A guess of 40 minutes, for a delivery that took 30. Take one step and watch it move.', action: 'Take one step' },
  'generalization-overfitting': { tint: 'playable-invitation-learning', title: 'Can a perfect score still lead to bad guesses?', blurb: 'Two rules learn from the same five phone sales. One follows the low price of a cracked phone. See what happens on four new sales.', action: 'Try the experiment' },
  embeddings: { tint: 'playable-invitation-language', title: 'Which words might belong together?', blurb: 'Pick a word and see which words sit nearest to it, worked out from nothing but lists of numbers.', action: 'Pick a word' },
  'train-test-split': { tint: 'playable-invitation-learning', title: 'Can we trust a result we helped choose?', blurb: 'Teach a junk-mail filter from six messages, make one real trade-off, then check it on four answers you did not use.', action: 'Try the experiment' },
  'parameters-scale': { tint: '', title: 'When a model learns, what does it actually keep?', blurb: 'A bike rental shop keeps two numbers. Change one and the price moves. Change the customer and it moves for a different reason.', action: 'Change a saved number' },
  'backprop-intuition': { tint: '', title: 'If the final amount is wrong, how do we work back to the earlier settings?', blurb: 'A plant received more water than the model expected. Work backward to see which way its two saved estimates should move.', action: 'Work back from the difference' },
  attention: { tint: 'playable-invitation-language', title: 'How can the words around “bank” change what it means here?', blurb: 'One sentence walks to a riverbank, the other takes cash to a bank. Watch the same word’s description move.', action: 'Try the experiment' },
  transformer: { tint: 'playable-invitation-language', title: 'How do a few simple steps work together on a sentence?', blurb: 'A short note about pets. Run one block and watch the last word’s numbers change twice — once from the words before it, once from the calculation after.', action: 'Run one block' },
  'context-window': { tint: 'playable-invitation-behaviour', title: 'If it is still in the chat, why can’t the model use it?', blurb: 'A party chat with a door code in it. Add a few more notes and watch the code drop out of what actually gets sent.', action: 'Add more party notes' },
  'next-token-prediction': { tint: 'playable-invitation-language', title: 'How can choosing one small piece at a time build a whole sentence?', blurb: 'A bedtime story has started. See what could come next, add the most likely piece, and watch the model ask again from the longer story.', action: 'Add the next piece' },
  rag: { tint: 'playable-invitation-systems', title: 'How can AI answer from a notice it was never trained on?', blurb: 'A swimming pool with five dated notices. Search them, hand one over, and watch the answer change when the notice does.', action: 'Search the notices' },
  'sampling-temperature': { tint: 'playable-invitation-language', title: 'Why can the same beginning get a different next word?', blurb: 'One sentence, three possible endings, a chance each. Pick a few times, then change how much the usual ending is favoured.', action: 'Pick an ending' },
  'pretraining-vs-posttraining': { tint: 'playable-invitation-behaviour', title: 'Why does it answer, instead of adding more questions?', blurb: 'Three replies to a flat tyre, written in advance. Show a tiny model which one you prefer and watch how likely each one becomes.', action: 'Show it which reply you prefer' },
  hallucination: { tint: 'playable-invitation-behaviour', title: 'Does sounding right mean the detail was checked?', blurb: 'A polished description gives an exhibit a year. Compare it with the invented museum record beside it.', action: 'Check the description' },
  'tool-use': { tint: 'playable-invitation-systems', title: 'If a model makes text, who does the actual calculation?', blurb: 'Follow one shelf-building calculation from a structured request, through app code, and back into an answer.', action: 'Run the calculator' },
  agents: { tint: 'playable-invitation-systems', title: 'What turns one tool call into working towards a goal?', blurb: 'A library, a goal, and one step at a time. Watch each result decide what happens next, until two matching books are confirmed.', action: 'Take the first step' },
};

/** Every link shown here is an immediate prerequisite edge, never a suggested curriculum edge. */
export function FocusedMap({ graph, node, model, playing, alreadyOpen, onSelect, onPlay, onExplain, neuronExperiment, tokenizerExperiment, predictorExperiment, representationExperiment, phasesExperiment, lossExperiment, stepsExperiment, generalizationExperiment, embeddingsExperiment, holdoutExperiment, parametersExperiment, backpropExperiment, attentionExperiment, transformerExperiment, contextExperiment, nextTokenExperiment, ragExperiment, samplingExperiment, preferenceExperiment, hallucinationExperiment, toolUseExperiment, agentExperiment }: Props) {
  const invited: ExperimentId = isExperimentId(node.id) ? node.id : 'neuron';
  const invitation = INVITATIONS[invited];
  const parents = node.prerequisites.map(id => graph.nodes.find(n => n.id === id)!);
  const children = graph.nodes.filter(n => n.prerequisites.includes(node.id));
  const state = stateOf(model, node.id);

  /*
   * A neighbour that has an experiment offers it here, rather than only after
   * you have navigated onto that idea and scrolled to the bottom of its view.
   * It is a second control, not a second invitation: the accessible name says
   * which experiment, so it never reads as an unlabelled "try" beside a
   * heading it does not belong to.
   */
  function neighbour(n: ConceptNode) {
    const mark = stateOf(model, n.id);
    const playable: ExperimentId | null = isExperimentId(n.id) ? n.id : null;
    return <div key={n.id} className="focus-neighbour">
      <button onClick={() => onSelect(n.id)} className="focus-neighbour-open">
        <svg width={14} height={14} aria-hidden className="shrink-0"><NodeGlyph state={mark} cx={7} cy={7} colour={`var(--band-${n.band})`} /></svg>
        <span className="min-w-0 flex-1 text-left"><span className="block text-sm font-medium">{n.label}</span><span className="text-muted-foreground block text-xs">{STATE_COPY[mark]}</span></span>
        <ArrowRight size={15} aria-hidden className="shrink-0" />
      </button>
      {playable && <button
        onClick={() => onPlay(playable)}
        aria-label={EXPERIMENT_ACTION[playable]}
        className="focus-neighbour-play"
      >
        <SlidersHorizontal size={14} aria-hidden />
        <span aria-hidden>Try it</span>
      </button>}
    </div>;
  }

  /*
   * The offer itself, placed by the caller below.
   *
   * When the idea in focus has its own experiment the offer sits directly
   * under it, because that is where the eye already is — measured at 1230x842
   * it used to start 576px below the panel title, with its action entirely off
   * the bottom of the window. The general neuron invitation still comes last,
   * where it cannot compete with the idea actually being read.
   */
  const offer = <button onClick={() => onPlay(invited)} className={cn('playable-invitation w-full text-left', invitation.tint)}>
    <span className="eyebrow inline-flex items-center gap-2"><SlidersHorizontal size={15} aria-hidden />{isExperimentId(node.id) ? 'Try this idea' : 'Try a playable idea'}</span>
    <span className="font-display mt-2 block text-2xl">{invitation.title}</span>
    <span className="mt-2 block text-sm">{invitation.blurb}</span>
    <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">{invitation.action} <ArrowRight size={16} aria-hidden /></span>
  </button>;

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
        {/*
          * A heading once the panel is already showing this idea, and a way in
          * only while there is somewhere to go. Selecting the idea that is
          * already selected changed nothing on screen, so the offer was dead in
          * every state after the first press.
          */}
        {alreadyOpen ? <div className="mt-3">
          <h2 className="font-display text-2xl">{node.label}</h2>
          {!playing && <p className="text-muted-foreground mt-1 text-sm">{node.subtitle}</p>}
        </div> : <button onClick={() => onSelect(node.id)} className="group mt-3 block w-full text-left">
          <h2 className="font-display text-2xl">{node.label}</h2>
          {!playing && <span className="text-muted-foreground mt-1 block text-sm">{node.subtitle}</span>}
          {!playing && <span className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm underline underline-offset-4">Explore this idea <ArrowRight size={15} aria-hidden /></span>}
        </button>}
      </div>

      {playing && node.id === 'neuron' && <div className="mt-4"><NeuronExperiment onExplain={() => onExplain('neuron')} experiment={neuronExperiment} /></div>}
      {playing && node.id === 'tokens' && <div className="mt-4"><TokenizerExperiment onExplain={() => onExplain('tokens')} experiment={tokenizerExperiment} /></div>}
      {playing && node.id === 'prediction-from-examples' && <div className="mt-4"><PredictorExperiment onExplain={() => onExplain('prediction-from-examples')} experiment={predictorExperiment} /></div>}
      {playing && node.id === 'features-and-representation' && <div className="mt-4"><RepresentationExperiment onExplain={() => onExplain('features-and-representation')} experiment={representationExperiment} /></div>}
      {playing && node.id === 'training-vs-inference' && <div className="mt-4"><PhasesExperiment onExplain={() => onExplain('training-vs-inference')} experiment={phasesExperiment} /></div>}
      {playing && node.id === 'loss' && <div className="mt-4"><LossExperiment onExplain={() => onExplain('loss')} experiment={lossExperiment} /></div>}
      {playing && node.id === 'gradient-descent' && <div className="mt-4"><StepsExperiment onExplain={() => onExplain('gradient-descent')} experiment={stepsExperiment} /></div>}
      {playing && node.id === 'generalization-overfitting' && <div className="mt-4"><GeneralizationExperiment onExplain={() => onExplain('generalization-overfitting')} experiment={generalizationExperiment} /></div>}
      {playing && node.id === 'embeddings' && <div className="mt-4"><EmbeddingsExperiment onExplain={() => onExplain('embeddings')} experiment={embeddingsExperiment} /></div>}
      {playing && node.id === 'train-test-split' && <div className="mt-4"><HoldoutExperiment onExplain={() => onExplain('train-test-split')} experiment={holdoutExperiment} /></div>}
      {playing && node.id === 'parameters-scale' && <div className="mt-4"><ParametersExperiment onExplain={() => onExplain('parameters-scale')} experiment={parametersExperiment} /></div>}
      {playing && node.id === 'backprop-intuition' && <div className="mt-4"><BackpropExperiment onExplain={() => onExplain('backprop-intuition')} experiment={backpropExperiment} /></div>}
      {playing && node.id === 'attention' && <div className="mt-4"><AttentionExperiment onExplain={() => onExplain('attention')} experiment={attentionExperiment} /></div>}
      {playing && node.id === 'transformer' && <div className="mt-4"><TransformerExperiment onExplain={() => onExplain('transformer')} experiment={transformerExperiment} /></div>}
      {playing && node.id === 'context-window' && <div className="mt-4"><ContextExperiment onExplain={() => onExplain('context-window')} experiment={contextExperiment} /></div>}
      {playing && node.id === 'next-token-prediction' && <div className="mt-4"><NextTokenExperiment onExplain={() => onExplain('next-token-prediction')} experiment={nextTokenExperiment} /></div>}
      {playing && node.id === 'rag' && <div className="mt-4"><RagExperiment onExplain={() => onExplain('rag')} experiment={ragExperiment} /></div>}
      {playing && node.id === 'sampling-temperature' && <div className="mt-4"><SamplingExperiment onExplain={() => onExplain('sampling-temperature')} experiment={samplingExperiment} /></div>}
      {playing && node.id === 'pretraining-vs-posttraining' && <div className="mt-4"><PreferenceExperiment onExplain={() => onExplain('pretraining-vs-posttraining')} experiment={preferenceExperiment} /></div>}
      {playing && node.id === 'hallucination' && <div className="mt-4"><HallucinationExperiment onExplain={() => onExplain('hallucination')} experiment={hallucinationExperiment} /></div>}
      {playing && node.id === 'tool-use' && <div className="mt-4"><ToolUseExperiment onExplain={() => onExplain('tool-use')} experiment={toolUseExperiment} /></div>}
      {playing && node.id === 'agents' && <div className="mt-4"><AgentExperiment onExplain={() => onExplain('agents')} experiment={agentExperiment} /></div>}

      {!playing && isExperimentId(node.id) && <div className="mt-4">{offer}</div>}

      <div className="focus-connections">
        {children.length > 0 ? <>
          <ArrowDown className="mx-auto my-3" size={18} aria-hidden />
          <p className="eyebrow">Builds into</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{children.map(neighbour)}</div>
          <p className="text-muted-foreground mt-3 text-xs">These ideas use this one. Each keeps its own mark and may have other prerequisites.</p>
        </> : <p className="text-muted-foreground mt-4 text-sm">This is an endpoint in this map. You can explore back along its connections.</p>}
      </div>

      {!playing && !isExperimentId(node.id) && <div className="mt-6">{offer}</div>}
    </div>
  </div>;
}
