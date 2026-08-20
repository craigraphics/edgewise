import { FIXTURES, type CaseLabel } from '../content/fixtures/calibration';
import { EXPLAIN_FIXTURES, type ExplainLabel } from '../content/fixtures/explain-back';
import { MULTI_TURN, type MultiTurnFixture } from '../content/fixtures/multi-turn';
import { decide } from '../src/lib/agent/decide';
import { explainBack } from '../src/lib/agent/explain-back';
import { settle } from '../src/lib/agent/verdict';
import { nextToAsk, withMark } from '../src/lib/graph/frontier';
import { GRAPH } from '../src/lib/graph/load';
import type { LearnerModel, NodeState } from '../src/lib/graph/types';
import { DEFAULT_MODEL, isWhitelisted, MODELS, type ModelId } from '../src/lib/models';

/**
 * Checks whether the assessor can actually tell answers apart.
 *
 * This runs the SAME code path a real session runs — `decide`, the real prompt,
 * the real schema — because a harness that tests a copy of the assessor tests
 * nothing about the one that ships.
 *
 * There is no automatic pass on the individual verdicts. Whether a specific
 * answer deserves `known` or `shaky` is a judgement call, and a script that
 * decided it would become the thing it is testing. What IS asserted is the pair
 * of failures that make the product actively harmful:
 *
 *   1. FALSE PASS — a misconception, a parroted answer, or "I don't know"
 *      coming back `known`. This routes someone past the exact thing blocking
 *      them, with a clean visual map lending it authority. Fatal.
 *   2. FALSE BLOCK — a genuinely strong answer coming back shaky or blocked.
 *      An assessor that marks everything down looks safe and never advances
 *      anyone. Useless in the other direction.
 *
 * Run with: pnpm calibrate [--model <id>] [--all] [--runs N]
 */

type Outcome = {
  model: ModelId;
  nodeId: string;
  label: CaseLabel;
  verdict: string;
  misconception: boolean;
  because: string;
  latencyMs: number;
  costUsd: number;
};

/** What each class must NOT come back as. The judgement lives here, once. */
function isFailure(label: CaseLabel, verdict: string): 'false-pass' | 'false-block' | null {
  if (label === 'strong') return verdict === 'known' ? null : 'false-block';
  // Everything else must not read as understanding.
  return verdict === 'known' ? 'false-pass' : null;
}

/** The verdict we would ideally see, used for an exact-match rate only. */
const IDEAL: Record<CaseLabel, NodeState> = {
  strong: 'known',
  misconception: 'shaky',
  parroted: 'shaky',
  blank: 'blocked',
};

/**
 * A learner who has everything underneath this node and nothing above it.
 *
 * Built by walking the prerequisites transitively, so the node under test is
 * genuinely on the frontier — the same position a real session would reach it
 * from. Testing it from an arbitrary state would exercise a situation the
 * product never produces.
 */
function learnerAt(nodeId: string, alsoKnown: string[] = []): LearnerModel {
  const states: Record<string, NodeState> = {};
  const index = new Map(GRAPH.nodes.map((node) => [node.id, node]));

  const walk = (id: string) => {
    for (const prerequisite of index.get(id)?.prerequisites ?? []) {
      if (states[prerequisite]) continue;
      states[prerequisite] = 'known';
      walk(prerequisite);
    }
  };

  walk(nodeId);
  for (const id of alsoKnown) {
    states[id] = 'known';
    walk(id);
  }
  return { graphVersion: GRAPH.version, states };
}

/**
 * Replays a whole conversation and judges only its final answer.
 *
 * Uses the same `decide` path as a real turn, with the history assembled exactly
 * as the route assembles it — the point is to reproduce the conditions the bug
 * appeared under, not an idealised version of them.
 */
async function runConversation(
  model: ModelId,
  apiKey: string,
  fixture: MultiTurnFixture,
): Promise<{ fixture: MultiTurnFixture; verdict: string; because: string; ok: boolean } | null> {
  const current = GRAPH.nodes.find((node) => node.id === fixture.nodeId);
  if (!current) return null;

  const learner = learnerAt(fixture.nodeId, fixture.alsoKnown);

  try {
    const result = await decide({
      apiKey,
      chosenModel: model,
      byok: true,
      history: fixture.turns.map((turn) => ({ role: turn.role, content: turn.content })),
      subject: GRAPH.subject,
      current,
      nextIfKnown: nextToAsk(GRAPH, withMark(learner, current.id, 'known')),
      nextIfNot: nextToAsk(GRAPH, withMark(learner, current.id, 'shaky')),
      model: learner,
      followUps: 0,
    });

    const verdict = settle(result.decision).verdict;
    const { because } = result.decision;
    const ok =
      fixture.expect === 'known'
        ? verdict === 'known'
        : fixture.expect === 'unclear'
          ? verdict === 'unclear'
          : verdict === 'shaky' || verdict === 'blocked';

    return { fixture, verdict, because, ok };
  } catch (error) {
    console.log(`  ${fixture.name}: call failed — ${(error as Error).message}`);
    return null;
  }
}

async function runCase(
  model: ModelId,
  apiKey: string,
  fixture: (typeof FIXTURES)[number],
  testCase: { label: CaseLabel; answer: string },
): Promise<Outcome | null> {
  const current = GRAPH.nodes.find((node) => node.id === fixture.nodeId);
  if (!current) {
    console.log(`  ${fixture.nodeId}: no longer in the graph — fixture is stale`);
    return null;
  }

  const learner = learnerAt(fixture.nodeId);

  try {
    const result = await decide({
      apiKey,
      chosenModel: model,
      // Calibration always runs on a real key, so the paid-quota models are reachable.
      byok: true,
      history: [
        { role: 'assistant', content: fixture.asked },
        { role: 'user', content: testCase.answer },
      ],
      subject: GRAPH.subject,
      current,
      nextIfKnown: nextToAsk(GRAPH, withMark(learner, current.id, 'known')),
      nextIfNot: nextToAsk(GRAPH, withMark(learner, current.id, 'shaky')),
      model: learner,
      followUps: 0,
    });

    return {
      model,
      nodeId: fixture.nodeId,
      label: testCase.label,
      // The settled verdict, not the raw one: this is what a session records.
      verdict: settle(result.decision).verdict,
      misconception: result.decision.misconception,
      because: result.decision.because,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
    };
  } catch (error) {
    console.log(`  ${fixture.nodeId}/${testCase.label}: call failed — ${(error as Error).message}`);
    return null;
  }
}

function report(model: ModelId, outcomes: Outcome[], runs: number) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`${MODELS[model].label}  (${model})`);
  console.log('='.repeat(72));

  for (const fixture of FIXTURES) {
    const forNode = outcomes.filter((o) => o.nodeId === fixture.nodeId);
    if (forNode.length === 0) continue;

    console.log(`\n${fixture.nodeId}`);
    for (const label of ['strong', 'misconception', 'parroted', 'blank'] as CaseLabel[]) {
      const results = forNode.filter((o) => o.label === label);
      if (results.length === 0) continue;

      const verdicts = results.map((r) => r.verdict).join(',');
      const failures = results.filter((r) => isFailure(r.label, r.verdict) !== null).length;
      const flag = failures === 0 ? '  ' : failures === results.length ? '!!' : ' ~';
      const misc = results.some((r) => r.misconception) ? ' [misconception flagged]' : '';

      console.log(`  ${flag} ${label.padEnd(13)} ${verdicts.padEnd(runs > 1 ? 28 : 13)}${misc}`);
      console.log(`       ${results[0].because.slice(0, 96)}`);
    }
  }

  const falsePasses = outcomes.filter((o) => isFailure(o.label, o.verdict) === 'false-pass');
  const falseBlocks = outcomes.filter((o) => isFailure(o.label, o.verdict) === 'false-block');
  const exact = outcomes.filter((o) => o.verdict === IDEAL[o.label]).length;

  // Did the assessor use more than one verdict at all? An assessor returning the
  // same answer for everything is the classic collapse, and it reads as working.
  const distinct = new Set(outcomes.map((o) => o.verdict)).size;

  const misconceptionCases = outcomes.filter((o) => o.label === 'misconception');
  const misconceptionCaught = misconceptionCases.filter((o) => o.misconception).length;

  const cost = outcomes.reduce((sum, o) => sum + o.costUsd, 0);
  const latency = outcomes.map((o) => o.latencyMs).sort((a, b) => a - b);

  console.log('\n' + '-'.repeat(72));
  console.log(`  false passes   ${falsePasses.length}/${outcomes.length}   <- the fatal one`);
  console.log(`  false blocks   ${falseBlocks.length}/${outcomes.filter((o) => o.label === 'strong').length}`);
  console.log(`  exact match    ${exact}/${outcomes.length}`);
  console.log(`  distinct verdicts used   ${distinct}`);
  console.log(`  misconception flag set   ${misconceptionCaught}/${misconceptionCases.length}`);
  console.log(
    `  latency  median ${latency[Math.floor(latency.length / 2)]}ms  max ${latency[latency.length - 1]}ms`,
  );
  console.log(`  cost     $${cost.toFixed(5)} for ${outcomes.length} calls`);

  if (falsePasses.length > 0) {
    console.log('\n  FALSE PASSES:');
    for (const failure of falsePasses) {
      console.log(`    ${failure.nodeId}/${failure.label} -> known :: ${failure.because.slice(0, 80)}`);
    }
  }

  console.log('');
  if (distinct === 1) {
    console.log(`  VERDICT: output collapse — every answer got "${outcomes[0].verdict}". Do not trust this model.`);
  } else if (falsePasses.length > 0) {
    console.log('  VERDICT: FAILS. It marks answers known that are not. This model does not belong on the whitelist.');
  } else if (falseBlocks.length > 0) {
    console.log('  VERDICT: safe but blunt — it never falsely passes, but marks down real understanding.');
    console.log('           Usable with the learner able to override; not usable to gate progress silently.');
  } else {
    console.log('  VERDICT: separates cleanly on written answers. Earns its place on the whitelist.');
  }
}

/**
 * What each class must and must not come back as.
 *
 * `clumsy` sits with `solid` on purpose: the prompt claims that everyday words
 * beat correct terminology, and a model's bias runs the other way, so it is
 * held to the same bar.
 */
function explainFailure(label: ExplainLabel, state: NodeState): 'false-pass' | 'false-block' | null {
  // `technical` sits with the passes: jargon that states the mechanism is a
  // correct answer in a dinner jacket, and refusing it would be exactly the
  // vocabulary bias this product claims not to have — in the other direction.
  if (label === 'solid' || label === 'clumsy' || label === 'technical') {
    return state === 'known' ? null : 'false-block';
  }
  return state === 'known' ? 'false-pass' : null;
}

async function calibrateExplainBack(model: ModelId, apiKey: string, runs: number) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`Explaining it back — ${MODELS[model].label}`);
  console.log('='.repeat(72));

  const results: Array<{
    nodeId: string;
    label: ExplainLabel;
    state: NodeState;
    misconception: boolean;
    failure: 'false-pass' | 'false-block' | null;
    costUsd: number;
    latencyMs: number;
  }> = [];

  for (let run = 0; run < runs; run += 1) {
    for (const fixture of EXPLAIN_FIXTURES) {
      const node = GRAPH.nodes.find((entry) => entry.id === fixture.nodeId);
      if (!node) continue;

      for (const testCase of fixture.cases) {
        process.stdout.write('.');
        try {
          const result = await explainBack({
            apiKey,
            chosenModel: model,
            byok: true,
            node,
            explanation: testCase.explanation,
          });

          results.push({
            nodeId: fixture.nodeId,
            label: testCase.label,
            state: result.state,
            misconception: result.assessment.carriesMisconception,
            failure: explainFailure(testCase.label, result.state),
            costUsd: result.costUsd,
            latencyMs: result.latencyMs,
          });
        } catch (error) {
          console.log(`\n  ${fixture.nodeId}/${testCase.label}: ${(error as Error).message}`);
        }
      }
    }
  }

  if (results.length === 0) return console.log('\nno results.');

  for (const fixture of EXPLAIN_FIXTURES) {
    const forNode = results.filter((r) => r.nodeId === fixture.nodeId);
    if (forNode.length === 0) continue;

    console.log(`\n${fixture.nodeId}`);
    for (const label of ['solid', 'clumsy', 'technical', 'parroted', 'misconception', 'empty'] as ExplainLabel[]) {
      const rows = forNode.filter((r) => r.label === label);
      if (rows.length === 0) continue;
      const bad = rows.filter((r) => r.failure).length;
      const flag = bad === 0 ? '  ' : bad === rows.length ? '!!' : ' ~';
      const misc = rows.some((r) => r.misconception) ? '  [misconception flagged]' : '';
      console.log(`  ${flag} ${label.padEnd(13)} ${rows.map((r) => r.state).join(',').padEnd(runs > 1 ? 24 : 8)}${misc}`);
    }
  }

  const falsePasses = results.filter((r) => r.failure === 'false-pass');
  const falseBlocks = results.filter((r) => r.failure === 'false-block');
  const attempts = results.filter((r) => r.label === 'solid' || r.label === 'clumsy');
  const clumsy = results.filter((r) => r.label === 'clumsy');
  const clumsyPassed = clumsy.filter((r) => r.state === 'known').length;
  const technical = results.filter((r) => r.label === 'technical');
  const technicalPassed = technical.filter((r) => r.state === 'known').length;
  const misconceptions = results.filter((r) => r.label === 'misconception');
  const caught = misconceptions.filter((r) => r.misconception).length;
  const latency = results.map((r) => r.latencyMs).sort((a, b) => a - b);

  console.log('\n' + '-'.repeat(72));
  console.log(`  false passes   ${falsePasses.length}/${results.length}   <- clears a block it should not`);
  console.log(`  false blocks   ${falseBlocks.length}/${attempts.length}   <- refuses a real explanation`);
  console.log(`  everyday words accepted   ${clumsyPassed}/${clumsy.length}`);
  console.log(`  jargon-with-mechanism accepted  ${technicalPassed}/${technical.length}`);
  console.log(`  misconception flag set    ${caught}/${misconceptions.length}`);
  console.log(`  distinct states used      ${new Set(results.map((r) => r.state)).size}`);
  console.log(`  latency  median ${latency[Math.floor(latency.length / 2)]}ms  max ${latency[latency.length - 1]}ms`);
  console.log(`  cost     $${results.reduce((sum, r) => sum + r.costUsd, 0).toFixed(5)} for ${results.length} calls`);

  for (const failure of [...falsePasses, ...falseBlocks]) {
    console.log(`    ${failure.failure}: ${failure.nodeId}/${failure.label} -> ${failure.state}`);
  }

  console.log('');
  if (falsePasses.length > 0) {
    console.log('  VERDICT: FAILS. It clears blocks on explanations that do not earn it.');
  } else if (clumsyPassed < clumsy.length) {
    console.log('  VERDICT: it rewards vocabulary over understanding — the one bias this must not have.');
    console.log('           Someone who explains it properly in plain words gets refused.');
  } else if (falseBlocks.length > 0) {
    console.log('  VERDICT: refuses some genuine explanations. Nobody will keep offering them.');
  } else {
    console.log('  VERDICT: clears blocks only when earned, and accepts plain language. Usable.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runs = Number(args[args.indexOf('--runs') + 1]) || 1;
  const requested = args.includes('--model') ? args[args.indexOf('--model') + 1] : null;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    console.error('GOOGLE_GENERATIVE_AI_API_KEY is not set. Add it to .env.local.');
    process.exit(1);
  }

  let models: ModelId[];
  if (requested) {
    if (!isWhitelisted(requested)) {
      console.error(`"${requested}" is not on the whitelist: ${Object.keys(MODELS).join(', ')}`);
      process.exit(1);
    }
    models = [requested];
  } else if (args.includes('--all')) {
    models = Object.keys(MODELS) as ModelId[];
  } else {
    models = [DEFAULT_MODEL];
  }

  const skipSingles = args.includes('--multi') || args.includes('--explain');
  const onlyExplain = args.includes('--explain');
  const cases = FIXTURES.reduce((sum, f) => sum + f.cases.length, 0);
  console.log(`calibrating ${models.length} model(s) x ${cases} answers x ${runs} run(s)`);
  console.log('fixtures are WRITTEN, not transcribed. See content/fixtures/calibration.ts.\n');

  for (const model of models) {
    if (onlyExplain) {
      await calibrateExplainBack(model, apiKey, runs);
      continue;
    }

    const outcomes: Outcome[] = [];

    for (let run = 0; run < (skipSingles ? 0 : runs); run += 1) {
      for (const fixture of FIXTURES) {
        for (const testCase of fixture.cases) {
          process.stdout.write('.');
          // Sequential on purpose: parallel calls trip the free tier's
          // per-minute limit and turn a calibration run into a quota report.
          const outcome = await runCase(model, apiKey, fixture, testCase);
          if (outcome) outcomes.push(outcome);
        }
      }
    }

    if (outcomes.length > 0) report(model, outcomes, runs);
    else if (!skipSingles) console.log(`\n${model}: no results.`);

    console.log('\nIn conversation (judging only the final answer):');
    let conversationFailures = 0;

    for (const fixture of MULTI_TURN) {
      const result = await runConversation(model, apiKey, fixture);
      if (!result) continue;
      if (!result.ok) conversationFailures += 1;

      console.log(
        `  ${result.ok ? '  ' : '!!'} ${fixture.name.padEnd(17)} ${result.verdict.padEnd(9)} (wanted ${fixture.expect})`,
      );
      console.log(`       ${result.because.slice(0, 100)}`);
      if (!result.ok) console.log(`       MISSES: ${fixture.why}`);
    }

    console.log(
      conversationFailures === 0
        ? '\n  Conversation history does not contaminate the verdict.'
        : `\n  ${conversationFailures}/${MULTI_TURN.length} contaminated by conversation history. The map will be wrong in real sessions.`,
    );

    await calibrateExplainBack(model, apiKey, runs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
