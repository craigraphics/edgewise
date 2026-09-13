# How can the words around "bank" change what it means here? — `attention`

An experiment on **Attention**, built to the same rule as the eleven before it:
change something, inspect the consequence, optionally explain the mechanism.
Reached from the concept's inspector ("Try the words-around-it experiment"),
from its own invitation on the focused map, from the `Try it` button on any
neighbour's card, and at `#play/attention`.

## The three things written before any code

| | |
|---|---|
| **The opening question** | "How can the words around “bank” change what it means here?" |
| **The first action** | "Try a money sentence" — one button, directly under the sentence it replaces |
| **The result sentence** | "The earlier words changed what went into the last word's description. The largest share came from **river** (43%). Nothing was left out: every earlier word, and the word itself, got a share." |

## The first screen

One sentence — *We walked beside the river to the bank.* — with `bank` marked
and captioned **Updating the last word: bank**. Under it, the before and after:

| | outdoors | money |
|---|---|---|
| `bank` on its own | 1.00 | 1.00 |
| `bank` in the river sentence | **1.60** | 0.21 |
| `bank` in the money sentence | 0.24 | **1.78** |

`bank` on its own is exactly even, so nothing but the words around it breaks the
tie. That is asserted in the test rather than described in the copy.

Nothing on that screen says attention, query, key, value, softmax or score, and
there is no grid of every word against every word — only the one row the
question is about. "A small example with numbers chosen to show the steps" sits
beside the action, as required.

**No prediction step.** The learner has been given nothing they could use to work
out which way the blend will move, and asking somebody to guess an unexplained
number is what `AGENTS.md` already forbids. One press, and the answer is there.

## The connection to the earlier idea

Directly under the result, so it lands once the change has been seen:

> The word-neighbours experiment gave each word one saved list of numbers. Here
> that description changes with the words around it.

It reads on its own; nobody has to have opened the `embeddings` experiment.

## What the arithmetic actually is

Real single-head **causal self-attention**, in `src/lib/experiments/attention.ts`:

```
match_i = (q · k_i) / √2      for i ≤ target only
shares  = softmax(match)      max-subtracted
after   = Σ shares_i × v_i
```

with the query, key and value settings left as the **identity**. That is a
deliberate simplification, stated on screen under *How it works*: it makes every
number a learner can check against the vocabulary table, which is worth more
here than three matrices nobody would multiply. Real models learn those three
sets of numbers, and the panel says so.

The whole vocabulary, hand-written, in two columns:

| word | outdoors | money |
|---|---|---|
| bank | 1 | 1 |
| river | 3 | 0 |
| cash | 0 | 3 |
| walked | 1 | 0 |
| took | 0 | 1 |
| we, beside, the, to | 0 | 0 |

The river sentence's shares: **river 43%, bank 21%, walked 10%**, and the five
all-zero words at **5% each**. Several shares, a clear leader, nothing at zero —
and a test rejects a leader above 60%, because a single winner would read as the
model picking one word, which is this node's first recorded misconception.

## It cannot look ahead, and that is the shape of the function

`updateAt(words, index)` slices to `index` and stops. A later word is not scored,
not weighted and not blended: it is not in scope at all. Same structural move as
`answerWith(learned, distance)` in `phases.ts` and `learnFilter(examples)` in
`junk-filter.ts`. A test replaces every word *after* the target with nonsense and
requires the contributions, the blend and the leading word to come out
byte-identical; another replaces an allowed earlier word and requires the result
to move.

Because `bank` is last in both sentences, that rule is invisible on the first
screen. So *Why it cannot look ahead* runs the same arithmetic on `river`, word 5
of 8, and shows `to`, `the` and `bank` struck through as **not used at all** —
*"Not a small share. No share, no match number, not in the arithmetic."* It also
makes a second point for free: `river` keeps 98% of its own description and moves
from 3.00 to 2.96, because it is already a clear word.

## The expectations are worked out by hand, not by the function under test

Asserting a measure against itself is the trap this project has closed six times
— `bpe_ranks` decoded independently, the least-squares conditions, brute force
over all 65,536 pictures, hand arithmetic, answers worked out on paper, and
pinning to a published file. This one closes it a seventh way.

The query is `bank`'s own description, `[1, 1]`, so each word's match before
scaling is just its two numbers added up: **0, 1, 0, 0, 3, 0, 0, 2** — every one
readable straight off the vocabulary table. The shares are then recomputed in the
test from literal `Math.exp` calls, and the blend from a second loop over the
words. Neither `shares` nor `updateAt` is used to produce an expectation.

The other build checks: shares never negative and always totalling 1 to 1e-12,
for every sentence and every target position; adding a constant to every match
leaves the shares identical; a match of 1000 gives no `NaN` or `Infinity`; equal
matches give equal shares to 1e-12, and exactly 0.5/0.5 on a two-word case; every
word in every sentence has a description and an unknown word throws rather than
being silently treated as zero; the same word is described identically in both
sentences; and `updateAt` is pure.

**27 tests**, no browser.

## Two rules the panel states, and holds itself to

**Every allowed word gets a real share.** `percent` prints `under 1%` rather than
`0%` when a share is genuinely above zero — the same move as the
one-step-at-a-time panel's `under 0.01 minutes off`. Found by driving the *Why it
cannot look ahead* section, where three words sit at 0.19%: a printed `0%` beside
the sentence *"They still get one. Nothing is dropped."* would have contradicted
the panel's own claim. A test walks every word of every sentence at every target
position and requires no share to print as `0%`.

**The column adds up.** The panel tells the learner to add the column, and at two
decimal places 1.28 + 0.21 + 0.10 prints as 1.59 under a total of 1.60. The
unrounded parts total exactly; the display loses the hundredth. `roundingShows`
compares the printed parts to the printed sum and the note appears only when they
disagree — derived, so it never claims a discrepancy on a reading that has none.

## Nothing here touches the map, checked both ways

No learner-model access anywhere in the component. Against a **populated
ten-mark model** — including this node, its prerequisite `embeddings`, and its
dependants `transformer` and `next-token-prediction` — switching sentences four
times, opening and closing all three sections, twenty rapid presses of the one
action, and Reset left `localStorage` **byte-identical**.

Then one real explanation submitted through the live assessor moved `attention`
**`blocked` → `known`** and left **every other key unchanged**. The reply led
with what the explanation got right and then corrected the tone: *"Just keep in
mind that this is all automatic arithmetic rather than the model choosing which
words are important."*

The explanation form opens with an empty field, a disabled submit, and the
registry prompt as its accessible name, verified in the DOM.

## Verified in the browser

BrowserOS neo against `pnpm dev`, viewport emulated through CDP.

| Check | Result |
|---|---|
| Page scroll (V and H), 320 / 390 / 720×450 / 1100 / 1230×842 / 1440, all sections open | **0 everywhere** |
| `clippedRight`, same widths | **0 everywhere** |
| After a 1920 → 1300 resize | 0 scroll, 0 clipped, no control off-screen |
| Controls under 40px inside the panel | **none, at any width** |
| First action below the panel title, 1230×842 | **306px** (siblings: 286 / 334 / 344 / 431 / 445 / 471 / 520 / 521) |
| First action visible without scrolling | yes at 1440×900, 1230×842, 1100×700, 390×800 |
| 200% zoom (615×421 at dsf 2) | 0 page scroll, nothing off-screen, last control reachable |
| Scroll owners around the panel | exactly one (`focus-map`); no nested scrolling pane |
| Last control after expanding everything | reachable at 320×568, 720×450, 1230×842, 200% |
| Tab stops in the panel | 6, every one named, visible, scrolled into view, ≥40px, with a visible focus outline |
| `document.getAnimations()` with the panel open and expanded | **0** |
| Network requests while driving the whole panel | **0** |
| Settings survive `#idea/embeddings` → `#play/attention` | sentence and open section both kept |
| Unfinished explanation survives experiment ↔ explanation | 796 characters kept |
| Reset | back to the river sentence, all sections closed, storage untouched |

Contrast, measured on the painted colours through a canvas rather than on the
tokens, both themes (light / dark):

| | light | dark |
|---|---|---|
| The marked word on its tint | 15.11 | 15.81 |
| Sentence, totals, vocabulary table | 17.02 | 17.78 |
| The description numbers | 17.64 | 16.90 |
| Caption, column labels, share figures, withheld words | 5.55–5.75 | 7.89–8.30 |
| Share bar against its track *(graphic, 3:1)* | 3.36 | 8.80 |
| Band accent against the card *(graphic, 3:1)* | 4.03 | 9.99 |

`--band-language` is still **never used as text** — it measures 4.02:1 against
these cards, which `BANDS_USED_AS_TEXT` in `globals.test.ts` already records. It
carries the stage's leading edge, the marked word's underline and the share
bars, all graphics, and every number is printed as text beside its bar.

## Three defects found by measuring or driving, not by reading

**The first action was 502px below the panel title at 390px, and 416 at 1100×700
with the button below the fold.** Two intro paragraphs, one of them the
connection sentence. The connection line moved *below* the readout, where it
reads better anyway — it is about a description changing, and now it is said once
the change is on screen. **306 at 1230×842 and 431 at 320 now.**

**Each before/after card stood 176px tall at 320px, with 90px of nothing under
its two numbers.** `flex: 1 1 11rem` sets a sensible column width side by side,
and `flex-basis` is the *main* axis — so the moment the pair stacked under the
420px media query, the same 11rem became a minimum **height**. Invisible in the
code, obvious in a screenshot.

**Each share row was three lines tall, and five of the eight said "adds outdoors
0.00 · money 0.00".** True, and noise. Match, share and contribution are one
wrapping line now, and a word that contributes nothing says **"adds nothing"** —
the same fact, and also the point: a share of the blend, and nothing to put into
it. **64px a row, down from 94.**

Thirteenth, fourteenth and fifteenth time a defect in this project was found by
measuring or by driving rather than by reading.

## A note on the probe itself

A first contrast probe composited every colour over black before measuring,
which made the share track — `color-mix(in oklch, var(--border) 70%, transparent)`
— read as near-black and reported the bar at 1.52:1 in light mode. The correct
figure is 3.36. Worth writing down because the failure mode is the one this
project keeps recording: **the measurement was aimed at the wrong quantity**,
and a wrong number is more expensive than no number. Composite over the real
card colour.

## What is hand-chosen, and said so

Everything. The nine descriptions, the two column names, and both sentences.
The panel states it three ways: *"A small example with numbers chosen to show
the steps"* beside the first action; *"Every number here was chosen by hand"*
above the full table; and, under *How it works*, that in a real model nobody
labels the columns, there are hundreds of them, and no single one means anything
you could name.

**These toy values are not a substitute for the real learned ones.** The
`embeddings` experiment carries 163 words of GloVe 6B under PDDL v1.0, and that
is where "what a learned description actually looks like" lives. This node is
about what happens to one when the words around it are used.

## A disagreement with an authored simplification, recorded rather than acted on

The `embeddings` node's authored text says *"nobody decided what any single
dimension means"*, which is true of real models and is exactly the point of that
node. This panel **names its two columns** — `outdoors` and `money` — because a
blend of two unnamed numbers cannot be read at all, and the whole experiment
turns on reading it.

Nothing was changed. `content/graph.json`, the assessor prompt, the decision
schema and the model list are untouched. The panel's wording is chosen to be
*true beside* the authored text, which is visible in the inspector at the same
time on a wide screen, and the exemption is stated on screen rather than left
implicit. Whether the authored sentence should acquire a clause is the owner's
call.

## What was not verified

- **No physical phone.** Every narrow width here is an emulated viewport.
- **No screen reader.** The tab order, accessible names, focus visibility and the
  `aria-live` readout were checked in the DOM and with real Tab presses, which is
  not a VoiceOver or NVDA session.
- **`sr-only` was deliberately not used**, on the recorded grounds that an
  absolutely positioned hidden span inside one of this app's scrolling panes
  escapes the shell's clip and adds page scroll. The consequence, written down
  rather than left implicit: a screen reader hears `match 0.71 · share 10% · adds
  outdoors 0.10 · money 0.00` as one line, with the meaning of the figures
  carried by the paragraph above the list rather than by the row.
- **`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
  display copy that `ExplainBack` renders and never sends, and this work changes
  no prompt, schema or model-list file. The last four sessions recorded that
  canary failing on exactly two fixtures — 2/72 false passes for
  `hallucination/parroted`, which `AGENTS.md` records as deliberately left
  failing, and 3/24 false blocks for `neuron/technical` — and that remains the
  current state of the shared assessor. One end-to-end assessed explanation *was*
  submitted through the live path, and is reported above.

## Checks run

`pnpm test` (641 tests, 34 files), `pnpm lint` (clean), `pnpm typecheck`,
`pnpm build --webpack`, and `pnpm validate-graph` as a control — the graph is
unchanged.

**One full-suite run failed once, and is recorded rather than dropped.** It
reported 1 failed of 641 while a `pnpm build --webpack` was running in the same
shell, and the test's name was not captured. Eight subsequent runs — four of them
deliberately under concurrent build load — passed 641/641. It was not in this
branch's own tests: `attention.test.ts` is pure arithmetic with no timers, no
randomness and no I/O, and it passed on every run including that one. The most
likely candidate is `src/lib/session/token.test.ts`, the only test file in the
repo that reads a clock. Not chased further, and not claimed to be fixed.
