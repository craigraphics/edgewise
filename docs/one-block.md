# How do a few simple steps work together on a sentence? — `transformer`

An experiment on **The transformer**, built to the same rule as the twelve
before it: change something, inspect the consequence, optionally explain the
mechanism. Reached from the concept's inspector ("Try the one-block
experiment"), from its own invitation on the focused map, from the `Try it`
button on any neighbour's card, and at `#play/transformer`.

## The three things written before any code

| | |
|---|---|
| **The opening question** | "How do a few simple steps work together on a sentence?" |
| **The first action** | "Run one block" — one button, beside the two stages it runs |
| **The result sentence** | "The last word is **cat**. Sharing clues from the four words before it changed its numbers, by **1.35** — that is how far the description moved with all three numbers taken together. The calculation after that changed them again, by **3.14**." |

## The first screen

A five-word note about pets, `The dog followed the cat.`, with the last word
marked by a tint, an underline and a caption naming it. One line saying what a
transformer is — *"A transformer is one pair of steps, repeated. Here is a
single turn of it, on the last word of this note."* Two numbered stages, `Share
clues from earlier words` and `Work on each word's new description`. And **Run
one block**, beside them.

Nothing on that screen says attention, self-attention, residual, normalisation,
feed-forward, encoder, decoder, head, layer or token. There is no architecture
diagram and there are no arrows between words. The node's recorded
misconceptions are that a transformer is a new kind of maths rather than a
particular arrangement of pieces already understood, and that its decisive
advantage was raw quality rather than parallel training. A poster of labelled
boxes teaches neither, and an arrow between two words reads as one word
choosing another — which is the `attention` node's misconception, inherited
here.

**No prediction step.** The learner has been given nothing they could use to
work out what three numbers will come out, and asking somebody to guess an
unexplained value is what `AGENTS.md` already forbids. One press, and the answer
is there.

## The payoff had to be readable without naming a dimension

The first build of this panel was mechanically clear and thin. You pressed the
button, three rows of unnamed numbers appeared, and a sentence said they had
changed and then changed again. True, and nothing a learner could hold on to.

Two fixes, neither of which invents a meaning for a number nobody named.

**How far the description moved.** `distanceMoved` is the straight-line
distance between where a description was and where it ended up — a real
quantity with a plain meaning, printed with that meaning in the same sentence.
It gives the two stages something to be compared by: **1.35** for sharing clues,
**3.14** for the calculation after it.

**One word, two descriptions.** The note uses *the* twice. Both start from the
same three numbers in the table of words, and after the block they are
`0.20 · 0.35 · -0.51` and `-0.46 · -0.98 · 0.75`. That is the strongest single
fact available here and it was buried three sections down; it now sits directly
under the readout with both of its reasons named — the place row goes in before
anything else, so word 4 starts at `-0.20 · 0.20 · 0.20` where word 1 starts at
`0.60 · 0.20 · 0.20`, and then word 4 has three words behind it to share clues
from while word 1 has none but itself. The repeated word is **found from the
sentence**, so the card disappears rather than lying if the note ever changes to
one without a repeat.

## The connection to the earlier idea

Below the readout, where it cannot push the first action down:

> Attention combines clues from other words. A transformer repeats that step,
> with another small calculation in between.

It stands on its own. Nobody has to have opened the `attention` experiment for
it to make sense.

## What the arithmetic actually is

A real single-head causal decoder block in the modern arrangement, run twice.

```
row_i    = word_i + place_i                       places added ONCE, before block 1

stage 1  ready    = normalise(row)                 per position
         match_j  = (ready_i · ready_j) / √3       for j ≤ i only
         shares   = softmax(match)                 max-subtracted
         gathered = Σ shares_j × ready_j
         mid_i    = row_i + gathered                the original, added back

stage 2  ready    = normalise(mid_i)
         hidden   = max(0, W1 · ready + b1)         four values
         worked   = W2 · hidden + b2
         out_i    = mid_i + worked                  added back again
```

Every number is chosen by hand, from round values, and chosen so each stage
visibly moves the result. Nothing was learned from any text.

| word | its three numbers | | place | its three numbers |
|---|---|---|---|---|
| the | 0.20 · 0.20 · 0.20 | | 1 | 0.40 · 0.00 · 0.00 |
| dog | 1.00 · 0.00 · 0.20 | | 2 | 0.00 · 0.40 · 0.00 |
| cat | 0.00 · 1.00 · 0.20 | | 3 | 0.00 · 0.00 · 0.40 |
| followed | 0.20 · 0.20 · 1.00 | | 4 | -0.40 · 0.00 · 0.00 |
| | | | 5 | 0.00 · -0.40 · 0.00 |

The last word of `The dog followed the cat.`, through both blocks:

| | |
|---|---|
| before the block | 0.00 · 0.60 · 0.20 |
| after step 1 | -1.02 · 1.47 · 0.35 |
| after step 2 | 0.81 · -0.92 · -0.54 |
| block 2 is given | 0.81 · -0.92 · -0.54 |
| after block 2, step 1 | 1.68 · -1.37 · -0.96 |
| after block 2, step 2 | 0.17 · -2.85 · -1.68 |

Swapped to `The cat followed the dog.`, the last word ends at
`0.38 · -0.45 · -0.04` instead.

## The order has to be supplied, and that is proved rather than asserted

The node's own `simplificationCost` says its authored telling leaves this out:

> Position handling is left out here. Attention alone treats a sentence as an
> unordered bag, so transformers add a separate mechanism to encode word order.

So it is what this experiment puts back. Sharing clues adds contributions up,
and a total does not depend on the order the terms arrive in. `transformer.test.ts`
takes the note, removes the place rows, shuffles the earlier words, and requires
the last word's result to come out **byte-identical** — then puts the place rows
back and requires it to differ. That is the claim, measured. Nothing in the copy
has to be believed.

## Causality is the shape of the function

`attendAt(rescaled, index)` slices to `index` and stops. A later position is not
scored, not weighted and not blended — it is not in scope at all. The same
structural move as `updateAt` in `attention.ts`, `answerWith` in `phases.ts` and
`learnFilter` in `junk-filter.ts`. The test swaps every word after a position for
different words and requires that position's gather, its stage-1 row and its
stage-2 row to be identical, then changes an *earlier* word and requires it to
move.

`feedForward(row, calculation)` takes **one** row, so "every position gets its own
turn through the same calculation" is the signature rather than a claim. The
test runs one row inside a block with wildly different neighbours and gets the
same answer as running it alone.

## The expectations are worked out by hand, not by the function under test

Asserting a measure against itself is the trap this project has closed seven
times: by decoding `bpe_ranks` independently, by checking the least-squares
conditions, by brute force over all 65,536 pictures, by hand arithmetic, by
answers worked out on paper, by pinning to a published file, and by literal
`Math.exp` calls. This one closes it an eighth way.

- **A second implementation lives in the test file** and imports nothing from the
  module but the constants. Its own loops, its own `Math.exp`, its own
  `Math.sqrt(3)`. It reproduces both stages at every position of both orders,
  and the second block on the first block's output.
- **Anchors small enough to check in your head.** The first word may use only
  itself, so it gets exactly one share worth 1 and its blend *is* its own
  rescaled row. `dog` starts at `[1.0, 0.0, 0.2] + [0.0, 0.4, 0.0]`. The spread
  of `[1,2,3]` about its mean is 2/3, so its top number rescales to
  `1 / √(2/3 + 0.00001)`. A 3-4-5 triangle for the distance.
- **The shares are recomputed in the test** from literal `Math.exp` calls over
  overlaps written out by hand.

Other build checks in the same file: shares are a real distribution at every
position of both orders; no leader takes more than 60% of a blend, because a
single winner reads as the model picking one word; the calculation bends, so a
stack of them cannot collapse into one (the `layers-depth` misconception);
hidden values are never negative; block 2's input **is** block 1's output and is
not the sentence; the places are not added a second time; the two blocks carry
different numbers; the two orders end somewhere different, so the swap can never
become a no-op; both stages of both blocks move the last word by an amount worth
printing; nothing anywhere comes out `NaN` or `Infinity`; and the whole thing is
pure — two runs agree and the input is left alone.

**39 tests**, no browser.

## Two rules the panel holds itself to

**No sentence claims a change over two identical printed rows.** `movement`
judges on the unrounded numbers and reports `same`, `tiny` or `moved`; a real
change too small to print says "by less than 0.01" instead of being called
nothing. The same rule the one-step-at-a-time panel follows when a distance is
under a hundredth of a minute.

**Nothing that is said is written down.** How far each stage moved, which word
appears twice, where each of its copies starts, how many words each has behind
it, whether the block did anything at all — every one is derived from the run on
screen. Editing the vocabulary can make those sentences say something else; it
cannot make them disagree with the numbers printed beside them.

## Nothing here touches the map, checked both ways

The component has no learner-model access. Driving the whole panel against a
**populated** ten-mark model — run, swap, swap back, twelve rapid swaps, all
three sections opened, reset — left `edgewise.learner.v1` **byte-identical**,
read before and after.

Then one real explanation was submitted through the live assessor. It moved
`transformer` **`unexplored` → `known`** and left every other key unchanged,
including both prerequisites (`attention` stayed unexplored, `layers-depth`
stayed known) and the dependant `next-token-prediction`.

## Verified in the browser

| Check | Result |
|---|---|
| Page scroll (V and H), 1440×900 / 1230×842 / 1100×700 / 720×450 / 390×800 / 320×568, all sections open | **0 everywhere** |
| `clippedRight`, same widths | **0 everywhere** |
| After a 1920 → 1300 resize, no reload | 0 scroll, 0 clipped, nothing off-screen |
| Controls under 40px inside the panel | **none, at any width** |
| Controls off the right edge | none, at any width |
| First action below the panel title, 1230×842 | **285px** (siblings: 190 / 260 / 306 / 334 / 344 / 431 / 445 / 471 / 520 / 521) |
| First action at 720×450 / 390 / 320 / 200% zoom | 284 / 418 / 459 / 264 |
| First action visible without scrolling | yes at 1440×900, 1230×842, 1100×700, 390×800, 200% zoom |
| 200% zoom (615×421 at dsf 2) | 0 page scroll, 0 clipped, nothing under 40px, last control reachable |
| Scroll owners around the panel | `.focus-map` and `#guide`, the shell's own two; no nested pane added |
| Last control after expanding everything | reachable at every width, 320×568 and 720×450 included |
| Tab stops in the panel at 320 with everything open | 8 — six controls plus the two tables that overflow, every one named with a visible outline |
| `document.getAnimations()` with the panel open and expanded | **0** |
| Network requests while driving the whole panel | **0** (`fetch`, `XMLHttpRequest` and new resource entries all zero) |
| Settings survive `#idea/attention` → `#play/transformer` | swapped order and the open section both kept |
| Unfinished explanation survives experiment ↔ explanation | 378 characters kept |
| Reset | first order back, readout gone, every section closed, Reset itself withdrawn, storage untouched |
| Rapid repeated actions | twelve swaps in a row, no error, ends where the count says |

### Contrast, on painted pixels

Measured through a canvas, compositing each colour over the real stack of
backgrounds behind it. A first probe read the numbers out of a computed
`oklch()` string as if they were `r, g, b` and reported everything between 1.1
and 1.5 in both themes; the identical figures across themes were the tell. This
project's oldest lesson, met again: a measurement aimed at the wrong quantity
costs more than no measurement.

| | light | dark |
|---|---|---|
| Step card text | 17.02 | 17.78 |
| Readout body text | 17.02 | 17.78 |
| Table body | 17.02 | 17.78 |
| Summary text | 17.02 | 17.78 |
| Value in a before/after card | 17.64 | 16.90 |
| Compare row text | 17.64 | 16.90 |
| Marked word, on its band tint | 15.11 | 15.81 |
| Card label / caption / "done" / table header (muted) | 5.55 – 5.75 | 7.89 – 8.30 |
| Note card band edge (graphic) | 4.18 | 9.50 |
| Step number ring (graphic) | 4.03 | 9.99 |
| Current-row border on the comparison (graphic) | 4.03 | 9.99 |
| Marked word's underline (graphic) | 3.58 | 8.89 |

Worst text 5.55, above AA. Worst graphic 3.58, above the 3:1 floor.
**`--band-language` is never used as text here** — it measures 4.02:1 against
these cards, which `BANDS_USED_AS_TEXT` in `globals.test.ts` already records. It
carries the note card's leading edge, the step-number rings, the marked word's
underline and tint, and the current row's border, all graphics.

## What is hand-chosen, and said so

The panel's last section is *"How it works, and what it leaves out"*, and it
carries six things:

- This is the arrangement, not a language model. The numbers are hand-picked so
  the arithmetic is small enough to follow and each step visibly moves the
  result. It understands nothing and produces no words. **A real stack ends with
  a step that turns the numbers into a guess at the next word; there is none
  here.**
- The order is supplied, and that is the whole of the order handling.
- Nothing may use what comes after it.
- Rescaling and adding back, and what each is for.
- Three shortcuts: query, key and value are left as the identity (the same
  simplification `attention.ts` makes, for the same reason); one head instead of
  several; three numbers per word instead of hundreds; no dropout.
- **Parallel means reading, not writing.** A whole known text can be worked on at
  every position at once while training. Writing new text still goes one word at
  a time.

The "Try another step" section adds the one about depth: block 2 has its own
numbers, the way a real model learns a fresh set per block, but nobody gave it a
different **job** — no block here is in charge of grammar, or meaning, or
reasoning — and adding more blocks does not on its own make the answers better.

## Three defects found by measuring or driving, not by reading

**The result sentence said the same thing twice.** "Sharing clues … changed its
numbers. The calculation after that changed its numbers." True, and it reads as
a stutter; it also printed the count of earlier words as a digit mid-sentence.
The second clause says "changed them again" now, and both are still read off the
unrounded numbers.

**Reset was offered on a screen with nothing to reset.** At 390px it wrapped
onto its own row directly above the panel's actual first action. Measured: the
first action was **474px** below the panel title at 390 and **341** at
1230×842, and withdrawing the control until something has happened took it to
391 and 259. The same call the saved-messages panel already records. The motive
line added later put it at 418 and 285.

**"done" had no space in front of it.** The marker under each completed stage is
`display: block`, so it looked right and read as "…earlier wordsdone" to
anything taking the text rather than the picture.

Thirteenth, fourteenth and fifteenth time a defect in this project was found by
measuring or by driving rather than by reading.

## A pre-existing condition, not caused here

At **720×450** the focused-map pane is 20px tall, and at **320×568** it is about
250px. Everything above it — the app header, the map heading, the view switcher
and the hint line — takes the rest. Measured as a control against the
`attention` and `embeddings` panels at the same viewports: the pane is 20px for
all three at 720×450 and 224–252px for all three at 320×568, and the first
action is below the fold for all three at both. The panel scrolls and every
control is reachable, but the shell gives a short window almost nothing to show
it in. That is the shell's layout, it predates this branch, and it is recorded
rather than worked around.

## What was not verified

- **No physical phone.** Every narrow-width figure is Chrome with a device-metrics
  override, which is not a handset.
- **No screen reader.** The accessibility tree, the tab order, the focus outlines
  and the live region were read through the browser; that is not a VoiceOver or
  NVDA session.
- **`sr-only` is deliberately not used**, on the recorded grounds that an
  absolutely positioned hidden span inside one of this app's scrolling panes
  escapes the shell's clip and adds page scroll. The consequence: the step
  numbers are `aria-hidden` and the ordered list carries the order instead, and
  the before/after cards read as "cat, before the block / 0.00 · 0.60 · 0.20"
  rather than announcing a unit. Every number is visible text.
- **The two widest tables scroll sideways at 320px**, by 37px and 28px. Chrome
  makes them keyboard-focusable because they overflow, and both were reached by
  Tab with a visible outline — but each is taller than a 568px window, so
  focusing one shows its top rather than the whole table.
- **`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
  display copy that `ExplainBack` renders and never sends, and this work changes
  no prompt, no schema and no model-list file. The last four sessions recorded
  that canary failing on exactly two fixtures — 2/72 false passes for
  `hallucination/parroted`, which `AGENTS.md` records as deliberately left
  failing, and 3/24 false blocks for `neuron/technical` — and that remains the
  current state of the shared assessor. One end-to-end assessed explanation was
  submitted through the live path instead, and is reported above.

## Checks run

`pnpm test` (680 tests, 35 files), `pnpm lint` (clean), `pnpm typecheck`,
`pnpm build --webpack`, and `pnpm validate-graph` as a control — the graph is
untouched by this work.
