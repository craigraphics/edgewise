# Audit brief — Edgewise

Hand this to a fresh agent session. It assumes no prior context.

---

## Your job

Audit a working web app called **Edgewise**, in this repository.
Find what is broken, what is dishonest, and what does not feel right in use.

**Report what you actually find, including "this part seems fine."** A clean
finding is useful. An invented one is not. If you cannot verify something, say
so rather than inferring it from the code reading well.

**Prefer evidence over reasoning.** Every real defect in this project so far was
found by instrumenting something — a calibration harness, a pixel-counting
script, a canary key — and not by thinking harder about the code. Two prompt
rewrites that "obviously" fixed a bug did not, and only a harness showed it.
Where you can measure a claim, measure it.

---

## What the thing is

A learner wants to understand how AI works. The premise is that the hard part is
not finding explanations — it is that you do not know what you are missing, so
you cannot ask for it.

So it works in three phases:

1. **Diagnose.** A short spoken or typed conversation that finds where the
   learner's understanding stops.
2. **Show.** A map of 23 concepts with prerequisite edges, each marked
   `known` / `shaky` / `blocked` / `unexplored`. The map is the product.
3. **Teach.** A walkthrough of all 23 in order, whatever the diagnosis found.

One rule holds the whole thing together: **being taught something never moves
the map.** Only an explanation the learner produces themselves, judged to hold
up, can clear a block.

Stack: Next.js 16, React 19, TypeScript, Tailwind 4. Google AI Studio models via
the Vercel AI SDK. No database — progress lives in `localStorage`.

Read `AGENTS.md` in the repo root for the full design record. **Read it
critically**: it was written by the agent that built this, and it argues for its
own decisions.

---

## Getting it running

```bash
# from the repo root
pnpm install
pnpm dev            # localhost:3000
```

`.env.local` already holds a Google AI Studio key and a session secret. Other
commands:

```bash
pnpm test            # 80 tests, pure logic
pnpm typecheck
pnpm lint
pnpm validate-graph  # structural invariants on content/graph.json
pnpm calibrate --runs 3           # the diagnostic assessor
pnpm calibrate --explain --runs 3 # the assessor that clears blocks
pnpm leak-probe      # does a failed model call leak an API key into logs
```

Calibration costs roughly $0.01–0.03 per run against a free tier. Do not run it
in a loop.

---

## Use it before you read it

Spend twenty minutes as a learner first, in Chrome, with the microphone on. Do a
full diagnostic, let the walkthrough run, try explaining something back. Form an
impression before the code colours it.

The questions that matter most are not answerable from source:

- **Does it feel like being tested?** This is the risk the project fears most.
  Being probed on what you do not know is uncomfortable, and voice makes it
  worse because you cannot skim back. Note any moment that felt like a judgement
  rather than a conversation.
- **Does the map produce recognition, or a shrug?** When it names the one idea
  blocking the rest, is that interesting or obvious?
- **Does anything feel like it is grading you?** There should be no score, no
  count of correct answers, no "not quite".
- **Where does it stall, confuse, or make you re-read?**

---

## Specific things to attack

### 1. Can you fool the assessors?

Two model-backed judges decide what goes on the map. Try to break each by hand,
through the running app.

- **Get a false pass.** Produce an answer that clears a block without
  understanding anything. Fluent terminology with no mechanism is the known weak
  spot — try harder versions of it.
- **Get a false block.** Explain something correctly in plain, clumsy, everyday
  language with no jargon at all, and see if it refuses you. The product claims
  everyday words beat correct terminology; test that claim rather than trusting
  it.
- **Try answering a different question** than the one asked, and see whether it
  records a verdict about you anyway.

### 2. The calibration that is currently failing

`pnpm calibrate --explain --runs 3` reports **7 false passes in 60**. The
previous agent's stated conclusion was that several fixtures are mislabelled —
that answers like *"updating parameters in the direction of the negative
gradient"* are jargon but do state the mechanism, so passing them is correct.

**Decide independently whether that is sound reasoning or a rationalisation of a
failing test.** It is exactly the shape an excuse takes. Read
`content/fixtures/explain-back.ts` and form your own view. If the fixtures are
genuinely wrong, say what the corrected ones should be. If the model is wrong,
say that instead.

### 3. The graph nobody has checked

`content/graph.json` — 23 concepts, 33 prerequisite edges, hand-authored by one
person and **never cross-checked against an established curriculum**. This is
the oldest open risk in the project.

A wrong edge routes learners down a bad path with a clean diagram lending it
authority. Confidently wrong is worse than vague.

- Are the prerequisites actually prerequisites? Does anything depend on
  something it does not need, or miss something it does?
- Are the `misconceptions` real misconceptions people hold, or strawmen?
- Are the `explanations` correct? **Teaching something false is this product's
  worst failure**, and there is no mechanism protecting against it beyond the
  authoring being careful.
- Is `simplificationCost` honest — does it name what that telling actually costs?

### 4. The key handling

Learners may supply their own Google API key. Trace every path it takes and try
to find one that was missed. The previous audit checked failure logging with a
canary key and added a CSP. Look for what it did not check.

### 5. Robustness

- Break the network mid-turn. Break it mid-walkthrough.
- Supply a malformed or hostile request body to the three API routes.
- Corrupt `localStorage` and reload.
- Open two tabs and use both.
- **There is no error boundary.** Confirm what a client-side throw does to a
  session in progress.

### 6. Accessibility and device coverage

Keyboard-only navigation, screen reader behaviour on the map, focus management
in the modals, contrast in both themes. Try a tablet-sized viewport. The layout
was audited at 1200×797, 844×768 and 640×820 — check sizes between and outside
those.

---

## What the previous agent believes, so you can disagree with it

State plainly where you think any of these are wrong.

- The map, not the conversation, is the product.
- A cheap model plus a constrained action set beats an expensive model — the
  flagship cost 4× and was slower for identical calibration results.
- Rules that matter belong in the schema and enforced in code, not in the prompt.
  Three prompt rewrites made a bug measurably worse before this was accepted.
- The diagnostic traversal and the teaching traversal must stay separate
  functions even though they look mergeable.
- Teaching steps make no model call at all, so the content is reviewable and free.
- "I don't know" is the most informative answer a learner can give.

---

## Report back

Ordered by how much each finding actually matters, not by where you found it.

For each: what it is, how to reproduce it, and what it costs the learner. Mark
clearly which findings you **verified** and which you **suspect**. Separate
correctness bugs from things you would have designed differently — both are
worth saying, and conflating them wastes the reader's time.

Finish with the two judgements that cannot be measured:

1. **Would you give this to someone who is genuinely stuck on this material?**
2. **Does the map tell you something about yourself you did not already know?**

If the answer to either is no, say so directly and say why. That is more useful
than a list of small fixes.
