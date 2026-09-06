'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useAnimationFrame, useMotionValue, useReducedMotion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { stateOf } from '@/lib/graph/frontier';
import type { ConceptGraph, LearnerModel } from '@/lib/graph/types';
import { centreOf, edgePath, layoutGraph, viewBoxFor } from '@/lib/map/layout';
import { PRELUDE, PRELUDE_END, cameraAt, emptyCone } from '@/lib/map/overture';

import { CaptionBlock, OvertureEdge, OvertureNode } from './overture';

/**
 * The first ten seconds.
 *
 * The long sequence at `/intro` is an argument somebody has chosen to read.
 * This is the version for somebody who has just arrived and has not chosen
 * anything: the same map assembling in the same prerequisite order, three
 * sentences, and then the offer. About twenty-two seconds, skippable from the
 * first frame, and it stops before the act that singles out a node — because
 * pointing at one idea and calling it a gap is the part that has to be earned
 * by answers.
 *
 * It shares the timeline rather than copying it. `/intro` scrubs `t` from the
 * scroll; this runs the identical function on a clock. There is one description
 * of how this map assembles and both readings of it are the same code, so they
 * cannot drift.
 */

const SECONDS = 22;

type Props = {
  graph: ConceptGraph;
  /** Called when it finishes on its own, or when somebody skips. */
  onDone: () => void;
};

export function Prelude({ graph, onDone }: Props) {
  const reduced = useReducedMotion();

  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const maxLayer = useMemo(() => Math.max(...graph.nodes.map((node) => node.layer)), [graph.nodes]);
  const minRow = useMemo(() => Math.min(...graph.nodes.map((node) => node.row)), [graph.nodes]);

  /*
   * An empty model. The prelude is a picture of the subject, not of anybody —
   * every node is drawn as "not looked at", which is the only honest thing to
   * say about someone who has not answered a question yet.
   */
  const model: LearnerModel = useMemo(
    () => ({ graphVersion: graph.version, states: {} }),
    [graph.version],
  );

  const stage = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState({ width: 0, height: 0 });
  const paneWidth = useMotionValue(0);
  const paneHeight = useMotionValue(0);


  /* Progress along the shared timeline, in the same units `/intro` scrolls. */
  const t = useMotionValue(reduced ? PRELUDE_END : 0);
  const elapsed = useRef(0);
  const finished = useRef(false);

  /*
   * Time is accumulated from clamped frame deltas, not from a start timestamp.
   *
   * The difference matters when the app is opened in a background tab, where
   * the browser stops firing animation frames entirely. Measured against a
   * fixed start, the first frame after somebody switches to the tab arrives
   * with the whole wall-clock gap in it, so the sequence completes instantly
   * and they meet the dialog having been shown nothing. Clamping each frame's
   * contribution means a paused tab pauses the sequence and resumes it where it
   * stopped, which is what somebody arriving actually wants.
   */
  useAnimationFrame((_now, delta) => {
    if (reduced || finished.current || pane.width === 0) return;
    elapsed.current += Math.min(delta, 100) / 1000 / SECONDS;
    if (elapsed.current >= 1) {
      t.set(PRELUDE_END);
      finished.current = true;
      /* A beat on the last frame before handing over, so the closing sentence
         is read rather than glimpsed. */
      setTimeout(onDone, 1400);
      return;
    }
    t.set(elapsed.current * PRELUDE_END);
  });

  const [frame, setFrame] = useState({ x: 0, y: 0, scale: 1 });

  const camera = useCallback(
    (width: number, height: number) => ({
      content: { width: layout.width, height: layout.height },
      pane: { width, height },
      root: centreOf(graph.nodes.find((node) => node.layer === 0)!, minRow),
      /* Never used below PRELUDE_END, but the shape is required. */
      lead: centreOf(graph.nodes[0], minRow),
      cone: emptyCone(layout),
    }),
    [graph.nodes, layout, minRow],
  );

  /*
   * The frame is composed in the same pass that measures the stage, not on the
   * next animation tick.
   *
   * Seeded a tick late, the very first paint used the placeholder camera and
   * the opening shot appeared for one frame as a small box in the corner before
   * snapping to its real size. `overture.test.ts` asserts the opening frame is
   * already composed; that is a fact about the timeline, and this is what makes
   * it true of the pixels as well.
   */
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setPane({ width: box.width, height: box.height });
      paneWidth.set(box.width);
      paneHeight.set(box.height);
      setFrame(cameraAt(t.get(), camera(box.width, box.height)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [camera, paneHeight, paneWidth, t]);

  useAnimationFrame(() => {
    if (pane.width === 0) return;
    setFrame(cameraAt(t.get(), camera(pane.width, pane.height)));
  });

  return (
    <div
      ref={stage}
      className="bg-surface-0 fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="How this works"
    >
      {pane.width > 0 ? (
        <svg viewBox={viewBoxFor(frame, pane)} className="absolute inset-0 block h-full w-full" aria-hidden>
          <g fill="none">
            {layout.edges.map((edge) => (
              <OvertureEdge
                key={edge.id}
                d={edgePath(layout.points.get(edge.from)!, layout.points.get(edge.to)!)}
                layer={graph.nodes.find((node) => node.id === edge.to)!.layer}
                maxLayer={maxLayer}
                satisfied={stateOf(model, edge.from) === 'known'}
                inCone={false}
                t={t}
              />
            ))}
          </g>
          {graph.nodes.map((node) => (
            <OvertureNode
              key={node.id}
              node={node}
              minRow={minRow}
              maxLayer={maxLayer}
              state={stateOf(model, node.id)}
              isLead={false}
              inCone={false}
              t={t}
            />
          ))}
        </svg>
      ) : null}

      <div className="overture-vignette pointer-events-none absolute inset-0" aria-hidden />

      {PRELUDE.map((caption) => (
        <CaptionBlock key={caption.line} caption={caption} t={t} lead="" rests={0} />
      ))}

      {/*
       * Present from the first frame and always operable. Somebody who has
       * arrived to use the thing must never have to wait for an animation, and
       * the same button is how a keyboard reaches the app.
       */}
      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <Button size="touch" onClick={onDone} className="pointer-events-auto">
          {reduced ? 'Continue' : 'Skip'}
        </Button>
      </div>
    </div>
  );
}
