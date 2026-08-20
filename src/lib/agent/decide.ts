import { generateObject, type ModelMessage } from 'ai';

import { fallbackChain, type ModelId } from '@/lib/models';
import { isAuthError, isOverloadError, isQuotaError, providerFor, serverDefaultModel, tokenCostUsd } from '@/lib/provider';

import { buildTutorPrompt } from './instructions';
import { decision, type Decision } from './schema';

type Args = Parameters<typeof buildTutorPrompt>[0] & {
  apiKey: string;
  chosenModel: ModelId;
  /** True when the learner supplied their own key, unlocking the paid-quota models. */
  byok: boolean;
  history: ModelMessage[];
};

export type DecisionResult = {
  decision: Decision;
  model: ModelId;
  costUsd: number;
  latencyMs: number;
};

export class ModelUnavailableError extends Error {
  constructor(readonly reason: 'quota' | 'auth' | 'busy' | 'failed') {
    super(reason);
    this.name = 'ModelUnavailableError';
  }
}

/**
 * One turn: judge the last answer, produce the next thing to say.
 *
 * Tries models in order until one answers. Falling back keeps a session alive
 * rather than ending it mid-question with a stack trace — Google's free tier
 * meters each model separately and meters the good ones hard.
 */
export async function decide(args: Args): Promise<DecisionResult> {
  const { apiKey, chosenModel, byok, history, ...promptArgs } = args;

  const google = providerFor(apiKey);
  const chain = fallbackChain(chosenModel ?? serverDefaultModel(), byok);
  let lastError: unknown;

  for (const model of chain) {
    const startedAt = Date.now();

    try {
      const result = await generateObject({
        model: google(model),
        schema: decision,
        system: buildTutorPrompt(promptArgs),
        messages: history,
        /*
         * Reasoning tokens count against this cap. Measured in the sibling
         * project: at 220 tokens, the flagship spent 212 thinking and emitted
         * four characters of truncated garbage. Brevity is enforced in the
         * prompt instead, where it can be reasoned about.
         */
        maxOutputTokens: 1200,
        /*
         * The SDK default of three retries burns three requests of a small free
         * allowance against a model that has already said no. Falling back to a
         * different model is the useful retry.
         */
        maxRetries: 0,
      });

      return {
        decision: result.object,
        model,
        costUsd: tokenCostUsd(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;

      // A bad key is the learner's to fix. Trying other models would burn
      // quota and report a confusing failure.
      if (isAuthError(error)) throw new ModelUnavailableError('auth');

      if (!isQuotaError(error) && !isOverloadError(error)) {
        console.error(`[decide] ${model} failed:`, error);
      }
      // Otherwise fall through to the next model in the chain.
    }
  }

  // Overload is not worth a stack trace: it is transient, it hits every model
  // at once, and the chain cannot route around it.
  if (isOverloadError(lastError)) console.warn('[decide] every model is busy');
  else console.error('[decide] every model in the chain refused:', lastError);
  throw new ModelUnavailableError(
    isQuotaError(lastError) ? 'quota' : isOverloadError(lastError) ? 'busy' : 'failed',
  );
}
