# Who actually did the calculation? — `tool-use`

An experiment on **Tool use**, reached from the concept inspector and focused
map. A shelf builder asks for three 87cm boards. The first screen separates a
scripted request, a real local calculator result, and a scripted final answer.
The first useful action is **Run the calculator**.

The opening path is deliberately small:

1. **Request:** “Calculate 3 × 87.”
2. **Calculator result:** “Calculator returned 261cm.”
3. **Answer:** “You need 261cm of board, before allowing for cuts.”

After a changed count succeeds, a small **Before / Now** pair keeps the previous
returned total beside the new one. It is withheld while the new request is
waiting or running, so an old success never looks like the answer to new input.

The model does not secretly perform step two. This panel has no language model.
The request and answer wording are prepared so the handoff is visible; named app
code validates the request, runs multiplication locally, and supplies the
returned value to the answer builder. The connection to an earlier idea is the
one the graph needs: **the model can ask for an action in its output; the
surrounding app runs it and brings the result back.**

## The boundary is real code

`src/lib/experiments/tool-use.ts` defines one typed request:

- tool: `calculator`
- operation: `multiply`
- two finite, bounded operands
- unit: `cm`
- a stable request ID

`handleCalculatorRequest` is the only executor. It validates the allowlisted
tool, operation, operands, result bound, and unit before multiplying. It never
evaluates free text and does not use `eval`.

The final sentence takes a successful `CalculatorSuccess`, not the board count
or a prepared total. That makes “261cm” the actual returned value rather than a
second copy of the expected answer.

## Old answers cannot leak into new requests

The experiment is a reducer with `waiting`, `running`, `success`, and `error`
states. Changing the board count creates a new request ID and immediately clears
the old response. A response is accepted only while the matching request is
running. A delayed result from an older request is ignored.

Reset cancels the browser timer and creates another request ID, so even a
callback already leaving the timer queue cannot complete the reset request.
Retry also gets a new ID. Rapid duplicate starts are idempotent.

The visible delay is only there to make the handoff readable. The calculation
itself is synchronous and local. **What if it fails?** starts a fresh request,
returns a prepared tool error, withholds the final answer, and offers a named
retry.

## State and marks

`useToolUseExperiment` lives at workspace level with the other experiment
hooks. The board count, current request, returned result, and expanded details
survive a trip to another map view or to the explanation and back. The existing
explanation draft also survives experiment ↔ explanation navigation.

The component has no learner-model access. Running, failing, retrying, changing
the input, and resetting left `edgewise.learner.v1` byte-identical in the
browser. Only the existing explanation check can improve the `tool-use` mark.

## What was verified

`src/lib/experiments/tool-use.test.ts` covers:

- `3 × 87 = 261`, plus changed board counts;
- the final sentence using the successful returned value;
- non-finite, negative, too-large, missing, and fractional inputs;
- the tool, operation, and unit allowlists;
- no completed result before success;
- a changed input clearing the previous answer and creating a new request;
- a delayed old response being ignored by request ID;
- failure, retry with a new ID, rapid duplicate starts, and reset/cancellation.

BrowserOS Neo was run against the real dev server:

| Check | Result |
|---|---|
| Opening calculation | 261cm returned, then used in the final sentence |
| Change count to 5 | old answer disappeared while waiting; new request returned 435cm and showed 261cm → 435cm |
| Simulated failure | no completed answer; clear error and retry |
| Retry | new request returned 435cm |
| Empty and 21-board inputs | named range message; Run disabled; no request |
| Full map → Focus | count and 435cm result preserved |
| Experiment → explanation → map → explanation | unfinished explanation preserved |
| Learner storage | byte-identical after play, invalid input, and reset |
| 1200×797 | first action 353px below title; no page scroll, clipping, or undersized experiment controls |
| 320×568 | first action 411px below title; no page scroll, clipping, or undersized experiment controls |
| 720×450 | first action 382px below title; long detail and final action reached by keyboard |
| 640×797 reflow | first action 334px below title; no page scroll or clipping |
| Resize 1200 → 320 | figures unchanged; no clipped region or off-right control |
| Scroll ownership | document stayed at 0; `.focus-map` owned the experiment scroll |

The first 320px build put the action 549px below the experiment title because a
whole request card came before a separate action card. Moving **Run the
calculator** directly under the structured request reduced that to 411px. Its
result remains beside it in the two-column layout and immediately after it in
one column.

## Limits and checks not run

This is not a generic tool platform, a permission lesson, or evidence that tool
results are trustworthy. It performs one harmless local multiplication. A
visible limit says real apps still have to describe tools, choose permissions,
check outside results, and decide which actions are safe.

The authored graph and this panel agree, so the graph, assessor prompt, schema,
fixtures, explanation checker, and model list were not changed. No calibration
run was required or run.

No physical phone, screen reader, learner, or literal browser-chrome 200% zoom
was used. BrowserOS Neo cannot drive browser chrome zoom; 640px reflow was
checked as the project’s equivalent for a 1280px viewport at 200%.
