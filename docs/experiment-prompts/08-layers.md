# Depth: switch the bend off

You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
MANDATORY BRANCH ISOLATION: Before editing any file, create and switch to your own experiment branch using the name specified below. You must not implement, edit, commit, or push experiment work on main, proposal/playable-map, or another session's branch. A commit on the shared branch is not an acceptable deliverable. This requirement overrides historical handover wording that says to continue on proposal/playable-map.

Find and fetch the actual GitHub remote (the working clone's origin may be a local repository). While the playable-map proposal PR is unmerged, create your branch from the latest proposal/playable-map and use that branch as the base of your experiment PR. After the proposal is merged, create your branch from updated main and target main. Use a separate worktree if another session uses the checkout; do not switch its branch. If the suggested branch already belongs to other work, create a unique suffixed branch. Preserve all existing uncommitted changes.

Verify git branch --show-current in your own checkout before the first edit and before committing. At completion, commit and push only your experiment branch, open its own PR against the chosen integration base, and report the branch and PR URL so the work can be reviewed and merged independently. If the parent proposal merges while your PR is open, update your branch from main and retarget the PR to main. Do not merge PRs or deploy the application.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit on your own branch, its own PR, and concise instructions for trying it.

## Your experiment

Concept ID: `layers-depth`. Use branch `experiment/08-layers`.

Extend the arithmetic idea beyond the existing neuron with a tiny, fully visible network that distinguishes whether two binary inputs are different (XOR). Keep its weights fixed and explain that this experiment demonstrates a computation, not training.

One valid construction uses hidden units h1 = ReLU(a − b), h2 = ReLU(b − a), with output h1 + h2. Let the learner toggle a and b, predict the output, and inspect every computed intermediate value. Then provide a clearly labelled switch that removes the bending functions: the same weights now produce (a − b) + (b − a), which is always zero. Show the two variants side by side or preserve a readable comparison.

The insight is that composing only affine transformations still gives an affine transformation; the nonlinearity changes what the composition can express. Do not imply every single neuron corresponds to a named real-world concept, or that arbitrary depth always helps. Do not imply this exact XOR construction is the only possible network, and do not silently change weights when the learner toggles the bend.

Ask optionally: “What changed when we kept the weights but removed the bend? Why didn’t the extra layer rescue it?”

Acceptance: verify all four binary input combinations in both modes and each intermediate value. Every wire must connect a real input/output in the calculation, with textual values also available. Avoid relying on colour or moving particles to convey the result. The standalone neuron must keep working and retain its own settings.
