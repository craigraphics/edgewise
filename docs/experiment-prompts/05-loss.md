# Loss: give wrongness a shape

You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

## Your experiment

Concept ID: `loss`. Use branch `experiment/05-loss`.

Build a prediction-versus-observation experiment using a few toy house prices. The learner changes the predicted price and sees how far it is from the observed price. Show both the distance and the resulting loss. Contrast a coarse “exactly right / not exactly right” indicator with a numeric measure that distinguishes a small miss from a huge one.

Let the learner switch between mean absolute error and mean squared error over the same small set of editable predictions. Label units and scaling correctly: a squared error is not an ordinary currency amount. Use small readable values, with a plain-language description of what each measure penalizes. Include one outlier so that choosing a different loss visibly changes the balance of influence. All error bars and values must be calculated from the displayed observations and predictions.

Explain that a person chooses what the loss measures, so optimizing that number can miss other things they care about. Do not imply the loss value alone specifies which parameter to change; a later concept introduces using derivatives. Do not imply all losses are smooth everywhere, or that lower training loss proves real-world success.

Ask optionally: “Why is ‘wrong by this much’ useful, and what did the choice of loss tell the system to care about?”

Acceptance: verify exact predictions give zero loss, symmetric positive/negative errors produce equal absolute/squared loss, and one large miss affects the two losses differently. The plotted distances, aggregate, and example table must agree. The error readout is a property of the toy model, never a grade for the learner.
