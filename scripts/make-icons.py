"""Draw the site's icons from the wordmark's own letter.

The header sets `edgewise.` in Newsreader SemiBold with a full stop in the
`learning` band colour. The icon is that mark cropped to its first letter, so it
is the same drawing rather than a second one that has to be kept in step.

Run it only when the mark changes:

    uv run --with fonttools --with pillow scripts/make-icons.py

It writes `src/app/icon.svg`, `src/app/favicon.ico`, `src/app/apple-icon.png`,
the two manifest PNGs in `public/`, and the sharing card. The outputs are
committed; this file is here so the next person does not have to redraw an `e`
by hand to move it.

The card's wording is read out of `src/lib/seo.ts` rather than kept here, so the
sentence on the image and the sentence in `<meta name="description">` cannot
drift apart. Changing that constant means running this again.

Two things that are deliberate:

- **The small frames use a different optical size.** Newsreader is a variable
  font with an `opsz` axis, and that axis exists for exactly this. At 16px the
  16pt cut closes its own counter into a blur, so the 16px frame is drawn from
  the 6pt cut, which has sturdier strokes and an open eye. Same letter, drawn
  for the size it is read at.
- **The 16px frame drops the full stop.** At that size the dot is one pixel of
  teal beside the letter, which reads as a stray pixel rather than as the mark.
"""

import hashlib
import io
import math
import re
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "node_modules" / ".cache" / "edgewise-icons"

# Newsreader, the same family `next/font` self-hosts for headings. OFL 1.1.
FONT_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/"
    "Newsreader%5Bopsz%2Cwght%5D.ttf"
)
FONT_SHA256 = "8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1"

WEIGHT = 600  # the wordmark's weight


def oklch(L: float, C: float, h: float) -> tuple[int, int, int]:
    """The tokens in `globals.css` are oklch; PIL wants 8-bit sRGB."""
    hr = math.radians(h)
    a, b = C * math.cos(hr), C * math.sin(hr)
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )

    def enc(c: float) -> int:
        c = 1.055 * (c ** (1 / 2.4)) - 0.055 if c > 0.0031308 else 12.92 * c
        return max(0, min(255, round(c * 255)))

    return tuple(enc(c) for c in lin)


# `--foreground` and `--surface-0` from the light theme, and the dark theme's
# `--band-learning` — the light one is too dark to read on this background.
INK = oklch(0.205, 0.014, 265)
PAPER = oklch(0.981, 0.005, 85)
TEAL = oklch(0.745, 0.115, 196)
# `--muted-foreground` from the dark theme: the card is drawn on `INK`.
MUTED = oklch(0.735, 0.016, 265)

# Proportions, as fractions of the icon's own side.
CORNER = 0.22
GLYPH_HEIGHT = 0.50
# The 16px frame has no full stop beside it, so the letter takes the room the
# dot would have used rather than sitting small in the middle of the badge.
GLYPH_HEIGHT_ALONE = 0.56
DOT_RADIUS = 0.058
DOT_GAP = 0.052


def site_description() -> str:
    """The one in `src/lib/seo.ts`. Parsed rather than copied — see the note above."""
    source = (ROOT / "src/lib/seo.ts").read_text()
    match = re.search(r"export const DESCRIPTION\s*=\s*\n?\s*'([^']*)'", source)
    if not match:
        raise SystemExit("Could not find DESCRIPTION in src/lib/seo.ts.")
    return match.group(1)


def wrap(text: str, face: ImageFont.FreeTypeFont, width: float) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if face.getlength(trial) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def card() -> Image.Image:
    """1200x630, the shape every network crops from.

    No external font and no network call at render time: this is a file, not an
    `ImageResponse`, so a blip cannot turn into a failed deploy or a blank card.
    """
    width, height = 1200, 630
    img = Image.new("RGB", (width, height), INK)
    pen = ImageDraw.Draw(img)

    display = as_ttf_bytes(instance(72))
    mark = ImageFont.truetype(io.BytesIO(display), 132)
    body = ImageFont.truetype(io.BytesIO(as_ttf_bytes(instance(16))), 44)

    left, top = 96, 170
    pen.text((left, top), "edgewise", font=mark, fill=PAPER)
    box = mark.getbbox("edgewise")
    # The full stop sits on the baseline, so it is measured against a letter
    # with no descender. Against the whole word it hangs level with the g.
    baseline = top + mark.getbbox("e")[3]
    radius = 11
    pen.ellipse(
        [left + box[2] + 14, baseline - 2 * radius, left + box[2] + 14 + 2 * radius, baseline],
        fill=TEAL,
    )

    y = top + box[3] + 60
    for line in wrap(site_description(), body, width - 2 * left):
        pen.text((left, y), line, font=body, fill=MUTED)
        y += 62

    return img


def hexcolor(rgb: tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % rgb


def variable_font() -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / "Newsreader.ttf"
    if not cached.exists():
        cached.write_bytes(urllib.request.urlopen(FONT_URL).read())
    data = cached.read_bytes()
    got = hashlib.sha256(data).hexdigest()
    if got != FONT_SHA256:
        raise SystemExit(
            f"Newsreader does not hash to the pinned value.\n  expected {FONT_SHA256}\n  got      {got}\n"
            "Upstream has moved. Look at the letter before updating the constant."
        )
    return data


def instance(opsz: float) -> TTFont:
    font = TTFont(io.BytesIO(variable_font()))
    return instancer.instantiateVariableFont(font, {"wght": WEIGHT, "opsz": opsz}, inplace=False)


def as_ttf_bytes(font: TTFont) -> bytes:
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def draw(size: int, opsz: float, dot: bool, supersample: int) -> Image.Image:
    """One frame. `supersample` of 1 renders at the target size, which keeps the
    hinting FreeType applies at 16px; anything larger is drawn big and reduced."""
    side = size * supersample
    img = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    pen = ImageDraw.Draw(img)
    pen.rounded_rectangle([0, 0, side - 1, side - 1], radius=side * CORNER, fill=INK)

    ttf = as_ttf_bytes(instance(opsz))
    # Ask for the point size that makes the letter's own bounding box the
    # fraction of the frame we want. Its height is what reads, not its em.
    probe = ImageFont.truetype(io.BytesIO(ttf), 100)
    box = probe.getbbox("e")
    fraction = GLYPH_HEIGHT if dot else GLYPH_HEIGHT_ALONE
    points = max(1, round(100 * (fraction * side) / (box[3] - box[1])))
    face = ImageFont.truetype(io.BytesIO(ttf), points)
    box = face.getbbox("e")
    width, height = box[2] - box[0], box[3] - box[1]

    radius = DOT_RADIUS * side if dot else 0.0
    gap = DOT_GAP * side if dot else 0.0
    left = (side - (width + gap + 2 * radius)) / 2
    top = (side - height) / 2
    pen.text((left - box[0], top - box[1]), "e", font=face, fill=PAPER)
    if dot:
        cx, cy = left + width + gap + radius, top + height - radius
        pen.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=TEAL)

    return img.resize((size, size), Image.LANCZOS) if supersample > 1 else img


def svg() -> str:
    """The same composition as an outline, so it is resolution-free."""
    font = instance(16)
    glyphs = font.getGlyphSet()
    # Font units at 2000 per em: a whole number is finer than any screen.
    path_pen = SVGPathPen(glyphs, ntos=lambda value: f"{value:.0f}")
    glyphs["e"].draw(path_pen)

    from fontTools.pens.boundsPen import BoundsPen

    bounds_pen = BoundsPen(glyphs)
    glyphs["e"].draw(bounds_pen)
    x_min, y_min, x_max, y_max = bounds_pen.bounds

    side = 32.0
    scale = (GLYPH_HEIGHT * side) / (y_max - y_min)
    width = (x_max - x_min) * scale
    radius = DOT_RADIUS * side
    gap = DOT_GAP * side
    left = (side - (width + gap + 2 * radius)) / 2
    top = (side - GLYPH_HEIGHT * side) / 2
    # SVG's y runs down and a font's runs up, hence the negative y scale.
    tx = left - scale * x_min
    ty = top + scale * y_max
    cx = left + width + gap + radius
    cy = top + GLYPH_HEIGHT * side - radius

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">\n'
        "  <!-- Generated by scripts/make-icons.py. The letter is Newsreader SemiBold,\n"
        "       outlined, so this file needs no font to render. -->\n"
        f'  <rect width="32" height="32" rx="{CORNER * side:.3f}" fill="{hexcolor(INK)}"/>\n'
        f'  <path transform="translate({tx:.4f} {ty:.4f}) scale({scale:.6f} -{scale:.6f})"'
        f' fill="{hexcolor(PAPER)}" d="{path_pen.getCommands()}"/>\n'
        f'  <circle cx="{cx:.3f}" cy="{cy:.3f}" r="{radius:.3f}" fill="{hexcolor(TEAL)}"/>\n'
        "</svg>\n"
    )


def main() -> None:
    (ROOT / "src/app/icon.svg").write_text(svg())

    # Three frames, because a browser picks the nearest and a Windows shortcut
    # asks for 48. The dot is dropped at 16 and the small cut used there.
    small = draw(16, opsz=6, dot=False, supersample=1)
    medium = draw(32, opsz=8, dot=True, supersample=8)
    large = draw(48, opsz=10, dot=True, supersample=8)
    # The base frame has to be the biggest one: Pillow drops any requested size
    # larger than the image it was handed, and silently writes a one-frame file.
    large.save(
        ROOT / "src/app/favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[small, medium],
    )

    draw(180, opsz=16, dot=True, supersample=4).save(ROOT / "src/app/apple-icon.png")
    for size in (192, 512):
        draw(size, opsz=16, dot=True, supersample=2).save(ROOT / f"public/icon-{size}.png")

    card().save(ROOT / "src/app/opengraph-image.png", optimize=True)

    print("wrote icon.svg, favicon.ico, apple-icon.png, public/icon-*.png, opengraph-image.png")


if __name__ == "__main__":
    main()
