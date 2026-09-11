# Playable map proposal

Repo: https://github.com/craigraphics/edgewise
Branch: `proposal/playable-map`, based on `proposal/recognition-first`.
Local checkout: `/Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise`

## What changed

Focus is the default map view: the current idea, its direct prerequisites, and
its direct dependants. Every card carries the existing state glyph and its text
label. All links come from the authored graph. Full map and List still expose
all 23 ideas; no idea is locked.

“Or take a neuron apart” is available beside the initial diagnostic, including
on mobile. The experiment fixes inputs at 2 and 1, exposes two weights from −2
to 2, and uses bias −2 and ReLU. Change a weight, predict higher/lower/same,
then run the arithmetic. A result explains the weighted contributions, total,
and activation. Reset restores the reference output of 1. Limitations are
available in “What this model leaves out”. This is a hand-operated model, not
training or a simulation of a biological neuron.

“Explain what happened” opens the existing explanation checker with an empty,
focused input and a question about the mechanism. There is no generated answer
in the input. Experiment completion and predictions never write learner marks.
An earned upgrade affects this idea alone; dependants retain their marks.

Experiment settings and results survive switching views and following other
connections. On mobile, This idea returns to the explanation without discarding
it. An unfinished explanation survives repeated trips to the experiment.
Explanation requests have a 45-second timeout and abort when their form leaves
the workspace. A delayed response after Start over is ignored.

## Design judgment

A complete graph is useful as an overview but makes a weak first interaction:
it asks a newcomer to choose among unfamiliar labels. A small neighbourhood
makes the next choice concrete, while the experiment gives the learner something
to cause and inspect. The bet is on curiosity and visible consequences, rather
than scoring or a fictional sequence of locked levels. This preserves the
AGENTS.md distinction between being shown an explanation and demonstrating
understanding, and its rejection of unearned unlock effects.

This is one playable idea, not a claim that 23 experiments have been built.
No new assessor prompt, schema, model, or prerequisite edge was introduced.

## Verification

- 323 tests pass across 19 files, including new neuron arithmetic tests over all
  81 supported weight pairs, and existing graph, upgrade, and unlock invariants.
- TypeScript, ESLint, and production Webpack build pass.
- Browser: keyboard navigation reaches labelled native sliders; Arrow keys change
  weights; prediction then Run reveals the expected arithmetic. Negative totals
  produce zero. Wrong predictions leave learner storage unchanged.
- Browser: a real successful explanation checked through the existing API marked
  only `neuron` Solid; its prerequisites and dependants were unchanged.
- Browser: experiment settings/results and explanation draft survived Full map /
  Focus and mobile explanation / map round trips.
- Browser: simulated offline failure preserved draft and marks. A delayed success
  after Start over did not restore any old marks.
- Browser: widths 320, 390, 720, 1099, 1100 and 1440 had no document or experiment
  horizontal overflow. Both themes visually inspected. Empty, all Not yet, and
  all Solid learner models rendered with an available next action.

Physical microphone input, actual screen-reader speech, and native browser zoom
were not verified in this change. Engagement and retention are design hypotheses;
there has been no learner study. Experiment settings are session-local, while
learner marks retain the existing browser persistence.

## Run

Use Node 22+ and `pnpm install`, then `pnpm dev --webpack --port 3100`.
The existing local environment uses polling for file watching. The experiment
itself runs locally without an API key; explanation checks use the existing
shared allowance or the learner's configured key.
