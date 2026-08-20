/**
 * The model catalogue — whitelist, pricing, and the fallback order.
 *
 * Pure data with no provider import, because the browser needs this to render
 * the model picker and must not drag the AI SDK into its bundle to do it. The
 * provider itself, and the error classification that goes with it, live in
 * `provider.ts` and are server-only.
 *
 * Ported from a sibling project's model layer.
 *
 * Google AI Studio direct, for the same reason as the sibling project: its free
 * tier needs no card and does not expire, which is the only thing that makes a
 * free fallback possible at all. Vercel's AI Gateway refuses to serve even its
 * own free credits until a card is on file.
 *
 * The difference here is that the key is not always the operator's. A learner
 * may bring their own, and then this module is handed that key per request
 * rather than reading the environment.
 */

/**
 * Models this app will talk to.
 *
 * The spec called for whitelisting *frontier* models, on the grounds that a
 * small model gives a wandering tutor. That reasoning is sound for an
 * unconstrained agent and does not apply here: the model picks one verdict from
 * a four-value enum and phrases one question drawn from probes written in
 * advance. It is not inventing a curriculum.
 *
 * So this is a TESTED list rather than a frontier list, and `pnpm calibrate` is
 * what earns a place on it. A model that cannot rank the plausible-but-wrong
 * fixture comes off the list rather than shipping anyway.
 */
export const MODELS = {
  'gemini-3.1-flash-lite': {
    label: 'Gemini 3.1 Flash Lite',
    note: 'Cheapest that holds the format. Proven on a structured interview loop in the sibling project.',
    /** USD per 1M tokens, paid tier. Zero on free — kept so usage stays comparable. */
    input: 0.25,
    output: 1.5,
    /** Usable on the shared free-tier key. The flagship's free quota is far too small. */
    freeTier: true,
  },
  'gemini-3.5-flash-lite': {
    label: 'Gemini 3.5 Flash Lite',
    note: 'A little more judgement for a little more money.',
    input: 0.3,
    output: 2.5,
    freeTier: true,
  },
  'gemini-3.6-flash': {
    label: 'Gemini 3.6 Flash',
    note: 'Best judgement here, but its free quota is roughly twenty requests — a session spends more than that. Bring your own key.',
    input: 0.75,
    output: 3.75,
    freeTier: false,
  },
} as const;

export type ModelId = keyof typeof MODELS;

/**
 * A literal, not an env read: this module is imported by client components, and
 * a `process.env` lookup there silently resolves to undefined, so the browser
 * and the server would disagree whenever the override was set. The route applies
 * the `TUTOR_MODEL` override instead — see `serverDefaultModel`.
 */
export const DEFAULT_MODEL: ModelId = 'gemini-3.1-flash-lite';

export function isWhitelisted(model: string): model is ModelId {
  return model in MODELS;
}

/**
 * Models to try, in order, when the chosen one will not answer.
 *
 * Falling back keeps a session alive rather than ending it mid-question.
 * Deduplicated so an explicitly chosen model is not attempted twice.
 */
export function fallbackChain(chosen: ModelId, allowPaidOnly: boolean): ModelId[] {
  const rest = (Object.keys(MODELS) as ModelId[]).filter(
    (id) => allowPaidOnly || MODELS[id].freeTier,
  );
  return [...new Set([chosen, ...rest])];
}
