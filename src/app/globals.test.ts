import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import { composite, contrastRatio, parseOklch, type Rgb } from '@/lib/colour';

/**
 * The map has to be legible in both themes, and this is what enforces it.
 *
 * Not a style preference. The arrangement this replaced put the node label
 * directly on the band colour at four different opacities, so its contrast was
 * hostage to whichever of six hues a node belonged to — twenty-four
 * combinations that all had to pass, and seven did not. Measured worst case was
 * **2.89:1** on `known` in light mode, against an AA requirement of 4.5, on the
 * single state the map most wants read. It was invisible to everyone working on
 * this because dark mode passed.
 *
 * So the numbers are asserted rather than eyeballed, against the real tokens in
 * `globals.css` rather than against a copy. Retuning a band or a surface now
 * fails here rather than in front of a learner.
 */

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/**
 * Reads a custom property out of a `:root` or `.dark` block.
 *
 * Both selectors appear several times in the file — the tokens are grouped by
 * what they are for, not by selector — so every matching block is searched and
 * the last definition wins, which is what the cascade does.
 */
function token(theme: 'light' | 'dark', name: string): string {
  const selector = theme === 'dark' ? '\\.dark' : ':root';
  const blocks = [...CSS.matchAll(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 'g'))];
  let found: string | null = null;
  for (const block of blocks) {
    const match = block[1].match(new RegExp(`--${name}:\\s*([^;]+);`));
    if (match) found = match[1].trim();
  }
  if (!found) throw new Error(`no --${name} in ${theme}`);
  return found;
}

/** Follows one level of `var(--x)`, which is how the surfaces alias each other. */
function colour(theme: 'light' | 'dark', name: string): Rgb {
  const value = token(theme, name);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  return parseOklch(alias ? token(theme, alias[1]) : value);
}

const THEMES = ['light', 'dark'] as const;
const BANDS = GRAPH.bands.map((band) => band.id);

/**
 * Mirrors `STATE_STYLE` and the card in `concept-map.tsx`. If those change and
 * this does not, the numbers below stop describing what is on screen — so the
 * duplication is deliberate and the comment is the warning.
 */
const NODE_STATES = [
  { id: 'known', tint: 0.1, tintLight: 0.08, label: 'foreground' as const },
  { id: 'shaky', tint: 0, tintLight: 0, label: 'foreground' as const },
  { id: 'blocked', tint: 0, tintLight: 0, label: 'foreground' as const },
  { id: 'unexplored', tint: 0, tintLight: 0, label: 'muted-foreground' as const },
];

describe('map node labels', () => {
  for (const theme of THEMES) {
    for (const state of NODE_STATES) {
      for (const band of BANDS) {
        it(`${theme}: ${state.id} on ${band} meets AA`, () => {
          const card = colour(theme, 'surface-1');
          const tint = theme === 'dark' ? state.tint : state.tintLight;
          const fill = tint > 0 ? composite(colour(theme, `band-${band}`), card, tint) : card;
          expect(contrastRatio(colour(theme, state.label), fill)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }

  /*
   * The property that made the fix structural rather than a retune: because the
   * label sits on a neutral card, its contrast barely moves across the six
   * bands. The old arrangement varied by more than a full ratio point between
   * hues, which is why no amount of picking better colours could have fixed it.
   */
  it('is nearly independent of which band a node belongs to', () => {
    for (const theme of THEMES) {
      const card = colour(theme, 'surface-1');
      const tint = theme === 'dark' ? 0.1 : 0.08;
      const ratios = BANDS.map((band) =>
        contrastRatio(colour(theme, 'foreground'), composite(colour(theme, `band-${band}`), card, tint)),
      );
      expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(1);
    }
  });
});

describe('band accents', () => {
  /* Non-text graphics: the 3px bar down a node's leading edge, and the glyph. */
  for (const theme of THEMES) {
    for (const band of BANDS) {
      it(`${theme}: ${band} is distinguishable from the card it sits on`, () => {
        expect(contrastRatio(colour(theme, `band-${band}`), colour(theme, 'surface-1'))).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('panel text', () => {
  for (const theme of THEMES) {
    for (const surface of ['surface-0', 'surface-1', 'surface-2'] as const) {
      it(`${theme}: body text on ${surface} meets AA`, () => {
        expect(contrastRatio(colour(theme, 'foreground'), colour(theme, surface))).toBeGreaterThanOrEqual(4.5);
      });

      it(`${theme}: muted text on ${surface} meets AA`, () => {
        expect(contrastRatio(colour(theme, 'muted-foreground'), colour(theme, surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

/**
 * The two experiment readouts print their headline number in the band colour.
 * That combination was never measured — the panel-text block above only covers
 * `foreground` and `muted-foreground` — and it is the one number a learner has
 * to read off these panels.
 *
 * It found a shipped defect. The card used to be a 10% tint of its own band, and
 * band-on-that-tint measures **4.18:1** in light mode, under AA, with no tint
 * that still reads as a tint reaching 4.5. Same shape as the map-node failure
 * above: text sitting on the band colour. The card is a plain surface now.
 *
 * Mirrors `.predictor-result-value` and `.phases-value` in `globals.css`.
 */
describe('experiment readouts', () => {
  for (const theme of THEMES) {
    it(`${theme}: the headline value is legible on its card`, () => {
      expect(contrastRatio(colour(theme, 'band-foundations'), colour(theme, 'surface-0'))).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: the label above it meets AA on the same card`, () => {
      expect(contrastRatio(colour(theme, 'muted-foreground'), colour(theme, 'surface-0'))).toBeGreaterThanOrEqual(4.5);
    });

    /* The card has to be visible against the readout it sits in. */
    it(`${theme}: the card separates from the readout behind it`, () => {
      expect(contrastRatio(colour(theme, 'band-foundations'), colour(theme, 'surface-2'))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('the no-red rule', () => {
  /*
   * "Red is reserved for nothing." The `behaviour` band used to sit at hue 25
   * with chroma 0.15, which rendered as a saturated red-pink — so "Hallucination"
   * and "What the model sees" read as error rows in a table, which is exactly
   * the scorecard reading this product cannot survive.
   *
   * Nothing that carries meaning about a learner may sit in the alarm range.
   * `--destructive` is exempt because it is the alarm, and is used nowhere in
   * the map or the panels.
   */
  it('keeps every band clear of the alarm range', () => {
    for (const theme of THEMES) {
      for (const band of BANDS) {
        const value = token(theme, `band-${band}`);
        const [, chroma, hue] = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)!.slice(1).map(Number);
        const distanceFromRed = Math.min(Math.abs(hue - 25), 360 - Math.abs(hue - 25));
        const inAlarmRange = distanceFromRed < 15 && chroma > 0.13;
        expect(inAlarmRange, `${theme} --band-${band} is ${value}`).toBe(false);
      }
    }
  });
});
