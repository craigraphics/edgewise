<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Edgewise

## What this is

A voice diagnostic that finds the **one idea blocking the rest** of someone's
understanding of how AI works, and shows them the terrain.

It does not teach first. It works out where your understanding stops, then
renders a map of ~23 concepts with each marked known / half-held / not yet /
not looked at. **The map is the product**, not the conversation.

The authoritative spec is the "Diagnostic ML Tutor" document supplied by the
owner. Note that a sibling spec (not in this repo) describes an EARLIER, SUPERSEDED
design of the same idea — walkthrough-first, map internal, text-only, Google
free tier only. Do not follow it. Its cost analysis and its list of what
transfers from the sibling project are still accurate.

## Status

Steps 1–8 are done. The product works end to end: diagnose, map, walk through,
explain back. **It has never been in front of anyone but the owner.**

- [x] 1. Concept graph authored by hand — `content/graph.json`
- [x] 2. `pnpm validate-graph`
- [x] 3. Map rendered, plus hand-marking so the gate can be run on a real person
       ← **validation gate, still un-run on anyone but the owner**
- [x] 4. Text-only diagnostic loop: route handler, constrained action set,
       BYOK + free fallback, model whitelist, session turn cap
- [x] 5. Calibration harness across the model whitelist
- [x] 6. Voice layer — browser speech in and out, hands-free loop
- [x] 7. Multi-turn calibration + structural fix for verdict contamination
- [x] 8. **The full walkthrough** — all 23 nodes, self-driving, voice-led
- [x] 9. Calibrate `explainBack` — `pnpm calibrate --explain --runs 3`
- [ ] 10. Cross-check the graph's prerequisite edges against an established
       curriculum. Open since day one; 23 nodes encoding one person's model.
- [ ] 11. Re-record the calibration fixtures through the real speech path — the
       whole baseline is on written text, and the product is voice-first.
- [x] 12. Error boundaries, per-browser daily cap, deploy
- [ ] 13. Record in the sibling spec that it is superseded

### Running the gate

`pnpm dev`, then sit with someone who is genuinely stuck on this material.

1. Click a node. The panel shows its authored probes under **Ask them** and its
   misconceptions under **Listen for**. Read a probe aloud.
2. Mark what you hear: <kbd>1</kbd> solid, <kbd>2</kbd> half-held,
   <kbd>3</kbd> not yet, <kbd>4</kbd> clear. Keys work so you can keep eye
   contact instead of hunting for a button.
3. Press <kbd>f</kbd>, then turn the screen around.

**<kbd>f</kbd> hides every control — marks, probes, misconceptions, the state
badge, the header, the legend.** That is not tidiness. The largest risk here is
that being diagnosed feels like being graded, and watching someone click "Not
yet" against you is the most direct possible way to produce that feeling.

This was described here from the beginning and **was not implemented until the
redesign** — there was no `f` branch anywhere in `src/`, so the gate could not
be run as written. Worth knowing that a documented mitigation can sit unbuilt
for as long as nobody runs the procedure it belongs to.

Watch, do not ask. The signal is unprompted — they point at something, or ask
about a node they were not curious about a minute ago. The anti-signal is polite
interest and scrolling to the bottom.

Marking by hand is also the cheapest test of the probes themselves, which the
agent will later be reading out. A probe that does not discriminate in a human's
hands will not discriminate in a model's.

**Do not skip past step 3.** The gate is whether the rendered map produces
recognition in a real person — "that is what I have been missing" — or a shrug.
If it is a shrug, the idea does not work and the remaining steps do not rescue
it. That judgement is the owner's, not an agent's: whoever builds this already
knows the subject and will read the map as legible when a learner would not.

## Commands

```bash
pnpm dev              # localhost:3000
pnpm validate-graph   # DAG invariants — run after ANY edit to content/graph.json
pnpm test             # 219 tests: pure logic, plus the token contrast assertions
pnpm lint             # clean — keep it that way
pnpm calibrate        # THE assessor canary — see below. Costs ~$0.008/run.
pnpm typecheck
pnpm build            # also regenerates Next's route types
```

## The parts that matter

### `content/graph.json` — the product

23 concepts, prerequisite edges, 10 layers deep, single root. Conceptual only —
`gradient-descent` and `backprop-intuition` are authored as blame-assignment and
nudging, with no derivatives anywhere. That constraint is the owner's and it is
load-bearing: the audience wants to understand AI without doing the maths.

Two fields carry most of the value:

- **`misconceptions`** — wrong models people actually hold, not merely absent
  knowledge. They need opposite treatment: someone with no model learns quickly,
  someone with a wrong model has to drop it first, and teaching on top of a
  broken one produces confident nonsense. This subject was chosen partly because
  its popular explanations are so reliably wrong — "a neuron is like a brain
  cell", "it just predicts the next word so it can't reason", "attention means
  it pays attention to important words".
- **`simplificationCost`** — what a node's intuitive telling gets wrong, or null
  when it is honest. 13 of 23 declare one. A simplification labelled with its
  cost is a ladder; unlabelled, it becomes a misconception the learner has to be
  rescued from later.

`label` is short because it has to fit inside a box on the map; `subtitle`
carries the fuller framing for the detail panel.

### `layer` is checked against the graph, not trusted

`validate-graph` asserts each node's authored `layer` equals its longest path
from the root. Add a prerequisite without moving the node and it fails. Without
that check, an edge eventually renders pointing backwards up the map, which
reads as an error in the subject rather than an error in the file.

### `src/lib/graph/frontier.ts` — pure, deliberately

Which node is blocking someone is a fact about the prerequisite structure and
the marks, not a judgement. No model is involved. Two rules that have tests:

- A `shaky` node stays on the frontier. Treating a half-held idea as settled
  walks the learner straight past the thing blocking them.
- A `shaky` PREREQUISITE does not open its dependants. Building on a foundation
  we already suspect is the failure this product exists to prevent.

`leadNode` is deterministic — depth, then row, then id — so the map does not
reshuffle between turns when nothing has changed.

### `src/components/map/concept-map.tsx` — positions are authored, not computed

Plain SVG, no graph library, no force simulation. The drawing is the artefact
being judged; a layout that moves every render is not trustworthy enough to
produce recognition. Zoom and pan move a `viewBox` — a camera over a fixed
drawing — so nothing in them can move one node relative to another.

How it sits in its pane depends on what it is being asked to do; see `FitMode`
in `src/lib/map/layout.ts`. Beside the panel it stops shrinking when the labels
reach 12px and pans the remainder. Under a sheet it always shows the full width,
because clipping a column mid-node reads as a broken drawing rather than as
something you can scroll. On a phone, and on the Fit control, it shows the whole
shape.

### `src/app/api/turn/route.ts` — stateless, and derives more than it asks

The learner model travels with the request. Every derived fact — which node is
under discussion, what comes next, whether the session is over — is recomputed
from the graph rather than trusted from the client or asked of the model.

Three things are deliberately NOT the model's job:

- **Which node comes next** is `nextToAsk`, pure code. It is a fact about the
  prerequisite structure and the marks, not a judgement.
- **The opening turn is scripted** and makes no model call. It saves a request
  against a shared daily quota on every session, and the first thing a learner
  hears sets whether this feels like a conversation or an exam — not something
  to leave to the cheapest model on the list.
- **A second `unclear` on the same node is overridden to `shaky`.** The prompt
  forbids it; the route enforces it. Circling one point twice is the
  interrogation this product cannot survive.

Both possible continuations (`nextIfKnown`, `nextIfNot`) are computed and sent
in the same request, so one call can both judge the answer and phrase the right
next question. That halves the requests per turn.

### The verdict vocabulary is not the state vocabulary

A verdict can be `unclear`, which is a fact about an answer and never a fact
about a learner. A state can be `unexplored`, which the model is never allowed to
assert. `SettledState` is the overlap. Keeping them apart is what stops "we did
not understand the answer" being recorded as "they do not understand the idea".

`unclear` exists at all because a schema that cannot express uncertainty forces
the model to fabricate — the sibling project had to explicitly permit an empty
`strengths` array before its grader stopped manufacturing compliments.

### Client/server split in the model layer

`src/lib/models.ts` is the catalogue: whitelist, pricing, fallback order, pure
data. `src/lib/provider.ts` is server-only: the provider, the keys, and the error
classification. The split exists because the browser renders the model picker and
must not bundle the AI SDK to do it. `FREE_TURN_CAP` lives in
`src/lib/session/limits.ts` for the same reason — `token.ts` pulls in `jose` and
the signing secret.

`DEFAULT_MODEL` is a literal, not an env read: a `process.env` lookup in a client
component silently resolves to undefined, so browser and server would disagree
whenever `TUTOR_MODEL` was set. The route applies the override via
`serverDefaultModel()`.

### `pnpm calibrate` — run after ANY change to the prompt, schema, or model list

Feeds answers of known quality through the real `decide` path and checks the two
failures that make this product actively harmful:

- **False pass** — a misconception, a parroted answer, or "I don't know" coming
  back `known`. Routes someone straight past the thing blocking them, with a
  clean visual map lending it authority. Fatal.
- **False block** — a genuinely strong answer marked down. An assessor that
  marks everything down looks safe and never advances anyone.

Four classes per node: `strong`, `misconception`, `parroted`, `blank`.
**`parroted` is the one that matters** — fluent, accurate terminology with no
mechanism behind it. It pattern-matches to expertise on every surface feature.

#### Baseline

`gemini-3.1-flash-lite` over 3 runs: **0/48 false passes, 0/12 false blocks,
12/12 misconceptions flagged**, and all four conversation cases uncontaminated.

Exact-match sits at 32/48 and that is fine: the misses are `misconception` and
`parroted` landing on `blocked` where `shaky` was the ideal. Neither is a false
pass. The distinction that actually matters — a wrong model versus no model —
is carried reliably by the `misconception` flag (12/12), not by the state.

`gemini-3.6-flash` costs **4x** and peaked at **34s** for identical results. The
constrained action set is doing the work, not the model tier — which is the whole
argument for the cheap default.

#### Three things this already caught

1. **The assessor was checking whether the content was CORRECT, not whether
   understanding was DEMONSTRATED.** It marked "an autoregressive transformer
   trained with a causal language modelling objective" as `known` — accurate, and
   evidence of nothing. Fixed by making the prompt ask "did they describe a
   mechanism, or only name one?" 3/16 false passes to 0.
2. **A single clean run was luck.** `--runs 3` immediately surfaced a fixture
   that false-passed every time. **Always use `--runs 3` before believing a
   green result.**
3. **Prompt rules do not hold on a small model.** A real session produced two
   marks whose reasoning was about the PREVIOUS node. Single-turn fixtures
   cannot catch that — there is no previous node — so `content/fixtures/
   multi-turn.ts` replays whole conversations and judges only the final answer.
   The `drifted` case reproduced it exactly.

   Then three rounds of rewording the prompt moved the false-pass rate **0 to 2
   to 3 out of 48**. The instructions were present every time. The fix was
   structural: `answeredTheQuestion` and `mechanismDescribed` are now required
   schema fields ordered *before* `verdict`, so the model commits to both checks
   before it can choose, and `src/lib/agent/verdict.ts` holds it to what it
   wrote. Back to 0/48, and the rule is unit-tested rather than hoped for.

   **The lesson worth keeping: when a rule matters, put it in the schema and
   enforce it in code. Do not rewrite the prompt a fourth time.**

#### The known gap in this evidence

The fixtures are **written**, and the product is voice-first. The sibling project
scored clean prose, passed happily, and missed three grading bugs that only
appeared on transcribed speech. The answers are written in spoken register to
narrow that, but they are not transcripts. **Re-record them through the real
speech path at step 6 and re-run before trusting any of this.**

### Voice — `src/lib/voice/`, `src/hooks/use-voice.ts`

Both directions sit behind an interface (`Speaker`, `Listener`) because the
browser's own voice is the weakest part of the product and the likeliest thing
to be replaced. Swapping in a hosted TTS provider is a new implementation, not a
change to the session.

- **In:** Web Speech API. Chrome only; everything else falls back to typing,
  which is why the text input is never hidden.
- **Out:** `speechSynthesis`, preferring a named voice family over the default —
  the default is usually the worst one installed. On this machine it picks
  "Google US English" rather than the robotic fallback.
- **Hands-free loop:** speak the turn, then open the microphone. Clicking the mic
  stops speech first, or the tutor's own voice is what gets transcribed.

Three gotchas already handled, all silent failures:

- **`getVoices()` is empty on first call** and populates asynchronously. Reading
  it once at construction gets nothing on a cold load; the `voiceschanged`
  listener is what makes voice selection work.
- **Chrome stops speaking after ~15 seconds** unless the queue is nudged. No
  event fires — the audio just stops mid-sentence. Hence the pause/resume
  interval.
- **Two recognisers at once**: the second silently steals the microphone and the
  first ends without ever producing a result. `start` aborts any existing one.

⚠️ **Chrome's recognition is not on-device** — audio goes to Google. The spec
calls this path "free, no server cost", which is true of money and not of
privacy. The UI says so before the microphone opens.

### The opening and the closing are both scripted

Neither goes near a model. The opening saves a request against a shared quota
and sets whether this feels like a conversation or an exam. The closing names
the frontier and how many ideas rest on it — *"22 of the later ideas rest on it,
which is why so much of the rest has probably felt slippery"* — which is the
single most important sentence in the product and the whole reason the graph
exists. A cheap model asked to write it produced "we have reached the limit of
where we need to be for this part of the conversation".

### `src/lib/persisted.ts` — localStorage as an external store

`useState` plus an effect that reads storage on mount has two problems beyond
the lint rule: it cascades a render on every mount, and each caller gets a
private copy that drifts the moment one of them writes.
`useSyncExternalStore` is the shape React provides for this. The `subscribe`
function is cached per key — building it inline re-subscribes on every render.

## Measured

From real turns on `gemini-3.1-flash-lite`:

- **~$0.00045 per turn**, so roughly **$0.01 for a 25-turn session** — a quarter
  of the $0.044 the old spec estimated.
- **3–14 seconds per turn.** The slow tail is the model reasoning before it
  answers. Tolerable in text; it will need attention before voice (step 6),
  where a fourteen-second silence reads as broken rather than thoughtful.

## Decisions taken, with reasons

**A free fallback means there has to be a server.** The spec assumed the browser
calls the provider directly with the user's key. The fallback runs on the
owner's key, and an owner key shipped to a browser is stolen. So one route
handler (`src/app/api/turn/route.ts`, not yet built) serves both paths: a user
key if the request carries one, the owner's Google free-tier key if not. BYOK
keys therefore transit the server — say so in the UI, hold them in memory, never
log them.

**Google AI Studio, not Anthropic.** Owner's call. It is also the only credible
free fallback: no card, does not expire. Default `gemini-3.1-flash-lite`.

**The whitelist is a TESTED list, not a frontier list.** The spec said whitelist
frontier models because a small model wanders. The constrained action set is
what makes a cheap model viable — it picks one of four actions against a strict
schema, it does not invent a curriculum. So a model earns its place by passing
`pnpm calibrate` (step 5). If `gemini-3.1-flash-lite` cannot rank the
plausible-but-wrong fixture, it comes off the list rather than shipping anyway.

## What transfers from the sibling project

A private sibling project solved several of these problems first. Directly
relevant here:

| Source | Use |
|---|---|
| `src/lib/models.ts` | Nearly as-is at step 7. Same provider, same free tier. `isQuotaError` walks the whole `cause` chain because the AI SDK wraps a 429 in `AI_NoOutputGeneratedError`, whose message mentions neither quota nor a status code — the first fallback there silently never fired for exactly this reason. `maxRetries: 0` is deliberate. |
| `scripts/calibrate.ts` | The most important thing to port, at step 5. |
| `src/lib/grading/verify.ts` | Quote verification, for "you said X, which suggests you think Y". |

Not applicable: the voice stack (server-side Deepgram with word timings; this
uses the browser Web Speech API), `sm2.ts`, the question bank, the rubric, and
above all the interviewer persona — its deliberately cold tone is exactly wrong
here.

## The walkthrough — `src/lib/walkthrough/`, `src/components/session/walkthrough.tsx`

**Owner's decision, 2026-08-20:**

> the agent will need to complete with all the elements even if the user doesn't
> know. it will follow the entire flow by itself and the user will listen to it.

So placement is the beginning, not the end. The walk covers all 23 nodes in
prerequisite order, whatever the diagnostic found. With voice on, finishing a
step advances to the next one — no clicking through twenty-three screens; the
controls exist to interrupt, not to operate.

### Steps make no model call

`stepFor` builds each step from `explanations.intuition`, `.example`, and
`simplificationCost` — hand-authored, human-reviewed, read out as written. That
is the reviewable-content property live generation cannot offer, and teaching
something false is this product's worst failure. It is also instant and free,
which is what makes a 23-step spoken walk viable against a shared quota.

**A model is reached for only when the learner interrupts** — "simpler", or a
question — through `/api/reword`, which is handed the authored explanation and
told to work from it. Content in advance, phrasing on demand. Measured at
~$0.00025 and ~2s per interruption; the walk itself costs nothing.

`reword` can answer `outsideWhatIKnow`, because a schema that cannot say "not
from what I have here" forces a small model to invent — and the learner came
precisely because they cannot tell when it is wrong.

### Two traversals, deliberately separate

`nextToAsk` refuses to descend past a node that is not `known`: building a
diagnostic on a suspect foundation is the failure it exists to prevent.
`teachingOrder` covers everything, because the nodes under someone's frontier
are the ones they came for. **Do not merge these into one parameterised
function** — each rule is load-bearing for its own job, and sharing one makes
both look arbitrary.

### What the state means where

- The diagnostic decides how a step is *pitched*, never whether it happens. A
  `known` node gets a brief pass; everything else gets the full teach.
- Openers never grade. A walkthrough that keeps reporting your diagnostic result
  is the diagnostic again — there is a test asserting no opener contains
  "correct", "wrong", "score", and so on.
- **The caveat survives the brief pass.** Someone who already holds an idea can
  still hold the misleading version, so that is exactly who needs it.
- On the map, covered nodes get a small dot rather than a fifth colour. "Has
  been explained to you" is a different axis from "do you have it", and must not
  overwrite the four states.

## Clearing a block — `src/lib/agent/explain-back.ts`, `src/lib/graph/upgrade.ts`

**Owner's decision, 2026-08-20:**

> You will not be able to move from blocked to known unless you give an
> explanation yourself and the model thinks you are on the right track. […] it's
> completely separate from unblocking you or not.

So the two systems do not touch:

| | Changes the map? |
|---|---|
| The walkthrough teaches you an idea | **No** |
| You explain it back and it holds up | **Yes** |

Listening to a good explanation feels almost exactly like understanding one. A
map that could not tell those apart would be confidently wrong about the single
thing it exists to be right about, so **nothing but the learner's own words moves
a node**.

### The rules, both enforced in code

1. **`solid` requires a mechanism AND no misconception.** `mechanismDescribed`
   is the first field in the schema, so the model writes down what they conveyed
   before it can pick a verdict; `settleExplanation` then holds it to that. Same
   structural pattern as `settle` in the diagnostic, and for the same reason —
   the prompt-only version drifted.
2. **An attempt can raise a standing, never lower one** (`upgrade`). Someone
   marked down for volunteering an explanation does not volunteer a second one,
   and the willingness to try out loud is worth more than the precision of any
   one mark. Applied on the server *and* on the client, because the server is
   stateless and the client owns the model.

`blocked` and `unexplored` rank equal in `upgrade`: they differ in what *we*
know, not in what the learner knows.

### Where it lives

On **every** node, from the map or the walkthrough — never gated behind a
position in the walk. Offering it after a step is natural; requiring it would
turn twenty-three deliveries into twenty-three checkpoints.

Speaking it is offered alongside typing, because saying a thing aloud without
being able to edit is a different test — which is where fluent recall and real
understanding come apart.

### Verified against real explanations

- Everyday words, no jargon (*"each one has its own little dial that says how
  much that input counts for"*) → **known**, cleared.
- The brain-cell misconception, fluently expressed → **stayed blocked**,
  misconception flagged, and the reply led with what they got right before
  correcting it.

## Layout and wording — measured, not guessed

There is no UX-metrics MCP available. What there is: an instrumented layout
audit through the browser tools, run at real device sizes before and after. Run
it again after any layout change — the numbers are the point, not the opinion.

```js
// paste into javascript_tool against the running app
const vh=innerHeight, vw=innerWidth, doc=document.documentElement;
const t=[...document.querySelectorAll('button')].map(b=>{
  const r=b.getBoundingClientRect();
  return {l:b.innerText.trim().slice(0,24), h:Math.round(r.height), bottom:Math.round(r.bottom)};
}).filter(x=>x.l);
const a=document.querySelector('aside');
({viewport:`${vw}x${vh}`,
  pageScrollV:Math.max(0,doc.scrollHeight-vh),
  pageScrollH:Math.max(0,doc.scrollWidth-vw),
  panelTop:a?Math.round(a.getBoundingClientRect().top):null,
  under44:t.filter(x=>x.h<44).map(x=>x.l),
  controlsBelowFold:t.filter(x=>x.bottom>vh).map(x=>x.l)})
```

### What it found, and what fixed it

| | Before | After |
|---|---|---|
| Page scroll, laptop 1200×797 | 498px | **0** |
| Map below the fold, laptop | 387px | 0 (250px inside its own pane) |
| Panel position, tablet 844×768 | 825px **below the fold** | top: 69px |
| Horizontal page scroll, 640px wide | 238px | **0** |
| Tap targets under 44px | **all 8** | 0 |
| Buttons competing in the header | 8 | 3 |

The tablet number was the bad one: the panel where every interaction happens sat
800px down the page, under a map that gave no hint anything followed it.

### The rules that came out of it

1. **The page never scrolls.** `h-dvh` + `overflow-hidden` on the shell; only
   the map pane and the panel body scroll, and only when they must. The map is
   genuinely taller than a laptop screen, so 250px inside its pane is the
   irreducible amount.
2. **What you look at while listening does not move.** The progress line and the
   current concept sit outside their scroll containers on purpose.
3. **Panel first in the DOM.** When the two stack on a tablet, you land on the
   part you act in.
4. **The map scales to its pane down to a 760px floor, then scrolls.** Fixed
   size clipped the right-hand column mid-node and read as a broken drawing;
   unlimited scaling drops the 10.5px labels below legibility on a tablet.
   *(Superseded: the floor is now stated as the point where the label reaches
   12px — `LEGIBLE_SCALE` — because legibility was always the actual
   constraint, and a pixel width stops being correct the moment the geometry
   changes.)*
5. **`size="touch"` (44px) on anything a finger uses.** Every other size in the
   shadcn set is under it — fine for a mouse, not for a tablet.

### Wording

Labels now say what happens rather than naming a mode:

| Was | Now | Why |
|---|---|---|
| Session | Find my starting point | "Session" names a mode, not an outcome |
| Walk me through it | Teach me everything | Sits next to the above as a clear alternative |
| Mark by hand · Demo · Clear | behind **More** | A testing harness was in the main nav, giving a first-time visitor three choices where there are two |
| Play + Go on | **Next idea** + **Read it to me** | Both advanced the walk. Moving is now always Next; Play became plainly about audio |
| Simpler | Say it more simply | Reads as an instruction rather than a setting |
| Speak | Answer out loud | |

Two things are stated rather than left to be discovered: the first-run panel
lays out what happens in three numbered steps, and the walkthrough says in words
that reading aloud **also moves on by itself** — which is surprising enough that
finding out by watching the screen change is unpleasant.

`Teach me the lot` was tried and dropped: idiomatic British, and this has to
read for people who are not.

### The first-run dialog — `src/components/session/welcome.tsx`

Everything else explains itself in place. The *premise* cannot: why a map of
what you do not know is worth having at all is an argument, not a label, and
there is nowhere in the running interface to make it without being in the way
every time afterwards. So it is said once, on a first visit, and the dismissal
is persisted — a modal that returns on every reload is worse than no modal.

It carries the original framing (you cannot ask a good question about something
you do not understand yet), the three-step flow, and the two rules that are not
guessable: **being taught something does not tick it off**, and asking for it
simpler is the most useful thing here rather than an admission.

`focus({ preventScroll: true })` on the dismiss button is load-bearing —
focusing it normally scrolled the dialog to its last line and opened with the
title off screen.

### Speech: the pause window is ours, not Chrome's

Reported from real use — *"when I speak it cuts out very fast, there needs to be
more spacing between words when I'm trying to think"*.

The cause was `continuous = false`, which hands endpointing to the browser.
Chrome's is tuned for dictation, where a pause means you have finished. Here a
pause almost always means you are thinking: someone working out how to say what
a neuron does will stop mid-sentence for several seconds, and being cut off
there loses the answer and the nerve to give another.

So `continuous = true` and the decision moved into `listener.ts`: a 4-second
window since the last recognised speech, checked on a 400ms tick. Widening a
timeout would not have been enough — Chrome ends recognition on its own anyway,
including with `no-speech` — so the listener now tracks **intent** (`wanted`)
separately from whether a recogniser happens to be running, and quietly restarts
one whenever Chrome stops while the learner still means to be talking. Only the
silence window or an explicit stop ends the turn.

`no-speech` and `aborted` are no longer reported at all: the first is Chrome
giving up during a pause, the second is us tearing down deliberately. Showing
either puts an error in front of someone who is simply thinking.

Verified: with `continuous = true`, eight seconds of total silence produced no
`onend` and no `no-speech`. Under the old setting it ended within a second or
two.

### Finishing the walk — `src/components/session/completion.tsx`

Two versions, and which one appears is the point.

Being walked through twenty-three ideas is a real thing to have done, and saying
so is fair. It is **not** the same as understanding them, and telling someone it
is would undo the distinction the whole product rests on. So the ordinary
completion celebrates finishing and then states plainly how many are actually
solid, with the rest described as "ideas you have now been through, but have not
put back into your own words yet".

The full version — *"That is the whole thing"* — is reserved for a map that is
genuinely solid, meaning every one was explained back and held up.

Someone who thinks they have finished, when the map still shows most of it
unheld, has been misled by their own sense of a completed task. That is exactly
the confusion between being told and knowing, and the completion screen is the
last place it could creep back in.

### Smaller fixes with reasons

- **Node boxes get an opaque base rect** (`var(--background)`) under the state
  fill. The faint states run at 5–7% opacity, so edges passing behind a box
  showed through the label. *(Still true, and now doing more: the card is a
  neutral surface in every state rather than a wash of the band colour, which is
  what took the label's contrast out of the hands of six different hues. See
  "Legibility, measured" below.)*
- **The theme toggle moved into the header flow.** It was `fixed top-3 right-3`
  and sat on top of the header's own controls.
- **The four walkthrough controls are a 2x2 grid, not a wrapping row.** Labels of
  very different lengths wrapped into ragged rows that read as unrelated
  buttons; equal 176px cells make them one set of four.
- **`size="touch"` is 40px, not 44.** The usual guidance is 44; it read heavy on
  a desktop where most of this is used. Everything else in the shadcn set is
  28–36px, which a finger cannot reliably hit. `icon-touch` is its square
  counterpart, added for the header and map controls, which were 36px.

## The redesign — what changed and why

A full pass over the presentation layer. Nothing in `content/graph.json` moved,
no layout is computed, the four states are still four, and there is still no
score, no percentage and no red.

### Legibility, measured

The one defect rather than a preference, and it was on the most important
element in the product.

`STATE_STYLE` used to paint the node fill as the band colour at an opacity and
put the label straight on it. Measured, in light mode:

| State | Label | Worst band | AA 4.5:1 |
|---|---|---|---|
| `known` | white on 90% band | **2.89** | ✗ |
| `shaky` | foreground on 28% band | 13.77 | ✓ |
| `blocked` | muted on 7% band | **4.34** | ✗ |
| `unexplored` | muted on 5% band | **4.45** | ✗ |

Dark passed everywhere (worst 5.42). So the map was legible to whoever built it,
who works in dark, and not to a light-mode visitor — and `known`, the worst case
at 2.89, is the state the map most wants read.

The cause was structural, not a bad colour pick: **the label's contrast was
hostage to six hues across four opacities**, twenty-four combinations that all
had to pass and seven did not. No retune could have fixed that. So the label
came off the band colour: every node is now an opaque neutral card with the band
as a 3px accent down its leading edge. **Worst case is now 11.60, both themes.**

`src/app/globals.test.ts` asserts this against the real tokens in `globals.css`
— every state on every band in both themes, band accents as graphics at 3:1,
body and muted text on all three surfaces. Retuning a colour now fails there
rather than in front of a learner.

### State is a glyph, never a colour

Four states used to be four dash patterns on a 1.3px border — solid, `5 3`,
`2 4`, solid-but-fainter — at four fill opacities between 5% and 90%. The
difference between "not yet" and "not looked at" was about one pixel of pattern
and two per cent of fill, and nothing on screen taught the code.

They are now shapes: **filled disc, half disc, open ring, faint dot**. That
progression survives greyscale, every kind of colour blindness, and a screenshot
at a third size. `blocked` is an *open ring* — waiting, never failed.

The legend teaches them, drawn with the map's own `NodeGlyph` so it cannot drift
from what it explains, and it sits **above** the map. It used to sit below the
full 1038px of the drawing, inside the drawing's own scroll container, and
explained the six bands rather than the four states.

### The lead node was drawn as an error

`isLead` drew a dashed ring around a node that — being by definition not `known`
— was already dashed or dotted for its state. Two nested dashed rectangles is
how every design system on earth draws *invalid*, on the one node the map most
wants you to walk towards.

It now has a soft breathing aura in its band colour **and a caption**: *"Start
here — 22 ideas rest on this"*, computed from `downstreamOf`. That sentence is
the whole argument for the map existing and it was previously reachable only by
clicking the right node and reading to the bottom of the panel. It names the
structure, never the person; "you are missing this" is a verdict and that tone
is what this product cannot survive.

Three emphases, three treatments, none mistakable for another: **lead** is the
band aura plus caption, **selected** is a crisp neutral ring, **highlighted**
(what the conversation or the walk is on) is a band ring. Those last two used to
arrive on one prop, which meant the walkthrough left the map dimmed to a single
cone for all twenty-three steps.

### The picture answers what rests on what

33 edges over 23 nodes, six of them crossing within forty pixels around
`attention`. Hovering did nothing; selecting did nothing. So the two questions a
prerequisite graph exists to answer were answerable only by tracing a curve with
a finger.

Focus a node and `focusOn` raises its ancestor and descendant cones and dims the
rest. **An edge counts only when both ends are in the same cone** — an edge from
an ancestor straight to a descendant bypasses the focused node, and lighting it
would claim the node is on a path it is not on. That rule is tested.

### Two faces

Geist stays for the interface. **Newsreader** carries the headings and the
tutor's voice. The tutor's turns are the only place this product speaks to a
person and they were set in the same face and size as a button label; being
spoken to in a text serif reads differently from being messaged in a UI face,
and that distinction is the whole job of the conversation panel.

Everything else comes off one type scale in `@theme`. There is no `text-[10.5px]`
any more.

### Surfaces, and the band that read as an alarm

Pure black and pure white gave the interface no way to separate the panel from
the map from the page. Three tonal levels now — warm paper on light, cool
near-black on dark — with `--surface-raised` carrying an inset highlight, which
is what makes a raised surface read as lit rather than as a lighter rectangle.

`behaviour` moved off hue 25. At that hue and chroma it rendered as a saturated
red-pink, so "Hallucination" and "What the model sees" read as error rows in a
table — which contradicts this product's own rule that red is reserved for
nothing. **The first attempt at the fix was itself rejected by the new test**:
hue 38 at chroma 0.135 was still inside the alarm range. It sits at 42 / 0.125,
and `language` moved 78 → 82 to keep forty degrees between the two warm bands.

### Two layouts, not one with a fallback

Below 1280 the panel is a **drag-handled sheet over a full-width map** with
three stops, rather than a stack. Stacking measured badly in both directions: a
tablet got 530px of map underneath a panel that hid it, and a phone split one
non-scrolling viewport into two unusable 250px halves. A sheet makes the split
adjustable by the person using it, which is the only thing that works at both
sizes.

The phone header is two 44px rows rather than three wrapped ones — **115px
instead of 330px**, and the subject keeps its name instead of truncating to
"How …".

Panel first in the DOM still holds. The page still never scrolls.

### `f` existed only in this file

`AGENTS.md` has described facilitator mode since the beginning — "press `f`,
then turn the screen around" — and calls it the mitigation for the largest risk
in the product. There was no `f` branch anywhere in `src/`. The validation gate
could not be run as documented.

It is implemented now, and hides the header, the legend, the marking buttons,
the probes, the misconceptions, and **the state badge** — which is itself a
mark, and showing someone "Not yet" against the idea they are being asked about
is exactly the grading the mode exists to prevent. Escape leaves it first, since
by definition every control that would is hidden.

### Both dialogs were lying to screen readers

`Welcome` and `Setup` were `role="dialog" aria-modal="true"` on plain `div`s.
That announces the rest of the page as inert while Tab walks straight into it,
with no focus trap and no restore. Both are real base-ui `Dialog`s now. The
tools drawer had the same shape of problem — a bare `div` with no roving focus,
arrow keys, type-ahead, escape or focus return — and is a real `Menu`.

That is a correctness fix, not a restyle.

### Two bugs this pass created and then found

Worth keeping, because both are the same class: **a CSS property silently
overriding an SVG attribute or a flex rule.**

1. **The reveal collapsed the map.** `edgewise-settle` animated a CSS
   `transform` on the same group that carried the node's positioning
   `transform` ATTRIBUTE. CSS wins, so on a fresh map all 23 nodes stacked on
   the origin and only the last one drawn was visible — and
   `animation-fill-mode: both` kept them there. Fixed by splitting into an outer
   group that positions and an inner one that animates. The verification is a
   count: 23 nodes, 23 distinct positions.
2. **The sheet rendered at the top.** As an ordinary flex child in a row it sat
   above the map, and — having no width of its own — grew to the width of its
   longest unwrapped line and ran off the screen. It is pinned
   `absolute inset-x-0 bottom-0` below the desktop breakpoint.

Neither was visible in the code and both were obvious in a screenshot, which is
this project's usual lesson in a new place.

### Motion

One duration set and one curve, in `globals.css`. Nothing overshoots. The only
two loops are the voice halo's breathe and the lead node's aura, and both answer
a question continuously — "can it hear me", "where do I start" — which is the
only thing that earns a loop.

`MotionConfig reducedMotion="user"` is not optional. Every hand-written
animation already respected `prefers-reduced-motion`, but `motion`'s own
transitions ignore it unless told, so half the system would have honoured the
setting and half would quietly not. Verified under emulation: no running
animations at all.

**Not** the View Transitions API, though Next 16 supports it. React's
`<ViewTransition>` activates on Transitions, Suspense or `useDeferredValue` —
"Regular `setState` calls do not trigger them" — and this app is one route whose
modes are `useState` on a client component. Every switch would need wrapping in
`startTransition`, and the `::view-transition` overlay would sit over the voice
halo and the map's pointer handling for the duration. `AnimatePresence` gets the
same crossfade without either.

### The band rail, dropped after seeing it

The plan had a segmented rail down the map's left edge showing the six bands as
areas. Built, rendered, and removed: **the bands are not contiguous down the
map** — `learning` spans layers 1–3, `networks` 2–4, `language` 2–7 — so a rail
draws overlapping regions and asserts a structure that is not there. The legend
popover and the per-node accent carry the bands instead.

### Measured after

Dark, seven widths, the same probe as before:

| | 390 | 768 | 820 | 1024 | 1280 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|
| Page scroll | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Header height | 115 | 57 | 57 | 57 | 57 | 57 | 57 |
| Map label px | 5.1 | 10.4 | 11.1 | 13 | 12.3 | 13 | 13 |
| Controls off-screen | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Controls below fold | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

390 is the phone overview, where the whole shape is deliberately preferred to a
readable label — tapping any node still opens its full text in the panel.

### Calibrating `explainBack` — and the fixture that was wrong, not the model

First run: **7 false passes in 60**. Inspecting them showed the fixtures were at
fault. "Updating parameters in the direction of the negative gradient" had been
labelled a parrot because it is jargon — but it states the mechanism, and this
product's own rule is that vocabulary is not what counts. Marking it a false
pass was asking the assessor to reject a correct answer for being well dressed.

So the class split rather than the test being relaxed:

- **`technical`** — correct mechanism, in jargon. **Must pass.** It holds the
  vocabulary-blindness claim to account from the opposite direction to `clumsy`.
- **`parroted`** — names and categorises without ever saying what happens.

The split confirmed the read: `technical` passes **12/12**. If the earlier
failures had been the model's fault, they would have persisted.

#### Baseline, 3 runs

| | |
|---|---|
| False passes | **2/71** |
| False blocks | **0/23** |
| Everyday words accepted | **12/12** |
| Jargon-with-mechanism accepted | **12/12** |
| Misconceptions flagged | **12/12** |

#### The one that still fails, and why it is not being tuned away

`hallucination/parroted` — *"a known limitation arising from the probabilistic
nature of autoregressive generation and from gaps in the training
distribution"* — passes 2 times in 3.

It is genuinely hollow, and it is also subtly **wrong**: the real mechanism is
that the objective never optimised for truth at all, not that the training data
had gaps. Someone reciting it could wrongly clear that one node.

It is left failing on purpose. Three rounds of prompt-tuning on the diagnostic
moved its failure rate 0 → 2 → 3 before the structural fix landed, and the
lesson from that is not to keep rewording until a number goes green. The
consequence here is contained — one node, wrongly marked, on the hardest
adversarial fixture in the set — and it is written down rather than hidden.

## Metering the free path

Two caps, both carried in the signed session token:

- **`FREE_TURN_CAP` (25)** — model-backed turns in one session.
- **`FREE_DAILY_CAP` (60)** — model-backed turns from one browser per day,
  stamped with a UTC date that rolls the allowance over.

The provider meters the shared free tier **per project, not per visitor** —
roughly 1,500 requests a day for everyone together. Without a per-browser cap,
one enthusiastic reader arriving from a blog post can spend a meaningful slice
of it and every other visitor that day sees "try again later".

**What this does not stop:** clearing site data resets the count, because with
no database the counter lives with the client. A deliberate trade — it stops the
ordinary case without standing up infrastructure the POC does not otherwise
need. The remedy for anyone who wants more is their own key, which removes every
cap. **Add a real store before this sees serious traffic.**

## Still open

- **`FREE_TURN_CAP` is 25**, sized for placement. Interruptions and explanations
  now share that allowance. The walk itself is free, so this is less urgent than
  expected — but a talkative session will still hit it.
- **Provider overload is now distinguished from quota** (`isOverloadError`).
  Google returns "experiencing high demand" as a plain API error affecting every
  model at once, so the fallback chain cannot route around it. Telling someone
  they have used their allowance when the service is merely busy sends them
  hunting for a problem they do not have.

## Working agreements

- **Run `pnpm calibrate --runs 3`** after any change to the prompt, the decision
  schema, or the model list. It is the only thing standing between a
  plausible-looking map and a meaningless one. A single run is not evidence.
- **Run `pnpm validate-graph`** after any edit to `content/graph.json`.
- **Run `pnpm test` and `pnpm typecheck`** before claiming anything works.
- **Report failures honestly.** The owner is debugging this with you, not being
  sold it.

## Risks to hold onto

- **Tone is the most likely killer, not model quality.** Being probed on what
  you do not know is uncomfortable, and voice makes it worse — you cannot skim
  back. "I don't know" and "skip" must always be valid, always advance the
  diagnostic, and never read as failure. Never a score, never a count.
- **A hand-authored graph encodes one person's model of the domain.** The edges
  have NOT been cross-checked against an established curriculum yet. Do that
  before anyone learns from it.
- **The free tier's shared rate limit is the real ceiling** — roughly 1,500
  requests/day for the whole project, so ~75 sessions/day across all users, and
  unmetered per user until a database exists.

## Gotchas already paid for in the sibling project

- **Next 16 renamed Middleware → Proxy.** A `middleware.ts` is silently ignored.
- **shadcn here is on Base UI, not Radix** — no `asChild`.
- **`.gitignore`'s `.env*` also matches `.env.example`** — the `!.env.example`
  negation is load-bearing.
- **Reasoning tokens count against `maxOutputTokens`.** Gemini models think
  first; a 220-token cap once left four characters of output. Budget ≥900 and
  enforce brevity in the prompt.
- **`pnpm build` regenerates Next's route types.** A new route fails typecheck
  until you build once.
