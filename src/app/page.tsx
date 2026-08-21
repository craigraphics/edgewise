'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { MenuIcon } from 'lucide-react';

import { ConceptMap } from '@/components/map/concept-map';
import { Conversation } from '@/components/session/conversation';
import { Inspector, MARKS } from '@/components/session/inspector';
import { Setup, setupLabel } from '@/components/session/setup';
import { ThemeToggle } from '@/components/theme-toggle';
import { Welcome } from '@/components/session/welcome';
import { Walkthrough } from '@/components/session/walkthrough';
import { Button } from '@/components/ui/button';
import { leadNode, progress, stateOf } from '@/lib/graph/frontier';
import { GRAPH } from '@/lib/graph/load';
import { coveredBy } from '@/lib/graph/order';
import type { NodeState } from '@/lib/graph/types';
import { upgrade } from '@/lib/graph/upgrade';
import { useLearnerModel } from '@/lib/learner/store';
import { useSessionConfig } from '@/lib/session/config';
import { useSession } from '@/lib/session/use-session';
import { useWalkthrough } from '@/lib/walkthrough/store';

/**
 * The shell.
 *
 * Sized to the viewport and scrolled only on the inside. Measured before this
 * rewrite: 498px of page scroll on a laptop, 387px of the map below the fold,
 * and on a tablet the entire interaction panel sat 800px down the page — you
 * could not tell it existed. Whatever is being said or shown has to stay put
 * while you are listening to it, so the header and the controls are fixed and
 * only the two content regions move.
 */

/**
 * Two things a visitor can do, and a drawer of tools that are not for them.
 *
 * `mark` is a wizard-of-oz harness for testing the diagnostic on someone by
 * hand. It was sitting in the main navigation next to the two real modes, which
 * gave a first-time visitor three unlabelled choices where there are really
 * two.
 */
type View = 'session' | 'walk' | 'mark' | 'show';

export default function Page() {
  const { model, hydrated, mark, reset: resetMarks, loadFixture } = useLearnerModel(GRAPH);
  const { config, hydrated: configReady, save, forget } = useSessionConfig();
  const session = useSession(config, mark);

  const [view, setView] = useState<View>('session');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkNodeId, setWalkNodeId] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const walkPosition = useWalkthrough(GRAPH).position;
  const covered = useMemo(() => coveredBy(GRAPH, walkPosition), [walkPosition]);

  const earn = useCallback(
    (nodeId: string, earned: NodeState) => {
      mark(nodeId, upgrade(stateOf(model, nodeId), earned));
    },
    [mark, model],
  );

  const lead = leadNode(GRAPH, model);
  const selected = GRAPH.nodes.find((node) => node.id === selectedId) ?? null;
  const { known, total } = progress(GRAPH, model);
  const started = known > 0 || walkPosition > 0;

  const highlighted =
    selectedId ?? (view === 'session' ? session.nodeId : view === 'walk' ? walkNodeId : null);

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;

      if (event.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if (view !== 'mark' || !selectedId) return;

      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1 || slot > MARKS.length) return;
      mark(selectedId, MARKS[slot - 1]);
    },
    [mark, selectedId, view],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const showing = view === 'show';

  return (
    // h-dvh + overflow-hidden: the page itself never scrolls, on any screen.
    <div className="flex h-dvh flex-col overflow-hidden">
      <Welcome />
      {/*
       * Rendered here rather than inside the dropdown: leaving it in the menu
       * meant closing the menu unmounted the dialog in the same click, so it
       * opened and vanished instantly.
       */}
      {settingsOpen ? (
        <Setup onClose={() => setSettingsOpen(false)} config={config} onSave={save} onForget={forget} />
      ) : null}
      <header className="border-border shrink-0 border-b px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight">{GRAPH.subject}</h1>
              {/* Aligned on the title's baseline and set not to shrink, so a
                  narrow window truncates the subject rather than the byline. */}
              <span className="text-muted-foreground shrink-0 text-xs">by William Craig</span>
            </div>
            {/*
             * The one line that must never scroll away: where you are, and what
             * the map currently says is worth having next.
             */}
            <p className="text-muted-foreground truncate text-xs">
              {known} of {total} solid
              {lead ? (
                <>
                  {' · next: '}
                  <span className="text-foreground font-medium">{lead.label}</span>
                </>
              ) : null}
            </p>
          </div>

          {showing ? (
            <Button variant="outline" size="touch" className="ml-auto" onClick={() => setView('mark')}>
              Back to marking
            </Button>
          ) : (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/*
               * Two choices, each saying what happens rather than naming a mode.
               * "Session" and "Walk me through it" sat side by side as equals
               * and neither told a first-time visitor what it would do.
               */}
              <Button
                variant={view === 'session' ? 'default' : 'outline'}
                size="touch"
                onClick={() => setView('session')}
              >
                Find my starting point
              </Button>
              <Button
                variant={view === 'walk' ? 'default' : 'outline'}
                size="touch"
                onClick={() => setView('walk')}
              >
                Teach me everything
              </Button>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Settings and tools"
                  aria-expanded={toolsOpen}
                  onClick={() => setToolsOpen((open) => !open)}
                >
                  <MenuIcon />
                </Button>
                {toolsOpen ? (
                  <div className="border-border bg-popover absolute right-0 z-50 mt-1 w-56 rounded-lg border p-1 shadow-lg">
                    <ToolButton
                      onClick={() => {
                        setView('mark');
                        setToolsOpen(false);
                      }}
                    >
                      Mark by hand (for testing)
                    </ToolButton>
                    <ToolButton
                      onClick={() => {
                        loadFixture();
                        setToolsOpen(false);
                      }}
                    >
                      Load example progress
                    </ToolButton>
                    <ToolButton
                      onClick={() => {
                        resetMarks();
                        session.reset();
                        setToolsOpen(false);
                      }}
                    >
                      Start over
                    </ToolButton>
                    {configReady ? (
                      <div className="border-border mt-1 border-t pt-1">
                        <ToolButton
                          onClick={() => {
                            setToolsOpen(false);
                            setSettingsOpen(true);
                          }}
                        >
                          {setupLabel(config)}
                        </ToolButton>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <ThemeToggle />
            </div>
          )}
        </div>
      </header>

      {/*
       * Panel first in the DOM so that when the two stack on a tablet, the part
       * you act in is what you land on. Measured before: it sat 800px below the
       * fold, under a map that gave no hint anything followed it.
       */}
      <div className="mx-auto flex w-full min-h-0 max-w-[92rem] flex-1 flex-col-reverse gap-0 lg:flex-row lg:gap-6 lg:px-6">
        <section
          aria-label="Concept map"
          className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6 lg:px-0"
        >
          <div className={hydrated ? undefined : 'opacity-0'}>
            <ConceptMap
              graph={GRAPH}
              model={model}
              onSelect={(node) => setSelectedId(node.id)}
              selectedId={highlighted}
              covered={covered}
            />
          </div>
          <div className="text-muted-foreground mt-5 flex flex-wrap gap-x-4 gap-y-2 pb-2 text-xs">
            {GRAPH.bands.map((band) => (
              <span key={band.id} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: `var(--band-${band.id})` }}
                />
                {band.label}
              </span>
            ))}
          </div>
        </section>

        {/* `relative` so the voice halo, raised from inside the conversation,
            lights this panel's edges — including the divider it shares with the
            map — rather than the content box it is declared in. */}
        <aside className="border-border relative flex min-h-0 shrink-0 flex-col border-b px-4 py-4 sm:px-6 lg:w-[24rem] lg:border-b-0 lg:border-l lg:px-0 lg:pl-6">
          {selected ? (
            <Inspector
              graph={GRAPH}
              node={selected}
              model={model}
              marking={view === 'mark'}
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
              onReset={() => {
                /*
                 * Clears the marks too, not just the transcript.
                 *
                 * Resetting the conversation alone left every node the frontier
                 * had opened still marked, and `nextToAsk` only ever offers
                 * `unexplored` nodes — so the fresh session had nothing to ask
                 * and ended on its own opening turn. Starting again has to mean
                 * the whole thing again, which is the same action the tools menu
                 * calls Start over.
                 */
                resetMarks();
                session.reset();
              }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {view === 'mark'
                ? 'Pick a node on the map to see its probes.'
                : 'Pick anything on the map to read about it.'}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function ToolButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent flex h-11 w-full items-center rounded-sm px-2 text-left text-sm"
    >
      {children}
    </button>
  );
}
