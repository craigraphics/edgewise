import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';
import { composite, contrastRatio, parseOklch, type Rgb } from '@/lib/colour';

import { EDGE_OUT_OF_CONE, NODE_OPACITY, edgeStyle } from './focus';

/**
 * The guardrail the token contrast tests could not provide.
 *
 * `globals.test.ts` asserts every label sits at 4.5:1 or better against the card
 * it is drawn on. It passed at 11.60:1 worst case while the running interface
 * multiplied the whole node group by 0.22 the moment anything was focused,
 * taking the real number to 1.62:1. The test was measuring the design; the
 * defect was in the runtime.
 *
 * So this measures what is actually painted: the label composited at whatever
 * opacity focus applies, over the page behind it.
 */

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

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

function colour(theme: 'light' | 'dark', name: string): Rgb {
  const value = token(theme, name);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  return parseOklch(alias ? token(theme, alias[1]) : value);
}

const THEMES = ['light', 'dark'] as const;
const LABELS = ['foreground', 'muted-foreground'] as const;

describe('focus never costs legibility', () => {
  /*
   * The rule, stated once: whatever focus does, a node's label is still
   * readable. If someone reintroduces a dim, this is where it stops.
   */
  for (const theme of THEMES) {
    for (const label of LABELS) {
      it(`${theme}: ${label} stays at AA on a node outside the focused cone`, () => {
        const page = colour(theme, 'surface-0');
        const card = composite(colour(theme, 'surface-1'), page, NODE_OPACITY);
        const text = composite(colour(theme, label), page, NODE_OPACITY);
        expect(contrastRatio(text, card)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('does not fade node cards at all', () => {
    expect(NODE_OPACITY).toBe(1);
  });

  /*
   * The measurement that made the rule. Kept as a test so the reasoning is
   * checkable rather than remembered: there is no opacity that both recedes
   * usefully and keeps a muted label legible, which is why the fix had to be
   * additive rather than a better number.
   */
  it('records why dimming was not merely retuned', () => {
    for (const theme of THEMES) {
      const page = colour(theme, 'surface-0');
      const readable = [0.22, 0.45, 0.65].filter((opacity) => {
        const card = composite(colour(theme, 'surface-1'), page, opacity);
        const text = composite(colour(theme, 'muted-foreground'), page, opacity);
        return contrastRatio(text, card) >= 4.5;
      });
      expect(readable).toEqual([]);
    }
  });
});

describe('edgeStyle', () => {
  it('leaves everything alone when nothing is focused', () => {
    for (const satisfied of [true, false]) {
      expect(edgeStyle({ focused: false, inCone: true, satisfied }).opacity).toBe(1);
      expect(edgeStyle({ focused: false, inCone: false, satisfied }).opacity).toBe(1);
    }
  });

  it('raises the cone rather than only lowering the rest', () => {
    const lit = edgeStyle({ focused: true, inCone: true, satisfied: false });
    const resting = edgeStyle({ focused: false, inCone: false, satisfied: false });
    expect(lit.width).toBeGreaterThan(resting.width);
    expect(lit.opacity).toBe(1);
  });

  /* Edges are the only thing allowed to recede, and only some of the way. */
  it('softens edges outside the cone without erasing them', () => {
    const out = edgeStyle({ focused: true, inCone: false, satisfied: true });
    expect(out.opacity).toBe(EDGE_OUT_OF_CONE);
    expect(out.opacity).toBeGreaterThan(0.2);
    expect(out.opacity).toBeLessThan(0.6);
  });

  it('keeps the satisfied path heavier whether or not anything is focused', () => {
    expect(edgeStyle({ focused: false, inCone: false, satisfied: true }).width).toBeGreaterThan(
      edgeStyle({ focused: false, inCone: false, satisfied: false }).width,
    );
    expect(edgeStyle({ focused: true, inCone: false, satisfied: true }).width).toBeGreaterThan(
      edgeStyle({ focused: true, inCone: false, satisfied: false }).width,
    );
  });

  it('is defined for every node in the graph without special cases', () => {
    for (const node of GRAPH.nodes) {
      expect(edgeStyle({ focused: true, inCone: true, satisfied: node.layer === 0 }).width).toBeGreaterThan(0);
    }
  });
});
