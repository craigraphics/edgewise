# Generalization: fit the dots, then meet new ones

You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

## Your experiment

Concept ID: `generalization-overfitting`. Use branch `experiment/07-generalization`.

Build a small model-fitting experiment with noisy one-dimensional training observations and a separate fixed set of unseen observations. Let the learner compare a simple fit and a more flexible fit, then reveal how they predict examples they did not fit on. Plot the actual predictions and show training error beside unseen-data error.

Use a deterministic, documented dataset that demonstrates the difference honestly. Choose a numerically stable real fitting method; calculate both error values from its predictions. A simple regression and a flexible interpolator are acceptable if their limitations are named. Avoid an animation that changes a curve while its displayed scores come from a hand-authored lookup table. Keep the same unseen dataset while comparing models.

The central moment is a fit that matches the training points very well but transfers poorly. Frame this as evidence to investigate, not a claim that complexity or perfect training accuracy is always bad. Show the noise in this toy and why fitting it can hurt a new prediction. The data-error values belong to the toy model, not the learner.

Ask optionally: “Why can the model that fits these examples best be worse on an example it has never seen?”

Acceptance: verify error calculations, that held-out points are never inputs to the fit, and that the same parameters produce both displayed curve and reported predictions. Test a noiseless counterexample so the implementation does not bake in ‘more flexible always fails’. Reset must restore the dataset and comparison state reproducibly.
