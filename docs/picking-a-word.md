# Why can the same beginning get a different next word? — `sampling-temperature`

An experiment on **Sampling**, built to the same rule as the seventeen before
it: change something, inspect the consequence, optionally explain the mechanism.
Reached from the concept's inspector ("Try the picking-a-word experiment"), from
its own invitation on the focused map, from the one-piece-at-a-time panel's
**Builds into** row, and at `#play/sampling-temperature`.

## The learning spine

| | |
|---|---|
| **Opening question** | *Why can the same beginning get a different next word?* |
| **First action** | **Pick an ending** |
| **Result sentence** | *"This pick gave “flower”, which had 60% of the chance. The chances have not moved."* |
| **The payoff** | Seven presses gave flower, flower, flower, stone, flower, dragon, flower — *"Same opening, the same chances, and not the same ending."* |
| **Second action** | **Favour the usual endings** → *"Flower has more of the chance now: 78.3% instead of 60%. The three chances the model produced have not changed. What changed is how we draw from them."* |
| **The connecting sentence** | *"A language model works out a chance for every possible next piece. Sampling is how one of those pieces gets picked."* |

## The shape of it

*In the garden I found a …*, three possible endings, and a chance each: flower
60%, stone 30%, dragon 10%. One button. The chances sit beside it the whole time
and never move.

That is the node's first recorded misconception taken apart by pressing rather
than by arguing. The model does not *decide* to phrase things differently; it
hands out chances, and something outside it draws one. Nobody has to be told
that — seven presses show it.

Then two plain-language settings reshape the chances **before** the draw, with
each row showing what it has now and what it started with:

| | flower | stone | dragon |
|---|---|---|---|
| As the model produced them | 60% | 30% | 10% |
| Favour the usual endings | **78.3%** | 19.6% | 2.2% |
| Give unusual endings more chance | 47.3% | 33.4% | **19.3%** |
| Always pick the top option | **100%** | 0% | 0% |

Every one of those figures was read off the screen in a browser, and every one
matches the arithmetic by hand: at the "favour the usual" setting each chance is
squared — 0.36, 0.09, 0.01, totalling 0.46.

**"Always pick the top option" sits apart from the other two**, with its own
note. It is a different kind of choice rather than a very small temperature: no
amount of dividing reaches zero, and rounding towards it would misreport a
decision somebody actually made.

## It is this node's turn, and the panel next door said so

`next-token.ts` has carried this line in its header since it was written:

> The highest chance always wins, with a stated tie rule. **Choosing at random
> among the likely pieces is a different idea and belongs to its own
> experiment.**

This is that experiment, and `sampling-temperature`'s only prerequisite is
`next-token-prediction`. Registering the id was enough for the one-piece-at-a-time
panel's **Builds into** row to grow a `Try it` button for it, labelled *"Try the
picking-a-word experiment"* — verified in the accessibility tree.

## The arithmetic is real, and it is written to survive small numbers

`adjust(chances, temperature)` scores each chance as `log(p) / T`, **subtracts
the largest score**, takes `exp`, and scales the results to add up to 1.

The subtraction is not tidiness. Written the obvious way every weight is `exp`
of a negative number, and a small enough temperature drives all of them below
what a double can hold: at `T = 0.0005` the largest is `exp(-1021)`, which
underflows to zero, the total is zero, and every chance comes out `NaN`. The
test asserts that the naive form really does total zero there, and that `adjust`
comes back finite and summing to 1. A panel printing `NaN` as a chance would be
teaching the exact thing this node exists to correct.

A chance of zero survives as zero at every setting, is never drawn at any random
value in `[0, 1)`, and cannot win at temperature zero even when listed first.

## Two things are the shape of a function, not a promise in a comment

- **The starting chances cannot be written to.** `adjust` takes them as a
  parameter and returns a new array, so every setting is worked out from the
  same three numbers. The same structural move as `answerWith(learned, distance)`
  in `phases.ts`. A test drives a full adjust-and-draw sequence and requires
  `ENDINGS` to come back byte-identical.
- **The randomness is a parameter.** `drawFrom(chances, random)` and
  `drawBatch(chances, count, random)` take the source in their signatures rather
  than reaching for `Math.random` inside. There was **no `Math.random` anywhere
  in `src/`** before this branch — the only generator was a private,
  hard-coded-seed LCG inside `embeddings.ts` — so this is the first real draw in
  the repo, and it belongs somewhere it can be seen. `Math.random` is named once,
  at the call site in the click handler.

## The name comes last, and carries the second misconception

Nothing says **temperature** until a setting has been used and a real change is
on screen. The card then makes three points, and the third is the node's other
recorded misconception:

> **Always taking the top option is a real choice, not a mistake.** For a short
> factual answer it is often what you want. Over a long piece of writing it tends
> to circle back on itself, because the most likely continuation of a sentence
> you have already written is often that sentence again.

And the middle one is the limit people most often get wrong about the dial: it
cannot make an ending more accurate, it does not measure imagination, and it has
no way of checking whether an answer is true.

## What is invented, and what is not

**Chosen for this example, and labelled on screen beside the numbers it
qualifies:** the three starting chances. They were not measured from a language
model, and no model ran to produce them.

**Never claimed:** that temperature zero makes a real service deterministic.
*What this example leaves out* says it plainly — taking the top option here gives
the same word every time because this is a closed list of three with nothing
level in it, and that is not a promise that asking a real service the same
question twice gives the same answer.

It also says what the panel is not showing: three endings against the tens of
thousands a real model has a chance for, and the separate cut real systems
usually make to the unlikely tail before drawing at all.

**A dragon in a garden is unusual, and that is all it is.** The panel says so:
nothing in the drawing treats it differently from the other two.

## Counts describe the draws, never the learner

Under **Try a few more**, `Draw 20 more` accumulates a tally beside the chances
it was drawn from. Measured: 66 / 25 / 9 out of 100 against 60 / 30 / 10, and
74 / 26 / 0 out of 100 against 78.3 / 19.6 / 2.2. The note under it says a long
run usually sits close and a short one can sit some way off, and that this is
ordinary drawing rather than a fault in it.

**Changing the setting starts the picks and the counts again**, and the panel
says so where the setting is changed. A draw only means something beside the
chances it came from.

## Tests — `src/lib/experiments/sampling.test.ts`

46 tests. The expectations are worked out **independently** of the implementation.

**The independent route is the tenth this project has used.** After `bpe_ranks`
decoded independently, the least-squares conditions, brute force over 65,536
pictures, hand arithmetic, answers worked out on paper, pinning to a published
file, literal `Math.exp` calls, a second implementation of a whole transformer
block, and a naive scan of raw story text — this one is the **power form**.
`softmax(log p / T)` is algebraically `pᵢ^(1/T)` scaled to add up to 1, and the
test computes exactly that with `Math.pow`, sharing no code and no intermediate
value with `adjust`. It is checked across nine temperatures, and only across the
range where `Math.pow` itself stays in range — which is the whole reason `adjust`
is written the other way.

Alongside it, arithmetic anybody can check: the three chances squared are 0.36,
0.09 and 0.01, totalling 0.46.

The rest, each its own test: the starting distribution totals 1 and nothing is
impossible; `adjust(p, 1)` gives the chances back; every output totals 1 across
a sweep; the top chance rises monotonically as the setting favours the usual and
is above 0.999 at `T = 0.05`; the spread shrinks monotonically the other way and
is within 0.01 of a third at `T = 50`; the order is never reordered; temperature
zero is a deterministic argmax with a tie to the first listed; zero chances stay
zero and are never drawn; the small-temperature case stays finite; `adjust` does
not mutate its input; a negative, `NaN` or infinite temperature throws; the draw
boundaries are driven from both sides with an injected source; a seeded
`mulberry32` batch of 20,000 lands within 0.02 of every chance, at three
settings; and `describeChange` names the ending that actually gained the most.

**The four settings are held to what they do, not to their own copy.** A test
requires the "usual" setting to raise the top chance and the "unusual" one to
raise the bottom chance, so rewriting a label can never quietly turn one into
the other. Another rejects a verdict word — *best*, *worse*, *too far* — in any
label or note: a label says how the chance is spread, never how a draw will turn
out.

`registry.test.ts` gains a registration test pinning this experiment's four
strings, matching the `rag` and `backprop-intuition` ones already there.

## Verified

Chrome via BrowserOS neo, against `next dev`. Every case re-run through
`about:blank` first — a hash-only navigation is a same-document navigation and
carries React state across it, which `docs/experiment-links.md` records.

| Check | Result |
|---|---|
| Panel title → first action, 1230×842 | **274px**, action in view |
| The same, 320×568 / 390×844 / 720×450 / 1100×700 / 1440 / 1920 | 390 / 335 / 308 / 274 / 274 / 274 |
| Sibling panels measured as controls, same run, 1230×842 | attention 95, context-window 198, **sampling 274**, rag 323, next-token 389 |
| Sibling panels as controls, 320×568 | attention 149, context-window 293, **sampling 390**, rag 476, next-token 525 |
| Action → the sentence it continues | **12px**, every width |
| Page scroll, seven widths 320–1920 | **0** vertical, **0** horizontal |
| Clipped right / controls off right | **0 / none**, every width |
| The same, **after resizing a loaded page** through thirteen steps, both directions, across the 1100 breakpoint | **0 / none** |
| Tap targets inside the panel | all **≥40px**, every width |
| Focus stops in the panel | **11**, all with a visible outline, all scrolled into view, at 320×568, 720×450 and 1230×842 |
| Last element + every disclosure expanded | reachable; the guide pane keeps scroll ownership, page scroll 0 |
| Contrast, text, light / dark (canvas pixel read-back, 70 elements) | worst **5.55** / **7.89** |
| Contrast, chance bars, light / dark | worst **3.83** / **8.62** |
| Contrast, card leading edges, light / dark | **4.18** / **9.50** |
| `--band-language` printed as text | **never** — bars and leading edges only, every chance printed as text beside its bar |
| Seven picks from unchanged chances | flower, flower, flower, stone, flower, dragon, flower |
| The three settings, read off screen | 78.3 / 19.6 / 2.2, then 47.3 / 33.4 / 19.3, then 100 / 0 / 0 — all matching the hand arithmetic |
| Always pick the top option, four presses | flower every time |
| Batch of 100, as given / favouring the usual | 66·25·9 and 74·26·0 |
| Tally on a setting change | cleared, and said so |
| 40 rapid alternating presses | ends consistent; sentence, rows and picks agree |
| Reset from a driven state | pristine first screen, Reset no longer offered |
| Focus → Full map → List → Focus | setting, picks and name card all survive |
| Leave to another idea and come back | the same |
| Explanation opened from the panel | empty field, submit disabled, the registry prompt shown |
| Close the explanation and reopen it | the typed draft survives |
| Network while driving the whole panel | **0 fetches, 0 XHRs, 0 new resource loads** |
| `document.getAnimations()` | **0**, open and driven, every width |
| Learner model, populated with ten marks | **byte-identical** before and after |

The ten-mark model used for the invariance check included `sampling-temperature`
itself and its prerequisite `next-token-prediction`, not an empty one.

## Defects found by measuring or driving, not by reading

1. **The result sentence went stale on a setting change.** Drawing "flower" at
   60% and then pressing **Favour the usual endings** left the sentence
   reporting 60% while the row beside it said 78.3% — a chance no longer on
   screen anywhere. Under "always pick the top option" it read 78.3% against a
   row saying 100%. The picks and the counts both belong to one setting now, so
   changing it clears both and the panel says so where the change is made. That
   is the rule the tally already followed; extending it to the picks removes
   every way the sentence could describe chances the learner cannot see.
2. **The first action sat 482px below the panel title at 320px.** The label
   saying the chances were chosen for this example moved to sit beside the
   chances it qualifies, and the eight-word question drops to `text-xl` below
   `sm`. **390 at 320, and 293 at 1230** after that pass. Eighteenth time a
   defect in this project was found by measuring rather than reading.
3. **The button sat about 90px below the sentence it continues.** The chances
   card spans both grid rows, so slack from a tall card was shared out and row
   one grew. All of it goes to row two now: **12px**, and the first action came
   down again to **274 at 1230**.
4. **The "started at 60%" line was two pixels closer to its own row than to the
   next one**, so it read as a caption for the ending below it. Two against ten
   now.

## A wrong probe, recorded rather than hidden

The first contrast run reported three of the setting buttons at **1.10:1** in
dark mode and nothing wrong in light. The cause was the probe: it took the first
non-transparent ancestor background and painted it over an empty canvas, and
dark mode's outline buttons carry a *translucent* background, so it was
measuring the label against near-black. That is compositing over black — the
same wrong probe `docs/words-around-it.md` already records once.

Corrected by building the painted background from the outermost **opaque**
ancestor down, layering every translucent background in order, the three
"failures" are gone and the worst text in the panel is 5.55 light and 7.89 dark.

The theme was confirmed to have actually moved before any number was believed:
`--surface-0` went from 97.8% lightness to 3.3%. The theme here is a **class on
`<html>`**, not `data-theme`, and identical figures across themes has now been
the tell four times.

### A pre-existing condition, measured against two siblings as controls

Every 1px hairline border in the panel measures about **1:1** against what is
behind it, in both themes. So does every hairline in the `next-token` and `rag`
panels, measured in the same run: 13 each, worst 1.00. This is shell-wide
`--border`, which `globals.test.ts` deliberately does not hold to a graphic
floor — it is a decorative hairline, and the content inside every one of those
boxes is text, which passes. Recorded, not blamed on this branch.

## A disagreement with the authored node, recorded rather than acted on

The node's `misconceptions` says that always taking the most likely token *"in
practice produces flat, repetitive, looping text"*, and its `explanations.example`
says temperature zero makes a model *"near-deterministic"*. Both are fair about
real language models.

Neither is demonstrable here, and one of them is narrower than it sounds. In a
closed list of three, taking the top option is **exactly** deterministic, not
near it, and "flat and repetitive" cannot be shown at all. The panel therefore
says which is which on screen: it states that taking the top option here gives
the same word every time *because* the example is closed, that this is not a
promise about a deployed service, and that greedy choice is a real choice with
real uses rather than a mistake — which is a softer claim than the authored
misconception makes.

**Nothing was changed.** The graph, the assessor prompt, the decision schema and
the model list are untouched by this branch. Whether the authored sentences
should acquire a clause is the owner's call.

## Not verified

- **No end-to-end assessed explanation was submitted, and
  `pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
  display copy that `ExplainBack` renders and never sends, and this branch
  changes no prompt, schema or model-list file, so the claim that nothing here
  moves a mark rests on the component having no learner-model access and on the
  before/after storage reads above. `docs/how-far-off.md` and
  `docs/notice-search.md` record the same gap. The last five sessions recorded
  that canary failing on exactly two fixtures — 2/72 false passes for
  `hallucination/parroted`, which `AGENTS.md` records as deliberately left
  failing, and 3/24 false blocks for `neuron/technical` — and that remains the
  current state of the shared assessor.
- **No physical phone and no screen reader.** The keyboard order, the focus
  outlines, the live regions and the accessible names were read out of Chrome's
  accessibility tree; that is not a VoiceOver or NVDA session.
- **200% browser zoom was not driven.** BrowserOS cannot drive browser-chrome
  zoom. The equivalent reflow check was run instead, at a 320 CSS pixel viewport
  with every disclosure expanded, which is what WCAG 1.4.10 asks for.
- **The panel starts below the fold at narrow widths**, and so do its siblings:
  the first action is off screen at 320×568 and 720×450 for this panel, for
  `rag` and for `next-token-prediction` alike. Shell behaviour already recorded
  in `docs/one-block.md`, not something this branch introduces.
- **A typed explanation is lost on navigating to a different concept and back.**
  Shared shell behaviour for all 23 nodes, recorded rather than changed here.
  Trips within this concept — map views, experiment ↔ explanation — all preserve
  it, and that was checked.
- **No learner has used this.** The validation gate remains open.
