# What gets sent — `context-window`

An experiment on **What the model sees**, built to the same rule as the thirteen
before it: change something, inspect the consequence, optionally explain the
mechanism. Reached from the concept's inspector ("Try the what-gets-sent
experiment"), from its own invitation on the focused map, from a neighbour's
`Try it`, and at `#play/context-window`.

## The question, the first action, and the result sentence

Written before any code, and unchanged by it.

| | |
|---|---|
| **Opening question** | *If it is still in the chat, why can't the model use it?* |
| **First action** | **Add more party notes** |
| **Result sentence** | *"Adding that note took the request over 80 tokens, so the oldest message was left out: the door code. It is still in the chat above."* |

## The shape of it

Priya is planning a birthday party. Her first message is *"The door code is
47A."*; you have just asked for it again. Two lists sit side by side and are
allowed to disagree:

- **The chat on your screen** — every message, always, each marked **Sent this
  time** or **Not sent this time** with its own size in tokens.
- **Included in this request** — the instructions, the messages that fit, and
  the room held back for the reply, with a running total out of 80.

Press the action once and the request goes over the allowance, so the oldest
message is dropped. It is the door code. It stays on screen, visibly outside
the request, and the scripted reply changes from *"The door code is 47A."* to
*"I cannot see a door code in the messages I was given."* with the panel's own
line under it: **"The code is not in the messages included this time."**

Then **Include the code again** puts it back among the newest messages and the
same rule finds it, with nothing trained and nothing learned.

The whole walk, measured in the browser:

| | Request | Code included | Dropped this press |
|---|---|---|---|
| Opening | 66 / 80 | yes | — |
| + balloons | 75 / 80 | **no** | the door code |
| + the music question | 77 / 80 | no | the start time |
| + the playlist | 78 / 80 | no | the balloons note |
| + the cake | 65 / 80 | no | the music question **and** the playlist note |
| Include the code again | 77 / 80 | **yes** | — |

The fourth press drops two whole messages at once, which is the rule stated
rather than the rule illustrated: it removes as many as it takes.

## What is real, and what is scripted

**The counts are real.** Every number is `cl100k_base` over the exact text on
screen, from the same pinned `js-tiktoken 1.0.21` the tokenizer playground uses,
run in a Web Worker in the browser. No key, no request: driving the whole panel
produced **zero fetches and zero XHRs**, measured by wrapping `fetch` and
`XMLHttpRequest.prototype.open`. If the worker cannot start, the panel says so,
offers a retry, and shows **no counts at all** — there is no fallback number,
because a made-up count is exactly what this node exists to correct. Verified by
replacing `window.Worker` with a constructor that throws: `role="alert"`, the
reason in words, the retry button, and no request card.

**The allowance is invented, and labelled.** 80 tokens, with 24 held back for
the reply, chosen *after* measuring the messages so that one press visibly
pushes the oldest one out. "How the counting works" says it is not any real
model's limit.

**The reply is scripted, and labelled everywhere it appears.** Its eyebrow reads
*"The reply · a short scripted rule, not a model"*, the panel's second sentence
says *"A small example of choosing what to send, not a live chatbot"*, and
"What this example leaves out" says it is a hand-written rule that never
generates anything.

What earns the scripted reply its place is its **signature**. `answerFrom` takes
the included messages and nothing else, so *"the reply can only use what was
sent"* is the shape of the function rather than a promise in a comment — the
same structural move as `answerWith(learned, distance)` in `phases.ts` and
`learnFilter(examples)` in `junk-filter.ts`. `context.test.ts` hands it a list
whose visible history is full of door codes and whose included list has none,
and requires it to come back empty-handed. It also reads the *text* rather than
a flag on a message, so any included message carrying a code is enough and no
included message carrying one is enough to take it away. The question *"What was
the door code again?"* deliberately does not set it off.

## The honesty the node needs

This node's first recorded misconception is believing the model remembers the
conversation. Its second is believing a bigger window means better use of it.
Both are addressed on screen, after the thing has happened, under **What just
happened has a name**:

- **Nothing was forgotten.** The message was simply not sent. The chat belongs
  to the app, and the whole of it is re-sent from scratch every turn.
- **Other apps do other things.** This one drops the oldest whole messages. A
  real service might refuse an oversized request, summarise the older part, or
  keep its own notes and choose what to put back.
- **Being sent is not the same as being used.** Material in the middle of a long
  request gets used less reliably than material at either end.
- **What it learned in training is still there.** That lives in the numbers
  saved inside the model and is not part of this request at all.

Four things are kept apart by name in "What this example leaves out": the chat
on your screen, the text sent this turn, the numbers training left inside the
model, and any notes an app keeps between conversations, of which this example
has none.

"How the counting works" states the overhead this toy does not model — real chat
APIs add a few tokens per message for things like who said it, and different
model families count with different vocabularies — and says in so many words
that these totals are the text only and are not an exact bill for any provider.

## The boundary that cannot be dropped around

Under **Try another example**, one message of 110 tokens against a capacity of
40. No amount of removing older messages makes room for it, so the panel says
that instead of leaving it out quietly, and the request card adds the sentence
that closes the apparent contradiction:

> One message is bigger than the 40 tokens this request has room for, so it can
> never be sent. Everything older than it is held back with it, which is why
> room is left over.

That "everything older" is a consequence of this app's one rule — remove from
the oldest end — not a second decision. Reaching past the blockage for something
smaller would be *choosing other material to send*, which some real services do
and this one does not.

## No prediction step

The learner has been given nothing they could use to work out how many tokens a
sentence costs, and asking somebody to guess an unexplained number is what
`AGENTS.md` already forbids. One press, and the consequence is on screen.

## Connecting it to an earlier idea

One sentence, inside the request card where the counts appear:

> Text takes up tokens, and a request has room for only so many. A token is a
> piece of text, often a word or part of one.

The second clause is there so it reads for somebody who has never opened the
tokenizer.

## Two defects found by driving it, not by reading it

1. **The result sentence said the same thing twice.** *"…the oldest message was
   left out: the door code. One of them was the door code."* — true, and
   ungrammatical for a single item. The clause is now added only when more than
   one message was dropped and the code was among them. Small numbers are spelled
   out in prose too: "the two oldest messages", not "the 2 oldest messages".
2. **A `too-long-alone` message left free tokens beside a list of things left
   out**, which reads as a contradiction. The request card now says why.

## The defect found by measuring

**The first action sat 568px below the panel title at 1440 and 734px at 320**,
against 286–521 across the thirteen panels before this one, with the button off
the bottom of the window at 1100×700. Sixteenth time in this project.

Copy trimming did not close it: three message cards are 260px of it at 320px. So
the fix was structural, twice over. The action moved to the **top of the second
column** at wide widths, with the request it changes directly beneath it; and in
one column the grid order became **action, chat, request**, so the control comes
before the two surfaces it moves and its own result sentence sits immediately
under it. The speaker also moved inline with the message text, which was a row of
its own costing 30px a message and saying nothing extra.

| | 1440 | 1230 | 1100 | 820 | 720 | 390 | 320 |
|---|---|---|---|---|---|---|---|
| Before | 568 | 609 | 585 | 568 | 609 | 669 | 817 |
| **After** | **157** | **198** | **198** | **157** | **198** | **232** | **293** |

The stage is a **container query**, not a media query, and that is deliberate.
This panel is drawn inside the focused-map pane, which is about 664px wide at a
1230px viewport and 768px at 1440 — so viewport width does not say whether there
is room for two columns here, and a `max-width` rule would have been guessing.
It is the first container query in the codebase.

## Measured in a browser

Chrome, against the dev server, driven in a real window with the viewport set
through CDP.

| Check | Result |
|---|---|
| Opening state | 66 / 80, code sent, reply repeats 47A |
| One press of the first action | Code drops out, reply cannot answer, name card appears |
| Full walk of four notes | 75 / 77 / 78 / 65, always inside 80, two dropped on the fourth |
| Include the code again | 77 / 80, reply repeats 47A, no other change |
| A message longer than the whole allowance | Named as too long, everything older held back, reason given |
| Removing it again | Recovers completely |
| Worker cannot start | `role="alert"`, reason, retry, **no counts invented** |
| Reset | Exactly the opening state; the Reset control is absent until something has changed |
| 40 rapid alternating presses | No error, totals still inside the allowance |
| Page scroll at 1440 / 1230 / 1100 / 820 / 720 / 390 / 320 | 0 vertical, 0 horizontal, nothing clipped |
| 200% zoom (1440×900 and 1280×800 logical) | No page scroll, nothing clipped, every control ≥ 40px |
| Nested scrollers inside the panel | **None** — the guide pane is the single scroll owner |
| Keyboard from the title to the last control | 6 stops at 320×568 and 720×450, every one scrolled into view, all ≥ 40px, all with a visible 2px outline |
| Live regions | The change sentence and the reply both announce on change |
| Contrast, light | Worst text **5.55:1**, worst graphic **4.16:1** |
| Contrast, dark | Worst text **7.89:1**, worst graphic **6.89:1** |
| `--band-behaviour` used as text | Never — 0 elements, on either theme |
| Animations with the panel open and driven | `document.getAnimations()` is **0** |
| Network while driving the whole panel | **0 fetches, 0 XHRs** |
| Trip to Full map → List → Focus and back | Conversation and totals preserved |
| Experiment → explanation → experiment → explanation | A 194-character draft preserved through all four |
| Stored marks, populated ten-mark model | **Byte-identical** during and after the full drive |
| One real assessed explanation | `context-window` **shaky → known**, all nine other marks unchanged |

The populated model was seeded with both prerequisites (`tokens`, `attention`),
both dependants (`rag`, `agents`), this node, and five others. An empty model
would have proved much less.

### A wrong probe, again

The first contrast probe resolved colours by parsing the string out of
`getComputedStyle`. Computed colours in this app come back as `lab(...)`, and
canvas `fillStyle` does **not** convert those — it returns the string unchanged.
The parser then read the three `lab` numbers as `r, g, b` and reported **1.25 for
everything in both themes**. Identical figures across themes is the tell, the
same one the transformer session recorded for a probe that read `oklch()` the
same way. Colours are resolved by *painting* them into a 1×1 canvas and reading
the pixel back now, and each element is composited down its ancestor chain.

That probe also caught a real defect once it was right: the meter's reserve
segment measured **1.77:1** against its track in one theme, near-invisible. It is
a different mix now, and the worst graphic in the panel is 4.16.

## What was not verified

- **No phone and no screen reader.** The keyboard walk, the accessibility tree
  and the live-region checks are not a VoiceOver or NVDA session.
- **`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
  display copy that `ExplainBack` renders and never sends, and this work changes
  no prompt, no schema and no model-list file. One end-to-end assessed
  explanation was submitted through the live path instead, and is in the table
  above. The last four sessions recorded that canary failing on exactly two
  fixtures — 2/72 false passes for `hallucination/parroted`, which `AGENTS.md`
  records as deliberately left failing, and 3/24 false blocks for
  `neuron/technical`.
- **Empty or invalid input** has no surface here: every action is a button over
  prepared messages, and there is no free-text field in the panel.
- **The short pane at small window heights is pre-existing.** At 320×568 the
  focused-map pane is 224px tall for this panel, the attention panel and the
  predictor alike; at 720×450 it is 150, 92 and 150. Measured against those two
  as a control rather than attributed to this branch.

## Nothing here changes the graph or the assessor

`content/graph.json`, the assessor prompt, the decision schema and the model list
are untouched. The only shared file this branch adds to is
`tokenizer-engine.ts`, which gains a `countTokens` export beside the existing
`tokenizeText` so the two can never disagree about the encoding.

**No disagreement with an authored simplification.** The node's
`explanations.intuition` says *"nothing persists between calls: the whole history
is re-sent every single turn"*, and that is exactly what the panel shows. Its
`simplificationCost` is `null`, and nothing found here suggests it should not be.
The one place the panel is more careful than a casual reading of the authored
text is *"Nothing outside it exists as far as the model is concerned"* — true of
this conversation's text, and not of what training left in the model's numbers.
The panel says which, rather than proposing a change to the authored sentence.
