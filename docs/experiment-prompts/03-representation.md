# Representation: what the numbers leave out

You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

## Your experiment

Concept ID: `features-and-representation`. Use branch `experiment/03-representation`.

Build a representation playground using a small black/white pixel grid. The learner toggles cells using buttons (pointer and keyboard), and compares two encodings: one number for average brightness, and the full ordered list of pixel values. Highlight the cell corresponding to a position in the full list.

Provide two visibly different patterns with the same average brightness. The one-number encoding should collide: the inputs look different to us but produce identical encoded data. Switching to the ordered pixel list should preserve the distinction. Do the calculation from the actual grid; do not merely label an animation “encoding”. Keep the cell order explicit, and show that rearranging cells can preserve the average while changing the ordered representation.

Explain that models operate on the numbers supplied to them, and information discarded by an encoding cannot be recovered from that encoding alone. Do not claim this toy is how all image or language models encode their input. No fake image classifier is needed; the contrast between the two representations does the teaching.

Ask optionally: “If both pictures become the same number, what has the model lost?”

Acceptance: every grid cell has an accessible row/column label and pressed state. Verify all-white, all-black, and two distinct equal-brightness patterns. Show numeric and textual output in addition to colour. Reset and switching the encoding should preserve the intended pattern state, with no learner mark changes.
