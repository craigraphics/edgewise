/**
 * A 4x4 black-and-white picture, and two ways of turning it into numbers, for
 * the `features-and-representation` node.
 *
 * The node's claim is that a model only ever operates on the numbers it is
 * handed, and that whatever the encoding discards is gone from that point on.
 * So this file really does both encodings over the actual grid: nothing here
 * selects a prepared answer, and every number the panel prints — the average,
 * the ordered list, which positions differ, and how many other pictures share
 * the same encoding — is computed from the cells currently on screen.
 *
 * The counting function is the reason this is worth a module of its own.
 * "Information is lost" is easy to assert and hard to feel; `sharingPictures`
 * turns it into a number, and that number is checked in the tests against a
 * brute-force enumeration of all 65,536 pictures rather than against itself.
 */

export const GRID_SIZE = 4;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
/** Every picture this grid can hold: two values per cell. */
export const TOTAL_PICTURES = 2 ** CELL_COUNT;

/** White counts as 1, black as 0. Naming them brightness is what makes the average mean anything. */
export type Pixel = 0 | 1;

/**
 * Row-major, and deliberately so: the order is part of the encoding. Index 0 is
 * row 1 column 1; index 4 is row 2 column 1. Rearranging the cells leaves the
 * average alone and changes this list, which is the point of `quarterTurn`.
 */
export type Grid = readonly Pixel[];

export type EncodingId = 'average' | 'list';

export type Encoding = {
  id: EncodingId;
  label: string;
  sub: string;
  /** How many numbers the model is handed. */
  numbers: number;
  keeps: string;
  discards: string;
};

export const ENCODINGS: readonly Encoding[] = [
  {
    id: 'average',
    label: 'One number',
    sub: 'Average brightness',
    numbers: 1,
    keeps: 'How light or dark the picture is overall.',
    discards: 'Where the light and dark were. Every cell position is gone.',
  },
  {
    id: 'list',
    label: 'The full ordered list',
    sub: `${CELL_COUNT} numbers, read row by row`,
    numbers: CELL_COUNT,
    keeps: 'Every cell, and which cell it was. Position 7 always means row 2, column 3.',
    discards: 'Nothing about this grid. It costs 16 numbers instead of 1.',
  },
];

export function encodingById(id: EncodingId): Encoding {
  return ENCODINGS.find(encoding => encoding.id === id)!;
}

/** 1-based, because the panel says "row 2, column 3" and nobody counts rows from zero. */
export function positionOf(index: number): { row: number; column: number } {
  return { row: Math.floor(index / GRID_SIZE) + 1, column: (index % GRID_SIZE) + 1 };
}

export function indexOf(row: number, column: number): number {
  return (row - 1) * GRID_SIZE + (column - 1);
}

export function describePixel(value: Pixel): 'white' | 'black' {
  return value === 1 ? 'white' : 'black';
}

export function whiteCount(grid: Grid): number {
  let total = 0;
  for (const value of grid) total += value;
  return total;
}

/**
 * The mean of the cell values. Every result is a whole number of sixteenths, so
 * it is exactly representable and the panel can print it without hedging.
 */
export function averageBrightness(grid: Grid): number {
  return whiteCount(grid) / CELL_COUNT;
}

/** The grid read in its declared order. A copy, so nothing downstream can edit the picture. */
export function pixelList(grid: Grid): Pixel[] {
  return [...grid];
}

/** What the model is actually handed, under one encoding or the other. */
export function encode(grid: Grid, encoding: EncodingId): number[] {
  return encoding === 'average' ? [averageBrightness(grid)] : pixelList(grid);
}

/**
 * Whether two pictures arrive as the same data.
 *
 * The tolerance is not decoration. Averages here are exact sixteenths, but a
 * collision test that only works because of that would break silently the first
 * time the grid stops being a power of two.
 */
export function sameEncoding(a: Grid, b: Grid, encoding: EncodingId): boolean {
  const left = encode(a, encoding);
  const right = encode(b, encoding);
  if (left.length !== right.length) return false;
  return left.every((value, index) => Math.abs(value - right[index]) <= 1e-9);
}

/** Zero-based indices where the two pictures genuinely differ, in reading order. */
export function differingPositions(a: Grid, b: Grid): number[] {
  const found: number[] = [];
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) found.push(index);
  }
  return found;
}

export function toggle(grid: Grid, index: number): Grid {
  return grid.map((value, position) => (position === index ? ((1 - value) as Pixel) : value));
}

/**
 * A quarter turn clockwise: the same cells, in different places.
 *
 * This is the cheapest honest demonstration that the average keeps none of the
 * arrangement. A shuffle would do the same job and could not be reset to, or
 * tested against, anything.
 */
export function quarterTurn(grid: Grid): Grid {
  const turned: Pixel[] = new Array(CELL_COUNT).fill(0);
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      turned[row * GRID_SIZE + column] = grid[(GRID_SIZE - 1 - column) * GRID_SIZE + row];
    }
  }
  return turned;
}

/** Exact for the sizes here; `n` is 16 and the intermediate products stay well inside a safe integer. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const take = Math.min(k, n - k);
  let result = 1;
  for (let step = 1; step <= take; step += 1) {
    result = (result * (n - take + step)) / step;
  }
  return Math.round(result);
}

/**
 * How many of the 65,536 possible pictures encode to exactly this data.
 *
 * This is the whole node in one number. One number of average brightness is
 * shared by thousands of pictures, so nothing downstream can recover which one
 * it was; the ordered list is shared by exactly one, so nothing was thrown away.
 */
export function sharingPictures(grid: Grid, encoding: EncodingId): number {
  return encoding === 'average' ? binomial(CELL_COUNT, whiteCount(grid)) : 1;
}

/** Trims the trailing zeros off an exact sixteenth: 0.5, 0.5625, 1, 0. */
export function formatBrightness(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export type Scenario = { label: string; note: string; a: Grid; b: Grid };

/** Reads the picture out of a 4-row literal, so a scenario can be checked by eye in the source. */
function picture(rows: readonly string[]): Grid {
  const cells = rows.join('').split('').map(character => (character === '#' ? 1 : 0)) as Pixel[];
  if (cells.length !== CELL_COUNT) throw new Error(`a picture needs ${CELL_COUNT} cells`);
  return cells;
}

/**
 * Three deterministic pairs, and each is one of the three things the two
 * encodings do differently: collide on pictures that differ, agree on pictures
 * that differ, and agree on pictures that do not.
 */
export const SCENARIOS: readonly Scenario[] = [
  {
    label: 'Different pictures, same average',
    note: 'Eight white cells each, arranged completely differently. Nobody would confuse these two pictures.',
    a: picture(['####', '####', '....', '....']),
    b: picture(['#.#.', '.#.#', '#.#.', '.#.#']),
  },
  {
    label: 'All white and all black',
    note: 'The two extremes. Here even one number keeps them apart, because only one picture can produce each.',
    a: picture(['####', '####', '####', '####']),
    b: picture(['....', '....', '....', '....']),
  },
  {
    label: 'The same picture twice',
    note: 'Identical cell for cell. Neither encoding separates them, because there is nothing to separate.',
    a: picture(['....', '.##.', '.##.', '....']),
    b: picture(['....', '.##.', '.##.', '....']),
  },
];

export const INITIAL_SCENARIO = SCENARIOS[0];
