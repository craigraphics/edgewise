import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { DEFAULT_MODEL, isWhitelisted, MODELS, type ModelId } from './models';

/**
 * Server-only half of the model layer: the provider, the keys, and the error
 * classification that decides whether to fall back.
 *
 * Split from `models.ts` so a client component can read the catalogue without
 * bundling the AI SDK.
 */

/** The `TUTOR_MODEL` override, applied where `process.env` actually exists. */
export function serverDefaultModel(): ModelId {
  const override = process.env.TUTOR_MODEL?.trim();
  return override && isWhitelisted(override) ? override : DEFAULT_MODEL;
}

/**
 * A provider bound to one key.
 *
 * Built per call rather than cached at module scope, because under BYOK the key
 * varies by request and a cached client would serve one learner's requests on
 * another learner's key.
 */
export function providerFor(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey: apiKey.trim() });
}

/** The operator's shared key, used when a learner has not supplied one. */
export function fallbackKey(): string | null {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) {
    console.error('[models] GOOGLE_GENERATIVE_AI_API_KEY is not set; the free path will refuse requests');
    return null;
  }
  return key;
}

/**
 * True for failures worth retrying on a different model.
 *
 * Walks the `cause` chain because the AI SDK wraps provider errors: a 429 from
 * Google surfaces as `AI_NoOutputGeneratedError`, whose message mentions neither
 * quota nor a status code. In the sibling project, matching only the outermost
 * message meant the fallback never fired on the one error it exists to handle.
 */
export function isQuotaError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);

    const record = current as { message?: unknown; name?: unknown; statusCode?: unknown; cause?: unknown };
    const message = typeof record.message === 'string' ? record.message : '';
    const name = typeof record.name === 'string' ? record.name : '';

    if (
      record.statusCode === 429 ||
      name.includes('NoOutputGenerated') ||
      message.includes('exceeded your current quota') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('rate limit') ||
      message.includes('429')
    ) {
      return true;
    }

    // AI_RetryError carries the individual attempts rather than a single cause.
    const errors = (current as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.some((nested) => isQuotaError(nested))) return true;

    current = record.cause;
  }

  return false;
}

/**
 * Provider-side overload, as distinct from running out of allowance.
 *
 * Google returns "This model is currently experiencing high demand" as a plain
 * API error with no status worth matching on. It is transient and affects every
 * model at once, so the fallback chain cannot route around it — which makes the
 * distinction worth drawing: telling someone they have used up their allowance
 * when the service is simply busy sends them looking for a problem they do not
 * have.
 */
export function isOverloadError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    const record = current as { message?: unknown; statusCode?: unknown; cause?: unknown };
    const message = typeof record.message === 'string' ? record.message : '';

    if (record.statusCode === 503 || record.statusCode === 529) return true;
    if (message.includes('high demand') || message.includes('overloaded') || message.includes('UNAVAILABLE')) {
      return true;
    }

    const errors = (current as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.some((nested) => isOverloadError(nested))) return true;

    current = record.cause;
  }

  return false;
}

/** A bad key is the learner's problem to fix, and must not trigger a fallback. */
export function isAuthError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    const record = current as { message?: unknown; statusCode?: unknown; cause?: unknown };
    const message = typeof record.message === 'string' ? record.message : '';
    if (record.statusCode === 401 || record.statusCode === 403) return true;
    if (message.includes('API key not valid') || message.includes('API_KEY_INVALID')) return true;
    current = record.cause;
  }

  return false;
}

export function tokenCostUsd(model: ModelId, inputTokens: number, outputTokens: number): number {
  const price = MODELS[model];
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
