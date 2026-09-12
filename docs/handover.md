> **Representation playground, 2026-09-12:** On `experiment/03-representation`,
> branched from merged `main`. Two 4x4 pixel grids on the
> `features-and-representation` node, with average brightness against the full
> ordered list, computed from the actual cells and local to the browser. Read
> `docs/representation-playground.md` for what was verified and what was not.
> It also fixes the dead "Explore this idea" control on the focused card, which
> the owner reported and which predates the branch. Its PR targets `main`.

> **Predictor experiment, 2026-09-11:** On `experiment/02-learning-from-examples`,
> branched from merged `main`. A real least-squares fit on the
> `prediction-from-examples` node, local to the browser, with the fit held as a
> deliberate snapshot and an underdetermined fit reported rather than invented.
> Read `docs/learning-from-examples.md` for what was verified and what was not.
> Its PR targets `main`.

> **Tokenizer playground, 2026-09-11:** On `experiment/01-tokenizer`, branched
> from merged `main`. A real `cl100k_base` tokenizer on the `tokens` node, local
> to the browser. Read `docs/tokenizer-playground.md` for what was verified and
> what was not. Its PR targets `main`.

> **Scroll fix:** The guide owns scrolling for static
> side-panel content; the walkthrough reading area cannot collapse to zero.
> See the side-panel scroll correction in `AGENTS.md`.

> **Playable proposal, 2026-09-11:** Continue on `proposal/playable-map`.
> Read `docs/playable-map.md` for the focused map, neuron experiment, and checks.
> The recognition-first proposal below is included in this branch.

> **Current proposal, 2026-09-11:** On `proposal/recognition-first`, read
> `docs/recognition-first-review.md` and the final section of `AGENTS.md` first.
> They supersede the entry gate, mobile sheet, and progress ring decisions below.
> The historical handover follows unchanged so the reasoning remains reviewable.

# Where things stand

Written at the end of the session that built `/intro`, the first-run prelude and
two rounds of design-review fixes. For whoever picks this up next.

**Read `AGENTS.md` first.** It is the design record — what was tried, measured
and rejected, and why. This document does not repeat it. It covers the things
that would otherwise be lost: what is in flight, what was decided and on what
evidence, what was deliberately *not* done, and the traps that cost time.

---

## 1. State of the repo

| | |
|---|---|
| Default branch | `main`, at `668003e` (PR #5, the motion lab) |
| Open work | **PR #6** — branch `intro-from-main`, three commits, not merged |
| Merged this session | #4 (node corner fix), #5 (motion lab) |

PR #6 contains `/intro`, the first-run prelude, the pruned lab, and every fix
from both design reviews. It is based on `main` at `668003e` with nothing
missing. If `main` has moved, rebase before merging.

### Routes

| Route | Status |
|---|---|
| `/` | The product. |
| `/intro` | Five-act scroll sequence. **Unlinked and reachable only by URL** — deliberately, see §4. |
| `/lab` | Motion POC, five effects. **Unlinked**, same reason. |

`pnpm dev`, then all three work. `pnpm lint`, `typecheck`, `test` (291),
`build`, `validate-graph` all pass on PR #6.

---

## 2. What was built, in one paragraph each

**`/intro`** — the map assembling itself in prerequisite order, then a dive onto
one blocked idea and what rests on it. It exists because the product's premise
had only ever been *stated* in a first-run dialog. The graph is not a claim
needing assertion; it is a shape, and a shape can be shown.

**The prelude** (`src/components/overture/prelude.tsx`) — the ~22-second version
for a first visit, skippable, followed by the existing welcome dialog. One gate,
one storage key, because two separately-dismissed first-run screens is two
modals in a row.

**Both run off one timeline.** `src/lib/map/overture.ts` takes a single number
`t` and returns the camera, every node's and edge's reveal state, and the line
being said. `/intro` scrubs `t` from the scroll; the prelude runs the identical
functions on a clock. That is why they cannot drift, why scrubbing backwards
works, and why a five-act cinematic can be tested without a browser.

**The lab** — down from eight effects to five. Each now carries a `claim` (what
the movement asserts) and a `trigger` (the only thing allowed to fire it in the
product). Cut: magnetism, aurora, press.

---

## 3. The two design reviews

An external model reviewed the work twice. Both rounds are summarised in
`AGENTS.md`; what follows is the part that is easy to lose — **what was refuted,
and the evidence**, so nobody re-litigates it from scratch.

### Accepted, and acted on

- Dimming for focus was an accessibility failure (measured 1.62:1 / 1.84:1).
- `/intro` was delivering a verdict to somebody who had not spoken.
- `0 of 23 solid` was a score, against this project's own written rule.
- The live question could scroll out of view.
- One "I don't know" ended the session and then interpreted the learner's life.
- The bottom sheet was appearing on desktop — see below, this one was subtle.
- The lab was a shelf of effects rather than a decision tool.

### Refuted, with the evidence

**"`/intro` is the primary entry."** It is not, and nothing links to it. A grep
for any `href` to `/intro` or `/lab` across the shell, header, tools menu and
main page returns nothing. The reviewer could not read the source and inferred
it. The *recommendation* inside the finding — a short first-run version — was
good and was built, as an addition rather than a replacement.

**"The CTA returns after a long, mostly faded sequence."** Measured across the
whole scroll in thousandths: the longest stretch with no caption above 5%
opacity is **0.053**, and it is in act two, not the tail. There is a test
asserting this stays true.

**"Start here — 22 ideas rest on this" is a verdict.** Disputed and kept. The
caption names the graph and never the person, and it is true in both states —
with no marks the lead node is the root, so it says "start at the beginning";
after a diagnosis it is computed from the learner's own answers. The proposed
replacement ("A useful place to explore next") traded a true specific statement
for a vague one. **If this comes up again, that is the argument.**

**"The unlock wave implies being taught unlocked a chain" / "Cascade suggests
downstream concepts are understood."** Correct principles, but neither was
happening. Both are now structurally guaranteed rather than merely true —
`src/lib/map/unlock.ts` compares the model before and after, so wiring the wave
to the walkthrough produces no wave.

### The one I got wrong

I dismissed *"the bottom sheet reads like a mobile pattern on desktop"* as the
reviewer being under the 1280 breakpoint. Then I maximised a window to 1680px
and measured: `innerWidth` was still **1230**. A 14-inch laptop cannot reach
1280, so the two-column layout never appeared on the most common screen this
will ever run on. The breakpoint is 1100 now.

**The lesson worth keeping:** an assumption about somebody else's viewport is
still an assumption. Measure it.

---

## 4. Decisions that are deliberate

Do not revert these casually. Each has a reason and most have a test.

**Focus is additive; nothing recedes but edges.** `src/lib/map/focus.ts`. There
is no opacity that both dims usefully and keeps a muted label legible — at 0.65,
barely dimmed, `unexplored` labels are still at 2.79:1. Beyond legibility: this
is a map of what somebody does not know yet, and making the unreached parts
disappear says *excluded* rather than *ahead*.

**`/intro` and `/lab` are unlinked.** A testing harness in the main navigation
is a mistake this project has already made once. `/intro` in particular presents
the map as something to watch rather than to read, and putting it in anybody's
way is a product decision the owner has not made.

**The prelude stops before the dive.** Singling out one node has to be earned by
answers. The first ten seconds make the structural argument and then offer.

**The closing is split.** The structural half — "eleven of the later ideas rest
on this one" — is always said. The interpretive half — "which is why so much of
the rest has probably felt slippery" — waits for three answers.
`src/lib/session/closing.ts`, tested.

**State is the signal; the band is grouping.** Band accents are quiet on
purpose. Four state glyphs, six topic hues and a blue focus ring were competing
on twenty-three small cards and only one of those vocabularies is about the
learner.

**One name for the layout breakpoint.** `--breakpoint-panel` in `globals.css`
and `SHEET_QUERY` in `use-media.ts` must stay equal. The layout is chosen in
JavaScript and drawn in CSS; when they drifted, the panel rendered on top of the
map.

---

## 5. Open questions — for the owner, not for an agent to decide

1. **Should the closing ever interpret?** It currently does, at three answers.
   The alternative is that it only ever states structure. `AGENTS.md` calls that
   sentence the most important in the product, so it was not removed
   unilaterally.
2. **Should `/intro` be linked, and from where?** It works. Nobody can find it.
3. **Should the welcome dialog lose its first two paragraphs?** The prelude now
   makes the premise visible; the dialog earns its place on the two rules nobody
   would guess, not on re-arguing the premise in prose.
4. **Which lab effects graduate into the product?** Cascade, light pool and
   camera glide are the strongest case. Current and the unlock wave are close.
   The wave must only ever be wired to explain-back.
5. **Voice on Android is fixed but unverified on hardware.** The listener was
   rebuilt as a turn-scoped state machine against Chrome for Android's one-shot
   recogniser, and `src/lib/voice/listener.test.ts` models each failure — but a
   test that reproduces documented behaviour is not a phone. The check is: open
   the **deployed** URL on an Android handset (not `http://<laptop>:3000`, which
   is an insecure origin and refuses the microphone), answer three questions out
   loud, and confirm all three register. Detail under "Android" in `AGENTS.md`.
6. **The validation gate has still never been run on anyone but the owner.**
   This is the oldest open item in the project and none of this work touches it.
   Everything here is a guess about a stranger until then.

---

## 6. Traps that cost time in this session

- **`motion` writes its own `transform-origin`.** A hand-set one next to
  `x`/`y`/`scale` is silently replaced with `50% 50%`. The camera scaled about
  the middle of the drawing rather than the content origin, so every shot at any
  zoom but 1× sat a few hundred units off. It never looked broken — it looked
  like compositions that would not quite centre. Use `originX`/`originY`.
- **A CSS `transform` replaces an SVG `transform` attribute** on the same
  element rather than composing with it. This has now caused two separate bugs.
  Split into an outer group that positions and an inner one that animates.
- **`requestAnimationFrame` stops in a background tab.** Timing from a fixed
  start timestamp means the first frame after somebody returns carries the whole
  wall-clock gap. Accumulate clamped deltas.
- **shadcn here is Base UI, not Radix — there is no `asChild`.** Use
  `buttonVariants()` on a `<Link>`.
- **A JSX `{/* */}` comment cannot sit beside a sibling element** inside a
  ternary branch. Merge it into the preceding plain comment.
- **A comment saying "Chrome does X without complaint" means desktop Chrome.**
  `use-mic-level.ts` opened a second microphone capture alongside recognition on
  that basis. True where it was measured; on Android the two compete for one
  input and recognition loses, silently. Fourth time a measurement in this
  project was aimed at the wrong quantity — this time the wrong *device*.
- **Tests that measure the design do not measure the runtime.**
  `globals.test.ts` asserted 11.60:1 while the interface multiplied it by 0.22.
  This is the third time this project has shipped something because the
  measurement was aimed at the wrong quantity. When adding a visual rule, ask
  what the *painted* value is, not what the token says.

---

## 7. How to verify things

- **Layout:** the probe in `AGENTS.md` under "Layout and wording". Run it
  **after a resize**, not only after a load — that gap hid a shipped bug.
- **Contrast:** `pnpm test` covers tokens (`globals.test.ts`) and the focused
  state (`focus.test.ts`). Neither needs a browser.
- **The overture:** `overture.test.ts` covers act boundaries, reveal order,
  camera continuity (walked in thousandths), caption timing, and that no caption
  presumes the viewer's state.
- **Scrubbing `/intro` by hand:**
  ```js
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo(0, max * 0.79);   // the dive
  ```
- **Freezing an animation to inspect a frame:**
  ```js
  document.getAnimations()
    .filter(a => a.animationName === 'lab-ripple')
    .forEach(a => { a.pause(); a.currentTime = 430; });
  ```

---

## 8. Working notes

- **The owner does not want "Generated with Claude Code" or session links in PR
  descriptions.** Commit trailers have not been objected to.
- **The owner prefers BrowserOS neo** for browser work, over MCP. In this
  session its MCP server refused the connection at startup (it was launched
  afterwards), so the connected Chrome was used instead; `/mcp` reconnects it.
- Work in small reviewable commits whose messages say *why*.
- `docs/design-review-prompt.md` is the prompt used to commission the reviews.
  It is written to get disagreement rather than compliments, and both useful
  rounds came out of it. Reuse it.
