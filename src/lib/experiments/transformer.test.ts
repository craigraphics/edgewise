import { describe, expect, it } from 'vitest';

import {
  BLOCK_ONE,
  BLOCK_TWO,
  PLACES,
  SCALE,
  SENTENCES,
  WORD_VALUES,
  WORDS,
  attendAt,
  feedForward,
  listValues,
  movement,
  normalise,
  placeAt,
  runBlock,
  runBlocks,
  sentenceById,
  sentenceText,
  shares,
  startingRows,
  value,
  wordValues,
  type Calculation,
  type Row,
} from './transformer';

/**
 * The expectations here are worked out by hand, or reached by a route that
 * shares no arithmetic with the function being checked. Asserting a measure
 * against itself is the trap this project has closed seven times already — by
 * decoding `bpe_ranks` independently, by checking the least-squares conditions,
 * by brute force over all 65,536 pictures, by hand arithmetic, by answers
 * worked out on paper, by pinning to a published file, and by literal
 * `Math.exp` calls. This one closes it an eighth way: a second, plainly written
 * implementation of the whole block lives in this file and never imports the
 * one under test, plus anchors small enough to check in your head.
 */

const close = (actual: number, expected: number, tolerance = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);

const closeRow = (actual: Row, expected: Row, tolerance = 1e-9) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((amount, index) => close(amount, expected[index], tolerance));
};

const DOG_FIRST = ['the', 'dog', 'followed', 'the', 'cat'];
const CAT_FIRST = ['the', 'cat', 'followed', 'the', 'dog'];

/* ------------------------------------------------------------------ *
 * A second implementation, written out plainly. It shares no code with
 * the module: its own loops, its own `Math.exp`, its own `Math.sqrt(3)`.
 * ------------------------------------------------------------------ */

function plainNormalise(row: readonly number[]): number[] {
  let total = 0;
  for (const amount of row) total += amount;
  const mean = total / row.length;
  let squares = 0;
  for (const amount of row) squares += (amount - mean) * (amount - mean);
  const scale = Math.sqrt(squares / row.length + 0.00001);
  return row.map(amount => (amount - mean) / scale);
}

function plainBlock(rows: readonly (readonly number[])[], calculation: Calculation) {
  const rescaled = rows.map(plainNormalise);

  const afterOne: number[][] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const weights: number[] = [];
    for (let j = 0; j <= i; j += 1) {
      let overlap = 0;
      for (let c = 0; c < 3; c += 1) overlap += rescaled[i][c] * rescaled[j][c];
      weights.push(Math.exp(overlap / Math.sqrt(3)));
    }
    let sum = 0;
    for (const weight of weights) sum += weight;
    const blend = [0, 0, 0];
    for (let j = 0; j <= i; j += 1) {
      for (let c = 0; c < 3; c += 1) blend[c] += (weights[j] / sum) * rescaled[j][c];
    }
    afterOne.push([0, 1, 2].map(c => rows[i][c] + blend[c]));
  }

  const afterTwo = afterOne.map(row => {
    const ready = plainNormalise(row);
    const hidden = calculation.first.map((weights, index) => {
      let total = calculation.nudges[index];
      for (let c = 0; c < 3; c += 1) total += weights[c] * ready[c];
      return total > 0 ? total : 0;
    });
    return calculation.second.map((weights, index) => {
      let total = calculation.finalNudges[index];
      for (let h = 0; h < hidden.length; h += 1) total += weights[h] * hidden[h];
      return row[index] + total;
    });
  });

  return { afterOne, afterTwo };
}

describe('the numbers this example is built from', () => {
  it('gives every word in both sentences a row, and refuses one it does not have', () => {
    for (const word of [...DOG_FIRST, ...CAT_FIRST]) expect(wordValues(word)).toHaveLength(3);
    expect(WORDS).toHaveLength(Object.keys(WORD_VALUES).length);
    expect(() => wordValues('rabbit')).toThrow(/rabbit/);
  });

  it('has a place for every position in the sentences, and refuses one beyond them', () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(DOG_FIRST.length);
    expect(() => placeAt(PLACES.length)).toThrow(/position/);
  });

  it('starts each word off as its own numbers plus its place, added once', () => {
    const rows = startingRows(DOG_FIRST);
    // dog is word 2: [1.0, 0.0, 0.2] + [0.0, 0.4, 0.0].
    closeRow(rows[1], [1.0, 0.4, 0.2]);
    // the last "the" is word 4: [0.2, 0.2, 0.2] + [-0.4, 0.0, 0.0].
    closeRow(rows[3], [-0.2, 0.2, 0.2]);
  });

  it('divides match numbers by the square root of how many are compared', () => {
    close(SCALE, Math.sqrt(3));
  });

  it('names both orders, and they really are the same words swapped', () => {
    expect(SENTENCES.map(sentence => sentence.id).sort()).toEqual(['cat-first', 'dog-first']);
    expect([...DOG_FIRST].sort()).toEqual([...CAT_FIRST].sort());
    expect(DOG_FIRST).not.toEqual(CAT_FIRST);
    expect(sentenceText(sentenceById('dog-first'))).toBe('The dog followed the cat.');
  });
});

describe('rescaling, checked by hand', () => {
  it('leaves a row centred on zero at a comparable size', () => {
    const out = normalise([1, 2, 3]);
    close(out.reduce((total, amount) => total + amount, 0), 0, 1e-12);
    // Spread of [1,2,3] about its mean is 2/3, so the scale is sqrt(2/3).
    close(out[2], 1 / Math.sqrt(2 / 3 + 0.00001), 1e-9);
  });

  it('does not divide by zero when every number in a row is the same', () => {
    const out = normalise([0.2, 0.2, 0.2]);
    for (const amount of out) expect(Number.isFinite(amount)).toBe(true);
    closeRow(out, [0, 0, 0]);
  });
});

describe('one word gathering from the words before it', () => {
  const rows = startingRows(DOG_FIRST);
  const rescaled = rows.map(normalise);

  it('gives the first word exactly one share, worth all of it', () => {
    const gather = attendAt(rescaled, 0);
    expect(gather.contributions).toHaveLength(1);
    close(gather.contributions[0].share, 1);
    // With one share of 1, the blend IS the word's own rescaled row.
    closeRow(gather.gathered, rescaled[0]);
  });

  it('turns overlaps into shares the way the panel prints them', () => {
    const gather = attendAt(rescaled, 4);
    // Written out here rather than taken from the module: exp of each overlap
    // over the square root of three, divided by their total.
    const overlaps = rescaled.slice(0, 5).map(row =>
      row.reduce((total, amount, index) => total + amount * rescaled[4][index], 0) / Math.sqrt(3),
    );
    const weights = overlaps.map(overlap => Math.exp(overlap));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    gather.contributions.forEach((contribution, index) => {
      close(contribution.match, overlaps[index]);
      close(contribution.share, weights[index] / total);
    });
  });

  it('keeps the shares a real distribution at every position of both orders', () => {
    for (const words of [DOG_FIRST, CAT_FIRST]) {
      const ready = startingRows(words).map(normalise);
      ready.forEach((_, index) => {
        const gather = attendAt(ready, index);
        expect(gather.contributions).toHaveLength(index + 1);
        expect(gather.ignoredAfter).toBe(ready.length - index - 1);
        for (const contribution of gather.contributions) expect(contribution.share).toBeGreaterThan(0);
        close(gather.contributions.reduce((sum, contribution) => sum + contribution.share, 0), 1, 1e-12);
      });
    }
  });

  it('never lets one word take the whole blend', () => {
    // A single winner would read as the model picking one word, which is the
    // misconception the `attention` node exists to remove and this one inherits.
    const gather = attendAt(rescaled, 4);
    const leader = Math.max(...gather.contributions.map(contribution => contribution.share));
    expect(leader).toBeLessThan(0.6);
  });

  it('is unmoved when every later word is replaced', () => {
    const at = 2; // "followed", with two words after it.
    const original = runBlock(startingRows(DOG_FIRST), BLOCK_ONE);
    const rewritten = runBlock(startingRows([...DOG_FIRST.slice(0, at + 1), 'cat', 'dog']), BLOCK_ONE);
    expect(rewritten.gathers[at]).toEqual(original.gathers[at]);
    expect(rewritten.afterStageOne[at]).toEqual(original.afterStageOne[at]);
    expect(rewritten.afterStageTwo[at]).toEqual(original.afterStageTwo[at]);
  });

  it('does move when an earlier word is replaced', () => {
    const at = 2;
    const original = runBlock(startingRows(DOG_FIRST), BLOCK_ONE);
    const rewritten = runBlock(startingRows(['the', 'cat', 'followed', 'the', 'cat']), BLOCK_ONE);
    expect(rewritten.afterStageTwo[at]).not.toEqual(original.afterStageTwo[at]);
  });
});

describe('the order has to be supplied', () => {
  /**
   * The claim the `transformer` node's own simplificationCost makes, proved
   * rather than asserted: gathering adds contributions up, and a sum does not
   * care what order its terms arrive in.
   */
  const shuffled = ['the', 'the', 'followed', 'dog', 'cat'];
  const withoutPlaces = (words: readonly string[]) => words.map(word => wordValues(word));

  it('cannot tell the order apart at all with the place numbers removed', () => {
    const straight = runBlock(withoutPlaces(DOG_FIRST), BLOCK_ONE);
    const jumbled = runBlock(withoutPlaces(shuffled), BLOCK_ONE);
    expect(jumbled.afterStageTwo[4]).toEqual(straight.afterStageTwo[4]);
  });

  it('tells them apart once the place numbers are added', () => {
    const straight = runBlock(startingRows(DOG_FIRST), BLOCK_ONE);
    const jumbled = runBlock(startingRows(shuffled), BLOCK_ONE);
    expect(jumbled.afterStageTwo[4]).not.toEqual(straight.afterStageTwo[4]);
    expect(movement(straight.afterStageTwo[4], jumbled.afterStageTwo[4])).toBe('moved');
  });
});

describe('the calculation each position gets', () => {
  it('is the same calculation run separately at every position', () => {
    for (const words of [DOG_FIRST, CAT_FIRST]) {
      const block = runBlock(startingRows(words), BLOCK_ONE);
      block.works.forEach((worked, index) => {
        // Taken out of the block and run on that one row alone: same answer.
        expect(worked).toEqual(feedForward(block.rescaledForWork[index], BLOCK_ONE));
      });
    }
  });

  it('gives one row the same answer however different its neighbours are', () => {
    // Position 1 gathers only from itself, so its row into the calculation is
    // its own. Everything after it can be anything at all.
    const row: Row = [0.3, -0.2, 0.9];
    const quiet = runBlock([row, [0.1, 0.1, 0.1]], BLOCK_ONE);
    const noisy = runBlock([row, [9, -9, 9], [-4, 4, -4], [0, 0, 8]], BLOCK_ONE);
    expect(noisy.rescaledForWork[0]).toEqual(quiet.rescaledForWork[0]);
    expect(noisy.works[0]).toEqual(quiet.works[0]);
    expect(noisy.works[0]).toEqual(feedForward(quiet.rescaledForWork[0], BLOCK_ONE));
  });

  it('bends, so a stack of these cannot collapse into one', () => {
    // The `layers-depth` misconception: without the bend, stacked layers are
    // mathematically one layer. A linear calculation would satisfy
    // f(a + b) - f(0) = (f(a) - f(0)) + (f(b) - f(0)). This one does not.
    const a: Row = [1, -1, 0.5];
    const b: Row = [-0.5, 2, -1];
    const zero = feedForward([0, 0, 0], BLOCK_ONE).worked;
    const both = feedForward([a[0] + b[0], a[1] + b[1], a[2] + b[2]], BLOCK_ONE).worked;
    const apart = feedForward(a, BLOCK_ONE).worked.map(
      (amount, index) => amount + feedForward(b, BLOCK_ONE).worked[index] - zero[index],
    );
    expect(both.some((amount, index) => Math.abs(amount - apart[index]) > 1e-6)).toBe(true);
  });

  it('never lets a hidden value go below zero', () => {
    for (const words of [DOG_FIRST, CAT_FIRST]) {
      for (const block of runBlocks(words)) {
        for (const worked of block.works) for (const hidden of worked.hidden) expect(hidden).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives the two blocks different numbers to work with', () => {
    expect(BLOCK_TWO.first).not.toEqual(BLOCK_ONE.first);
    expect(BLOCK_TWO.second).not.toEqual(BLOCK_ONE.second);
  });
});

describe('one whole block, against a second implementation', () => {
  it('matches a plainly written version at every position of both orders', () => {
    for (const words of [DOG_FIRST, CAT_FIRST]) {
      const rows = startingRows(words);
      const mine = runBlock(rows, BLOCK_ONE);
      const plain = plainBlock(rows, BLOCK_ONE);
      rows.forEach((_, index) => {
        closeRow(mine.afterStageOne[index], plain.afterOne[index]);
        closeRow(mine.afterStageTwo[index], plain.afterTwo[index]);
      });
    }
  });

  it('matches it for the second block too, on the first block’s output', () => {
    const [first, second] = runBlocks(DOG_FIRST);
    const plain = plainBlock(first.afterStageTwo, BLOCK_TWO);
    second.afterStageTwo.forEach((row, index) => closeRow(row, plain.afterTwo[index]));
  });

  it('adds what it gathered back to what the word already had', () => {
    const [first] = runBlocks(DOG_FIRST);
    first.afterStageOne.forEach((row, index) => {
      closeRow(row, first.input[index].map((amount, column) => amount + first.gathers[index].gathered[column]));
    });
  });
});

describe('the second block starts from the first block’s output', () => {
  const [first, second] = runBlocks(DOG_FIRST);

  it('is handed exactly what the first block produced', () => {
    expect(second.input).toEqual(first.afterStageTwo);
  });

  it('does not go back to the sentence', () => {
    expect(second.input).not.toEqual(startingRows(DOG_FIRST));
  });

  it('does not add the place numbers a second time', () => {
    // Running the same block on the same input, by hand, reaches the same
    // place — so nothing was slipped in between the two.
    expect(runBlock(first.afterStageTwo, BLOCK_TWO)).toEqual(second);
  });

  it('really is a second pass and not a repeat of the first', () => {
    expect(second.afterStageTwo).not.toEqual(first.afterStageTwo);
  });
});

describe('what the panel says happened', () => {
  const [first, second] = runBlocks(DOG_FIRST);
  const last = DOG_FIRST.length - 1;

  it('has both stages of both blocks actually move the last word', () => {
    expect(movement(first.input[last], first.afterStageOne[last])).toBe('moved');
    expect(movement(first.afterStageOne[last], first.afterStageTwo[last])).toBe('moved');
    expect(movement(second.input[last], second.afterStageOne[last])).toBe('moved');
    expect(movement(second.afterStageOne[last], second.afterStageTwo[last])).toBe('moved');
  });

  it('has the two orders end up somewhere different, so the swap is never a no-op', () => {
    const other = runBlocks(CAT_FIRST);
    expect(movement(first.afterStageTwo[last], other[0].afterStageTwo[last])).toBe('moved');
  });

  it('does not call two identical rows a change', () => {
    expect(movement([1, 2, 3], [1, 2, 3])).toBe('same');
    expect(movement([1, 2, 3], [1, 2, 3.001])).toBe('tiny');
    expect(movement([1, 2, 3], [1, 2, 3.02])).toBe('moved');
  });

  it('prints two decimals, and never a signed zero', () => {
    expect(value(0.6)).toBe('0.60');
    expect(value(-0.0004)).toBe('0.00');
    expect(listValues([0, 0.6, 0.2])).toBe('0.00 · 0.60 · 0.20');
  });
});

describe('nothing anywhere comes out as nonsense', () => {
  it('stays finite through both blocks, every position, both orders', () => {
    for (const words of [DOG_FIRST, CAT_FIRST]) {
      for (const block of runBlocks(words)) {
        const everything = [
          ...block.input.flat(),
          ...block.rescaledForGather.flat(),
          ...block.afterStageOne.flat(),
          ...block.rescaledForWork.flat(),
          ...block.afterStageTwo.flat(),
          ...block.gathers.flatMap(gather => [...gather.gathered, ...gather.contributions.map(one => one.share)]),
          ...block.works.flatMap(worked => [...worked.hidden, ...worked.worked]),
        ];
        for (const amount of everything) expect(Number.isFinite(amount)).toBe(true);
      }
    }
  });

  it('returns nothing for no matches rather than dividing by zero', () => {
    expect(shares([])).toEqual([]);
  });

  it('is pure: two runs agree and the input is left alone', () => {
    const rows = startingRows(DOG_FIRST);
    const copy = rows.map(row => [...row]);
    expect(runBlock(rows, BLOCK_ONE)).toEqual(runBlock(rows, BLOCK_ONE));
    expect(rows).toEqual(copy);
  });
});
