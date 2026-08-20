import { z } from 'zod';

/**
 * The shape of the concept graph.
 *
 * The graph is hand-authored (`content/graph.json`) and is the product — the
 * diagnostic navigates a structure written in advance rather than inventing a
 * curriculum, which is what keeps a cheap model on the rails. Parsing it through
 * Zod at load time means an authoring typo fails loudly in `pnpm validate-graph`
 * rather than quietly producing a node the agent can never reach.
 */

/**
 * What we believe about the learner's grasp of one concept.
 *
 * Four states rather than a confidence score, deliberately. A graded number
 * invites the interface to show it, and showing someone a 0.4 on "do you
 * understand attention" is precisely the interrogation tone that kills this
 * product. Four states also keep the assessor's job coarse enough to calibrate.
 *
 * `blocked` is distinct from `unexplored`: it means we probed and found the
 * learner does not have it, whereas `unexplored` means we have not asked.
 */
export const nodeState = z.enum(['known', 'shaky', 'blocked', 'unexplored']);
export type NodeState = z.infer<typeof nodeState>;

export const conceptNode = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Fuller framing for the detail panel. The map label has to fit its box; this is where the phrasing that primes the misconception lives. */
  subtitle: z.string().min(1),
  band: z.string().min(1),
  /**
   * Depth in the prerequisite DAG, and the node's position down the rendered
   * map. Authored by hand but asserted against the computed longest path in
   * `validate-graph`, so the drawing cannot drift from the actual structure.
   */
  layer: z.number().int().min(0),
  /** Horizontal position within the layer. Hand-placed to keep edges legible. */
  row: z.number().int(),
  prerequisites: z.array(z.string()),
  /**
   * Diagnostic questions. Phrased to make the learner APPLY or PREDICT rather
   * than define — someone can recite a definition of overfitting without ever
   * having had the idea, and a definition-shaped probe cannot tell the two
   * apart.
   */
  probes: z.array(z.string().min(1)).min(1),
  /**
   * Wrong models people actually hold, not merely absent knowledge. Tracked
   * separately because they need opposite treatment: a learner with no model
   * picks the idea up quickly, while one with a wrong model has to drop it
   * first, and teaching on top of it produces confident nonsense.
   */
  misconceptions: z.array(z.string().min(1)),
  explanations: z.object({
    intuition: z.string().min(1),
    example: z.string().min(1),
  }),
  /**
   * What this node's intuitive telling gets wrong, or null when it is honest.
   *
   * A simplification labelled with its cost is a ladder; unlabelled, it becomes
   * a misconception the learner has to be rescued from later. The rubber-sheet
   * picture of gravity is the canonical example of the unlabelled kind.
   */
  simplificationCost: z.string().min(1).nullable(),
});
export type ConceptNode = z.infer<typeof conceptNode>;

export const conceptGraph = z.object({
  /**
   * Bumped when node content changes materially. The learner model is keyed on
   * it, so a bump resets stored state rather than leaving someone with marks
   * against probes that no longer exist.
   */
  version: z.number().int().positive(),
  subject: z.string().min(1),
  description: z.string().min(1),
  bands: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
  nodes: z.array(conceptNode).min(1),
});
export type ConceptGraph = z.infer<typeof conceptGraph>;

/** Learner state: node id -> what we believe. Absent means `unexplored`. */
export type LearnerModel = {
  graphVersion: number;
  states: Record<string, NodeState>;
};
