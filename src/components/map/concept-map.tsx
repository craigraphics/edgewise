'use client';

import { useMemo } from 'react';

import { indexNodes, leadNode, stateOf } from '@/lib/graph/frontier';
import type { ConceptGraph, ConceptNode, LearnerModel, NodeState } from '@/lib/graph/types';

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
 * artefact.
 */

const NODE_WIDTH = 150;
const NODE_HEIGHT = 46;
const ROW_GAP = 162;
const LAYER_GAP = 96;
const PADDING = 28;

type Point = { x: number; y: number };

function centreOf(node: ConceptNode, minRow: number): Point {
  return {
    x: PADDING + (node.row - minRow) * ROW_GAP + NODE_WIDTH / 2,
    y: PADDING + node.layer * LAYER_GAP + NODE_HEIGHT / 2,
  };
}

/**
 * A vertical cubic curve between two nodes.
 *
 * Curved rather than straight because with 33 edges over 10 layers, straight
 * lines through intermediate rows are ambiguous about which node they touch.
 * The control points sit at the midpoint height, so an edge leaves the bottom of
 * one node and arrives at the top of the next regardless of horizontal offset.
 */
function edgePath(from: Point, to: Point): string {
  const start = { x: from.x, y: from.y + NODE_HEIGHT / 2 };
  const end = { x: to.x, y: to.y - NODE_HEIGHT / 2 };
  const midway = start.y + (end.y - start.y) / 2;
  return `M ${start.x} ${start.y} C ${start.x} ${midway}, ${end.x} ${midway}, ${end.x} ${end.y}`;
}

/**
 * How each state draws.
 *
 * The vocabulary is deliberately not a traffic light. `blocked` is drawn as
 * waiting rather than failed — muted and outlined, never red — because the whole
 * product dies if the map reads as a scorecard of what you got wrong. Red is
 * reserved for nothing.
 */
const STATE_STYLE: Record<NodeState, { fillOpacity: number; strokeDash?: string; textClass: string }> = {
  known: { fillOpacity: 0.9, textClass: 'fill-background' },
  shaky: { fillOpacity: 0.28, strokeDash: '5 3', textClass: 'fill-foreground' },
  blocked: { fillOpacity: 0.07, strokeDash: '2 4', textClass: 'fill-muted-foreground' },
  unexplored: { fillOpacity: 0.05, textClass: 'fill-muted-foreground' },
};

type Props = {
  graph: ConceptGraph;
  model: LearnerModel;
  onSelect?: (node: ConceptNode) => void;
  selectedId?: string | null;
  /** Nodes the walkthrough has already been through. */
  covered?: ReadonlySet<string>;
};

export function ConceptMap({ graph, model, onSelect, selectedId, covered }: Props) {
  const layout = useMemo(() => {
    const index = indexNodes(graph);
    const minRow = Math.min(...graph.nodes.map((node) => node.row));
    const maxRow = Math.max(...graph.nodes.map((node) => node.row));
    const maxLayer = Math.max(...graph.nodes.map((node) => node.layer));

    const points = new Map(graph.nodes.map((node) => [node.id, centreOf(node, minRow)]));

    const edges = graph.nodes.flatMap((node) =>
      node.prerequisites
        .filter((id) => index.has(id))
        .map((id) => ({ id: `${id}->${node.id}`, from: id, to: node.id })),
    );

    return {
      points,
      edges,
      width: PADDING * 2 + (maxRow - minRow) * ROW_GAP + NODE_WIDTH,
      height: PADDING * 2 + maxLayer * LAYER_GAP + NODE_HEIGHT,
    };
  }, [graph]);

  const lead = leadNode(graph, model);

  return (
    // Wide content scrolls inside its own container so the page body never does.
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        /*
         * Scales down to fit its pane, with a floor, then scrolls.
         *
         * Rendering at fixed size clipped the right-hand column mid-node, which
         * reads as a broken drawing rather than as something scrollable. Pure
         * scaling is no better on a tablet — at that width the 10.5px labels
         * drop below legibility — so it shrinks only as far as the floor and
         * scrolls after that.
         */
        style={{ minWidth: Math.min(layout.width, 760), maxWidth: layout.width }}
        className="block h-auto w-full"
      >
        <g>
          {layout.edges.map((edge) => {
            const from = layout.points.get(edge.from)!;
            const to = layout.points.get(edge.to)!;
            /*
             * An edge is drawn as satisfied only when the prerequisite is known.
             * That makes the blocked region of the map legible at a glance —
             * you can see the solid path you are standing on stop, and the faint
             * ones beyond it waiting.
             */
            const satisfied = stateOf(model, edge.from) === 'known';
            return (
              <path
                key={edge.id}
                d={edgePath(from, to)}
                fill="none"
                className={satisfied ? 'stroke-foreground/55' : 'stroke-foreground/15'}
                strokeWidth={satisfied ? 1.8 : 1.2}
              />
            );
          })}
        </g>

        <g>
          {graph.nodes.map((node) => {
            const point = layout.points.get(node.id)!;
            const state = stateOf(model, node.id);
            const style = STATE_STYLE[state];
            const colour = `var(--band-${node.band})`;
            const isLead = lead?.id === node.id;
            const isSelected = selectedId === node.id;
            const isCovered = covered?.has(node.id) ?? false;

            return (
              <g
                key={node.id}
                transform={`translate(${point.x - NODE_WIDTH / 2}, ${point.y - NODE_HEIGHT / 2})`}
                onClick={onSelect ? () => onSelect(node) : undefined}
                className={onSelect ? 'cursor-pointer' : undefined}
              >
                {/*
                 * The lead node gets a halo rather than a label saying "you are
                 * here". Wording that names the gap is where the interrogation
                 * tone creeps in; a highlight says the same thing without
                 * grading anyone.
                 */}
                {isLead && (
                  <rect
                    x={-5}
                    y={-5}
                    width={NODE_WIDTH + 10}
                    height={NODE_HEIGHT + 10}
                    rx={12}
                    fill="none"
                    stroke={colour}
                    strokeWidth={2}
                    opacity={0.45}
                  />
                )}
                {/*
                 * An opaque base under every box.
                 *
                 * The state fills run as low as 5% opacity, so edges passing
                 * behind a box showed straight through the label and made it
                 * hard to read. Painting the page background first keeps the
                 * box reading as a solid object without changing any of the
                 * state colours on top of it.
                 */}
                <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={8} fill="var(--background)" />
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={colour}
                  fillOpacity={style.fillOpacity}
                  stroke={colour}
                  strokeWidth={isSelected ? 2.2 : 1.3}
                  strokeOpacity={state === 'unexplored' ? 0.4 : 0.85}
                  strokeDasharray={style.strokeDash}
                />
                {/*
                 * Covered nodes get a mark rather than a fifth colour.
                 *
                 * "Has been explained to you" is a different axis from "do you
                 * have it" — someone can be walked through an idea and still
                 * not hold it — so it must not overwrite the four states the
                 * map already carries.
                 */}
                {isCovered ? (
                  <circle cx={NODE_WIDTH - 9} cy={9} r={2.6} fill={colour} fillOpacity={0.95} />
                ) : null}
                <text
                  x={NODE_WIDTH / 2}
                  y={NODE_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`${style.textClass} text-[10.5px] font-medium`}
                >
                  {truncate(node.label)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/** SVG text does not wrap. Labels are authored short; this is the safety net. */
function truncate(label: string, max = 24): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}
