# What turns one tool call into working towards a goal? — `agents`

An experiment on **Agents**, reached from the concept inspector and focused
map. A fictional library, a small catalogue, and one fixed goal: *find two
mystery books under 200 pages that are available now.* The first useful
action names what the loop has decided to do: **Search the catalogue**.

The panel opens on the goal, the next decision, and what last came back:
three cards that stay within sight of each other. Nothing is called scripted.
The tools are local and the decisions are real, and the provenance line sits
under the button rather than in front of it.

## The learning-experience pass, 2026-09-16

The first build worked and taught badly. An audit driven against the running
app found that the three things a loop is made of were never in view at once,
that the decision itself, which is the whole subject of this node, was never
shown, and that the stopping condition arrived as a press that did nothing.
What follows is what changed, and what it measured.

### The decision is shown before it is taken

`decide(progress)` is the idea this node exists to teach, and the first build
rendered only its result. The button said **Take the next step**, which is
what every sibling panel was careful not to do: **Run the calculator**,
**Search the notices**, **Check the museum record**, **Pick an ending**.

`describeDecision` now turns the pending decision into an action and a reason,
both read off `decide` rather than written down:

> **Next step, chosen from what it knows so far**
> **Check The Silver Key**
> The first candidate not checked yet. Only a check returns a length and an
> availability, and 5 are still untried.

The button carries that same name. A test rejects a verdict word in either
half, and another requires the reason not to repeat the title already in the
heading above it.

### The run ends on the step that met the goal

Measured on the first build: **six presses for five tool calls.** The fifth
press already said *"That's 2 of 2 confirmed"*, left the button reading *Take
the next step*, and still offered *Run the remaining steps*. A sixth press ran
no tool and only then showed the ending. The single most important moment in
the panel, a stopping condition written by a person firing when the goal is
met, was staged as the loop failing to notice it had finished.

`resolve` now computes `decide` on the resulting progress and settles in the
same action. **Five presses, five steps**, asserted by a test that drives the
reducer the way the panel does and requires `presses === log.length`.

### Nothing promises a step the loop will not take

`describeCheck` appended *"Check the next candidate."* unconditionally, so the
failure ending read:

> Not a match: Death on the Nile Path is not available right now. **Check the
> next candidate.**
> **The task is unfinished.** Checked every mystery candidate that came back.

Every "what happens next" sentence is `whatFollows(next)` now, read off the
decision the loop will actually take: *"Next: check X."*, *"That is the goal
met, so the loop stops."*, *"There is nothing left to try, so the loop
stops."* Two tests hold both endings to it.

A tool error uses the same helper, which makes the retry claim visible rather
than merely true: *"Nothing was learned, so nothing about the next decision
changes. Next: search the catalogue."* And the preview above the button is
still the identical action.

### Search returns something the learner did not already have

Genre was visible for all eight rows from the first frame, so *"found 6
mystery candidates"* confirmed something countable before the press. The
table is the loop's knowledge now rather than the world: it does not exist
until the search returns, `knownGenre` reports nothing before then, and the
readout says *"Searched the catalogue: 6 of the 8 books are mysteries."*
Before the first press the panel names the two tools instead.

### The stopping condition is said out loud, on the main path

After the run, a **What made it stop** card, not a disclosure, carries the
three things the first build left unremarked or hidden:

- The rule that fired, and that a person wrote it, including the `MAX_STEPS`
  ceiling of 12 that had previously appeared only as an unexplained number
  inside a failure message.
- **What did not happen.** After a successful default run, *The Missing
  Letter* and *Death on the Nile Path* sit permanently unchecked. Nothing
  ruled them out; the goal asked for two and two were confirmed.
  `untouchedCandidates` computes it, and it is correctly absent when the
  candidates genuinely ran out.
- The node's own `simplificationCost` and second misconception: that an agent
  is a model in a loop rather than a new ability, and that the usual failures
  are compounding error, a filling context, and not knowing when the goal has
  been met. All three were previously in the second paragraph of a `<details>`.

### The scenario labels no longer give away the ending

*"Everything goes to plan"*, *"A book turns out to be unavailable"* and *"No
second match exists"* each stated the result before the loop ran, against the
rule `one-step-at-a-time` records with a test behind it. They describe the
shelf now: *"The full mystery shelf"*, *"One copy is out on loan"*, *"A
borrowed copy and a longer edition"*. `LIBRARY_SCENARIOS` moved into the lib
so a test can reject a spoiler word in a label or a blurb.

### The layout, measured

The first action sat **737px below the panel title** at the 660x619 workspace,
against 308 to 395 across five siblings measured as controls in the same run.
Breakdown: intro prose 124px, goal card 76px, and **359px of catalogue table**
in which three of five columns were an em dash before anything had been
looked up.

Copy trimming would not have closed it. The fix was structural: goal and next
decision are a two-column `.agents-cockpit` with the readout spanning beneath,
the table moved below the action, the standalone intro folded into the goal
card where it costs nothing in the shorter column, and Reset moved out of the
header, because a control that appears mid-run must not move the first action.

| | Before | After |
|---|---|---|
| First action, 592px pane | 737 | **261** |
| The same, mid-run | 737 | **261** |
| The same, after resizing down and back | not measured | **261** |
| First action at 320px, mid-run | 729 | **560** |
| Five siblings at 592px, same run | 308-395 | unchanged |
| Five siblings at 320px, same run | 444-556 | unchanged |

Page scroll, region clipping, controls off the right edge and tap targets
under 40px were all zero at 320, 400, 480, 560 and the real width, before and
after a resize.

**Both of this panel's `@container` rules were dead.** `.agents-lab` never set
`container-type: inline-size`, which every sibling `-lab` root does, so the
cockpit's two columns and the existing three-column scenario grid never
appeared at any width. The threshold was also 40rem against a **557px content
box**, because a container query reads the content box and the focused pane
gives this panel 557px at a 1230px viewport. It is 34rem now, matching the
scenario rule already in the same stylesheet. Same defect
`docs/preferred-reply.md` records.

### A sixth wrong probe, with a tell this project has already written down

A first contrast run reported **1.17:1 for ordinary foreground text in light
mode**, on a heading that is visibly near-black on cream. Computed colours
here serialise as `lab(...)`, and canvas `fillStyle` silently rejects them and
keeps whatever was set before, so the text and its backdrop were both being
read as the black fill underneath. Exactly the trap `docs/what-gets-sent.md`
records, met again by a probe written on that doc's own advice.

Resolved with a Lab(D50) to sRGB conversion for the strings canvas will not
take, the figures separate by theme and match the shell's recorded values:
worst text **5.55** light and **7.89** dark; the band accents on the goal and
readout cards, which are graphics, **5.72** and **6.75** against a 3:1 floor.
`--band-systems` is still never printed as text.

## The policy is a small function, not a hidden model

`src/lib/experiments/agents.ts` holds the whole loop:

- `searchCatalogue(catalogue)` and `checkBook(catalogue, id)` are the two
  tools. Each takes the catalogue and nothing else.
- `decide(progress)` takes **only** what the loop has learned so far —
  whether it has searched, which candidates came back, which have been
  checked, which are confirmed — and returns the next action. It has no
  catalogue parameter at all, so it cannot special-case the answer; a test
  asserts its arity is exactly one.
- A search hit alone is never treated as confirmed. Only a `check` result
  that is under 200 pages **and** available (`meetsGoal`) is added to
  `confirmed`, and `decide` only returns `success` once two distinct ids are
  in that list.
- `MAX_STEPS` (12) bounds both real steps and retries after a tool error, so
  a stuck loop reports the task unfinished rather than running forever.

The reducer (`applyAgentAction`) is the same request-id discipline this
project already uses for the tool-use and RAG experiments: a `resolve` is
applied only while its request is the one currently pending, so a stale or
duplicate delivery — including one that arrives after Reset or after a
dataset change — is silently ignored rather than corrupting the run.

## Try a different shelf

Three shelves over the same eight books. The labels name the shelf, never the
ending, and a test rejects a spoiler word in any of them.

- **The full mystery shelf** — the first two candidates checked (The Silver
  Key, then Whispers in the Library) are both available. 5 steps.
- **One copy is out on loan** — Whispers in the Library is checked out this
  time. The next action genuinely changes: the loop moves on to The Missing
  Letter instead, and still succeeds. 6 steps.
- **A borrowed copy and a longer edition** — every remaining candidate fails
  on length or availability. The loop checks all six candidates, finds only
  one match, and reports **"The task is unfinished"** with the evidence,
  rather than declaring success. 7 steps.

Switching shelves resets the run, because watching the decisions unfold again
with different results coming back is the whole point.

**Make the next step fail, to see what happens** simulates a tool that
returns nothing. The failed attempt is logged, nothing in `progress` changes,
and the next decision is identical to the one that just failed — and because
the decision is now previewed above the button, that identity is on screen
rather than only in the code. The readout says so too: *"Nothing was learned,
so nothing about the next decision changes."*

## What this leaves out

Real model-based agents ask a language model to choose the next action
instead of running fixed code. Even then, the surrounding app still manages
which tools exist, what information is visible, how many steps are allowed,
and when to stop. A loop by itself does not make a system reliably autonomous:
the common failures are an overflowing context, small errors compounding
across steps, and no reliable way to know the goal was actually met.

The first build said this only in `How it works`. It is on the main path now,
in the **What made it stop** card that appears once the run has ended, along
with the node's first misconception — that an agent is a model in a loop with
tools and a human-written stopping rule, not a new ability in the model. The
`How it works` disclosure keeps the narrower version: what the chooser is
here, and what would differ if it were a model.

## Connection to an earlier idea

*"Tool use handles one request and its result. An agent is that same step
repeated: look at what has come back, choose one action, do it, look again."*
This moved to the end. The first build stated it before any step had been
taken, which is the conclusion in front of the experiment, and this project's
rule is that the name comes last. It does not depend on having tried the
tool-use experiment either way.

## What was verified

`src/lib/experiments/agents.test.ts` (40 tests) covers:

- the two tools reading only the catalogue they are given;
- `decide` reading only accumulated progress, never the catalogue;
- a search hit alone never counting as confirmed;
- a full run on each of the three shelves, including that the default run
  stops as soon as it has two matches and never checks the rest;
- genre, the strict page limit, and two **distinct** confirmed ids, checked
  directly against the outcome of a full run;
- a stale or duplicate `resolve` being ignored;
- a tool error leaving progress untouched and the next decision unchanged;
- repeated tool errors eventually bounding the run to an honest failure;
- reset and dataset changes returning to a clean initial state;
- a delayed result after reset being unable to recreate old progress;
- a manual step being unable to begin while one is already running;
- `settle` being a no-op once an outcome already exists.

Added by the learning-experience pass:

- **five presses for five steps** on both endings, driving the reducer the
  way the panel does and requiring `presses === log.length`;
- auto-run clearing itself on the step that produced the outcome;
- neither ending offering a next candidate, and every other step naming the
  one that really is coming;
- a tool error reporting that nothing was learned and naming the identical
  next decision, for both a failed search and a failed check;
- `describeDecision` naming the action, giving a reason, containing no verdict
  word, and not repeating the title already in the heading above it;
- `knownGenre` returning nothing before the search and both sides of the
  question after it;
- `untouchedCandidates` returning the two the default run never reached, and
  nothing when the candidates genuinely ran out;
- the step limit being described as a rule a person wrote;
- every scenario label and blurb being free of a spoiler word, and the set
  covering each dataset exactly once.

`pnpm test` (927 tests), `pnpm lint`, `pnpm typecheck`, `pnpm validate-graph`
and `pnpm build --webpack` all pass.

BrowserOS neo was driven against the real dev server. The rows marked *(first
build)* were the audit that prompted this pass; the rest were re-run after it.

| Check | Result |
|---|---|
| Default run *(first build)* | 6 presses for 5 tool calls; the ending needed one press that ran nothing |
| Default run | **5 presses, 5 steps**; the success card lands on the step that confirmed the second book |
| Live goal tally | `0 of 2` → `1 of 2: The Silver Key` → `2 of 2: The Silver Key, Whispers in the Library` |
| Decision preview | names the action and the reason before each press; the button carries the same name |
| "One copy is out on loan" | Whispers in the Library discarded as unavailable; next action moved to The Missing Letter; still succeeded |
| "A borrowed copy and a longer edition" | all 6 candidates checked; *"There is nothing left to try, so the loop stops."* then **"The task is unfinished"**, with 1 of 2 named |
| Simulated tool error | *"Nothing was learned, so nothing about the next decision changes. Next: search the catalogue."* and the preview above the button unchanged; checkbox cleared itself after one use |
| What made it stop | names the rule, the 12-step ceiling, and the two candidates never checked; the unchecked paragraph is correctly absent on the failure ending |
| Learner storage, populated ten-mark model | **byte-identical** across a full run, all three shelves, a forced error, twenty rapid presses, every disclosure and Reset |
| Network | **0 fetches, 0 XHRs, 0 new resource loads** while driving the whole panel including all three shelves |
| Animations | `document.getAnimations()` empty with the panel open and driven |
| First action, 592px pane | **261px** below the panel title, pristine, mid-run, and after a resize down and back |
| First action, narrowed container | 390 at 560, 415 at 480, 519 at 400, 560 at 320 |
| Five sibling panels, same run | 308-395 at 592px and 444-556 at 320px, as controls |
| Layout at 320/400/480/560 and full | page scroll 0, region clipping 0, controls off the right 0, tap targets under 40px 0 |
| Contrast, light | worst text **5.55**, band accents as graphics **5.72** |
| Contrast, dark | worst text **7.89**, band accents as graphics **6.75** |

## Limits and checks not run

**No assessed explanation was re-submitted after this pass.** The earlier
build's run through the live assessor moved `agents` `unexplored → known` and
left ten other marks byte-identical; that path is unchanged here, and the
claim that nothing in this panel moves a mark rests on the absence of
learner-model access plus the byte-identical before/after storage reads above.

`EXPERIMENT_PROMPT` is display copy that `ExplainBack` renders and never
sends. The graph, the assessor prompt, the decision schema, the fixtures and
the model list are all untouched by this branch, so no calibration run was
required or run.

This session's browser-automation tool did not resize the actual viewport
(`resize_window` changed the reported window size but not
`window.innerWidth`), so every narrow measurement above was taken by
constraining the experiment's own container width in the live DOM rather than
by resizing the browser window — a proxy for the layout maths, not a
replacement for it. Keyboard focus order was not re-verified end to end; every
interactive element in this panel is a native `<button>`,
`<input type="checkbox">`, or `<details>/<summary>`, the same primitives
already keyboard-audited in the tool-use and RAG panels.

No physical phone, no screen reader, and no literal browser-chrome 200% zoom
were used.
