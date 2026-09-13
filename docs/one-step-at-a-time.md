# How can a model improve an answer a little at a time? — `gradient-descent`

An experiment on **Getting less wrong**, built to the same rule as the neuron,
the tokenizer, the predictor, the representation playground, the two-phase panel
and the how-far-off panel: change something, inspect the consequence, optionally
explain the mechanism. Reached from the concept's inspector ("Try the
one-step-at-a-time experiment") and from its own invitation on the focused map.

## The three things written before any code

| | |
|---|---|
| **The opening question** | "How can a model improve an answer a little at a time?" |
| **The first action** | "Take one step" — one button, directly under the line saying which way helps |
| **The result sentence** | "It lowered the guess. The answer got closer. 40 min was 10 minutes off. 38 min is 8 minutes off." |

## The first screen is one guess, one fact, one button

It continues the delivery from `loss`: the same 30 minutes, the next idea along.
The model guessed 40. The screen carries three things and stops.

- **The guess**, and how far off it is: `40 min · 10 minutes off`.
- **The one fact a step is allowed to act on**: *"Right now, moving the guess
  down makes it less wrong. Moving it up makes it more wrong."*
- **Take one step.**

Then the before and after sit side by side and stay there — 40 min beside 38 min,
10 minutes off beside 8 minutes off — with the sentence underneath. Nothing on
this screen says gradient, learning rate, loss, or derivative, and there is no
landscape and no rolling ball.

There is no prediction step. The learner has not been given anything they could
use to work out the size of the next move, and asking them to guess an
unexplained number would be the one thing this panel's own idea is against.

## What the learner does next

Three steps in, two things appear: a choice of step size, and an optional short
run with a Stop button.

| | what one step does | what a run of them does |
|---|---|---|
| **Small step** | covers about a fifth of the distance left | improves steadily and never passes the answer |
| **Bigger step** | covers a little more than the whole distance left | goes past the answer, and still lands closer |
| **Much bigger step** | covers three times the distance left | goes past and lands **further away**, then runs away |

Those fractions are not labels. They are a consequence of the update, and
`steps.test.ts` holds them to it: for each size and several starting guesses, the
change the panel actually makes equals `−travelOf(size) × gap`.

The labels say **how big a step is, never how it will turn out** — there is a
test asserting no label contains "past", "too far", "worse" or "best". What each
one does is reported after it has been taken.

## The arithmetic is real

`src/lib/experiments/steps.ts` runs the actual update:

```
score = (guess − actual)²
slope = 2 × (guess − actual)      how fast the score changes per minute of guess
guess ← guess − step size × slope
```

Nothing selects a prepared sequence of numbers. That is why overshooting and
running away are things the panel can *report* rather than claim, and why the
step sizes could be chosen by trying them rather than by writing the outcomes
down.

**The slope is checked against the score, not against itself.** `slopeAt` is the
analytic `2 × gap`; the test measures `(score(g+h) − score(g−h)) / 2h` and
requires the two to agree. Asserting a measure against itself is the trap the
tokenizer closed by decoding `bpe_ranks` independently, the predictor by checking
the least-squares conditions, the representation playground by brute-forcing all
65,536 pictures, and the loss panel by hand arithmetic. This one closes it with a
finite difference.

Everything else is hand arithmetic anybody can check on paper. The gap starts at
10, so the score is 100 and the slope is 20; a small step is 0.1, so the guess
moves 2 minutes and 40 becomes 38.

**Writing the expectations by hand immediately paid.** The first version of the
small-step sequence asserted `40, 38, 36.4, 34.92, 33.936`. The gap keeps four
fifths of itself, so it is `40, 38, 36.4, 35.12, 34.096` — my own slip, caught by
the test on the first run rather than by a learner reading a wrong number.

## Running away is reported, never hidden

A step that would take the guess outside a sensible delivery time is **refused,
and the value it would have reached is printed**:

> **No step was taken.** From 50.48 min, a much bigger step would have taken the
> guess to −10.96 min, which is less than no time at all. That is where steps
> this big end up: the guess never settles, it runs away. Choose a smaller step
> to carry on from here.

Clamping it into something that still looked reasonable would have hidden the
one thing a too-big step is for. Choosing a smaller size clears the refusal and
carries on from where it stopped, so it is a stop rather than a dead end.

## The names come last, and so do the limits

Only once a few steps have happened on screen and the sizes are in front of the
learner: a **step**, its **step size** — usually called the **learning rate** —
the **gradient** it follows, and **gradient descent** for doing it over and over.

Then the two things that would otherwise be wrong by omission:

- This is one number. A real model has millions, and one step nudges all of them
  at once.
- Nothing here is aiming at the best possible answer. A step only knows which way
  is better from where it stands. Where a real run stops is a place it stopped
  improving, not a proof that nothing better exists.

**The hillside is left out on purpose**, and "What this leaves out" says so:
that picture suggests a landscape somebody could look at and a lowest point to
aim for, which is the node's own recorded misconception.

The optional question is *"Why can a step in the helpful direction still leave
the guess further away, if the step is too big?"*

### Why that wording, and not the one the brief gave

The brief's sentence was "Why can moving in a helpful direction still go wrong
if the step is too big?". `registry.test.ts` rejects a prompt whose own words
contain "wrong", because a prompt must never hand the learner a verdict. The
`loss` node needed that word — its whole subject is the difference between
"wrong" and "wrong by this much" — and relaxed the rule once, by quote-stripping,
with the reasoning written down. This node does not need it, so it asks the same
question in the panel's own vocabulary instead of relaxing the rule a second
time.

## The defect this work found

**A row printed "30 → 30 min · 0 off → 0 off · past it, and closer".**

A run of bigger steps converges fast: the gap keeps a fifth of itself, so within
a dozen steps it is under 0.005 minutes. The classification tolerance is 1e-9 and
the display rounds to two places, so the panel described a step as *past it, and
closer* on a row whose own numbers said nothing had moved and nothing was off.
That is the panel contradicting itself about the one thing it exists to show —
the same shape as the `loss` panel's rule that "0 minutes off" must never appear
beside the word "Wrong".

Display precision and the words now agree. A real distance too small to print
says so — `under 0.01 minutes off`, `<0.01 off` — and the readout adds the note
that earns its place:

> The guess is now closer than this panel can print. The steps carry on, and they
> carry on getting smaller — which is the ordinary ending, rather than landing
> exactly on the answer.

It was invisible in the code and only appeared by driving the panel to its step
cap. Ninth time a defect in this project was found by measuring rather than
reading.

## The first action was 517px below the title, and that was measured

The brief asks whether a first-time learner can find the first action within ten
seconds. Measured, against the three sibling panels as a control:

| panel | first control, px below its own title |
|---|---|
| how-far-off | 334 |
| representation | 445 |
| predictor | 520 |
| **this one, as first built** | **517** |
| **this one, after** | **431** |

In house norms, and still the wrong end of them for a panel whose entire first
screen is one button. Two cuts: the two setup paragraphs became one, and the
direction line stopped being a bordered box and became a 3px band accent down its
leading edge — the map's own idiom, and vertically cheap. At 1100×700 the title
and the first action now fit on screen together, which they did not before.

| | 1440×900 | 1100×700 | 390×700 | 320×568 | 720×450 |
|---|---|---|---|---|---|
| before | 517 | 517 | 729 | 840 | 517 |
| after | **431** | **431** | **493** | **604** | **431** |

## Layout, measured

The probe from `AGENTS.md`, run **after each resize** rather than only after a
load, with the panel open and stepped.

| viewport | page scroll | clipped | controls under 40px tall | under 40px wide | off-screen |
|---|---|---|---|---|---|
| 1440×900 | 0 | 0 | 0 | 0 | 0 |
| 1230×842 | 0 | 0 | 0 | 0 | 0 |
| 1100×700 | 0 | 0 | 0 | 0 | 0 |
| 820×900 | 0 | 0 | 0 | 0 | 0 |
| 420×800 | 0 | 0 | 0 | 0 | 0 |
| 390×700 | 0 | 0 | 0 | 0 | 0 |
| 320×568 | 0 | 0 | 0 | 0 | 0 |
| 720×450 | 0 | 0 | 0 | 0 | 0 |

The under-40px controls the whole-page probe reports at every width are the
shell's own — the skip links, the wordmark, and the Focus/Full map/List switcher.
Restricted to `.steps-lab`, **nothing is under 40px in either dimension at any
width**.

1230×842 is in the table on purpose: it is what a maximised 14-inch laptop
reports, and the handover records a shipped breakpoint bug that existed because
nobody had measured it.

## Keyboard and scrolling

| viewport | tab stops in the panel | all scrolled into view | last control reached | pane scrolled |
|---|---|---|---|---|
| 1440×900 | 9 | yes | What this leaves out | 1640px |
| 720×450 | 9 | yes | What this leaves out | 2284px |
| 320×568 | 9 | yes | What this leaves out | 4096px |

Tabbing from the panel title walks Reset, Take one step, the three step sizes,
Run 6 steps, Explain what happened, and both disclosures, and each stop is
scrolled into view by the pane — which is what demonstrates the last control is
reachable rather than sitting under a fixed edge.

## Nothing here touches the map, and that was checked both ways

The component has no learner-model access. Checked against a **populated** model
— ten marks from the example fixture, including this node (`shaky`), its
prerequisite `loss` and its dependant `backprop-intuition` — rather than an empty
one, which would have proved much less.

Taking single steps, changing step size, running and stopping, hitting the
16-step cap, being refused, and resetting all left stored state
**byte-identical**, read before and after.

Then the other direction, which the `loss` experiment left open: a real
explanation was typed into the existing `ExplainBack` and submitted through the
live assessor. `gradient-descent` moved **`shaky` → `known`**, and **every other
key was unchanged** — `loss`, `prediction-from-examples`, `neuron`, `embeddings`
and the rest byte-identical. The only path that can move this mark is the one
that is supposed to.

The follow-up question opens the explanation form **empty**, with a disabled
submit.

## What is preserved, and what is not

| | |
|---|---|
| Steps taken, chosen step size, a refusal | survive Focus → Full map → List → Focus |
| The same | survive a trip to another concept and back |
| An unfinished explanation | survives experiment ↔ explanation, verified by typing and returning |
| An unfinished explanation | **lost** on a trip to a different concept — existing behaviour for all 23 nodes, left alone |
| Reset | opening guess of 40 min, small step, no history, options and names hidden again |

## Motion

There is none. `document.getAnimations()` with the panel open and stepped returns
an empty list, so there is nothing for a reduced-motion setting to suppress. The
only thing that moves on its own is the optional short run, which is opt-in, is
six steps long, and carries a Stop button for its whole duration.

## The other six experiments still work

Checked in a browser after the shared registry and shell change, since those are
touched by this work:

| | opens |
|---|---|
| Neuron | "Make one number move." |
| Tokenizer | "See the pieces the model gets." |
| Predictor | "Can past food deliveries predict the next one?" |
| Representation | "How can an H and a T become the same number?" |
| Training vs. using | "If the answer changes, did the model learn something new?" |
| How far off | "Are all wrong answers equally wrong?" |
| This one | "How can a model improve an answer a little at a time?" |

## Not verified

- **No physical phone.** The 320px and 390px checks were device-metrics
  emulation in a real browser, not a handset.
- **No screen reader was run.** The live region, the step-size buttons and the
  history list were read out of the DOM and the accessibility tree, which is not
  the same as hearing VoiceOver or NVDA say them. The readout updates once per
  step, and during the optional run that is once every 700ms; whether a screen
  reader handles that burst gracefully has not been heard.
- **Wheel scrolling was not driven natively.** Reachability is evidenced by the
  tab walk, which scrolls the same pane by up to 4096px and lands on the final
  control.
- **No learner has used this.** The validation gate remains open, and it is still
  the oldest item in this project.
