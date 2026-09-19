# Saved messages — the `train-test-split` experiment

On `experiment/10-train-test-split`, branched from `main` after the
word-neighbours experiment merged. An experiment on `train-test-split`, built to
the same rule as the nine before it: change something, inspect the consequence,
optionally explain it.

**The question:** can we trust a result we helped choose?

**The first action:** *Start with step 1 · teach it with 6 messages*. It is the
only button on the pristine screen and sits 190px below the panel title at
1230x842, or 344px at 320x568.

**An example of the result sentence:** *"It caught both junk messages, but also
hid a message you wanted."* It is built from the counts of the rows on screen,
so both halves of it are only ever printed when both halves happened.

---

## What it is

A junk-mail filter, and fourteen invented messages in three groups:

| Group | What it is for | Answers |
|---|---|---|
| Examples to learn from | the word scores are built from these, and from nothing else | shown |
| Examples to help choose | read to pick how cautious the filter should be | shown |
| Final check | opened last, once both of the above are finished | **hidden until asked for** |

The groups arrive ready to use. Nobody sorts a pile of cards before anything
happens.

The flow makes that order unavoidable. After learning, the six labelled
messages collapse into a disclosure and the middle group presents two outcome
cards. There is no preselected setting and no control that opens the saved
messages until the learner makes an explicit choice. Once opened, the main
result appears before the four row-level results; the evidence stays one tap
away without burying the point.

## The filter really learns

`src/lib/experiments/junk-filter.ts`. Every word in the example messages gets a
score from how many junk examples contained it against how many wanted ones
did, as a log ratio with one added to each count. A message's junk score is
exactly the total of its known words' scores, and a word the examples never
contained counts nothing. A message is called junk when its score clears a bar,
and that bar is the one thing the middle group is spent on.

No button carries a prepared answer. Every score, call, count and sentence on
screen is computed in the browser from the messages that are visible — measured:
driving the whole panel produced **zero network requests**.

## The structural guarantees

The same move as `answerWith` in `phases.ts` and `fitBoth` in
`generalization.ts`: a group that must not influence something is not in scope
where that thing is made.

- **`learnFilter(examples)` takes one list.** The choosing group and the final
  group cannot reach it. A test replaces both of them with nonsense and requires
  the learned filter to come out byte-identical.
- **`runOn(filter, messages, bar)` takes a finished filter.** There is no path
  from reading a group back into the word scores, so reading any group — the
  final one included — cannot be a further round of learning.
- **The final group's answers are not rendered until asked for**, and the
  panel's own copy says what has and has not been used at each stage.

## Refusing beats guessing

With no junk examples, or no wanted ones, every word would lean the only way
there is and the filter would call everything junk, or nothing, while looking
like it had learned something. `learnFilter` returns `not-enough` with the
reason instead, and the panel says which in words. Reachable from the UI:
switch all three wanted examples off under **Change what it learns from** and
press Learn.

There is no state in which the panel holds a filter built from one kind of
example.

## The "already seen" note

Once a mailbox's final answers have been on screen, any later change to the
filter — the caution setting, or which examples it learns from — leaves a note
that does not go away:

> We have seen these answers now. This is no longer a fresh check.

It is shown in two places: beside the control that caused it, and inside the
final-check result.

**Reset does not un-see an answer.** It starts the same exercise again — same
mailbox, same setting, final answers re-hidden — and then says so:

> You have opened a final check already in this visit. Resetting clears the
> screen, not what you remember, so treat a second reading as less independent
> than the first.

That line is driven by a flag this panel's own Reset deliberately does not
clear. Telling somebody the screen is fresh when they remember the answers would
be the panel making exactly the mistake it exists to warn about.

Each mailbox keeps its own saved messages, so switching to one whose check has
not been opened is a genuinely fresh check, and switching back to one that has
does not make it fresh again.

## Two mailboxes, and they disagree about the answer

Each is held to the case it claims in `junk-filter.test.ts` rather than
described in the copy, so editing the wording later cannot quietly remove the
trade-off the panel says is there.

**A small mailbox.** While choosing, the two settings genuinely part company:

| Setting | On the choosing group |
|---|---|
| Only when it is sure | caught 1 of 2 junk, hid nothing you wanted |
| As soon as it leans that way | caught both junk, **hid 1 you wanted** |

Then the cautious setting, which looked safe, hides a message on the saved
check that it never hid while choosing.

**A different mailbox.** Here being quick looks free — caught both junk, hid
nothing, 0 of 4 wrong — right up until the saved messages, where it hides one.

So the panel cannot be read as teaching a rule of thumb about which setting is
better. What decides it is the data, and the only honest reading of it is the
one nothing was chosen on.

Two messages in the small mailbox both score 0.7, one junk and one wanted. No
bar can separate them, and both scores are printed. That is left visible rather
than tidied away.

## The expectations are worked out by hand

Asserting a measure against itself is the trap this project has closed by
decoding `bpe_ranks` independently, by the least-squares conditions, by brute
force over 65,536 pictures, by arithmetic anybody can check, by answers worked
out on paper, and by a second formula for cosine similarity. This one closes it
with counts small enough to do in your head.

One junk example and one wanted example puts both denominators at 1 + 2 = 3, so
a word in the junk example only must score `log((2/3) / (1/3))` = log 2. Two
junk out of three must be log 3. A word on both sides must be 0. Those are the
numbers the tests require, written out rather than read off the implementation.

## What was verified

| | |
|---|---|
| First action below the panel title, 1230x842 | **190px**, fully on screen (siblings: 286 / 334 / 431 / 445 / 471 / 520) |
| First action below the panel title, 320x568 | **344px**, button 63px tall, on screen after scrolling |
| Page scroll, every width | 0 vertical, 0 horizontal |
| Panel horizontal overflow, every width | 0 |
| Controls off the right edge | none |
| Widths measured for the initial build | 320x568, 390x600, 720x450, 1100x600, 1230x842, 1440x720 |
| Clarity-pass resize check | 320x568 → 1230x842; 0 page or panel horizontal overflow at both widths |
| Focusable controls in the panel at 320, everything open | 17; none off the right edge, all inside the panel scroller |
| Example toggles | 82px rows at 320, whole row is the target, keyboard-focusable |
| Last control reachable by scrolling at 720x450 | yes, with both details open |
| Animations with the panel open | **none**, so nothing for reduced motion to suppress |
| Network requests from driving the panel | **zero** |
| Marks after learning, switching settings, revealing, switching mailbox, toggling examples, resetting | **byte-identical** against a populated 10-mark model |
| Unfinished explanation across a trip away and back | kept |
| Panel state across a trip away and back | mailbox, setting, reveal and the note all kept |
| `pnpm test` | 592 passing, 48 of them this experiment's |
| `pnpm lint`, `pnpm typecheck`, `pnpm build --webpack` | clean |

**One real explanation through the live assessor** moved `train-test-split`
**`unexplored` → `shaky`** and left every other key unchanged — checked by
reading stored state before and after. The assessor judged it half-held rather
than solid; that is its call and is recorded rather than tuned.

### Two defects found by measuring

1. **The first action was 757px below the panel title at 320px.** Measured
   against the siblings. The cause was three stacked group cards costing 304px
   and a six-line intro paragraph costing 158. The step number now sits beside
   its name instead of above it below 560px, and the provenance line moved
   under the button. A later clarity pass moved the action before the progress
   tracker and hid the useless pristine Reset. **344px now; 190px at 1230.**
2. **The first action ran off the right of the panel at 320px.** The button was
   291px wide in a 242px column, hanging 32px past the edge, because the shared
   `Button` is `whitespace-nowrap` with a fixed height. The label is shorter and
   this one button wraps. Eleventh time a defect here was found by measuring
   rather than reading.

### The interaction defect found in the clarity pass

The first version selected **Only when it is sure** before the learner did
anything. Both outcomes were visible, but the cautious setting already looked
chosen and the final-check button was live immediately. A learner could finish
the experiment without making the decision the middle group exists to teach.

`caution` now starts at `null`. Both settings state their trade-off in a whole
clickable card, and the final-check control is absent until one is chosen. This
is a functional constraint rather than instructional copy hoping the learner
does the steps in the intended order.

## What was not verified

- **No physical phone and no screen reader.** The 320px and 450px-high checks
  are emulated viewports in a desktop browser, and the accessibility work rests
  on the DOM rather than on a VoiceOver or NVDA session.
- **`sr-only` was deliberately not used**, on the recorded grounds that an
  absolutely positioned hidden span inside one of this app's scrolling panes
  escapes the shell's clip and adds page scroll. The consequence is that a
  screen reader hears each row as its four labelled parts, with no extra
  summary; the plain-English note under each row carries the meaning.
- **Live regions were narrowed but not heard.** They sit on the two sentences
  that change and on the refusal, rather than around the whole results area,
  but nothing here has been listened to with a screen reader.
- **Only one assessed explanation was submitted**, and it came back `shaky`.
  One reading is not a measurement of how this node's explanations are graded.

## The shared assessor canary

`EXPERIMENT_PROMPT` is display copy that `ExplainBack` renders and never sends,
so the assessor prompt, the decision schema and the model list are untouched by
this work. `pnpm calibrate --explain --runs 3` was run anyway, and **fails**:

| | |
|---|---|
| False passes | **2/72** — both `hallucination/parroted` |
| False blocks | **3/24** — all `neuron/technical` |
| Everyday words accepted | 12/12 |
| Jargon-with-mechanism accepted | 9/12 |
| Misconceptions flagged | 12/12 |
| Latency | median 1106ms, max 6389ms |
| Cost | $0.04181 for 72 calls |

Both are fixtures the previous two sessions already recorded on unchanged
fixtures, prompt and model. `hallucination/parroted` is the one `AGENTS.md`
records as deliberately left failing rather than tuned away; `neuron/technical`
was 1/24 in the generalization session and 3/24 in the word-neighbours session,
and is 3/24 here. The canary has no `train-test-split` fixture, so this is not
evidence about this experiment — it is the current state of the shared assessor,
recorded rather than hidden.

## Limits stated on screen

Under **What this leaves out**: fourteen messages is far too few for any
confidence; real filters use far more than words; holding messages back is not a
guarantee, because the saved messages can share the same oddities and because
repeated tuning against one saved set quietly makes its answers part of how the
filter was built; and the two kinds of mistake are not equally expensive, which
is the whole reason there is a choice to make.

## The connection to the idea before it

Stated on screen, once the final check is open:

> This follows on from the phone-price experiment: a rule can do well on
> examples it has seen. Saved messages help us find out whether it works on new
> ones too.

`generalization-overfitting` is this node's prerequisite in the graph, and its
experiment is one tap away on the focused view.
