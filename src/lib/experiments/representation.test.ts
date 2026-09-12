import { describe, expect, it } from 'vitest';

import {
  averageBrightness,
  binomial,
  CELL_COUNT,
  describePixel,
  differingPositions,
  encode,
  encodingById,
  ENCODINGS,
  formatBrightness,
  GRID_SIZE,
  indexOf,
  INITIAL_SCENARIO,
  pixelList,
  positionOf,
  quarterTurn,
  sameEncoding,
  SCENARIOS,
  sharingPictures,
  toggle,
  TOTAL_PICTURES,
  type Grid,
  type Pixel,
} from './representation';

/** Every 4x4 picture there is. 65,536 of them, which is small enough to simply walk. */
function everyPicture(): Grid[] {
  const all: Grid[] = [];
  for (let bits = 0; bits < TOTAL_PICTURES; bits += 1) {
    const cells: Pixel[] = new Array(CELL_COUNT);
    for (let cell = 0; cell < CELL_COUNT; cell += 1) cells[cell] = ((bits >> cell) & 1) as Pixel;
    all.push(cells);
  }
  return all;
}

const ALL = everyPicture();
const WHITE: Grid = new Array(CELL_COUNT).fill(1);
const BLACK: Grid = new Array(CELL_COUNT).fill(0);

describe('reading order', () => {
  it('maps every index to a row and column and back again', () => {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      const { row, column } = positionOf(index);
      expect(row).toBeGreaterThanOrEqual(1);
      expect(row).toBeLessThanOrEqual(GRID_SIZE);
      expect(column).toBeGreaterThanOrEqual(1);
      expect(column).toBeLessThanOrEqual(GRID_SIZE);
      expect(indexOf(row, column)).toBe(index);
    }
  });

  /** The order is part of the encoding, so it is asserted rather than assumed. */
  it('reads row by row, not column by column', () => {
    expect(positionOf(0)).toEqual({ row: 1, column: 1 });
    expect(positionOf(1)).toEqual({ row: 1, column: 2 });
    expect(positionOf(4)).toEqual({ row: 2, column: 1 });
    expect(positionOf(6)).toEqual({ row: 2, column: 3 });
    expect(positionOf(CELL_COUNT - 1)).toEqual({ row: GRID_SIZE, column: GRID_SIZE });
  });
});

describe('average brightness', () => {
  it('is 1 for an all-white picture and 0 for an all-black one', () => {
    expect(averageBrightness(WHITE)).toBe(1);
    expect(averageBrightness(BLACK)).toBe(0);
  });

  /**
   * Checked against a count taken a different way, over every picture, so the
   * expectation and the implementation cannot be wrong together.
   */
  it('is the share of white cells, for all 65,536 pictures', () => {
    for (const grid of ALL) {
      const whites = grid.reduce<number>((total, value) => total + (value === 1 ? 1 : 0), 0);
      expect(averageBrightness(grid)).toBeCloseTo(whites / CELL_COUNT, 12);
    }
  });

  it('never produces NaN or Infinity', () => {
    for (const grid of ALL) expect(Number.isFinite(averageBrightness(grid))).toBe(true);
  });

  it('prints exactly, with no trailing zeros', () => {
    expect(formatBrightness(averageBrightness(WHITE))).toBe('1');
    expect(formatBrightness(averageBrightness(BLACK))).toBe('0');
    expect(formatBrightness(8 / CELL_COUNT)).toBe('0.5');
    expect(formatBrightness(9 / CELL_COUNT)).toBe('0.5625');
    expect(formatBrightness(1 / CELL_COUNT)).toBe('0.0625');
  });
});

describe('the two encodings', () => {
  it('hands over one number, or one per cell', () => {
    expect(encode(INITIAL_SCENARIO.a, 'average')).toHaveLength(1);
    expect(encode(INITIAL_SCENARIO.a, 'list')).toHaveLength(CELL_COUNT);
    for (const encoding of ENCODINGS) {
      expect(encode(INITIAL_SCENARIO.a, encoding.id)).toHaveLength(encoding.numbers);
      expect(encodingById(encoding.id)).toBe(encoding);
    }
  });

  it('returns a copy, so encoding a picture cannot edit it', () => {
    const grid = INITIAL_SCENARIO.a;
    const list = pixelList(grid);
    list[0] = ((1 - list[0]) as Pixel);
    expect(pixelList(grid)).not.toEqual(list);
  });

  /** The collision the node is about: same count of white cells, same single number. */
  it('collides under one number exactly when the white counts match', () => {
    const sample = ALL.filter((_, index) => index % 257 === 0);
    for (const a of sample) {
      for (const b of sample) {
        const equalCounts = averageBrightness(a) === averageBrightness(b);
        expect(sameEncoding(a, b, 'average')).toBe(equalCounts);
      }
    }
  });

  it('collides under the ordered list only when the pictures are identical', () => {
    const sample = ALL.filter((_, index) => index % 257 === 0);
    for (const a of sample) {
      for (const b of sample) {
        expect(sameEncoding(a, b, 'list')).toBe(a.every((value, index) => value === b[index]));
      }
    }
  });

  it('separates two pictures the single number cannot', () => {
    const { a, b } = INITIAL_SCENARIO;
    expect(sameEncoding(a, b, 'average')).toBe(true);
    expect(sameEncoding(a, b, 'list')).toBe(false);
  });
});

describe('what an encoding throws away', () => {
  /**
   * The count of pictures sharing an average is checked against an enumeration
   * of all 65,536 of them, not against the formula that produced it.
   */
  it('counts the pictures sharing an average, checked by brute force', () => {
    const buckets = new Map<number, number>();
    for (const grid of ALL) {
      const key = averageBrightness(grid);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    for (const grid of ALL.filter((_, index) => index % 97 === 0)) {
      expect(sharingPictures(grid, 'average')).toBe(buckets.get(averageBrightness(grid)));
    }
    expect([...buckets.values()].reduce((total, count) => total + count, 0)).toBe(TOTAL_PICTURES);
  });

  it('leaves exactly one picture behind an ordered list', () => {
    for (const grid of ALL.filter((_, index) => index % 997 === 0)) {
      expect(sharingPictures(grid, 'list')).toBe(1);
    }
  });

  /** The extremes are the honest exception: one number is enough when only one picture produces it. */
  it('is lossless at the extremes and worst in the middle', () => {
    expect(sharingPictures(WHITE, 'average')).toBe(1);
    expect(sharingPictures(BLACK, 'average')).toBe(1);
    expect(sharingPictures(INITIAL_SCENARIO.a, 'average')).toBe(8008);
    expect(binomial(CELL_COUNT, CELL_COUNT / 2)).toBe(12870);
  });

  it('sums to every possible picture across the seventeen averages', () => {
    let total = 0;
    for (let whites = 0; whites <= CELL_COUNT; whites += 1) total += binomial(CELL_COUNT, whites);
    expect(total).toBe(TOTAL_PICTURES);
    expect(binomial(CELL_COUNT, -1)).toBe(0);
    expect(binomial(CELL_COUNT, CELL_COUNT + 1)).toBe(0);
    expect(Number.isInteger(binomial(CELL_COUNT, 8))).toBe(true);
  });
});

describe('rearranging the cells', () => {
  /** The claim the panel makes, over every picture rather than over a chosen one. */
  it('never changes the average, for all 65,536 pictures', () => {
    for (const grid of ALL) expect(averageBrightness(quarterTurn(grid))).toBe(averageBrightness(grid));
  });

  it('comes back to the start after four turns', () => {
    for (const grid of ALL.filter((_, index) => index % 7 === 0)) {
      expect(quarterTurn(quarterTurn(quarterTurn(quarterTurn(grid))))).toEqual([...grid]);
    }
  });

  it('turns clockwise, so the top row becomes the right-hand column', () => {
    expect(quarterTurn(INITIAL_SCENARIO.a)).toEqual([1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1]);
  });

  /**
   * It changes the ordered list, except when the picture is unchanged by the
   * turn — and the panel has to report that case rather than claim a change.
   */
  it('changes the ordered list exactly when the turned picture differs', () => {
    for (const grid of ALL.filter((_, index) => index % 13 === 0)) {
      const turned = quarterTurn(grid);
      const moved = differingPositions(grid, turned).length > 0;
      expect(sameEncoding(grid, turned, 'list')).toBe(!moved);
      expect(sameEncoding(grid, turned, 'average')).toBe(true);
    }
  });

  it('leaves a picture with no arrangement to change alone', () => {
    expect(differingPositions(WHITE, quarterTurn(WHITE))).toEqual([]);
    expect(differingPositions(BLACK, quarterTurn(BLACK))).toEqual([]);
  });
});

describe('differences between two pictures', () => {
  it('is empty for identical pictures and symmetric otherwise', () => {
    const { a, b } = INITIAL_SCENARIO;
    expect(differingPositions(a, a)).toEqual([]);
    expect(differingPositions(a, b)).toEqual(differingPositions(b, a));
  });

  it('counts every cell that differs, in reading order', () => {
    expect(differingPositions(WHITE, BLACK)).toHaveLength(CELL_COUNT);
    expect(differingPositions(INITIAL_SCENARIO.a, INITIAL_SCENARIO.b)).toEqual([1, 2, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('moves by exactly one cell when one cell is flipped', () => {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      const flipped = toggle(INITIAL_SCENARIO.a, index);
      expect(differingPositions(INITIAL_SCENARIO.a, flipped)).toEqual([index]);
      expect(flipped[index]).not.toBe(INITIAL_SCENARIO.a[index]);
      expect(Math.abs(averageBrightness(flipped) - averageBrightness(INITIAL_SCENARIO.a))).toBeCloseTo(1 / CELL_COUNT, 12);
    }
  });

  it('flips back to where it started', () => {
    expect(toggle(toggle(INITIAL_SCENARIO.b, 5), 5)).toEqual([...INITIAL_SCENARIO.b]);
  });
});

/**
 * Each scenario claims to be one of the three cases. Editing the literals later
 * must not quietly turn "same average" into something that no longer is.
 */
describe('the scenarios are the cases they claim', () => {
  it('gives every picture the right number of cells and only 0 or 1', () => {
    for (const scenario of SCENARIOS) {
      for (const grid of [scenario.a, scenario.b]) {
        expect(grid).toHaveLength(CELL_COUNT);
        for (const value of grid) expect([0, 1]).toContain(value);
      }
    }
  });

  it('opens on two visibly different pictures with one identical average', () => {
    const [same] = SCENARIOS;
    expect(same.label).toBe('An H and a T');
    expect(averageBrightness(same.a)).toBe(averageBrightness(same.b));
    expect(sameEncoding(same.a, same.b, 'average')).toBe(true);
    expect(sameEncoding(same.a, same.b, 'list')).toBe(false);
    expect(differingPositions(same.a, same.b)).toHaveLength(12);
  });

  it('offers all white against all black, which even one number separates', () => {
    const extremes = SCENARIOS[1];
    expect(averageBrightness(extremes.a)).toBe(1);
    expect(averageBrightness(extremes.b)).toBe(0);
    expect(sameEncoding(extremes.a, extremes.b, 'average')).toBe(false);
    expect(sharingPictures(extremes.a, 'average')).toBe(1);
  });

  it('offers one pair neither encoding separates', () => {
    const twice = SCENARIOS[2];
    expect(differingPositions(twice.a, twice.b)).toEqual([]);
    expect(sameEncoding(twice.a, twice.b, 'average')).toBe(true);
    expect(sameEncoding(twice.a, twice.b, 'list')).toBe(true);
  });
});

describe('naming a cell', () => {
  it('calls 1 white and 0 black', () => {
    expect(describePixel(1)).toBe('white');
    expect(describePixel(0)).toBe('black');
  });
});
