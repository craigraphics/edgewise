# Edgewise: prompts for ten early-concept experiments

Repo: https://github.com/craigraphics/edgewise
Base branch: `proposal/playable-map` (including the scrolling correction).

These are handoff prompts only. No additional experiments were implemented in this session.

Copy one complete prompt below into a new coding session. Start with the tokenizer, which has the clearest immediate use. For prerequisite-first development, use learning from examples → representation / training vs. inference / loss → the remaining experiments. The existing neuron already covers the other concept in the first four graph layers.

Merge each completed experiment before starting the next from the updated base. For concurrent sessions, use separate worktrees and coordinate changes to the shared experiment launcher and inspector.

Each prompt is also saved as an individual Markdown file in `experiment-prompts/`.

| Prompt | Concept ID |
|---|---|
| [Tokenizer: see the actual pieces](experiment-prompts/01-tokenizer.md) | `tokens` |
| [Learning from examples: teach a tiny predictor](experiment-prompts/02-learning-from-examples.md) | `prediction-from-examples` |
| [Representation: what the numbers leave out](experiment-prompts/03-representation.md) | `features-and-representation` |
| [Training versus using: freeze the model](experiment-prompts/04-training-vs-inference.md) | `training-vs-inference` |
| [Loss: give wrongness a shape](experiment-prompts/05-loss.md) | `loss` |
| [Gradient descent: make the next nudge](experiment-prompts/06-gradient-descent.md) | `gradient-descent` |
| [Generalization: fit the dots, then meet new ones](experiment-prompts/07-generalization.md) | `generalization-overfitting` |
| [Depth: switch the bend off](experiment-prompts/08-layers.md) | `layers-depth` |
| [Embeddings: inspect neighbours without faking meaning](experiment-prompts/09-embeddings.md) | `embeddings` |
| [Holding data back: keep a genuinely unseen test](experiment-prompts/10-train-test-split.md) | `train-test-split` |

## Tokenizer: see the actual pieces

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: tokens. Use branch experiment/01-tokenizer.

Build a tokenizer playground for “Text as tokens”. The learner types or pastes text and sees its actual token pieces, token IDs, and total token count update. Make whitespace visible without altering the original text. Clicking or focusing a token should connect its piece to its ID and explain that the ID is an identifier, not a measure of meaning.

Use a real tokenizer with a real vocabulary and encoding, preferably running locally in the browser. Research and verify the chosen implementation against its primary documentation, pin the dependency/encoding, and visibly name what is being used. Counts belong to that encoding. Do not present them as universal, as word counts, as estimates from characters, as Gemini billing, or as the tokenizer of Edgewise's assessor unless that is actually what you implemented. No regex pretending to be subword tokenization and no model-generated token boundaries. If the encoder cannot load, show an honest error and retry; never substitute fake counts.

Offer a few editable examples: a familiar sentence, an unusual word, punctuation/spacing, emoji, and a non-English sentence. Show how changing the same text changes the actual boundaries and count. Avoid hardcoding a claim such as “strawberry is three tokens”: compute the result. Preserve exact spaces and line breaks. For byte-based encodings, one token may contain only part of a Unicode character; use a faithful byte representation or grouping with clearly separate token IDs rather than corrupting the text with replacement characters.

The live count should be useful immediately. Follow exploration with an optional question: “Why can the number of tokens differ from the number of words?” Route a learner-authored explanation to the existing tokens assessor without filling in an answer for them.

Acceptance: empty input yields zero ordinary text tokens; define any handling of special tokens explicitly. Test round trips, repeated spaces, newlines, punctuation, combining marks, joined emoji, non-Latin text, and rapid edits. Test IDs and counts against trustworthy reference fixtures, not just the same wrapper called twice. If tokenization is asynchronous, discard stale results and retain the latest input; bound long inputs with a visible limit and use a worker or chunked work if needed. Tokenization should not require a paid API key, and should not transmit entered text if it is implemented locally.
```

## Learning from examples: teach a tiny predictor

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: prediction-from-examples. Use branch experiment/02-learning-from-examples.

Build a small predictor that learns a relationship from labelled examples. Use an approachable toy problem such as estimating delivery time from distance. Start with a handful of editable (distance, observed time) examples. The learner changes an observed answer or adds a new labelled example, clicks “Learn from these examples”, and sees the fitted rule's predictions change.

Fit a real, simple model locally, such as least-squares linear regression; do not select a prewritten answer based on which button was clicked. Let the learner choose a new distance and inspect the model's prediction there. Distinguish the examples supplied by the learner, the parameters derived from them, and the new input being predicted. Explain that you chose the model family, while the example data determined its fitted parameters. A discovered line is a numerical relationship, not evidence of comprehension.

The useful surprise: identical input distances paired with different observed times cannot all be matched by one deterministic prediction. A contradictory example should visibly influence the fitted rule rather than being silently discarded. Make reset restore a deterministic initial dataset. Keep any raw formula behind an optional explanation; the primary view should work without algebra.

Ask optionally: “If nobody typed the final rule, where did this model's predictions come from?”

Acceptance: test a known exact line, noisy observations, duplicate inputs, and insufficient or constant input data. Handle an underdetermined fit explicitly rather than showing NaN or inventing a slope. Changing a label must not change a prediction until the learner runs the fit; the interface must indicate when the current data differs from the last fitted snapshot. Numeric values must come from the fitted model, and training this toy must not change the learner's map.
```

## Representation: what the numbers leave out

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: features-and-representation. Use branch experiment/03-representation.

Build a representation playground using a small black/white pixel grid. The learner toggles cells using buttons (pointer and keyboard), and compares two encodings: one number for average brightness, and the full ordered list of pixel values. Highlight the cell corresponding to a position in the full list.

Provide two visibly different patterns with the same average brightness. The one-number encoding should collide: the inputs look different to us but produce identical encoded data. Switching to the ordered pixel list should preserve the distinction. Do the calculation from the actual grid; do not merely label an animation “encoding”. Keep the cell order explicit, and show that rearranging cells can preserve the average while changing the ordered representation.

Explain that models operate on the numbers supplied to them, and information discarded by an encoding cannot be recovered from that encoding alone. Do not claim this toy is how all image or language models encode their input. No fake image classifier is needed; the contrast between the two representations does the teaching.

Ask optionally: “If both pictures become the same number, what has the model lost?”

Acceptance: every grid cell has an accessible row/column label and pressed state. Verify all-white, all-black, and two distinct equal-brightness patterns. Show numeric and textual output in addition to colour. Reset and switching the encoding should preserve the intended pattern state, with no learner mark changes.
```

## Training versus using: freeze the model

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: training-vs-inference. Use branch experiment/04-training-vs-inference.

Build a two-phase instrument around one tiny numerical predictor. During training, the learner changes labelled examples and explicitly fits the model. During inference, the learner can change the input freely and inspect different predictions while the fitted parameter snapshot visibly remains fixed.

Show a small readable parameter readout and two distinct indicators: “input changed” and “model changed”. These must reflect actual state differences. Adding a labelled example should stage new training data without silently refitting. Only “Train again” should replace the fitted snapshot. Use actual local calculations rather than scripted before/after values. Reuse existing fit utilities if another experiment has added them, while keeping this concept's state separate.

The useful comparison is changing an input versus changing the model. Let the learner return to training and see how using new labelled data affects later predictions. Do not claim that every deployed AI system is forever frozen: state that this demonstrates the common separation between fitting parameters and using them; online learning and other update systems exist. If mentioning conversation history, distinguish a changed input/context from an update to weights.

Ask optionally: “When the prediction changed, did the model learn anything? What would have to change for that to happen?”

Acceptance: verify many inference inputs leave parameters byte-for-byte unchanged. Changing staged examples must not change the active predictor until retraining. Make the reset snapshot deterministic and label each phase in text, not just colour. Keep the existing neuron and all other experiments working.
```

## Loss: give wrongness a shape

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: loss. Use branch experiment/05-loss.

Build a prediction-versus-observation experiment using a few toy house prices. The learner changes the predicted price and sees how far it is from the observed price. Show both the distance and the resulting loss. Contrast a coarse “exactly right / not exactly right” indicator with a numeric measure that distinguishes a small miss from a huge one.

Let the learner switch between mean absolute error and mean squared error over the same small set of editable predictions. Label units and scaling correctly: a squared error is not an ordinary currency amount. Use small readable values, with a plain-language description of what each measure penalizes. Include one outlier so that choosing a different loss visibly changes the balance of influence. All error bars and values must be calculated from the displayed observations and predictions.

Explain that a person chooses what the loss measures, so optimizing that number can miss other things they care about. Do not imply the loss value alone specifies which parameter to change; a later concept introduces using derivatives. Do not imply all losses are smooth everywhere, or that lower training loss proves real-world success.

Ask optionally: “Why is ‘wrong by this much’ useful, and what did the choice of loss tell the system to care about?”

Acceptance: verify exact predictions give zero loss, symmetric positive/negative errors produce equal absolute/squared loss, and one large miss affects the two losses differently. The plotted distances, aggregate, and example table must agree. The error readout is a property of the toy model, never a grade for the learner.
```

## Gradient descent: make the next nudge

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: gradient-descent. Use branch experiment/06-gradient-descent.

Build a one-parameter optimization instrument. Use an explicitly labelled one-dimensional toy loss such as L(w) = (w − 3)^2. Let the learner choose an initial parameter and step size, predict a helpful direction if they want, then take one update or a bounded sequence of updates.

Use the real derivative and update w_next = w − learning_rate × derivative. Show the current loss, the local slope and each actual change. Offer sensible, too-small, and too-large step sizes so the learner can see slow progress, overshoot, oscillation, or divergence. Keep the main language concrete (“which way, how far, what happened”); expose the equation as an optional explanation.

A graph can help after a step, but label it as a fully visible one-dimensional teaching example. The update should use the current derivative, not secretly look up the minimum at 3. Explain that real models have many parameters and that local updates do not generally guarantee a global best setting. Do not revive an unlabelled ball-on-a-landscape story that AGENTS.md rejects.

Ask optionally: “What information did the next step use, and why can a step that is too large make things worse?”

Acceptance: test a step from each side, zero derivative at the minimum, a convergent step size, and an oscillating/diverging case. Bound the step count and numeric range with an honest stopped state. Reset and Pause must cancel pending animation work, including in a background tab; reduced motion should show the same computed sequence without required animation.
```

## Generalization: fit the dots, then meet new ones

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: generalization-overfitting. Use branch experiment/07-generalization.

Build a small model-fitting experiment with noisy one-dimensional training observations and a separate fixed set of unseen observations. Let the learner compare a simple fit and a more flexible fit, then reveal how they predict examples they did not fit on. Plot the actual predictions and show training error beside unseen-data error.

Use a deterministic, documented dataset that demonstrates the difference honestly. Choose a numerically stable real fitting method; calculate both error values from its predictions. A simple regression and a flexible interpolator are acceptable if their limitations are named. Avoid an animation that changes a curve while its displayed scores come from a hand-authored lookup table. Keep the same unseen dataset while comparing models.

The central moment is a fit that matches the training points very well but transfers poorly. Frame this as evidence to investigate, not a claim that complexity or perfect training accuracy is always bad. Show the noise in this toy and why fitting it can hurt a new prediction. The data-error values belong to the toy model, not the learner.

Ask optionally: “Why can the model that fits these examples best be worse on an example it has never seen?”

Acceptance: verify error calculations, that held-out points are never inputs to the fit, and that the same parameters produce both displayed curve and reported predictions. Test a noiseless counterexample so the implementation does not bake in ‘more flexible always fails’. Reset must restore the dataset and comparison state reproducibly.
```

## Depth: switch the bend off

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: layers-depth. Use branch experiment/08-layers.

Extend the arithmetic idea beyond the existing neuron with a tiny, fully visible network that distinguishes whether two binary inputs are different (XOR). Keep its weights fixed and explain that this experiment demonstrates a computation, not training.

One valid construction uses hidden units h1 = ReLU(a − b), h2 = ReLU(b − a), with output h1 + h2. Let the learner toggle a and b, predict the output, and inspect every computed intermediate value. Then provide a clearly labelled switch that removes the bending functions: the same weights now produce (a − b) + (b − a), which is always zero. Show the two variants side by side or preserve a readable comparison.

The insight is that composing only affine transformations still gives an affine transformation; the nonlinearity changes what the composition can express. Do not imply every single neuron corresponds to a named real-world concept, or that arbitrary depth always helps. Do not imply this exact XOR construction is the only possible network, and do not silently change weights when the learner toggles the bend.

Ask optionally: “What changed when we kept the weights but removed the bend? Why didn’t the extra layer rescue it?”

Acceptance: verify all four binary input combinations in both modes and each intermediate value. Every wire must connect a real input/output in the calculation, with textual values also available. Avoid relying on colour or moving particles to convey the result. The standalone neuron must keep working and retain its own settings.
```

## Embeddings: inspect neighbours without faking meaning

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: embeddings. Use branch experiment/09-embeddings.

Build a small embedding-neighbour explorer using a documented, local fixture of real pretrained vectors. Choose a manageable set of vocabulary items and record the source, model, licence, vector type, and preprocessing. A static pretrained word-vector dataset is acceptable if it is explicitly labelled as word embeddings rather than a modern model's contextual token representations. Research the primary source before choosing or shipping the fixture.

Let the learner search the available vocabulary, select an item, inspect part of its numeric vector, and compare its nearest neighbours using cosine similarity calculated in the original vector space. A 2D projection can be an optional illustration, but name the projection and prominently explain that it discards information. The nearest-neighbour list must be based on full vectors, not distances in the picture. Selecting points or list entries should update the same state.

Do not generate random/hash vectors and describe them as learned meaning. Do not assign human semantic labels to arbitrary individual dimensions. For input outside the local vocabulary, say so and suggest available examples rather than pretending to calculate an embedding. Distinguish a static embedding lookup from the contextual representations a model computes later; do not animate context-dependent movement without actual contextual vectors.

Ask optionally: “What do these numbers let us compare, and what can this flat picture fail to show?”

Acceptance: test cosine similarity, vector dimensions, zero-norm protection, self-neighbour filtering, deterministic neighbour ordering, and search with unavailable text. Use an accessible list alongside any plot. Keep the fixture small enough for a responsive browser and disclose exactly what the demonstration can represent.
```

## Holding data back: keep a genuinely unseen test

```text
You are implementing one interactive learning experiment in Edgewise.

Repo: https://github.com/craigraphics/edgewise
Working checkout: /Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise
Base branch: proposal/playable-map, including the side-panel scroll fix. Create a separate local branch for this experiment. Check the current work before editing; preserve uncommitted changes. If another session is using this checkout, use a separate worktree. Do not publish or deploy.

Read AGENTS.md, docs/handover.md, docs/playable-map.md, and this concept's entry in content/graph.json first. Read the relevant bundled Next.js documentation before changing framework code. Inspect the neuron experiment, FocusedMap, Inspector, and ExplainBack. Build and integrate only the experiment below. Reuse any experiment launcher already present; extend the current neuron-only wiring minimally when needed, preserving the neuron. Keep experiment state per concept at workspace level so navigation does not reset it. Do not build the other experiments in the handoff pack.

Make this a small, usable instrument: change something, inspect a consequence, and optionally explain the mechanism. Prefer immediate feedback when exploration is the point; use a prediction only when it adds a useful question. No points, learner scores, streaks, locked levels, or automatic mastery marks. Numerical model error is fine when it is the subject of the experiment. Controls, completion, and correct predictions must never write learner marks. Only the existing assessed explanation/upgrade path can improve this concept; prerequisite and dependant marks remain unchanged.

Expose a discoverable action on the relevant concept and render the experiment in the main workspace, with the existing explanation available alongside it. Keep Full map and List accessible. Return trips to the experiment must preserve both its settings and an unfinished explanation. Use the existing visual language, readable labels and native keyboard controls; dragging must have an alternative. Announce meaningful results without narrating every animation frame. Label simplifications where they affect interpretation. Keep the scroll fix: the guide owns scrolling for static idea content; never trap controls below the viewport or collapse the walkthrough reading area to zero.

Verify in a real browser at desktop and mobile sizes, including 320px wide and a 450px-high viewport. Reach the final controls by wheel/touch and keyboard after resizing and opening a long explanation. Verify reduced motion, reset, navigation, and that experiment activity leaves marks untouched. Add meaningful tests for the numerical or encoding mechanism and its edge cases. Run pnpm test, pnpm lint, pnpm typecheck, and pnpm build --webpack. Report what was actually tested. Do not change assessor prompts/schema/models or graph prerequisites as part of this work; those require the repository's separate validation process. Update the design record and handover, then leave a working local preview, a reviewable commit, and concise instructions for trying it.

Your experiment
Concept ID: train-test-split. Use branch experiment/10-train-test-split.

Build a small experiment that separates training, validation, and test data. Let the learner inspect a labelled collection of examples and assign examples to the three sets with accessible controls. Use actual sample IDs, not decorative piles whose membership is unrelated to the calculation.

Fit a simple model only on the training set. Allow a small choice of model settings and compare them using validation results. Keep test labels/results hidden until the learner explicitly reveals the final test. After the test has been viewed, any further choice informed by it should visibly mark that test as already seen; do not keep advertising it as untouched. Offer a clearly labelled fresh-experiment reset that restores the intended data split and observation state.

Use a fixed, reproducible toy dataset and real fitting/error calculations, reusing available utilities when possible. Show why evaluating on the examples used for fitting answers a different question from testing on held-back examples. Explain that repeatedly using a held-out result to make decisions leaks information into the selection process; it does not mean a single button press literally inserts every test example into the fit. Separate this concept from the overfitting experiment by emphasizing experimental procedure and observation history.

Ask optionally: “Which examples influenced the model or our choice of settings, and which result is still an independent check?”

Acceptance: verify the three sets are disjoint, fitting never reads validation/test labels, and test results remain hidden until requested. Handle empty or undersized training/evaluation sets without invented results. Changing a model after seeing test performance must preserve the ‘already seen’ warning. Repeated resets and navigating to another concept must have explicit, predictable effects on the experiment state.
```
