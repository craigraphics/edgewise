# The predictor — `prediction-from-examples`

An experiment on **Learning from examples**, built to the same rule as the neuron
and the tokenizer: change something, inspect the consequence, optionally explain
the mechanism. Reached from the concept's inspector ("Try the predictor
experiment") and from its own invitation on the focused map, and rendered in the
main workspace beside the existing explanation.

The toy problem is a restaurant estimating when a food order will arrive from
the customer's distance. A handful of editable `(distance from restaurant,
minutes until arrival)` examples go in; a rule comes out; the rule can then be
read at a distance absent from the past deliveries.

## It fits a real model

`src/lib/experiments/regression.ts` runs ordinary least squares in centred form,
locally, with no request and no key. **Nothing selects a prepared answer.** Every
number on screen is computed from the examples currently in the list: the two
parameters, each row's prediction and miss, the average and worst miss, and the
answer at a new distance.

The centred form is used rather than the textbook `(nΣxy − ΣxΣy)` because that
one loses precision badly once the inputs sit far from zero, and this panel
prints its parameters to the learner.

## Three things are kept separate, and said out loud

| | |
|---|---|
| **The examples** | Supplied by the learner. Filled dots on the drawing, editable rows above it. |
| **The parameters** | Derived from those examples. Named in words: *"Start at 12.9 minutes, then add 2.92 minutes for every km."* |
| **The new input** | A distance nobody observed. A hollow ring on a dashed drop line, then a blue distance-to-arrival readout that keeps the two changing numbers together. |

The panel's second block makes the division explicit: **we tell the model to use
a straight line; the examples determine where it starts and how many minutes it
adds per kilometre.** That is the lesson, so it sits above the controls rather
than inside the optional algebra.

## The fit is a snapshot, on purpose

Changing an observed time changes nothing until **Learn from these examples** is
pressed. Until then the panel states it: *"The examples have changed. The rule
below still comes from the old ones."* While stale the fitted line is removed
from the drawing and the prediction is withheld rather than quietly recomputed.

A rule that moved the instant you typed would hide the one step this node is
about. Staleness is compared **by value**: editing a number and putting it back
leaves the fit genuinely current, and saying otherwise would be a lie about where
the parameters came from.

## An underdetermined fit is reported, never invented

Two cases leave the slope genuinely undetermined, and both are handled:

- **Fewer than two complete examples.** One point fixes nothing; every rate
  passes through it.
- **No spread in the input.** Every example at the same distance. Every rate
  fits those observations equally well.

`fitLine` returns `status: 'undetermined'` with the reason, the panel says which,
and the prediction readout stays empty. There is no path that can produce `NaN`,
no near-zero division, and no slope filled in to make the display tidy. A
fabricated number here would teach the exact thing this node exists to correct.

## The contradiction is one tap away and is not discarded

The **Same distance, different times** preset puts one distance in twice with different
observed times. One rule returns one number for one distance, so both duplicates
get the identical prediction and at least one must miss. The callout says neither
observation is discarded: both influence the fitted line, and both misses show
on their own rows. In this preset the fitted value lands between them; the copy
does not claim that is guaranteed after the other editable examples change.
Measured: adding the contradictory observation moved the rule from `11.3 +
2.66d` away from the clean `12.9 + 2.92d` fit of the same underlying set.

## Reset is deterministic

Back to the **Past food deliveries** dataset, the query distance back to 7 km, and
**no fitted rule at all** — so the first thing anyone does is ask for one. That
is the honest opening frame for a node whose subject is where the rule comes
from.

## Nothing here touches the map

The component has no learner-model access. Editing, fitting, resetting, and
reading predictions at new distances all leave stored marks untouched, read
before and after a full session.

One real explanation was then submitted through the existing API. It marked
**only** `prediction-from-examples` Solid; stored state afterwards held exactly
that one entry, with prerequisite and dependant marks unchanged. The follow-up
question opens the existing `ExplainBack` with an **empty** field and a disabled
submit — the node's own question, *"If nobody typed the final rule, where did
this model's predictions come from?"*

## What was verified in a browser

Chrome, against the dev server, driven in a real window at exact viewport sizes.

| Check | Result |
|---|---|
| Known exact line | `10 + 4d` recovered, every miss 0, "reproduced exactly" |
| Noisy observations | `12.9 + 2.92d`, average miss 1.09 min, worst 1.9 |
| Edit one label, refit | `32.6 + 1.15d` — the rule visibly moved |
| Edit without refitting | Parameters held, line removed, prediction withheld, stale line shown |
| Duplicate inputs | Both 9 km rows predicted 35.2; misses +5.8 and −14.2 |
| Every customer 5 km away | "No rule came out of that", reason stated, no number invented |
| New distance beyond the data | 22 km → 68.3 min, from the parameters |
| Reset | Opening dataset, query 7, no rule, marks untouched |
| Navigation (Focus → Full map → List → Focus) | Dataset, rule, query and an unfinished explanation all preserved |
| Trip to another concept and back | Dataset, rule and query preserved |
| Experiment → explain → experiment → explain | Draft preserved |
| A real assessed explanation | Cleared this node only; one stored entry |
| 320, 390, 720, 1100, 1440 | No page scroll, nothing clipped, no control off-screen |
| Tap targets at 320px | All ≥ 40px |
| 720×450 and 320×568, final control | Reached by wheel and by keyboard; the guide/map pane is the single scroll owner, page scroll 0 |
| Keyboard from the title to the last control | 23 stops at 320px, each scrolled into view |
| Animations in the panel | None, so reduced motion has nothing to suppress |
| Both themes | Inspected at 1440 |
| Neuron and tokenizer after the rewiring | Both still open, run, and report correctly |

## Tests — `src/lib/experiments/regression.test.ts`

19 tests. The ones that matter are about least squares being least squares, not
about the function agreeing with itself:

- Nudging either parameter off the fitted answer **increases** the total squared
  error, checked in five directions.
- Residuals sum to zero and are orthogonal to the input — the two conditions the
  solution has to satisfy.
- Duplicate inputs get identical predictions with equal and opposite residuals.
- A contradictory example **moves** the fit rather than being dropped.
- Inputs differing only by floating-point noise count as no spread.
- No dataset in the suite yields `NaN` or `Infinity`.
- Staleness: stale on edit, current again when the value is put back, unaffected
  by an incomplete new row.

`registry.test.ts` adds four: every experiment id is a real graph node, all the
shell's copy exists, only those ids are recognised, and no prompt grades.

## Limits, stated in the panel

One input, one output, and a shape chosen in advance by us rather than found in
the data. Real systems have many inputs, shapes with millions of parameters, and
no formula that solves them outright. A fitted line says the observations line
up; it does not say distance causes the time, that the rule holds beyond the
distances observed, or that anything here understood a delivery. The starting
dataset is invented for this panel, not measured.

## Not verified

- **No physical phone.** The 320px checks were a real Chrome window at that
  width under device-metrics emulation.
- **No screen reader was run.** The accessible names, the `role="img"` summary
  and the slider's `aria-valuetext` were read out of the accessibility tree, which
  is not the same as hearing VoiceOver or NVDA say them.
- **An explanation draft does not survive switching to a different concept.**
  The inspector is keyed by concept id, so it remounts. That is existing
  behaviour for all 23 nodes and was left alone; trips within this concept —
  map views, experiment ↔ explanation, mobile This idea ↔ Your map — all preserve
  it.
- **No learner has used this.** The validation gate remains open.
