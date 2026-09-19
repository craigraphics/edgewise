/**
 * Words as lists of numbers, for the `embeddings` node.
 *
 * The node's two recorded misconceptions are that "similar words sit close
 * together" is the whole story, and that every word has one permanent
 * position. Both are about what a picture of a word space leaves out, so
 * nothing here is allowed to be decorative:
 *
 * - Every neighbour is computed from the FULL list of 100 numbers. The flat
 *   picture is a separate, optional projection of the same values, and
 *   `projectionDisagreesWith` exists so the panel's claim that the picture
 *   loses information is a measured fact rather than a sentence.
 * - The values are real learned GloVe vectors, checked in with their source
 *   and licence. Random numbers presented as meaning would teach the exact
 *   thing this node exists to correct.
 * - They are STATIC vectors: one fixed list per word, which is why the panel
 *   can show that a word with two meanings gets one list carrying traces of
 *   both. A modern language model computes a different list for a token in
 *   each sentence, and `SOURCE.kind` keeps those two things apart.
 *
 * See `scripts/extract-word-vectors.ts` for how the collection was built.
 */

import raw from '@/../content/word-vectors.json';

export type WordVectors = {
  source: {
    name: string;
    corpus: string;
    citation: string;
    url: string;
    licence: string;
    licenceUrl: string;
    file: string;
    kind: 'static';
    kindNote: string;
    dimensions: number;
    rounding: string;
    extractedBy: string;
  };
  opening: readonly string[];
  topics: readonly { id: string; label: string; words: readonly string[] }[];
  vectors: Readonly<Record<string, readonly number[]>>;
};

const data = raw as WordVectors;

export const SOURCE = data.source;
export const TOPICS = data.topics;
export const OPENING_WORDS = data.opening;
export const VECTORS = data.vectors;
export const DIMENSIONS = data.source.dimensions;
/** How many of the 100 numbers "See the numbers" shows before saying so. */
export const SHOWN_VALUES = 8;
/** How many neighbours a word's list gets. Short enough to read in one glance. */
export const NEIGHBOUR_COUNT = 5;

export const WORDS: readonly string[] = Object.keys(data.vectors);

export function hasWord(word: string): boolean {
  return Object.hasOwn(data.vectors, word);
}

/** The collection is small and saved. A word outside it has no values to compare. */
export function vectorFor(word: string): readonly number[] | null {
  return hasWord(word) ? data.vectors[word] : null;
}

export function topicOf(word: string): string | null {
  return TOPICS.find(topic => topic.words.includes(word))?.label ?? null;
}

/**
 * Why a collection cannot be used, or null when it can.
 *
 * A list of the wrong length, a value that is not a finite number, or a list
 * that is all zeros would each produce a comparison that looks like an answer
 * and means nothing — the all-zero case divides by zero and yields NaN. The
 * panel reports the reason rather than printing whatever came out.
 */
export function invalidReason(vectors: Readonly<Record<string, readonly number[]>>, dimensions = DIMENSIONS): string | null {
  const words = Object.keys(vectors);
  if (words.length < 2) return 'A comparison needs at least two words.';
  for (const word of words) {
    const values = vectors[word];
    if (values.length !== dimensions) return `${word} has ${values.length} numbers, not ${dimensions}.`;
    if (values.some(value => !Number.isFinite(value))) return `${word} has a value that is not a number.`;
    if (values.every(value => value === 0)) return `${word} is all zeros, so it points nowhere.`;
  }
  return null;
}

function magnitude(values: readonly number[]): number {
  return Math.sqrt(values.reduce((total, value) => total + value * value, 0));
}

/**
 * How alike two lists are, between −1 and 1.
 *
 * The angle between the two lists, not the gap between them: a word used ten
 * times as often would otherwise look unlike an identical one purely for being
 * longer.
 */
export function similarity(a: readonly number[], b: readonly number[]): number {
  const size = magnitude(a) * magnitude(b);
  if (size === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot / size;
}

export type Neighbour = { word: string; similarity: number };

/**
 * The words in the collection whose lists are most like this one's.
 *
 * Sorted by similarity, then by word, so the same collection always produces
 * the same list in the same order — a panel that reshuffled its answer between
 * two readings of the same word would not be showing anybody anything.
 */
export function neighboursOf(word: string, count = NEIGHBOUR_COUNT): Neighbour[] | null {
  const values = vectorFor(word);
  if (!values) return null;
  return WORDS
    .filter(other => other !== word)
    .map(other => ({ word: other, similarity: similarity(values, data.vectors[other]) }))
    .sort((a, b) => b.similarity - a.similarity || a.word.localeCompare(b.word))
    .slice(0, count);
}

/** Words in the collection containing what somebody typed, best match first. */
export function matchesFor(typed: string, count = 10): string[] {
  const needle = typed.trim().toLowerCase();
  if (!needle) return [];
  const starts = WORDS.filter(word => word.startsWith(needle));
  const contains = WORDS.filter(word => word.includes(needle) && !word.startsWith(needle));
  return [...starts, ...contains].slice(0, count);
}

/**
 * Words to offer instead of one the collection does not carry.
 *
 * A typo is the common case — "guitarr" is somebody who meant `guitar` — so the
 * search is retried on shorter and shorter openings of what they typed before
 * giving up. Only then do the four opening words stand in, which is a real way
 * back rather than an apology.
 */
export function suggestionsFor(typed: string, count = 4): string[] {
  const needle = typed.trim().toLowerCase();
  for (let length = needle.length; length >= 3; length -= 1) {
    const found = matchesFor(needle.slice(0, length), count);
    if (found.length) return found;
  }
  return [...OPENING_WORDS].slice(0, count);
}

export type Point = { word: string; x: number; y: number };

/**
 * A deterministic linear congruential generator, so the projection below is the
 * same drawing every time it is computed. Power iteration needs a starting
 * direction; anything random would move the picture between two readings of the
 * same collection, and a drawing that moves is not evidence of anything.
 */
function seeded(dimensions: number): number[] {
  let state = 20260913;
  return Array.from({ length: dimensions }, () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648 - 0.5;
  });
}

function scale(vector: number[], by: number): number[] {
  return vector.map(value => value * by);
}

/** The direction in which these lists spread out most, found by power iteration. */
function principalDirection(rows: number[][], dimensions: number): number[] {
  let direction = seeded(dimensions);
  let size = magnitude(direction);
  direction = scale(direction, 1 / size);

  for (let step = 0; step < 200; step += 1) {
    const next = new Array<number>(dimensions).fill(0);
    for (const row of rows) {
      let dot = 0;
      for (let i = 0; i < dimensions; i += 1) dot += row[i] * direction[i];
      for (let i = 0; i < dimensions; i += 1) next[i] += dot * row[i];
    }
    size = magnitude(next);
    if (size === 0) return direction;
    direction = scale(next, 1 / size);
  }

  /*
   * Power iteration is free to settle on either end of the same axis, so the
   * sign is pinned: the loading of largest magnitude is made positive. Without
   * it the picture could come out mirrored between two runs that agree about
   * everything that matters.
   */
  let widest = 0;
  for (let i = 1; i < dimensions; i += 1) if (Math.abs(direction[i]) > Math.abs(direction[widest])) widest = i;
  return direction[widest] < 0 ? scale(direction, -1) : direction;
}

/**
 * The optional flat picture: the two directions in which the collection spreads
 * out most, and every word's position along them.
 *
 * Computed from the full lists, and nothing in the panel reads a neighbour off
 * it. That separation is the honest half of showing the picture at all — it
 * keeps 2 numbers out of 100, and `projectionDisagreesWith` measures what that
 * costs.
 */
export function projection(words: readonly string[] = WORDS): Point[] {
  const rows = words.map(word => [...data.vectors[word]]);
  if (!rows.length) return [];
  const dimensions = rows[0].length;
  const centre = new Array<number>(dimensions).fill(0);
  for (const row of rows) for (let i = 0; i < dimensions; i += 1) centre[i] += row[i] / rows.length;
  const centred = rows.map(row => row.map((value, i) => value - centre[i]));

  const first = principalDirection(centred, dimensions);
  // Deflate: strip the first direction out, so the second cannot repeat it.
  const residual = centred.map(row => {
    let dot = 0;
    for (let i = 0; i < dimensions; i += 1) dot += row[i] * first[i];
    return row.map((value, i) => value - dot * first[i]);
  });
  const second = principalDirection(residual, dimensions);

  return words.map((word, index) => {
    let x = 0;
    let y = 0;
    for (let i = 0; i < dimensions; i += 1) {
      x += centred[index][i] * first[i];
      y += centred[index][i] * second[i];
    }
    return { word, x, y };
  });
}

/**
 * Words whose nearest neighbour in the flat picture is not their nearest
 * neighbour in the full lists.
 *
 * This is what lets the panel say the picture leaves a lot out without
 * asserting it: the disagreement is counted from the same collection the
 * learner is reading.
 */
export function projectionDisagreesWith(points: readonly Point[]): string[] {
  const flat = new Map(points.map(point => [point.word, point]));
  const disagreeing: string[] = [];
  for (const point of points) {
    const nearestFlat = points
      .filter(other => other.word !== point.word)
      .map(other => ({ word: other.word, distance: Math.hypot(other.x - point.x, other.y - point.y) }))
      .sort((a, b) => a.distance - b.distance || a.word.localeCompare(b.word))[0];
    const nearestFull = neighboursOf(point.word, 1)?.[0];
    if (nearestFlat && nearestFull && nearestFlat.word !== nearestFull.word && flat.has(nearestFlat.word)) {
      disagreeing.push(point.word);
    }
  }
  return disagreeing;
}
