'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { animate, motion } from 'motion/react';

import { NodeGlyph } from '@/components/map/node-glyph';
import { downstreamOf, leadNode, stateOf } from '@/lib/graph/frontier';
import { descendantsOf } from '@/lib/graph/relations';
import type { ConceptGraph, ConceptNode, LearnerModel, NodeState } from '@/lib/graph/types';
import { type Cascade, cascadeFrom } from '@/lib/map/cascade';
import {
  type Camera,
  GLYPH_X,
  LABEL_LINE_HEIGHT,
  LABEL_SIZE,
  LABEL_WIDTH,
  LABEL_X,
  NODE_HEIGHT,
  NODE_RADIUS,
  NODE_WIDTH,
  accentPath,
  clampCamera,
  centreOf,
  edgePath,
  fitCamera,
  layoutGraph,
  lerpCamera,
  originOf,
  viewBoxFor,
  zoomAt,
} from '@/lib/map/layout';
import { FOCAL_SCALE, edgeStyle } from '@/lib/map/focus';
import { wrapLabel } from '@/lib/map/text';
import { cn } from '@/lib/utils';

import type { Effects } from './effects';

/**
 * The map, with the motion turned up. A fork, on purpose.
 *
 * `concept-map.tsx` is the product and is not touched by any of this: it is the
 * artefact the whole POC is being judged on, and an experiment that can break
 * it is an experiment nobody will run honestly. Everything here that turned out
 * to be worth keeping gets carried across afterwards, by hand, one effect at a
 * time.
 *
 * What is shared rather than copied is everything that decides what is TRUE —
 * the layout, the states, the cascade traversal, the relations. Only the
 * drawing differs. An effect that needed its own idea of the graph would be an
 * effect saying something the graph does not.
 */

const STATE_STYLE: Record<NodeState, { accent: number; tint: number; muted: boolean }> = {
  known: { accent: 1, tint: 0.14, muted: false },
  shaky: { accent: 0.75, tint: 0, muted: false },
  blocked: { accent: 0.55, tint: 0, muted: false },
  unexplored: { accent: 0.3, tint: 0, muted: true },
};

/* Focus is additive here too; see `src/lib/map/focus.ts` for the measurement
   that removed the dim. Only edges recede. */
/** How long one step of a cascade takes. Matches `--lab-step` in the CSS. */
const STEP_MS = 90;
/** The scale a selected node is brought to, if the map is further out than it. */
const SELECTED_SCALE = 1.15;

export type Ripple = { id: string; key: number } | null;

type Props = {
  graph: ConceptGraph;
  model: LearnerModel;
  effects: Effects;
  selectedId: string | null;
  onSelect: (node: ConceptNode) => void;
  /** Bumped to replay the entrance. */
  revealKey: number;
  /** The node that just became solid, and the wave that travels out from it. */
  ripple: Ripple;
};

export function LabMap({ graph, model, effects, selectedId, onSelect, revealKey, ripple }: Props) {
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const content = useMemo(
    () => ({ width: layout.width, height: layout.height }),
    [layout.width, layout.height],
  );
  const minRow = useMemo(() => Math.min(...graph.nodes.map((node) => node.row)), [graph.nodes]);

  const paneRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = paneRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setPane({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const touched = useRef(false);
  useEffect(() => {
    if (pane.width === 0 || pane.height === 0) return;
    setCamera((current) =>
      touched.current && current ? clampCamera(current, content, pane) : fitCamera(content, pane, 'all'),
    );
  }, [content, pane]);

  /*
   * The camera has to be readable from event handlers that run every frame
   * without re-subscribing them, so it is mirrored into a ref. The state copy
   * is what renders; this copy is what the pointer maths reads.
   */
  const cameraRef = useRef<Camera | null>(null);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  /* ---- focus, and the cascade over it ---------------------------------- */

  /* Hover beats selection: hovering is the question being asked right now. */
  const focusId = hoveredId ?? selectedId;
  const cascade = useMemo<Cascade | null>(
    () => (focusId && layout.points.has(focusId) ? cascadeFrom(graph, focusId) : null),
    [focusId, graph, layout.points],
  );

  /** Steps, or 0 when the cascade is switched off and everything lights at once. */
  const stepOf = useCallback(
    (value: number | undefined) => (effects.cascade ? (value ?? 0) * STEP_MS : 0),
    [effects.cascade],
  );

  const lead = leadNode(graph, model);
  const leadWeight = useMemo(() => (lead ? downstreamOf(graph, lead.id).length : 0), [graph, lead]);

  /*
   * The unlock wave travels DOWN only. Marking an idea solid says nothing new
   * about its prerequisites — they were already settled, or it could not have
   * been reached — so a wave that also ran upwards would be celebrating
   * something that did not happen.
   */
  const wave = useMemo(() => {
    if (!ripple || !effects.ripple) return null;
    const below = descendantsOf(graph, ripple.id);
    const steps = cascadeFrom(graph, ripple.id).nodes;
    return new Map(
      [...steps].filter(([id]) => id === ripple.id || below.has(id)),
    );
  }, [effects.ripple, graph, ripple]);

  /* ---- the camera ------------------------------------------------------ */

  const glide = useRef<{ stop: () => void } | null>(null);
  const moveCamera = useCallback(
    (next: Camera, animated: boolean) => {
      touched.current = true;
      glide.current?.stop();
      glide.current = null;

      const from = cameraRef.current;
      if (!animated || !from) {
        setCamera(next);
        return;
      }

      glide.current = animate(0, 1, {
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (t) => setCamera(lerpCamera(from, next, t)),
      });
    },
    [],
  );

  useEffect(() => () => glide.current?.stop(), []);

  /*
   * Selecting travels to the node; deselecting comes back out to the whole map.
   *
   * Zooming in as well as centring is the part that makes this more than a
   * flourish — it is the difference between reading the shape of the terrain
   * and reading one place in it, and the map is asked to do both. The way back
   * out is the same move reversed, so the two views stay one continuous place
   * rather than two screens.
   */
  useEffect(() => {
    const current = cameraRef.current;
    if (!current || pane.width === 0) return;

    const node = graph.nodes.find((entry) => entry.id === selectedId);
    if (!node) {
      moveCamera(fitCamera(content, pane, 'all'), effects.glide);
      return;
    }

    const scale = Math.max(current.scale, SELECTED_SCALE);
    const centre = centreOf(node, minRow);
    moveCamera(
      clampCamera(
        {
          scale,
          x: centre.x - pane.width / scale / 2,
          y: centre.y - pane.height / scale / 2,
        },
        content,
        pane,
      ),
      effects.glide,
    );
    // Only when the selection itself changes: re-running this on a resize would
    // fight whoever is dragging the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const current = cameraRef.current;
      if (!current || pane.width === 0) return;
      const box = paneRef.current?.getBoundingClientRect();
      if (!box) return;

      const pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      if (event.ctrlKey || event.metaKey) {
        moveCamera(zoomAt(current, pointer, Math.exp(-event.deltaY / 220), content, pane), false);
        return;
      }
      moveCamera(
        clampCamera(
          {
            scale: current.scale,
            x: current.x + event.deltaX / current.scale,
            y: current.y + event.deltaY / current.scale,
          },
          content,
          pane,
        ),
        false,
      );
    },
    [content, moveCamera, pane],
  );

  /* React's onWheel is passive, so preventDefault has to be bound natively. */
  useEffect(() => {
    const element = paneRef.current;
    if (!element) return;
    const handler = (event: WheelEvent) => event.preventDefault();
    element.addEventListener('wheel', handler, { passive: false });
    return () => element.removeEventListener('wheel', handler);
  }, []);

  const drag = useRef<{ pointerId: number; x: number; y: number; camera: Camera } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const current = cameraRef.current;
    if (!current || event.button !== 0) return;
    if ((event.target as Element).closest('[data-node]')) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera: current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const started = drag.current;
      if (!started || started.pointerId !== event.pointerId) return;
      moveCamera(
        clampCamera(
          {
            scale: started.camera.scale,
            x: started.camera.x - (event.clientX - started.x) / started.camera.scale,
            y: started.camera.y - (event.clientY - started.y) / started.camera.scale,
          },
          content,
          pane,
        ),
        false,
      );
    },
    [content, moveCamera, pane],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
  }, []);

  const bands = useMemo(() => graph.bands.map((band) => band.id), [graph.bands]);
  const focusBand = graph.nodes.find((node) => node.id === focusId)?.band ?? bands[0];
  const focusCentre = focusId
    ? layout.points.get(focusId)
    : undefined;

  return (
    <div
      ref={paneRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden"
    >

      {camera ? (
        <svg viewBox={viewBoxFor(camera, pane)} className="relative block h-full w-full" role="group">
          <defs>
            {/*
             * One pool gradient per band rather than one that recolours: a
             * gradient stop cannot read the colour of the shape referencing it,
             * and six tiny definitions are cheaper than the workaround.
             */}
            {bands.map((band) => (
              <radialGradient key={band} id={`lab-pool-${band}`}>
                <stop offset="0%" stopColor={`var(--band-${band})`} stopOpacity={0.22} />
                <stop offset="55%" stopColor={`var(--band-${band})`} stopOpacity={0.07} />
                <stop offset="100%" stopColor={`var(--band-${band})`} stopOpacity={0} />
              </radialGradient>
            ))}
          </defs>

          {effects.pool ? (
            <circle
              className="lab-pool"
              cx={focusCentre?.x ?? content.width / 2}
              cy={focusCentre?.y ?? content.height / 2}
              r={360}
              fill={`url(#lab-pool-${focusBand})`}
              opacity={focusCentre ? 1 : 0}
              aria-hidden
            />
          ) : null}

          {/* The resting drawing: every edge, lit or not. */}
          <g fill="none" aria-hidden>
            {layout.edges.map((edge) => {
              const satisfied = stateOf(model, edge.from) === 'known';
              const lit = cascade?.edges.has(edge.id) ?? false;
              return (
                <path
                  key={edge.id}
                  d={edgePath(layout.points.get(edge.from)!, layout.points.get(edge.to)!)}
                  strokeLinecap="round"
                  className={cn(
                    'transition-[opacity,stroke-width] duration-[--dur] ease-[--ease]',
                    lit ? 'stroke-foreground/70' : satisfied ? 'stroke-foreground/38' : 'stroke-foreground/12',
                  )}
                  strokeWidth={edgeStyle({ focused: Boolean(cascade), inCone: lit, satisfied }).width}
                  opacity={edgeStyle({ focused: Boolean(cascade), inCone: lit, satisfied }).opacity}
                  style={{ transitionDelay: `${lit ? stepOf(cascade?.edges.get(edge.id)?.step) : 0}ms` }}
                />
              );
            })}
          </g>

          {/*
           * The lit cone, drawn over the resting one and remounted whenever the
           * focus changes so the draw-in restarts. Keying it is the whole
           * mechanism: a CSS animation cannot be replayed on an element that
           * React kept.
           */}
          <g key={focusId ?? 'none'} fill="none" aria-hidden>
            {cascade
              ? [...cascade.edges].map(([id, edge]) => {
                  const [from, to] = id.split('->');
                  const path = edgePath(layout.points.get(from)!, layout.points.get(to)!);
                  const delay = stepOf(edge.step - 1);
                  return (
                    <g key={id}>
                      <path
                        d={path}
                        pathLength={1}
                        strokeLinecap="round"
                        stroke={`var(--band-${focusBand})`}
                        strokeWidth={2.4}
                        strokeOpacity={0.9}
                        className="lab-draw"
                        style={{
                          /* +1 draws from the prerequisite end, -1 from the
                             dependant end — which is what makes an upward edge
                             travel towards what it rests on. */
                          strokeDashoffset: edge.upward ? -1 : 1,
                          animationDelay: `${delay}ms`,
                        }}
                      />
                      {effects.flow ? (
                        <path
                          d={path}
                          strokeLinecap="round"
                          stroke={`var(--band-${focusBand})`}
                          strokeWidth={2.4}
                          strokeOpacity={0.55}
                          className="lab-flow"
                          style={
                            {
                              '--lab-flow-end': edge.upward ? 13 : -13,
                              animationDelay: `${delay}ms`,
                            } as React.CSSProperties
                          }
                        />
                      ) : null}
                    </g>
                  );
                })
              : null}
          </g>

          <g key={`nodes-${revealKey}`}>
            {graph.nodes.map((node) => (
              <LabNode
                key={node.id}
                node={node}
                minRow={minRow}
                state={stateOf(model, node.id)}
                isLead={lead?.id === node.id}
                leadWeight={leadWeight}
                isSelected={selectedId === node.id}
                litDelay={cascade?.nodes.has(node.id) ? stepOf(cascade.nodes.get(node.id)) : null}
                focusActive={cascade !== null}
                revealDelay={node.layer * 70}
                rippleDelay={wave?.has(node.id) ? stepOf(wave.get(node.id)) : null}
                rippleKey={ripple?.key ?? 0}
                onSelect={onSelect}
                onHover={setHoveredId}
              />
            ))}
          </g>
        </svg>
      ) : null}
    </div>
  );
}

type NodeProps = {
  node: ConceptNode;
  minRow: number;
  state: NodeState;
  isLead: boolean;
  leadWeight: number;
  isSelected: boolean;
  /** Milliseconds until this node lights, or null when it is not in the cone. */
  litDelay: number | null;
  /** Whether anything is focused at all — with nothing focused, nothing dims. */
  focusActive: boolean;
  revealDelay: number;
  rippleDelay: number | null;
  rippleKey: number;
  onSelect: (node: ConceptNode) => void;
  onHover: (id: string | null) => void;
};

function LabNode({
  node,
  minRow,
  state,
  isLead,
  leadWeight,
  isSelected,
  litDelay,
  focusActive,
  revealDelay,
  rippleDelay,
  rippleKey,
  onSelect,
  onHover,
}: NodeProps) {
  const style = STATE_STYLE[state];
  const colour = `var(--band-${node.band})`;
  const lines = useMemo(() => wrapLabel(node.label, LABEL_WIDTH, LABEL_SIZE), [node.label]);
  const origin = originOf(node, minRow);

  /* One sweep when the state changes, and only when it changes. */
  const previous = useRef(state);
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    setSweep((count) => count + 1);
  }, [state]);

  /* Nothing recedes at all any more — the cone is raised instead. `focusActive`
     still decides whether to draw the ring. */
  const inCone = litDelay !== null;

  return (
    <g transform={`translate(${origin.x}, ${origin.y})`}>
      <g>
        <motion.g
          data-node={node.id}
          tabIndex={0}
          role="button"
          aria-label={`${node.label}. ${STATE_LABEL[state]}.`}
          onClick={() => onSelect(node)}
          onPointerEnter={() => onHover(node.id)}
          onPointerLeave={() => onHover(null)}
          animate={{ scale: isSelected ? FOCAL_SCALE : 1 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          className="outline-none"
        >
          <g
            className="lab-settle transition-opacity duration-[--dur] ease-[--ease]"
            style={{
              animationDelay: `${revealDelay}ms`,
              transitionDelay: `${litDelay ?? 0}ms`,
            }}
          >
            {isLead ? (
              <g aria-hidden>
                {[0, 1.4].map((offset) => (
                  <rect
                    key={offset}
                    x={-8}
                    y={-8}
                    width={NODE_WIDTH + 16}
                    height={NODE_HEIGHT + 16}
                    rx={NODE_RADIUS + 6}
                    fill="none"
                    stroke={colour}
                    strokeWidth={1.5}
                    className="lab-sonar"
                    style={{ animationDelay: `${offset}s` }}
                  />
                ))}
                <rect
                  x={-6}
                  y={-6}
                  width={NODE_WIDTH + 12}
                  height={NODE_HEIGHT + 12}
                  rx={NODE_RADIUS + 4}
                  fill={colour}
                  fillOpacity={0.08}
                />
              </g>
            ) : null}

            {/* The opaque card. The label's contrast lives on this, not on the band. */}
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={NODE_RADIUS}
              className={isSelected ? 'fill-surface-2' : 'fill-surface-1'}
            />
            {style.tint > 0 ? (
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={NODE_RADIUS}
                fill={colour}
                fillOpacity={style.tint}
              />
            ) : null}
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={NODE_RADIUS}
              fill="none"
              className="stroke-border"
              strokeOpacity={style.muted ? 0.5 : 1}
            />

            <path d={accentPath()} fill={colour} fillOpacity={style.accent} />

            <NodeGlyph state={state} cx={GLYPH_X} cy={NODE_HEIGHT / 2} colour={colour} />

            {/* The dial completing, on a state change. */}
            {sweep > 0 ? (
              <circle
                key={sweep}
                cx={GLYPH_X}
                cy={NODE_HEIGHT / 2}
                r={9}
                pathLength={1}
                fill="none"
                stroke={colour}
                strokeWidth={2}
                className="lab-sweep"
                transform={`rotate(-90 ${GLYPH_X} ${NODE_HEIGHT / 2})`}
                aria-hidden
              />
            ) : null}

            <text
              x={LABEL_X}
              y={NODE_HEIGHT / 2 - ((lines.length - 1) * LABEL_LINE_HEIGHT) / 2}
              dominantBaseline="central"
              className={cn('font-medium', style.muted ? 'fill-muted-foreground' : 'fill-foreground')}
              style={{ fontSize: LABEL_SIZE, letterSpacing: '-0.005em' }}
            >
              {lines.map((line, index) => (
                <tspan key={line + index} x={LABEL_X} dy={index === 0 ? 0 : LABEL_LINE_HEIGHT}>
                  {line}
                </tspan>
              ))}
            </text>

            {focusActive && inCone && !isSelected ? (
              <rect
                x={-2.5}
                y={-2.5}
                width={NODE_WIDTH + 5}
                height={NODE_HEIGHT + 5}
                rx={NODE_RADIUS + 2}
                fill="none"
                stroke={colour}
                strokeWidth={1.25}
                strokeOpacity={0.55}
                aria-hidden
              />
            ) : null}

            {isSelected ? (
              <rect
                x={-4}
                y={-4}
                width={NODE_WIDTH + 8}
                height={NODE_HEIGHT + 8}
                rx={NODE_RADIUS + 3}
                fill="none"
                className="stroke-foreground"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}

            {rippleDelay !== null ? (
              <rect
                key={`${rippleKey}-${rippleDelay}`}
                x={-6}
                y={-6}
                width={NODE_WIDTH + 12}
                height={NODE_HEIGHT + 12}
                rx={NODE_RADIUS + 4}
                fill="none"
                stroke={colour}
                strokeWidth={2}
                className="lab-ripple"
                style={{ animationDelay: `${rippleDelay}ms` }}
                aria-hidden
              />
            ) : null}

            {isLead ? (
              <text
                x={NODE_WIDTH / 2}
                y={NODE_HEIGHT + 18}
                textAnchor="middle"
                fill={colour}
                style={{ fontSize: 11, letterSpacing: '0.01em' }}
                aria-hidden
              >
                {leadWeight > 0 ? `Start here — ${leadWeight} ideas rest on this` : 'Start here'}
              </text>
            ) : null}
          </g>
        </motion.g>
      </g>
    </g>
  );
}

const STATE_LABEL: Record<NodeState, string> = {
  known: 'Solid',
  shaky: 'Half-held',
  blocked: 'Not yet',
  unexplored: 'Not looked at',
};
