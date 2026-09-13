# Did it learn the pattern, or remember the examples?

An experiment on `generalization-overfitting`, on branch
`experiment/07-generalization`, branched from `main` after the one-step-at-a-time
experiment merged. Built to the same rule as the six before it: change
something, inspect the consequence, optionally explain it.

## The three sentences, written before any code

| | |
|---|---|
| **The question** | *Does getting every past delivery right mean it will get the next one right?* |
| **The first action** | **Try both rules on new deliveries** |
| **The result** | *The close-following rule was exactly right on every past delivery, and 6.1 minutes off on the 4 it had never seen. The straight line was 3.0 minutes off on the past deliveries and 1.9 minutes off on the new ones, which is 3.2 times closer.* |

Every number in that sentence is computed from the deliveries on screen. None is
written into the copy.

## What the learner does

Five past deliveries, and two rules worked out from them and from nothing else.
A **simple rule** — one straight line, which cannot bend, so it settles for the
line closest to all five at once and misses each by a little. A **rule that
follows them closely** — a curve free to bend as much as it needs to, which
therefore passes through every one of the five exactly.

One button reveals four deliveries neither rule has seen. Both answer for each
one, beside what it actually took, and then the same reading is laid out as a
2×2: each rule on the deliveries it was built from, and on the deliveries it was
not. The rule with nothing off on the past set is the one that is furthest off on
the new set.

The names arrive only after both numbers are on screen: training data, held-out
set, overfitting, generalising. The card then carries the half of the node that
is easy to miss — an overfitted rule is not broken and did not fail at its job.
It learned a set of chance delays very well.

**No prediction step.** The learner has been given nothing they could use to work
out how far off either rule will be on data it has not seen, and asking for a
guess at an unexplained number is what this project's own rules forbid.

## The maths — `src/lib/experiments/generalization.ts`

**The straight line is the predictor's least-squares fit, unchanged.** `fitLine`
and `predictAt` from `regression.ts`, reused rather than reimplemented. This node
is about what a fit is worth on unseen data, not about how fitting works.

**The curve is exact interpolation** by Newton divided differences: the one curve
of exactly the right flexibility to pass through all five past deliveries.
Exactness is the point — "nothing off on any past delivery" has to be a fact
about the arithmetic, or the panel is asserting the thing it exists to
demonstrate. Divided differences rather than a Vandermonde solve: exact for this
job, no matrix, and it cannot quietly return a near-singular answer.

**The held-out deliveries cannot reach a rule.** `fitLine` and `fitCurve` take a
list of deliveries and nothing else; a dataset's `fresh` rows are never in scope
inside either. That is the same structural move as `answerWith(learned, distance)`
in `phases.ts` — "the new answers cannot influence the rule" is the shape of the
function rather than a promise in a comment — and there is a test that swaps the
held-out rows for nonsense and requires both rules to be byte-identical.

### The three datasets, and why there are three

| Dataset | past: line / curve | new: line / curve | |
|---|---|---|---|
| **The usual deliveries** | 3.0 / **nothing off** | **1.9** / 6.1 | One delivery was held up by a road closure. The curve chases it, and is 3.2× further off than the line on deliveries neither has seen. |
| **A road that speeds up** | 2.9 / **nothing off** | 1.9 / **0.2** | Delivery time genuinely does not rise in a straight line. Here the closer fit is **8.7× better** on new deliveries. |
| **One clean pattern** | **0** / **0** | **0** / **0** | No chance in the past deliveries. Free to bend, the curve comes out straight, and both rules answer identically. |

The second and third exist so the panel cannot be read as teaching that a more
detailed rule always fails, or that matching every example is always bad. What
decides it is whether the thing being followed will happen again — a fact about
the world, not about the rule.

Every held-out delivery sits **inside** the range of distances the rules were
fitted over, and at a distance none of the past deliveries used. Both are
asserted. So the failure in the first dataset is genuine overfitting, not a rule
being asked about a distance far outside anything it saw.

## Verified

| | |
|---|---|
| `pnpm test` | 511 passing, 29 files. 19 tests in one new file. |
| `pnpm lint` | clean |
| `pnpm typecheck` | clean |
| `pnpm build --webpack` | passes |
| `pnpm validate-graph` | passes; `content/graph.json` is untouched |

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
- **One clean pattern** is exactly `14 + 3d`, so the curve's answers must be
  `14 + 3d` — checked both against that expression and against `fitLine`, a
  different implementation.
- Each of the three datasets is held to the case it claims, so editing the
  numbers later cannot quietly remove the contrast the panel is written about.
- Degenerate inputs — empty, one delivery, two at the same distance — return
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

Submitted through the live assessor from the panel's own button. It moved
`generalization-overfitting` **`shaky` → `known`** and left **every other key
unchanged** — both prerequisites still `known`, both dependants still `blocked`,
and the remaining five marks identical.

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
the second week of deliveries is a case where it is better; real models do not
copy rows, they have enough flexibility to bend through millions of examples and
the effect is the same; holding data back is the standard check and not a
guarantee, since held-out data can share the same quirks and a set consulted
often enough starts being fitted to as well; four held-back deliveries is far too
few to settle anything in real work.
