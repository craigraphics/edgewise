# Did it learn the pattern, or remember the examples?

An experiment on `generalization-overfitting`, on branch
`experiment/07-generalization`, branched from `main` after the one-step-at-a-time
experiment merged. Built to the same rule as the six before it: change
something, inspect the consequence, optionally explain it.

## The three sentences, written before any code

| | |
|---|---|
| **The question** | *Can a rule price every past phone perfectly—and still miss the next one?* |
| **The first action** | **Reveal 4 phone sales kept hidden** |
| **The result** | *The flexible rule was exactly right on every example it learned from, then $100 off on the 4 hidden sales. The simple rule started at $51.2 off, then was $34.5 off on the hidden sales—2.9 times closer.* |

Every number in that sentence is computed from the phone sales on screen. None is
written into the copy.

## What the learner does

Five past used-phone sales, each with one input (age) and one answer (sale
price), and two rules worked out from those examples and nothing else. A
**simple rule** is one steady trend across all five. A **flexible rule** is free
to bend through every sale, including the one phone whose cracked screen pulled
its price away from the overall age pattern.

One button reveals four sales neither rule has seen. Both estimate each price
beside what the phone actually sold for, and then the same reading is laid out
as a 2×2: each rule on the examples it learned from, and on the sales kept
hidden. The rule with nothing off on the past set is furthest off on the hidden
set.

The names arrive only after both numbers are on screen: training data, held-out
set, overfitting, generalising. The card then carries the half of the node that
is easy to miss — an overfitted rule is not broken and did not fail at its job.
It learned one cracked phone's chance price very well.

**No prediction step.** The learner has been given nothing they could use to work
out how far off either rule will be on data it has not seen, and asking for a
guess at an unexplained number is what this project's own rules forbid.

## The maths — `src/lib/experiments/generalization.ts`

**The straight line is the predictor's least-squares fit, unchanged.** `fitLine`
and `predictAt` from `regression.ts`, reused rather than reimplemented. This node
is about what a fit is worth on unseen data, not about how fitting works.

**The curve is exact interpolation** by Newton divided differences: the one curve
of exactly the right flexibility to pass through all five past sales.
Exactness is the point — "nothing off on any past sale" has to be a fact
about the arithmetic, or the panel is asserting the thing it exists to
demonstrate. Divided differences rather than a Vandermonde solve: exact for this
job, no matrix, and it cannot quietly return a near-singular answer.

**The held-out sales cannot reach a rule.** `fitLine` and `fitCurve` take a list
of past sales and nothing else; a dataset's `heldOut` rows are never in scope
inside either. That is the same structural move as `answerWith(learned, distance)`
in `phases.ts` — "the new answers cannot influence the rule" is the shape of the
function rather than a promise in a comment — and there is a test that swaps the
held-out rows for nonsense and requires both rules to be byte-identical.

### The three datasets, and why there are three

| Dataset | learned-from: line / curve | held-out: line / curve | |
|---|---|---|---|
| **One damaged phone** | $51.2 / **nothing off** | **$34.5** / $100 | A cracked screen drags one price down. The flexible rule chases that one-off detail and is 2.9× further off on sales neither rule saw. |
| **The early price drop** | $34.4 / **nothing off** | $21 / **$0.8** | Phones genuinely lose value faster while nearly new and more slowly later. Here the flexible fit is **25.8× better** on held-out sales. |
| **One clean pattern** | **$0** / **$0** | **$0** / **$0** | No chance variation in the past sales. Free to bend, the curve comes out straight, and both rules answer identically. |

The second and third exist so the panel cannot be read as teaching that a more
detailed rule always fails, or that matching every example is always bad. What
decides it is whether the thing being followed will happen again — a fact about
the world, not about the rule.

Every held-out sale sits **inside** the range of phone ages the rules were fitted
over, and at an age none of the past sales used. Both are asserted. So the
failure in the first dataset is genuine overfitting, not a rule being asked
about a phone much older or newer than anything it saw.

## Verified

| | |
|---|---|
| `pnpm test` | 511 passing, 29 files. 19 tests in one new file. |
| `pnpm lint` | clean |
| `pnpm typecheck` | clean |
| `pnpm build --webpack` | passes |
| `pnpm validate-graph` | passes; `content/graph.json` is untouched |
| `pnpm calibrate --explain --runs 3` | **fails outside this experiment:** 2/72 false passes on `hallucination/parroted`, 1/24 false blocks on `neuron/technical`; this canary has no `generalization-overfitting` fixture |

### The arithmetic, held to answers worked out by hand

Asserting a measure against the code that produced it is the trap this project
has closed four different ways — the tokenizer by decoding `bpe_ranks`
independently, the predictor by checking the least-squares conditions, the
representation playground by brute-forcing all 65,536 pictures, the loss panel by
hand arithmetic. This one closes it by a fifth route: **interpolation problems
whose answers can be worked out on paper.**

- The parabola through (0,1) (1,3) (2,9) is `2x² + 1`, so `p(3) = 19` and
  `p(0.5) = 1.5`.
- The curve through two points is the line through them: `(2,10) (6,30)` gives
  `p(4) = 20` and `p(0) = 0`.
- **One clean pattern** is exactly `820 - 10a`, where `a` is the phone's age in
  months, so the curve's answers must match — checked both against that
  expression and against `fitLine`, a
  different implementation.
- Each of the three datasets is held to the case it claims, so editing the
  numbers later cannot quietly remove the contrast the panel is written about.
- Degenerate inputs — empty, one sale, two at the same age — return
  `undetermined` with a reason. There is no path that produces `NaN`, asserted
  over all three datasets.

### In the browser

Against `pnpm dev`, in BrowserOS neo, with **ten marks loaded** — this node,
both its prerequisites, and both its dependants among them — rather than an
empty model.

| | |
|---|---|
| Page scroll, both axes, at 320×568 / 390×600 / 720×450 / 1100×700 / 1440×900 | **0** everywhere |
| Regions clipped past the viewport edge | **0** everywhere |
| Panel controls under 40px | **none**, at every width |
| Controls off the right edge | **none** |
| After a 1920 → 1300 resize | clipped 0, page scroll 0 |
| Keyboard, 320×568 and 720×450 | all 7 panel controls reached by Tab, every one scrolled into view, including the last |
| End of the guide pane | reachable; last control (`What this leaves out`) in view |
| `document.getAnimations()` with the panel open | **0** — nothing for a reduced-motion setting to suppress |
| Network requests while driving the panel | **0** new |
| Storage, before and after | byte-identical across revealing, all three datasets, both disclosures, keyboard traversal and reset |
| Reset | first dataset back, reveal hidden, picker hidden, disclosures closed, first action back |
| Trip away and back | dataset, revealed state and open picker all survive opening another idea and returning |

The 2×2 switches layout at 460px: three columns above it, and below it each rule
becomes a block with two label-left, value-right rows. Each value carries its own
column heading inline, switched with `display` rather than `sr-only`, so exactly
one label is in the accessibility tree at each width. `sr-only` was avoided
deliberately — an absolutely positioned hidden span inside one of this app's
scrolling panes escapes the shell's clip and adds page scroll, which this project
has already paid for once.

### One real assessed explanation, end to end

After the phone example replaced food delivery, a mechanism explanation in
everyday words was submitted through the panel's own button: the flexible rule
treated a cracked phone's one-off price as a pattern about age, bent its nearby
estimates, and the hidden normal-condition phones showed that detail did not
repeat. The live assessor moved `generalization-overfitting`
**`unexplored` → `known`**.

The earlier delivery version was also checked against a populated ten-mark
model and changed only this node. That byte-level all-other-keys comparison was
not repeated after the example changed; the client and server upgrade paths are
unchanged and remain unit-tested.

## The defect measuring it found

**The first action sat 982px below the panel title and off the bottom of the
window.** The sibling panels put theirs at 334 (how-far-off), 431
(one-step-at-a-time), 445 (representation) and 520 (predictor).

The cause was the chart. Its `<svg>` is `h-auto w-full`, and in the map pane at
1230×842 that is 664px wide — so a 320×200 viewBox stood **415px tall on its
own**, 42% of the whole distance. Nothing about that is visible in the code; the
component says `w-full` and the number only exists once it is on a screen of a
particular width.

Three changes: the drawing is capped at 30rem and shortened, the two rule cards
lost a line each, and **the button moved above the picture**. The drawing is
optional support and everything it shows is also printed in words, so it had no
business pushing the only action off the page. **536px now**, and the button is
in view at 1230×842.

Tenth time a defect in this project was found by measuring rather than reading.

## Not verified

- **Not tested on a physical phone.** The narrow widths were emulated through
  CDP, which gives real layout at a real viewport but is not a handset.
- **No screen-reader session.** The accessibility-tree and keyboard checks above
  are not a substitute for VoiceOver or NVDA.
- **The contrast claims rest on `globals.test.ts`**, which measures the tokens.
  Every colour this panel uses is in the tested set — `foreground` and
  `muted-foreground` on all three surfaces, and `--band-learning` only ever as a
  border or a stroke, never as text, because that band measures 4.30:1 in light
  mode. Nothing here was measured as painted.
- **The three datasets are invented for this panel**, not measured from anything.

## Limits stated on screen

Under **What this leaves out**: a more detailed rule is not worse by nature, and
the early-price-drop dataset is a case where it is better; real models do not
copy rows, they have enough flexibility to bend through millions of examples and
the effect is the same; holding data back is the standard check and not a
guarantee, since held-out data can share the same quirks and a set consulted
often enough starts being fitted to as well; four held-back sales is far too
few to settle anything in real work.
