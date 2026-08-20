import { generateObject } from 'ai';
import { z } from 'zod';

import type { ConceptNode, NodeState } from '@/lib/graph/types';
import { fallbackChain, type ModelId } from '@/lib/models';
import { isAuthError, isOverloadError, isQuotaError, providerFor, serverDefaultModel, tokenCostUsd } from '@/lib/provider';

import { ModelUnavailableError } from './decide';

/**
 * Judging an explanation the learner produced themselves.
 *
 * This is the ONLY thing that can clear a block. Being walked through an idea
 * changes nothing, because listening to a good explanation feels almost exactly
 * like understanding one — and a map that could not tell those apart would be
 * confidently wrong about the one thing it exists to be right about.
 *
 * Deliberately separate from `decide`. The diagnostic asks a probe and reads a
 * reply; this reads an explanation offered unprompted, and the bar is different:
 * there is no question to have answered, only a mechanism to have conveyed.
 */

const assessment = z.object({
  /**
   * The mechanism they conveyed, in their words — or null if they only named
   * things.
   *
   * First in the schema on purpose. `generateObject` fills fields in order, so
   * the model must write the mechanism down before it can pick a verdict, and
   * `settleExplanation` then holds it to what it wrote. Prompt-only versions of
   * this rule measurably drifted; a required field does not.
   */
  mechanismDescribed: z.string().min(1).max(400).nullable(),

  /** True when the explanation carries one of the node's recorded wrong models. */
  carriesMisconception: z.boolean(),

  verdict: z.enum(['solid', 'partly', 'not-yet']),

  /**
   * What to say back. Specific about what is missing, never a grade.
   *
   * The most delicate text in the product: someone has just tried to explain
   * something out loud, which takes nerve, and the response decides whether they
   * ever do it again.
   */
  say: z.string().min(1).max(700),
});

export type Assessment = z.infer<typeof assessment>;

/**
 * Verdict reconciled against the model's own two checks.
 *
 * `solid` requires a mechanism AND no misconception. Fluent, accurate-sounding
 * vocabulary is the easiest thing in the world to produce without understanding,
 * and a wrong model has to be dropped before anything can be built on it.
 */
export function settleExplanation(result: Assessment): { state: NodeState; overridden: boolean } {
  if (result.verdict === 'solid' && result.mechanismDescribed !== null && !result.carriesMisconception) {
    return { state: 'known', overridden: false };
  }
  if (result.verdict === 'solid') {
    // It said solid and then failed its own checks.
    return { state: 'shaky', overridden: true };
  }
  return { state: result.verdict === 'partly' ? 'shaky' : 'blocked', overridden: false };
}

type Args = {
  apiKey: string;
  chosenModel: ModelId;
  byok: boolean;
  node: ConceptNode;
  explanation: string;
};

export type ExplainBackResult = {
  assessment: Assessment;
  state: NodeState;
  model: ModelId;
  costUsd: number;
  latencyMs: number;
};

function prompt(node: ConceptNode): string {
  return `Someone is explaining "${node.label}" back to you in their own words, to see whether they have actually got it. They volunteered this. That takes some nerve, and how you respond decides whether they ever do it again.

## What the idea actually is

${node.explanations.intuition}

${node.explanations.example}
${
  node.misconceptions.length
    ? `\n## Wrong models people hold here\n\nIf their explanation carries one of these, set \`carriesMisconception\`. A wrong model is not the same as an empty one — it has to be dropped before anything can be built on top, so it cannot count as solid however fluently it is expressed.\n\n${node.misconceptions.map((m) => `- ${m}`).join('\n')}\n`
    : ''
}${node.simplificationCost ? `\n## A known cost of the simple telling\n\n${node.simplificationCost}\n\nDo NOT hold this against them. Giving the simple version is fine; it is what they were taught.\n` : ''}
## What to work out

**\`mechanismDescribed\`** — write down the mechanism they conveyed, in their own words. If they only NAMED things without saying what any of them do, write null. Correct terminology is not understanding: "it is a weighted sum passed through a non-linearity" names the parts, and unless they said what that achieves, it is null.

**\`verdict\`**
- \`solid\` — they have it. **They do not need your vocabulary, they do not need to be complete, and they do not need to be elegant.** Someone explaining it clumsily in everyday words has understood more than someone reciting the right terms. If they could clearly apply it to a case they have not seen, that is solid.
- \`partly\` — the shape is right but a load-bearing piece is missing or wrong.
- \`not-yet\` — the mechanism is not there, or the explanation is mostly the words.

## What to say back

Two or three sentences, spoken plainly. No headings, no markdown.

- **Lead with the part they got right, and be specific about it.** Not "good job" — name the actual thing they understood.
- If something is missing, say precisely what, in one sentence. That is the useful part.
- **Never score them. Never say correct, wrong, right, or nearly.** Never mention that anything is being recorded or unlocked.
- If they carried a misconception, correct it plainly and without embarrassment — say what the better picture is, not that they were wrong.
- Never suggest they try again. Trying is theirs to choose.`;
}

export async function explainBack(args: Args): Promise<ExplainBackResult> {
  const google = providerFor(args.apiKey);
  const chain = fallbackChain(args.chosenModel ?? serverDefaultModel(), args.byok);
  let lastError: unknown;

  for (const model of chain) {
    const startedAt = Date.now();
    try {
      const result = await generateObject({
        model: google(model),
        schema: assessment,
        system: prompt(args.node),
        messages: [{ role: 'user', content: args.explanation }],
        maxOutputTokens: 1200,
        maxRetries: 0,
      });

      return {
        assessment: result.object,
        state: settleExplanation(result.object).state,
        model,
        costUsd: tokenCostUsd(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (isAuthError(error)) throw new ModelUnavailableError('auth');
      if (!isQuotaError(error) && !isOverloadError(error)) console.error(`[explain-back] ${model} failed:`, error);
    }
  }

  throw new ModelUnavailableError(
    isQuotaError(lastError) ? 'quota' : isOverloadError(lastError) ? 'busy' : 'failed',
  );
}
