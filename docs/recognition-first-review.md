Repo: https://github.com/craigraphics/edgewise

Reviewed branch: `intro-from-main`, local base `4041bdb`.
Proposal branch: `proposal/recognition-first`.
Working checkout: `/Users/willcraig/Documents/Codex/2026-09-10/create-an-image-of-2/work/edgewise`.

# Edgewise: recognition before ceremony

## Three findings

1. **The introduction delays the product and repeats the pitch.** On a fresh visit,
   the 22-second prelude is followed by the welcome dialog, then another screen
   with a start button. The welcome contains roughly 400 words and repeats the
   same flow that the idle conversation describes. Browser verification also
   found that Tab moves from Skip into the hidden mode switch: the prelude says
   `aria-modal` but does not trap focus. Its welcome promises “Nothing is sent
   anywhere,” contradicting the actual request path. I disagree with the design
   record's claim that a shared storage key makes this one gate: it fixes repeat
   visits, not the three sequential steps on a first visit. Remove the gate and
   put the invitation, data disclosure, and real action on the working surface.

2. **The phone overview exchanges understanding for silhouette.** The record
   explicitly accepts 5.1px labels because tapping opens readable text. That
   requires identifying an idea before its name can be read. I disagree with
   that tradeoff. The SVG's edges also carry no accessible relationship text;
   announcing a node's name and state cannot convey what rests on it. The
   proposal adds a 16px concept list in prerequisite order, with exact incoming
   dependencies written out, and prerequisite links in every inspector. It uses
   full-size map/conversation views on narrow screens, avoiding both previously
   rejected stacked half-panes and a map hidden under a sheet. Selecting moves
   focus to the idea's heading; closing restores focus to the originating node.
   Draft answers survive the trip.

3. **The conversation offers the wrong action when it matters most.** After
   diagnosis the original primary action is Start over. After a request failure
   the text box is disabled and no retry exists. Those are the two moments when
   the learner most needs a continuation. The proposal ends on Explore this
   idea, with the actual lead concept named. Failure offers Retry this turn,
   Connection settings, and the locally authored walkthrough. Retry reuses the
   exact request and does not duplicate the learner's answer. Reset invalidates
   an in-flight response so it cannot refill a cleared map. A 45-second timeout
   gives an unresponsive request a recoverable end.

## The design argument

**Functionality:** The prerequisite graph still decides the lead and downstream
count. No decorative edge, new state, or generated explanation has been added.
The list and the drawing read the same model. Known, half-held, not yet, and not
looked at remain distinct. The walkthrough still cannot upgrade a mark.

**Usability:** The first useful action is visible without an overlay. Two skip
links give keyboard access to the conversation and map. The inspector writes out
relationships that were previously visual only. Map nodes gain a visible keyboard
focus outline; mode buttons use pressed semantics instead of incomplete radio
semantics. Screen-reader announcements expose the current question and failures.
The legacy ring's hidden “0 of 23 ideas solid” score is removed with the ring.

**Appeal:** The weak element was the masthead/idle panel combination: a generic
subject title with a byline, an empty circular score, and a small “Start here”
heading after a large cinematic entrance. Edgewise itself barely appeared.
The proposal uses a compact Edgewise wordmark, a clearly separated reading panel,
and the existing Newsreader face at a meaningful size. The particular screen
worth sharing is a selected idea with its prerequisite links and the actual
number of later ideas built on it. A decorative animation is not the artifact
this product needs people to remember. This is a design judgment, not a measured
preference or proof of virality.

**Impact:** “Read the explainers. Still not clicking?” now sits beside the actual
start button. It addresses the specific reader without diagnosing their ability.
The structural result appears with an action on the idea. Returning visitors get
neutral “Your map, ready to revisit” copy; a completed map does not get invited
to find a nonexistent gap. No global score is displayed or announced.

**Simplicity:** Remove the forced prelude, welcome dialog, progress ring, and
three-stop sheet from the product. Keep `/intro` optional, with Read without
animation and a persistent exit. Its “whole subject” claim is narrowed to “A map
of the essentials”: 23 authored concepts are a selection, not all of AI. Keep
`/lab` as an isolated five-effect experiment, clearly labeled with illustrative
marks and a way back to the product. I agree with the recorded rejection of
magnetism, aurora, and decorative press motion; there is no case to restore them.

## Validation

- Dependencies installed from the existing lockfile and local pnpm cache.
- All 320 existing tests pass. Lint, typecheck, and production build (`pnpm build --webpack`) pass. The final Turbopack run was blocked by the environment when its CSS worker tried to bind a port; Webpack completes the same production routes.
- Real browser verification of `/`, `/intro`, and `/lab`; not a source-only review.
- Real Google-backed diagnostic: “I don't know” marks the root `blocked`, ends
  placement, and offers Explore this idea. Opening it shows the authored content.
- Browser-injected offline test: retry sent the same answer and same history;
  the answer appeared exactly once. A simulated late success after reset neither
  rendered its message nor wrote a mark. These two cases are controlled UI tests,
  not claims about provider behavior under an actual outage.
- A draft survived opening/closing a concept. Focus moved to `concept-title` and
  returned to the originating SVG node.
- All 23 blocked, all 23 known, and empty models render without a crash. Blocked
  marks are recognized as existing progress; they do not require any known mark.
- Hand-mark key 2 writes `shaky`; `f` hides header, probes, marking controls, and
  zoom buttons; Escape restores the controls.
- Resize sequence: 1920×1080 → 1440×900 → 1100×800 → 1099×800 → 820×768 →
  390×844 → 320×568 → 720×450. Zero page overflow and zero workspace-region
  clipping in every measured frame. Narrow-screen list labels remain 16px.
- Reduced-motion emulation: `/intro` renders the text version without a hydration error; `/lab` has zero running animations. The intro now isolates its scroll hooks from the text-only tree.
- 720×450 exercises the CSS viewport equivalent of a 1440×900 window at 200%
  browser zoom. This is not a claim that native browser zoom was tested.

## Limits and next evidence

Keyboard and accessibility-tree checks were run; VoiceOver/NVDA speech output and
physical Android microphone behavior were not. Resize emulation is not a handset.
The graph's curriculum validation is still outstanding, as recorded in AGENTS.md.
Assessor prompts, schema, model list, and graph were not changed; calibration was
therefore not rerun. No claim of increased users or conversion can be made from
this review. The next useful evidence is the original recognition gate with a
new learner: can they begin unaided, identify their next idea, and explain why
other ideas depend on it?
