# Learning a rule, or using one — `training-vs-inference`

An experiment on **Training vs. using**, built to the same rule as the neuron,
the tokenizer, the predictor and the representation playground: change
something, inspect the consequence, optionally explain the mechanism. Reached
from the concept's inspector ("Try the training-and-using experiment") and from
its own invitation on the focused map, and rendered in the main workspace beside
the existing explanation.

The setting is the predictor's, deliberately: the same restaurant, the same four
past deliveries, the same straight-line rule. Nobody has a new story to learn,
so the only new thing on screen is the distinction this node is about.

## The three sentences it was designed around

| | |
|---|---|
| **The question** | *"If the answer changes, did the model learn something new?"* |
| **The first action** | *"Change how far away the new customer is."* One slider, one number field, and the arrival estimate beside them. |
| **The result** | *"New distance. New answer. Same rule."* |

## The rule is stored, and every answer is read out of it

`src/lib/experiments/phases.ts` holds a learned rule and reads answers out of it.
`answerWith(learned, distance)` takes the rule and a distance and **cannot see
the delivery rows at all**, so using the rule structurally cannot change it —
that is not a promise in a comment, it is the shape of the function.

The fitting is the predictor's, unchanged: `fitLine` in `regression.ts`, ordinary
least squares in centred form, in the browser, with no request and no key. This
node is about *when* that step runs, not how it works, so nothing about it was
rewritten.

## The rule is in words, never two bare numbers

*"Start at 12.9 minutes, then add 2.92 minutes for every km."* Both numbers come
out of the fit. `describeRule` also picks "subtract" when the fitted rate is
negative, so an edited dataset cannot leave the sentence lying about direction.

## What the learner does, in order

1. **Change the distance a few times.** The estimate moves; the rule card above
   does not. After the second answer the panel says so, and counts: *"That makes
   4 answers read out of the one rule above since it last learned anything."*
2. **"Teach it with another delivery."** A button, not an open panel — the first
   screen carries one thing to do. It reveals the four past deliveries with
   editable times, plus one empty row for a delivery it has never seen.
3. **Edit a time, then "Learn again".** Old rule and new rule appear side by
   side, each with its answer **at one distance held fixed**, so the cause cannot
   be the question: *"Same customer, same 7 km, and the answer is 4.6 min later.
   The question did not change. What the model learned from did, so the rule did
   too."*
4. **Optionally**: *"Which change gave the model something new to learn from?"*
   Asked only after both kinds of change are on screen, so it is a reading of
   the evidence rather than a guess. Neither answer is called wrong; choosing the
   distance gets an explanation of what that change did and did not do.

## The names come last

"Learning a rule" and "using the rule" carry the whole first half. **Training**
and **inference** are introduced only once the difference between them is on
screen, in a card that also makes the node's own point: a chatbot that seems to
remember what you said a minute ago is doing the second one, because your
earlier words are sent in again as part of the question.

That card ends with the honest limit, which the brief for this work asked for
explicitly: *"This is the common setup, not a law."* Models are retrained on new
data, and some are handed documents at the moment you ask. What does not happen
is a deployed model rewriting itself from your conversation as it goes.

## Editing is not learning, and the panel refuses rather than guesses

`learnability(rows, current)` answers whether learning would do anything, and
**Learn again** is disabled with the reason in words when it would not:

| Case | What it says |
|---|---|
| Rows unchanged | "These are the same deliveries it already learned from, so there is nothing new in them." |
| Fewer than two complete rows | "It needs at least two deliveries with both numbers filled in." |
| Every remaining row at one distance | "…these cannot show what an extra kilometre does." |

Refusing before the attempt is why a rule already in hand can never be destroyed
by an emptied field. There is no state in which the panel holds an undetermined
"rule", and `Learned.fit` is a `FittedModel` rather than a `FitResult` because of
it — the type carries the guarantee.

## The distance is held during the comparison

While the before/after card is open the slider and the number field are disabled,
with the reason stated beside them and an explicit **"Change the distance
again"** in the tab order as the way out. Two answers at two different distances
would not be a comparison of two rules.

## Two rules can agree at one distance

They cross. At the crossing point the honest report is that the answer did not
move even though the rule plainly did, and `compare` returns `direction: 'same'`
there rather than printing a difference of zero as a change. A gap below 0.05
minutes counts as the same answer, because that is under the 0.1 the panel
prints and a change nobody can see is not a change.

## Nothing here touches the map

The component has no learner-model access. Reading answers, editing deliveries,
learning again, choosing an answer to the optional question, and resetting all
leave stored marks untouched — read from `localStorage` before and after a full
session, which stayed at zero keys throughout.

One real explanation was then submitted through the existing API. It marked
**only** `training-vs-inference` Solid; stored state afterwards held exactly that
one entry, with the prerequisite and all three dependants unchanged. The
follow-up question opens the existing `ExplainBack` with an **empty** field and a
disabled submit.

## Reset is deterministic

The opening rule relearned from the four opening deliveries, the distance back to
7 km, the teaching section closed, the names card and the optional question gone.

## A shipped contrast defect, found by a test written for this panel

The readout prints its headline number in the band colour, and that combination
had never been measured — `globals.test.ts` covered `foreground` and
`muted-foreground` on the plain surfaces only. Both readouts painted the card as
a **10% tint of their own band**, and band-on-that-tint measures:

| | Light | Dark |
|---|---|---|
| Band on the 10% tint | **4.18** | 6.45 |
| Band on the plain surface | 4.75 | 7.29 |

4.18 is under AA, and no tint that still reads as a tint reaches 4.5 — the same
shape as the map-node failure this project already paid for, where text sat on
the band colour. The card is a plain surface now and the band stays as its
border, in **both** panels: the predictor had the defect first and shipped with
it. Three assertions per theme now hold that, including that the card still
separates from the readout behind it.

## The number field was 22px wide at 320px

Measured. With the field free to shrink, the row's label took the width and left
a 22px input — the seventh defect in this project found by measuring rather than
reading, against a rule the design record already states. `.phases-field` gives
it a basis with a floor, so it wraps onto its own line instead of collapsing.

## Tests — `src/lib/experiments/phases.test.ts`

14 tests. The ones that matter are about the two phases, not about the functions
agreeing with themselves:

- Reading forty answers out of a rule leaves it **byte-identical**, and the
  answers are not all the same.
- Every answer equals the **stored** parameters at that distance, and is
  demonstrably *not* the answer a refit of the edited rows would give.
- The opening rule matches an independent `fitLine` over the same deliveries.
- Editing then reverting and relearning returns the identical parameters.
- A half-typed new delivery counts for nothing; completing it moves the rule.
- Stripping the rows reports `too-few`, identical distances report `no-spread`,
  and in both cases the rule already in hand still answers.
- The crossing case reports `same` while `rateMoved` stays true.
- Direction is symmetric: comparing the rules the other way round gives the same
  gap and the opposite direction.

`registry.test.ts` covers the fifth entry for free: the id is a real graph node,
every string the shell looks up exists, and the prompt asks for a mechanism
without grading.

## Verified in a browser

Chrome, against the dev server, at exact viewport sizes under device-metrics
emulation.

| Check | Result |
|---|---|
| Opening frame | Rule learned from the four deliveries, 33.3 min at 7 km |
| Thirteen distance changes | Rule held at `12.9 + 2.92d`, every answer from it |
| 12 km | 47.9 min, and the slider's `aria-valuetext` says so |
| Edit a time to 75, before pressing Learn again | Rule and answer unchanged, row says "You changed this from 53 min" |
| Learn again | `5.1 + 4.69d`, comparison 33.3 → 37.9 at a held 7 km |
| Empty three times | Refused with the reason, rule survives |
| Put every value back | Refused as unchanged |
| "Change the distance again" | Comparison closed, both controls enabled |
| Optional question, either answer | Explanation, no verdict |
| Focus → Full map → List → Focus | Rule, deliveries, distance and teaching section preserved |
| Trip to the prerequisite concept and back | Same |
| Experiment → explain → experiment → explain | Draft preserved |
| A real assessed explanation | Cleared this node only; one stored entry |
| Reset | Opening frame exactly, marks untouched |
| 320×568, 390×600, 720×450, 1100×600, 1440×720 | Page scroll 0, nothing clipped, no control off-screen |
| Tap targets with everything expanded | All ≥ 40px in both dimensions |
| Keyboard from the title | 14 stops through the panel, every one in view |
| Last control at 320×568 | Reached; all 16 controls scroll into view |
| Real wheel scroll | Moves the map pane, page scroll stays 0 |
| Animations in this panel | None, so reduced motion has nothing to suppress |
| Both themes | Inspected at 1230 wide |
| The other four experiments | Neuron, tokenizer, predictor and representation all still open and run |

## Deliberate omissions

- **No chart.** The predictor already owns the geometry of a fitted line, and a
  two-line chart here would invite comparing slopes, which is the previous node's
  lesson rather than this one's. The comparison is four numbers and two
  sentences.
- **No prediction step.** The neuron asks for a guess because it has one
  arithmetic result worth committing to. Here the interesting move is watching
  the answer change while the rule does not, so nothing is gated behind a guess.
- **Past delivery distances are fixed.** Only the times are editable, so "you
  changed one delivery's time" is exactly what happened, and the spread that
  determines a rate can never vanish from the four opening rows.

## Not verified

- **No physical phone.** The narrow checks were a real Chrome window under
  device-metrics emulation.
- **No screen reader was run.** The accessible names and the slider's
  `aria-valuetext` were read out of the accessibility tree, which is not the same
  as hearing VoiceOver or NVDA say them. The disabled controls during a
  comparison mean their `aria-describedby` note may not be announced; the note is
  visible beside them and the way out is in the tab order.
- **An explanation draft does not survive switching to a different concept.**
  The inspector is keyed by concept id, so it remounts. Existing behaviour for
  all 23 nodes, left alone.
- **No learner has used this.** The validation gate remains open.
