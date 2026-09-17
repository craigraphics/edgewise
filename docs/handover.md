> **The agents experiment, audited for learning experience, 2026-09-16:** On
> `experiment/21-agents`. The loop worked; it taught badly. An audit driven
> against the running app found the three things a loop is made of were never
> in view together, the decision itself was never shown, and the stopping
> condition arrived as a press that ran nothing. Read
> `docs/one-goal-one-loop.md` for the before/after measurements.
>
> Five of the defects broke rules this repo already states. The button said
> **Take the next step** where every sibling names its action, so
> `describeDecision` now shows the action and the reason above the button,
> both read off `decide`, and the button reads **Check The Silver Key**.
> Measured six presses for five tool calls, with the fifth already reporting
> *2 of 2 confirmed*: `resolve` settles in the same action now, five for five,
> with a test requiring the two to be equal. *"Check the next candidate."* sat
> directly above *"The task is unfinished."*; every such sentence is read off
> the next decision now. The scenario labels gave away the endings. And the
> node's `simplificationCost` and second misconception were in the second
> paragraph of a `<details>`, so they are on the main path now in a **What
> made it stop** card that also names the 12-step ceiling as a rule a person
> wrote and points at the two candidates the loop never checked.
>
> **The first action was 737px below the panel title**, against 308-395 across
> five siblings measured as controls in the same run, 359px of it a catalogue
> table of em dashes. Structural fix, not a copy trim: a two-column cockpit
> holding the goal and the next decision, the table below the action and not
> rendered until the search returns it, Reset out of the header. **261 now,
> constant pristine, mid-run and after a resize.** Both of this panel's
> `@container` rules were also dead — `.agents-lab` never set
> `container-type: inline-size` — so the scenario grid had never been three
> columns either.
>
> Plus a sixth wrong probe with a tell already written down: 1.17:1 for
> ordinary foreground text in light mode, because computed colours here
> serialise as `lab(...)` and canvas `fillStyle` silently rejects them. With a
> Lab-to-sRGB conversion, worst text 5.55 light and 7.89 dark.
>
> 927 tests, lint, typecheck, validate-graph and the Webpack build pass. A
> populated ten-mark model stayed byte-identical across everything, with zero
> network requests and no animations. **No assessed explanation was
> re-submitted after this pass**; the earlier one moved `agents`
> `unexplored → known` and that path is unchanged. No phone, no screen reader,
> and the browser tool still cannot resize the real viewport, so narrow widths
> were proxied by constraining the panel's own container.

> **What turns one tool call into working towards a goal? 2026-09-15:** On
> `experiment/21-agents`, branched from `main` after the calculator-handoff
> experiment merged. An experiment on `agents`: a fictional library, a small
> catalogue, and one fixed goal — find two mystery books under 200 pages that
> are available now. **Take the next step** runs one tool (search or check)
> and puts the result beside the button, with the catalogue table updating
> live per row: not a candidate, candidate, confirmed, discarded. The loop
> stops the moment two distinct books are confirmed and names the evidence.
> Read `docs/one-goal-one-loop.md` for what was verified and what was not.
> Its PR targets `main`.
>
> `decide(progress)` in `src/lib/experiments/agents.ts` takes only what the
> loop has learned so far and never the catalogue — a test asserts its arity
> is exactly one — so a search hit alone can never count as confirmed. Three
> catalogues over the same eight books sit under **Try a problem**:
> everything goes to plan; a candidate that would have matched turns out to
> be unavailable, so the next action genuinely changes and the loop still
> succeeds; or no second match exists, and the loop reports **"The task is
> unfinished"** rather than declaring success. A **Stop** control is visible
> any time a step is running or auto-running, and a checkbox can make one
> step report a tool error — the failed attempt changes nothing, so the same
> decision can be retried without losing progress. The reducer uses the same
> request-id discipline as tool-use and RAG: a stale or duplicate `resolve`
> is silently ignored.
>
> A real explanation submitted through the live assessor moved `agents`
> `unexplored → known` and left ten other existing marks byte-identical.
> This session's browser tool could not actually resize the tab's viewport
> or move keyboard focus via `Tab`, so the 320px layout was checked by
> constraining the experiment's container in the live DOM instead, and
> keyboard order rests on this panel using only native `button`,
> `input[type=checkbox]`, and `details`/`summary` elements — the same
> primitives already audited in the sibling experiments it was built
> alongside. No phone, no screen reader. The graph, assessor, schema,
> fixtures, and model list are untouched; no calibration run was required.

> **If a model makes text, who does the actual calculation? 2026-09-15:** On
> `experiment/20-tool-use`, branched from merged `main`. An experiment on
> `tool-use`: a scripted request asks for three 87cm boards, named app code
> validates and runs a real local multiplication, and only the matching returned
> 261cm is allowed into the scripted final answer. Change the board count and the
> old answer disappears behind a new request ID, then returns beside 435cm as a
> Before / Now comparison only after the new calculation succeeds; simulate an
> error and there is no new calculated answer until a retry succeeds. Read
> `docs/who-does-the-calculation.md` for the implementation and browser checks.
> Its PR targets `main`.
>
> The request is typed and allowlists one handler, one operation, finite bounded
> operands and centimetres. There is no `eval`, free-text execution, live model,
> network call, account, purchase or external effect. Responses settle only the
> matching running request, so a late older result cannot replace a newer
> answer; reset and retry also receive new IDs. The final sentence takes the
> successful response itself rather than recomputing or copying the expected
> total.
>
> A 320px browser pass found the first action **549px below the experiment
> title** because a whole request card preceded a separate action card. Moving
> the action directly under the structured request reduced that to **411px**;
> it is 353px at 1200, 382px at 720×450 and 334px at the 640px reflow used for
> 200% zoom. Page scroll, clipping, off-right controls and undersized experiment
> controls stayed zero after resizing 1200→320. Keyboard opened the long detail
> and reached the final action at 720×450 while the focused-map pane, not the
> document, scrolled. Experiment state, a 435cm result and an unfinished
> explanation survived navigation; learner-model storage stayed byte-identical.
>
> The graph and panel agree: the model emits a request, surrounding code runs
> the action, and the result comes back. The graph, assessor, explanation
> checker, schema, fixtures and model list are untouched; no calibration run was
> required or run. No phone, screen reader, learner, or literal browser-chrome
> 200% zoom was used; 640px reflow was checked as the zoom equivalent.

> **Can a convincing detail still be wrong? 2026-09-15:** On
> `experiment/19-hallucination`, branched from merged `main`. An experiment on
> `hallucination`: a fictional museum description says the Harbor Light radio
> first appeared in 1984; one action checks the independent record and finds
> 1991. The exact year is marked, the mismatch is named in words, and the result
> sits beside the sentence on a wide pane and immediately after it on a narrow
> one. **Try another description** reaches a supported year, a second mismatch,
> and an exhibit missing from the tiny catalogue. That last case says “Not found
> in these records”, never “false”. Read `docs/convincing-detail.md` for the
> implementation and browser checks. Its PR targets `main`.
>
> The sentence maker combines only prepared exhibit names, years, and wording
> patterns. It does not receive the record list. The checker receives the
> finished claim and finds its record by stable exhibit ID, so making and
> checking are separate in the function signatures rather than only in the
> lesson copy. Tests change the records without changing the sentence and cover
> supported, contradicted, and missing outcomes. There is no live model,
> confidence meter, real citation, or invented hallucination rate.
>
> A 320px browser pass found the first action **592px below the experiment
> title** because the narrow layout stacked an entire sentence card before a
> separate action card. Moving the action directly after the claim reduced that
> to **389px**. At 1200px it is 376px; at 720×450 it is 395px. Page scroll,
> clipping and off-right controls stayed zero after resizing 1200→320. Keyboard
> reached and opened both long details at 720×450 while the guide pane, not the
> document, scrolled. Experiment state and an unfinished explanation survived a
> trip away and back, and the learner-model storage stayed byte-identical.
>
> A disagreement with the authored text is recorded and **not acted on**: the
> graph says training does not distinguish truth from truth-shaped text and
> implies no route to uncertainty. Further training can reward factual accuracy
> and acknowledging uncertainty, and systems can check outside sources. Fluent
> wording still does not prove a check happened, which is the narrower claim on
> screen. The graph, assessor, explanation checker, schema, fixtures and model
> list are untouched; no calibration run was required or run. No phone, screen
> reader, learner, or literal browser-chrome 200% zoom was used; 640px reflow was
> checked as the zoom equivalent.

> **Why does it answer, instead of adding more questions? 2026-09-15:** On
> `experiment/18-post-training`, branched from `main` after the notice-search
> experiment and rebased onto it after the picking-a-word one merged. An experiment on `pretraining-vs-posttraining`: somebody asks *"My
> bike has a flat tyre. What should I do first?"*, and three replies written by
> hand sit under it — more questions, a short first step, a longer answer. The
> opening chances are **55% / 25% / 20%**, with the reply that answers nothing on
> top, because on its own a question is often followed by more questions. Choose
> a reply (the whole card is the control), press **Learn from this choice**, and
> it becomes **31% / 52% / 16%** — with every reply still word for word what it
> was. Then the name: post-training. Read `docs/preferred-reply.md` for what was
> verified and what was not, including one real assessed explanation submitted
> end to end, which moved only this node, `blocked` → `known`. Its PR targets
> `main`.
>
> It is a real softmax choice model trained by one gradient step on
> cross-entropy, and the opening round is checkable on paper. Two things are the
> shape of a function rather than a promise in a comment: `applyAction` carries
> the scores through **by reference** on a `select`, so "pointing at a reply
> trains nothing" is asserted by identity; and the state holds one score per
> supplied reply, so there is nowhere for reply text — or anything about bicycles
> — to be learned, which a test checks by running twenty rounds and requiring the
> question and all three replies to be byte-identical to a clone. It is a
> reducer, so twenty clicks in one synchronous task and twenty clicks with a
> render between each both give exactly twenty rounds and identical chances.
>
> Five defects found the way this project keeps finding them. **A container query
> set on the wrong number**: `Learn from this choice` sat 1063px below the panel
> title at 1230x842, entirely off the bottom of the window, and 1147 at 1100x700,
> because the 44rem threshold copied from the notice-search panel never fired —
> a container query reads the **content box**, and this panel gets 535–696px of
> it at the widths people use. A first pass at 37rem still missed 1100, because
> the panel's padding is `2.5vw` and the pane is not the viewport. 33rem, and
> **311–345 now** at every width from 640 up. The first action was 527px down
> until the whole card became the control (**449 at 320, 359 at 1230**). The
> chance row printed the percentage twice. A chance that was really there printed
> as `0%` — measured, a losing reply drops under half a percent on round 72 and
> the chosen one passes 99.5% on round 134, and neither ever arrives. And three
> sentences read badly aloud. Plus **a wrong probe caught before it was
> believed**: the first twenty-presses check fired every click inside one
> synchronous loop and reported that no round had applied, because React never
> re-renders inside a synchronous task and `Learn` stayed disabled for all twenty.
>
> A disagreement with the authored text is recorded and **not acted on**: the
> node's intuition says "the willingness to answer at all" is added afterwards,
> and a model trained only to continue text is not silent — it answers, and
> showing one a few worked examples first was the standard way to get useful
> answers out of it. Further training also changes what a model knows, not only
> how it sounds. The graph, the assessor prompt, the schema and the model list
> are untouched, and the panel's wording is chosen to be true beside the authored
> text, which sits in the inspector at the same time on a wide screen. No phone,
> no screen reader, and 200% zoom was checked as an equivalent 640px reflow
> because BrowserOS cannot drive browser-chrome zoom.

> **Why can the same beginning get a different next word? 2026-09-15:** On
> `experiment/17-sampling`, branched from `main` after the notice-search
> experiment. An experiment on `sampling-temperature`: *In the garden I found a
> …*, three possible endings with flower 60%, stone 30% and dragon 10% beside
> them the whole time, and one button. Seven presses gave flower, flower,
> flower, stone, flower, dragon, flower, and the chances never moved — the
> node's first misconception taken apart by pressing rather than by arguing.
> Then two plain-language settings reshape the chances **before** the draw, each
> row showing what it has now and what it started with: 78.3 / 19.6 / 2.2 for
> favouring the usual, 47.3 / 33.4 / 19.3 for the unusual, all matching the
> arithmetic by hand. **"Always pick the top option" sits apart from both**,
> because zero is a different rule rather than a very small temperature. The
> word *temperature* appears only after a setting has been used and a real
> change is on screen. Read `docs/picking-a-word.md` for what was verified and
> what was not. Its PR targets `main`.
>
> The panel next door asked for it: `next-token.ts` has said since it was
> written that choosing at random among the likely pieces "belongs to its own
> experiment". Because `sampling-temperature`'s only prerequisite is
> `next-token-prediction`, registering the id was enough for that panel's
> **Builds into** row to grow a `Try it` button for it, and `deep-link.ts`
> needed no edit at all.
>
> Three things worth keeping. `adjust` subtracts the largest score before
> `exp`, and that is not tidiness — written the obvious way, at T = 0.0005 every
> weight underflows to zero and every chance comes out `NaN`; the test asserts
> the naive form really does total zero there. The randomness is a **parameter**,
> and it is the repo's first: there was no `Math.random` anywhere in `src/`
> before this branch, so `drawFrom(chances, random)` puts the one
> non-deterministic thing here somewhere it can be seen, and the tests drive
> exact boundary values and a seeded batch of 20,000. And the fixtures are held
> to the **power form** — `p^(1/T)` normalised via `Math.pow`, sharing no code
> with the implementation — which is the tenth route this project has used to
> avoid asserting a measure against itself.
>
> Four defects found the way this project keeps finding them: the result
> sentence went stale on a setting change (60% beside a row saying 78.3%), fixed
> by making the picks belong to one setting the way the counts already did; the
> first action sat 482px below the panel title at 320px against 149–525 across
> four siblings measured as controls, fixed by moving the "chosen for this
> example" label beside the chances it qualifies (**390 at 320, 274 at 1230**);
> the button sat ~90px below the sentence it continues because a row-spanning
> card was sharing out its slack (**12px now**); and a sub-line sat two pixels
> closer to its own row than to the next one. Plus a fifth wrong probe, with a
> new tell — **1.10:1 in dark mode and nothing wrong in light**, because the
> probe painted dark mode's translucent outline buttons over an empty canvas.
> Corrected: worst text 5.55 light, 7.89 dark.
>
> A disagreement with the authored node is recorded and **not acted on**: its
> misconception says greedy decoding produces "flat, repetitive, looping text"
> and its example calls temperature zero "near-deterministic", neither of which
> is demonstrable in a closed list of three. The panel says which is which on
> screen instead. The graph, assessor prompt, schema and model list are
> untouched, so no calibration run was required; none was run, and no assessed
> explanation was submitted. No phone, no screen reader.

> **Can it answer from the right notice? 2026-09-14:** On `experiment/16-rag`,
> branched from `main` after the one-piece-at-a-time experiment. An experiment on
> `rag`: a swimming pool, five short dated notices, and one fixed question —
> *When does the pool close on Saturday?* **Search the notices** ranks them and puts
> the top one into **Notice sent with the question**; **Answer from this notice** gives
> "The pool closes at 4pm on Saturday" and quotes the exact line it came from,
> with the notice's title, date and version beside it. Then **Try the older
> notice**: the question does not move and neither does the answering rule, only
> the passage does, and the same rule gives **6pm** — fluently, with a citation
> that really does point at the line it used. That is the node's own
> `simplificationCost` acted out rather than asserted. Read
> `docs/notice-search.md` for what was verified and what was not. Its PR targets
> `main`.
>
> The search is real: each score adds up, per shared word, how often the notice
> uses it divided by how many notices contain it. The 14 March notice comes top
> at 1.58 against 1.25 **because it says "Saturday" three times to the January
> notice's two, not because it is newer** — and that is a fact about the
> function, not a claim: `rank` never reads `date` or `version`, and the test
> replaces every one of them with nonsense and requires an identical ranking. The
> collection is stored out of date order too, because ties go to position in it.
> `answerFrom(notice, question)` takes one notice, so the collection is not in
> scope where the answer is built, and it takes the subject from the matched line
> rather than assuming one — which is why handing it the café notice answers
> about the café. Nothing is called a meaning search and no embedding distance is
> invented; the panel names what it is and points at the word-neighbours
> experiment. Both honest cases are reachable — a question that matches nothing,
> and a notice that matched but gives no answer — and neither is stated as a law.
>
> Nine defects found the way this project keeps finding them. The first action sat
> **657px** below the panel title at 320px against 286–525 across the siblings
> measured as a control in the same run (**484 now, 297 at 1230**); a question
> button hung off the right at 320px, the shared `Button` being
> `whitespace-nowrap` at a fixed height, which `docs/saved-messages.md` already
> records; the change sentence repeated the stale banner word for word; the name
> card was unlocked by a *no-answer*; the day was hard-coded and then lowercase;
> and title, date and version ran together for anything taking the text rather
> than the picture. The first accessibility fix for those separators used
> absolutely positioned `sr-only` commas, which escaped the scrolling pane and
> made the 619px app shell sit above 856px of empty document scroll; plain
> visible commas fix both readings without duplicate nodes. A later review found
> that at a 660px split-pane width the
> tall notice list pushed **What the answer can use** 1,109px below its action,
> so the action, supplied passage and answer are one grid item now. It also
> found the closing question claiming that two answers had differed after only
> one had been made; the contrast, its two caution points and Explain back now
> wait for two real answers with different times. Plus a fourth wrong probe,
> with the same tell as the other
> three — **identical contrast figures in both themes**, because the theme here
> is a class on `<html>` and the probe set `data-theme`. Corrected: worst text
> 5.55 light and 7.89 dark. And a trap reproduced while checking: a hash-only
> navigation carries React state across it, so every case was re-run through
> `about:blank` first.
>
> A final clarity pass removed the test-harness feeling from the main path. The
> five full passages no longer compete for attention: the ranked list is compact
> and a notice's text appears where it is handed to the answer. Each action names
> its step, the prose is shorter, and the vanished 4pm answer is now kept beside
> the 6pm answer in a **Before / Now** card. The RAG definition and Explain back
> sit in that answer flow before the ranking details. At the measured 660×619
> workspace the first action is 323px below the panel title, the supplied notice
> stays 12px below its action, and the completed 4pm answer fits in the same view.
>
> Nothing here touches the map — a populated ten-mark model, `rag` and both
> prerequisites included, stayed byte-identical through the whole panel. **No
> assessed explanation was submitted and the explain canary was not run**;
> `EXPERIMENT_PROMPT` is display copy that `ExplainBack` renders and never sends,
> and this branch changes no prompt, schema or model-list file. No phone, no
> screen reader, and 200% browser zoom was checked as an equivalent 320px reflow
> because BrowserOS cannot drive browser-chrome zoom.

> **If the final amount is wrong, how do we work back? 2026-09-13:** A local
> experiment on `backprop-intuition` separates the forward prediction, a
> backward advice pass that changes nothing, and one simultaneous learning
> step. The supplied 0.5 L/min and 60% settings predict 3 litres in ten minutes;
> against 4 litres the two sensitivities are −6 and −5, and the labelled 0.01
> step moves both settings to 0.56 and 65% before producing 3.64 litres. Advice
> is calculated from a copied pre-update snapshot, invalid physical or
> non-finite steps are refused, duplicate Apply actions cannot apply twice, and
> exact agreement offers no meaningless update. Alternative measurements are
> local, bounded 0–10 litres and restart from the same supplied settings. Read
> `docs/working-backwards.md` for the completed checks, the resumed short
> browser pass, and the two tool-limited checks left open. Its PR targets
> `main`.
>
> Keep the documented limit of the graph's blame metaphor: backpropagation
> computes chain-rule sensitivities. No finite substance or leftover blame is
> divided among settings, and the gradients are not percentages that add to
> 100. The graph, learner marks, assessor, schema and model list are untouched;
> no calibration run is required.

> **The mark, and being findable, 2026-09-14:** On `favicon-and-seo`, branched
> from `main` after the transformer experiment. A favicon drawn from the
> wordmark's own letter — `edgewise.` cropped to its `e`, Newsreader SemiBold on
> a near-black card with the teal full stop — plus the metadata this site was
> serving none of. It was `noindex, nofollow` on a live domain with no
> `robots.txt`, no sitemap, no canonical, no sharing card and no icon at all.
> **`index: true` is the one behavioural change and it is the owner's to veto**;
> it is one line in `layout.tsx`, and `robots.ts` allows crawling on its own, so
> going back to a private draft means changing both. `/lab` is disallowed,
> `/intro` is crawlable but deliberately out of the sitemap, because whether it
> is somewhere to send a stranger is still an open question below.
>
> `scripts/make-icons.py` draws every size and is committed, so nobody has to
> redraw an `e` by hand. Three deliberate things: the small frames come from a
> different `opsz` cut, because at 16px the 16pt cut closes its own counter into
> a smudge; the 16px frame drops the full stop, which at that size is a stray
> teal pixel; and it is rendered at 16px rather than reduced from 8x, because
> reducing loses the hinting. All compared on screen at 5x, not reasoned about.
> One trap worth keeping: Pillow's ICO writer **silently drops any size larger
> than the base image and writes a one-frame file** — caught by reading the
> sizes back out of the file rather than trusting the call.
>
> This overlaps PR #2 (`seo-and-icons`, open since 2026-08-21), which does the
> same job with the craigraphics circle-in-ring instead of the letter. Its
> reasoning is kept; it should be closed rather than merged alongside. Read
> `docs/icons-and-seo.md` for the before/after table, what was verified in the
> served `<head>`, and what was not — no crawler, no card debugger, no phone.

> **If it is still in the chat, why can’t the model use it? 2026-09-13:** On
> `experiment/14-context-window`, branched from `main` after the one-block
> experiment. An experiment on `context-window`: a birthday-party chat whose
> first message is "The door code is 47A.", beside a card headed **Included in
> this request**. The chat never loses a message; the request has 80 tokens of
> room. One press of "Add more party notes" takes it over, the oldest message is
> dropped, and it is the door code — still on screen, visibly outside the
> request, with the scripted reply changing to "I cannot see a door code in the
> messages I was given." The fourth press drops two whole messages at once.
> "Include the code again" puts it back and the same rule finds it, with nothing
> trained. The counts are real `cl100k_base` in a worker (zero fetches, zero
> XHRs while driving the whole panel); the 80-token allowance is invented and
> labelled as such; and when the worker cannot start the panel says so and shows
> **no numbers at all**, because a made-up count is what this node exists to
> correct. Read `docs/what-gets-sent.md` for what was verified and what was not
> — including one real assessed explanation submitted end to end, which moved
> only this node, `shaky` → `known`. Its PR targets `main`.
>
> The scripted reply earns its place through its signature: `answerFrom` takes
> the included messages and nothing else, and a test hands it a visible history
> full of door codes and an included list with none. A message of 110 tokens
> against a capacity of 40 is a real boundary — nothing older than it can be
> sent either, which is a consequence of this app’s one rule and not a second
> decision, and the card says why free tokens are left over. The node’s second
> misconception is on screen after the fact: being sent is not the same as being
> used.
>
> Three things worth keeping. The first action sat 568px below the panel title
> at 1440 and 734 at 320, against 286–521 across the thirteen siblings, and copy
> trimming did not close it — the fix was grid placement, **157–293 now**. The
> stage is the codebase’s first container query, because this panel is drawn
> inside a pane whose width the viewport does not describe. And a contrast probe
> that parsed `getComputedStyle` reported **1.25 for everything in both themes**,
> because computed colours here are `lab(...)` and canvas `fillStyle` does not
> convert them — the third wrong probe this project has recorded, and identical
> figures across themes was the tell again. Painted into a canvas instead: worst
> text 5.55 light and 7.89 dark, and it then caught the meter’s reserve segment
> at 1.77:1 against its track.

> **What happens inside one repeated block? 2026-09-13:** On
> `experiment/13-transformer`, branched from `main` after the attention
> experiment. An experiment on `transformer`: a five-word note about pets, the
> last word marked, two named stages and one button. Run one block and the last
> word's numbers are shown before, after sharing clues from the earlier words,
> and after the calculation that follows — with how far the description moved at
> each stage, so the two can be compared. It is a complete single-head causal
> decoder block in the modern arrangement, run twice; post-norm was built first
> and rejected by measurement, because after normalising every row the second
> block's gathering step moved the last word by 0.007 and the panel would have
> been claiming a change it could not show. Read `docs/one-block.md` for what was
> verified and what was not — including one real assessed explanation submitted
> end to end, which moved only this node, `unexplored` → `known`. Its PR targets
> `main`.
>
> It is the first experiment whose subject is an authored simplification's own
> confession rather than a disagreement with one. The node's `simplificationCost`
> says position handling is left out and that attention alone treats a sentence
> as an unordered bag; this puts it back and **proves** it — the test removes the
> place rows, shuffles the earlier words and requires the last word's result to
> come out byte-identical, then puts them back and requires it to differ. The
> dimensions are deliberately unnamed, which is the opposite call from the
> attention panel next door and creates no new disagreement. Nothing in the
> branch changes the graph, the assessor prompt, the schema or the model list.
>
> A first build was mechanically clear and thin — three rows of unnamed numbers
> and a sentence saying they changed. Two fixes, neither inventing a meaning: a
> real distance so the stages can be compared, and the strongest fact in the
> panel promoted out of the third section — the note uses *the* twice, both
> copies start from the same numbers, and after the block they are
> `0.20 · 0.35 · -0.51` and `-0.46 · -0.98 · 0.75`, with both reasons named.
>
> Three defects found the way this project keeps finding them: the result
> sentence said "changed its numbers" twice in a row; Reset was offered on a
> screen with nothing to reset and at 390px wrapped above the panel's actual
> first action (474px below the title at 390 and 341 at 1230x842, now 418 and
> **285**); and "done" had no space in front of it. Plus one about the probe: a
> contrast check that read a computed `oklch()` string as if it were `r, g, b`
> reported everything at 1.1–1.5 in both themes, and the identical figures across
> themes were the tell. And one pre-existing condition, measured against the
> attention and embeddings panels as a control rather than blamed on this branch:
> at 720x450 the focused-map pane is 20px tall for all three.

> **How can the words around "bank" change what it means here? 2026-09-13:** On
> `experiment/12-attention`, branched from `main` after the saved-numbers
> experiment. An experiment on `attention`: one sentence, one word being
> updated, and one button that swaps the sentence. *We walked beside the river
> to the bank* leaves `bank` at outdoors 1.60 / money 0.21; *We took cash to the
> bank* leaves it at 0.24 / 1.78; on its own it is an even 1.00 / 1.00, which is
> asserted rather than described. It is real single-head causal self-attention
> with the query, key and value settings left as the identity — a simplification
> the panel states, and the reason every number on screen can be checked against
> a nine-word table. There are no arrows anywhere, because an arrow looks like
> choosing and a thick arrow looks like a reason, which are this node's two
> recorded misconceptions. Causality is the shape of `updateAt`, not a comment:
> a test swaps every word after the target for nonsense and requires the result
> to be byte-identical. Read `docs/words-around-it.md` for what was verified and
> what was not — including one real assessed explanation submitted end to end,
> which moved only this node, `blocked` → `known`. Its PR targets `main`.
>
> It also records three defects found the way this project keeps finding them:
> the first action sat 502px below the panel title at 390px until the connection
> sentence moved below the readout (**306 at 1230x842** now, second shortest of
> the twelve panels); each before/after card stood 176px tall at 320px with 90px
> of nothing in it, because `flex-basis` is the main axis and an 11rem column
> width became a minimum height once the pair stacked; and five of the eight
> share rows said "adds outdoors 0.00 · money 0.00", which is true and is noise —
> they say "adds nothing" now. And one about the probe rather than the panel: a
> contrast check that composited over black reported the share bar at 1.52:1 in
> light mode when the real figure is 3.36.
>
> A later legibility pass fixed the thing most likely to stop this working: the
> readout printed `outdoors 1.00 money 1.00` before anything had said that words
> carry numbers, and used *description* and *share* before either was defined.
> One sentence now sits inside the readout card — at the moment the numbers
> appear, not in front of the button — and the result sentence grounds *share*
> by using it, with "balanced" and the direction it leans both read off
> `leadingColumn` rather than written down. *See the shares* now says what the
> match number actually is, derived: "river overlaps bank by 3.00, so it reads
> 2.12 below." The first action did not move, because the readout is below it.
>
> A disagreement with an authored simplification is recorded and **not acted
> on**: the panel names its two columns, where the `embeddings` node's authored
> text says nobody decides what a dimension means. The graph, the assessor
> prompt, the schema and the model list are untouched. `pnpm calibrate --explain
> --runs 3` was not run, for the reasons in the doc.

> **When a model learns, what does it actually keep? 2026-09-13:** On
> `experiment/11-parameters-scale`, branched from `main` after the
> train-test-split experiment. An experiment on `parameters-scale`: a bike
> rental shop keeps two numbers, a customer brings one, and one button changes
> the price per hour from $3 to $4 so the price moves for a reason the panel
> names. Then the hours change and it moves for the *other* reason. Under "How
> were these numbers chosen?" the same two settings are worked out from past
> rentals with the predictor's `fitLine`, unchanged — four rentals give $1.50
> and $3.40, ten give $2.10 and $3.20, and a set where every rental was two
> hours long is **refused with the reason** rather than handed an invented rate.
> The count of saved numbers is derived from the named list, so "still 2
> numbers" holds across four rentals and ten, and a test fits every count from
> 2 to 12. Read `docs/saved-numbers.md` for what was verified and what was not —
> including a recorded disagreement with the node's authored "no copy of the
> training text", which was **not** acted on, and the fact that no assessed
> explanation was submitted and the explain canary was not run. Its PR targets
> `main`.
>
> It also records two defects worth keeping: the first action sat 863px below
> the panel title at 320px until the six sibling panels were measured as a
> control, fixed by moving the action into the board grid under the rule card it
> changes rather than by trimming copy (**521 at 320px, 382 at 1230px now**);
> and that emptying a saved-number field and typing it back produced no sentence
> at all, because the comparison snapshot had been overwritten with nothing.

> **Can we trust a result we helped choose? 2026-09-13:**
> On `experiment/10-train-test-split`, branched from `main` after the
> word-neighbours experiment. An experiment on `train-test-split`: a junk-mail
> filter, six invented messages to learn from, four to choose how cautious it
> should be, and four whose answers stay out of view until asked for. The filter
> really learns — word scores from log counts, a message's score the total of
> its known words — and `learnFilter` takes one list, so the other two groups
> are not in scope where it is built; a test swaps both for nonsense and
> requires the filter to come out byte-identical. Two mailboxes disagree about
> which setting is right, so the panel teaches the order of the decisions rather
> than a rule of thumb about caution. Once a final check has been seen, any
> later change leaves a note that does not go away, and **Reset re-hides the
> group and then says it cannot un-see an answer**. Read `docs/saved-messages.md`
> for what was verified and what was not — including one real assessed
> explanation, which moved only this node and came back `shaky` rather than
> `known`. Its PR targets `main`.
>
> A later clarity pass made the middle group a real decision rather than a
> silent default: the final check does not appear until the learner has compared
> both outcomes and explicitly chosen a setting. Completed message rows collapse
> out of the main path, the final conclusion now comes before row-level evidence,
> and the three technical names arrive as a one-to-one job map. The pristine
> screen no longer offers a Reset that has nothing to reset.
>
> It also records two defects found the way this project keeps finding them: the
> first action sat 757px below the panel title at 320px until the six sibling
> panels were measured as a control (286 / 334 / 431 / 445 / 471 / 520), and the
> same button was 291px wide in a 242px column and hung off the right edge,
> because the shared `Button` is `whitespace-nowrap` at a fixed height. The
> clarity pass moved the action before the progress tracker: **344px at 320px
> and 190px at 1230px now**, with no horizontal overflow after resizing between
> them.
>
> `EXPERIMENT_PROMPT` is display copy that `ExplainBack` renders and never
> sends, so the assessor prompt, schema and model list are untouched here. The
> canary was run anyway and **fails** on exactly the two fixtures the previous
> two sessions recorded — 2/72 false passes for `hallucination/parroted` and
> 3/24 false blocks for `neuron/technical`, the same figure as last session on
> unchanged fixtures, prompt and model. Not evidence about this experiment,
> which has no fixture there, but it is the current state of the shared
> assessor. Full figures in `docs/saved-messages.md`.

> **How can numbers help us find related words? 2026-09-13:** On
> `experiment/09-embeddings`, branched from `main` after the experiment-links
> work. An experiment on `embeddings`: pick a familiar word and see its five
> nearest words, then pick one from another part of life and compare. Every
> number is real learned GloVe 6B (100d) under PDDL v1.0, 163 words checked in
> with their source and extraction script; neighbours are computed from all 100
> numbers and never off the optional flat picture, which reports that **146 of
> the 163 words have a different closest word in it** than they do in the full
> lists. `mouse` carries both the animal and the thing beside a keyboard in one
> saved list, which is the node's second misconception acted out rather than
> asserted. A missing word is said to be missing; a typo retries on shorter
> openings; an unusable collection names its reason instead of printing `NaN`.
> The first action sits **286px** below the panel title at 1230x842, the
> shortest of the nine experiment panels. Read `docs/word-neighbours.md` for
> what was verified and what was not — including a real assessed explanation
> submitted end to end, and no phone and no screen reader. Its PR targets
> `main`.
>
> `EXPERIMENT_PROMPT` is display copy that `ExplainBack` renders and never
> sends, so the assessor prompt, schema and model list are untouched here. The
> canary was run anyway and **fails** on exactly the two fixtures the previous
> two sessions recorded — 2/72 false passes for `hallucination/parroted` and
> 3/24 false blocks for `neuron/technical`, the same figure as last session on
> unchanged fixtures, prompt and model. Not evidence about this experiment,
> which has no fixture there, but it is the current state of the shared
> assessor. Full figures in `docs/saved-messages.md`. The
> canary was run anyway and **fails** on the two fixtures the previous session
> already recorded — 2/72 false passes for `hallucination/parroted` and 3/24
> false blocks for `neuron/technical`, the latter up from 1 on unchanged
> fixtures, prompt and model. Not evidence about this experiment, which has no
> fixture there, but it is the current state of the shared assessor. Full
> figures in `docs/word-neighbours.md`.

> **Required checks, 2026-09-13:** The `main` ruleset requires a status named
> `checks`. Its matching GitHub Actions workflow had only been committed on the
> still-open `seo-and-icons` PR #2, so every other PR waited for a check that
> could not start. `experiment/07-generalization` now carries that existing
> workflow. When PR #15 merges, later PRs will receive the required
> check from `main` normally.
>
> **Reaching an experiment, 2026-09-13:** On `experiment/08-experiment-links`,
> branched from merged `main`. Every neighbour on the focused view that has an
> experiment now carries a `Try it` button, and the invitation for the idea in
> focus moved above "Builds into" — it was 576px below the panel title with its
> action off the bottom of a 1230x842 window, and is 325px and fully visible
> now. Two URL forms name where you are: `#idea/<id>` and `#play/<id>`, with a
> bare `#tokens` accepted and rewritten, `replaceState` rather than
> `pushState`, and an unknown id landing on the ordinary first screen. It also
> records three things worth keeping: that `react-hooks/set-state-in-effect`
> was right about the design and not only the line, which is why `use-hash.ts`
> is a subscription rather than a store; that a hash-link check which does not
> reload is checking something else, because a fragment change carries React
> state across it; and that wrapping two buttons in a row clipped to its own
> corner radius hides their focus outlines. Read `docs/experiment-links.md` for
> what was verified and what was not — no phone and no screen reader. Its PR
> targets `main`.

> **Did it learn the pattern, or remember the examples? 2026-09-13:** On
> `experiment/07-generalization`, branched from merged `main`. An experiment on
> `generalization-overfitting`: two pricing rules fitted to the same five past
> used-phone sales, one a straight trend and one a curve free to bend through
> every sale. The flexible rule is nothing off on the past sales and $100 off on
> four held-out sales; the line is $51.2 and $34.5. A cracked phone makes the
> one-off detail concrete. Two further datasets carry the honesty — one where a
> real early price drop makes the flexible rule 25.8 times better, one where both
> rules come out identical — so the panel cannot be read as teaching that detail
> always fails. Both fitting functions take past sales and nothing else, so the
> held-out rows cannot reach a rule; a test swaps them
> for nonsense and requires the rules to be byte-identical. It also records a
> defect worth keeping: the first action sat 982px below the panel title because
> a `w-full` chart stretched to 664px and stood 415px tall on its own, invisible
> in the code and found only by measuring against the four sibling panels (334 /
> 431 / 445 / 520). A plain-English copy pass shortened it further to 471, with
> the picture below the button and no em dashes in the learner-facing text. Read
> `docs/memorising-or-learning.md` for what was verified and what was not —
> including a real assessed explanation submitted end to end. Its PR targets
> `main`.
>
> The phone-specific explanation was accepted end to end (`unexplored → known`).
> The required repository-wide `pnpm calibrate --explain --runs 3` rerun failed
> on unrelated fixtures: 2/72 false passes for `hallucination/parroted` and one
> false block for `neuron/technical`. The explain canary does not include this
> experiment, so the result is not evidence against the new question, but it is
> current assessor evidence and must not be hidden.

> **One step at a time, 2026-09-12:** On `experiment/06-small-steps`, branched
> from merged `main`. An experiment on `gradient-descent`, continuing the
> delivery from `loss`: the model guessed 40 minutes for a delivery that took 30,
> and one button takes one real slope-based step. Small steps improve steadily,
> a bigger step goes past the answer and still lands closer, and a much bigger
> one goes past and lands further away until the guess would leave a sensible
> delivery time — at which point the step is refused and the number it would have
> reached is printed rather than clamped. The names arrive only after the thing
> they name has happened on screen. It also records two things worth keeping: a
> row that printed "0 off → 0 off · past it, and closer" because display
> precision and the classification tolerance disagreed, found only by driving the
> panel to its cap; and that the first action sat 517px below the panel title
> until the three sibling panels were measured as a control (334 / 445 / 520),
> which is now 431. Read `docs/one-step-at-a-time.md` for what was verified and
> what was not — including a real assessed explanation submitted end to end,
> which the how-far-off experiment left open. Its PR targets `main`.

> **How far off was the answer? 2026-09-12:** On `experiment/05-loss`, branched
> from merged `main`. An experiment on the `loss` node: a delivery took 30
> minutes, guesses of 29 and 60 are both "Wrong" and are 1 and 30 minutes off,
> and moving the second guess leaves right-or-wrong saying Wrong the whole way
> while how-far-off shrinks. A second example scores four deliveries two ways —
> every minute counted the same, and big misses counted more — on two sets that
> tie on the first and differ four-fold on the second. The name arrives only once
> both measures are on screen. It also records that `--band-learning` measures
> 4.30:1 as text, so the two existing experiment readouts pass AA only because
> `foundations` is the darkest band; `BANDS_USED_AS_TEXT` in `globals.test.ts`
> now holds that. Read `docs/how-far-off.md` for what was verified and what was
> not — in particular, no end-to-end assessed explanation was run. Its PR targets
> `main`.

> **Training vs. using, 2026-09-12:** On `experiment/04-training-vs-inference`,
> branched from merged `main`. The predictor's delivery setting reused on the
> `training-vs-inference` node: change the new customer's distance and the answer
> moves while the rule sits still, then edit a past delivery and press Learn
> again to see the rule itself move, both rules read at one held distance. The
> answer function cannot see the delivery rows, and learning is refused with a
> reason rather than attempted on data that cannot determine a rule. It also
> fixes a shipped contrast defect in the predictor's readout, found by a test
> written for the new panel. Read `docs/training-vs-inference.md` for what was
> verified and what was not. Its PR targets `main`.

> **Representation playground, 2026-09-12:** On `experiment/03-representation`,
> branched from merged `main`. Two recognisable 4x4 pixel letters on the
> `features-and-representation` node, with each picture kept beside the numbers
> it becomes. Average brightness is compared with the full ordered list, all
> computed from the actual cells and local to the browser. The teaching path was
> revised after comparison with the predictor: three explicit actions first,
> exploratory presets and rotation second. Read `docs/representation-playground.md`
> for what was verified and what was not. It also fixes the dead "Explore this
> idea" control on the focused card, which the owner reported and which predates
> the branch. Its PR targets `main`.

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
