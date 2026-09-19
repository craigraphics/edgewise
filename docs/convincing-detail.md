# The museum record — `hallucination`

An experiment on **Hallucination** built around one question: **Does sounding
right mean the detail was checked?** It is reached through the existing focused
map, keeps its state at workspace level, and hands an optional explanation to
the existing `ExplainBack` flow.

The setting is a fictional museum. A polished description says the Harbor
Light radio first appeared in its main gallery in 1984. One action, **Check the
museum record**, reveals the independent record for that exact exhibit: 1991.
The result sits beside the sentence on a wide pane and immediately after it on a
narrow one. It says in words, not only colour, that the years do not match.

## The maker and checker are separate

`src/lib/experiments/hallucination.ts` contains two pure operations:

- `makeDescription` receives prepared exhibit names, prepared years, and
  prepared sentence patterns. It receives no museum records.
- `checkClaim` receives the finished claim and a record list. It finds a record
  by stable exhibit ID, then compares the claimed year with the recorded year.

That separation is part of the function signatures rather than a promise in
the copy. A test changes every catalogue year and requires the made sentence to
stay byte-identical. Other tests cover a supported year, a contradicted year,
and an exhibit missing from the record list.

The same sentence-making rule handles every case. Four recipes select one name,
one year, and one wording pattern. None stores whether it should pass. One
combination happens to agree with the independent record; two use a plausible
but different year; one names an exhibit for which this tiny catalogue has no
record. Changing the description always clears the old check.

## What is real, prepared, and absent

Every value shown is derived from the explicit local data. The component calls
no model, service, or account. The panel labels the museum as invented and the
names, years, and wording as prepared. It never presents the sentence as a real
AI response or the record as a real citation.

The missing-record result says **Not found in these records** and then states
that missing evidence is not proof of falsehood. There is no confidence meter:
token likelihood would not be a truth score. Supported and contradicted
sentences keep the same smooth, matter-of-fact style.

The main limit stays visible outside the optional details: this constructed
example isolates a missing check; it is not a complete language model and does
not measure a hallucination rate. The details add that real models are not
random word shufflers and can use further training, retrieval, search, and
other tools to improve factual accuracy.

## The authored disagreement

The graph says training does not distinguish truth from text shaped like truth
and that there is no internal flag separating them. That is too absolute.
Further training can reward factual accuracy and acknowledging uncertainty, and
systems can be given outside checks. None of that makes fluent wording evidence
that a check happened, which is the narrower claim this panel demonstrates.

The graph, diagnostic assessor, explanation checker, schema, fixtures, and model
list are unchanged. The disagreement is recorded here and reflected in the
panel rather than silently changing the authored material. `EXPERIMENT_PROMPT`
is display copy that opens the existing explanation form; it is not an assessor
prompt, so no calibration run was required or run.

## State and marks

`useHallucinationExperiment` is created in `page.tsx`, alongside the other
experiment stores. Switching to Full map and back preserves the chosen
description and its check result. Moving from the experiment to Explain back,
typing a draft, returning to the map, and opening the explanation again
preserves both the experiment and the unfinished draft.

Making, checking, changing, and resetting descriptions have no learner-model
access. In the browser pass, `edgewise.learner.v1` stayed byte-identical through
all four descriptions and a trip away and back. Only submitting through the
existing explanation check can improve this node.

## Browser checks

BrowserOS neo, against the local development server in a real browser.

| Check | Result |
|---|---|
| Opening description | Harbor Light radio, 1984; no result before the action |
| Contradicted record | 1984 in the sentence, 1991 in the record; “Does not match this record” |
| Supported record | Sky Garden kite, 1976 in both places; “Supported by this record” |
| Second contradiction | Copper Street camera, 1991 in the sentence, 2003 in the record |
| Missing record | Moon Dial model; “Not found in these records”, explicitly not proven false |
| Change description | Previous result removed before the new check |
| Reset | First description restored, result cleared |
| Full map → Focus | Description and result preserved |
| Experiment → explanation → experiment → explanation | Typed draft preserved |
| Map marks | Local learner-model value byte-identical before and after the full pass |
| 1200×797 | First action 376px below title; no page scroll, clipping, or off-right control |
| Resize 1200×797 → 320×568 | First action 389px below title (63px tall); no page scroll, clipping, or off-right control |
| 720×450 | First action 395px below title; guide pane owns scrolling, page scroll stays zero |
| 200% equivalent, 640px reflow | First action 299px below title; no page scroll, clipping, or off-right control |
| Keyboard at 720×450 | From title: Reset, Try another, Explain, How it works, What this example leaves out; both details opened with Enter |
| Long expanded details | Guide pane scrolled to 1570/1896; document remained at `scrollY = 0` |
| Tap targets | Experiment actions are 40px high on wider layouts and 63px at 320px |
| Themes | Supported result visually inspected in light and dark |

The first action originally sat 592px below the experiment title at 320px. The
cause was structural: the narrow layout stacked an entire sentence card before
a separate action card. Moving the action into the sentence card put it directly
after the claim and reduced the distance to 389px without hiding the labels that
say what is invented.

## Automated checks

`src/lib/experiments/hallucination.test.ts` covers the explicit sentence data,
the same generation rule across outcomes, sentence independence from changed
records, stable matter-of-fact wording, supported/contradicted/missing checks,
lookup by stable ID, reset-on-change, idempotent checking, full reset, and rapid
ordered actions.

Repository checks completed:

- `pnpm test` — 42 files, 876 tests
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build --webpack`

## Not verified

- No physical phone was used. The 320px check used real browser device-metrics
  emulation.
- BrowserOS neo cannot drive browser-chrome zoom, so 200% was checked as the
  equivalent 640px CSS-pixel reflow rather than with the browser zoom control.
- No screen reader was run. The accessibility tree exposes named buttons, the
  year comparison as a description list, the live result, the explanation
  textbox, and the two disclosure controls; that is not the same as listening
  to VoiceOver or NVDA.
- No learner or user study was run. The validation gate remains open.
