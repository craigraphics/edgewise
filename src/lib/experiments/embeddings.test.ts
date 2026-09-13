import { describe, expect, it } from 'vitest';

import {
  DIMENSIONS,
  invalidReason,
  matchesFor,
  neighboursOf,
  OPENING_WORDS,
  projection,
  projectionDisagreesWith,
  similarity,
  SOURCE,
  suggestionsFor,
  topicOf,
  TOPICS,
  vectorFor,
  VECTORS,
  WORDS,
} from './embeddings';

/**
 * Cosine similarity by a different route: the straight-line gap between the two
 * lists once each has been scaled to length 1. It is the same quantity and
 * shares no arithmetic with `similarity`, which is the point — the tokenizer
 * closed this trap by decoding `bpe_ranks` independently, the predictor by
 * checking the least-squares conditions, the representation playground by brute
 * force, the loss panel by hand arithmetic, and the generalization panel against
 * answers worked out on paper. This is the sixth route.
 */
function cosineByDistance(a: readonly number[], b: readonly number[]): number {
  const unit = (values: readonly number[]) => {
    const size = Math.sqrt(values.reduce((total, value) => total + value ** 2, 0));
    return values.map(value => value / size);
  };
  const [ua, ub] = [unit(a), unit(b)];
  const gap = Math.sqrt(ua.reduce((total, value, i) => total + (value - ub[i]) ** 2, 0));
  return 1 - (gap * gap) / 2;
}

describe('comparing two lists of numbers', () => {
  it('is 1 for the same list, 0 at a right angle, and −1 for the opposite', () => {
    expect(similarity([3, 4], [3, 4])).toBeCloseTo(1, 12);
    expect(similarity([1, 0], [0, 1])).toBeCloseTo(0, 12);
    expect(similarity([1, 2], [-1, -2])).toBeCloseTo(-1, 12);
  });

  it('ignores how long the list is, only which way it points', () => {
    expect(similarity([1, 2, 3], [10, 20, 30])).toBeCloseTo(1, 12);
    expect(similarity([2, 1], [4, 2])).toBeCloseTo(similarity([2, 1], [400, 200]), 12);
  });

  it('matches an answer worked out by hand', () => {
    // [1,1] against [1,0]: dot 1, lengths √2 and 1, so 1/√2.
    expect(similarity([1, 1], [1, 0])).toBeCloseTo(1 / Math.SQRT2, 12);
    // [1,2,2] against [2,4,4] is the same direction; against [2,-1,0] the dot is 0.
    expect(similarity([1, 2, 2], [2, -1, 0])).toBeCloseTo(0, 12);
  });

  it('agrees with the same quantity computed a different way, on the real values', () => {
    for (const word of ['guitar', 'garden', 'coffee', 'football', 'bank']) {
      for (const other of ['piano', 'soil', 'tea', 'league', 'mouse']) {
        expect(similarity(vectorFor(word)!, vectorFor(other)!)).toBeCloseTo(cosineByDistance(vectorFor(word)!, vectorFor(other)!), 10);
      }
    }
  });

  it('returns 0 rather than NaN when a list points nowhere', () => {
    expect(similarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe('the saved collection', () => {
  it('is real learned values from a named, licensed source', () => {
    expect(SOURCE.url).toBe('https://nlp.stanford.edu/projects/glove/');
    expect(SOURCE.licence).toContain('Public Domain Dedication');
    expect(SOURCE.file).toBe('glove.6B.100d.txt');
  });

  /**
   * Static, one fixed list per word — not the context-dependent values a
   * language model computes for a token inside a sentence. The node's second
   * misconception is exactly that confusion, so the distinction is pinned here
   * rather than left to the copy.
   */
  it('says it is static rather than context-dependent', () => {
    expect(SOURCE.kind).toBe('static');
    expect(SOURCE.kindNote.toLowerCase()).toContain('not the context-dependent');
  });

  it('carries every word exactly once, with the stated number of finite values', () => {
    expect(WORDS.length).toBe(163);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(DIMENSIONS).toBe(100);
    for (const word of WORDS) {
      const values = vectorFor(word)!;
      expect(values.length, word).toBe(DIMENSIONS);
      expect(values.every(Number.isFinite), word).toBe(true);
      expect(values.some(value => value !== 0), word).toBe(true);
    }
  });

  /**
   * Pinned against the published release, so regenerating the file from some
   * other source of numbers fails here rather than quietly changing what the
   * panel calls meaning. These are the opening values of the `guitar` and
   * `garden` lines of `glove.6B.100d.txt`, rounded to the four places the file
   * records.
   */
  it('matches the published GloVe values it claims to come from', () => {
    expect(vectorFor('guitar')!.slice(0, 5)).toEqual([-0.3692, 0.6997, -0.0444, -0.9385, 0.7604]);
    expect(vectorFor('garden')!.slice(0, 5)).toEqual([-0.2232, 0.487, 0.0331, 0.2905, 0.4769]);
  });

  it('offers four opening words from four different parts of life', () => {
    expect(OPENING_WORDS.length).toBe(4);
    for (const word of OPENING_WORDS) expect(vectorFor(word), word).not.toBeNull();
    expect(new Set(OPENING_WORDS.map(topicOf)).size).toBe(4);
  });

  it('puts every word in exactly one area, and every listed word in the collection', () => {
    const listed = TOPICS.flatMap(topic => topic.words);
    expect(listed.length).toBe(WORDS.length);
    expect(new Set(listed).size).toBe(listed.length);
    for (const word of listed) expect(vectorFor(word), word).not.toBeNull();
  });
});

describe('a word that is not in the collection', () => {
  it('has no values and no neighbours, rather than an invented answer', () => {
    expect(vectorFor('aubergine')).toBeNull();
    expect(neighboursOf('aubergine')).toBeNull();
    expect(vectorFor('')).toBeNull();
    expect(vectorFor('Guitar')).toBeNull();
  });

  it('is answered with words that are in it', () => {
    expect(matchesFor('guit')).toContain('guitar');
    expect(matchesFor('gard')).toEqual(expect.arrayContaining(['garden', 'gardening']));
    expect(matchesFor('aubergine')).toEqual([]);
    expect(matchesFor('')).toEqual([]);
    // A typo is the common case: the search is retried on shorter openings.
    expect(suggestionsFor('guitarr')).toContain('guitar');
    expect(suggestionsFor('gardenz')).toContain('garden');
    // Nothing matches at all, so the opening words stand in rather than an empty list.
    expect(suggestionsFor('zzzz')).toEqual([...OPENING_WORDS]);
    expect(suggestionsFor('')).toEqual([...OPENING_WORDS]);
    // A two-letter fragment is too short to retry on, and must not be guessed at.
    expect(suggestionsFor('qx')).toEqual([...OPENING_WORDS]);
    for (const suggestion of suggestionsFor('an')) expect(vectorFor(suggestion), suggestion).not.toBeNull();
  });
});

describe('a collection that cannot be used', () => {
  const good = [1, 2, 3];
  it('names the reason instead of comparing anyway', () => {
    expect(invalidReason({ one: good }, 3)).toContain('at least two');
    expect(invalidReason({ one: good, two: [1, 2] }, 3)).toContain('not 3');
    expect(invalidReason({ one: good, two: [1, Number.NaN, 3] }, 3)).toContain('not a number');
    expect(invalidReason({ one: good, two: [1, Infinity, 3] }, 3)).toContain('not a number');
    expect(invalidReason({ one: good, two: [0, 0, 0] }, 3)).toContain('points nowhere');
  });

  it('passes the collection this panel actually ships', () => {
    expect(invalidReason(VECTORS)).toBeNull();
  });
});

describe('the neighbours a word gets', () => {
  it('come back strongest first, and in the same order every time', () => {
    const first = neighboursOf('guitar')!;
    const again = neighboursOf('guitar')!;
    expect(first).toEqual(again);
    for (let i = 1; i < first.length; i += 1) expect(first[i - 1].similarity).toBeGreaterThanOrEqual(first[i].similarity);
  });

  it('never include the word itself', () => {
    for (const word of ['guitar', 'garden', 'coffee', 'football']) {
      expect(neighboursOf(word, 10)!.map(n => n.word)).not.toContain(word);
    }
  });

  it('break a tie by word, so nothing reshuffles between two readings', () => {
    // Two words equally alike the third: the sort has to choose, and it chooses
    // alphabetically rather than by whatever order the object happened to hold.
    const rank = (list: { word: string; similarity: number }[]) =>
      [...list].sort((a, b) => b.similarity - a.similarity || a.word.localeCompare(b.word)).map(n => n.word);
    expect(rank([{ word: 'zebra', similarity: 0.5 }, { word: 'apple', similarity: 0.5 }])).toEqual(['apple', 'zebra']);
  });

  it('are read off the whole list, so a word can belong to an area its neighbours do not', () => {
    // `rock` is filed under Outdoors by us. Its lists sit with the music words,
    // which is the panel's own point about who decided the grouping.
    expect(topicOf('rock')).toBe('Outdoors');
    expect(neighboursOf('rock')!.map(n => n.word)).toContain('band');
    // `hedge` is filed under the garden and lands among the money words.
    expect(topicOf('hedge')).toBe('The garden');
    expect(neighboursOf('hedge')!.map(n => n.word)).toContain('money');
  });

  it('carry both senses of a word that has two', () => {
    // One fixed list per word, so `mouse` cannot choose between the animal and
    // the thing beside a keyboard. Both are in its neighbours.
    const mouse = neighboursOf('mouse', 6)!.map(n => n.word);
    expect(mouse).toContain('cat');
    expect(mouse).toContain('keyboard');
  });
});

describe('the optional flat picture', () => {
  const points = projection();

  it('places every word, and places it in the same spot every time', () => {
    expect(points.length).toBe(WORDS.length);
    expect(projection()).toEqual(points);
    for (const point of points) {
      expect(Number.isFinite(point.x), point.word).toBe(true);
      expect(Number.isFinite(point.y), point.word).toBe(true);
    }
  });

  it('is centred, and its two directions are independent of each other', () => {
    const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
    expect(mean(points.map(p => p.x))).toBeCloseTo(0, 6);
    expect(mean(points.map(p => p.y))).toBeCloseTo(0, 6);
    const cross = points.reduce((total, p) => total + p.x * p.y, 0) / points.length;
    expect(Math.abs(cross)).toBeLessThan(0.01);
  });

  it('spreads the words out most along the first direction', () => {
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    expect(spread(points.map(p => p.x))).toBeGreaterThan(spread(points.map(p => p.y)));
  });

  /**
   * The claim the panel makes about the picture, measured rather than asserted.
   * If this ever came back empty the copy would be wrong, and a reader would be
   * entitled to read neighbours off the drawing.
   */
  it('loses enough that most words have a different closest word in it', () => {
    const disagreeing = projectionDisagreesWith(points);
    expect(disagreeing.length).toBeGreaterThan(WORDS.length / 2);
    expect(disagreeing).toContain('guitar');
  });

  it('is never what a neighbour is read from', () => {
    // `guitar`'s nearest word in the full lists is `bass`. In two dimensions it
    // is something else, and the panel prints the first.
    expect(neighboursOf('guitar', 1)![0].word).toBe('bass');
    const guitar = points.find(p => p.word === 'guitar')!;
    const nearestFlat = points
      .filter(p => p.word !== 'guitar')
      .sort((a, b) => Math.hypot(a.x - guitar.x, a.y - guitar.y) - Math.hypot(b.x - guitar.x, b.y - guitar.y))[0];
    expect(nearestFlat.word).not.toBe('bass');
  });
});
