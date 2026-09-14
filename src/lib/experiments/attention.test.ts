import { describe, expect, it } from 'vitest';

import {
  COLUMNS,
  descriptionOf,
  INITIAL_SENTENCE,
  leadingColumn,
  percent,
  roundingShows,
  SCALE,
  SENTENCES,
  sentenceText,
  shares,
  updateAt,
  updateLast,
  VOCABULARY,
  WORDS,
} from './attention';

/**
 * The expectations here are worked out by hand, or reached by a route that
 * shares no arithmetic with the function being checked. Asserting a measure
 * against itself is the trap this project has closed six times already — by
 * decoding `bpe_ranks` independently, by checking the least-squares conditions,
 * by brute force over all 65,536 pictures, by hand arithmetic, by answers
 * worked out on paper, and by pinning to a published file. This one closes it
 * with literal `Math.exp` calls written out in the test, plus arithmetic small
 * enough to check in your head.
 */

const river = SENTENCES.find(sentence => sentence.id === 'river')!;
const money = SENTENCES.find(sentence => sentence.id === 'money')!;

const close = (actual: number, expected: number, tolerance = 1e-9) => expect(Math.abs(actual - expected)).toBeLessThan(tolerance);

describe('the descriptions', () => {
  it('gives every word in every sentence one', () => {
    for (const sentence of SENTENCES) {
      for (const word of sentence.words) {
        expect(VOCABULARY[word], `${word} has no description`).toBeDefined();
        expect(VOCABULARY[word]).toHaveLength(COLUMNS.length);
      }
    }
  });

  it('lists every word it has, exactly once', () => {
    expect([...WORDS].sort()).toEqual(Object.keys(VOCABULARY).sort());
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('refuses a word it does not know rather than treating it as zero', () => {
    expect(() => descriptionOf('aubergine')).toThrow();
  });

  /**
   * The panel's opening claim. `bank` on its own has to be exactly even, or the
   * two sentences would be tipping a word that was already leaning.
   */
  it('leaves bank even between the two columns', () => {
    expect(descriptionOf('bank')).toEqual([1, 1]);
    expect(leadingColumn(descriptionOf('bank'))).toBeNull();
  });

  /** The settings do not move when the sentence does. */
  it('describes a shared word identically in both sentences', () => {
    for (const word of river.words.filter(word => money.words.includes(word))) {
      expect(descriptionOf(word)).toBe(descriptionOf(word));
      expect(updateAt(river.words, river.words.indexOf(word)).before).toEqual(descriptionOf(word));
    }
  });
});

describe('turning match numbers into proportions', () => {
  it('splits equal matches equally', () => {
    expect(shares([0, 0])).toEqual([0.5, 0.5]);
    for (const share of shares([2, 2, 2, 2])) close(share, 0.25);
  });

  it('is unchanged by adding a constant to every match', () => {
    const plain = shares([0, 1, 3, 2]);
    const shifted = shares([100, 101, 103, 102]);
    plain.forEach((share, index) => close(share, shifted[index], 1e-12));
  });

  it('survives a match large enough to overflow exp', () => {
    const result = shares([1000, 0]);
    expect(result.every(Number.isFinite)).toBe(true);
    close(result[0] + result[1], 1);
    expect(result[0]).toBeGreaterThan(0.999);
  });

  it('returns nothing for nothing', () => {
    expect(shares([])).toEqual([]);
  });
});

describe('one complete worked example', () => {
  /**
   * "We walked beside the river to the bank."
   *
   * The query is bank's own description, [1, 1], so each word's match before
   * scaling is just its two numbers added up: we 0, walked 1, beside 0, the 0,
   * river 3, to 0, the 0, bank 2. Every one of those is checkable by reading
   * the vocabulary table.
   */
  const expectedRaw = [0, 1, 0, 0, 3, 0, 0, 2];
  const update = updateLast(river);

  it('scores each word by hand', () => {
    expect(update.contributions.map(contribution => contribution.word)).toEqual(river.words);
    update.contributions.forEach((contribution, index) => close(contribution.match, expectedRaw[index] / Math.sqrt(2)));
  });

  it('turns those into the proportions the panel prints', () => {
    // Written out rather than taken from `shares`: exp of each scaled match,
    // over their total.
    const weights = expectedRaw.map(raw => Math.exp(raw / Math.sqrt(2)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    update.contributions.forEach((contribution, index) => close(contribution.share, weights[index] / total));

    // And the figures that appear in the copy and the docs.
    close(update.contributions[4].share, 0.428, 5e-4);
    close(update.contributions[7].share, 0.211, 5e-4);
    close(update.contributions[1].share, 0.104, 5e-4);
    close(update.contributions[0].share, 0.051, 5e-4);
  });

  it('blends the descriptions in those proportions', () => {
    const weights = expectedRaw.map(raw => Math.exp(raw / Math.sqrt(2)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const outdoors = river.words.reduce((sum, word, index) => sum + (weights[index] / total) * descriptionOf(word)[0], 0);
    const moneyColumn = river.words.reduce((sum, word, index) => sum + (weights[index] / total) * descriptionOf(word)[1], 0);

    close(update.after[0], outdoors);
    close(update.after[1], moneyColumn);
    close(update.after[0], 1.6, 5e-3);
    close(update.after[1], 0.21, 5e-3);
  });

  it('adds up: each word’s own contribution totals the blend', () => {
    COLUMNS.forEach((_, column) => {
      close(update.contributions.reduce((sum, contribution) => sum + contribution.adds[column], 0), update.after[column]);
    });
  });
});

describe('the shares are a distribution, everywhere', () => {
  it('never goes negative and always totals one', () => {
    for (const sentence of SENTENCES) {
      for (let index = 0; index < sentence.words.length; index += 1) {
        const update = updateAt(sentence.words, index);
        for (const contribution of update.contributions) expect(contribution.share).toBeGreaterThanOrEqual(0);
        close(update.contributions.reduce((sum, contribution) => sum + contribution.share, 0), 1, 1e-12);
      }
    }
  });

  /**
   * Nothing is left out. That is the opposite of the node's first recorded
   * misconception — nothing selects the important words, because every word the
   * target may use gets a share, including the ones carrying nothing.
   */
  it('gives every allowed word a share above zero', () => {
    for (const sentence of SENTENCES) {
      for (const contribution of updateLast(sentence).contributions) expect(contribution.share).toBeGreaterThan(0);
    }
  });

  /** The five all-zero words in the river sentence must be indistinguishable. */
  it('gives words with identical matches identical shares', () => {
    const update = updateLast(river);
    const flat = update.contributions.filter(contribution => ['we', 'beside', 'the', 'to'].includes(contribution.word));
    expect(flat).toHaveLength(5);
    for (const contribution of flat) {
      close(contribution.match, 0, 1e-12);
      close(contribution.share, flat[0].share, 1e-12);
    }
  });
});

describe('it cannot look ahead', () => {
  it('scores no word after the one being updated', () => {
    for (const sentence of SENTENCES) {
      for (let index = 0; index < sentence.words.length; index += 1) {
        const update = updateAt(sentence.words, index);
        expect(update.contributions).toHaveLength(index + 1);
        for (const contribution of update.contributions) expect(contribution.position).toBeLessThanOrEqual(index + 1);
        expect([...update.withheld]).toEqual(sentence.words.slice(index + 1));
      }
    }
  });

  it('is unmoved when every later word is replaced', () => {
    const at = 4; // `river`, with three words after it.
    const original = updateAt(river.words, at);
    const rewritten = updateAt([...river.words.slice(0, at + 1), 'cash', 'cash', 'cash'], at);
    // Everything the update actually used. `withheld` is the list of words it
    // was not allowed to touch, so that one is expected to differ.
    expect(rewritten.contributions).toEqual(original.contributions);
    expect(rewritten.before).toEqual(original.before);
    expect(rewritten.after).toEqual(original.after);
    expect(rewritten.leading).toEqual(original.leading);
  });

  it('does move when an allowed earlier word is replaced', () => {
    const swapped = [...river.words];
    swapped[4] = 'cash';
    const update = updateAt(swapped, swapped.length - 1);
    expect(leadingColumn(update.after)).toBe('money');
    expect(update.leading.word).toBe('cash');
  });
});

describe('the two sentences, and what the panel says about them', () => {
  it('tips the same word in opposite directions', () => {
    const inRiver = updateLast(river);
    const inMoney = updateLast(money);

    expect(inRiver.target).toBe('bank');
    expect(inMoney.target).toBe('bank');
    expect(inRiver.before).toEqual(inMoney.before);

    expect(leadingColumn(inRiver.after)).toBe('outdoors');
    expect(leadingColumn(inMoney.after)).toBe('money');

    close(inMoney.after[0], 0.24, 5e-3);
    close(inMoney.after[1], 1.78, 5e-3);
  });

  /** The one name the panel prints is derived, so it cannot disagree. */
  it('names the largest contributor from the arithmetic', () => {
    expect(updateLast(river).leading.word).toBe('river');
    expect(updateLast(money).leading.word).toBe('cash');
    for (const sentence of SENTENCES) {
      const update = updateLast(sentence);
      expect(Math.max(...update.contributions.map(contribution => contribution.share))).toBe(update.leading.share);
    }
  });

  /**
   * Several shares, not a single winner. A leader above 60% would read as the
   * model picking one word, which is the misconception this node exists to
   * remove.
   */
  it('leaves the leader short of taking the whole blend', () => {
    for (const sentence of SENTENCES) {
      const leader = updateLast(sentence).leading.share;
      expect(leader).toBeGreaterThan(0.3);
      expect(leader).toBeLessThan(0.6);
    }
  });

  it('is pure: the same sentence twice gives the same answer', () => {
    expect(updateLast(river)).toEqual(updateLast(river));
  });

  it('writes the sentences out as the panel shows them', () => {
    expect(sentenceText(river)).toBe('We walked beside the river to the bank.');
    expect(sentenceText(money)).toBe('We took cash to the bank.');
    expect(INITIAL_SENTENCE.id).toBe('river');
    expect(river.words[river.words.length - 1]).toBe('bank');
    expect(money.words[money.words.length - 1]).toBe('bank');
  });

  it('never prints a real share as zero', () => {
    expect(percent(0.428)).toBe('43%');
    expect(percent(0.0019)).toBe('under 1%');
    expect(percent(0.004)).toBe('under 1%');
    expect(percent(0)).toBe('0%');
    for (const sentence of SENTENCES) {
      for (let index = 0; index < sentence.words.length; index += 1) {
        for (const contribution of updateAt(sentence.words, index).contributions) {
          expect(percent(contribution.share)).not.toBe('0%');
        }
      }
    }
  });

  /**
   * The note is derived, so it appears exactly when the column will not add up
   * on screen. The river sentence's outdoors column is the case that made it
   * necessary: 1.28 + 0.21 + 0.10 prints as 1.59 under a total of 1.60.
   */
  it('owns up to rounding only where rounding shows', () => {
    expect(roundingShows(updateLast(river))).toBe(true);
    expect(roundingShows(updateAt(['bank'], 0))).toBe(false);
  });

  it('uses the scale real attention uses', () => {
    close(SCALE, Math.sqrt(COLUMNS.length));
  });
});
