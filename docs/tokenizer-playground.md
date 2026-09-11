# The tokenizer playground — `tokens`

An experiment on **Text as tokens**, built to the same rule as the neuron:
change something, inspect the consequence, optionally explain the mechanism.
Reached from the concept's inspector ("Try the tokenizer playground") and from
its own invitation on the focused map, and rendered in the main workspace beside
the existing explanation.

## It uses a real encoding, and says which one

`js-tiktoken` **1.0.21**, pinned exactly, running `cl100k_base` from the
vocabulary shipped in that package. It runs in a Web Worker in the browser: no
API key, no request, nothing transmitted. Verified — while typing, the page made
zero `fetch` calls, zero XHRs, and loaded no new resources.

The panel names the encoding on screen and states what the number is **not**: not
universal, not a word count, not an estimate from characters, not Gemini billing,
and not the tokenizer Edgewise's own assessor uses. Counts belong to this
encoding and are described that way.

If the worker cannot start or load, the panel says so and offers **Retry local
tokenizer**. There is no fallback count, because a made-up number here would
teach the exact thing the node exists to correct.

## What it shows

Type or paste, and the actual pieces, their vocabulary IDs, and the total update
live. Spaces and line breaks carry visible marks (`␠`, `↵`, `⇥`) so they cannot
hide inside a piece; the underlying text is never altered, and `decodeTokenization`
round-trips every fixture byte for byte.

Clicking **or focusing** a piece connects it to its ID and says the ID is a lookup
key, not a measure of meaning. Keyboard focus alone is enough — verified.

**Byte fragments are shown as bytes.** `cl100k_base` is byte-level, so one token
often holds only part of a character. Those render as `bytes E8 AA` with their own
separate IDs rather than as `�`. Corrupting the text to make the display tidy
would misrepresent the mechanism being taught.

## The examples are computed, never asserted

Six editable examples: a sentence, the strawberry question, an unusual word,
spacing and punctuation, emoji, and Japanese. The node's authored explanation
asks why a model miscounts the r's in "strawberry", so that is offered as an
example — but nothing hardcodes a count.

That restraint earned its keep immediately. In "How many r's are in strawberry?"
the piece is **` strawberry`, a single token (ID 73700)** — the folk claim that
strawberry is three tokens is wrong in this position, and a hardcoded sentence
would have taught the wrong thing on the node about not trusting surface claims.

## Nothing here touches the map

The experiment has no learner-model access. Typing, selecting, resetting, and
finishing all leave every mark untouched, verified by reading the stored model
before and after a full session. Only the existing assessed explanation and
`upgrade` path can raise this concept, and prerequisite and dependant marks are
unchanged. The follow-up question — *"Why can the number of tokens differ from the
number of words?"* — opens the existing `ExplainBack` with an **empty** field and
a disabled submit. No answer is drafted for the learner.

## Asynchronous work, bounded

Tokenizing runs in a worker behind a 100ms debounce. Every request carries an id
and only the newest response is accepted, so rapid edits cannot paint a stale
result. Input is capped at **12,000 characters** with the limit shown next to the
field, and clipping never splits a surrogate pair.

## What was verified in a browser

Chrome, against the dev server, with the app driven in a real window at exact
viewport sizes.

| Check | Result |
|---|---|
| Live count and IDs | Real `cl100k_base` IDs (`The`=791, `␠cat`=8415, …) |
| Empty input | `0 ordinary text tokens`, zero pieces, honest message |
| Repeated spaces, newlines | Own pieces, exact round trip |
| Joined emoji, Japanese | Byte fragments, separate IDs, no `�` |
| Rapid edits | Latest input retained, pieces rejoin to the final text |
| Keyboard focus on a piece | Connects piece to ID without a click |
| 320px wide | No page scroll, nothing clipped, no control off-screen |
| 720x450 with a long explanation | Page never scrolls; guide is the single scroll owner; final control reachable and visible |
| Navigation (Focus → Full map → Focus) | Text, count, selection and an unfinished explanation all preserved |
| Reset | Returns to the opening example; marks untouched |
| Animations in the panel | None, so reduced motion has nothing to suppress |
| Network while typing | Zero fetches, zero XHRs, no resource loads |

**Tap targets:** measured at 320px, the example chips came out at **28px** under
`size="sm"`, below this project's recorded 40px floor. They are `size="touch"`
now and measure 40px. That rule is in `AGENTS.md`, and only measuring caught it.

## Tests — `src/lib/experiments/tokenizer.test.ts`

The reference fixtures are the point. IDs and bytes are asserted against
**the raw rank table decoded independently**, not against the encoder that
produced them, so the expectations and the implementation cannot be wrong
together. That check parses `bpe_ranks` itself and holds every emitted ID to the
pinned vocabulary, whose size it also pins at 100,256.

Covered: exact round trips, empty input, repeated spaces, newlines, punctuation,
combining marks (decomposed and precomposed are different token runs), joined
emoji, non-Latin text, special-token spellings treated as ordinary text, byte
fragments, clipping at and past the limit, and stale-response rejection.

## Limits, stated in the panel

One encoding among many; other model families use different vocabularies and
boundaries. The playground adds no chat framing and no invisible special tokens,
and strings that look like special markers are encoded as ordinary text.

## Not verified

The error and retry path was reviewed in code but never triggered in a browser —
there is no honest way to fail the worker from outside. Nobody has run this on a
physical phone; the 320px checks were a real Chrome window at that width.
