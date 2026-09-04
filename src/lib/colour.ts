/**
 * oklch to sRGB, alpha compositing, and WCAG contrast.
 *
 * This exists because the map's legibility was a real, measured defect and not
 * an opinion: the label used to sit directly on the band colour, so white text
 * on a 90%-opacity band came out at 2.89:1 in light mode — an AA failure on the
 * state the map most wants read, invisible to anyone working in dark mode.
 *
 * The fix was structural (the label moved onto an opaque neutral card), and the
 * test alongside this file is what stops it drifting back. Both need to be able
 * to turn the tokens in `globals.css` into numbers without a browser.
 *
 * Small enough to own rather than depend on, and the conversion is a fixed piece
 * of published maths that will not change.
 */

export type Rgb = readonly [number, number, number];

/** Oklab → linear sRGB → gamma-encoded sRGB, clipped to gamut. */
export function oklchToSrgb(lightness: number, chroma: number, hueDegrees: number): Rgb {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const encode = (v: number) =>
    Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055));

  return [encode(linear[0]), encode(linear[1]), encode(linear[2])] as const;
}

/** `oklch(L C H)`, with or without a trailing alpha. Throws on anything else. */
export function parseOklch(value: string): Rgb {
  const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!match) throw new Error(`not an oklch colour: ${value}`);
  return oklchToSrgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** `foreground` painted at `alpha` over `background`. */
export function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
  ] as const;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
