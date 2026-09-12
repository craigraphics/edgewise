import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { contrastRatio, type Rgb } from '@/lib/colour';

/**
 * The pixel grid's two colours, held to a number.
 *
 * These are the one place in the interface that deliberately does NOT use the
 * theme tokens. The panel is about brightness values, so a cell worth 1 has to
 * read as white in both themes; letting dark mode swap them would make 1 the
 * dark value and quietly contradict the arithmetic printed next to it. That
 * exemption means `globals.test.ts` does not cover them, and this project has
 * shipped an illegible map once already by measuring the wrong quantity.
 *
 * Each cell also prints its own value as a digit, so what is asserted here is
 * the digit against the cell it sits on — in both directions, since the two
 * colours swap roles between a white cell and a black one.
 */

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

function hex(name: string): Rgb {
  const block = CSS.match(/\.representation-lab\s*\{([^}]*)\}/);
  if (!block) throw new Error('no .representation-lab block in globals.css');
  const match = block[1].match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6});`));
  if (!match) throw new Error(`no --${name} in .representation-lab`);
  const value = match[1];
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16)) as unknown as Rgb;
}

describe('the pixel grid colours', () => {
  const white = hex('pixel-white');
  const black = hex('pixel-black');

  it('prints a legible digit on a white cell and on a black one', () => {
    expect(contrastRatio(black, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(white, black)).toBeGreaterThanOrEqual(4.5);
  });

  /** Far above AA, because this is the element the panel most wants read. */
  it('keeps the two values far apart, so the grid survives greyscale', () => {
    expect(contrastRatio(white, black)).toBeGreaterThan(15);
  });

  it('reads as white and as black, not as two mid greys', () => {
    expect(Math.min(...white)).toBeGreaterThan(230);
    expect(Math.max(...black)).toBeLessThan(45);
  });

  /**
   * Defined once rather than per theme. A `.dark` override would make the same
   * cell value paint differently in the two themes, which is the contradiction
   * the fixed colours exist to prevent.
   */
  it('is not redefined under a theme', () => {
    for (const name of ['pixel-white', 'pixel-black']) {
      const definitions = [...CSS.matchAll(new RegExp(`--${name}:`, 'g'))];
      expect(definitions, `--${name} is defined more than once`).toHaveLength(1);
    }
  });
});
