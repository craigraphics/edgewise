# Reaching an experiment — a button on the focused view, and a URL

On `experiment/08-experiment-links`, branched from `main` after the
one-step-at-a-time experiment merged. Two things the owner asked for:

> on the focus tab, it would be nice to have a button that takes directly to
> the experiment so create a button for all the ones that have experiments. if
> i am inside a certain section like for example text as tokens, i want to be
> able to reach to that part from an url

Nothing about the graph, the states, the assessor, or what any mark claims
changes here. This is navigation.

## What was wrong

The focused view draws an idea, its prerequisites and its dependants. Seven of
the twenty-three ideas have an experiment, and **the only one reachable from
that view was the idea in focus** — through an invitation card at the bottom.
Everything else was: select the neighbour, wait for the view to redraw, scroll
down, press the card.

And the invitation itself was hard to reach. Measured at 1230x842, the laptop
viewport this project records as the common case, on the focused view's own
default idea:

| | Before | After |
|---|---|---|
| Invitation top, below the panel title | 576px | **325px** |
| Its action on screen at all | **no** | yes |

That is the same defect the one-step-at-a-time panel recorded three days ago —
first action too far down — in a different place, and it was found the same
way: by measuring instead of reading.

## What it does now

**Every neighbour that has an experiment carries a `Try it` button.** It is a
second control on the existing card, not a second invitation: the card's own
press still opens the idea, and the button's accessible name is the
experiment's — "Try the tokenizer playground", out of `EXPERIMENT_ACTION` in
the registry, so it can never read as an unlabelled "try" beside a heading it
does not belong to.

**The invitation moved above "Builds into" when the idea in focus has its own
experiment.** The general neuron invitation, which appears on ideas that have
none, still comes last, where it cannot compete with the idea being read. One
invitation per view still holds; this is only where it sits.

**Two URL forms, both hand-typable.**

```
#idea/tokens   the idea's text, in the guide panel
#play/tokens   its experiment, open and playing
```

A bare `#tokens` is accepted as the idea, because that is what somebody types,
and the app rewrites it to the canonical form. The address bar follows wherever
you go, so the link to send is the one already in the window.

### Three decisions, with reasons

**`replaceState`, never `pushState`.** Selecting an idea is panel state, not a
page. Pushing would bury the back button under twenty-three entries and make
leaving the site a chore. The URL is here to be copied, reloaded and sent — not
stepped through. Back and forward across a *real* navigation are still
followed, via `popstate`.

**An unknown id lands on the ordinary first screen.** `#idea/transformers`
resolves to nothing rather than to an empty panel, which is what a stale link
would otherwise look like: an app that failed to load.

**`#play/<id>` for an idea with no experiment falls back to the idea.**
Experiments are added one at a time. A link written today for an idea whose
experiment does not exist yet, or one whose experiment is later removed, still
arrives somewhere true.

### Why the hash is a subscription and not a store

`persisted.ts` and `use-media.ts` read their external systems with
`useSyncExternalStore`, because components render from those values. Nothing
renders from the hash. A link is an *event* — somebody arrived, pasted,
reloaded, or pressed back — and the app responds by moving. So `use-hash.ts`
is a subscription with a callback, and the hash already in the address bar is
delivered through that same callback rather than read separately on mount. One
path in, so a pasted link and a hand-edited one cannot disagree.

That shape was not chosen for tidiness. The obvious version — read the hash in
an effect and call `setState` — is exactly what
`react-hooks/set-state-in-effect` rejects, and the rule's own text names the
alternative: *"Subscribe for updates from some external system, calling
setState in a callback function when external state changes."* The lint error
was right about the design, not just about the line.

## What driving it found

**`#idea/tokens`, typed while the tokenizer was open, left the experiment
running.** Selecting an idea used to leave an experiment by accident: the
focused view moves to the new idea, and `playing` is false anywhere but on the
idea being played. It did not happen when the idea was the *same* one — so the
URL said one thing and the screen showed another. `openNode` now stops the
experiment explicitly, and `playExperiment` sets it back immediately
afterwards.

This only appeared because the browser treats a change of fragment on the same
document as a fragment navigation rather than a reload, so a probe that walked
several links in a row carried React state across all of them. The cases were
then re-run through `about:blank` between each, as genuine cold loads. **Worth
keeping: a hash-link test that does not reload is testing something else.**

**The row's `overflow: hidden` would have clipped the focus outline.** Making
the neighbour a row with two buttons inside it, clipped to its own corner
radius, hides a 3px-offset outline on either of them — an accessibility defect
introduced by a purely visual line. The right-hand control carries the inner
radius itself instead and nothing clips. Verified with a real Tab press:
`:focus-visible` true, and the outline drawn outside the card.

## Verified

Measured in the browser against `pnpm dev`, dark and light.

| Check | Result |
|---|---|
| `#play/<id>` for all seven experiments | opens that lab, focuses its title |
| `#idea/<id>` | opens the idea, no lab |
| Bare `#tokens` | opens the idea, URL rewritten to `#idea/tokens` |
| `#play/<id>` on an idea with no experiment | opens the idea, URL rewritten |
| `#idea/transformers`, `#play/transformers` | ordinary first screen, nothing selected |
| Pressing `Try it` on a neighbour | opens that lab; URL becomes `#play/loss` |
| Editing the hash while the app runs | moves to the new place |
| Back after a real fragment navigation | returns to the previous place |
| Focus → Full map while playing | URL drops to `#idea/<id>`, lab closes |
| Full map → Focus | URL returns to `#play/<id>`, lab reopens |
| Escape | closes the idea, URL cleared |
| Invitation action on screen at 1230x842 | yes (was off the bottom) |
| `Try it` target size, 390–1440 | 79x66 |
| `Try it` target size at 320 | 79x88 |
| Page scroll, 320 / 390 / 768 / 1100 / 1230 / 1440 | 0 both axes |
| Region clipped past the right edge, same widths | 0 |
| Neighbour labels clipped at 320 | none |
| Tab order | each idea, then its own `Try it` |
| Focus outline on `Try it` | visible, not clipped |

Every cold-load case was loaded through `about:blank` first, so none of them
inherited state from the case before it.

`pnpm test` 500 passing, `pnpm lint`, `pnpm typecheck`, `pnpm validate-graph`
and `pnpm build` all clean.

## Not verified

- **No phone.** The narrow widths were measured in a resized desktop window,
  which is the same gap this project already records for Android voice.
- **No screen-reader session.** The `Try it` buttons carry the registry's own
  action text as their accessible name and the tab order was read out of the
  accessibility tree, but that is not VoiceOver or NVDA.
- **Nothing about whether people find the buttons.** They are reachable and
  measured; whether a stranger presses them is the validation gate, still open.
