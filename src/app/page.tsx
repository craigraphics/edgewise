'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, motion } from 'motion/react';

import { ConceptMap } from '@/components/map/concept-map';
import { MapLegend } from '@/components/map/legend';
import { AppHeader, Position } from '@/components/shell/header';
import { type Mode } from '@/components/shell/mode-switch';
import { PanelSheet, type Snap } from '@/components/shell/panel-sheet';
import { Conversation } from '@/components/session/conversation';
import { Inspector, MARKS } from '@/components/session/inspector';
import { Setup, setupLabel } from '@/components/session/setup';
import { Welcome } from '@/components/session/welcome';
import { Walkthrough } from '@/components/session/walkthrough';
import { PHONE_QUERY, SHEET_QUERY, useMedia } from '@/hooks/use-media';
import { downstreamOf, leadNode, stateOf } from '@/lib/graph/frontier';
import { GRAPH } from '@/lib/graph/load';
import { coveredBy, teachingOrder } from '@/lib/graph/order';
import type { NodeState } from '@/lib/graph/types';
import { upgrade } from '@/lib/graph/upgrade';
import { useLearnerModel } from '@/lib/learner/store';
import { useSessionConfig } from '@/lib/session/config';
import { useSession } from '@/lib/session/use-session';
import { useWalkthrough } from '@/lib/walkthrough/store';

/**
 * The shell.
 *
 * Sized to the viewport and scrolled only on the inside. Measured before the
 * first rewrite: 498px of page scroll on a laptop, 387px of the map below the
 * fold, and on a tablet the entire interaction panel sat 800px down the page —
 * you could not tell it existed. Whatever is being said or shown has to stay
 * put while you are listening to it, so the header is fixed and only the two
 * content regions move.
 *
 * Two layouts now, not one with a fallback:
 *
 * - **Desktop (≥1280):** map left, panel right. As before.
 * - **Everything narrower:** the map takes the whole area and the panel is a
 *   sheet over it, dragged to whatever share of the screen the moment needs.
 *   Stacking them instead gave a tablet 530px of map under a panel that hid it,
 *   and a phone two unusable 250px halves.
 */

/**
 * Two things a visitor can do, and a drawer of tools that are not for them.
 *
 * `mark` is a wizard-of-oz harness for testing the diagnostic on someone by
 * hand. It is reached from the tools menu rather than sitting in the main
 * navigation, where it gave a first-time visitor three unlabelled choices where
 * there are really two.
 */
type View = Mode | 'mark';

export default function Page() {
  const { model, hydrated, mark, reset: resetMarks, loadFixture } = useLearnerModel(GRAPH);
  const { config, hydrated: configReady, save, forget } = useSessionConfig();
  const session = useSession(config, mark);

  const [view, setView] = useState<View>('session');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkNodeId, setWalkNodeId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /**
   * The sheet's height, as an override rather than as the value.
   *
   * Left as plain state it had to be corrected by an effect every time the
   * breakpoint changed, which is a cascading render to compute something that
   * is simply derived: a phone opens the panel over the map, a tablet shares
   * the screen with it. The override is what the learner has dragged it to, and
   * once they have expressed a preference it outranks the default.
   */
  const [snapOverride, setSnapOverride] = useState<Snap | null>(null);
  /**
   * Facilitator presentation mode.
   *
   * `AGENTS.md` has described this since the beginning — "press `f`, then turn
   * the screen around" — and calls it the mitigation for the largest risk in
   * the product: that being diagnosed feels like being graded. Watching someone
   * click "Not yet" against you is the most direct possible way to produce that
   * feeling. It had never actually been implemented.
   *
   * Derived against the view rather than reset by an effect, so leaving
   * facilitator mode cannot strand anyone in a screen with no controls on it.
   */
  const [presentingRequested, setPresentingRequested] = useState(false);

  const sheetLayout = useMedia(SHEET_QUERY);
  const phone = useMedia(PHONE_QUERY);

  const walk = useWalkthrough(GRAPH);
  const walkPosition = walk.position;
  const covered = useMemo(() => coveredBy(GRAPH, walkPosition), [walkPosition]);
  const order = useMemo(() => teachingOrder(GRAPH), []);

  const earn = useCallback(
    (nodeId: string, earned: NodeState) => {
      mark(nodeId, upgrade(stateOf(model, nodeId), earned));
    },
    [mark, model],
  );

  const lead = leadNode(GRAPH, model);
  /* The sentence the whole map exists to deliver, so the panel can say it too
     rather than making someone find the right node to click. */
  const leadDetail = useMemo(
    () =>
      lead
        ? { node: lead, state: stateOf(model, lead.id), resting: downstreamOf(GRAPH, lead.id).length }
        : null,
    [lead, model],
  );
  const selected = GRAPH.nodes.find((node) => node.id === selectedId) ?? null;
  const solid = useMemo(
    () => new Set(GRAPH.nodes.filter((node) => stateOf(model, node.id) === 'known').map((n) => n.id)),
    [model],
  );
  const started = solid.size > 0 || walkPosition > 0;

  /* What the conversation or the walk is on. Separate from what has been
     clicked open — see the note on `highlightedId` in the map. */
  const highlighted = view === 'session' ? session.nodeId : view === 'walk' ? walkNodeId : null;

  const snap = snapOverride ?? (phone ? 'full' : 'half');
  const presenting = presentingRequested && view === 'mark';

  /* Opening a node is an act of reading, so the sheet comes up to meet it —
     done here, where the opening happens, rather than in an effect watching
     for it afterwards. */
  const openNode = useCallback(
    (nodeId: string) => {
      setSelectedId(nodeId);
      setSnapOverride((current) => (current === 'peek' ? 'half' : current));
    },
    [],
  );

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;

      if (event.key === 'Escape') {
        // Leaves presentation mode first: it is the state you are most likely
        // to be stuck in, since every control that would take you out of it is
        // hidden by definition.
        if (presenting) setPresentingRequested(false);
        else setSelectedId(null);
        return;
      }

      if (view !== 'mark') return;

      /*
       * `f` hides every control, so the screen can be turned around.
       *
       * That is not tidiness. The largest risk in this product is that being
       * diagnosed feels like being graded, and watching someone click "Not yet"
       * against you is the most direct possible way to produce that feeling.
       */
      if (event.key === 'f') {
        setPresentingRequested((on) => !on);
        return;
      }

      if (!selectedId || presenting) return;

      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1 || slot > MARKS.length) return;
      mark(selectedId, MARKS[slot - 1]);
    },
    [mark, presenting, selectedId, view],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  /* The sheet is sized in pixels, so the region it sits in has to be measured. */
  const regionRef = useRef<HTMLDivElement>(null);
  const [regionHeight, setRegionHeight] = useState(0);
  useLayoutEffect(() => {
    const element = regionRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setRegionHeight(entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const panel = selected ? (
    <Inspector
      graph={GRAPH}
      node={selected}
      model={model}
      marking={view === 'mark'}
      presenting={presenting}
      reveal={view !== 'session' || session.status === 'idle' || session.status === 'done'}
      covered={covered.has(selected.id)}
      config={config}
      onEarned={earn}
      onMark={mark}
      onClose={() => setSelectedId(null)}
    />
  ) : view === 'walk' ? (
    <Walkthrough
      graph={GRAPH}
      model={model}
      config={config}
      onNodeChange={setWalkNodeId}
      onEarned={earn}
    />
  ) : view === 'session' ? (
    <Conversation
      messages={session.messages}
      status={session.status}
      error={session.error}
      firstTime={!started}
      onStart={() => session.start(model.states)}
      onAnswer={(text) => session.answer(text, model.states)}
      lead={leadDetail}
      onReset={() => {
        /*
         * Clears the marks too, not just the transcript.
         *
         * Resetting the conversation alone left every node the frontier had
         * opened still marked, and `nextToAsk` only ever offers `unexplored`
         * nodes — so the fresh session had nothing to ask and ended on its own
         * opening turn. Starting again has to mean the whole thing again, which
         * is the same action the tools menu calls Start over.
         */
        resetMarks();
        session.reset();
      }}
    />
  ) : (
    <p className="text-muted-foreground text-base leading-relaxed">
      Pick a node on the map to see its probes.
    </p>
  );

  return (
    // h-dvh + overflow-hidden: the page itself never scrolls, on any screen.
    <div className="bg-surface-0 flex h-dvh flex-col overflow-hidden">
      <Welcome />
      {/*
       * Rendered here rather than inside the tools menu: leaving it there meant
       * closing the menu unmounted the dialog in the same click, so it opened
       * and vanished instantly.
       */}
      {settingsOpen ? (
        <Setup onClose={() => setSettingsOpen(false)} config={config} onSave={save} onForget={forget} />
      ) : null}

      {presenting ? null : (
        <AppHeader
          graph={GRAPH}
          mode={view === 'mark' ? 'session' : view}
          onModeChange={(mode) => {
            setSelectedId(null);
            setView(mode);
          }}
          solid={solid}
          order={order}
          lead={lead}
          marking={view === 'mark'}
          onLeaveMarking={() => setView('session')}
          tools={[
            { label: 'Mark by hand (for testing)', onSelect: () => setView('mark') },
            { label: 'Load example progress', onSelect: loadFixture },
            {
              label: 'Start over',
              onSelect: () => {
                resetMarks();
                session.reset();
              },
            },
            ...(configReady
              ? [{ label: setupLabel(config), onSelect: () => setSettingsOpen(true), separated: true }]
              : []),
          ]}
        />
      )}

      <div
        ref={regionRef}
        className="relative mx-auto flex w-full min-h-0 max-w-[92rem] flex-1 xl:gap-6 xl:px-6"
      >
        <section
          aria-label="Concept map"
          /*
           * Below desktop the map fills the whole region and the panel floats
           * over it. At desktop it is a column of its own again.
           */
          /*
           * `min-w-0` is load-bearing, not tidiness. A flex item's automatic
           * minimum size is its content's min-content width, so without this
           * the map region could not shrink below the map — and narrowing the
           * window pushed the panel off the right-hand edge and cut it in half.
           */
          className="absolute inset-0 flex min-h-0 min-w-0 flex-col px-4 pt-3 sm:px-6 xl:relative xl:inset-auto xl:flex-1 xl:px-0"
        >
          {/*
           * The legend, above the map rather than below it.
           *
           * It used to sit under the full 1038px height of the drawing, inside
           * the drawing's own scroll container, so on a laptop you had to
           * scroll 250px past the last node to reach the only thing that
           * explained the marks. It also explained the six bands and not the
           * four states, which are what the product is actually about.
           */}
          {presenting ? null : <MapLegend graph={GRAPH} className="shrink-0 pb-2" />}

          <div className={hydrated ? 'contents' : 'contents opacity-0'}>
            <ConceptMap
              graph={GRAPH}
              model={model}
              onSelect={(node) => openNode(node.id)}
              selectedId={selectedId}
              highlightedId={highlighted}
              covered={covered}
              /* Beside the panel, legibility wins and the last units pan.
                 Under a sheet, the full width has to be visible — clipping a
                 column mid-node reads as a broken drawing. On a phone the map
                 is a backdrop, so the whole shape wins outright. */
              fit={phone ? 'all' : sheetLayout ? 'width' : 'legible'}
              quiet={started}
            />
          </div>
        </section>

        {sheetLayout ? (
          <PanelSheet
            snap={snap}
            onSnapChange={setSnapOverride}
            containerHeight={regionHeight}
            /*
             * Pinned over the bottom of the map rather than laid out beside it.
             * As an ordinary flex child it sat at the TOP of the row with the
             * map showing underneath, and — having no width of its own — grew
             * to the width of its longest unwrapped line and ran off the screen.
             */
            className="absolute inset-x-0 bottom-0"
          >
            {/* The position moves into the panel here: the header has no room
                for it at this width, and it is worth the space at any width. */}
            <Position
              graph={GRAPH}
              solid={solid}
              order={order}
              lead={lead}
              className="mb-3 flex shrink-0 lg:hidden"
            />
            <PanelBody view={view} selectedId={selectedId}>
              {panel}
            </PanelBody>
          </PanelSheet>
        ) : (
          /* `relative` so the voice halo, raised from inside the conversation,
             lights this panel's edges — including the divider it shares with
             the map — rather than the content box it is declared in. */
          <aside className="border-border relative flex min-h-0 w-[22rem] min-w-0 shrink-0 flex-col border-l py-4 pl-6 2xl:w-[26rem]">
            <PanelBody view={view} selectedId={selectedId}>
              {panel}
            </PanelBody>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Crossfades between the three things the panel can be.
 *
 * Switching mode used to snap, which read as a page replacement rather than as
 * the same surface showing something else — and the surrounding layout does not
 * move, so a replacement is exactly the wrong impression. A short crossfade with
 * a few pixels of rise says "same place, different content".
 *
 * `mode="wait"` so the outgoing panel is gone before the new one arrives. Both
 * present at once would double the voice hooks for a frame, and the sibling
 * project's three fighting audio loops started as exactly that kind of overlap.
 */
function PanelBody({
  view,
  selectedId,
  children,
}: {
  view: View;
  selectedId: string | null;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={selectedId ?? view}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -2 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
