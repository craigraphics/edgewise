'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ConceptMap } from '@/components/map/concept-map';
import { useNeuronExperiment } from '@/components/experiments/neuron-experiment';
import { useTokenizerExperiment } from '@/components/experiments/tokenizer-experiment';
import { usePredictorExperiment } from '@/components/experiments/predictor-experiment';
import { useRepresentationExperiment } from '@/components/experiments/representation-experiment';
import { usePhasesExperiment } from '@/components/experiments/phases-experiment';
import { useLossExperiment } from '@/components/experiments/loss-experiment';
import { useStepsExperiment } from '@/components/experiments/steps-experiment';
import { useGeneralizationExperiment } from '@/components/experiments/generalization-experiment';
import { useEmbeddingsExperiment } from '@/components/experiments/embeddings-experiment';
import { useHoldoutExperiment } from '@/components/experiments/holdout-experiment';
import { useParametersExperiment } from '@/components/experiments/parameters-experiment';
import { useBackpropExperiment } from '@/components/experiments/backprop-experiment';
import { useAttentionExperiment } from '@/components/experiments/attention-experiment';
import { useTransformerExperiment } from '@/components/experiments/transformer-experiment';
import { useContextExperiment } from '@/components/experiments/context-experiment';
import { useNextTokenExperiment } from '@/components/experiments/next-token-experiment';
import { useRagExperiment } from '@/components/experiments/rag-experiment';
import { useSamplingExperiment } from '@/components/experiments/sampling-experiment';
import { usePreferenceExperiment } from '@/components/experiments/preference-experiment';
import { useHallucinationExperiment } from '@/components/experiments/hallucination-experiment';
import { useToolUseExperiment } from '@/components/experiments/tool-use-experiment';
import { useAgentExperiment } from '@/components/experiments/agent-experiment';
import { FocusedMap } from '@/components/map/focused-map';
import { ConceptList } from '@/components/map/concept-list';
import { MapLegend } from '@/components/map/legend';
import { AppHeader } from '@/components/shell/header';
import { type Mode } from '@/components/shell/mode-switch';
import { Confirm } from '@/components/session/confirm';
import { Conversation } from '@/components/session/conversation';
import { Inspector, MARKS } from '@/components/session/inspector';
import { Setup, setupLabel } from '@/components/session/setup';
import { Walkthrough } from '@/components/session/walkthrough';
import { useHashRoute, writeHash } from '@/hooks/use-hash';
import { SHEET_QUERY, useMedia } from '@/hooks/use-media';
import { downstreamOf, leadNode, stateOf } from '@/lib/graph/frontier';
import { GRAPH } from '@/lib/graph/load';
import { coveredBy } from '@/lib/graph/order';
import { hashFor, parseDeepLink, type DeepLink } from '@/lib/map/deep-link';
import { MAP_SECTION, panelAlreadyShows, returnFocusSelector } from '@/lib/map/panel';
import type { NodeState } from '@/lib/graph/types';
import { upgrade } from '@/lib/graph/upgrade';
import { EMPTY_EXPLAIN_REQUESTS, EXPERIMENT_HEADLINE, EXPERIMENT_TITLE_ID, isExperimentId, type ExperimentId } from '@/lib/experiments/registry';
import { useLearnerModel } from '@/lib/learner/store';
import { CLEAR_MAP, LOAD_EXAMPLE } from '@/lib/session/confirmations';
import { useSessionConfig } from '@/lib/session/config';
import { useAllowance } from '@/lib/session/allowance';
import { lastQuestion } from '@/lib/session/stored-conversation';
import { useSession } from '@/lib/session/use-session';
import { useWalkthrough } from '@/lib/walkthrough/store';
import { cn } from '@/lib/utils';

type View = Mode | 'mark';

export default function Page() {
  const { model, hydrated, mark, reset: resetMarks, loadFixture } = useLearnerModel(GRAPH);
  const { config, hydrated: configReady, save, forget } = useSessionConfig();
  const session = useSession(config, mark);
  const allowance = useAllowance();
  const walk = useWalkthrough(GRAPH);
  const compact = useMedia(SHEET_QUERY);
  const [view, setView] = useState<View>('session');
  const [surface, setSurface] = useState<'map' | 'guide'>('guide');
  const [mapFormat, setMapFormat] = useState<'focus' | 'diagram' | 'list' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkNodeId, setWalkNodeId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirming, setConfirming] = useState<'clear' | 'example' | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [draft, setDraft] = useState('');
  const neuronExperiment = useNeuronExperiment();
  const tokenizerExperiment = useTokenizerExperiment();
  const predictorExperiment = usePredictorExperiment();
  const representationExperiment = useRepresentationExperiment();
  const phasesExperiment = usePhasesExperiment();
  const lossExperiment = useLossExperiment();
  const stepsExperiment = useStepsExperiment();
  const generalizationExperiment = useGeneralizationExperiment();
  const embeddingsExperiment = useEmbeddingsExperiment();
  const holdoutExperiment = useHoldoutExperiment();
  const parametersExperiment = useParametersExperiment();
  const backpropExperiment = useBackpropExperiment();
  const attentionExperiment = useAttentionExperiment();
  const transformerExperiment = useTransformerExperiment();
  const contextExperiment = useContextExperiment();
  const nextTokenExperiment = useNextTokenExperiment();
  const ragExperiment = useRagExperiment();
  const samplingExperiment = useSamplingExperiment();
  const preferenceExperiment = usePreferenceExperiment();
  const hallucinationExperiment = useHallucinationExperiment();
  const toolUseExperiment = useToolUseExperiment();
  const agentExperiment = useAgentExperiment();
  const [practice, setPractice] = useState<ExperimentId | null>(null);
  const [explainRequest, setExplainRequest] = useState(EMPTY_EXPLAIN_REQUESTS);
  const panelRef = useRef<HTMLElement>(null);
  /**
   * The idea the panel was opened from, so closing can hand focus back to it.
   *
   * An id and not the element itself. The focused view is keyed on the node it
   * draws, so the button that opened the panel is routinely replaced before it
   * can be focused again — the old element-reference version came back
   * disconnected and dropped focus on the map section instead. See
   * `returnFocusSelector`.
   */
  const returnFocus = useRef<string | null>(null);
  const covered = useMemo(() => coveredBy(GRAPH, walk.position), [walk.position]);
  const lead = leadNode(GRAPH, model);
  const selected = GRAPH.nodes.find(node => node.id === selectedId) ?? null;
  const marked = Object.values(model.states).some(state => state !== 'unexplored');
  const started = marked || walk.position > 0;
  const format = mapFormat ?? (view === 'mark' ? (compact ? 'list' : 'diagram') : 'focus');
  const leadDetail = lead ? { node: lead, state: stateOf(model, lead.id), resting: downstreamOf(GRAPH, lead.id).length } : null;
  const highlighted = view === 'session' ? session.nodeId : view === 'walk' ? walkNodeId : null;

  const focusNode = selected ?? GRAPH.nodes.find(node => node.id === highlighted) ?? lead ?? GRAPH.nodes[0];
  const playing = practice === focusNode.id && format === 'focus';
  const focusNodeIsOpen = panelAlreadyShows({ selectedId, nodeId: focusNode.id, compact, surface });

  const latestModel = useRef(model);
  useEffect(() => { latestModel.current = model; }, [model]);
  const earn = useCallback((id: string, earned: NodeState) => {
    mark(id, upgrade(stateOf(latestModel.current, id), earned));
  }, [mark]);

  /**
   * The hash the app itself last wrote, or last read out of the address bar.
   *
   * `replaceState` fires no event, so the subscription below never hears our
   * own writes. This is for the other direction: a delivery of a hash that has
   * already been acted on — a `popstate` back onto the place we are on, or the
   * repeated mount React does in development — must not re-run the move and
   * throw away where somebody had got to.
   */
  const appliedHash = useRef<string | null>(null);
  const goto = useCallback((link: DeepLink | null) => {
    const next = hashFor(link);
    appliedHash.current = next;
    writeHash(next);
  }, []);

  /*
   * Opening an idea's text leaves any experiment that was open.
   *
   * That mostly used to happen by itself, because selecting a different idea
   * moves the focused view off the one being played. It did not happen when
   * the idea was the same one — so `#idea/tokens`, typed while the tokenizer
   * was open, left the experiment running under a URL that said otherwise.
   * `playExperiment` sets it back immediately afterwards.
   */
  const openNode = useCallback((id: string) => {
    /*
     * Recorded on every open, not only the first. Walking idea to idea through
     * the inspector's prerequisite buttons used to leave this pointing at
     * whatever opened the panel several ideas ago.
     */
    returnFocus.current = id;
    setSelectedId(id);
    setPractice(null);
    setSurface('guide');
    goto({ kind: 'idea', id });
  }, [goto]);

  const playExperiment = (id: ExperimentId) => {
    setView('session');
    setPresenting(false);
    openNode(id);
    setPractice(id);
    setMapFormat('focus');
    setSurface('map');
    goto({ kind: 'play', id });
    requestAnimationFrame(() => {
      const title = document.getElementById(EXPERIMENT_TITLE_ID[id]);
      title?.focus();
      title?.scrollIntoView({ block: 'start' });
    });
  };

  const explainExperiment = (id: ExperimentId) => {
    setSelectedId(id);
    setExplainRequest(request => ({ ...request, [id]: request[id] + 1 }));
    setSurface('guide');
  };

  /** A link somebody opened, reloaded, pasted, or typed into the address bar. */
  useHashRoute(hash => {
    if (hash === appliedHash.current) return;
    appliedHash.current = hash;
    const requested = parseDeepLink(hash, GRAPH);
    if (requested?.kind === 'play') playExperiment(requested.id);
    else if (requested) openNode(requested.id);
  });

  const closeNode = useCallback(() => {
    // `practice` is deliberately left alone: on a wide screen the experiment
    // lives in the map pane and this button closes the guide beside it.
    /*
     * Flushed rather than deferred to an animation frame. The map is `hidden`
     * below the breakpoint while the guide is up, and `requestAnimationFrame`
     * is not a promise that React has committed — so the focus call could land
     * on a `display: none` element, silently do nothing, and leave focus on the
     * body. Committing first means the element exists when we reach for it.
     */
    flushSync(() => {
      setSelectedId(null);
      if (compact) setSurface('map');
    });
    goto(null);
    const target = document.querySelector<HTMLElement | SVGElement>(returnFocusSelector(returnFocus.current));
    (target ?? document.getElementById(MAP_SECTION))?.focus({ preventScroll: true });
  }, [compact, goto]);

  useEffect(() => {
    if (selectedId) panelRef.current?.querySelector<HTMLElement>('#concept-title')?.focus({ preventScroll: true });
  }, [selectedId]);

  const changeView = (next: Mode) => {
    setSelectedId(null);
    setView(next);
    setSurface('guide');
    setPresenting(false);
    goto(null);
  };

  /**
   * An experiment is only open in the focused view — `playing` is false in the
   * full map and the list — so switching away from it leaves the experiment
   * and switching back re-enters it. The address bar follows, rather than
   * going on claiming an experiment is open while the full map is on screen.
   */
  const changeFormat = (next: 'focus' | 'diagram' | 'list') => {
    setMapFormat(next);
    if (next === 'focus' && practice !== null && practice === focusNode.id) goto({ kind: 'play', id: practice });
    else if (playing) goto(selectedId ? { kind: 'idea', id: selectedId } : null);
  };

  /**
   * A new conversation, and nothing else. Marks are the learner's and survive.
   *
   * "Start a fresh conversation" used to call the full reset below, so the end
   * of a diagnostic — the moment the map is finally worth having — offered a
   * single unconfirmed press that erased it.
   */
  const newConversation = () => {
    session.reset();
    setDraft('');
  };

  /** Everything. Only ever reached through the `CLEAR_MAP` confirmation. */
  const clearMap = () => {
    resetMarks();
    newConversation();
    setSelectedId(null);
    setPractice(null);
    goto(null);
    neuronExperiment.reset();
    tokenizerExperiment.reset();
    predictorExperiment.reset();
    representationExperiment.reset();
    phasesExperiment.reset();
    lossExperiment.reset();
    stepsExperiment.reset();
    generalizationExperiment.reset();
    embeddingsExperiment.reset();
    holdoutExperiment.reset();
    parametersExperiment.reset();
    backpropExperiment.reset();
    attentionExperiment.reset();
    transformerExperiment.reset();
    contextExperiment.reset();
    nextTokenExperiment.reset();
    ragExperiment.reset();
    samplingExperiment.reset();
    preferenceExperiment.reset();
    hallucinationExperiment.reset();
    toolUseExperiment.reset();
    agentExperiment.reset();
    setExplainRequest(EMPTY_EXPLAIN_REQUESTS);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') || target?.closest('[role="dialog"]')) return;
      if (event.key === 'Escape') {
        if (presenting) setPresenting(false);
        else if (selectedId) closeNode();
      }
      if (view !== 'mark') return;
      if (event.key === 'f') setPresenting(on => !on);
      const slot = Number(event.key);
      if (!presenting && selectedId && Number.isInteger(slot) && slot >= 1 && slot <= MARKS.length) mark(selectedId, MARKS[slot - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeNode, mark, presenting, selectedId, view]);

  return (
    <div className="bg-surface-0 flex h-dvh flex-col overflow-hidden">
      {/*
        * Flushed, not deferred. Below the panel breakpoint both regions carry
        * `hidden` when they are not the visible surface, and focusing a
        * `display: none` element does nothing at all — which is what a skip
        * link landing on a section whose controls measure 0px looks like.
        */}
      <a className="skip-link" href="#guide" onClick={() => { flushSync(() => setSurface('guide')); panelRef.current?.focus(); }}>Skip to conversation</a>
      <a className="skip-link skip-link-second" href="#concept-map" onClick={() => { flushSync(() => setSurface('map')); document.getElementById(MAP_SECTION)?.focus(); }}>Skip to map</a>
      {settingsOpen && <Setup onClose={() => setSettingsOpen(false)} config={config} onSave={save} onForget={forget} />}
      {confirming && <Confirm
        copy={confirming === 'clear' ? CLEAR_MAP : LOAD_EXAMPLE}
        onConfirm={confirming === 'clear' ? clearMap : loadFixture}
        onClose={() => setConfirming(null)}
      />}
      {!presenting && <AppHeader
        mode={view === 'mark' ? 'session' : view}
        onModeChange={changeView}
        marking={view === 'mark'}
        onLeaveMarking={() => changeView('session')}
        tools={[
          ...(configReady ? [{ ...setupLabel(config, allowance.turnsLeft), onSelect: () => setSettingsOpen(true) }] : []),
          { label: 'Clear my map…', onSelect: () => setConfirming('clear'), separated: configReady },
          { label: 'Mark by hand (for testing)', onSelect: () => { setView('mark'); setSurface('map'); }, group: 'Testing' },
          { label: 'Load example progress (for testing)…', onSelect: () => setConfirming('example') },
        ]}
      />}
      {!presenting && <nav aria-label="Workspace" className="border-border flex shrink-0 border-b panel:hidden">
        {(['session', 'map', 'walk'] as const).map(item => <button
          key={item}
          aria-pressed={item === 'map' ? surface === 'map' : surface === 'guide' && view === item}
          onClick={() => item === 'map' ? setSurface('map') : item === 'session' && selected ? setSurface('guide') : changeView(item)}
          className={cn('min-h-12 flex-1 border-b-2 text-sm font-medium', (item === 'map' ? surface === 'map' : surface === 'guide' && view === item) ? 'border-foreground' : 'text-muted-foreground border-transparent')}
        >{item === 'map' ? 'Your map' : item === 'walk' ? 'Walkthrough' : selected ? 'This idea' : 'Conversation'}</button>)}
      </nav>}
      <main className="workspace mx-auto grid min-h-0 w-full max-w-[100rem] flex-1 panel:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        <section
          id="guide" ref={panelRef} tabIndex={-1} aria-label={selected ? 'Selected idea' : view === 'walk' ? 'Walkthrough' : 'Conversation'}
          className={cn('guide-panel min-h-0 min-w-0 flex-col overflow-y-auto p-5 sm:p-8 panel:col-start-2 panel:row-start-1 panel:border-l panel:border-border', compact && surface !== 'guide' && !presenting ? 'hidden' : 'flex')}
        >
          {selected ? <Inspector
            key={selected.id} graph={GRAPH} node={selected} model={model} marking={view === 'mark'} presenting={presenting}
            reveal={practice === selected.id || view !== 'session' || session.status === 'idle' || session.status === 'done'} covered={covered.has(selected.id)}
            config={config} onEarned={earn} onMark={mark} onClose={closeNode} onSelect={openNode}
            onPlay={isExperimentId(selected.id) ? () => playExperiment(selected.id as ExperimentId) : undefined}
            explainRequest={isExperimentId(selected.id) ? explainRequest[selected.id] : 0}
          /> : view === 'walk' ? <Walkthrough graph={GRAPH} model={model} config={config} onNodeChange={setWalkNodeId} onEarned={earn} /> : view === 'mark' ? (
            <div className="space-y-4">
              <p className="eyebrow">Facilitator tools</p>
              <h2 className="font-display text-2xl">Listen for the idea.</h2>
              <p className="text-muted-foreground text-base">Choose an idea to see its questions and mark what you hear.</p>
              <p className="text-sm">Keys 1–4 mark it. Press <kbd>f</kbd> to hide the controls before sharing the screen. Escape brings them back.</p>
            </div>
          ) : <Conversation
            key={session.conversation}
            messages={session.messages} status={session.status} error={session.error}
            // Keyed on marks, not on having visited: "the ideas already on your
            // map" said to somebody with nothing on it is not true.
            firstTime={!marked}
            resumable={session.resumable ? { question: lastQuestion(session.resumable) } : null}
            onResume={session.resume}
            onStartAgain={() => { newConversation(); void session.start(model.states); }}
            draft={draft} onDraftChange={setDraft}
            onStart={() => session.start(model.states)} onAnswer={text => session.answer(text, model.states)}
            onRetry={session.retry} onConfigure={() => setSettingsOpen(true)}
            onExplore={() => { if (lead) openNode(lead.id); else changeView('walk'); }}
            onWalk={() => changeView('walk')} onPlay={() => playExperiment('neuron')}
            lead={leadDetail} onNewConversation={newConversation} onClearMap={() => setConfirming('clear')}
          />}
        </section>
        <section id={MAP_SECTION} tabIndex={-1} aria-label="Concept map" className={cn('min-h-0 min-w-0 flex-col px-5 pt-5 pb-3 sm:px-8 panel:col-start-1 panel:row-start-1', compact && surface !== 'map' && !presenting ? 'hidden' : 'flex')}>
          {!presenting && <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={cn("eyebrow", playing && "hidden sm:block")}>A field guide to AI</p>
                <h1 className={cn("font-display mt-1 font-medium", playing ? "text-xl sm:text-2xl" : "text-2xl")}>{playing && isExperimentId(focusNode.id) ? EXPERIMENT_HEADLINE[focusNode.id] : 'Ideas build on ideas.'}</h1>
              </div>
              <div role="group" aria-label="Map view" className="border-border flex rounded-lg border p-1">
                {(['focus', 'diagram', 'list'] as const).map(item => <button key={item} aria-pressed={format === item} onClick={() => changeFormat(item)} className={cn('min-h-10 rounded-md px-3 text-sm', format === item ? 'bg-foreground text-background' : 'text-muted-foreground')}>{item === 'focus' ? 'Focus' : item === 'diagram' ? 'Full map' : 'List'}</button>)}
              </div>
            </div>
            <p className={cn("text-muted-foreground mb-4 text-sm", playing && "hidden sm:block")}>{format === 'focus' ? 'One idea and its closest connections. Follow any thread that interests you.' : format === 'diagram' ? 'Read from top to bottom. Select an idea to trace what builds on it.' : 'The same connections, in reading order. Select an idea to explore.'}</p>
            {format !== 'focus' && <MapLegend graph={GRAPH} className="border-border mb-4 border-b pb-4" />}
          </>}
          {hydrated && (format === 'focus' && !presenting ? <FocusedMap key={focusNode.id} graph={GRAPH} node={focusNode} model={model} neuronExperiment={neuronExperiment} tokenizerExperiment={tokenizerExperiment} predictorExperiment={predictorExperiment} representationExperiment={representationExperiment} phasesExperiment={phasesExperiment} lossExperiment={lossExperiment} stepsExperiment={stepsExperiment} generalizationExperiment={generalizationExperiment} embeddingsExperiment={embeddingsExperiment} holdoutExperiment={holdoutExperiment} parametersExperiment={parametersExperiment} backpropExperiment={backpropExperiment} attentionExperiment={attentionExperiment} transformerExperiment={transformerExperiment} contextExperiment={contextExperiment} nextTokenExperiment={nextTokenExperiment} ragExperiment={ragExperiment} samplingExperiment={samplingExperiment} preferenceExperiment={preferenceExperiment} hallucinationExperiment={hallucinationExperiment} toolUseExperiment={toolUseExperiment} agentExperiment={agentExperiment} playing={playing} alreadyOpen={focusNodeIsOpen} onSelect={openNode} onPlay={playExperiment} onExplain={explainExperiment} /> : format === 'list' && !presenting ? <ConceptList graph={GRAPH} model={model} selectedId={selectedId} onSelect={openNode} /> : <ConceptMap graph={GRAPH} model={model} onSelect={node => openNode(node.id)} selectedId={selectedId} highlightedId={highlighted} covered={covered} fit="legible" restOn={compact ? (lead?.id ?? null) : null} quiet={started} showControls={!presenting} />)}
          {!presenting && <p className="text-muted-foreground pt-3 text-xs">{format === 'focus' ? 'Every idea is open to explore · Full map shows all 23' : format === 'diagram' ? 'Scroll to move · Use + to zoom' : `${GRAPH.nodes.length} connected ideas · Saved in this browser`}</p>}
        </section>
      </main>
    </div>
  );
}
