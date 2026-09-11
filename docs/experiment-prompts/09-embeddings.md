# Embeddings: inspect neighbours without faking meaning

You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

## Your experiment

Concept ID: `embeddings`. Use branch `experiment/09-embeddings`.

Build a small embedding-neighbour explorer using a documented, local fixture of real pretrained vectors. Choose a manageable set of vocabulary items and record the source, model, licence, vector type, and preprocessing. A static pretrained word-vector dataset is acceptable if it is explicitly labelled as word embeddings rather than a modern model's contextual token representations. Research the primary source before choosing or shipping the fixture.

Let the learner search the available vocabulary, select an item, inspect part of its numeric vector, and compare its nearest neighbours using cosine similarity calculated in the original vector space. A 2D projection can be an optional illustration, but name the projection and prominently explain that it discards information. The nearest-neighbour list must be based on full vectors, not distances in the picture. Selecting points or list entries should update the same state.

Do not generate random/hash vectors and describe them as learned meaning. Do not assign human semantic labels to arbitrary individual dimensions. For input outside the local vocabulary, say so and suggest available examples rather than pretending to calculate an embedding. Distinguish a static embedding lookup from the contextual representations a model computes later; do not animate context-dependent movement without actual contextual vectors.

Ask optionally: “What do these numbers let us compare, and what can this flat picture fail to show?”

Acceptance: test cosine similarity, vector dimensions, zero-norm protection, self-neighbour filtering, deterministic neighbour ordering, and search with unavailable text. Use an accessible list alongside any plot. Keep the fixture small enough for a responsive browser and disclose exactly what the demonstration can represent.
