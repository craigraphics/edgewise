'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConceptMap } from '@/components/map/concept-map';
import { ConceptList } from '@/components/map/concept-list';
import { MapLegend } from '@/components/map/legend';
import { AppHeader } from '@/components/shell/header';
import { type Mode } from '@/components/shell/mode-switch';
import { Conversation } from '@/components/session/conversation';
import { Inspector, MARKS } from '@/components/session/inspector';
import { Setup, setupLabel } from '@/components/session/setup';
import { Walkthrough } from '@/components/session/walkthrough';
import { SHEET_QUERY, useMedia } from '@/hooks/use-media';
import { downstreamOf, leadNode, stateOf } from '@/lib/graph/frontier';
import { GRAPH } from '@/lib/graph/load';
import { coveredBy } from '@/lib/graph/order';
import type { NodeState } from '@/lib/graph/types';
import { upgrade } from '@/lib/graph/upgrade';
import { useLearnerModel } from '@/lib/learner/store';
import { useSessionConfig } from '@/lib/session/config';
import { useSession } from '@/lib/session/use-session';
import { useWalkthrough } from '@/lib/walkthrough/store';
import { cn } from '@/lib/utils';

type View = Mode | 'mark';

export default function Page() {
  const { model, hydrated, mark, reset: resetMarks, loadFixture } = useLearnerModel(GRAPH);
  const { config, hydrated: configReady, save, forget } = useSessionConfig();
  const session = useSession(config, mark);
  const walk = useWalkthrough(GRAPH);
  const compact = useMedia(SHEET_QUERY);
  const [view, setView] = useState<View>('session');
  const [surface, setSurface] = useState<'map' | 'guide'>('guide');
  const [mapFormat, setMapFormat] = useState<'diagram' | 'list' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkNodeId, setWalkNodeId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [draft, setDraft] = useState('');
  const panelRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const covered = useMemo(() => coveredBy(GRAPH, walk.position), [walk.position]);
  const lead = leadNode(GRAPH, model);
  const selected = GRAPH.nodes.find(node => node.id === selectedId) ?? null;
  const started = Object.values(model.states).some(state => state !== 'unexplored') || walk.position > 0;
  const format = mapFormat ?? (compact ? 'list' : 'diagram');
  const leadDetail = lead ? { node: lead, state: stateOf(model, lead.id), resting: downstreamOf(GRAPH, lead.id).length } : null;
  const highlighted = view === 'session' ? session.nodeId : view === 'walk' ? walkNodeId : null;

  const earn = useCallback((id: string, earned: NodeState) => {
    mark(id, upgrade(stateOf(model, id), earned));
  }, [mark, model]);

  const openNode = useCallback((id: string) => {
    if (!selectedId) returnFocus.current = document.activeElement;
    setSelectedId(id);
    setSurface('guide');
  }, [selectedId]);

  const closeNode = useCallback(() => {
    setSelectedId(null);
    if (compact) setSurface('map');
    requestAnimationFrame(() => {
      const target = returnFocus.current;
      if (target instanceof HTMLElement || target instanceof SVGElement) target.focus({ preventScroll: true });
    });
  }, [compact]);

  useEffect(() => {
    if (selectedId) panelRef.current?.querySelector<HTMLElement>('#concept-title')?.focus({ preventScroll: true });
  }, [selectedId]);

  const changeView = (next: Mode) => {
    setSelectedId(null);
    setView(next);
    setSurface('guide');
    setPresenting(false);
  };

  const reset = () => {
    resetMarks();
    session.reset();
    setDraft('');
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
      <a className="skip-link" href="#guide" onClick={() => { setSurface('guide'); requestAnimationFrame(() => panelRef.current?.focus()); }}>Skip to conversation</a>
      <a className="skip-link" href="#concept-map" onClick={() => { setSurface('map'); requestAnimationFrame(() => document.getElementById('concept-map')?.focus()); }}>Skip to map</a>
      {settingsOpen && <Setup onClose={() => setSettingsOpen(false)} config={config} onSave={save} onForget={forget} />}
      {!presenting && <AppHeader
        mode={view === 'mark' ? 'session' : view}
        onModeChange={changeView}
        marking={view === 'mark'}
        onLeaveMarking={() => changeView('session')}
        tools={[
          { label: 'Mark by hand (for testing)', onSelect: () => { setView('mark'); setSurface('map'); } },
          { label: 'Load example progress', onSelect: loadFixture },
          { label: 'Start over', onSelect: reset },
          ...(configReady ? [{ label: setupLabel(config), onSelect: () => setSettingsOpen(true), separated: true }] : []),
        ]}
      />}
      {!presenting && <nav aria-label="Workspace" className="border-border flex shrink-0 border-b panel:hidden">
        {(['session', 'map', 'walk'] as const).map(item => <button
          key={item}
          aria-pressed={item === 'map' ? surface === 'map' : surface === 'guide' && view === item}
          onClick={() => item === 'map' ? setSurface('map') : changeView(item)}
          className={cn('min-h-12 flex-1 border-b-2 text-sm font-medium', (item === 'map' ? surface === 'map' : surface === 'guide' && view === item) ? 'border-foreground' : 'text-muted-foreground border-transparent')}
        >{item === 'map' ? 'Your map' : item === 'walk' ? 'Walkthrough' : 'Conversation'}</button>)}
      </nav>}
      <main className="workspace mx-auto grid min-h-0 w-full max-w-[100rem] flex-1 panel:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        <section
          id="guide" ref={panelRef} tabIndex={-1} aria-label={selected ? 'Selected idea' : view === 'walk' ? 'Walkthrough' : 'Conversation'}
          className={cn('guide-panel min-h-0 min-w-0 flex-col overflow-y-auto p-5 sm:p-8 panel:col-start-2 panel:row-start-1 panel:border-l panel:border-border', compact && surface !== 'guide' && !presenting ? 'hidden' : 'flex')}
        >
          {selected ? <Inspector
            key={selected.id} graph={GRAPH} node={selected} model={model} marking={view === 'mark'} presenting={presenting}
            reveal={view !== 'session' || session.status === 'idle' || session.status === 'done'} covered={covered.has(selected.id)}
            config={config} onEarned={earn} onMark={mark} onClose={closeNode} onSelect={openNode}
          /> : view === 'walk' ? <Walkthrough graph={GRAPH} model={model} config={config} onNodeChange={setWalkNodeId} onEarned={earn} /> : view === 'mark' ? (
            <div className="space-y-4">
              <p className="eyebrow">Facilitator tools</p>
              <h2 className="font-display text-2xl">Listen for the idea.</h2>
              <p className="text-muted-foreground text-base">Choose an idea to see its questions and mark what you hear.</p>
              <p className="text-sm">Keys 1–4 mark it. Press <kbd>f</kbd> to hide the controls before sharing the screen. Escape brings them back.</p>
            </div>
          ) : <Conversation
            messages={session.messages} status={session.status} error={session.error} firstTime={!started}
            draft={draft} onDraftChange={setDraft}
            onStart={() => session.start(model.states)} onAnswer={text => session.answer(text, model.states)}
            onRetry={session.retry} onConfigure={() => setSettingsOpen(true)}
            onExplore={() => { if (lead) openNode(lead.id); else changeView('walk'); }}
            onWalk={() => changeView('walk')}
            lead={leadDetail} onReset={reset}
          />}
        </section>
        <section id="concept-map" tabIndex={-1} aria-label="Concept map" className={cn('min-h-0 min-w-0 flex-col px-5 pt-5 pb-3 sm:px-8 panel:col-start-1 panel:row-start-1', compact && surface !== 'map' && !presenting ? 'hidden' : 'flex')}>
          {!presenting && <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">A field guide to AI</p>
                <h1 className="font-display mt-1 text-2xl font-medium">Ideas build on ideas.</h1>
              </div>
              <div role="group" aria-label="Map view" className="border-border flex rounded-lg border p-1">
                {(['diagram', 'list'] as const).map(item => <button key={item} aria-pressed={format === item} onClick={() => setMapFormat(item)} className={cn('min-h-9 rounded-md px-3 text-sm', format === item ? 'bg-foreground text-background' : 'text-muted-foreground')}>{item === 'diagram' ? 'Map' : 'List'}</button>)}
              </div>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">{format === 'diagram' ? 'Read from top to bottom. Select an idea to trace what builds on it.' : 'The same connections, in reading order. Select an idea to explore.'}</p>
            <MapLegend graph={GRAPH} className="border-border mb-4 border-b pb-4" />
          </>}
          {hydrated && (format === 'list' && !presenting ? <ConceptList graph={GRAPH} model={model} selectedId={selectedId} onSelect={openNode} /> : <ConceptMap graph={GRAPH} model={model} onSelect={node => openNode(node.id)} selectedId={selectedId} highlightedId={highlighted} covered={covered} fit={compact ? 'width' : 'legible'} quiet={started} showControls={!presenting} />)}
          {!presenting && <p className="text-muted-foreground pt-3 text-xs">{format === 'diagram' ? 'Scroll to move · Use + to zoom' : `${GRAPH.nodes.length} connected ideas · Saved in this browser`}</p>}
        </section>
      </main>
    </div>
  );
}
