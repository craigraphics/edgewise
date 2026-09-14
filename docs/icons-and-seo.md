# The mark, and being findable — 2026-09-14

Branch `favicon-and-seo`, from `main` at `c021293`. Two things: an icon drawn
from the wordmark's own letter, and the metadata a page needs before a link to
it is worth sharing.

Repo: https://github.com/craigraphics/edgewise

## The icon is the wordmark, cropped

The header sets `edgewise.` in Newsreader SemiBold with a full stop in the
`learning` band colour. The icon is that, cropped to its first letter, so it is
the same drawing rather than a second one that has to be kept in step with it.
Near-black card, paper letter, teal dot — legible on a light tab strip and on a
dark one, which a letterform with no field behind it is not.

`scripts/make-icons.py` draws all of it and is committed, so nobody has to
redraw an `e` by hand to move it:

```
uv run --with fonttools --with pillow scripts/make-icons.py
```

It writes `src/app/icon.svg`, `src/app/favicon.ico` (16/32/48),
`src/app/apple-icon.png` (180), `public/icon-192.png`, `public/icon-512.png`
and `src/app/opengraph-image.png`. Newsreader is fetched from Google's own
repository and **held to a pinned SHA-256** — the mark should not change because
upstream did, and if it ever does the script stops rather than quietly drawing a
different letter.

### Three things that are deliberate

**The small frames use a different optical size.** Newsreader is a variable
font with an `opsz` axis, and that axis exists for exactly this. Drawn from the
16pt cut, the 16px frame closes its own counter into a smudge; drawn from the
6pt cut it has an open eye and sturdy strokes. 16px is drawn at `opsz` 6, 32 at
8, 48 at 10, and everything larger at 16. Same letter, drawn for the size it is
read at. Compared on screen at 5x before choosing, not reasoned about.

**The 16px frame drops the full stop**, and the letter takes the room the dot
would have used. At that size the dot is one pixel of teal beside the letter,
which reads as a stray pixel rather than as the mark.

**The 16px frame is rendered at 16px**, where the other sizes are drawn large
and reduced. Reducing from 8x lost the hinting FreeType applies at that size,
and the difference was visible in the comparison sheet.

### A trap paid for

`Image.save(..., format="ICO", sizes=[...], append_images=[...])` **drops any
requested size larger than the image it was handed, and writes a one-frame file
without a word.** The first attempt passed the 16px frame as the base and
produced a `favicon.ico` containing one 16px image. The base has to be the
largest frame. Verified by reading the sizes back out of the written file
rather than by trusting the call.

## SEO — what was wrong, and what it is now

The site answers on a real domain and was serving `noindex, nofollow`, a bare
title, a one-line description and nothing else. No `robots.txt` (404), no
sitemap, no canonical, no sharing card, no icon of any kind.

| | Before | After |
|---|---|---|
| `robots` meta | `noindex, nofollow` | `index, follow` |
| `/robots.txt` | 404 | allows `/`, refuses `/api/` and `/lab` |
| `/sitemap.xml` | 404 | one entry, the root |
| Canonical | none | `https://edgewise.craigraphics.com` |
| Title | `Edgewise` | `Edgewise — find the one idea blocking the rest` |
| Description | 62 chars | 144 chars, and it says what the thing does |
| Open Graph / Twitter | none | full, with a 1200x630 card |
| Icons | none | `.ico`, `.svg`, apple-touch, two manifest PNGs |
| Manifest | none | `/manifest.webmanifest` |
| `theme-color` | none | per scheme, from `--surface-0` |

**`index: true` is the one behavioural change, and it is the owner's to veto.**
It is one line in `src/app/layout.tsx`. Note that `robots.ts` allows crawling on
its own, so flipping the site back to a private draft means changing both.

**`metadataBase` is hard-coded, not read from `VERCEL_URL`.** That variable is
the per-deployment hostname: canonicals built from it point every preview at
itself, and a crawler reaching one sees the whole site duplicated at an address
that will not exist next week.

**`/lab` is disallowed in `robots.txt`.** It is deliberately unlinked — a
testing harness in the main navigation is a mistake this project has already
made once — and an indexed one is the same mistake by another route. It is a
`'use client'` page and cannot export its own metadata, so `robots.txt` is where
this has to be said.

**`/intro` is crawlable but is not in the sitemap.** Whether it is somewhere to
send a stranger is one of the open questions in `docs/handover.md`, and a
sitemap entry would answer it on the owner's behalf. Nothing links to it, so
nothing will find it until something does.

**The card's sentence is read out of `src/lib/seo.ts`, not typed twice.**
`make-icons.py` parses that constant, so the line on the image and the line in
`<meta name="description">` cannot disagree. The remaining failure is forgetting
to run the script after changing it, which is written down in both files.

**The card is a file, not an `ImageResponse`.** An `ImageResponse` that fetches
a font at render time turns a network blip into a blank card or a failed deploy.
This one needs no font and no request.

**No `twitter-image` file.** Next emits `twitter:image` from the same
`opengraph-image`, verified in the served `<head>`. Two files that drift apart
is how one network ends up showing last month's wording.

## Verified

Served the production build and read the emitted `<head>`:

- `title`, `description`, `robots: index, follow`, `canonical`, `og:*` (title,
  description, url, site_name, locale, type, image with width/height/alt),
  `twitter:card=summary_large_image` with title, description and image.
- `link rel=icon` for `favicon.ico` at 48x48 and `icon.svg` at `any`,
  `apple-touch-icon` at 180x180, `link rel=manifest`, both `theme-color` metas.
- `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/favicon.ico`,
  `/icon.svg`, `/apple-icon.png`, `/opengraph-image.png` and `/icon-192.png` all
  200 with the right content types.
- `icon.svg` opened in a browser and looked at — the outlined path renders as
  the letter, which a path emitted by a pen is not guaranteed to do.
- Every `.ico` frame read back out of the file at 5x, and the card looked at.
- The app itself still renders; the header's wordmark and the icon are visibly
  the same letter.

`pnpm lint`, `pnpm typecheck`, `pnpm test` (680) and `pnpm build` all pass.

## Not verified

- **Nothing was checked on a real crawler or a real network's preview.** Google
  Search Console, and the card debuggers for the networks that have them, are
  things only the owner can run against the deployed site.
- **No phone.** The apple-touch icon and the manifest were checked as files and
  as served responses, not on a home screen.
- **The assessor is untouched.** No prompt, schema, model list or graph file is
  changed here, so `pnpm calibrate` says nothing about this work and was not
  run. The last four sessions recorded it failing on exactly two fixtures —
  2/72 false passes for `hallucination/parroted`, which `AGENTS.md` records as
  deliberately left failing, and 3/24 false blocks for `neuron/technical`.

## Overlaps PR #2

`seo-and-icons` (#2, open since 2026-08-21) covers the same ground with the
`craigraphics` circle-in-ring mark rather than the letter, and its reasoning
about `metadataBase`, the manifest's PNG paths and `/api/` is the reasoning kept
here. It should be closed rather than merged alongside this.
