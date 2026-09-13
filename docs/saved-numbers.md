# When a model learns, what does it actually keep? — `parameters-scale`

An experiment on **What parameters are**, built to the same rule as the ten
before it: change something, inspect the consequence, optionally explain the
mechanism. Reached from the concept's inspector ("Try the saved-numbers
experiment"), from its own invitation on the focused map, from the `Try it`
button on any neighbour's card, and at `#play/parameters-scale`.

## The three things written before any code

| | |
|---|---|
| **The opening question** | "When a model learns, what does it actually keep?" |
| **The first action** | "Change the price per hour to $4" — one button, directly under the two numbers it changes |
| **The result sentence** | "2 hours now costs $10. We changed one saved number, the price per hour. The customer still wants 2 hours." |

## The first screen separates three kinds of number

A bike rental shop works out a price from one thing: how many hours you want
the bike.

- **What the shop keeps** — *"Start at $2, then add $3 for each hour"*, with the
  two numbers named underneath as **Starting price $2** and **Price per hour
  $3**, and one sentence: *"This price rule is the model. The two saved numbers
  are its parameters. These two were given to us for this example."*
- **This customer's input** — *2 hours*, in a dashed card, marked *"Not kept by
  the shop."*
- **Price for this rental** — *$8*.

Nothing on that screen says billions, weights, layers, or training, there is no
network drawing and no wall of sliders, and the arithmetic is under a
disclosure rather than on the page.

The layout does the separating rather than a caption: the two kept numbers sit
inside one card with the band down its leading edge, the one number the customer
brings sits in a dashed card, and they are two different columns.

## The three build checks that are actually about the node

**Every price comes from the same two numbers.** `priceFor(params, hours)` takes
the rule and the hours and nothing else. There is no second path that could
produce a price, so the $8 and the $10 are the same arithmetic as every later
figure, and the test checks them against `start + perHour × hours` written out
independently.

**Nothing the customer does can change what is kept.** `fitParams(rentals)`
takes past rentals and nothing else — the customer's hours are not in scope
where the two numbers are worked out. The same structural move as `answerWith`
in `phases.ts`, and it was checked by driving the panel: with a fit on screen,
changing the hours from 2 to 5 moved only what each rule *reads off* ($10 → $22
before, $8.30 → $18.10 after) and left both rules where they were.

**More examples do not add a third number.** `parametersOf` returns the named
list and the panel counts *it* rather than printing a constant, so "the rule
still keeps 2 numbers" is derived. Two of the three rental sets differ only in
size — four rentals against ten — so the claim is visible rather than asserted,
and a test fits every count from 2 to 12 and requires the list to stay at two.

## The fit is real, and it refuses rather than inventing

Under **How were these numbers chosen?**, the same two settings are worked out
from a shop's past rentals using `fitLine` from the predictor experiment,
unchanged: this node is about what a fit leaves behind, not about how fitting
works. The before and after sit side by side, read at one held customer input.

| Set | What comes out |
|---|---|
| Four past rentals | Start at **$1.50**, then add **$3.40** for each hour |
| Ten past rentals | Start at **$2.10**, then add **$3.20** for each hour |
| Every rental two hours long | **Refused** — nothing in them shows what one extra hour costs |

The refusal is the point of the third set. Rentals that are all the same length
leave the price per hour completely undetermined, so `fitParams` returns
`status: 'undetermined'` with the reason and the panel says which, rather than
dividing by a spread of zero and printing whatever came out. There is no path
that can produce `NaN`, and a test covers it.

A saved number can also genuinely be empty. Clearing the starting price does not
snap it to zero: the price is withheld, the rule card says which number is
missing, and the live region says *"No price while the rule is missing a
starting price. Nothing has been put in its place."*

## The expectations are worked out on paper, not by the fitter

Asserting a fit against the function that produced it is the trap the tokenizer
closed by decoding `bpe_ranks` independently, the predictor by checking the
least-squares conditions, the representation playground by brute force, the loss
panel by hand arithmetic, the generalization panel by answers on paper, and the
word lists by pinning to the published file. This one closes it twice over:

- **By hand.** Four rentals at 1, 2, 3 and 4 hours costing $5, $8, $12 and $15:
  the mean rental is 2.5 hours at $10, the spread of the hours is 5, and hours
  and prices vary together by 17. So the price per hour is 17 ÷ 5 = **$3.40**
  and the starting price is 10 − 3.4 × 2.5 = **$1.50**. The ten-rental set works
  out to **$3.20** and **$2.10** the same way.
- **By the normal equations.** Whatever produced the numbers, a least-squares
  fit leaves misses that sum to zero and that do not lean with the hours.
  Neither sum repeats `fitLine`'s working.

## The names come last, and so does the scale

Once both rules are on screen with numbers in them, one card introduces the
comparison to a large model — and carries the parts that are easy to get wrong:

- A large model keeps its parameters the same way: as numbers, used in
  arithmetic when your words go through it. **No single number is a stored
  fact.**
- **They are not empty, though.** Training pushes information from the examples
  into them, and researchers have pulled pieces of training text back out of
  trained models.
- **More numbers means a model *can* fit more. It does not mean better answers
  on its own.** What it learned from, and how, matters at least as much, and a
  smaller model trained on better material often does better.

There is no bigger-model-wins race anywhere in the panel, and "What this leaves
out" adds that some large models are built so only a fraction of their saved
numbers is used on any one step.

## A disagreement with an authored simplification, recorded rather than acted on

The node's authored `explanations.example` in `content/graph.json` reads:

> Nothing else is stored. No database of facts, no copy of the training text.

The first half is the point of the node and the panel teaches it. The second
half is stronger than the evidence: training data extraction from trained
language models is a documented result, and a learner who is told recovery is
impossible has been handed a new false belief in place of an old one.

**Nothing was changed.** The graph, the assessor prompt, the decision schema and
the model list are untouched, per the brief. The panel's own wording is chosen
to be true beside the authored text rather than to contradict it — it says no
single number is a stored fact, and then says plainly that information from the
examples is pushed into the numbers and that pieces of training text have been
pulled back out. Both are visible at once on a wide screen, which is why the
wording had to be compatible rather than merely correct. **Recommendation for
the owner: soften the graph's second sentence.** That is a content decision.

## No prediction step

The learner has been given nothing they could use to work out what $2 and $3
will produce before they see it, and asking somebody to guess an unexplained
number is what `AGENTS.md` already forbids. One press, and the consequence is
beside the control that caused it.

## What is hand-chosen, and said so

The two opening numbers are labelled *"These two were given to us for this
example"* on screen, and the fitting section opens with *"Up to now, those two
numbers were simply handed to you."* The rental prices are invented for this
panel, and "What this leaves out" says so. The visible one-line limit is *"This
is a tiny teaching example, not a real trained model. What it keeps is the same
kind of thing: numbers."*

The connection to an earlier idea is one sentence, and it stands without having
played anything: *"The earlier predictor also learned a few numbers that shaped
every new answer."*

## Nothing here touches the map, checked both ways

The component has no learner-model access. Checked against a **populated**
ten-mark model — including this node (`shaky`), its prerequisite `layers-depth`
(`known`), and eight others — rather than an empty one. Changing the price per
hour, changing the hours, clearing and restoring a saved number, opening the
fitting section, switching all three rental sets, learning, being refused,
applying a fit and resetting all left storage **byte-identical**, read before
and after. Driving the whole panel also produced **zero network requests**.

The follow-up question opens the existing `ExplainBack` with an empty field and
a disabled submit, carrying `EXPERIMENT_PROMPT['parameters-scale']`. Only the
existing assessed path can raise this concept's mark.

## Verified in the browser

| | |
|---|---|
| First action below the panel title | **382px** at 1230×842, 340 at 1440, 448 at 390, **521 at 320** |
| Page scroll, both axes | 0 at 320×568, 390×700, 615×421, 720×450, 1230×842, 1440×900 |
| Clipped region after resizing 1920 → 1300 → 1100 → 900 → 640 → 320 → 1440 | 0 at every step |
| 200% zoom (615×421 CSS viewport) | no horizontal scroll, first action 422px below the title |
| Focusable controls, everything expanded, 320×568 and 720×450 | 12 each, all focusable, all scrolled into view, none under 40px, none off the right |
| Last control and the longest expanded state | reachable by scrolling the guide; the page itself never scrolls |
| Animations with the panel open | `document.getAnimations()` empty — nothing for reduced motion to suppress |
| Network requests while driving the whole panel | **0** |
| Deep links | `#play/parameters-scale` opens it; `#idea/parameters-scale` opens the text; a bare `#parameters-scale` is rewritten; `#play/layers-depth` falls back to the idea |
| Draft survival | an unfinished explanation survived a trip to List and back |
| Learner marks | byte-identical before and after a full session |

The sibling panels put their first action at 286 / 334 / 344 / 431 / 445 / 471 /
520 below their titles; 382 and 521 sit inside that range at both ends.

## Two defects found by measuring, and one by driving

**The first action was 863px below the panel title at 320px.** Measured against
the six sibling panels as a control. The fix was structural rather than a copy
trim: the action moved *into* the board grid, directly under the rule card whose
numbers it changes, with the input and the price in the second column. On a wide
screen the rule and its button hold the left column; at 320px the same order
simply stacks. Reading order and visual order are the same at both widths, which
is why this is grid placement and not `order`. **521 now**, and 382 at 1230×842.
**Twelfth time a defect in this project was found by measuring rather than
reading.**

**Restoring a cleared number said nothing at all.** Emptying a saved-number
field left no complete reading to compare against, and the snapshot was
overwritten with nothing — so typing the value back in produced no sentence: the
learner acted and the panel went quiet. The snapshot now keeps the last
*complete* reading, so a restored field is compared with what the rule was
actually doing before it was emptied. Found by driving the panel, not by reading
the code.

**"This customer's input2 hours" ran together**, and at 320px a 20px monospaced
"2 hours" wrapped mid-value in a 110px column. Both were invisible in the source
and obvious in a screenshot.

## What was not verified

- **No screen reader.** The live region, the slider's `aria-valuetext`, the
  field names and the focus move onto the fitting section's heading were checked
  through the DOM and by driving focus, which is not a VoiceOver or NVDA
  session.
- **No physical phone.** The 320px and 390px checks are an emulated viewport.
- **No end-to-end assessed explanation was submitted** for this node. The
  `ExplainBack` form was opened and checked (empty field, disabled submit,
  correct prompt, draft survives a trip away), but no answer was sent to the
  live assessor. The claim that nothing here moves a mark rests on the absence
  of learner-model access and on the byte-level before/after storage reads.
- **`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
  display copy that `ExplainBack` renders and never sends, and this work changes
  no prompt, schema or model-list file, so the canary says nothing new about it.
  The last three sessions recorded it failing on exactly two fixtures — 2/72
  false passes for `hallucination/parroted`, which `AGENTS.md` records as
  deliberately left failing, and 3/24 false blocks for `neuron/technical` — and
  that remains the current state of the shared assessor.
- **No user study.** Nobody outside this session has used the panel. The
  ten-second first-action check is the author's own reading of it.

## Checks run

`pnpm test` (614), `pnpm lint`, `pnpm typecheck`, `pnpm build --webpack`, and
`pnpm validate-graph` all pass. The graph was not edited.
