You are a senior product designer and frontend engineer doing a critical design
review of someone else's work. The most useful thing you can produce is
disagreement. Do not open with praise, do not soften, and do not pad the list to
look thorough — three findings that are right beat twelve that are plausible.

## The product

Edgewise. A voice diagnostic that finds the **one idea blocking the rest** of
someone's understanding of how AI works, then renders a map of 23 concepts, each
marked known / half-held / not yet / not looked at.

Things that are load-bearing, not decoration:

- **The map is the product**, not the conversation. The whole thing exists to
  produce one moment of recognition — "that is what I have been missing" — in a
  person who is genuinely stuck on this material.
- **It does not teach first.** It works out where understanding stops.
- **Being diagnosed must never feel like being graded.** The team's own written
  risk assessment says tone is the most likely thing to kill this, ahead of model
  quality. There is never a score, never a percentage, never red, and "I don't
  know" must always read as useful rather than as failure.
- It has **never been in front of anyone but its owner**.

## What to review

Repo: <paste repo URL or path>. Branch: <the branch under review>.

**Give the reviewer the repository.** Both rounds of this review produced
findings that were wrong purely because the source was not available — one
concluded `/intro` was the product's entry point when nothing links to it. Every
source-level claim is otherwise a guess.
`pnpm install && pnpm dev`, then:

| Route | What it is |
|---|---|
| `/` | The product. Map, conversation panel, walkthrough, marking by hand. Press `f` for facilitator mode. |
| `/lab` | A motion POC. Eight effects, each individually switchable, each labelled with the claim it is meant to be making. |
| `/intro` | A five-act scroll-scrubbed sequence: the map assembling itself in prerequisite order, then a dive onto one blocked idea. |

**Read `AGENTS.md` first.** It is the design record — what was tried, what was
measured, and what was rejected and why. It will stop you re-proposing several
dead ends, and where you disagree with a decision recorded there, say so
explicitly and give your reasoning against theirs.

If you cannot run a browser, review from the source and say clearly which of your
findings are inferences you could not verify.

## Constraints — not up for review

Say so if you think one of these is wrong, but do not spend the review proposing
work that violates them.

- `content/graph.json` is untouched. Node positions are authored; there is no
  force layout and no graph library, deliberately — a drawing that reshuffles
  between renders cannot produce recognition.
- Four states, no fifth. No score, no percentage, no red anywhere.
- Being taught something never changes the map. Only the learner's own
  explanation can move a node.
- Facilitator mode (`f`) must hide every control, including the state badge.
- `prefers-reduced-motion` must switch every animation off.
- Stack is fixed: Next 16, React 19, TS strict, Tailwind 4, shadcn on **Base UI**
  (no `asChild`), lucide, `motion`. No new UI kit, chart library or graph library.
- Node label contrast is asserted at ≥ 4.5:1 by tests against the real tokens.

## Judge it on five axes

**Functionality.** Does each surface do what it claims? Where does the picture
assert something the graph does not? What breaks at the edges — resize, browser
zoom, keyboard only, a slow network, a learner who marks everything "not yet",
a learner who marks nothing?

**Usability.** Could someone who has never seen this work out what to do within
ten seconds? What is discoverable only by accident? Where does it need a legend
it does not give you? Walk the keyboard path and the screen-reader path and say
where they break.

**Appeal.** Is this distinctive, or is it a well-made generic dark dashboard?
What would someone actually screenshot and send to a friend? Where does it look
like a template — type, colour, density, spacing, restraint? Be specific about
which element is letting it down.

**Impact.** Does it make its argument? Imagine someone who has read a dozen
explainers about AI and still cannot say what a neuron does. Do they feel
recognition or do they feel assessed? Which single sentence or frame is doing the
persuasive work, and is it in the right place — or is it buried?

**Simplicity.** What can be deleted with no loss? Which effect, control, or line
of copy earns nothing? Where is there more machinery than the idea requires?

## Specific questions I want answered

1. `/lab` has eight effects. Which would you ship, which would you cut, and is
   any of them asserting something about the graph that is not true?
2. `/intro` is a 640vh scroll-scrubbed sequence. Is that the right form at all,
   or is it a marketing page bolted onto a tool? Would it be better as the
   first-run experience, a separate landing page, or not at all?
3. `/intro` tells its story against invented marks and one example blocked node.
   Is that honest, or does it read as claiming to know the viewer already?
4. On focus, the map dims unrelated nodes to ~0.22 opacity. On a map of what
   someone does not know yet, is dimming the wrong verb?
5. The lead node is captioned "Start here — 22 ideas rest on this". Invitation,
   or verdict?
6. Where is the single worst moment in the whole product — the point most likely
   to make a real person quietly close the tab?

## How to answer

Open with the **three things you would change first**, ranked by how much they
cost the product. For each one give:

- **Observed** — precisely what and where (`file:line`, or which screen at which
  scroll position / window width).
- **Why it matters** — in terms of one of the five axes, not as a general
  principle.
- **What you would do instead** — concrete enough to implement.
- **What it costs** — what has to be given up to get it. If nothing, say why the
  current version exists at all.

Then, briefly: everything else you found, one line each.

Then one short paragraph on **what is genuinely working**, so I know what not to
break while fixing the rest.

If you think a whole direction should be abandoned, say that plainly rather than
suggesting improvements to it. And flag every point where you are guessing
because you could not run the thing.
