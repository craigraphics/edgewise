# What turns one tool call into working towards a goal? — `agents`

An experiment on **Agents**, reached from the concept inspector and focused
map. A fictional library, a small catalogue, and one fixed goal: *find two
mystery books under 200 pages that are available now.* The first useful
action is **Take the next step**.

The panel states up front that this is a scripted agent demonstration — the
library, the catalogue, and every decision are local to the browser, with no
account, no borrowing, and no live model involved.

## The loop, one step at a time

Each press of **Take the next step** runs one tool and shows its result next
to the button, together with why another step is needed:

1. **Search the catalogue** → returns every book whose genre is `mystery`.
   The catalogue table marks those rows *Candidate — not checked yet* and
   marks everything else *Not a candidate*.
2. **Check a candidate** → returns its real page count and current
   availability. The row is marked *Confirmed* or *Discarded*, with a reason
   for a discard (too long, or not available).
3. The loop stops the moment two distinct books are confirmed, and the result
   names the evidence: *"The Silver Key and Whispers in the Library are both
   mysteries, under 200 pages, and available in the latest check."*

**Run the remaining steps** appears only after a manual step, and a **Stop**
control is visible any time a step is in flight or the run is going by
itself. Stopping cancels the pending step; nothing it would have returned can
land afterwards.

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

## Try a problem

Three catalogues over the same eight books:

- **Everything goes to plan** — the first two candidates checked (The Silver
  Key, then Whispers in the Library) are both available. 5 steps to success.
- **A book turns out to be unavailable** — Whispers in the Library is
  checked out this time. The next action genuinely changes: the loop moves
  on to The Missing Letter instead, and still succeeds. 6 steps.
- **No second match exists** — every remaining candidate fails on length or
  availability. The loop checks all six candidates, finds only one match,
  and reports **"The task is unfinished"** with the evidence, rather than
  declaring success. 7 steps.

Switching scenarios resets the run, because watching the decisions unfold
again with different results coming back is the whole point.

**Make the next step fail, to see what happens** simulates a tool that
returns nothing. The failed attempt is logged, nothing in `progress` changes,
and the very next decision is identical to the one that just failed — so the
same step can be retried without losing anything already learned.

## What this leaves out

Real model-based agents often ask a language model to choose the next
action instead of running fixed code. Even then, the surrounding app still
manages which tools exist, what information is visible, how many steps are
allowed, and when to stop. A loop by itself does not make a system reliably
autonomous — the common failures are an overflowing context, small errors
compounding across steps, and no reliable way to know the goal was actually
met. The panel says this in `How it works` rather than leaving it implicit.

## Connection to an earlier idea

*"Tool use handles one request and its result. An agent repeats that loop
toward a goal, using each result to choose what happens next."* This is
shown near the top of the panel, before any step has been taken, and does
not depend on having tried the tool-use experiment.

## What was verified

`src/lib/experiments/agents.test.ts` (23 tests) covers:

- the two tools reading only the catalogue they are given;
- `decide` reading only accumulated progress, never the catalogue;
- a search hit alone never counting as confirmed;
- a full run on each of the three catalogues, including that the default run
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

`pnpm test` (910 tests), `pnpm lint`, `pnpm typecheck`, and
`pnpm build --webpack` all pass.

BrowserOS neo was driven against the real dev server:

| Check | Result |
|---|---|
| Default run | search → 4 checks → success at 2 confirmed; remaining 2 candidates never checked |
| "A book turns out to be unavailable" | Whispers in the Library discarded as unavailable; next action moved to The Missing Letter; still succeeded |
| "No second match exists" | all 6 candidates checked; "The task is unfinished", with 1 of 2 named |
| Simulated tool error | no progress made; retry with the same action succeeded; checkbox cleared itself after one use |
| Explain what happened | opened with this node's own question, empty field |
| Real explanation submitted | assessor accepted it; `agents` moved `unexplored → known`; every other of 10 existing marks byte-identical |
| Learner storage, played without explaining | byte-identical before and after a full run, a dataset switch, and a forced error |
| Reset / reload | experiment state returns to the initial screen; the map's own mark for `agents` survives, shown as *Solid* |
| Narrowed container (proxied at 320px) | catalogue table scrolls inside its own wrapper (`overflow-x: auto`); `document.documentElement.scrollWidth` stayed equal to `clientWidth`; no button crossed the container's right edge; every button at least 40px tall |

## Limits and checks not run

This session's browser-automation tool did not resize the actual viewport
(`resize_window` changed the reported window size but not
`window.innerWidth`, and a real reload did not pick up a new size), so the
320px and 450px-height checks above were done by constraining the
experiment's own container width in the live DOM rather than by resizing the
browser window — a proxy for the layout math, not a replacement for it. The
same session's attempt to drive `Tab` through the keyboard did not move
`document.activeElement`, so keyboard focus order was not re-verified end to
end this session; every interactive element in this panel is a native
`<button>`, `<input type="checkbox">`, or `<details>/<summary>`, the same
primitives already keyboard-audited in the tool-use and RAG panels this one
was built alongside.

No physical phone, no screen reader, and no literal browser-chrome 200% zoom
were used.

The graph, the assessor prompt, the decision schema, the fixtures, and the
model list are all untouched by this branch, so no calibration run was
required or run.
