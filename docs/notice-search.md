# Can it answer from the right notice? — `rag`

An experiment on **Retrieval (RAG)**, built to the same rule as the sixteen
before it: change something, inspect the consequence, optionally explain the
mechanism. Reached from the concept's inspector ("Try the notice-search
experiment"), from its own invitation on the focused map, from a neighbour's
`Try it`, and at `#play/rag`.

## The learning spine

| | |
|---|---|
| **Opening question** | *How can AI answer from a notice it was never trained on?* |
| **First action** | **Search the notices** |
| **Result sentence** | *"The search picked Saturday opening hours, 14 March 2026. “Saturday” gave it the lead with three matches. It has not answered yet — it has only chosen the text the answer may read."* |
| **The payoff** | **4pm → 6pm**, beside *"Same question. Same answering rule. Only the notice handed to it changed."* |
| **The connecting sentence** | *"A request can include extra text. Search helps choose which text to include."* |

## The shape of it

Marlow Lane Pool has five short notices on its website. The question is fixed at
the top of the panel and never moves: *When does the pool close on Saturday?*

**Search the notices** ranks all five and puts the top one into a card headed
**Notice sent with the question**. **Answer from this notice** builds a short
answer from that passage and quotes the exact line it came from, with the
notice's title, date and version beside it — no hover needed anywhere.

Then **Try the older notice**. The question does not change and neither does the
answering rule. Only the passage does. The answer already on screen is marked
stale rather than silently recomputed, and one more press runs the same rule on
the January notice: *"The pool closes at 6pm on Saturday."* Fluent, correctly
cited into a real line, and last winter's closing time. **Restore the current
notice** puts it back.

The two results no longer have to be remembered. Once both exist, the main flow
shows them together as **Before · 14 March · 4pm** and **Now · 6 January · 6pm**,
then names the invariant: same question, same answering rule, only the notice
changed. The RAG definition and Explain-back prompt follow that comparison
before the ranked collection; search details support the idea rather than
delaying it.

The whole walk, driven in the browser:

| Press | Handed over | Answer | Citation |
|---|---|---|---|
| Search the notices | Saturday opening hours · 14 March 2026 · v2 | — | — |
| Answer from this notice | (unchanged) | The pool closes at **4pm** on Saturday. | line 1 of the 14 March notice |
| Try the older notice | Saturday opening hours · 6 January 2026 · v1 | marked stale, not rebuilt | — |
| Answer from this notice | (unchanged) | The pool closes at **6pm** on Saturday. | line 1 of the 6 January notice |
| Restore the current notice | 14 March again | marked stale | — |
| Answer from this notice | (unchanged) | The pool closes at **4pm** on Saturday. | line 1 of the 14 March notice |

## The ranking is real, and checkable by hand

Every score is counted from the text of the five notices. For each word of the
question that survives the common-word list, the score adds **how often this
notice uses it, divided by how many notices contain it at all**.

The default list is compact: title, date, version, score and matching words.
Handing over any result reveals its complete text in **Notice sent with the
question**, so every score remains inspectable without making five full passages
part of the main reading path.

| | score | shared words |
|---|---|---|
| Saturday opening hours · 14 March 2026 · v2 | **1.58** | pool ×1 · close ×1 · saturday ×3 |
| Saturday opening hours · 6 January 2026 · v1 | 1.25 | pool ×1 · close ×1 · saturday ×2 |
| Poolside café hours · 1 March 2026 | 0.67 | close ×1 · saturday ×1 |
| Pool closed for maintenance · 2 March 2026 | 0.50 | pool ×2 |
| Lane swimming times · 12 February 2026 | 0.25 | pool ×1 |

"pool" is in four of the five, so it is worth a quarter each time it appears;
"close" and "saturday" are in three, so a third. The current notice's whole lead
is one extra "Saturday" — it says it in its title and in both its lines.

### That is the sharpest line in the panel

The current notice came first **because of how it is worded, not because it is
newer**. `rank` never reads `date` or `version`, and that is enforced rather than
asserted: `retrieval.test.ts` replaces every date and version in the collection
with nonsense and requires the ranking and the scores to come back identical. So
the panel's sentence — *"This search never looks at the dates or the versions"* —
is a fact about the function, and it is why an out-of-date notice can be handed
over without anything noticing.

The collection is also stored in a deliberately non-date order, because ties are
broken by position in it. If that list were newest-first the tie rule would
quietly be a date preference, which is the exact thing the panel says is not
happening. There is a test for the ordering.

## Two things are the shape of a function, not a promise in a comment

- **`rank` cannot read a date.** Described above.
- **`answerFrom(notice, question)` takes one notice.** The collection is not a
  parameter, so it is not in scope where the answer is built — the same
  structural move as `answerWith(learned, distance)` in `phases.ts` and
  `answerFrom(request.included)` in `context.ts`. The test hands it the one
  notice with no Saturday hours while every other notice in the collection has
  them, and requires it to come back empty-handed.

It also takes the **subject from the matched line** rather than assuming one.
That is why handing it the café notice answers about the café: a template that
printed "the pool" regardless would be inventing the very thing this node is
about. There is a test.

## What is invented, and what is a template

**Invented, and labelled on screen beside the notices:** the pool, its five
notices, and every date and time in them.

**A template, and labelled beside every answer it produces:** the answer. It
finds one line of the supplied notice that names the day the question asked about
and gives a closing time, and repeats that line's subject and time. It is not a
language model and the panel never lets it be read as one. A template is used on
purpose — it isolates the effect of the retrieved passage, because it can only
repeat what it was handed. *What this example leaves out* says the rest: a real
language model in its place can misread a good passage, blend two sources, or add
a detail that is in neither.

**Never invented:** no embedding distance appears anywhere here, and keyword
matching is never called a search by meaning. The panel says which it is, says
real systems usually do the other, and points at the word-neighbours experiment
where positions in space are real.

## The honest cases, both reachable

- **Nothing matched.** *Is there a sauna?* under "Try another example". No notice
  contains the word, so the search returns an empty result and says so, rather
  than its closest guess. There is no passage to hand over and no answer to
  build. The panel then states the other half, because the honest case here is
  not a general law: a real system may hand over its best match anyway, and a
  model given a passage that does not answer the question can still produce
  something confident-sounding.
- **This notice does not give the answer.** Press **Use this one** on the lane
  swimming or maintenance notice and answer from it. The rule stops rather than
  taking a time from another notice, and the sentence beside the button says why:
  *"The rule was handed Lane swimming times, 12 February 2026, and it can use
  nothing else."*

The name card — *"Search finds a passage. The passage goes into the request. The
answer reads it. That is retrieval, or RAG"* — is earned only once a real answer has been produced. A
notice that gave no answer is a real and useful outcome, and it is not that.
Its first two points name the mechanism at that moment. The citation warning,
the hallucination warning and **Explain what happened** wait until the learner
has actually produced two different answers; they no longer describe a contrast
that has not happened yet.

## The node's two misconceptions, on screen after the fact

1. *Believing retrieval adds knowledge to the model.* — **"The notice is not
   learned. In a real RAG system, a copy goes into the current request. Training
   stays untouched."**
2. *Assuming retrieval fixes hallucination.* — **"A citation is not a truth
   check."** And, immediately above it, the thing the learner has just done: an
   answer built from the January notice cites a real line perfectly and gives
   last winter's closing time.

The `simplificationCost` — a wrong retrieval yields a fluent, well-cited, wrong
answer — is the whole second half of the experiment rather than a sentence.

## Verified

Chrome via BrowserOS neo, against `pnpm dev`.

| Check | Result |
|---|---|
| Panel title → first action, current 660×619 workspace | **323px** |
| Action → supplied passage, 660×619 workspace | **12px** (was **1,109px**) |
| First completed answer, same workspace | source and the complete **4pm** answer fit together in the viewport |
| Completed contrast, same workspace | **4pm** and **6pm** visible together in one card |
| Page scroll, seven widths 320–1920 | **0** vertical, **0** horizontal |
| Clipped right / controls off right | **0 / none**, at every width |
| Same, **after resizing a loaded page** through all seven | **0 / none** |
| Tap targets inside the panel | all **≥40px**, every width |
| Focus stops in the panel | **12**, all with a visible outline, all scrolled into view |
| Last control + fully expanded prose | reachable by keyboard; the guide keeps scroll ownership |
| Contrast, light (canvas pixel read-back) | worst text **5.55**, worst graphic **5.25** |
| Contrast, dark | worst text **7.89**, worst graphic **6.12** |
| `--band-systems` printed as text | **never** — bars and leading edges only |
| Network while driving the whole panel | **0 fetches, 0 XHRs, 0 new resource loads** |
| `document.getAnimations()` | **0**, open and driven |
| Learner model, populated with ten marks | **byte-identical** before and after |
| Reset from every state | returns to the pristine first screen |
| 20 rapid alternating press rounds | ends consistent; answer and sentence agree |
| Leave to another idea and come back | search, supplied notice and answer all survive |
| Close the explanation and reopen it | the typed draft survives |

The seven-width and resize rows in this table were measured before the final
copy/ordering pass. The structural layout did not change after the 44rem
breakpoint fix, but that full matrix has not been repeated.

The ten-mark model used for the invariance check included `rag` itself and both
its prerequisites (`context-window`, `embeddings`), not an empty one.

## Defects found by measuring or driving, not by reading

1. **The first action sat 657px below the panel title at 320px**, against 286–525
   across the sibling panels measured as a control in the same run. The intro
   paragraph was five lines, the invented-content label had a line of its own
   above the first action, and the question was set at `text-2xl` on a phone.
   The label moved to sit beside the invented content where it belongs, the intro
   lost a sentence the panel says elsewhere, and the question is `text-xl` below
   `sm`. **484 now, and 297 at 1230.** Seventeenth time a defect in this project
   was found by measuring rather than reading.
2. **A question button hung off the right at 320px.** The shared `Button` is
   `whitespace-nowrap` at a fixed height, so a whole question in one overflowed a
   276px column — the same defect `docs/saved-messages.md` already records.
   Wrapping, auto-height now.
3. **The change sentence repeated the stale banner word for word.** Both said
   *"The answer below still came from the 14 March 2026 notice."*, adjacent on
   one screen. The sentence beside the button now says what to do next; the
   banner says what the answer below still is. The same pass stopped the change
   sentence repeating the answer text, which the answer card carries in its own
   `aria-live` region.
4. **The name card was earned by a *no-answer*.** Pressing Answer on the lane
   swimming notice unlocked *"what just happened has a name"* when nothing had
   been answered. It counts real answers now.
5. **The day was hard-coded as "Saturday"**, then lowercase once derived. It
   comes out of the question and is title-cased for the sentence it sits in.
6. **Three facts ran together for anything reading the text** rather than the
   picture: *"Lane swimming times12 February 2026version 1"*. The flex gap
   separated them visually and nothing separated them otherwise. Plain commas
   now separate title, date and version in both the picture and the accessibility
   tree.
7. **The action and its consequence separated by 1,109px at a real workspace
   width.** At 660×619, the container crossed the old two-column breakpoint, and the
   tall notice list made the shared grid row 1,296px high. **What the answer can
   use** began at 1,721px while the action ended at 612px. The action, supplied
   passage and answer are one flow now; the passage begins 12px after the action
   at the same width. The side-by-side layout now waits for 44rem of room, so a
   compact pane does not squeeze the notices into a 225px column.
8. **The closing claimed a contrast before the learner had made one.** After
   the first answer, the panel already said *"The same question gave two
   different closing times"*, exposed the January citation lesson and offered
   Explain back. Those now wait for two real answers whose times differ, with a
   pure helper and unit test holding the gate.
9. **The finished app could scroll down into an empty page.** The first fix for
   defect 6 used absolutely positioned `sr-only` commas. Their static positions
   came from deep inside `.focus-map`, escaped the scrolling pane's clip, and
   made the document 1,475px tall around a 619px app shell. This is the same
   trap already recorded in `generalization-experiment.tsx`. Visible commas need
   no duplicate accessible text: the document is 619px tall again, a forced
   window scroll stays at zero, and both inner panes still reach their own ends.
   `/intro` remains intentionally scrollable (3,961px in the same viewport).

## A wrong probe, recorded rather than hidden

The first contrast run reported **identical figures in both themes** — the tell
this project has now recorded three times. The cause: the theme here is a class
on `<html>` (`light` / `dark`), and the probe set `data-theme`, so both runs
measured light mode. Corrected by setting the class and confirming
`--surface-0` actually moved (97.8% → 3.3% lightness) before believing a number.

The colours themselves were resolved by painting each into a 1×1 canvas and
reading the pixel back, never by parsing `getComputedStyle` — computed colours
here come back as `lab(...)`, which canvas `fillStyle` does not convert.

## A trap reproduced while checking

An early run showed the name card appearing after a no-answer *even with the fix
in place*. The cause was the check, not the panel: **a hash-only navigation is a
same-document navigation, so React state carries across it**, and the run was
inheriting state from the previous one. Every case was re-run through
`about:blank` first. `docs/experiment-links.md` records the same lesson.

## No disagreement with an authored simplification

The node's intuition says the passage is pasted into the context window
alongside the question and that the model has learned nothing, which is exactly
what the panel shows. Its `example` says the usual search step uses embeddings;
this one deliberately does not, says so in its own words, names what it is
instead, and points at the embeddings experiment — so it is narrower than the
authored text rather than in conflict with it. The graph, the assessor prompt,
the decision schema and the model list are untouched by this branch.

## Not verified

- **No end-to-end assessed explanation was submitted.** `EXPERIMENT_PROMPT` is
  display copy that `ExplainBack` renders and never sends, and this branch
  changes no prompt, schema or model-list file, so the claim that nothing here
  moves a mark rests on the component having no learner-model access and on the
  before/after storage reads above. `docs/how-far-off.md` records the same gap.
- **`pnpm calibrate --explain --runs 3` was not run**, for the same reason. The
  last four sessions recorded that canary failing on exactly two fixtures —
  2/72 false passes for `hallucination/parroted`, which `AGENTS.md` records as
  deliberately left failing, and 3/24 false blocks for `neuron/technical` — and
  that remains the current state of the shared assessor.
- **No physical phone and no screen reader.** The keyboard order, the focus
  outlines and the accessibility tree were checked in Chrome; that is not a
  VoiceOver or NVDA session.
- **200% browser zoom was not driven.** BrowserOS cannot drive browser-chrome
  zoom. The equivalent reflow check was run instead, at a 320 CSS pixel viewport
  with everything expanded, which is what WCAG 1.4.10 asks for.
- **The panel starts below the fold at narrow widths**, and so do its siblings:
  measured in the same run, the panel title sits at y=722 at 320×568 against 712
  for both `context-window` and `next-token-prediction`. That is the shell's
  pre-existing behaviour, already recorded in `docs/one-block.md`, not something
  this branch introduces.
- **A typed explanation is lost on navigating to a different concept and back.**
  Measured against `context-window` as a control in the same run: it behaves
  identically. Shared shell behaviour, recorded rather than changed here.
