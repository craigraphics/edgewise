import type { ConceptGraph, ConceptNode, LearnerModel, NodeState } from './types';

/**
 * Deriving where the learner actually is, from the graph plus what we believe.
 *
 * Everything here is pure arithmetic over the graph — no model involved. That is
 * deliberate: which node is blocking someone is a fact about the prerequisite
 * structure and the marks, not a judgement call, and letting a model decide it
 * would put the one thing the product exists to get right behind a
 * non-deterministic call.
 */

export function stateOf(model: LearnerModel, nodeId: string): NodeState {
  return model.states[nodeId] ?? 'unexplored';
}

export function emptyModel(graph: ConceptGraph): LearnerModel {
  return { graphVersion: graph.version, states: {} };
}

/** Index by id once; every traversal below wants it. */
export function indexNodes(graph: ConceptGraph): Map<string, ConceptNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

/**
 * Nodes the learner is ready to be asked about: not yet established, but with
 * every prerequisite already `known`.
 *
 * `shaky` counts as ready rather than settled — a half-held idea is exactly what
 * is worth returning to, and treating it as done is how a diagnostic walks
 * someone past the thing that was blocking them.
 *
 * A `shaky` PREREQUISITE, though, does not open its dependants. Building on a
 * foundation we already suspect is the failure this product exists to prevent.
 */
export function frontier(graph: ConceptGraph, model: LearnerModel): ConceptNode[] {
  return graph.nodes.filter((node) => {
    const state = stateOf(model, node.id);
    if (state === 'known') return false;
    return node.prerequisites.every((id) => stateOf(model, id) === 'known');
  });
}

/**
 * The single node to lead with, or null when the map is complete.
 *
 * Shallowest first, then by authored row, so the lead is stable across renders
 * and reads left-to-right in the drawing. Ties broken deterministically on
 * purpose — a frontier that reshuffles between turns makes the map untrustworthy
 * even when the underlying state has not changed.
 *
 * `blocked` and `shaky` outrank `unexplored` at equal depth: we have evidence
 * those are in the learner's way, whereas an unexplored node is only a guess.
 */
export function leadNode(graph: ConceptGraph, model: LearnerModel): ConceptNode | null {
  const candidates = frontier(graph, model);
  if (candidates.length === 0) return null;

  const rank = (node: ConceptNode) => (stateOf(model, node.id) === 'unexplored' ? 1 : 0);

  return [...candidates].sort(
    (a, b) => rank(a) - rank(b) || a.layer - b.layer || a.row - b.row || a.id.localeCompare(b.id),
  )[0];
}

/**
 * Nodes that are out of reach because something underneath them is missing.
 *
 * These are what make the map worth looking at. Being told "you do not have
 * attention yet" is uninteresting; seeing that six later concepts are all
 * waiting on it is the recognition moment the whole POC is testing for.
 */
export function downstreamOf(graph: ConceptGraph, nodeId: string): ConceptNode[] {
  const index = indexNodes(graph);
  const reached = new Set<string>();

  const visit = (id: string) => {
    for (const node of graph.nodes) {
      if (!node.prerequisites.includes(id) || reached.has(node.id)) continue;
      reached.add(node.id);
      visit(node.id);
    }
  };

  visit(nodeId);
  return [...reached].map((id) => index.get(id)!).sort((a, b) => a.layer - b.layer || a.row - b.row);
}

/**
 * The next node to ASK about, or null when placement is finished.
 *
 * Deliberately not the same question as `leadNode`. That one answers "what
 * should we SHOW them as the thing unlocking the rest", and prefers nodes we
 * already have evidence about. This one answers "what is still worth asking",
 * and so considers only `unexplored` nodes — once a node is marked shaky or
 * blocked we have learned what the diagnostic needed, and re-asking it is the
 * interrogation the sibling project's interviewer was rightly criticised for.
 *
 * Returning null is the session's termination condition, and it is computed
 * here rather than judged by a model: whether there is anything left to ask is
 * a fact about the graph and the marks.
 */
export function nextToAsk(graph: ConceptGraph, model: LearnerModel): ConceptNode | null {
  const open = frontier(graph, model).filter((node) => stateOf(model, node.id) === 'unexplored');
  if (open.length === 0) return null;

  return [...open].sort((a, b) => a.layer - b.layer || a.row - b.row || a.id.localeCompare(b.id))[0];
}

/**
 * The model with one mark applied. Pure, so the caller can ask "what would come
 * next if they turn out to know this" without mutating anything.
 *
 * `unexplored` removes the mark rather than storing it — the absence of a mark
 * is what "we have not asked" means, and storing it would make that
 * indistinguishable from "we asked and they had not met it".
 */
export function withMark(model: LearnerModel, nodeId: string, state: NodeState): LearnerModel {
  const states = { ...model.states };
  if (state === 'unexplored') delete states[nodeId];
  else states[nodeId] = state;
  return { ...model, states };
}

/** Coverage for the "where am I" readout. Counts `known` only — see note above. */
export function progress(graph: ConceptGraph, model: LearnerModel) {
  const known = graph.nodes.filter((node) => stateOf(model, node.id) === 'known').length;
  return { known, total: graph.nodes.length };
}
