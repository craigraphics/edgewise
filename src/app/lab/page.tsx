'use client';

import { useCallback, useMemo, useState } from 'react';

import { AnimatePresence, motion } from 'motion/react';

import { LabControls } from '@/components/lab/lab-controls';
import { LabMap, type Ripple } from '@/components/lab/lab-map';
import { ALL_OFF, ALL_ON, type EffectId } from '@/components/lab/effects';
import { emptyModel, leadNode, stateOf } from '@/lib/graph/frontier';
import { unlockedBy } from '@/lib/map/unlock';
import { GRAPH } from '@/lib/graph/load';
import type { ConceptNode, LearnerModel } from '@/lib/graph/types';

/**
 * The motion lab. A POC, reachable only by typing the URL.
 *
 * Not linked from the header on purpose. A testing harness in the main
 * navigation is a mistake this project has already made once — it gave a
 * first-time visitor three choices where the product has two — and this one
 * would be worse, because it presents the map as a thing to play with rather
 * than as a thing to read.
 *
 * It carries a local learner model rather than the persisted one, so nothing
 * done here can change what the real map says about anybody.
 */

/* Something to look at on arrival: a few marks, so the map is not uniformly
   blank and the states can actually be compared against each other. */
const DEMO_MARKS: LearnerModel = {
  graphVersion: GRAPH.version,
  states: Object.fromEntries(
    GRAPH.nodes
      .filter((node) => node.layer <= 2)
      .map((node, index) => [node.id, index % 3 === 0 ? 'shaky' : 'known'] as const),
  ),
};

export default function LabPage() {
  const [effects, setEffects] = useState(ALL_ON);
  const [model, setModel] = useState<LearnerModel>(DEMO_MARKS);
  const [selected, setSelected] = useState<ConceptNode | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const [ripple, setRipple] = useState<Ripple>(null);

  const lead = useMemo(() => leadNode(GRAPH, model), [model]);
  const target = selected ?? lead ?? null;
  const canMark = Boolean(target) && stateOf(model, target!.id) !== 'known';

  const toggle = useCallback((id: EffectId) => {
    setEffects((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  /*
   * Marking here stands in for an explain-back holding up — the only thing in
   * the product that may move a node. The wave is fired from the transition
   * rather than from the click: `unlockedBy` compares the model before and
   * after, so wiring this to anything that does not actually change a state
   * (the walkthrough covering a node, say) produces no wave at all. See
   * `src/lib/map/unlock.ts` for why that guard is structural rather than a
   * comment.
   */
  const mark = useCallback(() => {
    if (!target) return;
    /* Computed outside the updater: a state updater may run twice under
       StrictMode, and firing the wave from inside one would fire it twice. */
    const after = {
      ...model,
      states: { ...model.states, [target.id]: 'known' as const },
    };
    if (unlockedBy(model, after, target.id)) {
      setRipple((current) => ({ id: target.id, key: (current?.key ?? 0) + 1 }));
    }
    setModel(after);
  }, [model, target]);

  const reset = useCallback(() => {
    setModel(emptyModel(GRAPH));
    setRipple(null);
  }, []);

  return (
    <div className="bg-surface-0 flex h-dvh flex-col overflow-hidden lg:flex-row">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <LabMap
          graph={GRAPH}
          model={model}
          effects={effects}
          selectedId={selected?.id ?? null}
          onSelect={(node) => setSelected((current) => (current?.id === node.id ? null : node))}
          revealKey={revealKey}
          ripple={ripple}
        />
      </main>

      <aside className="border-border/60 bg-surface-1 flex max-h-[46%] w-full shrink-0 flex-col border-t lg:max-h-none lg:w-[24rem] lg:border-t-0 lg:border-l">
        <div className="min-h-0 flex-1">
          <LabControls
            effects={effects}
            onToggle={toggle}
            onAll={(on) => setEffects(on ? ALL_ON : ALL_OFF)}
            onReplay={() => setRevealKey((key) => key + 1)}
            onMark={mark}
            onReset={reset}
            markLabel={target ? `Mark “${target.label}” solid` : 'Nothing selected'}
            canMark={canMark}
          />
        </div>

        {/*
         * The selected node's own text, so clicking a box does something worth
         * doing. The panel is the only place the map's motion has a consequence
         * you can read, which is what stops the lab being a screensaver.
         */}
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="border-border/60 bg-surface-2 border-t p-5"
            >
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                {selected.band}
              </p>
              <h2 className="font-display mt-1 text-lg font-medium">{selected.label}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {selected.subtitle}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </aside>
    </div>
  );
}
