# The representation playground — `features-and-representation`

An experiment on **Everything is numbers**, built to the same rule as the
neuron, the tokenizer and the predictor: change something, inspect the
consequence, optionally explain the mechanism. Reached from the concept's
inspector ("Try the representation playground") and from its own invitation on
the focused map, and rendered in the main workspace beside the existing
explanation.

Two 4x4 black-and-white pictures, and two ways of turning them into numbers.
The node's whole claim is that a model only ever operates on the numbers it is
handed, and that whatever the encoding discards is gone — so the panel is built
around a **collision**: two pictures nobody would confuse, arriving at the model
as identical data.

## Both encodings are computed, and neither is a label on an animation

`src/lib/experiments/representation.ts` does the arithmetic over the cells
currently on screen. Nothing selects a prepared result. Every number the panel
prints — each average, each ordered list, which positions differ, and how many
other pictures share the same encoded data — comes from the two grids.

| | What it hands over |
|---|---|
| **One number** | The mean of the sixteen cell values. Black is 0, white is 1. |
| **The full ordered list** | All sixteen values, in the declared reading order. |

The opening pair is eight white cells arranged as a filled top half, against
eight white cells arranged as a checkerboard. Both average **0.5**. Switch to
the ordered list and the same two pictures differ at eight of sixteen positions.
That is the lesson in two presses, and neither number is written down anywhere.

## "Information is lost" is given as a number

Saying an encoding throws something away is easy to assert and hard to feel, so
the panel counts. `sharingPictures` reports how many of the 65,536 possible
pictures produce exactly this encoded data:

- Average 0.5 → **12,870 pictures**. From that one number, nothing downstream
  can work out which was drawn.
- Any ordered list → **exactly 1 picture**. Nothing was thrown away, and it cost
  sixteen numbers rather than one.

The extremes are the honest exception and are not hidden: all-white and
all-black are each produced by exactly one picture, so there even a single
number separates them. An encoding is not lossy everywhere by nature; this one
is lossy in the middle.

That count is checked in the tests against a **brute-force enumeration of all
65,536 pictures**, not against the formula that produced it.

## Rearranging is the second half of the argument

**Turn a quarter turn** moves every cell and adds or removes none. The average
cannot change; the ordered list does. The panel reports what actually happened
rather than asserting it:

> The same 16 cells, in new places. Average brightness is still 0.5. The ordered
> list changed at 8 of its 16 positions.

A rotationally symmetric picture — all-white, all-black — gets the other
sentence, because claiming a change that did not occur on the node about not
trusting surface claims would be the wrong lesson:

> This picture looks the same after a quarter turn, so both encodings are
> unchanged too. Try it on a pattern that is not symmetrical.

## The order is explicit, and a position points at a cell

In list mode a strip of sixteen position buttons sits under the two pictures,
showing both lists aligned position by position with `=` or `≠` on each. Choosing
a position outlines **that cell in both grids** and states it in words:

> Position 7 is row 2, column 3. Picture A has 1 (white) there; picture B has 0
> (black).

Positions exist only in that encoding, which the panel says: the single number
has none.

## Immediate feedback, and no prediction step

The neuron asks for a prediction before it runs, because there is one arithmetic
result worth committing to. Here exploration is the point — the interesting
move is flipping a cell and watching the collision appear or break — so every
change is reflected at once and nothing is gated behind a guess.

## Colour is never the only channel

Every cell prints its own value as a digit inside it, so the grid reads in
greyscale and on a screenshot. Each cell carries `Position n, row r, column c,
white|black` as its accessible name and `aria-pressed` for its value. Both
encodings are given as numerals and in words next to them.

The two cell colours are the one place in the interface that deliberately does
**not** use the theme tokens: a cell worth 1 has to read as white in both
themes, and letting dark mode swap them would make 1 the dark value and
contradict the arithmetic printed beside it. Because that exempts them from
`globals.test.ts`, `representation-contrast.test.ts` holds them to a number
instead — measured **17.33:1**, asserted in both directions, with a test that
fails if either is ever redefined under a theme.

## Keyboard, and nothing to drag

Nothing here is draggable. The grids use a roving tabindex, which is what a grid
of cells expects: **arrow keys** move, **Home** and **End** jump to the first and
last cell, **Space** or **Enter** flips one. That keeps 32 cells to 2 tab stops.
Measured: 12 tab stops through the whole panel in one-number mode, 28 in list
mode, every one scrolled into view, at both 320x568 and 720x450.

## Nothing here touches the map

The component has no learner-model access. The strongest version of the check
was run against a **populated** learner model rather than an empty one: with ten
marks loaded, including this node's prerequisite and three of its dependants,
flipping cells, choosing positions, turning a picture, switching scenarios and
switching encodings left the stored model **byte-identical**.

The follow-up question opens the existing `ExplainBack` with an **empty** field
and a **disabled** submit — the node's own probe, *"If both pictures become the
same number, what has the model lost?"* No answer is drafted for the learner,
and only the existing assessed path can raise this concept.

## What was verified in a browser

Chrome, against the dev server, driven in a real window at exact viewport sizes.

| Check | Result |
|---|---|
| Opening pair | Both 0.5; 12,870 pictures share it; differ at 8 of 16 cells |
| Switch to the ordered list | Same two pictures, lists differ at 8 of 16; 1 picture per list |
| All white | 16 of 16 white, 16 ÷ 16 = 1, exactly one picture produces it |
| All black | 0 of 16 white, 0 ÷ 16 = 0, exactly one picture produces it |
| Flip one cell | 0.4375 against 0.5 — the collision breaks, stated as such |
| The same picture twice | Both encodings agree, and the panel says why |
| Quarter turn, asymmetric | Average held at 0.5, list changed at 8 of 16 |
| Quarter turn, all white | Reported unchanged rather than claimed changed |
| Position 7 selected | Correct cell outlined in **both** grids, readout exact |
| Arrow keys, Home, End | Move focus; Space and Enter both flip a cell |
| Reset | Opening pair, one-number encoding, no position, no turn note |
| Start over | Clears marks and returns the experiment to its opening state |
| Navigation: Focus → Full map → List → Focus | Pictures, encoding and position preserved |
| Trip to another concept and back | Preserved |
| Experiment ↔ explanation | Unfinished draft preserved |
| Marks, against a populated model | Byte-identical before and after |
| 320x568, 320x450, 390x600, 720x450, 1100x600, 1440x720, 1920x900 | No page scroll, nothing clipped, no control off-screen |
| Tap targets | Every control in the panel at least 40px in both dimensions |
| Final control, wheel | Reached at every size; the map pane is the single scroll owner |
| Final control, keyboard | Reached with every stop scrolled into view; page scroll 0 |
| Reduced motion, emulated | Zero running animations in the panel |
| Both themes | Cell colours identical in both, digits inverted, 17.33:1 |

## The bug this found, and the trap worth keeping

**A `sr-only` span made the whole page scroll.** Each grid carried a visually
hidden summary. Tailwind's `sr-only` is `position: absolute`, and with no
positioned ancestor its containing block is above the shell's `overflow: hidden`
— so it is **not clipped by it**. Laid out at its static position deep inside a
scrolling pane, it extended the document's own scroll area and the page scrolled
**1602px** at 320x568, against this project's oldest layout rule.

It was invisible in the code and invisible on screen. The project's own probe
caught it only because that probe measures `scrollHeight - innerHeight`, and the
control that proved it was the predictor panel on the same shell, which measured
a clean zero.

The spans are gone: they duplicated the count already printed in the output
block, and being outside any live region they announced nothing when a cell
changed. **The rule to carry forward is that `sr-only` inside one of this app's
scrolling panes escapes the shell's clip.**

## Tests — `src/lib/experiments/representation.test.ts`

29 tests. The ones that matter hold the arithmetic to something other than
itself:

- Average brightness checked against an independent count, over **all 65,536
  pictures**.
- The count of pictures sharing an average checked against **brute-force
  bucketing** of those same 65,536, and the buckets summing to 65,536.
- A quarter turn never changes the average, over all 65,536; four turns return
  the original; it changes the ordered list **exactly when** the turned picture
  differs.
- Collision under one number happens exactly when the white counts match;
  collision under the ordered list exactly when the pictures are identical.
- Flipping one cell moves exactly one position and the average by exactly 1/16.
- Each scenario is held to being the case it claims, so editing the literals
  later cannot quietly turn "same average" into something that no longer is.
- Reading order is asserted, not assumed: index 4 is row 2 column 1.

`representation-contrast.test.ts` adds 4 over the pixel colours.
`panel.test.ts` adds 4 over the dead-control fix below.
`registry.test.ts` picks up the new id through its existing loops.

## The dead control this fixed

Not part of the experiment, and reported by the owner while reviewing it. The
focused card's **"Explore this idea"** did nothing. It selects the idea and
brings the guide into view, and the card always draws the *selected* idea — so
after the first press of a session both were no-ops and the control sat there
inert. It arrived with `b18a5c4` and was already on `main`.

`src/lib/map/panel.ts` now answers whether the panel is already showing that
idea, and the card offers the way in only when there is somewhere to go. Below
the panel breakpoint the offer stays, because there the press still switches
surfaces — which is the route back to an idea's text from inside an experiment.
Verified in both layouts.

## Limits, stated in the panel

Sixteen cells and two brightness levels. Average brightness is a deliberately
crude encoding, chosen because the collision is easy to see in one number. Real
image models are not handed an average; they usually start from per-pixel values,
typically across three colour channels, and derive features from those. Language
models do not use pixel grids at all. **The panel does not claim this is how any
particular model encodes its input** — what carries over is the shape of the
problem. Nothing here recognises or classifies anything; there is no model in it.

## Not verified

- **No physical phone.** The 320px checks were a real Chrome window at that
  width under device-metrics emulation.
- **No screen reader was run.** The cell names, the group descriptions and the
  position strip's labels were read out of the accessibility tree, which is not
  the same as hearing VoiceOver or NVDA say them.
- **No live assessed explanation was submitted.** The form was verified to open
  empty with a disabled submit and to preserve a draft across round trips, and
  the assessed path itself is unchanged by this work, but no request was sent.
- **No learner has used this.** The validation gate remains open.
