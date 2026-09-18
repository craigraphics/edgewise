# Brief — get the experiment panels off the landing route

Hand this to a fresh agent session. It assumes no prior context beyond
`AGENTS.md` and `docs/handover.md`, both of which must be read first.

This is finding 9 of the 2026-09-16 audit, deliberately deferred out of
`fix/03-phone-and-polish` (PR #35) because it is a mechanical refactor across
~45 files with no behavioural result, and did not belong in the same diff as
eight behavioural fixes.

---

## Your job

The landing route ships every one of the 22 experiment panels to somebody who
may never open one. Get them out of the first load without changing what any
panel does, what any mark means, or where any state lives.

**Deliver your own branch and your own PR**, per the branch-isolation rule in
`AGENTS.md`. Base it on `main` once PR #35 has merged.

---

## What is already measured

From a production `next start`, landing route, resource timing at 1230x842:

| | |
|---|---|
| JS over the wire | **508 KB compressed / 1734 KB raw**, 15 files |
| Largest single chunk | **215 KB compressed / 721 KB raw** |
| `src/components/experiments/*.tsx` | 386 KB of source |
| `src/lib/experiments/*.ts` (no tests, no workers) | 222 KB of source |
| `content/word-vectors.json` | 125 KB, real GloVe values |

The audit reported ~563 KB / 1.86 MB / 222 KB. Close enough that the difference
is measurement, not a regression.

**Reproduce the measurement before you change anything**, and report before and
after with the same method. `pnpm build && npx next start`, then read
`performance.getEntriesByType('resource')`, summing `encodedBodySize` over `.js`
entries. Do not quote figures from this file as your "before".

---

## Two things that are already true, so do not redo them

**The tokenizer worker is not the problem.** The audit says to lazy-load it; it
is already a separate chunk. `js-tiktoken` is reachable only from
`tokenizer.worker.ts` and `context.worker.ts`, both built with
`new Worker(new URL(…, import.meta.url))`, which Webpack and Turbopack both emit
as their own entry. **No app module imports `tokenizer-engine.ts`** — confirm
that with a grep before assuming otherwise.

**There is no `next/dynamic` or `React.lazy` anywhere in `src/`.** Whatever you
build is the first of its kind here, so it sets the pattern.

---

## Why the obvious fix does nothing

Every experiment file exports **both** its `use*Experiment` hook and its panel
component — all 22, confirmed. `src/app/page.tsx` imports all 22 **hooks** and
calls them at the top of `Page`, so wrapping the component in `next/dynamic`
inside `focused-map.tsx` removes nothing: the static hook import already pulled
the whole module and its dependency graph in.

So the hooks have to move into their own modules first. That much was known when
this was deferred.

## The part that was not known when it was deferred

**16 of the 22 hooks take their initial state from a constant in the same
`@/lib/experiments/*` module the panel uses** — `INITIAL_WEIGHTS`,
`FIRST_QUESTION`, `INITIAL_SET`, `FIRST_OPENING`, the opening dataset, and so
on. Some of those modules are small (`neuron.ts` is 18 lines). Several are not,
because the constant is the head of a corpus the whole experiment is built on:

```
agents.ts 16.9K   transformer.ts 16.5K   next-token.ts 16.1K
junk-filter.ts 15.5K   retrieval.ts 13.7K   sampling.ts 11.4K
context.ts 11.3K   generalization.ts 10.7K   embeddings.ts 10.5K
```

A naive hook split therefore drags most of `lib/experiments` straight back into
the landing chunk through the constants. **Measure which modules are actually
reachable from the hooks before deciding how to split**, rather than assuming
the split works.

Three shapes are available and they are not equally good. Pick per experiment
if you have to, and say why:

1. **Move the constant** into the small state module, leaving the lib module for
   the panel. Cheapest where the constant is a couple of numbers. Wrong where
   the constant is genuinely part of the subject being taught, because the lib
   module and its test are where that is held honest.
2. **Lazy initial state** — the hook starts empty and the panel supplies the
   opening dataset on mount. Changes semantics: check that resetting and
   re-entering still behave, and that nothing reads state before the panel has
   mounted.
3. **Leave that one alone.** A panel whose constant is inseparable from its
   corpus may simply not be worth splitting. Eighteen of twenty-two is a win.

`embeddings` is the easy one and the biggest: its hook holds only strings and
booleans, so the 125 KB of word vectors moves out with no argument at all.

---

## Constraints you must not break

- **Experiment state lives at page level and survives view changes.** This is a
  recorded requirement — weights, results and unfinished explanations survive
  navigating away and back. The hooks stay in `Page`; only the rendering moves.
- **`clearMap()` in `page.tsx` calls `.reset()` on all 22 hooks**, including
  panels that have never been opened. If a hook moves inside a lazily-loaded
  component, that breaks silently and "Clear my map" stops clearing experiment
  progress. There is a confirmation dialog promising it does.
- **`playExperiment` focuses the panel's title in a `requestAnimationFrame`**
  (`EXPERIMENT_TITLE_ID`). With a dynamically imported panel the title does not
  exist on the next frame. Decide deliberately where focus goes while a panel is
  loading, and do not leave a keyboard user on nothing. Note that
  `fix/03-phone-and-polish` already found and fixed the same class of bug in the
  skip links — `requestAnimationFrame` is not a promise that React has
  committed.
- **A loading state is a visible state.** Whatever appears between the press and
  the panel has to be legible, must not shift the first action once the panel
  lands, and must not claim anything about the learner. The first-action
  distance below the panel title is a measured property of every panel in this
  repo; do not regress it.
- **Nothing here may move a mark.** Read `edgewise.learner.v1` before and after
  driving several panels and require it byte-identical, against a *populated*
  model, not an empty one.
- **`FocusedMap` takes all 22 hook returns as named props.** You may find a
  better shape while you are in there. If you change it, it is a separate commit
  with its own reason — `registry.ts` states plainly that it is a lookup table
  and not a framework, and that adding an experiment still means rendering it
  explicitly.

---

## Verify

- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Before/after bytes by the method above. Report the largest chunk too, not just
  the total — one 215 KB chunk is a different problem from fifteen small ones.
- Open **every** experiment from a cold load and confirm it renders, then leave
  and return and confirm its state survived.
- Both bundlers, or say which you ran. Next 16 defaults to Turbopack; this
  repo's docs record `pnpm build --webpack` as the fallback, and the two chunk
  `next/dynamic` differently.
- The layout probe in `AGENTS.md` at 390, 660, 1230 and 1440, **after a resize**.

## Report honestly

If the win turns out to be smaller than the effort, say so and say what the
remaining weight is. A measured "this is not worth it, and here is why" is a
good outcome. The failure mode to avoid is a large mechanical diff that moves
40 KB and reads as progress.
