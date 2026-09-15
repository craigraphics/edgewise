import { describe, expect, it } from 'vitest';

import {
  chancesAfter,
  chooseNext,
  FIRST_OPENING,
  isFinished,
  LESSON,
  lesson,
  MAX_PIECES,
  MODEL,
  OPENINGS,
  percent,
  readable,
  runToEnd,
  shortlistCoverage,
  step,
  STOP,
  STORIES,
  STREAMS,
  tokenise,
  type Model,
} from './next-token';

/**
 * The expectations here are worked out from the stories BY HAND, or counted by a
 * second, plainly written routine in this file. Asserting a counting model
 * against the function that did the counting is the trap this project has now
 * closed eight different ways — `bpe_ranks` decoded independently, the
 * least-squares conditions, brute force over 65,536 pictures, hand arithmetic,
 * answers worked out on paper, pinning to a published file, literal `Math.exp`
 * calls, and a second implementation of a whole transformer block. This is the
 * ninth: a naive scan of the raw story text, sharing no code with `build`.
 */
function countByScanning(ending: readonly string[]): Map<string, number> {
  const found = new Map<string, number>();
  for (const story of STORIES) {
    const words = story.toLowerCase().match(/[a-z']+|\./g) ?? [];
    for (let index = 0; index + ending.length < words.length; index += 1) {
      const matches = ending.every((piece, offset) => words[index + offset] === piece);
      if (!matches) continue;
      const next = words[index + ending.length];
      found.set(next, (found.get(next) ?? 0) + 1);
    }
  }
  return found;
}

describe('turning the stories into pieces', () => {
  it('makes one piece per word and keeps the full stop as its own piece', () => {
    expect(tokenise('The little fox slept.')).toEqual(['the', 'little', 'fox', 'slept', '.']);
  });

  it('folds capitals together, so The and the are the same piece', () => {
    expect(tokenise('The fox. the fox')).toEqual(['the', 'fox', '.', 'the', 'fox']);
  });

  it('keeps each story in its own stream, so an ending never runs across two stories', () => {
    expect(STREAMS).toHaveLength(STORIES.length);
    const joined = STREAMS.flat();
    // The last piece of story one and the first of story two are never adjacent
    // in any counted ending, which is what separate streams buys.
    const across = chancesAfter(MODEL, [STREAMS[0][STREAMS[0].length - 1], STREAMS[1][0]]);
    expect(across.fellBack).toBe(true);
    expect(joined.length).toBe(MODEL.size);
  });
});

describe('the chances', () => {
  it('agrees with a plain scan of the story text', () => {
    for (const ending of [['the', 'little'], ['little', 'fox'], ['the', 'old'], ['to', 'the']]) {
      const scanned = countByScanning(ending);
      const chances = chancesAfter(MODEL, ending);
      expect(chances.basis).toBe('two');
      expect(chances.continuations.length).toBe(scanned.size);
      const total = [...scanned.values()].reduce((sum, n) => sum + n, 0);
      expect(chances.observations).toBe(total);
      for (const row of chances.continuations) {
        expect(row.count, `${ending.join(' ')} → ${row.piece}`).toBe(scanned.get(row.piece));
        expect(row.chance).toBeCloseTo((scanned.get(row.piece) ?? 0) / total, 12);
      }
    }
  });

  /** Counted by hand off the twelve stories, so the numbers on screen are checkable. */
  it('gives the opening ending the counts a reader can check', () => {
    const chances = chancesAfter(MODEL, tokenise(FIRST_OPENING.text));
    expect(chances.ending).toEqual(['the', 'little']);
    expect(chances.observations).toBe(16);
    expect(chances.continuations.map(row => [row.piece, row.count])).toEqual([
      ['fox', 6], ['owl', 5], ['mouse', 4], ['hedgehog', 1],
    ]);
    expect(chances.continuations[0].chance).toBeCloseTo(6 / 16, 12);
  });

  it('sums to one across every piece ever seen after that ending', () => {
    for (const ending of [['the', 'little'], ['little', 'fox'], ['by', 'the'], ['the']]) {
      const chances = chancesAfter(MODEL, ending);
      const total = chances.continuations.reduce((sum, row) => sum + row.chance, 0);
      expect(total).toBeCloseTo(1, 12);
    }
  });

  /**
   * The chances cover the pieces SEEN after this ending, not the vocabulary. A
   * piece that never followed it gets nothing here, which is a real limit of
   * counting and is stated on screen rather than papered over.
   */
  it('gives no chance at all to a piece that never followed this ending', () => {
    const chances = chancesAfter(MODEL, ['the', 'little']);
    expect(MODEL.vocabulary).toContain('river');
    expect(chances.continuations.some(row => row.piece === 'river')).toBe(false);
    expect(chances.continuations.length).toBeLessThan(MODEL.vocabulary.length);
  });

  it('puts the most likely piece first', () => {
    const chances = chancesAfter(MODEL, ['the', 'little']);
    const ordered = [...chances.continuations].sort((a, b) => b.chance - a.chance);
    expect(chances.continuations.map(row => row.piece)).toEqual(ordered.map(row => row.piece));
  });
});

describe('the fallback when an ending was never seen', () => {
  it('drops to the last piece only, and says that it did', () => {
    const chances = chancesAfter(MODEL, tokenise('The brave little'));
    expect(chances.basis).toBe('one');
    expect(chances.fellBack).toBe(true);
    expect(chances.ending).toEqual(['little']);
    // The same four animals, because "little" alone is what it could still use.
    expect(chances.continuations.map(row => row.piece)).toEqual(['fox', 'owl', 'mouse', 'hedgehog']);
  });

  it('drops all the way to how often each piece appears, for a piece never seen at all', () => {
    const chances = chancesAfter(MODEL, ['quetzal']);
    expect(chances.basis).toBe('any');
    expect(chances.fellBack).toBe(true);
    expect(chances.ending).toEqual([]);
    expect(chances.observations).toBe(MODEL.size);
  });

  it('uses the two-piece ending whenever it can', () => {
    expect(chancesAfter(MODEL, ['the', 'little']).basis).toBe('two');
    expect(chancesAfter(MODEL, ['the', 'little']).fellBack).toBe(false);
  });

  it('reports no fallback for an opening too short to have a two-piece ending', () => {
    expect(chancesAfter(MODEL, ['the']).basis).toBe('one');
    expect(chancesAfter(MODEL, ['the']).fellBack).toBe(false);
    expect(chancesAfter(MODEL, []).basis).toBe('any');
    expect(chancesAfter(MODEL, []).fellBack).toBe(false);
  });
});

describe('the tie rule', () => {
  /**
   * "fox went" is followed by "down" once and "home" once, so the two are
   * exactly equal and something has to break it. The rule is the pair this
   * ending met first in the stories, and story one reaches "went down" before
   * "went home".
   */
  it('is a real tie, and goes to the pair this ending met first', () => {
    const chances = chancesAfter(MODEL, ['fox', 'went']);
    expect(chances.continuations.map(row => [row.piece, row.count])).toEqual([['down', 1], ['home', 1]]);
    expect(chances.continuations[0].chance).toBe(chances.continuations[1].chance);
    expect(chooseNext(chances)?.piece).toBe('down');
    expect(STORIES[0].toLowerCase().indexOf('went down')).toBeLessThan(STORIES[0].toLowerCase().indexOf('went home'));
  });

  it('gives the same sentence every time it is run', () => {
    for (const opening of OPENINGS) {
      const pieces = tokenise(opening.text);
      const once = runToEnd(MODEL, pieces, pieces).map(each => each.added);
      const twice = runToEnd(MODEL, pieces, pieces).map(each => each.added);
      expect(twice).toEqual(once);
    }
  });
});

describe('one step of the loop', () => {
  /** The claim the whole experiment rests on. */
  it('feeds the piece it just added into the next calculation', () => {
    const opening = tokenise(FIRST_OPENING.text);
    const steps = runToEnd(MODEL, opening, opening);
    expect(steps.length).toBeGreaterThan(3);

    for (let index = 0; index < steps.length; index += 1) {
      const current = steps[index];
      expect(current.after).toEqual([...current.before, current.added]);
      if (index === 0) continue;
      const previous = steps[index - 1];
      expect(current.before).toEqual(previous.after);
      // The ending this step read is the tail of the text the last step produced,
      // so the added piece is genuinely part of what comes next.
      if (current.chances.basis === 'two') {
        expect(current.chances.ending).toEqual(previous.after.slice(-2));
        expect(current.chances.ending).toContain(previous.added);
      }
    }
  });

  it('walks the opening to the sentence a reader can check by hand', () => {
    const opening = tokenise(FIRST_OPENING.text);
    const steps = runToEnd(MODEL, opening, opening);
    expect(steps.map(each => each.added)).toEqual(['fox', 'went', 'down', 'to', 'the', 'warm', 'den', 'and', 'slept', STOP]);
    expect(readable(steps[steps.length - 1].after)).toBe('At night the little fox went down to the warm den and slept.');
  });

  it('stops when it chooses the full stop, and not before', () => {
    const opening = tokenise(FIRST_OPENING.text);
    const steps = runToEnd(MODEL, opening, opening);
    expect(steps.filter(each => each.finished)).toHaveLength(1);
    expect(steps[steps.length - 1].finished).toBe(true);
    expect(isFinished(opening, steps[steps.length - 1].after)).toBe(true);
    for (const each of steps.slice(0, -1)) expect(isFinished(opening, each.after)).toBe(false);
  });

  it('every opening reaches a full stop rather than running to the cap', () => {
    for (const opening of OPENINGS) {
      const pieces = tokenise(opening.text);
      const steps = runToEnd(MODEL, pieces, pieces);
      expect(steps.length, opening.id).toBeLessThan(MAX_PIECES);
      expect(steps[steps.length - 1].added, opening.id).toBe(STOP);
    }
  });

  it('stops at the cap even when the text never ends', () => {
    // A model whose only rule is "a is followed by a" can never reach a stop.
    const endless: Model = {
      size: 2,
      vocabulary: ['a'],
      two: new Map([['a a', { total: 1, pieces: new Map([['a', { count: 1, firstSeen: 0 }]]) }]]),
      one: new Map([['a', { total: 1, pieces: new Map([['a', { count: 1, firstSeen: 0 }]]) }]]),
      any: { total: 1, pieces: new Map([['a', { count: 1, firstSeen: 0 }]]) },
    };
    const opening = ['a', 'a'];
    const steps = runToEnd(endless, opening, opening);
    expect(steps).toHaveLength(MAX_PIECES);
    expect(isFinished(opening, steps[steps.length - 1].after)).toBe(true);
  });

  it('adds nothing when there is nothing it could add', () => {
    const empty: Model = { size: 0, vocabulary: [], two: new Map(), one: new Map(), any: { total: 0, pieces: new Map() } };
    expect(step(empty, ['a', 'b'])).toBeNull();
    expect(runToEnd(empty, ['a'], ['a', 'b'])).toEqual([]);
  });
});

describe('generating never changes what was learned', () => {
  /**
   * The counts are a module constant and every function takes the model as a
   * parameter, so "using it does not train it" is the shape of the code. This
   * checks the consequence: a full run leaves every tally byte-identical.
   */
  it('leaves every count exactly where it was', () => {
    const snapshot = (model: Model) => JSON.stringify({
      size: model.size,
      vocabulary: model.vocabulary,
      two: [...model.two.entries()].map(([ending, bucket]) => [ending, bucket.total, [...bucket.pieces.entries()]]),
      one: [...model.one.entries()].map(([ending, bucket]) => [ending, bucket.total, [...bucket.pieces.entries()]]),
      any: [model.any.total, [...model.any.pieces.entries()]],
    });

    const before = snapshot(MODEL);
    for (const opening of OPENINGS) {
      const pieces = tokenise(opening.text);
      runToEnd(MODEL, pieces, pieces);
      chancesAfter(MODEL, pieces);
      step(MODEL, pieces);
    }
    expect(snapshot(MODEL)).toBe(before);
  });
});

describe('the shortlist', () => {
  it('reports the share it is showing rather than rescaling it', () => {
    const chances = chancesAfter(MODEL, ['little', 'fox']);
    expect(chances.continuations.length).toBe(5);
    // Showing two of five must report two of five's worth of chance, not 100%.
    const shown = shortlistCoverage(chances, 2);
    expect(shown).toBeCloseTo(chances.continuations[0].chance + chances.continuations[1].chance, 12);
    expect(shown).toBeLessThan(1);
    expect(shortlistCoverage(chances, chances.continuations.length)).toBeCloseTo(1, 12);
  });
});

describe('the training passage', () => {
  const passage = lesson(MODEL);

  it('is a real position in a real story', () => {
    expect(STREAMS[LESSON.story].slice(0, LESSON.cut)).toEqual(passage.before);
    expect(STREAMS[LESSON.story][LESSON.cut]).toBe(passage.actual);
    expect([...passage.before, passage.actual, ...passage.after]).toEqual(STREAMS[LESSON.story]);
  });

  it('reads as the sentence a learner will see', () => {
    expect(readable(passage.before)).toBe('At night the little fox went down to the river. The little fox');
    expect(passage.actual).toBe('drank');
  });

  /**
   * The whole point of the section. If the model already put the real piece
   * first there would be nothing for training to reward, so the cut is held to
   * a passage where it does not.
   */
  it('cuts where the model would have chosen something else', () => {
    expect(passage.rank).toBeGreaterThan(0);
    expect(chooseNext(passage.chances)?.piece).not.toBe(passage.actual);
    expect(passage.chance).toBeGreaterThan(0);
    expect(passage.chance).toBeLessThan(passage.chances.continuations[0].chance);
  });
});

describe('reading the pieces back', () => {
  it('puts no space before a full stop and opens with a capital', () => {
    expect(readable(['the', 'fox', 'slept', '.'])).toBe('The fox slept.');
    expect(readable([])).toBe('');
    expect(readable(['fox'])).toBe('Fox');
  });

  /** Without this a run that passes a stop reads as a defect, not as a model. */
  it('starts each new sentence with a capital', () => {
    expect(readable(['the', 'fox', 'slept', '.', 'the', 'owl', 'woke', '.'])).toBe('The fox slept. The owl woke.');
  });

  it('leaves the pieces themselves untouched — the capitals are for reading only', () => {
    const pieces = ['the', 'fox', '.', 'the', 'owl'];
    readable(pieces);
    expect(pieces).toEqual(['the', 'fox', '.', 'the', 'owl']);
    expect(MODEL.vocabulary.every(piece => piece === piece.toLowerCase())).toBe(true);
  });
});

describe('percentages', () => {
  it('rounds to one decimal place', () => {
    expect(percent(0.375)).toBe('37.5%');
    expect(percent(1)).toBe('100%');
    expect(percent(1 / 3)).toBe('33.3%');
  });

  it('never prints 0% for something that can genuinely happen', () => {
    expect(percent(0.0001)).toBe('under 0.1%');
    expect(percent(0)).toBe('0%');
  });
});

describe('the openings', () => {
  it('all produce pieces this model can work from', () => {
    for (const opening of OPENINGS) {
      const pieces = tokenise(opening.text);
      expect(pieces.length, opening.id).toBeGreaterThan(1);
      expect(chancesAfter(MODEL, pieces).continuations.length, opening.id).toBeGreaterThan(0);
    }
    expect(new Set(OPENINGS.map(each => each.id)).size).toBe(OPENINGS.length);
  });

  it('offers one whose two-piece ending was never in the stories', () => {
    const fallbacks = OPENINGS.filter(each => chancesAfter(MODEL, tokenise(each.text)).fellBack);
    expect(fallbacks.length).toBeGreaterThan(0);
  });
});
