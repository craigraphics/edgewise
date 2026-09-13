import { describe, expect, it } from 'vitest';

import {
  CAUTIONS,
  cautionById,
  compareGroups,
  describeOutcome,
  distinctWords,
  INITIAL_CAUTION,
  INITIAL_SET,
  leaningWords,
  learnFilter,
  MESSAGE_SETS,
  mistakes,
  runOn,
  scoreMessage,
  wordScores,
  wordsOf,
  type Filter,
  type Message,
  type MessageSet,
} from './junk-filter';

const message = (id: string, text: string, truth: 'junk' | 'wanted'): Message => ({ id, text, truth });

/** The filter or the test fails loudly rather than silently scoring nothing. */
function learned(examples: readonly Message[]): Filter {
  const result = learnFilter(examples);
  if (result.status !== 'learned') throw new Error(`expected a filter, got ${result.reason}`);
  return result.filter;
}

const careful = cautionById('careful');
const quick = cautionById('quick');

describe('reading a message into words', () => {
  it('lower-cases, drops punctuation, and keeps apostrophes inside a word', () => {
    expect(wordsOf("URGENT! Claim your prize, don't wait.")).toEqual(['urgent', 'claim', 'your', 'prize', "don't", 'wait']);
  });

  it('keeps each word once, in the order it first appears', () => {
    expect(distinctWords('free free prize free')).toEqual(['free', 'prize']);
  });

  it('finds no words in an empty or punctuation-only message', () => {
    expect(wordsOf('')).toEqual([]);
    expect(wordsOf('!!! ...')).toEqual([]);
  });
});

/**
 * The expectations below are worked out by hand rather than read off the
 * implementation. This project has closed the "assert the thing against itself"
 * trap by decoding `bpe_ranks` independently, by the least-squares conditions,
 * by brute force over 65,536 pictures, by arithmetic anybody can check, by
 * answers worked out on paper, and by a second formula for the same quantity.
 * This closes it with counts small enough to do in your head.
 *
 * One junk example and one wanted example, so both denominators are 1 + 2 = 3.
 * A word in the junk example only: log((2/3) / (1/3)) = log 2.
 */
describe('what the filter learns from the examples', () => {
  const tiny = [message('j', 'free prize', 'junk'), message('w', 'lunch tomorrow', 'wanted')];

  it('scores a junk-only word at log 2 and a wanted-only word at minus log 2', () => {
    const filter = learned(tiny);
    expect(filter.scores.get('free')).toBeCloseTo(Math.log(2), 12);
    expect(filter.scores.get('prize')).toBeCloseTo(Math.log(2), 12);
    expect(filter.scores.get('lunch')).toBeCloseTo(-Math.log(2), 12);
    expect(filter.scores.get('tomorrow')).toBeCloseTo(-Math.log(2), 12);
  });

  it('scores a word that appears on both sides at nothing', () => {
    const filter = learned([message('j', 'free prize', 'junk'), message('w', 'free lunch', 'wanted')]);
    expect(filter.scores.get('free')).toBeCloseTo(0, 12);
  });

  /** Two junk examples out of three: log((3/5) / (1/5)) = log 3. */
  it('scores a word that turns up in more junk examples higher', () => {
    const filter = learned([
      message('j1', 'free prize', 'junk'),
      message('j2', 'free cash', 'junk'),
      message('j3', 'urgent offer', 'junk'),
      message('w1', 'lunch tomorrow', 'wanted'),
      message('w2', 'meeting notes', 'wanted'),
      message('w3', 'holiday photos', 'wanted'),
    ]);
    expect(filter.scores.get('free')).toBeCloseTo(Math.log(3), 12);
    expect(filter.scores.get('prize')).toBeCloseTo(Math.log(2), 12);
    expect(filter.scores.get('lunch')).toBeCloseTo(-Math.log(2), 12);
  });

  it('counts an example once however often it repeats a word', () => {
    const repeated = learned([message('j', 'free free free prize', 'junk'), message('w', 'lunch tomorrow', 'wanted')]);
    expect(repeated.scores.get('free')).toBeCloseTo(Math.log(2), 12);
  });

  it('records how many examples of each kind it had', () => {
    const filter = learned(INITIAL_SET.learn);
    expect(filter.junkExamples).toBe(3);
    expect(filter.wantedExamples).toBe(3);
  });
});

describe('refusing to learn, rather than learning badly', () => {
  it('says there are no examples at all', () => {
    expect(learnFilter([])).toEqual({ status: 'not-enough', reason: 'no-examples' });
  });

  it('says when nothing is marked junk', () => {
    expect(learnFilter([message('w', 'lunch tomorrow', 'wanted')])).toEqual({ status: 'not-enough', reason: 'no-junk' });
  });

  it('says when nothing is marked wanted', () => {
    expect(learnFilter([message('j', 'free prize', 'junk')])).toEqual({ status: 'not-enough', reason: 'no-wanted' });
  });

  /**
   * With examples of only one kind every word would lean the one way there is,
   * and the filter would call everything junk while looking like it had learned
   * something. There is no state in which the panel holds such a filter.
   */
  it('never returns a filter built from one kind of example', () => {
    for (const only of [['junk'], ['wanted']] as const) {
      const result = learnFilter([message('a', 'free prize', only[0]), message('b', 'claim now', only[0])]);
      expect(result.status).toBe('not-enough');
    }
  });
});

describe('scoring a message', () => {
  const tiny = [message('j', 'free prize', 'junk'), message('w', 'lunch tomorrow', 'wanted')];

  it('is exactly the total of the words it knows', () => {
    const filter = learned(tiny);
    expect(scoreMessage(filter, 'free prize')).toBeCloseTo(2 * Math.log(2), 12);
    expect(scoreMessage(filter, 'free lunch')).toBeCloseTo(0, 12);
  });

  it('counts a word the examples never contained as nothing', () => {
    const filter = learned(tiny);
    expect(wordScores(filter, 'free aardvark')).toEqual([
      { word: 'free', score: Math.log(2) },
      { word: 'aardvark', score: null },
    ]);
    expect(scoreMessage(filter, 'free aardvark')).toBeCloseTo(scoreMessage(filter, 'free'), 12);
  });

  it('ignores case, punctuation, and repeats', () => {
    const filter = learned(tiny);
    expect(scoreMessage(filter, 'FREE, free... Prize!')).toBeCloseTo(scoreMessage(filter, 'free prize'), 12);
  });

  it('scores an empty message at nothing, rather than at NaN', () => {
    const filter = learned(tiny);
    expect(scoreMessage(filter, '')).toBe(0);
  });

  it('never produces a value that is not a number', () => {
    for (const set of MESSAGE_SETS) {
      const filter = learned(set.learn);
      for (const group of [set.learn, set.choose, set.final]) {
        for (const item of group) expect(Number.isFinite(scoreMessage(filter, item.text))).toBe(true);
      }
    }
  });
});

/**
 * The structural guarantees. These are the claims the panel makes in words, and
 * they are properties of where the data can reach rather than promises in a
 * comment — the same move as `answerWith` in `phases.ts` and `fitBoth` in
 * `generalization.ts`.
 */
describe('which group can influence what', () => {
  it('builds the same filter however the other two groups are labelled', () => {
    for (const set of MESSAGE_SETS) {
      const honest = learned(set.learn);
      const nonsense: MessageSet = {
        ...set,
        choose: set.choose.map(item => ({ ...item, truth: 'junk' as const, text: 'nonsense nonsense' })),
        final: set.final.map(item => ({ ...item, truth: 'junk' as const, text: 'nonsense nonsense' })),
      };
      const other = learned(nonsense.learn);
      expect([...other.scores.entries()].sort()).toEqual([...honest.scores.entries()].sort());
    }
  });

  it('leaves the filter untouched however many groups are read through it', () => {
    const filter = learned(INITIAL_SET.learn);
    const before = [...filter.scores.entries()].sort();
    runOn(filter, INITIAL_SET.choose, careful.bar);
    runOn(filter, INITIAL_SET.final, quick.bar);
    runOn(filter, INITIAL_SET.final, careful.bar);
    expect([...filter.scores.entries()].sort()).toEqual(before);
  });

  it('gives the same answers every time it reads the same group', () => {
    const filter = learned(INITIAL_SET.learn);
    expect(runOn(filter, INITIAL_SET.final, careful.bar)).toEqual(runOn(filter, INITIAL_SET.final, careful.bar));
  });
});

describe('the caution settings', () => {
  it('offers exactly two, and starts on one of them', () => {
    expect(CAUTIONS).toHaveLength(2);
    expect(CAUTIONS.map(caution => caution.id)).toContain(INITIAL_CAUTION);
  });

  it('sets a higher bar for the more cautious one', () => {
    expect(careful.bar).toBeGreaterThan(quick.bar);
  });

  /** A higher bar can only ever call fewer messages junk. */
  it('never calls more messages junk at the higher bar', () => {
    for (const set of MESSAGE_SETS) {
      const filter = learned(set.learn);
      for (const group of [set.choose, set.final]) {
        const strict = runOn(filter, group, careful.bar).rows.filter(row => row.called === 'junk');
        const loose = runOn(filter, group, quick.bar).rows.filter(row => row.called === 'junk');
        expect(strict.length).toBeLessThanOrEqual(loose.length);
      }
    }
  });

  it('falls back to the first setting rather than returning nothing', () => {
    expect(cautionById('careful').id).toBe('careful');
    expect(cautionById('quick').id).toBe('quick');
  });
});

/**
 * Each shipped set is held to the case it claims, rather than the claim being
 * written into the panel copy. Editing the wording later cannot quietly turn a
 * real trade-off into a set where both settings do the same thing.
 */
describe('the message sets', () => {
  for (const set of MESSAGE_SETS) {
    describe(set.label, () => {
      const all = [...set.learn, ...set.choose, ...set.final];

      it('gives every message its own id', () => {
        expect(new Set(all.map(item => item.id)).size).toBe(all.length);
      });

      it('has both kinds of message in all three groups', () => {
        for (const [name, group] of [['learn', set.learn], ['choose', set.choose], ['final', set.final]] as const) {
          expect(group.some(item => item.truth === 'junk'), `${name} junk`).toBe(true);
          expect(group.some(item => item.truth === 'wanted'), `${name} wanted`).toBe(true);
        }
      });

      it('shares no message between two groups', () => {
        const texts = all.map(item => item.text.toLowerCase());
        expect(new Set(texts).size).toBe(texts.length);
      });

      it('makes the two settings actually disagree on the choosing group', () => {
        const filter = learned(set.learn);
        const strict = runOn(filter, set.choose, careful.bar);
        const loose = runOn(filter, set.choose, quick.bar);
        expect(strict.rows.map(row => row.called)).not.toEqual(loose.rows.map(row => row.called));
      });

      /**
       * The point of the whole panel. At the setting the middle group most
       * flatters, the saved messages show a mistake the middle group did not.
       */
      it('shows something on the saved messages that choosing did not show', () => {
        const filter = learned(set.learn);
        const surprised = CAUTIONS.some(caution => {
          const comparison = compareGroups(runOn(filter, set.choose, caution.bar), runOn(filter, set.final, caution.bar));
          return comparison.hidMoreOnFinal || comparison.missedMoreOnFinal;
        });
        expect(surprised).toBe(true);
      });
    });
  }

  it('is the small mailbox where being quick costs a message you wanted', () => {
    const set = MESSAGE_SETS[0];
    const filter = learned(set.learn);
    const strict = runOn(filter, set.choose, careful.bar);
    const loose = runOn(filter, set.choose, quick.bar);

    // Careful lets junk through but hides nothing.
    expect(strict.wantedHidden).toBe(0);
    expect(strict.junkCaught).toBeLessThan(strict.junkTotal);
    // Quick catches everything and hides mail you wanted. That is the trade.
    expect(loose.junkCaught).toBe(loose.junkTotal);
    expect(loose.wantedHidden).toBeGreaterThan(0);

    // And the cautious setting, which looked safe while choosing, is not.
    const check = compareGroups(strict, runOn(filter, set.final, careful.bar));
    expect(check.hidMoreOnFinal).toBe(true);
  });

  it('is the other mailbox where being quick looks free until the final check', () => {
    const set = MESSAGE_SETS[1];
    const filter = learned(set.learn);
    const loose = runOn(filter, set.choose, quick.bar);

    expect(loose.junkCaught).toBe(loose.junkTotal);
    expect(loose.wantedHidden).toBe(0);

    const check = compareGroups(loose, runOn(filter, set.final, quick.bar));
    expect(check.hidMoreOnFinal).toBe(true);
  });

  it('starts on the first set', () => {
    expect(INITIAL_SET).toBe(MESSAGE_SETS[0]);
  });
});

describe('saying what happened', () => {
  const filter = learned(INITIAL_SET.learn);

  it('never mentions hiding mail that was not hidden', () => {
    const outcome = runOn(filter, INITIAL_SET.choose, careful.bar);
    expect(outcome.wantedHidden).toBe(0);
    expect(describeOutcome(outcome)).toBe('It caught 1 of the 2 junk messages, and hid nothing you wanted.');
  });

  it('says both halves when both happened', () => {
    const outcome = runOn(filter, INITIAL_SET.choose, quick.bar);
    expect(describeOutcome(outcome)).toBe('It caught both junk messages, but also hid a message you wanted.');
  });

  it('counts more than one hidden message properly', () => {
    const wide = runOn(filter, [
      message('x', 'claim your free prize', 'wanted'),
      message('y', 'free prize offer', 'wanted'),
      message('z', 'claim your prize now', 'junk'),
    ], quick.bar);
    expect(describeOutcome(wide)).toBe('It caught the junk message, but also hid 2 messages you wanted.');
  });

  it('says plainly when it caught none', () => {
    const none = runOn(filter, [
      message('x', 'lunch tomorrow', 'junk'),
      message('y', 'meeting notes', 'junk'),
      message('z', 'photos from the weekend', 'wanted'),
    ], careful.bar);
    expect(describeOutcome(none)).toBe('It caught none of the 2 junk messages, and hid nothing you wanted.');
  });

  it('does not claim a catch when there was no junk to catch', () => {
    const clean = runOn(filter, [message('z', 'photos from the weekend', 'wanted')], careful.bar);
    expect(describeOutcome(clean)).toBe('There was no junk in this group, and it hid nothing you wanted.');
  });
});

describe('comparing the two readings', () => {
  const filter = learned(INITIAL_SET.learn);

  it('counts a mistake either way round', () => {
    const outcome = runOn(filter, INITIAL_SET.final, careful.bar);
    expect(mistakes(outcome)).toBe((outcome.junkTotal - outcome.junkCaught) + outcome.wantedHidden);
  });

  it('reports no difference when the same group is read twice', () => {
    const outcome = runOn(filter, INITIAL_SET.choose, careful.bar);
    expect(compareGroups(outcome, outcome).verdict).toBe('same');
    expect(compareGroups(outcome, outcome).hidMoreOnFinal).toBe(false);
  });

  /** Rates, not counts: six messages with two mistakes beats three with two. */
  it('compares rates rather than counts when the groups are different sizes', () => {
    const small = runOn(filter, [
      message('a', 'claim your free prize', 'wanted'),
      message('b', 'meeting notes', 'wanted'),
    ], quick.bar);
    const large = runOn(filter, [
      message('c', 'claim your free prize', 'wanted'),
      message('d', 'meeting notes', 'wanted'),
      message('e', 'photos from the weekend', 'wanted'),
      message('f', 'lunch tomorrow', 'wanted'),
    ], quick.bar);
    expect(mistakes(small)).toBe(1);
    expect(mistakes(large)).toBe(1);
    expect(compareGroups(small, large).verdict).toBe('better');
  });
});

describe('showing that something was learned', () => {
  it('lists words that really do lean the way it says', () => {
    const filter = learned(INITIAL_SET.learn);
    const { junk, wanted } = leaningWords(filter, 4);
    expect(junk).toHaveLength(4);
    expect(wanted).toHaveLength(4);
    for (const word of junk) expect(filter.scores.get(word)!).toBeGreaterThan(0);
    for (const word of wanted) expect(filter.scores.get(word)!).toBeLessThan(0);
  });

  it('gives the same list every time, rather than whatever order a map came out in', () => {
    const filter = learned(INITIAL_SET.learn);
    expect(leaningWords(filter, 5)).toEqual(leaningWords(filter, 5));
  });

  it('asks for more words than there are without inventing any', () => {
    const filter = learned([message('j', 'free', 'junk'), message('w', 'lunch', 'wanted')]);
    const { junk, wanted } = leaningWords(filter, 10);
    expect(junk).toEqual(['free']);
    expect(wanted).toEqual(['lunch']);
  });
});
