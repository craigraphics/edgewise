import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { conceptGraph, type ConceptGraph, type ConceptNode } from '../src/lib/graph/types';

/**
 * Structural checks on the hand-authored graph.
 *
 * The graph is the product, and a wrong prerequisite edge is this project's
 * worst quiet failure: the system routes someone down a bad path with all the
 * authority of a clean visual map behind it. Confidently wrong is worse than
 * vague. None of these checks can tell you whether an edge is pedagogically
 * RIGHT — that needs a human against a real curriculum — but they catch every
 * way the file can be internally inconsistent.
 *
 * Run with: pnpm validate-graph
 */

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

function checkUniqueIds(graph: ConceptGraph) {
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (seen.has(node.id)) fail(`duplicate node id: ${node.id}`);
    seen.add(node.id);
  }
}

function checkEdgesResolve(graph: ConceptGraph, index: Map<string, ConceptNode>) {
  for (const node of graph.nodes) {
    for (const prerequisite of node.prerequisites) {
      if (!index.has(prerequisite)) {
        fail(`${node.id} requires "${prerequisite}", which is not a node`);
      }
      if (prerequisite === node.id) fail(`${node.id} lists itself as a prerequisite`);
    }
  }
}

function checkBandsResolve(graph: ConceptGraph) {
  const bands = new Set(graph.bands.map((band) => band.id));
  for (const node of graph.nodes) {
    if (!bands.has(node.band)) fail(`${node.id} is in band "${node.band}", which is not declared`);
  }
  const used = new Set(graph.nodes.map((node) => node.band));
  for (const band of bands) {
    if (!used.has(band)) fail(`band "${band}" is declared but empty`);
  }
}

/**
 * Depth-first cycle detection. A cycle in a prerequisite graph is unrecoverable
 * — the frontier would be empty forever and the diagnostic could never start.
 */
function checkAcyclic(graph: ConceptGraph, index: Map<string, ConceptNode>) {
  const visiting = new Set<string>();
  const done = new Set<string>();

  const visit = (id: string, trail: string[]) => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      fail(`cycle: ${[...trail, id].join(' -> ')}`);
      return;
    }
    visiting.add(id);
    for (const prerequisite of index.get(id)?.prerequisites ?? []) {
      if (index.has(prerequisite)) visit(prerequisite, [...trail, id]);
    }
    visiting.delete(id);
    done.add(id);
  };

  for (const node of graph.nodes) visit(node.id, []);
}

/**
 * The authored `layer` must equal the longest path from a root.
 *
 * This is the check that stops the drawing drifting from the structure. Adding a
 * prerequisite without moving the node would otherwise render an edge pointing
 * backwards up the map — which reads as a mistake in the subject rather than a
 * mistake in the file, and quietly undermines the one artefact the POC is
 * testing.
 */
function checkLayers(graph: ConceptGraph, index: Map<string, ConceptNode>) {
  const depth = new Map<string, number>();

  const compute = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const node = index.get(id);
    if (!node) return 0;
    // Provisional value guards against infinite recursion if a cycle slipped
    // through; checkAcyclic reports the cycle itself.
    depth.set(id, 0);
    const value = node.prerequisites.length
      ? Math.max(...node.prerequisites.map((prerequisite) => compute(prerequisite) + 1))
      : 0;
    depth.set(id, value);
    return value;
  };

  for (const node of graph.nodes) {
    const expected = compute(node.id);
    if (node.layer !== expected) {
      fail(`${node.id} is authored at layer ${node.layer} but its prerequisites put it at ${expected}`);
    }
  }
}

/** Two nodes at the same spot would render on top of each other. */
function checkCoordinates(graph: ConceptGraph) {
  const seen = new Map<string, string>();
  for (const node of graph.nodes) {
    const key = `${node.layer}:${node.row}`;
    const other = seen.get(key);
    if (other) fail(`${node.id} and ${other} both sit at layer ${node.layer}, row ${node.row}`);
    seen.set(key, node.id);
  }
}

/**
 * Reports rather than fails. A concept with no misconception recorded is
 * suspicious in this subject — the domain was chosen because its popular
 * explanations are so reliably wrong — but it is a judgement call, not an error.
 */
function reportAuthoringGaps(graph: ConceptGraph) {
  const noMisconceptions = graph.nodes.filter((node) => node.misconceptions.length === 0);
  const oneProbe = graph.nodes.filter((node) => node.probes.length < 2);

  if (noMisconceptions.length) {
    console.log(`  note: no misconceptions authored for ${noMisconceptions.map((n) => n.id).join(', ')}`);
  }
  if (oneProbe.length) {
    console.log(`  note: only one probe for ${oneProbe.map((n) => n.id).join(', ')}`);
  }
}

function main() {
  const path = join(process.cwd(), 'content/graph.json');
  const parsed = conceptGraph.safeParse(JSON.parse(readFileSync(path, 'utf8')));

  if (!parsed.success) {
    console.error('graph.json does not match the schema:\n');
    console.error(parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
    process.exit(1);
  }

  const graph = parsed.data;
  const index = new Map(graph.nodes.map((node) => [node.id, node]));

  checkUniqueIds(graph);
  checkEdgesResolve(graph, index);
  checkBandsResolve(graph);
  checkAcyclic(graph, index);
  checkLayers(graph, index);
  checkCoordinates(graph);

  const roots = graph.nodes.filter((node) => node.prerequisites.length === 0);
  const edges = graph.nodes.reduce((sum, node) => sum + node.prerequisites.length, 0);
  const labelled = graph.nodes.filter((node) => node.simplificationCost !== null).length;

  console.log(`graph v${graph.version} — ${graph.subject}`);
  console.log(`  ${graph.nodes.length} nodes, ${edges} edges, ${graph.bands.length} bands`);
  console.log(`  ${roots.length} root(s): ${roots.map((n) => n.id).join(', ')}`);
  console.log(`  depth: ${Math.max(...graph.nodes.map((n) => n.layer)) + 1} layers`);
  console.log(`  ${labelled}/${graph.nodes.length} nodes declare a simplification cost`);
  reportAuthoringGaps(graph);

  if (failures.length) {
    console.error(`\n${failures.length} problem(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('\nOK — structure is internally consistent.');
  console.log('This does NOT check whether the prerequisite edges are pedagogically right.');
}

main();
