import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ModelUnavailableError } from '@/lib/agent/decide';
import { reword } from '@/lib/agent/reword';
import { GRAPH } from '@/lib/graph/load';
import { isWhitelisted, MODELS } from '@/lib/models';
import { fallbackKey, serverDefaultModel } from '@/lib/provider';
import { canMeter, FREE_DAILY_CAP, FREE_TURN_CAP, issue, overCap, spendSoFar } from '@/lib/session/token';

/**
 * An interruption during the walkthrough: "simpler", or a question.
 *
 * Separate from `/api/turn` because it does a different job under different
 * rules — no verdict, no learner model, no advancing. Sharing a route would
 * have meant one handler with two unrelated branches and a prompt that had to
 * cover both.
 *
 * Metered against the same session allowance as the diagnostic. The walkthrough
 * itself costs nothing (its steps are authored and read out locally), so this is
 * the only thing in it that spends anything.
 */

const body = z.object({
  nodeId: z.string(),
  mode: z.enum(['simpler', 'question']),
  question: z.string().max(1000).nullable().default(null),
  alreadySaid: z.string().max(4000).default(''),
  apiKey: z.string().max(200).optional(),
  model: z.string().max(64).optional(),
  sessionToken: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });

  const input = parsed.data;

  const node = GRAPH.nodes.find((entry) => entry.id === input.nodeId);
  if (!node) return NextResponse.json({ error: 'UNKNOWN_NODE' }, { status: 400 });

  if (input.model && !isWhitelisted(input.model)) {
    return NextResponse.json({ error: 'MODEL_NOT_ALLOWED', allowed: Object.keys(MODELS) }, { status: 400 });
  }
  const chosen = input.model && isWhitelisted(input.model) ? input.model : serverDefaultModel();

  const byok = Boolean(input.apiKey?.trim());
  if (!byok && !MODELS[chosen].freeTier) {
    return NextResponse.json({ error: 'MODEL_NEEDS_OWN_KEY', model: chosen }, { status: 400 });
  }

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

  try {
    const result = await reword({
      apiKey,
      chosenModel: chosen,
      byok,
      node,
      mode: input.mode,
      question: input.question,
      alreadySaid: input.alreadySaid,
    });

    console.log(
      `[reword] ${node.id} ${input.mode} via ${result.model} ${result.latencyMs}ms $${result.costUsd.toFixed(5)}`,
    );

    return NextResponse.json({ say: result.say, sessionToken: token, model: result.model, costUsd: result.costUsd });
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      return NextResponse.json(
        { error: `MODEL_${error.reason.toUpperCase()}` },
        { status: error.reason === 'auth' ? 401 : 503 },
      );
    }
    console.error('[reword] unexpected failure:', error);
    return NextResponse.json({ error: 'REWORD_FAILED' }, { status: 500 });
  }
}
