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

### Side-panel scroll correction and experiment handoffs — 2026-09-11

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

The owner requested prompts only for the next experiments. Ten standalone
handoffs are in `docs/experiment-prompts/`; `docs/experiment-handoffs.md` contains
the complete pack. They cover the other ten concepts in graph layers 0–3, with
tokenization first. No tokenizer or other new experiment was implemented here.
