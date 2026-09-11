'use client';

import Link from 'next/link';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ArrowRightIcon } from 'lucide-react';
import { type MotionValue, motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'motion/react';

import { NodeGlyph } from '@/components/map/node-glyph';
import { buttonVariants } from '@/components/ui/button';
import { downstreamOf, leadNode, stateOf } from '@/lib/graph/frontier';
import { descendantsOf } from '@/lib/graph/relations';
import type { ConceptGraph, ConceptNode, NodeState } from '@/lib/graph/types';
import {
  GLYPH_X,
  LABEL_LINE_HEIGHT,
  LABEL_SIZE,
  LABEL_WIDTH,
  LABEL_X,
  NODE_HEIGHT,
  NODE_RADIUS,
  NODE_WIDTH,
  accentPath,
  centreOf,
  edgePath,
  layoutGraph,
  originOf,
} from '@/lib/map/layout';
import {
  ACTS,
  CAPTIONS,
  type Caption,
  HANDOFF,
  ILLUSTRATIVE_LABEL,
  illustrativeFrom,
  blockProgress,
  cameraAt,
  captionOpacity,
  edgeWindow,
  nodeWindow,
  overtureModel,
  progressIn,
} from '@/lib/map/overture';
import { EDGE_OUT_OF_CONE } from '@/lib/map/focus';
import { wrapLabel } from '@/lib/map/text';
import { cn } from '@/lib/utils';
import { useHydrated } from '@/lib/persisted';

/**
 * The overture.
 *
 * A tall scroll track with one sticky stage inside it. Scroll position is the
 * only input; `overture.ts` turns it into a camera, a reveal state and a line
 * of text, and everything on screen is a pure function of that one number.
 *
 * Nothing here re-renders while you scroll. The graph is mounted once and every
 * moving quantity is a motion value written straight to the DOM — 23 nodes and
 * 33 edges re-rendering sixty times a second would drop frames on exactly the
 * shot the whole thing is built around, and a stuttering pull-back would say
 * far more about the product than the words do.
 */

const STATE_STYLE: Record<NodeState, { accent: number; tint: number; muted: boolean }> = {
  known: { accent: 1, tint: 0.14, muted: false },
  shaky: { accent: 0.75, tint: 0, muted: false },
  blocked: { accent: 0.55, tint: 0, muted: false },
  unexplored: { accent: 0.3, tint: 0, muted: true },
};

type Props = { graph: ConceptGraph };

export function Overture({ graph }: Props) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const [reading, setReading] = useState(false);

  // Match the server on the first client render. The motion preference is only
  // available in the browser. Keep scroll hooks out of the text-only tree.
  if (hydrated && (reduced || reading)) {
    const lead = leadNode(graph, overtureModel(graph))!;
    return <Still graph={graph} lead={lead} rests={downstreamOf(graph, lead.id).length} />;
  }
  return <AnimatedOverture graph={graph} onRead={() => setReading(true)} />;
}

function AnimatedOverture({ graph, onRead }: Props & { onRead: () => void }) {
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const model = useMemo(() => overtureModel(graph), [graph]);
  const maxLayer = useMemo(() => Math.max(...graph.nodes.map((node) => node.layer)), [graph.nodes]);
  const minRow = useMemo(() => Math.min(...graph.nodes.map((node) => node.row)), [graph.nodes]);

  const lead = leadNode(graph, model)!;
  const rests = useMemo(() => downstreamOf(graph, lead.id).length, [graph, lead.id]);

  /* What the dive lights: the node, and everything resting on it. Not its
     prerequisites — the sentence being said is about what is downstream. */
  const below = useMemo(() => {
    const nodes = new Set([lead.id, ...descendantsOf(graph, lead.id)]);
    const edges = new Set<string>();
    for (const node of graph.nodes) {
      for (const prerequisite of node.prerequisites) {
        if (nodes.has(prerequisite) && nodes.has(node.id)) edges.add(`${prerequisite}->${node.id}`);
      }
    }
    return { nodes, edges };
  }, [graph, lead.id]);

  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });

  /*
   * The pane goes in as motion values as well as state. State is what renders
   * the viewBox; the motion values are what make every camera transform
   * recompute on a resize without waiting for the next scroll event.
   */
  const [pane, setPane] = useState({ width: 0, height: 0 });
  const paneWidth = useMotionValue(0);
  const paneHeight = useMotionValue(0);

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setPane({ width: box.width, height: box.height });
      paneWidth.set(box.width);
      paneHeight.set(box.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [paneHeight, paneWidth]);

  const content = { width: layout.width, height: layout.height };
  /* The box around the lead node and everything resting on it, which is what
     the closing shot has to contain. */
  const cone = useMemo(() => {
    const origins = [...below.nodes].map((id) => originOf(graph.nodes.find((n) => n.id === id)!, minRow));
    const pad = 40;
    const left = Math.min(...origins.map((o) => o.x)) - pad;
    const right = Math.max(...origins.map((o) => o.x)) + NODE_WIDTH + pad;
    const top = Math.min(...origins.map((o) => o.y)) - pad;
    const bottom = Math.max(...origins.map((o) => o.y)) + NODE_HEIGHT + pad;
    return {
      centre: { x: (left + right) / 2, y: (top + bottom) / 2 },
      size: { width: right - left, height: bottom - top },
    };
  }, [below.nodes, graph.nodes, minRow]);

  const frameFor = (width: number, height: number) => ({
    content,
    pane: { width, height },
    root: centreOf(graph.nodes.find((node) => node.layer === 0)!, minRow),
    lead: centreOf(lead, minRow),
    cone,
  });

  /*
   * The camera is one CSS transform on one group rather than an animated
   * viewBox: a transform is composited, a viewBox re-rasterises the whole
   * drawing every frame. Screen = translate(-camera * scale) then scale, which
   * is the order `motion` writes them in.
   */
  const scale = useTransform<number, number>([scrollYProgress, paneWidth, paneHeight], ([t, w, h]) =>
    cameraAt(t, frameFor(w, h)).scale,
  );
  const x = useTransform<number, number>([scrollYProgress, paneWidth, paneHeight], ([t, w, h]) => {
    const camera = cameraAt(t, frameFor(w, h));
    return -camera.x * camera.scale;
  });
  const y = useTransform<number, number>([scrollYProgress, paneWidth, paneHeight], ([t, w, h]) => {
    const camera = cameraAt(t, frameFor(w, h));
    return -camera.y * camera.scale;
  });

  /*
   * Reduced motion gets the argument as a page rather than as a film. Not a
   * degraded version of the sequence — a still map and the five sentences, in
   * order, which is what the sequence was saying.
   */

  return (
    <div ref={track} className="relative h-[640vh]">
      <button onClick={onRead} className="bg-surface-1 border-border fixed top-5 left-5 z-30 min-h-10 rounded-full border px-4 text-sm">Read without animation</button>
      <div ref={stage} className="bg-surface-0 sticky top-0 h-dvh overflow-hidden">
        {pane.width > 0 ? (
          <svg
            viewBox={`0 0 ${pane.width} ${pane.height}`}
            className="absolute inset-0 block h-full w-full"
            aria-hidden
          >
            {/*
             * `originX`/`originY` rather than a raw `transformOrigin`: motion
             * writes its own `transform-origin` from those, so a hand-set one is
             * silently overwritten with the default 50% 50%. It was, and the
             * camera scaled about the middle of the drawing instead of about the
             * content origin — which put the whole map a few hundred units off to
             * one side at every zoom except 1x. Visible only as a composition
             * that would not centre, which is the kind of bug that gets called a
             * taste problem and tweaked at forever.
             *
             * With `transform-box: view-box`, 0% 0% is the top-left of the
             * viewBox, which is where content coordinates start.
             */}
            <motion.g style={{ x, y, scale, originX: 0, originY: 0, transformBox: 'view-box' }}>
              <g fill="none">
                {layout.edges.map((edge) => (
                  <OvertureEdge
                    key={edge.id}
                    d={edgePath(layout.points.get(edge.from)!, layout.points.get(edge.to)!)}
                    layer={graph.nodes.find((node) => node.id === edge.to)!.layer}
                    maxLayer={maxLayer}
                    satisfied={stateOf(model, edge.from) === 'known'}
                    inCone={below.edges.has(edge.id)}
                    t={scrollYProgress}
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
                  isLead={node.id === lead.id}
                  inCone={below.nodes.has(node.id)}
                  t={scrollYProgress}
                />
              ))}
            </motion.g>
          </svg>
        ) : null}

        {/* A vignette, so the drawing falls away at the edges instead of being
            cropped by them. It is the difference between a frame and a window. */}
        <div className="pointer-events-none absolute inset-0 overture-vignette" aria-hidden />

        {CAPTIONS.map((caption) => (
          <CaptionBlock
            key={caption.line}
            caption={caption}
            t={scrollYProgress}
            lead={lead.label}
            rests={rests}
          />
        ))}

        <Illustrative t={scrollYProgress} />
        <BandStrip graph={graph} t={scrollYProgress} />
        <ActRail t={scrollYProgress} />
        <ScrollHint t={scrollYProgress} />
        <Way t={scrollYProgress} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function OvertureEdge({
  d,
  layer,
  maxLayer,
  satisfied,
  inCone,
  t,
}: {
  d: string;
  layer: number;
  maxLayer: number;
  satisfied: boolean;
  inCone: boolean;
  t: MotionValue<number>;
}) {
  const window = edgeWindow(layer, maxLayer);
  const draw = useTransform(t, (value) => progressIn(value, window));
  /* Edges are the one thing that may recede — they carry no text. */
  const opacity = useTransform(t, (value) => {
    const arrived = progressIn(value, window) > 0 ? 1 : 0;
    const dive = blockProgress(value);
    const base = satisfied ? 0.42 : 0.16;
    return arrived * (inCone ? base + dive * 0.5 : base * (1 - dive * (1 - EDGE_OUT_OF_CONE)));
  });

  return (
    <motion.path
      d={d}
      strokeLinecap="round"
      strokeWidth={1.6}
      className="stroke-foreground"
      style={{ pathLength: draw, opacity }}
    />
  );
}

export function OvertureNode({
  node,
  minRow,
  maxLayer,
  state,
  isLead,
  inCone,
  t,
}: {
  node: ConceptNode;
  minRow: number;
  maxLayer: number;
  state: NodeState;
  isLead: boolean;
  inCone: boolean;
  t: MotionValue<number>;
}) {
  const style = STATE_STYLE[state];
  const colour = `var(--band-${node.band})`;
  const lines = useMemo(() => wrapLabel(node.label, LABEL_WIDTH, LABEL_SIZE), [node.label]);
  const origin = originOf(node, minRow);
  const window = nodeWindow(node.layer, maxLayer);

  /*
   * Arrival only. The dive does NOT fade the rest of the map — see
   * `src/lib/map/focus.ts`: a node dropped to a fraction of its opacity is a
   * node whose label is no longer readable, and on a map of what somebody has
   * not reached yet, disappearing reads as excluded rather than as ahead.
   *
   * The cone is raised instead: a ring on each of its nodes, the edges between
   * them brightened, and everything else's edges softened.
   */
  const opacity = useTransform(t, (value) => progressIn(value, window));
  const coneRing = useTransform(t, (value) => (isLead || !inCone ? 0 : blockProgress(value) * 0.6));

  /* Arrives a touch small and settles, which reads as landing on the end of
     the edge that was just drawn to it. */
  const scale = useTransform(t, (value) => 0.92 + 0.08 * progressIn(value, window));
  const auraOpacity = useTransform(t, (value) => (isLead ? blockProgress(value) : 0));

  return (
    <g transform={`translate(${origin.x}, ${origin.y})`}>
      <motion.g
        style={{ opacity, scale, transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        {isLead ? (
          <motion.g style={{ opacity: auraOpacity }}>
            <rect
              x={-9}
              y={-9}
              width={NODE_WIDTH + 18}
              height={NODE_HEIGHT + 18}
              rx={NODE_RADIUS + 7}
              fill={colour}
              fillOpacity={0.12}
              className="edgewise-aura"
            />
            <rect
              x={-5}
              y={-5}
              width={NODE_WIDTH + 10}
              height={NODE_HEIGHT + 10}
              rx={NODE_RADIUS + 4}
              fill="none"
              stroke={colour}
              strokeWidth={1.5}
            />
          </motion.g>
        ) : null}

        <motion.rect
          x={-2.5}
          y={-2.5}
          width={NODE_WIDTH + 5}
          height={NODE_HEIGHT + 5}
          rx={NODE_RADIUS + 2}
          fill="none"
          stroke={colour}
          strokeWidth={1.25}
          style={{ opacity: coneRing }}
        />
        <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={NODE_RADIUS} className="fill-surface-1" />
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
      </motion.g>
    </g>
  );
}

/* -------------------------------------------------------------------------- */

export function CaptionBlock({
  caption,
  t,
  lead,
  rests,
}: {
  caption: Caption;
  t: MotionValue<number>;
  lead: string;
  rests: number;
}) {
  const opacity = useTransform(t, (value) => captionOpacity(value, caption));
  /* Rises a little as it arrives and keeps going as it leaves, so a caption
     never appears to reverse out of the way it came in. */
  const shift = useTransform(t, (value) => {
    const [from, to] = caption.at;
    return (1 - progressIn(value, [from, to])) * 18 - 9;
  });
  const blur = useTransform(opacity, (value) => `blur(${(1 - value) * 7}px)`);

  const fill = (text: string) => text.replace('{lead}', lead).replace('{rests}', String(rests));
  const hero = caption.size === 'hero';

  return (
    <motion.div
      style={{ opacity, y: shift, filter: blur }}
      className={cn(
        'pointer-events-none absolute inset-x-0 px-6 sm:px-10',
        hero ? 'bottom-[20%] text-center' : 'bottom-[9%]',
      )}
    >
      <div className={cn('mx-auto', hero ? 'max-w-3xl' : 'max-w-2xl md:mr-auto md:ml-16')}>
        {caption.kicker ? (
          <p className="text-muted-foreground mb-3 text-2xs font-medium tracking-[0.18em] uppercase">
            {fill(caption.kicker)}
          </p>
        ) : null}
        <p
          className={cn(
            'font-display text-balance',
            hero
              ? 'text-4xl leading-[1.05] font-medium tracking-tight sm:text-6xl'
              : 'text-3xl leading-[1.1] font-medium tracking-tight sm:text-5xl',
          )}
        >
          {fill(caption.line)}
        </p>
        {caption.sub ? (
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base leading-relaxed sm:mt-5 sm:text-lg">
            {fill(caption.sub)}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

/** The six bands, named once, while the whole map is on screen. */
function BandStrip({ graph, t }: { graph: ConceptGraph; t: MotionValue<number> }) {
  const opacity = useTransform(t, (value) => {
    const inward = progressIn(value, [0.53, 0.57]);
    const outward = progressIn(value, [0.64, 0.67]);
    return inward * (1 - outward);
  });

  return (
    <motion.ul
      style={{ opacity }}
      /* Down the left edge rather than across the top: the wide shot puts the
         root node at the top of the stage, and a row of labels there lands on
         it. */
      className="pointer-events-none absolute top-1/2 left-6 hidden -translate-y-1/2 flex-col gap-3 lg:flex"
      aria-hidden
    >
      {graph.bands.map((band) => (
        <li key={band.id} className="text-muted-foreground flex items-center gap-2 text-2xs tracking-wide uppercase">
          <span className="size-2 rounded-full" style={{ background: `var(--band-${band.id})` }} />
          {band.id}
        </li>
      ))}
    </motion.ul>
  );
}

/** Where you are in the five acts. A scroll this long needs a floor plan. */
function ActRail({ t }: { t: MotionValue<number> }) {
  return (
    <div className="pointer-events-none absolute top-1/2 right-5 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex" aria-hidden>
      {ACTS.map((act) => (
        <Tick key={act.id} act={act} t={t} />
      ))}
    </div>
  );
}

function Tick({ act, t }: { act: (typeof ACTS)[number]; t: MotionValue<number> }) {
  const opacity = useTransform(t, (value) => (value >= act.start && value < act.end ? 1 : 0.22));
  const height = useTransform(t, (value) => (value >= act.start && value < act.end ? 22 : 8));
  return <motion.span style={{ opacity, height }} className="bg-foreground block w-0.5 rounded-full" />;
}

function ScrollHint({ t }: { t: MotionValue<number> }) {
  const opacity = useTransform(t, (value) => 1 - progressIn(value, [0, 0.03]));
  return (
    <motion.div
      style={{ opacity }}
      className="text-muted-foreground pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 text-2xs tracking-[0.2em] uppercase"
    >
      Scroll
    </motion.div>
  );
}

/**
 * The badge, for as long as one real node is singled out.
 *
 * The sequence points at `What a 'neuron' is` and says ten things depend on it.
 * Both are true of the graph and neither is true of the person reading, and the
 * only thing standing between those two readings is this label. It stays up for
 * the whole of the dive rather than appearing once, because a disclaimer you
 * have already scrolled past is not a disclaimer.
 */
function Illustrative({ t }: { t: MotionValue<number> }) {
  const from = illustrativeFrom();
  const opacity = useTransform(t, (value) => progressIn(value, [from, from + 0.02]));

  return (
    <motion.div style={{ opacity }} className="absolute top-5 left-5 sm:left-12">
      <span className="border-border/70 bg-surface-1/80 text-muted-foreground rounded-full border px-3 py-1 text-2xs font-medium tracking-[0.14em] uppercase backdrop-blur-sm">
        {ILLUSTRATIVE_LABEL}
      </span>
    </motion.div>
  );
}

/**
 * The way in — a promise, not a result.
 *
 * The last thing said is the product's own sharpest sentence rather than a
 * finding about the viewer, because a finding is precisely what has not been
 * earned yet. What the sequence has shown is that understanding has a shape and
 * that a gap in it costs everything above; what it offers is to find where
 * yours is. Those are different claims and this is where the second one starts.
 *
 * The Skip link is present from the first frame. Nobody is ever trapped in the
 * film.
 */
function Way({ t }: { t: MotionValue<number> }) {
  const visibility = useTransform(t, value => value >= 0.945 ? 'visible' : 'hidden');
  const loud = useTransform(t, (value) => progressIn(value, [0.945, 0.99]));

  return (
    <>
      <div className="absolute top-5 right-5 sm:right-12 z-30">
        {/* Carries its own surface. Now that nothing on the map dims, a bare
            link lands on top of a fully-lit node card and both become
            unreadable — which the dimming had been hiding. */}
        <Link
          href="/"
          className="border-border/70 bg-surface-1/80 text-muted-foreground hover:text-foreground focus-visible:ring-ring/60 rounded-full border px-3 py-1 text-sm backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Open Edgewise
        </Link>
      </div>

      <motion.div
        style={{ opacity: loud, visibility }}
        className="absolute inset-x-0 bottom-[14%] flex flex-col items-center px-6 text-center"
      >
        <p className="font-display max-w-2xl text-balance text-2xl leading-[1.15] font-medium tracking-tight sm:text-4xl">
          {HANDOFF.line}
        </p>
        <p className="text-muted-foreground mt-4 max-w-lg text-base leading-relaxed">{HANDOFF.sub}</p>
        {/* A link rather than a Button with `asChild`: shadcn here is on Base
            UI, which has no `asChild`. */}
        <Link href="/" className={cn(buttonVariants({ size: 'touch' }), 'pointer-events-auto mt-7')}>
          {HANDOFF.action}
          <ArrowRightIcon />
        </Link>
      </motion.div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/** The reduced-motion page: the same argument, standing still. */
function Still({ graph, lead, rests }: { graph: ConceptGraph; lead: ConceptNode; rests: number }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display mb-8 text-3xl">How the ideas connect</h1>
      <p className="text-muted-foreground text-2xs font-medium tracking-[0.18em] uppercase">
        How AI actually works
      </p>
      <div className="mt-6 space-y-10">
        {CAPTIONS.map((caption) => (
          <section key={caption.line}>
            <h2 className="font-display text-3xl leading-[1.1] font-medium tracking-tight">
              {caption.line.replace('{rests}', String(rests)).replace('{lead}', lead.label)}
            </h2>
            {caption.sub ? (
              <p className="text-muted-foreground mt-3 text-base leading-relaxed">{caption.sub}</p>
            ) : null}
          </section>
        ))}
      </div>
      <p className="text-muted-foreground mt-10 text-base leading-relaxed">
        {graph.nodes.length} ideas. In the example above, the one somebody stops at is{' '}
        <span className="text-foreground font-medium">{lead.label}</span>, and {rests} later ideas
        depend on it.
      </p>
      <p className="font-display mt-10 text-2xl leading-[1.15] font-medium tracking-tight">
        {HANDOFF.line}
      </p>
      <p className="text-muted-foreground mt-3 text-base leading-relaxed">{HANDOFF.sub}</p>
      <Link href="/" className={cn(buttonVariants({ size: 'touch' }), 'mt-8')}>
        {HANDOFF.action}
        <ArrowRightIcon />
      </Link>
    </main>
  );
}
