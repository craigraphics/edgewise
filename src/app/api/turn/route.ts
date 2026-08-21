import type { ModelMessage } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decide, ModelUnavailableError } from '@/lib/agent/decide';
import { SETTLES, type Decision, type SettledState } from '@/lib/agent/schema';
import { settle } from '@/lib/agent/verdict';
import { downstreamOf, leadNode, nextToAsk, withMark } from '@/lib/graph/frontier';
import { GRAPH } from '@/lib/graph/load';
import { nodeState, type LearnerModel, type NodeState } from '@/lib/graph/types';
import { isWhitelisted, MODELS } from '@/lib/models';
import { fallbackKey, serverDefaultModel } from '@/lib/provider';
import { canMeter, FREE_DAILY_CAP, FREE_TURN_CAP, issue, overCap, spendSoFar } from '@/lib/session/token';

/**
 * One turn of the diagnostic.
 *
 * Stateless: the learner model travels with the request, is validated here, and
 * every derived fact — which node is under discussion, what comes next, whether
 * the session is finished — is recomputed from the graph rather than trusted
 * from the client or asked of the model.
 *
 * Two paths through one handler. A request carrying an `apiKey` is served on
 * that key; one without falls back to the operator's shared free-tier key under
 * a turn cap. The spec wanted the browser to call the provider directly so that
 * a learner's key never touched this server, but a free fallback makes that
 * impossible — the operator's key cannot be shipped to a browser — and once a
 * server exists for one path, running two transports buys nothing.
 *
 * The learner's key is used for this request and discarded. It is never logged,
 * never persisted, and never returned.
 */

const body = z.object({
  states: z.record(z.string(), nodeState).default({}),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(60)
    .default([]),
  answer: z.string().max(4000).default(''),
  /** The node the last question was about. Null starts a session. */
  currentNodeId: z.string().nullable().default(null),
  followUps: z.number().int().min(0).max(3).default(0),
  apiKey: z.string().max(200).optional(),
  model: z.string().max(64).optional(),
  sessionToken: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const input = parsed.data;
  const learner: LearnerModel = { graphVersion: GRAPH.version, states: input.states };

  const chosen = input.model && isWhitelisted(input.model) ? input.model : serverDefaultModel();
  if (input.model && !isWhitelisted(input.model)) {
    return NextResponse.json(
      { error: 'MODEL_NOT_ALLOWED', allowed: Object.keys(MODELS) },
      { status: 400 },
    );
  }

  const byok = Boolean(input.apiKey?.trim());
  if (!byok && !MODELS[chosen].freeTier) {
    return NextResponse.json({ error: 'MODEL_NEEDS_OWN_KEY', model: chosen }, { status: 400 });
  }

  /*
   * The opening turn is scripted, not generated.
   *
   * Two reasons. It saves a request against a shared daily quota on every
   * session, and the first thing a learner hears sets whether this feels like a
   * conversation or an exam — which is the largest risk in the product and not
   * something to leave to the cheapest model on the list.
   */
  if (!input.currentNodeId) {
    const opening = nextToAsk(GRAPH, learner);
    if (!opening) {
      const lead = leadNode(GRAPH, learner);
      return NextResponse.json({ done: true, say: nothingToAsk(learner), nodeId: lead?.id ?? null });
    }

    return NextResponse.json({
      done: false,
      nodeId: opening.id,
      followUps: 0,
      say: `${OPENING} ${opening.probes[0]}`,
      sessionToken: input.sessionToken ?? null,
    });
  }

  const current = GRAPH.nodes.find((node) => node.id === input.currentNodeId);
  if (!current) return NextResponse.json({ error: 'UNKNOWN_NODE' }, { status: 400 });

  // Resolve the key, and cap the free path before spending anything.
  let apiKey = input.apiKey?.trim() ?? '';
  let token = input.sessionToken ?? null;

  if (!byok) {
    if (!canMeter()) return NextResponse.json({ error: 'FREE_TIER_UNAVAILABLE' }, { status: 503 });

    const spend = await spendSoFar(token);
    const over = overCap(spend);
    if (over) {
      return NextResponse.json(
        { error: over, cap: over === 'FREE_DAILY_SPENT' ? FREE_DAILY_CAP : FREE_TURN_CAP },
        { status: 429 },
      );
    }

    const shared = fallbackKey();
    if (!shared) return NextResponse.json({ error: 'FREE_TIER_UNAVAILABLE' }, { status: 503 });

    apiKey = shared;
    token = await issue(spend.turns + 1, spend.daily + 1);
  }

  /*
   * Both possible continuations, computed here rather than asked of the model.
   * Sending them together lets one call both judge the answer and phrase the
   * right next question, which halves the requests per turn.
   */
  const nextIfKnown = nextToAsk(GRAPH, withMark(learner, current.id, 'known'));
  const nextIfNot = nextToAsk(GRAPH, withMark(learner, current.id, 'shaky'));

  const history: ModelMessage[] = [
    ...input.history.map((turn) => ({ role: turn.role, content: turn.content }) as ModelMessage),
    { role: 'user', content: input.answer || '(no answer given)' },
  ];

  try {
    const result = await decide({
      apiKey,
      chosenModel: chosen,
      byok,
      history,
      subject: GRAPH.subject,
      current,
      nextIfKnown,
      nextIfNot,
      model: learner,
      followUps: input.followUps,
    });

    const { say, misconception, because, answeredTheQuestion, mechanismDescribed } = result.decision;

    // The model's own answers to the two checks can override its verdict.
    const settlement = settle(result.decision);
    const verdict = settlement.verdict;

    /*
     * `unclear` keeps us on the node for one follow-up. A SECOND `unclear` is
     * overridden rather than obeyed: the prompt already forbids it, and this is
     * the guard for when a cheap model does it anyway. Repeatedly circling one
     * point is exactly the interrogation this product cannot survive, and
     * "shaky" is the honest reading of an answer that twice failed to settle.
     */
    const settledState: NodeState | null = isSettling(verdict)
      ? verdict
      : input.followUps >= 1
        ? 'shaky'
        : null;

    const nextLearner = settledState ? withMark(learner, current.id, settledState) : learner;
    const upcoming = settledState ? nextToAsk(GRAPH, nextLearner) : current;

    /*
     * Logs what was ASKED and ANSWERED, not just the verdict.
     *
     * A real session surfaced two marks whose stated reasoning was about the
     * previous node rather than the current one, and the verdict-only log made
     * it impossible to tell whether the assessor had blended two exchanges or
     * the learner had simply drifted back to the last question. Either is worth
     * knowing; neither is visible without the text.
     */
    const asked = input.history.filter((turn) => turn.role === 'assistant').at(-1)?.content ?? '(opening)';
    console.log(
      [
        `[turn] ${current.id} -> ${settledState ?? 'unclear'}${misconception ? ' (misconception)' : ''}` +
          `  ${result.model} ${result.latencyMs}ms $${result.costUsd.toFixed(5)}`,
        `       asked  : ${asked.slice(0, 140)}`,
        `       answer : ${input.answer.slice(0, 140)}`,
        `       because: ${because.slice(0, 140)}`,
        `       checks : answered=${answeredTheQuestion} mechanism=${mechanismDescribed ? 'yes' : 'NONE'}` +
          `${settlement.overriddenFrom ? `  [overridden from ${settlement.overriddenFrom}]` : ''}`,
      ].join('\n'),
    );

    return NextResponse.json({
      done: upcoming === null,
      say,
      // The payoff line is scripted for the same reason the opening is: it is
      // the single most important sentence in the product, and leaving it to
      // the cheapest model on the list produced vague endings like "we have
      // reached the limit of where we need to be for this part".
      closing: upcoming === null ? closingFor(nextLearner) : null,
      // `unclear` is internal bookkeeping; the client stores marks, not verdicts.
      mark: settledState ? { nodeId: current.id, state: settledState } : null,
      misconception,
      nodeId: upcoming?.id ?? null,
      followUps: settledState ? 0 : input.followUps + 1,
      sessionToken: token,
      model: result.model,
      costUsd: result.costUsd,
    });
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      const status = error.reason === 'auth' ? 401 : 503;
      return NextResponse.json({ error: `MODEL_${error.reason.toUpperCase()}` }, { status });
    }
    console.error('[turn] unexpected failure:', error);
    return NextResponse.json({ error: 'TURN_FAILED' }, { status: 500 });
  }
}

const OPENING =
  "Let's work out where your understanding of this currently sits — there are no right answers here, and \"I don't know\" is genuinely useful. Starting somewhere near the bottom:";

const NOTHING_LEFT = "There's nothing left for me to ask about — you've got the whole map.";

/**
 * Opening a session with nothing left to ask.
 *
 * Separate copy from the closing, and separate for two reasons. Nothing has
 * been asked yet, so "that gives me what I needed" would be a lie. And the
 * condition is much weaker than it sounds: `nextToAsk` considers only
 * `unexplored` nodes, so this fires as soon as every node the frontier has
 * opened carries any mark at all — which is emphatically not the same as
 * knowing the whole map. Saying "you've got the whole map" to someone holding
 * three of twenty-three read as the app being broken, and fairly.
 */
function nothingToAsk(learner: LearnerModel): string {
  const lead = leadNode(GRAPH, learner);
  if (!lead) return NOTHING_LEFT;

  const resting = downstreamOf(GRAPH, lead.id).length;
  const rests = resting > 0 ? ` — ${resting} of the later ideas rest on it` : '';

  return `Everything I would have asked about already has a mark on the map, so there is nothing new to place. ${lead.label} is still the place to start from${rests}. It is highlighted for you.`;
}

/**
 * What the map now says, in one sentence.
 *
 * Names the frontier and what rests on it, because "you do not have this yet"
 * is uninteresting and "nine later ideas are waiting on it" is the thing a chat
 * assistant structurally cannot tell you. Framed as a starting point, never as
 * a gap — the wording here is load-bearing for whether the whole exercise reads
 * as useful or as a report card.
 */
function closingFor(learner: LearnerModel): string {
  const lead = leadNode(GRAPH, learner);
  if (!lead) return NOTHING_LEFT;

  const resting = downstreamOf(GRAPH, lead.id).length;

  return resting > 0
    ? `That gives me what I needed. Looking at the map: ${lead.label} is the place to start from — ${resting} of the later ideas rest on it, which is why so much of the rest has probably felt slippery. It is highlighted for you.`
    : `That gives me what I needed. Looking at the map: ${lead.label} is the place to start from. It is highlighted for you.`;
}

/** Narrows a verdict to the three that actually settle a node. */
function isSettling(verdict: Decision['verdict']): verdict is SettledState {
  return (SETTLES as readonly string[]).includes(verdict);
}
