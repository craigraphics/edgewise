import { generateObject, type ModelMessage } from 'ai';
import { z } from 'zod';

import type { ConceptNode } from '@/lib/graph/types';
import { fallbackChain, type ModelId } from '@/lib/models';
import { isAuthError, isOverloadError, isQuotaError, providerFor, serverDefaultModel, tokenCostUsd } from '@/lib/provider';

import { ModelUnavailableError } from './decide';

/**
 * The only place the walkthrough reaches for a model.
 *
 * Steps themselves are authored and read out verbatim — instant, free, and
 * reviewed by a person before anyone hears them. This handles the two things
 * that cannot be written in advance: saying the same idea more plainly, and
 * answering whatever the learner just asked.
 *
 * The constraint that matters: it is given the authored explanation and told to
 * work from it. It rephrases and connects; it does not introduce content. That
 * keeps the reviewable-content property intact for the parts that carry the
 * actual teaching, and confines the model to the parts where being wrong is
 * recoverable.
 */

const reworded = z.object({
  /**
   * True when the honest answer is "that is not something I can tell you from
   * what I have here".
   *
   * A schema that cannot express this forces a small model to invent something,
   * and inventing is the worst thing this product can do — the learner came
   * precisely because they cannot tell when it is wrong.
   */
  outsideWhatIKnow: z.boolean(),
  say: z.string().min(1).max(900),
});

type Args = {
  apiKey: string;
  chosenModel: ModelId;
  byok: boolean;
  node: ConceptNode;
  mode: 'simpler' | 'question';
  /** The learner's question, when they asked one. */
  question: string | null;
  /** What has already been said about this node, so it is not simply repeated. */
  alreadySaid: string;
};

export type RewordResult = { say: string; model: ModelId; costUsd: number; latencyMs: number };

function prompt(args: Args): string {
  const { node, mode } = args;

  return `You are walking someone through "${node.label}" — ${node.subtitle}. They are listening, and they have just interrupted.

## What you are allowed to work from

This is the reviewed explanation of this idea. Everything you say must come from it:

> ${node.explanations.intuition}
>
> ${node.explanations.example}
${node.simplificationCost ? `\n> A known cost of telling it this way: ${node.simplificationCost}\n` : ''}
## What you have already said

${args.alreadySaid}

## What they want now

${
  mode === 'simpler'
    ? `**They asked for it simpler.** Say the same idea again with less machinery — a concrete everyday case, shorter sentences, no terminology they have not already been given. Do NOT just repeat what you said with a few words swapped; find a different way in.

Asking for simpler is the most useful thing anyone does in a conversation like this. Never treat it as a failure, never say "as I mentioned", and never apologise for having been unclear — just give them the better version.`
    : `**They asked a question.** Answer it, briefly, from the explanation above.`
}

## Rules

- Two or three sentences. They are listening, not reading.
- Plain speech. No headings, no bullet points, no markdown.
- **Do not introduce facts that are not in the explanation above.** If answering properly needs something that is not there, set \`outsideWhatIKnow\` to true and say plainly that it goes past what you can tell them here. Saying so is always better than inventing something — they came to you precisely because they cannot yet tell the difference.
- Never score them, never refer to how they did earlier, never mention that any of this is being tracked.`;
}

export async function reword(args: Args): Promise<RewordResult> {
  const google = providerFor(args.apiKey);
  const chain = fallbackChain(args.chosenModel ?? serverDefaultModel(), args.byok);

  const messages: ModelMessage[] = [
    { role: 'user', content: args.question?.trim() || 'Could you put that more simply?' },
  ];

  let lastError: unknown;

  for (const model of chain) {
    const startedAt = Date.now();
    try {
      const result = await generateObject({
        model: google(model),
        schema: reworded,
        system: prompt(args),
        messages,
        // Reasoning tokens count against this; a tight cap yields truncation.
        maxOutputTokens: 1200,
        maxRetries: 0,
      });

      return {
        say: result.object.say,
        model,
        costUsd: tokenCostUsd(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (isAuthError(error)) throw new ModelUnavailableError('auth');
      if (!isQuotaError(error) && !isOverloadError(error)) console.error(`[reword] ${model} failed:`, error);
    }
  }

  throw new ModelUnavailableError(
    isQuotaError(lastError) ? 'quota' : isOverloadError(lastError) ? 'busy' : 'failed',
  );
}
