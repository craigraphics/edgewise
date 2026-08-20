import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ModelUnavailableError } from '@/lib/agent/decide';
import { explainBack } from '@/lib/agent/explain-back';
import { GRAPH } from '@/lib/graph/load';
import { nodeState } from '@/lib/graph/types';
import { isUpgrade, upgrade } from '@/lib/graph/upgrade';
import { isWhitelisted, MODELS } from '@/lib/models';
import { fallbackKey, serverDefaultModel } from '@/lib/provider';
import { canMeter, FREE_DAILY_CAP, FREE_TURN_CAP, issue, overCap, spendSoFar } from '@/lib/session/token';

/**
 * The only route that can clear a block.
 *
 * The walkthrough teaches and changes nothing; this reads an explanation the
 * learner produced and decides whether it earned a better standing. Keeping the
 * two apart is the point — being told something and knowing it are different,
 * and only one of them belongs on the map.
 */

const body = z.object({
  nodeId: z.string(),
  explanation: z.string().min(1).max(4000),
  /** Current standing, so the response can say whether anything moved. */
  currentState: nodeState.default('unexplored'),
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
    const result = await explainBack({
      apiKey,
      chosenModel: chosen,
      byok,
      node,
      explanation: input.explanation,
    });

    /*
     * An attempt can raise a standing but never lower one. Someone marked down
     * for volunteering an explanation does not volunteer a second one, and the
     * willingness to try out loud is worth more than the precision of any
     * single mark.
     */
    const nextState = upgrade(input.currentState, result.state);
    const moved = isUpgrade(input.currentState, result.state);

    console.log(
      `[explain-back] ${node.id} ${input.currentState} -> ${nextState}` +
        `${moved ? '' : ' (no change)'}${result.assessment.carriesMisconception ? ' [misconception]' : ''}` +
        `  ${result.model} ${result.latencyMs}ms $${result.costUsd.toFixed(5)}\n` +
        `       mechanism: ${result.assessment.mechanismDescribed ?? 'NONE'}`,
    );

    return NextResponse.json({
      say: result.assessment.say,
      state: nextState,
      moved,
      misconception: result.assessment.carriesMisconception,
      sessionToken: token,
      model: result.model,
      costUsd: result.costUsd,
    });
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      return NextResponse.json(
        { error: `MODEL_${error.reason.toUpperCase()}` },
        { status: error.reason === 'auth' ? 401 : 503 },
      );
    }
    console.error('[explain-back] unexpected failure:', error);
    return NextResponse.json({ error: 'EXPLAIN_FAILED' }, { status: 500 });
  }
}
