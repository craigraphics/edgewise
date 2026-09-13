# Which words might belong together? — the `embeddings` experiment

Branch `experiment/09-embeddings`, branched from `main` after the experiment-links
work. An experiment on the `embeddings` node, built to the same rule as the eight
before it: change something, inspect the consequence, optionally explain it.

## The question, the first action, the result

| | |
|---|---|
| **Opening question** | Which words might belong together? |
| **First action** | Press one of four word buttons — `guitar`, `garden`, `coffee`, `football` — measured 286px below the panel title at 1230x842 |
| **Result sentence** | "The nearest words to **guitar** are bass, drums, piano, keyboard and guitarist." / "Nearby means their lists of numbers are similar." |

The connection to the idea already explored is one sentence, in the intro:
*"You saw how text becomes pieces. Now see how lists of numbers let a computer
compare one word with another."*

## Where the numbers come from

**GloVe 6B, 100 dimensions** — Wikipedia 2014 + Gigaword 5. Pennington, Socher
and Manning, *"GloVe: Global Vectors for Word Representation"*, EMNLP 2014.
<https://nlp.stanford.edu/projects/glove/>

Released under the **Open Data Commons Public Domain Dedication and Licence
(PDDL) v1.0**, which is why a slice of it can be checked into this repository.
`scripts/extract-word-vectors.ts` copies 163 words out of `glove.6B.100d.txt`
into `content/word-vectors.json`, rounded to four decimal places, and refuses to
emit a partial collection if the release does not carry a word it was asked for.

**Kind of values: static.** One fixed list per word, learned from how often words
appear near each other across that corpus. Deliberately *not* the
context-dependent values a language model computes for a token inside a
particular sentence — the node's second recorded misconception is exactly that
confusion, so `SOURCE.kind` is `'static'` and a test asserts it.

**No random numbers anywhere.** Every number on screen is read from that file or
computed from it.

## What the panel does

- **Two slots.** Pick a first word, see its five nearest words with the
  similarity each scored. A second slot then appears, offering the other three
  opening words plus a search field and the full 163-word list.
- **The comparison.** Once both are chosen: *"guitar and coffee score 0.18
  against each other, while guitar and bass score 0.85."* Then the point —
  nobody sorted these words into topics for the computer.
- **See the numbers.** The first 8 of 100 values for each chosen word, and the
  sentence that no single number means anything on its own.
- **One word, one list.** `mouse` comes back as cat, rabbit, dog, keyboard,
  screen, computer — both meanings mixed into one saved list, because these are
  static vectors. The card then says what a language model does instead.
- **A flat picture, if you want one.** Optional, and behind a toggle.

## The honest parts

**The grouping is ours; the neighbours are the numbers'.** The 14 everyday areas
exist so a word can be found. The panel says so, and the collection is chosen so
that several words land somewhere else entirely: `rock` is filed under Outdoors
and sits with `band`, `album`, `song`, `jazz`; `hedge` is filed under the garden
and sits with `money`, `bank`, `cash`. Both are asserted in
`embeddings.test.ts` rather than described in the copy.

**"The picture leaves a lot out" is a count, not a claim.**
`projectionDisagreesWith` compares each word's nearest neighbour in the two
dimensions against its nearest neighbour in the full lists: **146 of the 163
words differ**, and the panel prints that number. A test requires the
disagreement to cover more than half the collection, so if the claim ever
stopped being true the test would fail rather than the copy misleading somebody.

**Neighbours are never read off the drawing.** `neighboursOf` uses all 100
numbers. `guitar`'s nearest word in the full lists is `bass`; in two dimensions
it is something else, and there is a test saying so.

**The projection is deterministic.** Power iteration needs a starting direction,
and a random one would move the picture between two readings of the same
collection. The seed is fixed, the sign is pinned to the loading of largest
magnitude, and a test requires two calls to be identical.

**A word that is not in the collection is said to be missing.** There is no
nearest-guess and no invented list. Typing `aubergine` says it is not in this
small saved collection; a typo like `guitarr` retries on shorter openings and
offers `guitar`; when nothing at all matches, the four opening words stand in.

**An unusable collection reports why.** `invalidReason` rejects a list of the
wrong length, a value that is not a finite number, and an all-zero list — the
last of which would otherwise divide by zero and print `NaN` as if it were an
answer.

**No prediction step.** The learner has been given nothing they could use to work
out which words will come back, and this project already forbids asking somebody
to guess an unexplained number. The interesting move is one press and reading
what comes back, so every change shows at once.

**Everyday words first.** "List of numbers" and "used in similar ways" carry the
whole first screen. *Embedding*, *vector* and *cosine similarity* appear only
inside "How the comparison works", and cosine similarity is named in the same
sentence that explains it.

## The trap this closes, by a sixth route

Asserting a measure against itself is the trap the tokenizer closed by decoding
`bpe_ranks` independently, the predictor by checking the least-squares
conditions, the representation playground by brute-forcing all 65,536 pictures,
the loss panel by hand arithmetic, and the generalization panel against answers
worked out on paper.

Here the similarity is checked against **the same quantity computed a different
way** — the straight-line gap between the two lists once each is scaled to
length 1, which shares no arithmetic with the dot-product form — plus fixtures
anybody can check in their head (identical lists score 1, a right angle scores 0,
opposites score −1, scaling a list changes nothing). The shipped values
themselves are pinned to the opening numbers of the `guitar` and `garden` lines
of the published release, so regenerating the file from some other source of
numbers fails the test rather than quietly changing what the panel calls meaning.

## Verified

| Check | Result |
|---|---|
| `pnpm test` | 544 passed, 31 files |
| `pnpm lint` | clean |
| `pnpm typecheck` | clean |
| `pnpm build --webpack` | compiled, 8 static pages |
| First action below panel title, 1230x842 | **286px** (siblings: 334 / 431 / 445 / 471 / 520) |
| First action below panel title, 320x568 | 415px |
| Page scroll, 1230x842 / 320x568 / 720x450 | 0 in both axes at all three |
| Region clipped past the right edge | 0 at all three |
| Controls under 40px in this panel | none at any of the three |
| Controls off the right edge | none at any of the three |
| Last control reachable, 320x568 and 720x450 | yes, by scrolling the guide pane (pane is 150px tall at 720x450 and still scrolls) |
| Keyboard: every focusable scrolled into view when focused | 8 of 8 at 320x568 and at 720x450 |
| Flat picture width at 320 | 242px, inside its own container |
| `document.getAnimations()` with the panel open | **0** — no motion at all, so reduced motion has nothing to suppress |
| Missing word | `aubergine` reported as not in the collection, with words that are |
| Reset | returns to the one-slot first screen; marks unchanged |
| Trip away and back (Full map → Focus) | both words, the open numbers and the open picture all survive; URL returns to `#play/embeddings` |
| Unfinished explanation across a surface change | a half-typed draft survived Your map → This idea at 720 wide |
| Light and dark | both read; the band is used for the bars and the card edge, never as text |

**Marks are untouched by everything in the panel.** Checked against a populated
model — ten real marks including this node, both its prerequisites and three of
its dependants. Choosing words, changing them, typing a missing word, opening the
numbers, opening the two-meanings card, opening and closing the picture, and
resetting all left stored state byte-identical, read before and after.

**One real assessed explanation, end to end.** Submitted through the live
`/api/explain-back` path, it moved `embeddings` **`shaky` → `known`** and left
every other key unchanged — `tokens`, `features-and-representation`, `neuron`,
`prediction-from-examples`, `training-vs-inference`,
`generalization-overfitting`, `loss`, `gradient-descent` and `attention` all at
the state they started in. The explanation form opens empty with a disabled
submit; only that path can raise this concept.

## The assessor canary

`EXPERIMENT_PROMPT.embeddings` is **display copy only** — `ExplainBack` renders
it and never sends it, so the assessor prompt, the decision schema and the model
list are untouched by this work.

`pnpm calibrate --explain --runs 3` was run anyway, for current evidence. **It
fails**, on the two fixtures the previous session already recorded as failing:

```
false passes   2/72   hallucination/parroted -> known  (x2)
false blocks   3/24   neuron/technical -> blocked      (x3)
everyday words accepted          12/12
jargon-with-mechanism accepted    9/12
misconception flag set           12/12
latency  median 1078ms  max 7990ms
cost     $0.04988 for 72 calls

VERDICT: FAILS. It clears blocks on explanations that do not earn it.
```

`hallucination/parroted` is the case `AGENTS.md` records as deliberately left
failing rather than tuned away. `neuron/technical` was one false block in the
generalization session and is three here — worse, on the same unchanged
fixtures, prompt and model. That is run-to-run variance in the shared assessor
and it is not evidence about this experiment, which has no fixture in this
canary. It is the current state of that canary and must travel with the work
rather than be summarised away.

## Not verified

- **No phone and no screen reader.** Everything above is a desktop browser with
  the viewport emulated. A VoiceOver or NVDA pass would be a different and
  stronger check, particularly on the neighbour rows, where the word and its
  score are two cells with a decorative bar between them.
- **The flat picture is not interactive** and carries a single `aria-label`
  describing what it is. Every fact it shows is also printed as text, so the
  panel is complete without it, but nobody has read the page with the picture
  open using assistive technology.
- **`sr-only` was deliberately not used anywhere in this panel**, on the recorded
  grounds that an absolutely positioned hidden span inside one of this app's
  scrolling panes escapes the shell's clip and adds page scroll. The consequence
  is that a screen reader hears `bass 0.85` with the meaning of the number
  carried by the sentence below the list rather than by the row itself.
- **163 words is a small collection.** Every neighbour on screen is the nearest
  *within it*. The panel says so; nobody has checked how a learner reads that
  qualification.
