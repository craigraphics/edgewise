'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { MinusIcon, PlusIcon, ScanIcon } from 'lucide-react';

import { NodeGlyph } from '@/components/map/node-glyph';
import { Button } from '@/components/ui/button';
import { downstreamOf, leadNode, stateOf } from '@/lib/graph/frontier';
import { focusOn } from '@/lib/graph/relations';
import type { ConceptGraph, ConceptNode, LearnerModel, NodeState } from '@/lib/graph/types';
import {
  type Camera,
  type FitMode,
  GLYPH_X,
  LABEL_LINE_HEIGHT,
  LABEL_SIZE,
  LABEL_WIDTH,
  LABEL_X,
  NODE_HEIGHT,
  NODE_RADIUS,
  NODE_WIDTH,
  accentPath,
  cameraShowing,
  clampCamera,
  edgePath,
  fitCamera,
  layoutGraph,
  originOf,
  viewBoxFor,
  zoomAt,
} from '@/lib/map/layout';
import { FOCAL_SCALE, edgeStyle } from '@/lib/map/focus';
import { wrapLabel } from '@/lib/map/text';
import { cn } from '@/lib/utils';

/**
 * The map.
 *
 * Positions come from the graph's authored `layer`/`row`, not from a layout
 * algorithm. A force simulation reshuffles between renders, and this drawing is
 * the thing the POC is actually testing — if it moves every time you look at it,
 * nobody trusts it enough to have the recognition moment it exists to produce.
 * `validate-graph` asserts the authored layer matches the real prerequisite
 * depth, so the picture cannot drift from the structure.
 *
 * Plain SVG, no graph library: 23 nodes do not need one, and every dependency
 * here would be code we do not control sitting on top of the product's core
 * artefact. Zoom and pan move a `viewBox`; they are a camera over a fixed
 * drawing, and nothing in them can move one node relative to another.
 *
 * Three things this file is responsible for that the previous version was not:
 *
 * - **Legibility.** The label sits on an opaque card in a neutral colour rather
 *   than on the band colour. Measured, the old arrangement put white text on a
 *   90%-opacity band at 2.89:1 in light mode — a fail against AA, on the state
 *   the map most wants read, invisible to anyone working in dark mode.
 * - **The lead node reading as an invitation.** It used to get a dashed ring
 *   around a node that was already dashed for its state. Two nested dashed
 *   outlines is how every interface on earth draws "invalid".
 * - **Answering what rests on what.** Focus a node and its two cones light up.
 */

/**
 * How each state draws, now that colour is not carrying it.
 *
 * `accent` is the opacity of the band-coloured bar down the leading edge, and
 * `tint` is how much of the band washes into the card. Only `known` gets a
 * tint: a settled idea should look filled in, and nothing else should.
 *
 * The accents were louder — 1 / 0.75 / 0.55 / 0.3 — and the map was running two
 * colour systems at once: four state glyphs, six topic-family hues, plus a blue
 * focus ring. Three vocabularies competing on twenty-three small cards, when
 * only one of them is about the learner. **State is the signal; the band is
 * grouping**, so the band is now quiet enough to be noticed on purpose and not
 * before. The `6 parts` control is where somebody goes when they want it.
 */
const STATE_STYLE: Record<NodeState, { accent: number; tint: number; muted: boolean }> = {
  known: { accent: 0.72, tint: 0.1, muted: false },
  shaky: { accent: 0.5, tint: 0, muted: false },
  blocked: { accent: 0.36, tint: 0, muted: false },
  unexplored: { accent: 0.2, tint: 0, muted: true },
};

/**
 * Focus is additive; see `src/lib/map/focus.ts`.
 *
 * This used to be `DIMMED = 0.22`, applied to every node group outside the
 * focused cone. Measured against the real tokens that put a label at 1.62:1 in
 * light and 1.84:1 in dark — a map whose unfocused half was, in the literal
 * sense, unreadable. Nothing recedes now except edges.
 */

type Props = {
  graph: ConceptGraph;
  model: LearnerModel;
  onSelect?: (node: ConceptNode) => void;
  /** Opened by a click. Draws the neutral ring, and focuses the two cones. */
  selectedId?: string | null;
  /**
   * The node the conversation or the walkthrough is currently on.
   *
   * Deliberately NOT the same input as `selectedId`. Both used to arrive on the
   * one prop, which meant the walkthrough — where a node is always current —
   * left the map permanently dimmed to a single cone for the whole twenty-three
   * steps. Following along is not the same act as asking "what rests on this",
   * so it gets the ring and not the dimming.
   */
  highlightedId?: string | null;
  /** Nodes the walkthrough has already been through. */
  covered?: ReadonlySet<string>;
  /** How the map sits in its pane at rest. See `FitMode` in the layout module. */
  fit?: FitMode;
  /** Suppresses the staggered first reveal — used when the map is remounted. */
  quiet?: boolean;
  showControls?: boolean;
  className?: string;
};

export function ConceptMap({
  graph,
  model,
  onSelect,
  selectedId,
  highlightedId,
  covered,
  fit = 'legible',
  quiet = false,
  showControls = true,
  className,
}: Props) {
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const content = useMemo(
    () => ({ width: layout.width, height: layout.height }),
    [layout.width, layout.height],
  );

  const paneRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /*
   * The pane is measured rather than assumed. Every camera number below is in
   * content units divided by a real pixel size, so a guess here would put the
   * map at the wrong scale for one frame and then jump.
   */
  useLayoutEffect(() => {
    const element = paneRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setPane({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /*
   * Re-fit when the pane resizes or the fit mode changes, but never once the
   * learner has taken hold of the camera themselves — a map that snaps back to
   * its default because the window moved a pixel is a map you cannot use.
   */
  const touched = useRef(false);
  useEffect(() => {
    if (pane.width === 0 || pane.height === 0) return;
    setCamera((current) =>
      touched.current && current ? clampCamera(current, content, pane) : fitCamera(content, pane, fit),
    );
  }, [content, fit, pane]);

  const lead = leadNode(graph, model);

  /*
   * What is under the pointer wins over what is selected: hovering is a
   * question you are asking right now, selection is one you asked earlier.
   */
  const focusId = hoveredId ?? selectedId ?? null;
  const focus = useMemo(
    () => (focusId && layout.points.has(focusId) ? focusOn(graph, focusId) : null),
    [focusId, graph, layout.points],
  );

  /*
   * The count that is the whole argument for the map existing. It was only ever
   * visible in the panel, after a click; on the map it is the difference
   * between "you are here" and "here is why this one matters".
   */
  const leadWeight = useMemo(() => (lead ? downstreamOf(graph, lead.id).length : 0), [graph, lead]);

  const applyCamera = useCallback(
    (next: Camera) => {
      touched.current = true;
      setCamera(next);
    },
    [],
  );

  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      if (!camera || pane.width === 0) return;
      applyCamera(
        zoomAt(camera, at ?? { x: pane.width / 2, y: pane.height / 2 }, factor, content, pane),
      );
    },
    [applyCamera, camera, content, pane],
  );

  /* The Fit control always means the whole thing, whatever the resting mode
     is — "fit" that left a third of the map off screen would be a lie. */
  const refit = useCallback(() => {
    if (pane.width === 0) return;
    touched.current = true;
    setCamera(fitCamera(content, pane, 'all'));
  }, [content, pane]);

  /*
   * Wheel is zoom with a modifier and pan without, which is what every map
   * people have used behaves like. Trackpad pinch arrives as `ctrlKey`.
   */
  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!camera || pane.width === 0 || event.ctrlKey || event.metaKey) return;
      const box = paneRef.current?.getBoundingClientRect();
      if (!box) return;
      event.preventDefault();

      applyCamera(
        clampCamera(
          {
            scale: camera.scale,
            x: camera.x + event.deltaX / camera.scale,
            y: camera.y + event.deltaY / camera.scale,
          },
          content,
          pane,
        ),
      );
    },
    [applyCamera, camera, content, pane],
  );

  /*
   * Wheel has to be bound natively: React's onWheel is passive, so
   * `preventDefault` inside it is ignored and the page scrolls behind the map.
   */
  useEffect(() => {
    const element = paneRef.current;
    if (!element) return;
    const handler = (event: WheelEvent) => { if (!event.ctrlKey && !event.metaKey) event.preventDefault(); };
    element.addEventListener('wheel', handler, { passive: false });
    return () => element.removeEventListener('wheel', handler);
  }, []);

  const drag = useRef<{ pointerId: number; x: number; y: number; camera: Camera } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only the background drags. Starting a pan on a node would make every
      // click a potential accidental drag.
      if (!camera || event.button !== 0) return;
      if ((event.target as Element).closest('[data-node]')) return;
      drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [camera],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const started = drag.current;
      if (!started || started.pointerId !== event.pointerId) return;
      applyCamera(
        clampCamera(
          {
            scale: started.camera.scale,
            x: started.camera.x - (event.clientX - started.x) / started.camera.scale,
            y: started.camera.y - (event.clientY - started.y) / started.camera.scale,
          },
          content,
          pane,
        ),
      );
    },
    [applyCamera, content, pane],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
  }, []);

  /*
   * Keyboard: arrows move between nodes in reading order down the map, which is
   * also prerequisite order. Focus follows, and the camera follows focus, so a
   * node reached by keyboard is never off screen.
   */
  const order = useMemo(
    () => [...graph.nodes].sort((a, b) => a.layer - b.layer || a.row - b.row || a.id.localeCompare(b.id)),
    [graph.nodes],
  );

  const onNodeKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGGElement>, node: ConceptNode) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(node);
        return;
      }

      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
      if (step === 0) return;

      event.preventDefault();
      const index = order.findIndex((entry) => entry.id === node.id);
      const next = order[Math.min(order.length - 1, Math.max(0, index + step))];
      const element = paneRef.current?.querySelector<SVGGElement>(`[data-node="${next.id}"]`);
      element?.focus();
    },
    [onSelect, order],
  );

  /*
   * Bring a keyboard-focused node into view without changing the scale — the
   * browser cannot scroll a `viewBox`, so nothing else does this.
   */
  const showNode = useCallback(
    (nodeId: string) => {
      const point = layout.points.get(nodeId);
      if (!camera || !point || pane.width === 0) return;
      const next = cameraShowing(camera, point, content, pane);
      if (next.x !== camera.x || next.y !== camera.y) applyCamera(next);
    },
    [applyCamera, camera, content, layout.points, pane],
  );

  const minRow = useMemo(() => Math.min(...graph.nodes.map((node) => node.row)), [graph.nodes]);

  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div
        ref={paneRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="min-h-0 min-w-0 flex-1 touch-none overflow-hidden [&:active]:cursor-grabbing"
      >
        {camera ? (
          <svg
            viewBox={viewBoxFor(camera, pane)}
            /*
             * Sized by CSS, NOT by `width`/`height` attributes.
             *
             * Those attributes give the SVG an intrinsic size, which becomes
             * the min-content width of every flex ancestor — so the map pane
             * could never shrink below whatever it last measured. Widen the
             * window and then narrow it again and the map stayed at its old
             * width, pushing the conversation panel off the right-hand edge and
             * cutting it in half. Measured: 116px of the panel clipped after a
             * 1920 → 1300 resize.
             *
             * The viewBox keeps the same aspect ratio as the pane by
             * construction (both axes are divided by the same scale), so
             * filling the pane is exact rather than letterboxed.
             */
            className="block h-full w-full"
            role="group"
            aria-label={`Concept map: ${graph.nodes.length} ideas, each resting on the ones before it. Every idea is marked solid, half-held, not yet, or not looked at.`}
          >
            <g fill="none" aria-hidden>
              {layout.edges.map((edge) => {
                const from = layout.points.get(edge.from)!;
                const to = layout.points.get(edge.to)!;
                /*
                 * An edge is drawn as satisfied only when the prerequisite is
                 * known. That makes the blocked region of the map legible at a
                 * glance — you can see the solid path you are standing on stop,
                 * and the faint ones beyond it waiting.
                 */
                const satisfied = stateOf(model, edge.from) === 'known';
                const lit = focus?.edges.has(edge.id) ?? false;
                const style = edgeStyle({ focused: Boolean(focus), inCone: lit, satisfied });

                return (
                  <path
                    key={edge.id}
                    d={edgePath(from, to)}
                    strokeLinecap="round"
                    className={cn(
                      'transition-[opacity,stroke-width] duration-[--dur] ease-[--ease]',
                      /* Lit edges brighten as well as thicken. Raising the path
                         is the whole mechanism now that nothing is lowered. */
                      /*
                       * Raised from /38 and /12. At those values the
                       * dependency structure was almost invisible in dark mode
                       * and the map read as a wireframe of floating cards —
                       * which loses the one thing the drawing is for. An
                       * unsatisfied edge still has to read as waiting rather
                       * than as absent.
                       */
                      lit ? 'stroke-foreground/75' : satisfied ? 'stroke-foreground/50' : 'stroke-foreground/22',
                    )}
                    strokeWidth={style.width}
                    opacity={style.opacity}
                  />
                );
              })}
            </g>

            <g>
              {graph.nodes.map((node, index) => (
                <MapNode
                  key={node.id}
                  node={node}
                  minRow={minRow}
                  state={stateOf(model, node.id)}
                  isLead={lead?.id === node.id}
                  leadWeight={leadWeight}
                  isSelected={selectedId === node.id}
                  isHighlighted={highlightedId === node.id && selectedId !== node.id}
                  isCovered={covered?.has(node.id) ?? false}
                  focused={Boolean(focus)}
                  isFocus={focusId === node.id}
                  inCone={focus?.nodes.has(node.id) ?? false}
                  revealDelay={quiet ? null : node.layer * 30}
                  index={index}
                  onSelect={onSelect}
                  onHover={setHoveredId}
                  onKeyDown={onNodeKeyDown}
                  onFocus={showNode}
                />
              ))}
            </g>
          </svg>
        ) : null}
      </div>

      {/*
       * Camera controls, small and out of the way. Deliberately not a slider:
       * this is a diagram to read, and a prominent zoom control invites fiddling
       * with the view instead of looking at what it shows.
       */}
      {showControls && <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        <ZoomButton label="Zoom in" onClick={() => zoomBy(1.25)}>
          <PlusIcon />
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => zoomBy(0.8)}>
          <MinusIcon />
        </ZoomButton>
        <ZoomButton label="Fit the map to the screen" onClick={refit}>
          <ScanIcon />
        </ZoomButton>
      </div>}
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon-touch"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="edgewise-raised border-border/60 backdrop-blur-sm"
    >
      {children}
    </Button>
  );
}

type NodeProps = {
  node: ConceptNode;
  minRow: number;
  state: NodeState;
  isLead: boolean;
  leadWeight: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isCovered: boolean;
  /** Whether anything at all is focused. */
  focused: boolean;
  /** Whether this node is the one being asked about. */
  isFocus: boolean;
  /** Whether this node is on a path through the focused one. */
  inCone: boolean;
  revealDelay: number | null;
  index: number;
  onSelect?: (node: ConceptNode) => void;
  onHover: (id: string | null) => void;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>, node: ConceptNode) => void;
  onFocus: (id: string) => void;
};

function MapNode({
  node,
  minRow,
  state,
  isLead,
  leadWeight,
  isSelected,
  isHighlighted,
  isCovered,
  focused,
  isFocus,
  inCone,
  revealDelay,
  onSelect,
  onHover,
  onKeyDown,
  onFocus,
}: NodeProps) {
  const style = STATE_STYLE[state];
  const colour = `var(--band-${node.band})`;
  const lines = useMemo(() => wrapLabel(node.label, LABEL_WIDTH, LABEL_SIZE), [node.label]);

  const origin = originOf(node, minRow);

  /*
   * One pulse when the state changes, and only when it changes. This is the
   * only moment the map ever asserts something new about the learner, and it
   * has earned a beat; anything more would be a map that fidgets.
   */
  const previousState = useRef(state);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (previousState.current === state) return;
    previousState.current = state;
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), 600);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    /*
     * Two groups, and the split is load-bearing.
     *
     * The outer one carries the position, as a `transform` ATTRIBUTE. The inner
     * one carries everything else, including the reveal animation — and that
     * animation moves a CSS `transform`, which on the same element overrides the
     * attribute entirely rather than composing with it. It did: with both on one
     * group, every node on a fresh map collapsed onto the origin and only the
     * last one drawn was visible, and `animation-fill-mode: both` then kept them
     * there for good.
     */
    <g transform={`translate(${origin.x}, ${origin.y})`}>
    <g
      data-node={node.id}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${node.label}. ${STATE_LABEL[state]}.${isLead ? ' Start here.' : ''}${isCovered ? ' Already walked through.' : ''} In ${node.band}.`}
      onClick={onSelect ? () => onSelect(node) : undefined}
      onKeyDown={(event) => onKeyDown(event, node)}
      onFocus={() => onFocus(node.id)}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      /*
       * No opacity here, deliberately and permanently — see `focus.ts`. A node
       * outside the focused cone is not less relevant to the person reading the
       * map; it is the part they have not got to yet, and hiding it removes the
       * comparison the view exists to support.
       */
      className={cn(
        'transition-transform duration-[--dur] ease-[--ease] outline-none',
        onSelect && 'cursor-pointer',
        revealDelay !== null && 'edgewise-settle',
      )}
      style={revealDelay !== null ? { animationDelay: `${revealDelay}ms` } : undefined}
    >
    <rect className="keyboard-focus-ring" x={-5} y={-5} width={NODE_WIDTH + 10} height={NODE_HEIGHT + 10} rx={NODE_RADIUS + 4} fill="none" stroke="var(--foreground)" strokeWidth={3} aria-hidden />
    {/*
     * The focal lift gets its own group.
     *
     * The group above carries the reveal animation, which moves a CSS
     * transform — and a second CSS transform on the same element replaces it
     * rather than composing with it. That is the bug that collapsed all 23
     * nodes onto the origin once already, so the split is not tidiness.
     */}
    <g
      className="transition-transform duration-[--dur] ease-[--ease]"
      style={{
        transformBox: 'fill-box',
        transformOrigin: 'center',
        transform: isFocus ? `scale(${FOCAL_SCALE})` : undefined,
      }}
    >
      {/*
       * On a path through the focused node.
       *
       * A quiet ring in the band colour rather than everything else fading:
       * the cone is raised, nothing is pushed down. It sits under the selected
       * and highlighted rings so the three emphases still read in order.
       */}
      {focused && inCone && !isFocus ? (
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

      {/*
       * The lead node.
       *
       * A soft aura in the band colour, breathing on opacity alone, and a
       * caption saying what rests on it. It replaces a dashed ring drawn around
       * a node that was already dashed for its state — which read as "invalid",
       * on the one node the map most wants you to walk towards.
       *
       * The caption names the structure, never the person: "22 ideas rest on
       * this" is a fact about the graph. "You are missing this" is a verdict,
       * and that tone is what this product cannot survive.
       */}
      {isLead ? (
        <g aria-hidden>
          <rect
            x={-7}
            y={-7}
            width={NODE_WIDTH + 14}
            height={NODE_HEIGHT + 14}
            rx={NODE_RADIUS + 5}
            fill={colour}
            fillOpacity={0.1}
            className="edgewise-aura"
          />
          <rect
            x={-4}
            y={-4}
            width={NODE_WIDTH + 8}
            height={NODE_HEIGHT + 8}
            rx={NODE_RADIUS + 3}
            fill="none"
            stroke={colour}
            strokeWidth={1.5}
            strokeOpacity={0.85}
          />
        </g>
      ) : null}

      {/*
       * An opaque base under every box.
       *
       * The card is a neutral surface, not a wash of the band colour. That is
       * what puts the label's contrast under our control instead of leaving it
       * to whichever of six hues a node happens to belong to — the arrangement
       * this replaced measured 2.89:1 in light mode on `known` nodes, a clear
       * AA failure on the state the map most wants read.
       *
       * It also keeps edges passing behind a card from showing through the
       * label, which was the original reason for painting a base at all.
       */}
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={NODE_RADIUS}
        className={isSelected ? 'fill-surface-2' : 'fill-surface-1'}
        style={isSelected ? { filter: 'brightness(1.08)' } : undefined}
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

      {/* The band, as a bar down the leading edge — grouping, never state. */}
      <path
        d={accentPath()}
        fill={colour}
        fillOpacity={style.accent}
      />

      <NodeGlyph state={state} cx={GLYPH_X} cy={NODE_HEIGHT / 2} colour={colour} />

      {pulsing ? (
        <circle
          cx={GLYPH_X}
          cy={NODE_HEIGHT / 2}
          r={10}
          fill={colour}
          className="edgewise-pulse"
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

      {/*
       * Covered nodes get a mark rather than a fifth colour.
       *
       * "Has been explained to you" is a different axis from "do you have it" —
       * someone can be walked through an idea and still not hold it — so it must
       * not overwrite the four states the map already carries. It sits in the
       * far corner, as far from the state glyph as the card allows, so the two
       * cannot be read as one thing.
       */}
      {isCovered ? (
        <circle cx={NODE_WIDTH - 12} cy={12} r={2.2} fill="var(--muted-foreground)" fillOpacity={0.8} />
      ) : null}

      {/*
       * Three emphases, three treatments, none of which can be mistaken for
       * another:
       *
       * - lead        a breathing band aura and a caption  (invitation)
       * - selected    a crisp neutral ring                  (you opened this)
       * - highlighted a band ring                           (this is the one being talked about)
       */}
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
      ) : isHighlighted && !isLead ? (
        <rect
          x={-3}
          y={-3}
          width={NODE_WIDTH + 6}
          height={NODE_HEIGHT + 6}
          rx={NODE_RADIUS + 2}
          fill="none"
          stroke={colour}
          strokeWidth={1.5}
          strokeOpacity={0.7}
          aria-hidden
        />
      ) : null}

      {isLead ? (
        <text
          x={NODE_WIDTH / 2}
          y={NODE_HEIGHT + 16}
          textAnchor="middle"
          fill={colour}
          style={{ fontSize: 11, letterSpacing: '0.01em' }}
          aria-hidden
        >
          {leadWeight > 0 ? `Start here — ${leadWeight} ideas rest on this` : 'Start here'}
        </text>
      ) : null}
    </g>
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

