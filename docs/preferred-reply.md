# Why does it answer, instead of adding more questions? — `pretraining-vs-posttraining`

An experiment on **Becoming an assistant**, built to the same rule as the
nineteen before it: change something, inspect the consequence, optionally
explain it. Reached from the concept's inspector ("Try the preferred-reply
experiment"), from its own invitation on the focused map, and from
`#play/pretraining-vs-posttraining`.

## The learning spine

| | |
|---|---|
| **Opening question** | Why does it answer, instead of adding more questions? |
| **First action** | Choose one of three prepared replies. Nothing is preselected, and choosing moves no number. |
| **Result sentence** | *"Learned from your choice. “A short first step” went from 25% to 52%. “More questions” and “A longer answer” went down to make room. Your feedback changed how likely each prepared reply is. It did not write a new reply."* |
| **The payoff** | The reply that answers nothing starts with the most chance, because on its own a question is often followed by more questions. One press of **Learn from this choice** reverses that, and nothing about the replies changes. |
| **The connecting sentence** | *"Predicting the next piece gives training a goal. Further training can reward examples of the replies people want."* |

## The shape of it

Somebody asks *"My bike has a flat tyre. What should I do first?"* Three replies
to it were written by hand: more questions, a short first step, and a longer
answer. Each card carries its reply, one line saying what kind of continuation
it is, and its current chance with a bar. The opening chances are **55% / 25% /
20%**, with the reply that answers nothing on top.

Choose a card — the whole card is the control — and press **Learn from this
choice**. The chances become **31% / 52% / 16%**, the sentence beside the button
says which moved and by how much, and every reply is still word for word what it
was.

Only then does the name arrive: training a model further on which replies people
prefer is post-training.

## The model is real, and checkable by hand

`src/lib/experiments/preference.ts`. Each reply has one score; `chances` is a
softmax over the three, `howFarOff` is the cross-entropy loss against the chosen
one, and `learnFrom` is one gradient step on that loss:

```text
chance_i  =  e^(score_i) / Σ e^(score_j)
howFarOff =  −ln(chance of the chosen reply)
score_i   ←  score_i − step × (chance_i − 1 if chosen else chance_i)
```

Nothing moves a bar by a hard-coded amount and nothing swaps a reply for a
different one after a press. The opening round is checkable on paper: from
scores `[1, 0.2, 0]` the chances are `0.550295 / 0.247263 / 0.202442`, a step of
1 on the middle reply gives scores `[0.449705, 0.952737, −0.202442]`, and those
are the `31% / 52% / 16%` on screen. `howFarOff` falls from **1.397** to
**0.652**.

The step never overshoots, whatever its size: the chosen score rises by
`step × (1 − its chance)` and every other falls by `step × its chance`, so the
gap always widens. That is why the panel offers no step-size control, and the
copy says so rather than leaving it to be discovered.

**The expectations are not taken from the code they check.** `learnFrom`'s
implied gradient is held to a central difference of a loss written out again
from its definition in the test file, which shares no arithmetic with the
closed form, and the opening round is worked out on paper. That is the "do not
assert a measure against itself" rule closed by a ninth route, after the
tokenizer decoded `bpe_ranks` independently, the predictor checked the
least-squares conditions, the representation playground brute-forced all 65,536
pictures, the loss panel used hand arithmetic, the generalization panel used
answers worked out on paper, word-neighbours pinned to a published file,
attention recomputed from literal `Math.exp` calls, and the transformer kept a
second implementation in its test file.

## Two things are the shape of a function, not a promise in a comment

1. **Only the chance of choosing among the supplied replies can move.** The
   state carries one score per entry of `REPLIES`, and `learnFrom` returns a
   list of the same length. There is nowhere for reply text — or for anything
   about bicycles — to be learned. A test runs twenty rounds and requires
   `QUESTION` and `REPLIES` to be deep-equal to a clone taken beforehand. So
   *"nothing here transfers to a question these three replies do not already
   answer"* is a fact about the data, not a disclaimer.

2. **Pointing at a reply cannot train anything.** `applyAction` carries the
   `scores` array through **by reference** for a `select`, so the test asserts it
   by identity — `expect(pointed.scores).toBe(state.scores)` — rather than by
   reading the handler. The brief's "no updates while merely inspecting or
   selecting" is checkable, not claimed.

A reducer, not a bag of setters, for the reason the working-backwards experiment
records: the actions are ordered and are not idempotent. **Two presses in quick
succession are exactly two steps, applied in order, with none lost and none
applied twice** — asserted in the unit tests and then confirmed in the browser
two ways (below). An action that would do nothing — learning with nothing
chosen, choosing a reply that is not one of the three — returns the state
itself, so React re-renders nothing.

## What is invented, and said on screen

- **The three replies.** Written by hand. The line beside the choices says so:
  *"All three were written by hand for this example. The model learns which one
  to choose, never what to say: it is not writing bicycle advice."*
- **The opening chances.** 55/25/20 is a made-up "before" state, not anything
  measured from a real base model, and the panel says so under the button until
  the first round runs. A real base model's behaviour depends on the model and
  on the surrounding text.
- **Nothing else.** Every number after the first press is computed. No network:
  zero fetches, zero XHRs and zero new resource loads while driving the whole
  panel.

## The node's two misconceptions, on screen after the fact

1. *Thinking helpfulness emerges from pretraining.* The reply that answers
   nothing opens with the most chance, and the name card says why: on its own, a
   question is often followed by more questions. Answering gets more likely when
   training rewards it.
2. *Treating a model's personality and refusals as properties of the technology
   rather than choices made by people.* **"People chose. How a model answers, how
   much it says, and what it declines to say are choices made by people during
   this stage. They are not fixed properties of the technology, and different
   people choose differently."**

**Try another preference** is the second half of that: both the short answer and
the longer one answer the question, so choosing between them steers manner
rather than willingness to answer, and neither is presented as the right one.
The live sentence there — *"The short one leads at the moment, 52% against
16%"* — is read off the current chances rather than written down.

## No prediction step

The learner has been given nothing they could use to work out how far a chance
will move, and asking somebody to guess an unexplained number is what `AGENTS.md`
already forbids. The interesting move is choosing and watching which numbers
respond, so every press shows at once.

## A disagreement with the authored text, recorded and not acted on

The node's `explanations.intuition` says the assistant persona, the tone, the
refusals and **"the willingness to answer at all — all of that is added
afterwards"**, and frames post-training as manner.

That is stronger than the evidence in two places. A model trained only to
continue text is not silent: it answers questions, especially where the text in
front of it makes an answer the likely continuation, and showing one a few
worked examples first was the standard way to get useful answers out of it
before instruction tuning. And further training changes what a model knows and
what it can do, not only how it sounds. The node's own `simplificationCost`
already concedes the other half — that this treats post-training as a tidy
second stage when it is several overlapping ones.

**Nothing was changed.** The graph, the assessor prompt, the decision schema and
the model list are untouched. The panel's wording is chosen to be *true beside*
the authored text, which is visible in the inspector at the same time on a wide
screen: *"Further training makes answering reliable and steerable rather than
possible for the first time"*, and *"Further training changes what a model knows
and what it can do, not only its manner."* Whether the authored sentence should
acquire a clause is the owner's call.

## Verified

Chrome via BrowserOS neo, against `pnpm dev`, navigating through `about:blank`
before each case — a hash-only change is a same-document navigation and carries
React state across it, which `docs/experiment-links.md` already records.

| Check | Result |
|---|---|
| Panel title → first action | **449** at 320×568, **374** at 390, **304** at 560, **413** at 1100×700, **359** at 1230×842 |
| Same, sibling panels as a control in the same run | rag 323, context-window 198, next-token 389, attention 95, loss 54 (at 1230×842) |
| Panel title → **Learn from this choice** | **311** at 1230×842 and every width from 640 up; 1318 at 320 (one column, after the three cards) |
| Page scroll, ten widths 320–1920 | **0** vertical, **0** horizontal |
| Clipped right / controls off right | **0 / none**, every width |
| Same, **after resizing a loaded page** through all ten | identical to the fresh loads, every row |
| Tap targets inside the panel | all **≥40px** (40, 44, 145, 167, 190) |
| Focus stops in the panel | **9**, all reachable; real <kbd>Tab</kbd> gives `:focus-visible` and a `2px solid` outline |
| Last control and the closing line | reachable; `.focus-map` keeps scroll ownership, page scroll stays 0 |
| Focus on open | `preference-lab-title`, focused and scrolled to |
| Contrast, light (canvas pixel read-back) | worst text **5.55**, worst graphic **4.16** |
| Contrast, dark | worst text **7.89**, worst graphic **6.89** |
| Theme genuinely changed between the two runs | `--surface-0` moved `[250,249,245]` → `[10,12,17]` |
| `--band-behaviour` painted as text | **never** — walked every element with its own text node and compared painted colours |
| Learning: 20 presses in **one** task vs 20 presses **one per task** | both exactly 20 rounds, both `2% / 97% / 2%`, byte-identical |
| Chances after 1 and 2 rounds | `31/52/16` then `19/69/12`, agreeing with the unit tests |
| Reset from every state | back to 55/25/20, nothing chosen, Learn disabled, no name card, no Reset offered |
| Learn with nothing chosen | disabled, with the reason beside it |
| `aria-live="polite"` | carries the derived sentence, and a fallback so it is never empty |
| Network while driving the whole panel | **0 fetches, 0 XHRs, 0 new resource loads** |
| `document.getAnimations()` | **0**, open and driven |
| Leave to Full map and back; visit another idea and back | chances and round count survive both |
| Explanation: open, type, close, reopen | draft survives; the form opens empty with submit disabled |
| Learner model, populated with ten marks | **byte-identical** before and after driving the whole panel |
| One real explanation through the live assessor | `pretraining-vs-posttraining` **`blocked` → `known`**, all nine other marks unchanged |

The ten-mark model used for the invariance check included this node and both its
prerequisites (`next-token-prediction`, `loss`), not an empty one.

200% browser zoom was checked as an equivalent 640px reflow rather than driven
directly: BrowserOS cannot drive browser-chrome zoom. 320px was measured too.

## Defects found by measuring or driving, not by reading

1. **`Learn from this choice` sat 1063px below the panel title at 1230×842**,
   entirely off the bottom of the window, and 1147 at 1100×700. The container
   query was set at 44rem, copied from the notice-search panel. Measured on the
   **content box**, which is what a container query reads, this panel gets 535px
   at 1100, 614 at 720, 664 at 1230 and 696 at 768 — the query fired at none of
   them. A first pass at 37rem still missed 1100, because the panel's padding is
   `2.5vw` and the pane is not the viewport. **33rem** is under all four and
   never leaves the reply column narrower than the 276px one gets on a phone.
   **311–345 now, on screen, at every width from 640 up.** Eighteenth time a
   defect in this project was found by measuring rather than reading.
2. **The first action was 527px below the title**, the worst of the nineteen
   panels, because it was a button 178px inside the first card. The whole card
   is the control now, and the chance sits outside it — a number that moves
   every round has no business inside a button's accessible name. With a
   trimmed intro, a shorter question and shorter reply copy: **449 at 320, 359
   at 1230×842.**
3. **The chance row printed the percentage twice, adjacent** — `31% · was 55%,
   now 31%`. It says what it was; the number it is now is beside it.
4. **A chance that was really there printed as `0%`, and one that was not
   everything printed as `100%`.** Both states are real and neither ever
   arrives: measured, a losing reply drops under half a percent on round 72 and
   the chosen one passes 99.5% on round 134. Printing the rounded number would
   say a reply had been ruled out, which is the opposite of what these chances
   do. `under 1%` and `over 99%` now, with both boundaries pinned in the test —
   the same rule as the attention panel's `under 1%` and the one-step-at-a-time
   panel's `under 0.01 minutes off`.
5. **Three sentences read badly aloud.** *"The three replies are the same three
   words for word"* garden-paths on "the same three words"; *"Only how likely
   each one is moved"* reads as a noun phrase until it resolves into a verb; and
   the step size was printed as a bare `1` with nothing it could be 1 of.

## A wrong probe, caught before it was believed

The first attempt at the twenty-rapid-presses check fired `card.click()` and
`learn.click()` twenty times inside **one synchronous loop**, and reported that
not a single round had applied. The cause was the probe: React never gets to
re-render inside a synchronous task, so `Learn` was still `disabled` from the
first iteration to the last and every one of the twenty clicks was a no-op on a
disabled button. Re-run as a user could actually produce it — a choice, a
render, then twenty clicks — it applies exactly twenty rounds, and so does the
same test with a render between every click.

Worth keeping because the failure mode is this project's oldest in a new place:
**the measurement was aimed at the wrong quantity**, and a wrong number costs
more than no number.

## Not verified

- **No phone and no screen reader.** Focus order, accessible names, `aria-live`
  and `aria-pressed` were read out of the accessibility tree and the DOM. That is
  not a VoiceOver or NVDA session.
- **200% browser-chrome zoom was not driven**, only its equivalent reflow.
- **`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
  display copy that `ExplainBack` renders and never sends, and this branch
  changes no prompt, schema or model-list file. One end-to-end assessed
  explanation was submitted through the live path instead, and is reported
  above. The last four sessions recorded that canary failing on exactly two
  fixtures — 2/72 false passes for `hallucination/parroted`, which `AGENTS.md`
  records as deliberately left failing, and 3/24 false blocks for
  `neuron/technical` — and that remains the current state of the shared
  assessor.
- **This is not a learner study.** Nobody but the author has used the panel. The
  validation gate in `AGENTS.md` remains open.
