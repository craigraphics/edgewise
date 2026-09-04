/**
 * Measuring and wrapping the map's node labels.
 *
 * SVG `<text>` does not wrap, and the labels no longer fit on one line: at the
 * 13px the map now uses, "Blame, spread backwards" is 156px wide inside a node
 * that gives its label 118px. The previous build dodged this by rendering at
 * 10.5px and truncating with an ellipsis, which put the map's labels below the
 * legibility floor to avoid solving the wrap.
 *
 * So widths are estimated here, in pure code, and the label is split across at
 * most two lines. Estimated rather than measured because measurement means a
 * canvas, which means the browser, which means the server and the first client
 * render disagree about how many lines a node has and the whole map reflows on
 * hydration.
 *
 * The table below is not guessed. It is `CanvasRenderingContext2D.measureText`
 * run against the real Geist face at 13px/500, divided by the font size, and
 * transcribed. Re-measure it if the UI face ever changes — there is a script
 * for it in the redesign notes.
 */

/** Advance width per character, as a multiple of the font size. */
const ADVANCE: Record<string, number> = {};

function register(chars: string, width: number) {
  for (const char of chars) ADVANCE[char] = width;
}

register("'", 0.186);
register(',.', 0.213);
register(' ', 0.243);
register('i', 0.256);
register('I', 0.28);
register('l', 0.282);
register('j', 0.284);
register('()', 0.29);
register(':', 0.302);
register('r', 0.394);
register('1', 0.406);
register('t', 0.41);
register('f', 0.412);
register('-', 0.418);
register('7', 0.531);
register('s', 0.537);
register('z', 0.552);
register('y', 0.553);
register('v', 0.56);
register('Z', 0.561);
register('c', 0.563);
register('a', 0.565);
register('T', 0.568);
register('e', 0.576);
register('L', 0.583);
register('u', 0.586);
register('o', 0.588);
register('hn', 0.591);
register('Y', 0.594);
register('F', 0.595);
register('6', 0.604);
register('9', 0.606);
register('Jgx', 0.607);
register('bdpq', 0.608);
register('Ek', 0.609);
register('8', 0.624);
register('3', 0.625);
register('4', 0.629);
register('2', 0.63);
register('X', 0.633);
register('5', 0.641);
register('S', 0.654);
register('K', 0.656);
register('P', 0.657);
register('0', 0.673);
register('R', 0.68);
register('BV', 0.688);
register('A', 0.689);
register('U', 0.694);
register('D', 0.701);
register('CG', 0.713);
register('H', 0.716);
register('NQ', 0.745);
register('O', 0.751);
register('w', 0.829);
register('m', 0.885);
register('M', 0.89);
register('W', 0.968);

/** Anything unlisted — an em dash, an accent — gets a middling lowercase width. */
const FALLBACK = 0.6;

/**
 * Summed advances, which is a few per cent WIDER than the browser will draw the
 * same string — the browser also applies kerning, and kerning only ever pulls
 * pairs closer together.
 *
 * That error is deliberately left in and deliberately in this direction. An
 * over-estimate wraps a word early; an under-estimate lets a label run out past
 * the edge of its card, which is the visible failure. Measured against the real
 * face, the gap is about 2%, and the test holds it there.
 */
export function textWidth(text: string, fontSize: number): number {
  let total = 0;
  for (const char of text) total += ADVANCE[char] ?? FALLBACK;
  return total * fontSize;
}

/**
 * Split a label into at most `maxLines` lines that each fit `maxWidth`.
 *
 * Greedy, then truncated. Greedy rather than balanced because these labels are
 * two or three words: "Blame, spread backwards" balanced gives "Blame," on a
 * line of its own, which reads as two labels rather than one. Filling each line
 * keeps the phrase together.
 *
 * A single word too long for a line is truncated with an ellipsis rather than
 * broken — a hyphenated fragment of "Hallucination" is less recoverable than a
 * cut one.
 */
export function wrapLabel(label: string, maxWidth: number, fontSize: number, maxLines = 2): string[] {
  const words = label.split(' ').filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let line = '';
  let index = 0;

  while (index < words.length) {
    const word = words[index];
    const candidate = line ? `${line} ${word}` : word;

    // On the final permitted line, everything remaining goes on regardless and
    // the truncation below deals with the overflow. Wrapping further would
    // silently drop words.
    // A word that does not fit an empty line has nowhere better to go either.
    if (lines.length === maxLines - 1 || !line || textWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
      index += 1;
      continue;
    }

    lines.push(line);
    line = '';
  }

  lines.push(line);
  return lines.map((entry) => truncate(entry, maxWidth, fontSize));
}

/** Shorten to fit, with an ellipsis. The safety net, not the usual path. */
export function truncate(text: string, maxWidth: number, fontSize: number): string {
  if (textWidth(text, fontSize) <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && textWidth(`${cut}…`, fontSize) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}
