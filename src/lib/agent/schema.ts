import { z } from 'zod';

/**
 * The one decision the model is allowed to make per turn.
 *
 * The spec's constrained action set exists to stop the model roaming: it
 * navigates a structure authored in advance rather than inventing a curriculum.
 * This is that idea in its narrowest workable form — the model judges one answer
 * and phrases one question, and every question it can ask was written by a human
 * and handed to it in the same request.
 *
 * Deliberately NOT tool calling. There is no tool to execute; we want exactly
 * one schema-validated decision, and a tool loop would add a round trip and a
 * failure mode for nothing.
 *
 * `advance` is absent on purpose. Which node comes next is derived in code from
 * the graph and the marks (`nextToAsk`), because it is a fact rather than a
 * judgement — letting a model decide it would put the one thing this product
 * exists to get right behind a non-deterministic call.
 */
export const decision = z.object({
  /**
   * Did their latest message actually address the question?
   *
   * Asked BEFORE the verdict, and that ordering is the point: `generateObject`
   * fills fields in schema order, so the model has to commit to this before it
   * can choose. Instructing a small model to "check whether they answered" and
   * hoping it does is what produced a run of false passes; making the check a
   * field it must fill is structural rather than hopeful.
   */
  answeredTheQuestion: z.boolean(),

  /**
   * The mechanism they described, in their own words — or null if they only
   * named things.
   *
   * The single most useful field in this schema. "It is an autoregressive
   * transformer trained with a causal language modelling objective" is entirely
   * correct and describes no mechanism, and a model asked to write the mechanism
   * down has to notice there isn't one. The route then refuses to record `known`
   * when this is null, so the check is enforced in code rather than trusted.
   */
  mechanismDescribed: z.string().min(1).max(300).nullable(),

  /**
   * What the learner's last answer showed about the node just asked about.
   *
   * `unclear` is a first-class option rather than a fudge. A schema that cannot
   * express uncertainty forces the model to fabricate one — the sibling project
   * had to explicitly permit an empty `strengths` array before its grader would
   * stop manufacturing a compliment for a bad answer.
   */
  verdict: z.enum(['known', 'shaky', 'blocked', 'unclear']),

  /**
   * The specific thing they said that supports the verdict, in their own words
   * where possible.
   *
   * Never shown to the learner. It exists so a wrong mark can be traced to what
   * caused it, and so `pnpm calibrate` can check the model is reading rather
   * than pattern-matching on answer length.
   */
  because: z.string().min(1).max(400),

  /** True when their answer carried one of the node's authored misconceptions. */
  misconception: z.boolean(),

  /**
   * What to say to the learner. This is the only free text they ever see, and
   * the only place the model has real latitude.
   */
  say: z.string().min(1).max(600),
});

export type Decision = z.infer<typeof decision>;

/** The verdicts that settle a node. `unclear` keeps us on it for one follow-up. */
export const SETTLES = ['known', 'shaky', 'blocked'] as const;

/**
 * The overlap between a verdict and a stored node state.
 *
 * They are deliberately different vocabularies: a verdict can be `unclear`,
 * which is a fact about the answer and never a fact about the learner, and a
 * state can be `unexplored`, which the model is never allowed to assert.
 */
export type SettledState = (typeof SETTLES)[number];
