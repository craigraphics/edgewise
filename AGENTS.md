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

## Start here

**Read `docs/handover.md` before doing anything.** Where things stand, what is
in flight, which decisions are deliberate and should not be casually reverted,
what is waiting on the owner rather than on you, and the traps that have already
cost time. This file is the design record; that one is the state of play, and
acting on this one without it is how work gets redone.

Claude Code loads both automatically — `CLAUDE.md` imports them. Other agents
read this file by convention but will not follow the import, so open the
handover yourself.

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
- [ ] 14. **Verify voice on a real Android handset.** The Android failures are
       fixed against a test that models Chrome for Android's documented
       behaviour; nobody has held a phone. Use the deployed URL, not the LAN
       address — see "Android" under Voice.
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
pnpm test             # 291 tests: pure logic, plus the token contrast assertions
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

### Android: the whole voice design rests on an API Android does not implement

Reported from real use — *"phones do not record the audio of the user, I can
listen to the audio from the browser though."* Output working and input not is
the whole shape of it: `speechSynthesis` is real on Android, and
`SpeechRecognition` hands off to the platform recogniser.

**Chrome for Android ignores `continuous`.** The platform recogniser is one-shot
and stops at the first endpoint it detects. So "the pause window is ours, not
Chrome's" — the fix that came out of real use and the reason the listener has a
silence window at all — **does not hold there**. The recogniser stops on its
own, mid-answer, several times per turn.

Restarting it is the only way through, and `onend` already did restart. Four
things went wrong around that, and **every one of them was silent**: no error,
no exception, just a turn where someone spoke and nothing was registered. That
is the failure mode to hold onto — on Android this product looked like it was
ignoring people.

1. **The last result arrives on the way out.** Android commonly delivers a final
   result between `stop()` and `onend`. `finish()` fired `onEnd` at the moment
   it asked the recogniser to stop, so that result was thrown away — and, since
   the recogniser was still live and its `onresult` was unguarded, it landed in
   the *next* turn. Closing now waits for the recogniser's own `onend`, with a
   `CLOSING_MS` deadline so one that never ends cannot hang the turn.
2. **The restart ran inside `onend`.** Android needs the input back before it
   will take it again; a same-tick restart either throws `InvalidStateError` or
   succeeds and comes straight back. It is scheduled, `RESTART_MS` later.
3. **`start()` throwing left the turn open.** It reported `failed` and never
   delivered `onEnd`, so the interface sat on "Listening…" over a microphone
   that was never opened. **Every `start` now owes exactly one `onEnd`** —
   including the no-API and insecure-origin paths — and there is a test per
   route through the file saying so.
4. **The level meter was competing for the microphone.** `use-mic-level.ts`
   opens its own `getUserMedia` capture alongside recognition; its comment said
   "Chrome runs both on one microphone without complaint", which was measured on
   a desktop. On a handset they compete for one input through the platform audio
   stack and **the loser gets silence, not an error**. The meter is decoration
   and the recognition is the answer, so on a phone the meter does not open.

Two more that are about the handover rather than the recogniser:

- **`speechSynthesis.cancel()` returns before Android releases audio focus.** The
  hands-free loop speaks and then listens; a recogniser started inside that
  window opens against an output device still winding down, hears nothing, and
  ends on its own timeout. There is a `HANDOVER_MS` beat now, **on handsets
  only** — the desktop path is in use and working, and this project does not
  change validated behaviour without a measurement.
- **An insecure origin is not a blocked permission.** Chrome refuses the
  microphone off HTTPS and reports `service-not-allowed`, which the old copy
  rendered as "the microphone is blocked for this site" and sent you to a
  setting that is not the problem. It is exactly what happens when you open
  `pnpm dev` on a phone over `http://<laptop>:3000` to test voice, which is the
  only place anyone meets it. **Test voice on the deployed URL, not the LAN
  address.**

#### The rule underneath all of it: a voice turn never ends silently

Whatever the cause, a turn that heard nothing now says so. It used to close the
microphone and do nothing at all — no answer, no message, no error — which from
the learner's side is indistinguishable from being ignored, and is what an
Android session looked like end to end. `use-voice.ts` reports the existing
`no-speech` copy when a turn settles with an empty transcript and nothing more
specific to say.

#### Testable without a phone — `src/lib/voice/listener.test.ts`

`listener.ts` is a factory over `window.SpeechRecognition`, so a fake recogniser
driven by the test can model each of these behaviours exactly: ending itself
mid-answer, withholding interim results, delivering its final result after
`stop()`, refusing to start, never firing `onend`. 20 tests, no browser.

**It immediately caught a bug in the fix.** The first draft reseeded the silence
window on every restart, so the delay would not eat into someone's thinking
time — which made the window unreachable whenever the recogniser was ending
instantly, the exact case it exists to catch. A microphone held by something
else would have restarted for ever and never closed the turn. Measured in the
test: 33 recognisers over 8 seconds and `onEnd` never delivered. The gaps come
out of the window now.

**Still not verified on a real handset.** These are the documented behaviours of
Chrome for Android modelled in a test, which is a different and weaker thing
than a phone. `src/lib/voice/platform.ts` is a user-agent sniff, which is the
wrong tool for almost everything and the only tool available for these two
points — neither is feature-detectable, and the microphone conflict shows up as
silence rather than an error.

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
// paste into the console against the running app
const vh=innerHeight, vw=innerWidth, doc=document.documentElement;
const t=[...document.querySelectorAll('button')].map(b=>{
  const r=b.getBoundingClientRect();
  return {l:(b.innerText||b.getAttribute('aria-label')||'').trim().slice(0,24),
          h:Math.round(r.height), bottom:Math.round(r.bottom), right:Math.round(r.right)};
}).filter(x=>x.l && x.h>0);
const a=document.querySelector('aside');
const s=document.querySelector('section[aria-label="Concept map"]');
const edge=(e)=>e?Math.round(e.getBoundingClientRect().right):0;
({viewport:`${vw}x${vh}`,
  pageScrollV:Math.max(0,doc.scrollHeight-vh),
  pageScrollH:Math.max(0,doc.scrollWidth-vw),
  // The two that matter, and the two the first version of this probe missed.
  clippedRight:Math.max(0, edge(a)-vw, edge(s)-vw),
  panelTop:a?Math.round(a.getBoundingClientRect().top):null,
  under40:t.filter(x=>x.h<40).map(x=>x.l),
  controlsOffRight:t.filter(x=>x.right>vw+1).map(x=>x.l),
  controlsBelowFold:t.filter(x=>x.bottom>vh+1).map(x=>x.l)})
```

**`pageScrollH` is not enough on its own, and finding that out cost a shipped
bug.** The shell is `overflow-hidden`, so when a region is too wide the overflow
is clipped rather than scrolled — `scrollWidth` equals `clientWidth` and the
probe reports a clean zero while half the conversation panel is off the side of
the window. `clippedRight` compares each region's own right edge to the
viewport, which is what actually catches it.

**Run it after a resize, not only after a load.** The bug that motivated this was
invisible on a fresh load at every width and appeared only when a window that
had been wider was made narrower. See "Bugs this pass created" below.

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
   part you act in. *(The stacking threshold is now 1100, not 1280 — see "The
   breakpoint was measured on the wrong machine".)*
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

### Bugs this pass created and then found

The first two are the same class: **a CSS property silently overriding an SVG
attribute or a flex rule.** The last two shipped and were reported.

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

3. **The conversation panel was pushed off the right of the window.** This one
   shipped, and was reported rather than caught. The map's `<svg>` carried
   `width`/`height` ATTRIBUTES, which give it an intrinsic size — and a flex
   item's automatic minimum size is its content's min-content width. So the map
   region could never shrink below whatever it had last measured. On a fresh
   load at any width it was fine; widen the window and then narrow it, and the
   map stayed put and cut the panel in half. Measured: **116px of the panel
   clipped after a 1920 → 1300 resize.**

   Fixed by sizing the SVG from CSS (`h-full w-full`) so it has no intrinsic
   width at all, plus `min-w-0` on both regions. The viewBox already matches the
   pane's aspect ratio by construction, so filling it is exact.

   **The probe above did not catch it, and that is the more useful lesson.** It
   measured `scrollWidth - innerWidth`, and the shell is `overflow-hidden`, so
   the overflow was clipped rather than scrolled and the number stayed a clean
   zero. It also only ever ran on a freshly loaded page, and this failure only
   appears after a resize. Both gaps are closed above.

4. **The band accent hung off the corners of every card.** Also reported —
   *"the tile border breaks away from the container in strange ways."* The bar
   is narrower than the card's corner radius, so its left edge has to follow the
   card's own corner arcs. `accentPath` asked for those arcs with the sweep flag
   that puts the centre on the **outside** of the corner, and an SVG arc between
   two points admits two centres — so instead of hugging the card the arc bulged
   away from it and drew a wedge of band colour sticking out past the card's
   outline, top-left and bottom-left, on all 23 nodes.

   The path now states the arc by its endpoints — the bar's corner sits exactly
   where the card's corner circle crosses `ACCENT_WIDTH` — and lives in
   `src/lib/map/layout.ts` with the rest of the geometry, so it is testable. The
   test asserts what actually broke: every point the path names is inside the
   card, and the two it shares with the corner radius sit on that circle.

Neither of the first two was visible in the code and both were obvious in a
screenshot. The third was invisible in both, and only a measurement aimed at the
right quantity would have found it — which is this project's oldest lesson,
turning up again. The fourth was the reverse of the third: plainly visible on
screen at any size, and passed over anyway because nothing was measuring the
shape of the drawing itself.

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

### The second review — hierarchy while answering

The first review was about the map. This one was about the flow, and it found
three things that were defects against rules this file already states.

#### "0 of 23 solid" was a score

It sat in the header from the first frame, beside a circular indicator, before
anybody had answered anything. **This file's own risk list says "Never a score,
never a count."** The first thing a learner met was a tally of what they did not
have.

A count is fair once it describes something they have actually done. Before
then the header says **Finding a place to begin**. The same sentence had leaked
into the pre-answer lead card too — *"which is why so much of the rest probably
feels slippery"*, shown to somebody who had answered nothing — and is now
structural only: *"22 of the later ideas build on this one."*

#### The question could scroll out of view

*"What you look at while listening does not move"* held for the progress line
and the current concept, and not for the one thing the learner was being asked.
Everything lived in one scroll container which auto-scrolled to its end, so a
long turn put the top of the question above the fold and somebody had to scroll
up to find out what they were answering.

The live turn is now pinned outside the scroll container and only the history
moves. The composer also stops being bottom-anchored while there is no history:
question and answer field were six hundred pixels apart on the first turn, which
is the two things somebody needs at once at opposite ends of the panel.

#### One "I don't know" ended the session, and then interpreted their life

Deterministic, and correct as far as the traversal goes: a single "I don't know"
on the root leaves the root not-known, `nextToAsk` will not descend past a node
in that state, and nothing else is askable. The problem was everything around
it. The ending did not say why it had stopped, so it read as the product
breaking its own promise of "a few questions" — and the closing then told the
learner *"which is why so much of the rest has probably felt slippery"* on the
strength of one answer.

`src/lib/session/closing.ts` now splits the sentence in two. The structural half
— *"eleven of the later ideas rest on this one"* — is always said, because it is
true the moment the frontier is known and it is the thing a chat assistant
structurally cannot tell anybody. The interpretive half is held back until at
least three answers are behind it, and the one-answer case says plainly why it
was enough: *"That one answer is enough, because everything else on the map
rests on it."* Tested, including that the interpretation never appears without
the structure that grounds it.

#### The breakpoint was measured on the wrong machine

`SHEET_QUERY` was `max-width: 1279px`. A 14-inch laptop reports about **1230**
CSS pixels of viewport, so the two-column layout never appeared on the most
common screen this will ever be used on: everybody got the sheet, and a sheet at
full desktop width reads as a phone pattern stretched — which is exactly how it
was described in review, and I had put that finding down to the reviewer's
window until measuring `innerWidth` on a maximised one.

It is 1100 now, the panel went from 22rem to 28rem, and the number is named
once: `--breakpoint-panel` in `globals.css`, matched by `SHEET_QUERY`. **Moving
one without the other renders the panel on top of the map**, which is what
happened in between — the layout is chosen in JavaScript and drawn in CSS, and
nothing had been holding those two numbers together.

#### Two colour systems, one signal

Four state glyphs, six topic-family hues and a blue focus ring were competing on
twenty-three small cards, and only one of those vocabularies is about the
learner. The band accents dropped from 1 / 0.75 / 0.55 / 0.3 to 0.72 / 0.5 /
0.36 / 0.2 and the `known` tint from 0.14 to 0.10. **State is the signal; the
band is grouping**, quiet enough to be noticed on purpose and not before, with
the `6 parts` control there for anybody who wants it.

Edges went the other way — `/38` and `/12` to `/50` and `/22`. At the old values
the dependency structure was nearly invisible in dark mode and the map read as a
wireframe of floating cards, which loses the only thing the drawing is for.

#### Three states, not one layout showing everything

While somebody is answering, the mode switch and the legend recede to 45% and
come back on hover or focus. Nothing is removed: a control that vanishes is one
they then have to hunt for, and offering "Teach me everything" at full strength
beside a half-answered question is an invitation to abandon it.

### What an outside design review changed

A second model reviewed `/`, `/intro` and `/lab` without repo access. Three of
its findings held, and two of those were things nobody working on this had seen.

#### Dimming was an accessibility failure, not a style

Focus used to drop everything outside the cone to 22% opacity. Measured against
the real tokens that is **1.62:1** in light and 1.84:1 in dark — under the 3:1
floor for a non-text graphic, on labels placed at 17.66:1 and then multiplied by
0.22 at runtime.

The part worth keeping is that **no opacity fixes it**. At 0.65 — barely dimmed
at all — the muted foreground that every `unexplored` node uses, which is most
of an unmarked map, is still at 2.79:1. Recede and legible are not both
available on one dial, so the fix had to be structural: nothing recedes, the
focused path is *raised* instead — a ring on its nodes, brighter and heavier
edges, and only edges allowed to soften, because an edge carries no text.

There is a second reason that would matter even if the numbers had passed. This
is a map of what somebody does not know yet. Making the parts they have not
reached disappear says excluded rather than ahead, and removes the comparison
the view exists to support.

`src/lib/map/focus.ts` holds the treatment and `focus.test.ts` holds the rule:
**focus must never lower a label's contrast**. Reintroducing a dim fails there.

**Why the existing contrast tests missed it.** `globals.test.ts` measures the
design — every label against the card it sits on. The defect was in the runtime,
where the whole group got an opacity the tokens never saw. Third time this
project has shipped something because the measurement was aimed at the wrong
quantity.

#### `/intro` was delivering a verdict to someone who had not spoken

It said "One of them is where you stop", spotlit a real node, and closed with
"which is why so much of the rest has felt slippery" — to a first-time visitor.
On a product whose own risk assessment puts *being diagnosed feeling like being
graded* ahead of model quality, that converts the whole thing from help into an
assessment before the offer has been made.

The reasoning that the marks were only an illustration existed in a comment in
`overture.ts` and never reached the screen. That is the failure, restated: the
honesty was in the source and the claim was in the interface.

Now the dive is captioned "An example / Somebody stops here", a persistent
**ILLUSTRATIVE MAP** badge is up for the whole time a node is singled out, and
the sequence closes on the product's own sentence — *"You cannot ask a good
question about something you do not understand yet"* — followed by the offer
rather than by a finding.

`overture.test.ts` asserts both halves: every caption said over a spotlit node
is marked illustrative, and **no caption anywhere matches a list of phrases that
presume the viewer's state**. The old copy fails that test.

#### What was refuted

Two findings did not survive contact with the source, both because the reviewer
could not read it:

- *"Abandon the 640vh scroll as the primary entry."* `/intro` is not the entry
  and nothing links to it. The recommendation inside it — a short first-run
  version — was good and was built, but as an addition.
- *"The CTA returns after a long, mostly faded sequence."* Measured, the longest
  caption-free stretch anywhere is 0.053 of the scroll and it is in act two.

Also disputed and kept: **"Start here — 22 ideas rest on this" is not a
verdict.** It names the graph, never the person, and it is true in both states —
with no marks the lead node is the root, so it says "start at the beginning".
The proposed replacement traded a true specific sentence for a vague one.

### The prelude — the first ten seconds

`src/components/overture/prelude.tsx`. The same map assembling in the same
prerequisite order, three sentences, about twenty-two seconds, skippable from
the first frame — then the welcome dialog, which carries the parts that cannot
be shown: the three-step flow and the two rules nobody would guess.

One gate and one storage key for both. Two separately dismissed first-run
screens is two modals in a row, and dismissing one would bring the other back on
the next visit.

**It stops before the dive.** Singling out a node is the part that has to be
earned by answers, so the thing shown in somebody's first ten seconds makes the
structural argument and then offers.

It shares the timeline rather than copying it: `/intro` scrubs `t` from the
scroll, the prelude runs the identical functions on a clock. One description of
how the map assembles, two readings of it, no drift.

Two things found by running it:

- **The first painted frame was uncomposed.** The camera was seeded on the next
  animation tick, so the opening shot appeared for one frame as a small box in
  the corner. `overture.test.ts` already asserted the opening frame is composed;
  that was true of the timeline and not of the pixels. It is now set in the same
  layout pass that measures the stage.
- **A background tab would skip the whole thing.** Timing from a fixed start
  timestamp means the first frame after somebody switches to the tab carries the
  entire wall-clock gap, so the sequence completes instantly and they meet the
  dialog having been shown nothing. Time is accumulated from clamped frame
  deltas instead, so a paused tab pauses the sequence.

### The lab, after review — five effects, each with a trigger

Down from eight. Magnetism and aurora went because neither helped anyone read
the graph and both worked against the composure the interface is built for;
press went because "harmless" is not a reason to keep something.

Each surviving effect now carries two fields, and they are the point:

- **`claim`** — what the movement asserts. An effect that cannot finish "this
  moves because…" is decoration on a diagram people make decisions from.
- **`trigger`** — the only thing allowed to fire it in the product.

The trigger field exists because of the sharpest thing in the review: **the
unlock wave is honest exactly when a learner's own explanation moved a node, and
dishonest the moment it fires because they were taught something.** That is a
wiring decision somebody will make in a hurry later, so it is now structural
rather than documented — `src/lib/map/unlock.ts` takes the model before and
after and works out whether anything actually became `known`. Wiring the wave to
"the walkthrough covered a node" produces no wave, because covering changes no
state, and there is a test that walks the entire twenty-three-step teaching
order asserting exactly that.

### The overture — `/intro`, the argument as a sequence

The product's premise has only ever been *stated*: a first-run dialog says
twenty-three ideas each rest on the ones before them, and asks someone to
believe it before they have seen anything. But the graph is not a claim needing
assertion — it is a shape, and a shape can be shown. `/intro` builds the map in
front of you in prerequisite order, then flies to the one idea a gap sits under
and shows what is stacked on top of it.

Five acts, scroll-scrubbed:

| | |
|---|---|
| **one** | One node, alone, most of the screen. *"It starts with one idea."* |
| **chain** | Every layer arriving in prerequisite order, the edge drawn before the box lands on it, camera pulling back the whole way |
| **terrain** | The whole map, held still, bands named down the left edge |
| **block** | A dive to the lead node, everything else receding — then back out onto its cone |
| **turn** | *"10 later ideas rest on it"*, and the way in |

#### It is one function of one number

`src/lib/map/overture.ts` takes `t`, the scroll progress, and returns the
camera, every node's and edge's reveal state, and which sentence is being said.
That is not tidiness, it is what makes the thing trustworthy:

- **No second clock**, so it cannot drift out of sync with itself, and scrubbing
  backwards runs the sequence in reverse as faithfully as forwards.
- **Nobody is held hostage** — no autoplay, no hijacked scroll. Stopping halfway
  leaves a composed frame rather than a half-finished animation.
- **It is testable without a browser**, which is the only reason a five-act
  cinematic can be trusted not to lose a node in the middle of act two.

The tests are about the argument, not the arithmetic: layers reveal in strictly
increasing order; an edge is always drawn before the node it points at; every
node has arrived before the wide shot claims to show the whole subject; the
frame you land on is already composed; no two captions are at full strength at
once; and — the one that has caught the most — **the camera never jumps**, which
is checked by walking the whole scroll in thousandths and asserting the frame
never moves more than a fiftieth of what is on screen.

#### Nothing here decides anything

The layout, the states, the lead node and the count all come from the same code
the real map uses. `overtureModel` sets the marks the story is told against and
`leadNode`/`downstreamOf` do the rest, so the closing line's number is computed
rather than written down. A page that hard-codes "10" ends up claiming something
the graph stopped saying three edits ago.

Those marks are chosen, and the reason is tone: **an empty map's lead is the
root**, so telling the story against a blank learner would open the fourth act
by informing a first-time visitor that they know nothing, in forty-point type.
It is told instead about someone who has the foundations and one gap under them
— the classic one, where "a neuron is like a brain cell" has been standing in
for a mechanism for years. There is a test asserting the dive never lands on the
root.

#### The bug worth keeping

**`motion` writes its own `transform-origin`.** The camera is one CSS transform
on one group — content coordinates in, stage coordinates out — and setting
`transformOrigin` by hand next to `x`/`y`/`scale` is silently overwritten with
the default `50% 50%`. So the camera scaled about the middle of the *drawing*
rather than about the content origin, and every shot at any zoom but 1x was a
few hundred units off to one side.

It never looked broken. It looked like compositions that would not quite
centre — the kind of thing that gets called a taste problem and tweaked at
forever. The fix is `originX: 0, originY: 0` (motion's own props) plus
`transform-box: view-box`. Three carefully-judged framing decisions made before
finding it turned out to be judgements about a broken camera, and had to be made
again.

#### Reduced motion

Not a degraded version of the film — the same argument as a page. A still map
and the five sentences in order, with the same link at the end.

### The motion lab — `/lab`, a POC and not the product

The map was judged "good but a little boring", and the fair reading of that is
that the motion system was written to be composed and succeeded at it. So
`/lab` is where the opposite case gets made: the same graph, the same states,
the same layout, the same tokens — **only the drawing differs** — with eight
effects that can each be switched on and off while looking at it.

It is a separate route and a separate renderer (`src/components/lab/`).
`concept-map.tsx` is untouched, because the shipped map is the artefact the
whole thing is being judged on and an experiment that can break it is an
experiment nobody runs honestly. It is not linked from the header: a testing
harness in the main navigation is a mistake this project has already made once.
It also carries a local learner model, so nothing done in there can change what
the real map says about anybody.

What is **shared** rather than copied is everything that decides what is true —
the layout maths, the state rules, the relations, the new cascade traversal. An
effect that needed its own idea of the graph would be an effect saying something
the graph does not.

| Effect | What it is saying |
|---|---|
| Cascade | The cone lights outward a step at a time, so the chain resolves in front of you rather than arriving whole |
| Current | Which way an edge points, without 33 arrowheads on a crowded map |
| Light pool | Where you are looking |
| Magnetism | The map is live. Says nothing about the graph — pure personality |
| Press | The box took the click |
| Camera glide | You did not teleport; selecting travels to the node and deselecting comes back out |
| Unlock wave | Marking an idea solid opened a chain, and the wave travels through the dependants in order |
| Aurora | Mood only |

Two of those are the ones worth arguing about. **Cascade** is the only effect
here that carries information a still picture cannot: `focusOn` can say which
nodes are on a path through this one, and nothing but time can say in what
order. **Magnetism** and **Aurora** are honestly decorative, and are labelled as
such in the panel next to their own switches, so the judgement being made is "is
that worth it" rather than "do I like it".

#### The rules it deliberately breaks, and the one it does not

`--lab-spring` overshoots, and the sonar, the current and the aurora all loop —
both of which the shipped system forbids, on the stated grounds that a springy
interface reads as pleased with itself while telling someone what they do not
know. That claim has never been tested against the alternative. This is the
test.

What it does not break is reduced motion. Every `lab-` animation is switched
off under `prefers-reduced-motion`, the same as the shipped ones, and the panel
says so when it detects the setting.

#### Two things measured while building it

- **The aurora was first built at 0.5 opacity and was wrong.** It stopped being
  atmosphere and became the subject — the map read as sitting on a lava lamp,
  and the light pool had nothing left to say "you are looking here" against. It
  is 0.14 now. Worth keeping because it is the failure mode of this whole
  direction in miniature: an effect that is individually pleasant and collapses
  the thing it sits behind.
- **Magnetism at its first strength was invisible.** Measured: a 1.5% scale and
  a 1px lean on the nearest node, which is not personality, it is noise. The
  lean is now capped at 6 units against a 20-unit gap between neighbouring
  cards, so two nodes leaning towards each other still cannot touch. A map whose
  boxes can overlap has stopped being a drawing of the graph.

#### `cascadeFrom` — `src/lib/map/cascade.ts`

Pure, and tested against `focusOn` rather than on its own: the two must always
agree about membership, or the map animates one set of relationships and then
leaves a different one lit. The tests also hold the direction honest — an edge
never lights before both of its ends, and an edge only counts as upward when
both ends are prerequisites of the focused node.

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
- **Voice on Android is fixed against a model, not a phone.** The listener now
  handles the one-shot recogniser, the result that lands on the way out, and the
  microphone the level meter was stealing — all covered by
  `listener.test.ts` — but every one of those is Chrome for Android's
  *documented* behaviour reproduced in a fake. Hold a phone before believing it.
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

## Recognition-first proposal — 2026-09-11

Branch `proposal/recognition-first`, based on `intro-from-main` at `4041bdb`.
The owner authorized a working redesign and explicitly allowed changing recorded
product decisions. See `docs/recognition-first-review.md` for findings and checks.

Three decisions superseded in this proposal:

- **First entry has no gate.** The prelude was still an untrapped `aria-modal`
  div: Tab after Skip reached the hidden mode switch, verified in BrowserOS neo.
  More fundamentally, a 22-second sequence, a welcome dialog, and an idle start
  screen repeat the invitation three times. Sharing one storage key does not
  remove those steps. The argument now sits beside the actual start action.
  `/intro` remains a separate, optional narrative, with a text alternative.
- **A phone map is a reading surface.** The recorded 5.1px overview labels are
  too small to identify a target before tapping. A full-width list, derived from
  the same graph and teaching order, names every prerequisite at normal text
  size. The diagram remains available. Below the existing 1100px threshold the
  map and guide are explicitly selected full-size views; there is no drag sheet.
  This avoids both rejected stacked half-panes and a map hidden under a sheet.
- **Remove the score, including its accessible label.** The old progress ring
  still announced “0 of 23 ideas solid” when the visible text omitted the count.
  No global score remains, at any stage. The next useful idea carries progress.

The diagnostic, assessment prompts, graph edges, state semantics, authored
explanations, and motion lab's five effects are retained. Retry stores the exact
failed payload; reset aborts and invalidates old requests. Typed drafts live in
the shell so opening an idea does not erase them. The map now names prerequisite
relationships in its inspector as well as drawing them.

The welcome's “Nothing is sent anywhere” claim was false for both answers and
voice. The actual server/Google path is stated next to the invitation, and voice
explains its automatic microphone handoff before opt-in.

These changes are a proposal, not evidence of improved conversion. The real
learner validation gate remains open. Browser accessibility-tree and keyboard
checks do not replace a VoiceOver/NVDA session or physical-phone voice testing.

### Playable map proposal — 2026-09-11

On `proposal/playable-map`, after `proposal/recognition-first`. The owner asked
for the proposed focused neighbourhood and playable neuron to be implemented.
The first map view now shows one concept and its immediate prerequisite and
dependant links; Full map and List remain available. This changes the default
presentation, not the graph or what any mark claims.

The neuron experiment uses two fixed inputs, two adjustable weights, a fixed
bias, and ReLU. Predict → run → inspect the arithmetic → optionally explain it
back. It is deliberately a choice alongside the diagnostic, not a prerequisite
for it. The experiment has no learner-model access. Only the existing assessor
and upgrade path can earn a mark; hand marking remains explicit facilitator work.
This follows the recorded objection to dishonest unlock waves: downstream
concepts keep their actual states. No points, locked levels, or fabricated mastery.

Weights/results survive view changes, and returning from the experiment keeps
an unfinished explanation. Explanation requests abort on unmount and time out
at 45 seconds; a delayed result after reset cannot recreate old marks. The toy
model names its limitations, including that adjusting weights here is manual
and nothing is training. See `docs/playable-map.md` for verification and limits.

### Side-panel scroll correction — 2026-09-11

The owner found that lower side-panel content was unreachable. The inspector
and idle conversation both nested a scrolling child inside the scrolling guide;
the outer panel and its padding had no scroll range. Static content now has its
natural height and the guide is its single scroll owner. The guide keeps a stable
scrollbar gutter. The walkthrough deliberately retains a separate reading area,
but it now has a 128px minimum: at 720×450 it previously collapsed to 0px beneath
the fixed controls. The outer guide can scroll to those controls when necessary.

Earlier checks emphasized horizontal overflow. The regression check must also
reach the final control/last response after expansion and resizing. Browser
checks now verify actual wheel scrolling and End-key reachability, including an
open explanation at 320×568, 390×600, 720×450, 1100×600, and 1440×720. A long
mocked explanation response remains reachable, with learner marks unchanged.
323 tests, lint, typecheck, and the production Webpack build pass.

### Required branch isolation for future experiments

The owner requires every experiment session to create its own branch before
editing, and deliver its own PR for independent review and merging. Never
implement experiment work on `main`, `proposal/playable-map`, or another
session's branch. Historical instructions to continue on this proposal branch
are not permission to share it for new experiments. Use separate worktrees for
concurrent sessions. Base experiment branches/PRs on the proposal while it is
unmerged, and on updated `main` after it merges. Verify the active branch before
editing and committing; push only the session's own branch.

### Tokenizer playground — 2026-09-11

On `experiment/01-tokenizer`, branched from `main` after the playable-map
proposal merged. An experiment on the `tokens` node, built to the same rule as
the neuron: change something, inspect the consequence, optionally explain it.
See `docs/tokenizer-playground.md` for the verification table and limits.

**A real encoding, named on screen.** `js-tiktoken` 1.0.21 pinned, `cl100k_base`,
in a Web Worker in the browser. No key, no request — measured: typing produced
zero fetches, zero XHRs, no resource loads. The panel states what the count is
not: not universal, not a word count, not Gemini billing, not Edgewise's own
assessor. A load failure says so and offers retry; there is no fallback count,
because a fabricated number is exactly the lesson this node exists to correct.

**Byte fragments are shown as bytes.** A byte-level encoding puts part of a
character in a token. Those render as `bytes E8 AA` with their own IDs rather
than `�`. Tidying the display would misrepresent the mechanism being taught.

**The examples compute their results, and that immediately paid.** The node's
authored explanation asks why a model miscounts the r's in "strawberry". In
"How many r's are in strawberry?" the piece is ` strawberry`, a **single** token
(73700) — so the folk claim that strawberry is three tokens is wrong in that
position. Hardcoding it would have taught a false specific on the node about not
trusting surface claims.

**Marks are untouched by everything here.** No learner-model access. Typing,
selecting, resetting and finishing leave the stored model unchanged, checked
before and after. The follow-up question opens the existing `ExplainBack` with an
empty field and a disabled submit; only the existing assessed path can raise this
concept.

**The fixtures are held to the vocabulary, not to the encoder.** IDs and bytes
are asserted against `bpe_ranks` decoded independently in the test, so the
expectations and the implementation cannot be wrong in the same way. This is the
"test the wrapper against itself" trap, closed deliberately.

**The 28px chips.** Measured at 320px, the example buttons came out at 28px under
`size="sm"` — below the 40px floor this file records for finger targets. They are
`size="touch"` now. Sixth time a defect in this project was found by measuring
rather than reading, and the rule it broke was already written down.

**Worker construction moved out of the effect body.** The first version called
`setState` synchronously in an effect when `new Worker` threw, which fails
`react-hooks/set-state-in-effect`. The worker is now built on first use inside
the debounce callback, so a browser that cannot start it reports through the same
asynchronous path as one that fails later — a better shape, not just a lint fix.

**One invitation per view.** The focused map's general neuron invitation now
stands down on `tokens`, where that node's own experiment is the offer. Both
rendered together before, stacking two unrelated calls to action.

### Learning from examples — a real fit, not a prewritten answer — 2026-09-11

On `experiment/02-learning-from-examples`, branched from `main` after the
tokenizer merged. An experiment on `prediction-from-examples`, built to the same
rule as the neuron and the tokenizer: change something, inspect the consequence,
optionally explain it. See `docs/learning-from-examples.md` for the verification
table and the limits.

**The model is fitted, not chosen.** `src/lib/experiments/regression.ts` runs
ordinary least squares over whatever examples are in the list. No button selects
a prepared result; every number on screen — the two parameters, each row's
prediction and miss, the average and worst miss, and the answer at a new
distance — is computed from those examples. Editing a time to 45 moved the rule
from `12.9 + 2.92d` to `32.6 + 1.15d`, measured in the browser.

**The fit is a snapshot, deliberately.** Changing a label changes nothing until
"Learn from these examples" is pressed, and until then the panel says so in
words: *"The examples have changed. The rule below still comes from the old
ones."* While stale the line is removed from the drawing and the prediction is
withheld rather than recomputed. A rule that moved the instant you typed would
hide the one step this node is about.

**What stays fixed and what can change is stated, because it is the lesson.** We
choose the family, one straight line. The fit works out its two numbers from the
examples. That explanation is at the top of the panel, not in the optional
algebra, and the closing question is the node's own: *"If nobody typed the final
rule, where did this model's predictions come from?"*

**An underdetermined fit is reported, never filled in.** Two cases: fewer than
two complete examples, and every example at the same distance. Both leave the
slope genuinely undetermined — every rate fits equally well — so `fitLine`
returns `status: 'undetermined'` with the reason and the panel says which.
Inventing a slope, or dividing by a near-zero spread and printing whatever came
out, would teach the exact thing this node exists to correct. There is no path
that can produce `NaN`, and a test asserts it over the awkward datasets.

**The contradiction is reachable in one tap and is not discarded.** "Same
distance, different times" puts the same input in twice with different observed times. One rule
returns one number for one distance, so both duplicates get the same prediction
and at least one must miss; the callout says both observations influence the
line, and both misses show on their rows. In this preset the fitted value lands
between them and the residuals are equal and opposite, which is asserted rather
than described; the learner-facing copy does not claim that every editable
dataset must behave that way.

**The four presets are the four cases.** Inexact, exact, contradictory, and
undetermined — and a test holds each preset to being the case it claims, so
editing the numbers later cannot quietly turn "exactly on a line" into something
that no longer is.

**The fixtures are held to least squares, not to the function that produced
them.** The noisy case checks that nudging either parameter off the answer makes
the total squared error larger, and that the residuals sum to zero and are
orthogonal to the input. Asserting the encoder against itself is the trap the
tokenizer work closed; the same trap is closed here by a different route.

**Nothing here touches the map.** The component has no learner-model access.
Editing, fitting, resetting, and reading predictions at new distances all leave
storage untouched, read before and after. One real explanation was then checked
through the existing API and marked **only** `prediction-from-examples` Solid —
verified by reading stored state, which held exactly that one entry.

**Half-typed rows are excluded, not guessed at.** A number field can genuinely be
empty (`number | null`), and a row missing either value says so and is left out
of the fit. The alternative — snapping a cleared field to zero — would silently
add an observation nobody made.

**Round half away from zero.** `Math.round` breaks ties towards positive
infinity, so a miss of −2.45 and one of +2.45 printed as different sizes in the
same column. The magnitude is rounded and the sign put back.

**The per-concept branching became a lookup table.** The shell branched on
`'neuron'`, then on `'neuron' | 'tokens'`, in five places. A third made that
unreadable, so `src/lib/experiments/registry.ts` holds the ids and the four
strings the shell needs, and `FocusedMap` takes one `onPlay`/`onExplain` pair
instead of one per experiment. That is fewer conditionals than before, not more;
adding a fourth still means writing its component and rendering it explicitly. A
test holds every id to being a real graph node and every prompt to asking for a
mechanism without grading.

**No animation at all in this panel**, so reduced motion has nothing to suppress
— confirmed by reading `document.getAnimations()` with the experiment open.

**The `Input` primitive is 32px.** Below the 40px finger target this file
records, so the number fields carry `h-10` explicitly. Measured at 320px: every
control in this panel is at least 40px.

**Dragging is never the only way.** The new distance has a native range slider
*and* a number field, and the slider's `aria-valuetext` carries the prediction so
a screen reader hears the consequence once per committed change rather than on
every frame. Nothing on the drawing is draggable.

### The representation playground — two encodings, one collision — 2026-09-12

On `experiment/03-representation`, branched from `main` after the predictor
merged. An experiment on `features-and-representation`, built to the same rule
as the neuron, the tokenizer and the predictor: change something, inspect the
consequence, optionally explain it. See `docs/representation-playground.md` for
the verification table and the limits.

**The collision is the instrument.** Two 4x4 black-and-white pictures, and two
ways of turning them into numbers: the mean of the sixteen cell values, or all
sixteen in their declared order. The opening pair is a filled top half against a
checkerboard — eight white cells each, nobody would confuse them, both arrive as
**0.5**. Switch encoding and the same two pictures differ at eight of sixteen
positions. Both numbers are computed from the cells on screen; nothing selects a
prepared answer.

**"Information is lost" is given as a count, not asserted.** `sharingPictures`
reports how many of the 65,536 possible pictures produce exactly this encoded
data: **12,870** for an average of 0.5, **exactly 1** for any ordered list. The
extremes are the honest exception and are shown rather than hidden — all-white
and all-black are each produced by one picture, so a single number does separate
those. An encoding is not lossy by nature; this one is lossy in the middle. That
count is tested against a **brute-force enumeration of all 65,536 pictures**,
which is the "do not assert the encoder against itself" trap closed by a third
route.

**Rearranging is the second half of the argument.** A quarter turn moves every
cell and adds none, so the average cannot move and the ordered list must. The
panel reports what happened rather than claiming it: a symmetric picture gets
*"looks the same after a quarter turn, so both encodings are unchanged too"*.
Claiming a change that did not occur, on the node about not trusting surface
claims, would teach the opposite of the node.

**Immediate feedback, no prediction step.** The neuron asks for a prediction
because it has one arithmetic result worth committing to. Here the interesting
move is flipping a cell and watching the collision appear or break, so every
change shows at once and nothing is gated behind a guess.

**The two cell colours are deliberately not theme tokens.** This panel is about
brightness values, so a cell worth 1 has to read as white in both themes;
letting dark mode swap them would make 1 the dark value and contradict the
arithmetic printed beside it. That exemption puts them outside
`globals.test.ts`, so `representation-contrast.test.ts` holds them to a number
instead — **17.33:1**, both directions, plus a test that fails if either is ever
redefined under a theme. Each cell also prints its own value as a digit, so the
grid survives greyscale.

**A `sr-only` span made the whole page scroll.** Each grid carried a visually
hidden summary. Tailwind's `sr-only` is `position: absolute`, and with no
positioned ancestor its containing block sits **above** the shell's
`overflow: hidden` — so the shell does not clip it. Laid out at its static
position deep inside a scrolling pane, it extended the document's own scroll
area: **1602px of page scroll at 320x568**, against this file's oldest layout
rule. Invisible in the code, invisible on screen, and caught only because the
probe measures the right quantity and the predictor panel on the same shell
measured a clean zero as a control. The spans are gone — they duplicated a count
already printed and, being outside any live region, announced nothing on change.
**The rule to carry forward: `sr-only` inside one of this app's scrolling panes
escapes the shell's clip.**

**Roving tabindex on the grids.** Thirty-two cells would have been thirty-two tab
stops. Arrow keys move, Home and End jump, Space and Enter flip — the standard
grid pattern, and every cell is still a plain button carrying its row, column and
`aria-pressed`, so nothing depends on a custom role being interpreted correctly.
Measured: 12 tab stops through the panel in one-number mode, 28 in list mode,
every one scrolled into view at 320x568 and 720x450.

**Marks were checked against a populated model, not an empty one.** With ten
marks loaded — including this node's prerequisite and three of its dependants —
flipping cells, choosing positions, turning a picture and switching encodings
left the stored model byte-identical. An empty model would have proved much less.

### Learning a rule, or using one — 2026-09-12

On `experiment/04-training-vs-inference`, branched from `main` after the
representation playground merged. An experiment on `training-vs-inference`, in
the predictor's own delivery setting so there is no new story to learn. See
`docs/training-vs-inference.md` for the verification table and the limits.

**The rule is stored, and the answer function cannot see the data.**
`answerWith(learned, distance)` takes a rule and a distance; the delivery rows
are not in scope. So "using the rule cannot change it" is the shape of the
function rather than a promise in a comment — which is the same structural move
as putting a required field before `verdict` in the assessor schema, applied to
a panel instead of a prompt. The fitting is `regression.ts` unchanged: this node
is about when that step runs, not how it works.

**Refusing to learn beats learning badly.** `learnability` answers whether
pressing the button would do anything, and the button is disabled with the reason
in words when it would not — unchanged deliveries, fewer than two complete rows,
or every remaining row at one distance. Refusing *before* the attempt is why a
rule already in hand can never be destroyed by an emptied field, and it is why
`Learned.fit` is a `FittedModel` rather than a `FitResult`. There is no state in
which the panel holds an undetermined rule, so there is no copy to write for one.

**The distance is held while the two rules are compared.** Both are read at one
distance, so the cause of the difference cannot be the question. The slider and
the number field are disabled for that stretch, with the reason beside them and
an explicit way out in the tab order. Two answers at two distances would not be
a comparison of two rules.

**Two rules can agree at one distance.** They cross. `compare` reports `same`
there while still reporting that the rate moved, rather than printing a
difference of zero as a change. The threshold is 0.05 minutes, under the 0.1 the
panel prints, because a change nobody can see is not a change.

**The names come last, and the limit is stated.** "Learning a rule" and "using
the rule" carry the whole first half; training and inference are introduced only
once the difference is on screen. That card then says *"This is the common setup,
not a law"* — models are retrained, and some are handed documents at the moment
you ask. Claiming no system ever learns during use would be a new misconception
planted on the node whose job is removing one.

**A shipped contrast defect, found by a test written for the new panel.** Both
experiment readouts painted their value card as a 10% tint of their own band and
put band-coloured text on it. Measured: **4.18:1 in light mode**, under AA, and
no tint that still reads as a tint reaches 4.5. Exactly the map-node failure this
file already records — text sitting on the band colour, twenty-four combinations
none of which had been measured — reappearing in a place `globals.test.ts` did
not look, because that block only ever covered `foreground` and
`muted-foreground` on the plain surfaces. The card is a plain surface now in
**both** panels; the predictor had it first and shipped with it. Three
assertions per theme hold it, including that the card still separates from the
readout behind it.

**The number field was 22px wide at 320px.** With the field free to shrink, the
row's label took the width. Seventh time a defect here was found by measuring
rather than reading, and the rule it broke was already written down.

**`NumberField` is now shared** by the predictor and this panel. Its `h-10` is
the 40px finger-target lesson, and duplicating that across two files is how a
measured lesson gets lost.

**Nothing here touches the map.** No learner-model access. Reading answers,
editing deliveries, learning again, answering the optional question and resetting
all left storage at zero keys, read before and after. One real assessed
explanation then cleared **only** this node, with the prerequisite and all three
dependants unchanged.

### How far off was the answer? — 2026-09-12

On `experiment/05-loss`, branched from `main` after the training-vs-inference
experiment merged. An experiment on `loss`, built to the same rule as the four
before it: change something, inspect the consequence, optionally explain it. See
`docs/how-far-off.md` for the verification tables and the limits.

**Right-or-wrong sits beside how-far-off, and one of them moves.** A delivery
took 30 minutes; guesses of 29 and 60 both read **Wrong**, and read "1 minute
off" and "30 minutes off". Moving the second guess leaves the first column saying
Wrong the whole way and shrinks the second continuously. That is the node's own
sentence — *"'Wrong' gives you nowhere to go; 'wrong by this much' tells you
which direction is better"* — acted out rather than asserted, and nothing on the
first screen names a loss, a metric or an error function.

**No prediction step.** The neuron asks for one because it has a single
arithmetic result worth committing to. Here the interesting move is moving the
guess and watching which readout responds, so every change shows at once rather
than being gated behind a number nobody has been given a way to work out.

**Two real measures, and the units are not pretended away.** The second example
scores four deliveries both ways: the average size of the miss, in minutes, and
the average of each miss multiplied by itself, which is a score in minutes times
minutes and is never printed as minutes. Two ready-made sets are off by 5 minutes
on average and score 25 against 100, so the first measure cannot choose between
them and the second calls one four times worse. **That tie is asserted in
`loss.test.ts` rather than described in the copy**, so editing those numbers later
cannot quietly remove the disagreement the panel claims to show.

**The name comes last**, once both measures are on screen with numbers in them —
and the card then carries the half of the node that is easy to miss: neither
measure is more correct, a person picks, and whatever the chosen number does not
notice, the model has no reason to fix. That is the node's second recorded
misconception, stated rather than left to the optional question.

**The expectations are written out by hand.** Asserting a measure against itself
is the trap the tokenizer closed by decoding `bpe_ranks` independently, the
predictor by checking the least-squares conditions, and the representation
playground by brute-forcing all 65,536 pictures. This one closes it with
arithmetic anybody can check in their head. Exact guesses give zero on both;
equal misses in either direction score identically; the 20-minute miss changes
the two measures differently and by exactly four; an empty list returns `null`
rather than 0, because printing 0 for "no guesses" would say the guesses were
perfect when none was made.

**A rounding defect, found by driving the panel rather than reading it.**
Switching back from the blunder set printed "3.3 times worse" where the answer is
4: `timesWorse` rounded to one decimal and the panel then inverted, and 1 ÷ 0.3
is not 4. Display rounding belongs at the point of display. Tested in both
directions.

**`--band-learning` is 4.30:1 as text, and the two existing readouts pass by
luck.** Generalising the readout check to every band shows `foundations` is the
only one that clears AA against those cards in light mode — `networks` 4.45,
`behaviour` 4.36, `learning` 4.30, `language` 4.02. So the reason the predictor
and the two-phase panel are legible is that their band happens to be the darkest
of the six, not anything about the design, and the same treatment here would have
been a contrast defect. This panel prints its numbers in `foreground` with the
band on the border, and `BANDS_USED_AS_TEXT` in `globals.test.ts` records the
measurement so adding a band to that list is a deliberate act. The band-accent
block now checks all three surfaces too, since these panels draw band-coloured
borders on all of them. Eighth time a defect here was found by measuring rather
than reading, and the third time in the same place: **text sitting on the band
colour, in a combination nothing had measured.**

**The grading check banned this node's subject.** `registry.test.ts` rejected any
prompt containing "wrong", and this node exists entirely to separate "wrong" from
"wrong by this much". The rule was never about vocabulary — it is about handing
the learner a verdict — so judging words are now checked against the prompt's own
words with quoted text stripped first, verdict *phrases* are still checked against
the whole prompt, and a test asserts the quote-stripping cannot be used to smuggle
a verdict through in quotation marks. **Worth keeping: a rule stated as a word
list eventually collides with a subject that is about those words.**

**The verdict pair at 320px was measured, not argued about.** Two columns puts
"30 minutes off" on three lines in a 100px card and stands 98px tall; two stacked
cards is taller still and pushes the slider — the first thing there is to do — a
long way below the fold; two label-left, value-right rows is 80px and reads in one
line each. That is what it does below 420px.

**Nothing here touches the map.** No learner-model access. Checked against a
**populated** model — ten marks including this node, its prerequisite and its
dependants — rather than an empty one: moving the guess, editing every delivery,
switching all three sets and opening both explanations left storage
byte-identical. The follow-up question opens the existing `ExplainBack` empty with
a disabled submit.

**No end-to-end assessed explanation was run.** The predictor and two-phase
experiments each submitted one and confirmed it cleared only their node; this one
did not, so that claim rests on the absence of learner-model access and on the
before/after storage reads. Recorded in `docs/how-far-off.md` under "Not
verified".

### One step at a time — a real slope, and a step that runs away — 2026-09-12

On `experiment/06-small-steps`, branched from `main` after the how-far-off
experiment merged. An experiment on `gradient-descent`, built to the same rule as
the five before it: change something, inspect the consequence, optionally explain
it. See `docs/one-step-at-a-time.md` for the verification tables and the limits.

**One guess, one fact, one button.** The delivery from `loss` continues — the
same 30 minutes — and the model guessed 40. The first screen carries the guess
and how far off it is, the single fact a step is allowed to act on (*"moving the
guess down makes it less wrong"*), and **Take one step**. Then the before and
after sit side by side and stay there. Nothing on that screen says gradient,
learning rate or loss, and there is no landscape and no rolling ball.

**No prediction step, deliberately.** The neuron asks for one because it has a
single arithmetic result worth committing to. Here the learner has been given
nothing they could use to work out the size of the next move, and asking them to
guess an unexplained number is the thing this file's own rules forbid.

**The update is real, and the slope is checked against the score rather than
against itself.** `guess ← guess − step × 2(guess − actual)`, over a squared
error. `slopeAt` is the analytic expression; the test measures
`(score(g+h) − score(g−h)) / 2h` and requires the two to agree. Asserting a
measure against itself is the trap the tokenizer closed by decoding `bpe_ranks`
independently, the predictor by checking the least-squares conditions, the
representation playground by brute force and the loss panel by hand arithmetic;
this one closes it with a finite difference.

**Three step sizes, and they are the three things that can happen.** A step here
covers a fixed fraction of the remaining distance, because the slope is
proportional to the gap — a fifth of the way, a little past, three times past.
That fraction is a *consequence* of the update and is held to it in the test
rather than written into the copy, and the panel says the neat relationship
belongs to this one-number example rather than to training. **The labels say how
big a step is, never how it will turn out**, with a test rejecting "past", "too
far", "worse" and "best" in a label.

**A step that would run away is refused, and the number it would have reached is
printed.** *"From 50.48 min, a much bigger step would have taken the guess to
−10.96 min, which is less than no time at all."* Clamping it into something that
still looked reasonable would have hidden the one thing a too-big step is for.
Choosing a smaller size clears it and carries on, so it is a stop rather than a
dead end.

**The panel contradicted itself once, and only driving it found that.** A run of
bigger steps converges fast enough that within a dozen steps the gap is under
0.005 minutes, so a row printed **"30 → 30 min · 0 off → 0 off · past it, and
closer"** — the classification tolerance is 1e-9 and the display rounds to two
places. Same shape as the `loss` panel's own rule that "0 minutes off" must never
sit beside the word "Wrong". A real distance too small to print now says so
(`under 0.01 minutes off`), and the readout carries the note that earns its
place: the steps carry on getting smaller, which is the ordinary ending rather
than landing exactly on the answer. Ninth time a defect here was found by
measuring rather than reading.

**The first action was 517px below the panel title, and the fix came from
measuring the siblings.** The how-far-off panel is 334, representation 445,
predictor 520. In house norms and still the wrong end of them for a panel whose
whole first screen is one button. Two paragraphs became one, and the direction
line stopped being a bordered box and became a 3px band accent down its leading
edge — the map's own idiom. **431 now**, and at 1100×700 the title and the first
action fit on screen together, which they did not before.

**The brief's wording for the optional question was changed rather than the test
relaxed.** "Why can moving in a helpful direction still go wrong…" trips
`registry.test.ts`, which rejects a judging word in a prompt's own text. The
`loss` node genuinely needed "wrong" and relaxed the rule once, by
quote-stripping, with the reasoning recorded. This node does not need it, so it
asks in the panel's own vocabulary — *"still leave the guess further away"* —
rather than relaxing the same rule a second time.

**Nothing here touches the map, checked both ways.** No learner-model access:
stepping, changing size, running, hitting the cap, being refused and resetting
left a **populated** ten-mark model byte-identical. Then the direction the
how-far-off experiment left open — a real explanation submitted through the live
assessor moved `gradient-descent` **`shaky` → `known`** and left **every other
key unchanged**, prerequisite and dependants included.

**No motion at all.** `document.getAnimations()` is empty with the panel open and
stepped, so there is nothing for a reduced-motion setting to suppress. The only
self-moving thing is the optional six-step run, which is opt-in and carries a
Stop button throughout.

### Reaching an experiment — a button, and a URL — 2026-09-13

On `experiment/08-experiment-links`, branched from `main` after the
one-step-at-a-time experiment merged. The owner asked for a direct route from
the focused view to every experiment, and for a URL that names where you are.
See `docs/experiment-links.md` for the verification table and the limits.

**Seven ideas have an experiment and only one was reachable from the focused
view** — the idea in focus, through the invitation at the bottom. Every
neighbour that has one now carries a `Try it` button on its own card. It is a
second control, not a second invitation: the card still opens the idea, and the
button takes its accessible name from `EXPERIMENT_ACTION`, so it can never read
as an unlabelled "try" beside a heading it does not belong to.

**The invitation was 576px below the panel title with its action off the bottom
of the window**, measured at 1230x842 — the viewport this file already records
as the common laptop. It now sits directly under the idea in focus whenever
that idea has its own experiment: **325px**, fully on screen. The general
neuron invitation still comes last, on ideas that have none, so one invitation
per view still holds. Same defect as the one-step-at-a-time panel's 517px, in a
different place, found the same way.

**Two URL forms: `#idea/<id>` and `#play/<id>`**, with a bare `#tokens`
accepted and rewritten. `replaceState`, never `pushState` — selecting an idea
is panel state, not a page, and pushing would bury the back button under
twenty-three entries. An unknown id lands on the ordinary first screen rather
than an empty panel that reads as a failed load, and `#play/<id>` for an idea
with no experiment falls back to the idea, so a link written before its
experiment exists still arrives somewhere true.

**The hash is a subscription, not a store.** `persisted.ts` and `use-media.ts`
use `useSyncExternalStore` because components render from those values. Nothing
renders from the hash: a link is an *event*, and the app responds by moving. So
`use-hash.ts` takes a callback, and the hash already in the address bar is
delivered through that same callback rather than read separately on mount — one
path in, so a pasted link and a hand-edited one cannot disagree. That shape was
not chosen for tidiness. The obvious version is what
`react-hooks/set-state-in-effect` rejects, and the rule's own text names the
alternative. **The lint error was right about the design, not just the line.**

**`#idea/tokens` typed while the tokenizer was open left the experiment
running.** Selecting an idea used to leave an experiment by accident — the
focused view moves off the one being played — but not when the idea was the
same one, so the URL said one thing and the screen showed another. `openNode`
stops it explicitly now.

**A hash-link check that does not reload is checking something else.** Changing
only the fragment is a same-document navigation, so React state carries across
it, and a probe that walked several links in a row credited each result to the
wrong cause. Every case was re-run through `about:blank` first.

**The row's `overflow: hidden` would have clipped the focus outline.** Making
the neighbour a row with two buttons inside it, clipped to its own corner
radius, hides a 3px-offset outline on both. The right-hand control carries the
inner radius itself instead. Tenth time a defect here was found by measuring
rather than reading — and this one was introduced by a purely visual line.

### "Explore this idea" was a control that did nothing — 2026-09-12

Reported by the owner while reviewing the experiment above, and older than it:
introduced with `b18a5c4` and already on `main`.

The focused card's "Explore this idea" calls `openNode`, which selects the idea
and brings the guide into view. But the card always draws the **selected** idea,
so after the first press of a session it was selecting what was already selected
and showing a panel that was already on screen. On a wide window nothing moved.
It worked exactly once per session and was inert from then on.

`src/lib/map/panel.ts` now answers whether the panel is already showing that
idea, and the card renders the way in — and its button wrapper — only when there
is somewhere to go. Below the panel breakpoint the offer stays, because there the
two surfaces are switched between rather than shown side by side, so the same
press still does something real and is the route back to an idea's text from
inside an experiment. That is why the predicate asks about the layout and not
only about the selection, and why it is a tested pure function rather than an
inline comparison.

**Worth keeping:** the defect was reachable in two clicks from a fresh load and
survived three experiment sessions on this card. Nothing measures whether a
control does anything, which is the one thing this project has never had a probe
for.

### Did it learn the pattern, or remember the examples? — 2026-09-13

On `experiment/07-generalization`, branched from `main` after the small-steps
experiment merged. An experiment on `generalization-overfitting`, built to the
same rule as the six before it: change something, inspect the consequence,
optionally explain it. See `docs/memorising-or-learning.md` for the verification
tables and the limits.

**Two rules, one set of past phone sales, and the reversal is the experiment.**
A shop estimates a used phone's sale price from its age, making the input and
answer explicit before introducing either rule. A straight trend cannot bend
for one cracked phone; a flexible curve passes through every sale exactly. On
the five sales it learned from, the curve is **nothing off** and the line is
$51.2 off. On four held-out sales, the curve is $100 off and the line is $34.5.
The rule with the perfect score is the one that is 2.9 times further out.

**Exactness is the point, so the curve is real interpolation.** Newton divided
differences: the one curve of exactly the right flexibility to pass through every
past sale. "Nothing off on any past sale" has to be a fact about the
arithmetic, or the panel is asserting the very thing it exists to demonstrate.
The straight line is the predictor's `fitLine`, unchanged — this node is about
what a fit is worth on unseen data, not about how fitting works.

**The held-out sales cannot reach a rule.** `fitLine` and `fitCurve` take a list
of past sales and nothing else; a dataset's `heldOut` rows are never in scope
inside either. Same structural move as `answerWith(learned, distance)` in
`phases.ts`, and there is a test that swaps the held-out rows for nonsense and
requires both rules to come out byte-identical. "The new answers were never used"
is the shape of the function rather than a promise in a comment.

**Three datasets, because one of them would be a lie.** **One damaged phone**
has the curve chasing a cracked screen's one-off price and losing. **The early
price drop** has value genuinely falling in a curve, and there the flexible fit
is **25.8 times better** on held-out sales. **One clean pattern** has no chance
variation in the past sales at all, so the flexible rule comes out straight and both
answer identically. Each is held to the case it claims in the test rather than
described in the copy. Teaching that a more detailed rule always fails would be a
new misconception planted on the node whose job is removing one — what decides it
is whether the thing being followed will happen again, which is a fact about the
world and not about the rule.

**Every held-out sale sits inside the fitted age range**, and at an age no past
sale used — both asserted. So the failure is genuine overfitting rather than a
rule being asked about a phone much older or newer than anything it saw.

**No prediction step.** The learner has been given nothing they could use to work
out how far off either rule will be on unseen data, and asking for a guess at an
unexplained number is what this file already forbids. The interesting move is one
button and watching one score hold while the other collapses.

**The names come last**, once both numbers are on screen: training data, held-out
set, overfitting, generalising. The card then carries the node's second recorded
misconception rather than leaving it to the optional question — an overfitted
rule is not broken and did not fail at its job; it learned one cracked phone's
chance price very well.

**The learner-facing words use everyday English.** The question is now “Can a
perfect score still lead to bad guesses?” Short sentences explain the exact
failure before naming it: the flexible rule followed one cracked phone's unusual
price, that detail did not happen again, and new sales exposed the mistake. The
experiment and the companion concept explanation contain no em dashes. Terms
such as “capacity” and “transferable” were removed from the learner view.

**The expectations are held to answers worked out on paper.** The parabola
through (0,1) (1,3) (2,9) is `2x² + 1`, so `p(3) = 19`. The curve through two
points is the line through them. On the clean dataset the data is exactly
`820 - 10a`, where `a` is phone age in months, so the curve must be too — checked
against that expression and against `fitLine`, a different implementation. That is the "do not assert the encoder
against itself" trap closed by a fifth route, after `bpe_ranks` decoded
independently, the least-squares conditions, brute force over 65,536 pictures,
and hand arithmetic.

**The first action sat 982px below the panel title, and only a measurement found
it.** The siblings put theirs at 334, 431, 445 and 520. The cause was the
drawing: its `<svg>` is `h-auto w-full`, and in the map pane at 1230×842 that is
664px wide, so a 320×200 viewBox stood **415px tall on its own** — 42% of the
whole distance. Nothing about that is visible in the code, which says `w-full`;
the number only exists on a screen of a particular width. The chart is capped at
30rem and shortened, the rule cards lost a line each, and **the button moved
above the picture**: the drawing is optional support and everything it shows is
printed in words, so it had no business pushing the only action off the page.
**471 now**, with the button in view. Tenth time a defect here was found by
measuring rather than reading.

**`sr-only` was deliberately not used** for the narrow-width column labels. Below
460px the 2×2 becomes one column per rule and each value carries its own heading
inline, switched with `display` rather than hidden with `sr-only`, so exactly one
label is in the accessibility tree at each width. The recorded reason stands: an
absolutely positioned hidden span inside one of this app's scrolling panes
escapes the shell's clip and adds page scroll.

**Nothing in the experiment touches the map.** No learner-model access:
revealing, switching datasets and resetting use component state only. After the
phone example replaced delivery, one real mechanism explanation through the
live assessor moved `generalization-overfitting` **`unexplored` → `known`**.
The earlier delivery version was also checked against a populated ten-mark model
and left every other key unchanged; that byte-level comparison was not repeated,
but the client and server upgrade paths are unchanged and remain unit-tested.

The required `pnpm calibrate --explain --runs 3` rerun failed on unrelated
fixtures: 2/72 false passes for `hallucination/parroted` and one false block for
`neuron/technical`. That canary has no `generalization-overfitting` fixture, so
it says nothing direct about this question, but it is the current evidence for
the shared assessor and must travel with the work.

### How can numbers help us find related words? — 2026-09-13

On `experiment/09-embeddings`, branched from `main` after the experiment-links
work merged. An experiment on `embeddings`, built to the same rule as the eight
before it: change something, inspect the consequence, optionally explain it. See
`docs/word-neighbours.md` for the verification table and the limits.

**Real learned values, named and licensed.** 163 words of **GloVe 6B, 100
dimensions** (Wikipedia 2014 + Gigaword 5; Pennington, Socher and Manning, EMNLP
2014), released under the Open Data Commons **PDDL v1.0**, which is why a slice
can sit in the repo. `scripts/extract-word-vectors.ts` copies them out of the
published file and refuses to emit a partial collection. Random numbers presented
as meaning would teach the exact thing this node exists to correct.

**Static, and the panel keeps that separate.** One fixed list per word, learned
from how often words appear near each other. `SOURCE.kind` is `'static'` and a
test pins it, because the node's second recorded misconception is precisely the
confusion with the context-dependent values a model computes inside a sentence.
That distinction is also the panel's best moment: **`mouse` comes back as cat,
rabbit, dog, keyboard, screen, computer** — both meanings mixed into one saved
list, because a static vector cannot choose.

**The grouping is ours; the neighbours are the numbers'.** Fourteen everyday
areas exist so a word can be found, and the panel says nothing in the numbers
knows about them. The collection is chosen so several words land somewhere else
entirely — `rock` is filed under Outdoors and sits with `band`, `album`, `song`;
`hedge` is filed under the garden and sits with `money`, `bank`, `cash`. Both are
asserted in the test rather than described in the copy.

**"The flat picture leaves a lot out" is a count.** `projectionDisagreesWith`
compares each word's nearest neighbour in two dimensions with its nearest in the
full lists: **146 of 163 differ**, and the panel prints that number. A test
requires the disagreement to cover more than half the collection, so a copy line
that stopped being true would fail there. Neighbours are read from all 100
numbers and never off the drawing — `guitar`'s nearest in the full lists is
`bass`, and in two dimensions it is something else, which is also tested.

**The projection is deterministic on purpose.** Power iteration needs a starting
direction, and a random one moves the picture between two readings of the same
collection. Fixed seed, and the sign pinned to the loading of largest magnitude,
because an SVD is free to settle on either end of the same axis and a mirrored
drawing is not the same drawing.

**Nothing is guessed at when a word is missing.** `aubergine` is reported as not
in this small saved collection; a typo retries on shorter openings, so `guitarr`
offers `guitar`; only when nothing matches at all do the four opening words stand
in. `invalidReason` rejects a list of the wrong length, a value that is not
finite, and an all-zero list — the last of which would otherwise divide by zero
and print `NaN` as though it were an answer.

**The fixtures are held to the same quantity computed a different way.** Cosine
similarity is checked against the straight-line gap between the two lists scaled
to length 1, which shares no arithmetic with the dot-product form, plus fixtures
anybody can check in their head. That is the "do not assert the measure against
itself" trap closed by a sixth route, after `bpe_ranks` decoded independently,
the least-squares conditions, brute force over 65,536 pictures, hand arithmetic,
and answers worked out on paper. The shipped values are additionally **pinned to
the opening numbers of the published `guitar` and `garden` lines**, so
regenerating the file from some other source fails the test rather than quietly
changing what the panel calls meaning.

**No prediction step.** The learner has been given nothing they could use to work
out which words will come back, and asking somebody to guess an unexplained
result is what this file already forbids. One press, and the answer is there.

**The first action is 286px below the panel title** at 1230x842 — the shortest of
the nine, against 334 / 431 / 445 / 471 / 520 for its siblings. At 320 it is 415,
which is the intro wrapping rather than anything added.

**`sr-only` was deliberately not used**, on the recorded grounds that an
absolutely positioned hidden span inside one of this app's scrolling panes
escapes the shell's clip and adds page scroll. The consequence is written down in
`docs/word-neighbours.md` rather than left implicit: a screen reader hears
`bass 0.85`, with the meaning of the number carried by the sentence under the
list rather than by the row.

**`--band-language` is still never used as text.** It measures 4.02:1 against
these cards, under AA, which `BANDS_USED_AS_TEXT` in `globals.test.ts` already
records. It carries the similarity bars, which are graphics held to 3:1 by the
band-accent block, and the card's leading edge. Every number is printed as text
beside its bar.

**Nothing here touches the map, checked both ways.** No learner-model access:
choosing words, changing them, typing a missing word, opening the numbers, the
two-meanings card and the picture, and resetting left a **populated** ten-mark
model byte-identical. Then one real explanation through the live assessor moved
`embeddings` **`shaky` → `known`** and left every other key unchanged.

**No motion at all.** `document.getAnimations()` is empty with the panel open and
both words chosen, so there is nothing for a reduced-motion setting to suppress.

**`EXPERIMENT_PROMPT` is display copy.** `ExplainBack` renders it and never sends
it, so the assessor prompt, the decision schema and the model list are untouched
by this work. `pnpm calibrate --explain --runs 3` was run anyway for current
evidence and **fails**, on exactly the two fixtures the previous two sessions
recorded: **2/72 false passes for `hallucination/parroted`**, which this file
records as deliberately left failing, and **3/24 false blocks for
`neuron/technical`**, which is the same figure the word-neighbours session
measured on unchanged fixtures, prompt and model. Everyday words 12/12,
misconception flag 12/12, jargon-with-mechanism 9/12. That canary has no
`train-test-split` fixture, so it says nothing direct about this experiment, but
it is the current state of the shared assessor and travels with the work rather
than being summarised away. Full figures in `docs/saved-messages.md`. `pnpm calibrate --explain --runs 3` was run anyway for current
evidence and **fails**, on the two fixtures the previous session already
recorded: 2/72 false passes for `hallucination/parroted`, which this file
records as deliberately left failing, and 3/24 false blocks for
`neuron/technical`, which was 1 in the generalization session and is 3 here on
the same unchanged fixtures, prompt and model. That is run-to-run variance in
the shared assessor rather than anything about this experiment, which has no
fixture in that canary — but it is the current state of it and travels with the
work rather than being summarised away. Full figures in
`docs/word-neighbours.md`.

### Can we trust a result we helped choose? — 2026-09-13

On `experiment/10-train-test-split`, branched from `main` after the
word-neighbours experiment merged. An experiment on `train-test-split`, built to
the same rule as the nine before it: change something, inspect the consequence,
optionally explain it. See `docs/saved-messages.md` for the verification table
and the limits.

**A junk-mail filter, and three groups of invented messages.** Six to learn
from, four to help choose how cautious it should be, and four whose answers stay
out of view until asked for. The rule is said once, at the top, in the learner's
own words: *"Save some messages until you have finished choosing the filter."*
The names — training, validation, test — arrive only after all three groups have
been used, and the panel says plainly that the order matters more than the
names.

**The middle group is now a real decision, not a silent default.** The first
version preselected the cautious setting, which meant somebody could open the
final answers without making the choice the experiment exists to explain.
`caution` begins at `null`; two whole clickable outcome cards expose the
trade-off, and no final-check control exists until one is explicitly chosen.
After learning, the six labelled messages collapse out of the main path. After
the reveal, the conclusion comes before the optional row-level evidence.

**The filter really learns, and the learning has one input.** Each word scores
the log ratio of the junk examples containing it against the wanted ones, with
one added to each count; a message's junk score is exactly the total of its
known words' scores, and a word the examples never contained counts nothing.
`learnFilter(examples)` takes one list, so the choosing group and the saved
group are not in scope where the filter is built — the same structural move as
`answerWith` in `phases.ts`, and a test swaps both of those groups for nonsense
and requires the filter to come out byte-identical. `runOn` takes a finished
filter, so reading any group, the saved one included, cannot be a further round
of learning.

**Two mailboxes, and they disagree about which setting is right.** In the small
mailbox being quick catches all the junk and costs you a message you wanted. In
the other it looks free — both junk caught, nothing hidden, nothing wrong at
all — until the saved messages, where it hides one. So the panel cannot be read
as teaching a rule of thumb about caution; what decides it is the data, and the
only honest reading is the one nothing was chosen on. Each case is held to being
the case it claims in `junk-filter.test.ts` rather than described in the copy.
Two messages in the first mailbox score 0.7, one junk and one wanted, so no bar
can separate them; both scores are printed rather than tidied away.

**Refusing beats learning badly.** With no junk examples, or none wanted, every
word would lean the only way there is and the filter would call everything junk
while looking like it had learned something. `learnFilter` returns `not-enough`
with the reason, the panel says which in words, and there is no state in which
it holds a filter built from one kind of example. It is reachable: switch the
three wanted examples off under "Change what it learns from".

**The note that outlives everything.** Once a mailbox's final answers have been
on screen, any later change to the filter leaves *"We have seen these answers
now. This is no longer a fresh check."* beside the control that caused it and
inside the result. **Reset does not un-see an answer**: it re-hides the group and
then says so, driven by a flag this panel's own Reset deliberately does not
clear. Each mailbox keeps its own saved messages, so switching to one whose
check has not been opened is genuinely fresh and switching back is not.

**Two defects found by measuring, both at 320px.** The first action sat **757px**
below the panel title — three stacked group cards at 304px and a six-line intro
at 158 — measured against the siblings at 286 / 334 / 431 / 445 / 471 / 520. The
step number now sits beside its name below 560px and the provenance line moved
under the button. The clarity pass then moved the action before the tracker and
removed Reset from the pristine state: **344px now, and 190px at 1230x842.**
The same button was also 291px
wide in a 242px column and hung 32px off the right, because the shared `Button`
is `whitespace-nowrap` at a fixed height. **Eleventh time a defect here was found
by measuring rather than reading.**

**Nothing here touches the map, checked both ways.** No learner-model access:
learning, switching settings, revealing, switching mailbox, toggling examples
and resetting left a **populated** ten-mark model byte-identical. Then one real
explanation through the live assessor moved `train-test-split` **`unexplored` →
`shaky`** and left every other key unchanged. It came back half-held rather than
solid; that is the assessor's call and is recorded rather than tuned.

**No motion at all.** `document.getAnimations()` is empty with the panel open
and every section expanded, so there is nothing for a reduced-motion setting to
suppress. Driving the whole panel also produced **zero network requests**.

**`EXPERIMENT_PROMPT` is display copy.** `ExplainBack` renders it and never sends
it, so the assessor prompt, the decision schema and the model list are untouched
by this work. `pnpm calibrate --explain --runs 3` was run anyway for current
evidence and **fails**, on exactly the two fixtures the previous two sessions
recorded: **2/72 false passes for `hallucination/parroted`**, which this file
records as deliberately left failing, and **3/24 false blocks for
`neuron/technical`**, which is the same figure the word-neighbours session
measured on unchanged fixtures, prompt and model. Everyday words 12/12,
misconception flag 12/12, jargon-with-mechanism 9/12. That canary has no
`train-test-split` fixture, so it says nothing direct about this experiment, but
it is the current state of the shared assessor and travels with the work rather
than being summarised away. Full figures in `docs/saved-messages.md`.

### When a model learns, what does it actually keep? — 2026-09-13

On `experiment/11-parameters-scale`, branched from `main` after the
train-test-split experiment merged. An experiment on `parameters-scale`, built
to the same rule as the ten before it: change something, inspect the
consequence, optionally explain it. See `docs/saved-numbers.md` for the
verification table and the limits.

**Three kinds of number, told apart by the layout.** A bike rental shop keeps
two — *"Start at $2, then add $3 for each hour"*, named as **Starting price**
and **Price per hour** — a customer brings one, *2 hours*, and the price for
this rental is $8. The two kept numbers sit in one card with the band down its
leading edge; the customer's input sits in a dashed card marked *"Not kept by
the shop."* Nothing on that screen says billions, weights or layers, there is no
network drawing and no wall of sliders, and the arithmetic is under a
disclosure.

**The three build checks are the node's own claims.** `priceFor(params, hours)`
takes the rule and the hours and nothing else, so every visible price is the
same arithmetic. `fitParams(rentals)` takes past rentals and nothing else, so
the customer's input is not in scope where the numbers are worked out — the same
structural move as `answerWith` in `phases.ts`, checked by driving the panel:
with a fit on screen, changing 2 hours to 5 moved only what each rule *reads
off* and left both rules where they were. And `parametersOf` returns the named
list that the panel *counts*, so "the rule still keeps 2 numbers" is derived
rather than printed; two of the three rental sets differ only in size, four
against ten, and a test fits every count from 2 to 12.

**The fit is `fitLine` unchanged, and it refuses rather than inventing.** This
node is about what a fit leaves behind, not about how fitting works. Four past
rentals give $1.50 and $3.40; ten give $2.10 and $3.20; a set where every rental
was two hours long leaves the price per hour completely undetermined and is
**refused with the reason**, rather than dividing by a spread of zero. A cleared
saved number is withheld the same way — it is not a price of zero.

**The expectations are worked out on paper and by the normal equations.**
Asserting a fit against the function that produced it is the trap closed by
`bpe_ranks` decoded independently, the least-squares conditions, brute force
over 65,536 pictures, hand arithmetic, answers on paper and pinning to a
published file. This one closes it with a seventh and eighth route: the four
rentals give 17 ÷ 5 = $3.40 and 10 − 3.4 × 2.5 = $1.50, checkable in your head,
and the misses are then required to sum to zero and not lean with the hours.

**The names and the scale come last, and carry what is easy to get wrong.** No
single number is a stored fact — **and they are not empty either**: training
pushes information from the examples into them, and pieces of training text have
been pulled back out of trained models. More numbers means a model *can* fit
more; it does not mean better answers on its own. There is no bigger-model-wins
race, and "What this leaves out" adds that some large models use only a fraction
of their saved numbers on any one step.

**A disagreement with an authored simplification, recorded rather than acted
on.** The node's `explanations.example` says *"Nothing else is stored. No
database of facts, no copy of the training text."* The first half is the point
of the node. The second half is stronger than the evidence — training-data
extraction is a documented result — and telling a learner recovery is impossible
hands them a new false belief in place of an old one. **Nothing was changed**:
the graph, the assessor prompt, the schema and the model list are untouched. The
panel's wording is chosen to be *true beside* the authored text, which is visible
in the inspector at the same time on a wide screen. Softening that second
sentence is the owner's call.

**The first action was 863px below the panel title at 320px**, measured against
the six sibling panels as a control (286 / 334 / 344 / 431 / 445 / 471 / 520).
The fix was structural, not a copy trim: the action moved **into the board
grid**, directly under the rule card whose numbers it changes, with the input and
the price in the second column. On a wide screen the rule and its button hold
the left column; at 320px the same order stacks. Reading order and visual order
match at both widths, which is why this is grid placement and not `order`.
**521 at 320px and 382 at 1230x842 now.** Twelfth time a defect here was found
by measuring rather than reading.

**Restoring a cleared number said nothing at all.** Emptying a field left no
complete reading to compare against and overwrote the snapshot with nothing, so
typing the value back produced no sentence — the learner acted and the panel
went quiet. The snapshot keeps the last *complete* reading now. Found by driving
the panel, not by reading the code.

**Nothing here touches the map, checked both ways.** No learner-model access:
changing either saved number, changing the hours, clearing and restoring a
field, switching all three rental sets, learning, being refused, applying a fit
and resetting left a **populated** ten-mark model byte-identical. Driving the
whole panel produced **zero network requests**, and
`document.getAnimations()` is empty with it open.

**`pnpm calibrate --explain --runs 3` was not run**, and no end-to-end assessed
explanation was submitted. `EXPERIMENT_PROMPT` is display copy that
`ExplainBack` renders and never sends, and this work changes no prompt, schema
or model-list file. The last three sessions recorded the canary failing on
exactly two fixtures — 2/72 false passes for `hallucination/parroted`, which
this file records as deliberately left failing, and 3/24 false blocks for
`neuron/technical` — and that remains the current state of the shared assessor.
Recorded in `docs/saved-numbers.md` under "What was not verified".

### If the final amount is wrong, how do we work back? — 2026-09-13

An experiment on `backprop-intuition`, built to keep three moments separate:
the original prediction, advice calculated backward from its final difference,
and the learning step that changes both earlier settings. See
`docs/working-backwards.md` for the arithmetic, verification and explicit
limits.

**One frozen run, then two simultaneous changes.** Ten minutes × 0.5 litres per
minute × 60% predicts 3 litres, while the plant was measured at 4. With
half-squared error, the tap sensitivity is −6 and the share sensitivity is −5.
Both are calculated from a copied pre-update settings object. The visibly
labelled 0.01 learning step then changes the tap estimate to 0.56 and the share
to 65% at the same time, so the next prediction is 3.64 litres. Updating the
first setting before calculating the second would be a different algorithm and
is pinned out by the tests.

**Advice is not an update.** The first action reveals splitter advice and then
tap advice while the saved settings stay visible and unchanged. Only the next
action applies them. A reducer at page level makes that action idempotent under
repeated activation and preserves the experiment across navigation; the
existing global Start over path resets it with all siblings. Exact agreement
produces zero advice and no Apply control. Empty, out-of-range, non-finite and
physically impossible cases never produce an invented or clamped result.

**The metaphor has a written boundary.** "Blame, spread backwards" names the
direction of the job, not the calculation. Backpropagation computes chain-rule
sensitivities. Gradients are not percentages or conserved portions of a finite
substance, need not add to 100, and leave no leftover blame to pass farther
back. This is a two-setting teaching model, not real plumbing or a full neural
network.

**The first action was 910px below the title at 320px in the first draft.** The
run, settings and connecting copy all preceded it. Moving the run and action
ahead of the detailed settings card brought it to **503px**; changing the shared
nowrap button to a wrapping, auto-height 208×47px control kept it inside its
narrow card. Resize-after-load checks from 320×568 through 1920×900 found no
page scroll, right clipping or off-right experiment control. A resumed short
pass also checked visible keyboard focus, both themes, global reset, a
200%-equivalent reflow and an isolated zero-request trace. BrowserOS's targeted
wheel call hung twice, and it cannot drive browser-chrome zoom itself; those
limits are recorded rather than implied away in `docs/working-backwards.md`.

**Nothing here changes the map.** The experiment has no learner-model or
network access. A populated ten-mark model stayed byte-identical through the
completed play, navigation and explanation-draft checks. The graph, assessor
prompt, schema and model list are untouched, so no calibration run was needed
or run. No explanation was submitted and this is not a learner study.

### How can the words around "bank" change what it means here? — 2026-09-13

On `experiment/12-attention`, branched from `main` after the saved-numbers
experiment merged. An experiment on `attention`, built to the same rule as the
eleven before it: change something, inspect the consequence, optionally explain
it. See `docs/words-around-it.md` for the verification tables and the limits.

**No arrows, because arrows are the misconception.** The node's two recorded
misconceptions are that the model "pays attention to the important words" and
that the shares explain its reasoning. A diagram of arrows between words makes
both worse — an arrow looks like choosing, and a thick arrow looks like a
reason. So there is one sentence, one word being updated, and the same word
updated again in a second sentence. *We walked beside the river to the bank*
leaves `bank` at **outdoors 1.60 / money 0.21**; *We took cash to the bank*
leaves it at **0.24 / 1.78**. On its own it is an even **1.00 / 1.00**, which is
asserted in the test rather than described in the copy, so nothing but the words
around it breaks the tie.

**Real single-head causal self-attention, with the identity left in.**
`match = (q · k) / √2`, softmax, blend — and the query, key and value settings
are the identity. That is a simplification and the panel says so: it makes every
number on screen one the learner can check against the nine-word vocabulary
table, which is worth more here than three matrices nobody would multiply. Real
models **learn** those three sets of numbers, and *How it works* says that too.

**Causality is the shape of the function.** `updateAt(words, index)` slices to
`index` and stops, so a later word is not scored, not weighted and not blended —
it is not in scope. The same structural move as `answerWith` in `phases.ts` and
`learnFilter` in `junk-filter.ts`. A test swaps every word after the target for
nonsense and requires the contributions, the blend and the leading word to come
out byte-identical. Because `bank` is last in both sentences the rule is
invisible on the first screen, so an optional section runs the same arithmetic on
`river` — word 5 of 8 — with the three later words struck through: *"Not a small
share. No share, no match number, not in the arithmetic."* It earns a second
point for free: `river` keeps 98% of its own description, because it is already a
clear word.

**Several shares, never a single winner.** River 43%, bank 21%, walked 10%, and
the five all-zero words at 5% each. A test rejects a leader above 60%, because a
single winner reads as the model picking one word, which is the misconception
this node exists to remove. Nothing is at zero either — `percent` prints
`under 1%` rather than `0%` when a share is genuinely above zero, found by
driving the look-ahead section where three words sit at 0.19% beside the panel's
own sentence *"They still get one. Nothing is dropped."* Same rule as the
one-step-at-a-time panel's `under 0.01 minutes off`.

**The column adds up, or the panel says why.** At two decimals 1.28 + 0.21 +
0.10 prints as 1.59 under a total of 1.60; the unrounded parts total exactly.
`roundingShows` compares the printed parts to the printed sum, so the note
appears only where the discrepancy is real — a note that was always there would
be claiming one on readings that have none.

**The expectations are read straight off the vocabulary table.** The query is
`bank`'s own description `[1, 1]`, so each match before scaling is just a word's
two numbers added up: 0, 1, 0, 0, 3, 0, 0, 2. The shares are then recomputed in
the test from literal `Math.exp` calls and the blend from a second loop. That is
the "do not assert the measure against itself" trap closed by a seventh route,
after `bpe_ranks` decoded independently, the least-squares conditions, brute
force over 65,536 pictures, hand arithmetic, answers worked out on paper, and
pinning to a published file.

**Three defects found by measuring or driving, not by reading.** The first action
sat 502px below the panel title at 390px and 416 at 1100x700 with the button off
the bottom; moving the connection sentence below the readout — where it reads
better, since it is about a description changing — put it at **306 at 1230x842**,
the second shortest of the twelve panels. Each before/after card stood 176px tall
at 320px with 90px of nothing under its numbers, because `flex-basis` is the main
axis and the 11rem that set a column width side by side became a minimum *height*
the moment the pair stacked. And each share row was three lines tall with five of
the eight saying "adds outdoors 0.00 · money 0.00" — true, and noise; they say
**"adds nothing"** now, which is the same fact and also the point.

**A note on the probe, not the panel.** A first contrast probe composited every
colour over black, so the share track — a `color-mix` with `transparent` — read
as near-black and reported the bar at 1.52:1 in light mode. The real figure is
3.36. The failure mode is this project's oldest: **the measurement was aimed at
the wrong quantity**, and a wrong number costs more than no number.

**Nothing here touches the map, checked both ways.** No learner-model access:
switching sentences, opening and closing every section, twenty rapid presses and
Reset left a **populated** ten-mark model byte-identical. Then one real
explanation through the live assessor moved `attention` **`blocked` → `known`**
and left every other key unchanged. Zero network requests while driving the whole
panel, and `document.getAnimations()` is empty with it open.

**A disagreement with an authored simplification, recorded rather than acted
on.** The `embeddings` node's authored text says *"nobody decided what any single
dimension means"*, which is true of real models. This panel **names** its two
columns, because a blend of two unnamed numbers cannot be read and reading it is
the whole experiment. **Nothing was changed** — the graph, the assessor prompt,
the schema and the model list are untouched — and the exemption is stated on
screen under *How it works* rather than left implicit. Whether the authored
sentence should acquire a clause is the owner's call.

**The numbers are defined where they appear, not in front of the button.** A
first pass put three undefined terms in a learner's way — the two column names,
*description*, and *share* — all in or beside the readout and none explained
until an optional section further down. The interaction was simple and the
readout was not readable, which is the more common failure of the two. One
sentence now sits **inside the readout card**, so it arrives at the moment the
numbers do rather than standing in front of the first action as a lesson, and it
is outside the `aria-live` region so it is not re-announced on every press. The
result sentence grounds *share* by using it, and both of its claims —
&ldquo;balanced between the two&rdquo; and which way it leans — are read off
`leadingColumn` rather than written down. Inside *See the shares*, the match
number became checkable: *"how much the two descriptions overlap, divided by the
same fixed number every time&hellip; river overlaps bank by 3.00, so it reads
2.12 below"*, with both figures derived from the update on screen. None of it
moved the first action, because the readout sits below the button.

**`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
display copy that `ExplainBack` renders and never sends, and this work changes no
prompt, schema or model-list file. The last four sessions recorded that canary
failing on exactly two fixtures — 2/72 false passes for `hallucination/parroted`,
which this file records as deliberately left failing, and 3/24 false blocks for
`neuron/technical`. One end-to-end assessed explanation was submitted through the
live path instead, and is reported in `docs/words-around-it.md`.

### Why does it answer, instead of adding more questions? — 2026-09-15

On `experiment/18-post-training`, branched from `main` after the notice-search
experiment merged, and rebased onto it after the picking-a-word one did. An
experiment on `pretraining-vs-posttraining`, built to the same rule as the
nineteen before it: change something, inspect the consequence,
optionally explain it. See `docs/preferred-reply.md` for the verification table
and the limits.

**The reply that answers nothing starts with the most chance.** Somebody asks
*"My bike has a flat tyre. What should I do first?"*, and three replies written
by hand sit under it: more questions, a short first step, a longer answer. The
opening chances are **55% / 25% / 20%**, with more questions on top, because on
its own a question is often followed by more questions. Choose a reply — the
whole card is the control — press **Learn from this choice**, and it becomes
**31% / 52% / 16%**. Nothing is rewritten. That is the node's first recorded
misconception acted out rather than asserted.

**It is a real softmax choice model trained by one gradient step on
cross-entropy.** `chances` is the softmax, `howFarOff` is the loss, `learnFrom`
is its gradient. Nothing moves a bar by a hard-coded amount and nothing swaps a
reply for a different one after a press. The opening round is checkable on
paper, and `howFarOff` falls from 1.397 to 0.652. The step cannot overshoot at
any size — the chosen score rises by `step x (1 - its chance)` and the others
fall by `step x their chance`, so the gap always widens — which is why the panel
offers no step-size control and says so.

**Two things are the shape of a function.** `applyAction` carries the `scores`
array through **by reference** on a `select`, so "pointing at a reply trains
nothing" is asserted by identity rather than by reading the handler. And the
state holds one score per entry of `REPLIES`, so there is nowhere for reply text
— or anything about bicycles — to be learned; a test runs twenty rounds and
requires the question and all three replies to be deep-equal to a clone taken
beforehand. That is what makes *"nothing here transfers to a question these
three replies do not already answer"* a fact about the data rather than a
disclaimer.

**A reducer, so twenty presses are twenty steps.** Measured in the browser two
ways: twenty clicks inside one synchronous task, and twenty clicks with a render
between each, both give exactly twenty rounds and byte-identical chances. An
action that would do nothing returns the state itself.

**The expectations are held to a central difference.** `learnFrom`'s implied
gradient is checked against `(loss(s+h) - loss(s-h)) / 2h`, over a loss written
out again from its definition in the test file — no shared arithmetic with the
closed form — plus the opening round worked out on paper. That is the "do not
assert a measure against itself" trap closed by a ninth route.

**A container query set on the wrong number, found by measuring the content
box.** `Learn from this choice` and the sentence saying what it did sat **1063px
below the panel title at 1230x842** — entirely off the bottom of the window —
and 1147 at 1100x700. The threshold was 44rem, copied from the notice-search
panel. A container query reads the **content box**, and this panel gets 535px of
it at 1100, 614 at 720, 664 at 1230 and 696 at 768, so it fired at none of them.
A first pass at 37rem still missed 1100, because the panel's padding is `2.5vw`
and the pane is not the viewport. 33rem is under all four. **311-345 now, on
screen, at every width from 640 up.** Eighteenth time a defect here was found by
measuring rather than reading.

**The first action was 527px down**, the worst of the nineteen panels, because
it was a button 178px inside the first card. The whole card is the control now,
with the chance outside it — a number that moves every round has no business
inside a button's accessible name. **449 at 320, 359 at 1230x842**, inside the
range the siblings measure.

**A chance that is really there never prints as nothing.** Measured, a losing
reply drops under half a percent on round 72 and the chosen one passes 99.5% on
round 134, and neither ever arrives. `0%` and `100%` would say a reply had been
ruled out, which is the opposite of what these chances do. `under 1%` and
`over 99%`, with both boundaries pinned in the test. Same rule as the attention
panel's `under 1%`.

**A wrong probe, caught before it was believed.** The first twenty-presses check
fired every click inside one synchronous loop and reported that no round had
applied. React never re-renders inside a synchronous task, so `Learn` stayed
`disabled` from the first iteration to the last and all twenty clicks were
no-ops on a disabled button. The measurement was aimed at the wrong quantity,
which is this project's oldest failure in a new place.

**A disagreement with the authored text, recorded and not acted on.** The node's
`explanations.intuition` says the assistant persona, the tone, the refusals and
*"the willingness to answer at all — all of that is added afterwards"*. A model
trained only to continue text is not silent: it answers questions, especially
where the text in front of it makes an answer the likely continuation, and
showing one a few worked examples first was the standard way to get useful
answers out of it before instruction tuning. Further training also changes what
a model knows and can do, not only how it sounds. The node's own
`simplificationCost` already concedes the other half. **Nothing was changed** —
the graph, the assessor prompt, the schema and the model list are untouched —
and the panel's wording is chosen to be *true beside* the authored text, which is
visible in the inspector at the same time on a wide screen. Softening that
sentence is the owner's call.

**Nothing here touches the map, checked both ways.** No learner-model access:
choosing, learning, twenty rapid rounds, every disclosure and Reset left a
**populated** ten-mark model — this node and both prerequisites included —
byte-identical. Then one real explanation through the live assessor moved
`pretraining-vs-posttraining` **`blocked` → `known`** and left every other mark
unchanged. Zero network requests while driving the whole panel, and
`document.getAnimations()` is empty with it open.

**`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
display copy that `ExplainBack` renders and never sends, and this work changes
no prompt, schema or model-list file. One end-to-end assessed explanation was
submitted through the live path instead.

### Can it answer from the right notice? — 2026-09-14

On `experiment/16-rag`, branched from `main` after the one-piece-at-a-time
experiment merged. An experiment on `rag`, built to the same rule as the sixteen
before it: change something, inspect the consequence, optionally explain it. See
`docs/notice-search.md` for the verification tables and the limits.

**The second misconception is reachable in three presses.** A swimming pool with
five short dated notices, and one fixed question: *When does the pool close on
Saturday?* **Find a notice** ranks them and puts the top one into **What the
answer can use**. **Answer from this notice** gives *"The pool closes at 4pm on
Saturday"*, quoting the exact line it came from. Then **Try the older notice** —
the question does not move and neither does the answering rule, only the passage
does — and the same rule gives **6pm**, fluently, with a citation that really
does point at the line it used. That is the node's `simplificationCost` acted out
rather than asserted: *"a wrong retrieval yields a fluent, well-cited, wrong
answer, and that is harder to catch than an obvious invention."*

**The search is real, and the panel's sharpest sentence is a fact about the
function.** Each score adds up, per shared word, how often the notice uses it
divided by how many notices contain it at all. The 14 March notice comes top at
1.58 against 1.25 because it says "Saturday" three times to the January notice's
two — **because of how it is worded, not because it is newer**. `rank` never
reads `date` or `version`, and `retrieval.test.ts` replaces every one of them
with nonsense and requires the ranking and the scores to come back identical. The
collection is stored in a deliberately non-date order too, because ties go to
position in it and a newest-first list would make that tie rule a date preference
by the back door.

**`answerFrom(notice, question)` takes one notice**, so the collection is not in
scope where the answer is built — the same structural move as `answerWith` in
`phases.ts` and `answerFrom(request.included)` in `context.ts`. A test hands it
the one notice with no Saturday hours while every other notice in the collection
has them. It also takes the **subject from the matched line** rather than
assuming one, which is why handing it the café notice answers about the café; a
template that printed "the pool" regardless would be inventing the very thing
this node exists to correct.

**Nothing is called a meaning search.** No embedding distance is invented
anywhere. The panel says it is a keyword count, says real systems usually search
by meaning instead, and points at the word-neighbours experiment where positions
in space are real. The answer is labelled a template beside every answer it
produces, and *What this example leaves out* says a real language model in its
place can misread a good passage, blend two sources, or add a detail that is in
neither.

**Both honest cases are reachable, and neither is stated as a law.** *Is there a
sauna?* returns nothing at all rather than a closest guess — and the panel then
says a real system may hand over its best match anyway, and a model given a
passage that does not answer the question can still sound confident. Handing over
the lane swimming or maintenance notice gives **"This notice does not give the
answer"** rather than a time from somewhere else. The name card is earned only by
a real answer; a notice that gave none is a real outcome and is not that.

**Six defects found by measuring or driving, not by reading.** The first action
sat **657px** below the panel title at 320px against 286–525 across the siblings
measured as a control in the same run — **484 now, and 297 at 1230** — fixed by
moving the invented-content label beside the invented content and dropping the
phone-sized question to `text-xl`. A question button hung off the right at 320px,
the shared `Button` being `whitespace-nowrap` at a fixed height, which
`docs/saved-messages.md` already records. The change sentence repeated the stale
banner word for word, adjacent on one screen. The name card was unlocked by a
*no-answer*. The day was hard-coded as "Saturday", then lowercase once derived.
And the title, date and version ran together for anything taking the text rather
than the picture — *"Lane swimming times12 February 2026version 1"*. Seventeenth
time.

**A wrong probe, for the fourth time — and the tell was the same one.** The first
contrast run reported **identical figures in both themes**. The theme here is a
class on `<html>`, and the probe set `data-theme`, so both runs measured light
mode. Corrected by confirming `--surface-0` had actually moved before believing a
number: worst text **5.55** light and **7.89** dark, worst graphic **5.25** and
**6.12**. `--band-systems` is never printed as text — this is the first
`systems`-band panel, that band has not been measured against these cards, and
`BANDS_USED_AS_TEXT` in `globals.test.ts` still lists only `foundations`.

**And a trap reproduced while checking.** An early run showed the name card
appearing after a no-answer with the fix already in place. The cause was the
check: **a hash-only navigation is a same-document navigation, so React state
carries across it**, and the run inherited the previous one's state. Every case
was re-run through `about:blank` first, which is what
`docs/experiment-links.md` already records.

**Nothing here touches the map.** No learner-model access: searching, answering,
swapping notices, both honest cases, every disclosure, twenty rapid alternating
press rounds and Reset left a **populated** ten-mark model — `rag` itself and
both prerequisites included — byte-identical. Zero fetches, zero XHRs and zero
new resource loads while driving the whole panel, and `document.getAnimations()`
is empty with it open.

**No disagreement with an authored simplification.** The node's intuition is
exactly what the panel shows. Its `example` says the usual search step uses
embeddings; this one deliberately does not, names what it is instead, and points
at the experiment where they are real — narrower than the authored text rather
than in conflict with it. The graph, the assessor prompt, the schema and the
model list are untouched.

**`pnpm calibrate --explain --runs 3` was not run, and no assessed explanation
was submitted.** `EXPERIMENT_PROMPT` is display copy that `ExplainBack` renders
and never sends, and this branch changes no prompt, schema or model-list file.
The claim that nothing here moves a mark rests on the absence of learner-model
access and on the before/after storage reads, which is the same position
`docs/how-far-off.md` records. The last four sessions recorded that canary
failing on exactly two fixtures — 2/72 false passes for `hallucination/parroted`,
deliberately left failing, and 3/24 false blocks for `neuron/technical` — and
that remains the current state of the shared assessor.

### If it is still in the chat, why can’t the model use it? — 2026-09-13

On `experiment/14-context-window`, branched from `main` after the one-block
experiment merged. An experiment on `context-window`, built to the same rule as
the thirteen before it: change something, inspect the consequence, optionally
explain it. See `docs/what-gets-sent.md` for the verification tables and the
limits.

**Two lists, side by side, allowed to disagree.** A birthday-party chat whose
first message is *"The door code is 47A."*, and a card headed **Included in this
request**. The chat never loses a message; the request has 80 tokens of room.
One press of **Add more party notes** takes it over, the oldest message is
dropped, and that message is the door code — still on screen, visibly outside the
request, with the scripted reply changing to *"I cannot see a door code in the
messages I was given."* The fourth press drops **two** whole messages at once,
which is the rule acted out rather than illustrated: it removes as many as it
takes. Measured through the walk: 66 → 75 → 77 → 78 → 65, then 77 with the code
put back.

**The counts are real; the allowance is invented and labelled; the reply is
scripted and labelled everywhere it appears.** `cl100k_base` from the same pinned
`js-tiktoken` the tokenizer playground uses, in a worker — zero fetches and zero
XHRs while driving the whole panel. The 80-token allowance was chosen *after*
measuring the messages so one press visibly pushes the oldest out, and "How the
counting works" says it is not any real model’s limit. **There is no fallback
count:** with `window.Worker` replaced by a constructor that throws, the panel
reports it, offers a retry and shows no numbers at all, because a made-up count
is exactly what this node exists to correct.

**The scripted reply earns its place through its signature.** `answerFrom` takes
the included messages and nothing else, so "the reply can only use what was sent"
is the shape of the function rather than a promise in a comment — the same move
as `answerWith` in `phases.ts` and `learnFilter` in `junk-filter.ts`. A test
hands it a visible history full of door codes and an included list with none and
requires it to come back empty-handed. It reads the text, not a flag, and the
question *"What was the door code again?"* deliberately does not set it off.

**The four honest points, on screen and after the thing has happened.** Nothing
was forgotten — the message was not sent, and the chat belongs to the app. Other
apps do other things: refuse an oversized request, summarise the older part, keep
their own notes. Being sent is not the same as being used, so a bigger window
does not mean everything in it counts equally — the node’s second recorded
misconception, stated rather than left to the optional question. And what
training left in the model’s numbers is still there and is not part of this
request at all.

**A message too long to fit is a real boundary, and it leaves free tokens
behind.** 110 tokens against a capacity of 40. No amount of dropping older
messages helps, and everything older is held back with it — which is a
consequence of this app’s one rule, not a second decision. Free tokens beside a
list of things left out reads as a contradiction, so the card now says why.
Reaching past the blockage for something smaller would be *choosing other
material to send*, which some services really do and this one does not.

**The first action sat 568px below the panel title at 1440 and 734 at 320**,
against 286–521 across the thirteen sibling panels, with the button off the
bottom of the window at 1100x700. Sixteenth time a defect here was found by
measuring rather than reading. Copy trimming did not close it — three message
cards are 260px of it at 320 — so the fix was structural: the action moved to the
**top of the second column** with the request it changes directly beneath it, and
in one column the grid order became **action, chat, request**. **157–293 now, at
every width tested.**

**The stage is a container query, the first in this codebase, and that is the
point.** This panel is drawn inside the focused-map pane, which is about 664px
wide at a 1230px viewport and 768px at 1440. The viewport does not say whether
there is room for two columns here, so every `max-width` rule in `globals.css`
that tried would have been guessing.

**A wrong probe, for the third time.** The first contrast check resolved colours
by parsing `getComputedStyle`. Computed colours here come back as `lab(...)`,
which canvas `fillStyle` does **not** convert, so the parser read the three `lab`
numbers as `r, g, b` and reported **1.25 for everything in both themes** —
identical figures across themes being the tell, the same one the transformer
session recorded for an `oklch()` parser. Resolved by painting into a 1x1 canvas
and reading the pixel back, the worst text is **5.55** light and **7.89** dark,
and the worst graphic **4.16** and **6.89**. It then caught a real defect: the
meter’s reserve segment measured 1.77:1 against its track in one theme.

**Nothing here touches the map, checked both ways.** No learner-model access:
four notes, the resend, the long message in and out, every disclosure, forty
rapid alternating presses and Reset left a **populated** ten-mark model — both
prerequisites and both dependants included — byte-identical. Then one real
explanation through the live assessor moved `context-window` **`shaky` →
`known`** and left every other mark unchanged. `document.getAnimations()` is
empty with the panel open and driven.

**No disagreement with an authored simplification.** The node’s intuition says
the whole history is re-sent every turn, which is exactly what the panel shows,
and its `simplificationCost` is `null`. The one place the panel is more careful
than a casual reading is *"Nothing outside it exists as far as the model is
concerned"*, which is true of this conversation’s text and not of what training
left in the model’s numbers — so the panel says which, rather than proposing a
change. The graph, the assessor prompt, the schema and the model list are
untouched. `pnpm calibrate --explain --runs 3` was not run; `EXPERIMENT_PROMPT`
is display copy that `ExplainBack` renders and never sends, and one end-to-end
assessed explanation was submitted through the live path instead.

### What happens inside one repeated block? — 2026-09-13

On `experiment/13-transformer`, branched from `main` after the attention
experiment merged. An experiment on `transformer`, built to the same rule as the
twelve before it: change something, inspect the consequence, optionally explain
it. See `docs/one-block.md` for the verification tables and the limits.

**No architecture poster, and no arrows.** The node's recorded misconceptions
are that a transformer is a new kind of maths rather than an arrangement of
pieces already understood, and that its decisive advantage was raw quality
rather than parallel training. A diagram of labelled boxes teaches neither, and
an arrow between two words reads as one word choosing another — which is the
`attention` node's misconception, inherited here. So the first screen is a
five-word note about pets, its last word marked, two numbered stages, and **Run
one block**. Nothing on it says attention, residual, normalisation,
feed-forward, head, layer or token.

**It puts back exactly what the node admits it leaves out.** The
`simplificationCost` reads *"Position handling is left out here. Attention alone
treats a sentence as an unordered bag."* Each place has its own small row of
numbers, added once before the first block — and the claim is **proved rather
than asserted**: `transformer.test.ts` removes the place rows, shuffles the
earlier words, and requires the last word's result to come out byte-identical,
then puts them back and requires it to differ. Sharing clues adds contributions
up, and a total does not depend on the order the terms arrive in. This is the
first experiment whose subject is an authored simplification's own confession,
rather than a disagreement with one.

**The dimensions are deliberately unnamed, and that is the opposite call from
the panel next door.** `attention.ts` names its two columns so the blend can be
read, which is why `docs/words-around-it.md` records a disagreement with the
`embeddings` node's authored "nobody decided what any single dimension means".
Here the only thing to read is *that* the numbers moved and *when*, so nothing
needs a name and no new disagreement is created. **Nothing in this branch
changes the graph, the assessor prompt, the schema or the model list.**

**Which meant the payoff had to be readable without naming a dimension.** The
first build was mechanically clear and thin: press the button, three rows of
unnamed numbers appear, a sentence says they changed and then changed again.
True, and nothing to hold on to. Two fixes, neither of which invents a meaning.
`distanceMoved` is the straight-line distance between where a description was
and where it ended up — a real quantity, printed with its plain meaning in the
same sentence — so the two stages can be compared: **1.35** for sharing clues,
**3.14** for the calculation after. And the strongest single fact in the panel
was buried three sections down: the note uses *the* twice, both copies start
from the same three numbers, and after the block they are `0.20 · 0.35 · -0.51`
and `-0.46 · -0.98 · 0.75`. That card sits under the readout now, with both of
its reasons named, and the repeated word is **found from the sentence** so it
disappears rather than lying if the note ever changes to one without a repeat.

**A complete block, in the modern arrangement.** Rescale a copy, gather from the
earlier rows and itself, add the result back; rescale a copy, run a two-layer
calculation with a bend in the middle, add that back. Post-norm was built first
and rejected by measurement: after normalising every row, each row matches
itself most strongly, so the second block's gathering step moved the last word
by **0.007** and the panel would have been claiming a change it could not show.

**Causality and position-wise work are both signatures, not comments.**
`attendAt(rescaled, index)` slices and stops; a test swaps every word after a
position for different words and requires that position's gather and both its
stage rows to be identical. `feedForward(row, calculation)` takes one row, so
one row inside a block with wildly different neighbours gives the same answer as
running it alone.

**The expectations are held to a second implementation and to hand arithmetic.**
Asserting a measure against itself is the trap closed seven times already — by
decoding `bpe_ranks` independently, the least-squares conditions, brute force
over 65,536 pictures, hand arithmetic, answers worked out on paper, pinning to a
published file, and literal `Math.exp` calls. This one closes it an eighth way:
a plainly written implementation of the whole block lives in the test file and
imports nothing from the module but the constants, alongside anchors anybody can
check — the first word may use only itself, so it gets one share worth 1 and its
blend *is* its own rescaled row.

**Three defects found by measuring or driving, not by reading.** The result
sentence said "changed its numbers" twice in a row. Reset was offered on a
screen with nothing to reset, and at 390px wrapped onto its own row directly
above the panel's actual first action — **474px** below the panel title at 390
and **341** at 1230×842, now **418** and **285** with the motive line added. And
the "done" marker under each completed stage had no space in front of it, so it
read as "…earlier wordsdone" to anything taking the text rather than the
picture. Thirteenth, fourteenth and fifteenth time.

**A wrong probe, again.** The first contrast check read the numbers out of a
computed `oklch()` string as if they were `r, g, b` and reported everything
between 1.1 and 1.5 in both themes; the identical figures across themes were the
tell. Resolved through a canvas instead, the worst text is **5.55** and the worst
graphic **3.58**, both above their floors. `--band-language` is still never used
as text.

**A pre-existing condition, measured against its siblings rather than blamed on
this branch.** At 720×450 the focused-map pane is **20px tall**, and at 320×568
about 250px — for the `attention` and `embeddings` panels exactly as much as for
this one. Everything above it takes the rest of the window. Recorded, not worked
around.

**Nothing here touches the map, checked both ways.** No learner-model access:
running, swapping, twelve rapid swaps, every section opened and Reset left a
**populated** ten-mark model byte-identical. Then one real explanation through
the live assessor moved `transformer` **`unexplored` → `known`** and left every
other key unchanged, both prerequisites included. Zero network requests while
driving the whole panel, and `document.getAnimations()` is empty with it open.

**`pnpm calibrate --explain --runs 3` was not run.** `EXPERIMENT_PROMPT` is
display copy that `ExplainBack` renders and never sends, and this work changes no
prompt, schema or model-list file. The last four sessions recorded that canary
failing on exactly two fixtures — 2/72 false passes for `hallucination/parroted`,
which this file records as deliberately left failing, and 3/24 false blocks for
`neuron/technical`. One end-to-end assessed explanation was submitted through the
live path instead, and is reported in `docs/one-block.md`.

### Why can the same beginning get a different next word? — 2026-09-15

On `experiment/17-sampling`, branched from `main` after the notice-search
experiment merged. An experiment on `sampling-temperature`, built to the same
rule as the seventeen before it: change something, inspect the consequence,
optionally explain it. See `docs/picking-a-word.md` for the verification tables
and the limits.

**The panel next door asked for it.** `next-token.ts` has carried this line in
its header since it was written: *"The highest chance always wins, with a stated
tie rule. Choosing at random among the likely pieces is a different idea and
belongs to its own experiment."* This is that experiment, and because
`sampling-temperature`'s only prerequisite is `next-token-prediction`,
registering the id was enough for that panel's **Builds into** row to grow a
`Try it` button for it. Nothing in `deep-link.ts` needed touching either.

**One sentence, three endings, one button.** *In the garden I found a …*, with
flower 60%, stone 30% and dragon 10% beside it the whole time. Seven presses
gave flower, flower, flower, stone, flower, dragon, flower — and the chances
never moved. That is the node's first recorded misconception taken apart by
pressing rather than by arguing: the model does not *decide* to phrase things
differently, it hands out chances and something outside it draws one.

**Then two plain-language settings reshape the chances before the draw**, with
each row showing what it has now and what it started with. Read off screen:
78.3 / 19.6 / 2.2 for favouring the usual, 47.3 / 33.4 / 19.3 for the unusual,
100 / 0 / 0 for the top option — all matching the arithmetic by hand, where
favouring the usual squares each chance (0.36, 0.09, 0.01 over 0.46).
**"Always pick the top option" sits apart from the other two**, because it is a
different kind of choice rather than a very small temperature: no amount of
dividing reaches zero, and rounding towards it would misreport a decision
somebody actually made.

**The name comes last, and carries the node's second misconception.** Nothing
says *temperature* until a setting has been used and a real change is on screen.
The card then says it cannot make an ending more accurate, does not measure
imagination and has no way of checking whether an answer is true — and that
always taking the top option is a real choice, not a mistake, which is a softer
claim than the authored misconception makes. See the disagreement below.

**Written to survive small numbers.** `adjust` scores each chance as
`log(p) / T`, subtracts the largest score, takes `exp`, and rescales. That
subtraction is not tidiness: written the obvious way, at `T = 0.0005` the
largest weight is `exp(-1021)`, every weight underflows to zero, the total is
zero and every chance comes out `NaN`. The test asserts the naive form really
does total zero there. A panel printing `NaN` as a chance would be teaching the
exact thing this node exists to correct.

**The randomness is a parameter, and it is the repo's first.** There was no
`Math.random` anywhere in `src/` before this branch — the only generator was a
private, hard-coded-seed LCG inside `embeddings.ts`. `drawFrom(chances, random)`
takes the source in its signature rather than reaching for it inside, which is
what lets the tests drive exact boundary values and a seeded sequence;
`Math.random` is named once, at the call site in the click handler. And `adjust`
takes the starting chances as a parameter and returns a new array, so
"changing the setting does not change what the model produced" is the shape of
the function rather than a promise in a comment — the same structural move as
`answerWith(learned, distance)` in `phases.ts`.

**The fixtures are held to the power form.** `softmax(log p / T)` is
algebraically `p^(1/T)` normalised, computed in the test with `Math.pow`,
sharing no code and no intermediate value with the implementation. That is the
"do not assert the measure against itself" trap closed by a **tenth** route,
after `bpe_ranks` decoded independently, the least-squares conditions, brute
force over 65,536 pictures, hand arithmetic, answers worked out on paper,
pinning to a published file, literal `Math.exp` calls, a second whole
transformer block, and a naive scan of raw story text. The four settings are
held to **what they do rather than to their own copy**, and a test rejects a
verdict word — *best*, *worse*, *too far* — in any label: a label says how the
chance is spread, never how a draw will turn out.

**Four defects found by measuring or driving, not by reading.** The result
sentence went stale on a setting change — drawing "flower" at 60% and then
favouring the usual endings left the sentence reporting 60% beside a row saying
78.3%, a chance no longer on screen anywhere; the picks and the counts both
belong to one setting now, so changing it clears both and the panel says so. The
first action sat 482px below the panel title at 320px, against 149–525 across
four siblings measured as controls in the same run, fixed by moving the
"chosen for this example" label beside the chances it qualifies rather than in
front of the first action. The button sat about 90px below the sentence it
continues, because the chances card spans both grid rows and the slack from a
tall card was being shared out — **12px now, and 274 at 1230x842**. And the
"started at 60%" line was two pixels closer to its own row than to the next one,
so it read as a caption for the ending below it. Eighteenth time.

**A wrong probe, for the fifth time — and the tell was a new one.** The first
contrast run reported three setting buttons at **1.10:1 in dark mode and nothing
wrong in light**. The probe took the first non-transparent ancestor background
and painted it over an empty canvas, and dark mode's outline buttons carry a
*translucent* background, so it was measuring the label against near-black.
Compositing over black, which `docs/words-around-it.md` already records once.
Corrected by building the background from the outermost **opaque** ancestor
down: worst text **5.55** light and **7.89** dark, chance bars 3.83 and 8.62,
leading edges 4.18 and 9.50. `--band-language` is still never printed as text.
Every 1px hairline in the panel measures about 1:1 against what is behind it —
and so does every hairline in the `next-token` and `rag` panels, measured in the
same run, so that is shell-wide `--border` rather than anything this branch
introduces.

**Nothing here touches the map.** No learner-model access: forty rapid
alternating presses, every setting, a hundred batch draws, every disclosure and
Reset left a **populated** ten-mark model — `sampling-temperature` itself and its
prerequisite included — byte-identical. Zero fetches, zero XHRs and zero new
resource loads while driving the whole panel, and `document.getAnimations()` is
empty with it open at every width.

**A disagreement with the authored node, recorded rather than acted on.** The
node's misconception says greedy decoding *"in practice produces flat,
repetitive, looping text"*, and its example says temperature zero makes a model
*"near-deterministic"*. Both are fair about real language models and neither is
demonstrable in a closed list of three, where taking the top option is exactly
deterministic rather than near it. The panel says which is which on screen — that
the determinism here follows from the example being closed, that it is not a
promise about a deployed service, and that greedy choice is a real choice rather
than a mistake. **Nothing was changed**: the graph, the assessor prompt, the
decision schema and the model list are untouched.

**`pnpm calibrate --explain --runs 3` was not run, and no assessed explanation
was submitted.** `EXPERIMENT_PROMPT` is display copy that `ExplainBack` renders
and never sends, and this branch changes no prompt, schema or model-list file.
The claim that nothing here moves a mark rests on the absence of learner-model
access and on the before/after storage reads, which is the same position
`docs/how-far-off.md` and `docs/notice-search.md` record. The last five sessions
recorded that canary failing on exactly two fixtures — 2/72 false passes for
`hallucination/parroted`, deliberately left failing, and 3/24 false blocks for
`neuron/technical`.
