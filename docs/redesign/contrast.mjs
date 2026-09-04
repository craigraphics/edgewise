import { parse, over, contrast, hex } from './color.mjs';

const T = {
  dark: {
    s0: 'oklch(0.155 0.012 265)',
    s1: 'oklch(0.188 0.013 265)',
    s2: 'oklch(0.232 0.014 265)',
    fg: 'oklch(0.968 0.006 265)',
    muted: 'oklch(0.735 0.016 265)',
    bands: {
      foundations: 'oklch(0.70 0.125 258)',
      learning: 'oklch(0.745 0.115 196)',
      networks: 'oklch(0.755 0.125 152)',
      language: 'oklch(0.79 0.125 78)',
      behaviour: 'oklch(0.735 0.115 38)',
      systems: 'oklch(0.705 0.135 300)',
    },
  },
  light: {
    s0: 'oklch(0.981 0.005 85)',
    s1: 'oklch(0.995 0.003 85)',
    s2: 'oklch(0.965 0.006 85)',
    fg: 'oklch(0.205 0.014 265)',
    muted: 'oklch(0.505 0.014 265)',
    bands: {
      foundations: 'oklch(0.545 0.145 258)',
      learning: 'oklch(0.545 0.115 196)',
      networks: 'oklch(0.545 0.115 152)',
      language: 'oklch(0.585 0.125 78)',
      behaviour: 'oklch(0.575 0.135 38)',
      systems: 'oklch(0.525 0.165 300)',
    },
  },
};

// Proposed node: opaque card on --surface-2, band accent bar, label in fg/muted.
// `known` additionally tints the card with the band at KNOWN_TINT.
const KNOWN_TINT = { dark: 0.14, light: 0.11 };

console.log('PROPOSED — node label contrast (label 13px medium; AA small text = 4.5)\n');
for (const [name, t] of Object.entries(T)) {
  const s1 = parse(t.s1), s2 = parse(t.s2), fg = parse(t.fg), muted = parse(t.muted);
  console.log(`## ${name}`);
  console.log(`  surface-1 ${hex(s1)}  surface-2 ${hex(s2)}  fg ${hex(fg)}  muted ${hex(muted)}`);
  console.log(`  fg on surface-2      ${contrast(fg, s2).toFixed(2)}`);
  console.log(`  muted on surface-2   ${contrast(muted, s2).toFixed(2)}`);
  console.log(`  muted on surface-1   ${contrast(muted, s1).toFixed(2)}`);

  let worstLabel = Infinity, worstAccent = Infinity;
  for (const [band, value] of Object.entries(t.bands)) {
    const b = parse(value);
    const knownFill = over(b, s2, KNOWN_TINT[name]);
    const label = contrast(fg, knownFill);          // known label
    const accentOnCard = contrast(b, s2);           // 3:1 graphic minimum
    worstLabel = Math.min(worstLabel, label);
    worstAccent = Math.min(worstAccent, accentOnCard);
    console.log(
      `    ${band.padEnd(12)} ${hex(b)}  known-label ${label.toFixed(2).padStart(5)}  accent/card ${accentOnCard.toFixed(2).padStart(5)}`,
    );
  }
  console.log(`  worst known label ${worstLabel.toFixed(2)} ${worstLabel >= 4.5 ? 'PASS' : 'FAIL'}`);
  console.log(`  worst band accent ${worstAccent.toFixed(2)} ${worstAccent >= 3 ? 'PASS (graphic 3:1)' : 'FAIL'}`);

  // edges
  const sat = over(fg, s1, 0.5);
  const faint = over(fg, s1, 0.16);
  console.log(`  edge satisfied ${contrast(sat, s1).toFixed(2)}  faint ${contrast(faint, s1).toFixed(2)}`);
  console.log();
}
