# How far off was the answer? — `loss`

An experiment on **How wrong you are**, built to the same rule as the neuron, the
tokenizer, the predictor, the representation playground and the two-phase panel:
change something, inspect the consequence, optionally explain the mechanism.
Reached from the concept's inspector ("Try the how-far-off experiment") and from
its own invitation on the focused map.

## The three things written before any code

| | |
|---|---|
| **The opening question** | "Are all wrong answers equally wrong?" |
| **The first action** | "Move this guess closer to the 30 minutes it took" — one slider, in the card of the guess it moves, with the distance from the true time beside it |
| **The result sentence** | "Still wrong, but closer. 60 minutes was 30 minutes off. 44 minutes is 14 minutes off." |

## The first screen is the argument

A delivery took 30 minutes. Two guesses, 29 and 60, each carrying two readouts:

| | Right or wrong? | How far off |
|---|---|---|
| 29 min | Wrong | 1 minute off |
| 60 min | Wrong | 30 minutes off |

The left column says the same thing about both. The right one does not. Then the
second guess moves, and **the left column keeps saying "Wrong" the whole way**
while the right one shrinks continuously — until 30, the single point where
right-or-wrong finally changes its mind.

That is the node's own explanation acted out rather than asserted: *"'Wrong'
gives you nowhere to go; 'wrong by this much' tells you which direction is
better."* Nothing on this screen names a loss, a metric or an error function.

There is no prediction step. The interesting move here is moving the guess and
watching which of the two readouts responds, so every change shows at once and
nothing is gated behind asking somebody to commit to a number they have no way
of working out.

## The second example: two ways of counting, and where they disagree

Behind **Try another example**. Four deliveries with fixed real times (20, 30,
40, 50 minutes) and editable guesses, scored two ways at once:

- **Count every minute the same** — how far off each guess was, averaged. In
  minutes.
- **Make big misses count more** — each miss multiplied by itself, then
  averaged. A score, in minutes multiplied by minutes, and **never printed as
  minutes**. The panel says so on the card.

Three ready-made sets, and the first two are the whole point:

| | Every minute the same | Big misses count more |
|---|---|---|
| A few minutes out on each (+5, −5, +5, −5) | **5 min** | **25** |
| Three exact, one badly out (0, 0, 0, −20) | **5 min** | **100** |
| Every guess exact | 0 min | 0 |

The first measure cannot choose between the first two sets. The second calls one
four times worse. Swapping sets keeps the previous one's numbers on screen, so
the before and after sit side by side, and the panel states which measure
separated them and which did not.

**The tie is asserted in `loss.test.ts`, not described here**, so editing those
numbers later cannot quietly remove the disagreement the panel claims.

## The name comes last

Only once both measures are on screen with numbers in them:

> A **loss** is a number that measures how far off the model is. Choosing how to
> count mistakes changes what it tries to improve.

Followed by the half of the node that is easier to miss — that neither measure
is more correct, that a person picks, and that whatever the chosen number does
not notice, the model has no reason to fix. That is the second recorded
misconception (*"a single number, chosen by a person, defines what the model
will optimise for — including its blind spots"*), and it is stated in the panel
rather than left to the optional question.

The optional question is the node's own: *"Why would 'wrong by this much' be
more useful than just 'wrong'?"*

## The maths is real, and checked against arithmetic rather than itself

`src/lib/experiments/loss.ts` computes genuine mean absolute error and genuine
mean squared error over whatever guesses are in the rows. Nothing selects a
prepared answer.

`loss.test.ts` — 20 tests. The expectations are **written out by hand** rather
than produced by calling the function under test with other arguments; asserting
a measure against itself is the trap the tokenizer closed by decoding
`bpe_ranks` independently, the predictor closed by checking the least-squares
conditions, and the representation playground closed by brute-forcing all 65,536
pictures. This one closes it with arithmetic anybody can check in their head.

What the tests hold:

- Exact guesses give **zero on both measures**.
- A miss of the same size **in either direction** scores identically, on both.
- Misses of +5, −5, +5, −5 give 5 and 25; the single 20-minute miss gives 5 and
  100; the ratio is exactly 4.
- A row with no guess is **left out, never guessed at** — including a guess that
  is not a finite number.
- No dataset in the suite produces `NaN` or `Infinity`.
- An empty list returns `null` rather than 0. Printing 0 for "no guesses" would
  say the guesses were perfect when none was made.
- Floating-point drift under 1e-9 is not called a wrong answer, so the panel can
  never print "0 minutes off" beside the word "Wrong".

## Three defects this work found

### 1. The ratio was rounded before being inverted

Switching back from the blunder set to the spread set printed **"3.3 times
worse"** where the honest answer is 4. `timesWorse` rounded to one decimal and
the panel then inverted: 25 ÷ 100 rounds to 0.3, and 1 ÷ 0.3 is not 4. It
returns the raw ratio now and rounding happens at the point of display. Tested
in both directions.

### 2. `--band-learning` is 4.30:1 as text, and the predictor only passes by luck

Both existing experiment readouts print their headline number in
`--band-foundations`. Generalising `globals.test.ts` to every band shows that is
the **only** band that clears AA against those cards in light mode:

| band | light, on `--surface-0` |
|---|---|
| foundations | passes |
| networks | 4.45 |
| behaviour | 4.36 |
| **learning** | **4.30** |
| language | 4.02 |

So the same treatment on this panel would have been a contrast defect, and the
reason the two existing panels are fine is that `foundations` happens to be the
darkest of the six rather than anything about the design. This panel prints its
numbers in `foreground` and keeps the band on the border;
`BANDS_USED_AS_TEXT` in `globals.test.ts` records the measurement and makes
adding a band to that list a deliberate act. The band-accent block now also
checks all three surfaces rather than only `surface-1`, because these panels draw
band-coloured borders on all of them.

This is the same shape as the map-node failure this project already paid for —
text sitting on the band colour, in a combination nothing had measured.

### 3. The grading check banned this node's subject

`registry.test.ts` rejected any prompt containing "wrong". This node exists
entirely to separate "wrong" from "wrong by this much", so a flat ban would have
forced it to ask its question in words it does not use. The rule was never about
vocabulary — it is about handing the learner a verdict. Judging words are now
checked against the prompt's **own** words with quoted text stripped first, the
verdict *phrases* ("well done", "you got", "your answer", …) are still checked
against the whole prompt, and there is a test asserting the quote-stripping
cannot be used to smuggle a verdict through in quotation marks.

## Layout, measured

The probe from `AGENTS.md`, run **after each resize** rather than only after a
load, with the panel and its second example open.

| viewport | page scroll | clipped | controls under 40px | controls under 40px wide | off-screen |
|---|---|---|---|---|---|
| 1440×900 | 0 | 0 | 0 | 0 | 0 |
| 1230×842 | 0 | 0 | 0 | 0 | 0 |
| 1100×700 | 0 | 0 | 0 | 0 | 0 |
| 820×900 | 0 | 0 | 0 | 0 | 0 |
| 420×800 | 0 | 0 | 0 | 0 | 0 |
| 390×700 | 0 | 0 | 0 | 0 | 0 |
| 320×568 | 0 | 0 | 0 | 0 | 0 |
| 720×450 | 0 | 0 | 0 | 0 | 0 |

1230×842 is in the table on purpose: it is what a maximised 14-inch laptop
actually reports, and the handover records a shipped breakpoint bug that existed
because nobody had measured it.

**The verdict pair, at 320px.** Three arrangements were measured rather than
argued about. Two columns puts "30 minutes off" on three lines in a 100px card
and stands 98px tall. Two stacked cards is taller still and pushes the slider —
the first thing there is to do — a long way below the fold. Two label-left,
value-right rows is 80px and reads in one line each, so that is what it does
below 420px.

## Keyboard and scrolling

| viewport | tab stops in the panel | all scrolled into view | last control reached | pane scrolled |
|---|---|---|---|---|
| 1440×900 | 12 | yes | What this leaves out | 1898px |
| 720×450 | 12 | yes | What this leaves out | 2514px |
| 390×700 | 12 | yes | What this leaves out | 3435px |
| 320×568 | 12 | yes | What this leaves out | 3435px |

Tabbing from the panel title walks every control to the last one, and each stop
is scrolled into view by the pane, which is what demonstrates the final control
is reachable rather than sitting under a fixed edge. Page scroll stays 0
throughout.

## Nothing here touches the map

The component has no learner-model access. Checked against a **populated** model
— ten marks loaded from the example fixture, including this node, its
prerequisite `prediction-from-examples` and its dependants — rather than an
empty one, which would have proved much less.

Moving the guess, editing every delivery, switching between all three ready-made
sets, opening both explanations and reading every readout left stored state
**byte-identical**, read before and after.

The follow-up question opens the existing `ExplainBack` with an **empty** field
and a disabled submit. Only the existing assessed path can raise this concept's
mark.

## What is preserved, and what is not

| | |
|---|---|
| Guess, deliveries, chosen set, second example open | survive Focus → Full map → List → Focus |
| The same, plus the second example | survive a trip to another concept and back |
| An unfinished explanation | survives experiment ↔ explanation |
| An unfinished explanation | **lost** on a trip to a different concept — existing behaviour for all 23 nodes, recorded in `learning-from-examples.md`, left alone |
| Reset | opening guess of 60, opening set, second example closed |

## Limits, stated in the panel

A low number means these guesses were close to **these** deliveries. It says
nothing about a delivery the model has not seen, a time of day nobody measured,
or a customer unlike these. The number also **does not say what to change** —
working out which setting to move, and in which direction, is a separate step and
is the next idea along on the map. And real systems rarely measure anything as
readable as minutes; a language model is scored on how surprised it was by the
next piece of text, which works the same way and is much harder to picture.

The deliveries are invented for this panel, not measured.

## Not verified

- **No physical phone.** The 320px checks were a real Chrome window at that width
  under device-metrics emulation.
- **No screen reader was run.** The slider's `aria-valuetext`, the field names
  and the live regions were read out of the accessibility tree, which is not the
  same as hearing VoiceOver or NVDA say them.
- **No real assessed explanation was submitted through the API**, so "clears only
  this node" rests on the component having no learner-model access and on the
  before/after storage reads above, not on an end-to-end assessment. The
  predictor and two-phase experiments each ran that check; this one did not.
- **Wheel scrolling was not driven natively.** `Input.dispatchMouseEvent` with
  `mouseWheel` hung in this environment. Reachability is evidenced by the tab
  walk instead, which scrolls the same pane by up to 3435px and lands on the
  final control.
- **No learner has used this.** The validation gate remains open.
