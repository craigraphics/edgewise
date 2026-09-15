import { describe, expect, it } from 'vitest';

import {
  answerFrom,
  CURRENT_NOTICE,
  dayIn,
  FIRST_QUESTION,
  isStale,
  NOTICES,
  OLDER_NOTICE,
  QUESTIONS,
  queryTerms,
  rank,
  searchableText,
  stem,
  STOPWORDS,
  words,
  type Notice,
} from './retrieval';

const QUESTION = FIRST_QUESTION.text;
const SAUNA = QUESTIONS.find(question => question.id === 'sauna')!.text;
const notice = (id: string) => NOTICES.find(each => each.id === id)!;

/**
 * The scores, worked out a second time and a different way.
 *
 * Asserting a measure against the function that produced it is the trap this
 * project has now closed eight times — by decoding `bpe_ranks` independently,
 * by the least-squares conditions, by brute force over 65,536 pictures, by hand
 * arithmetic, by answers worked out on paper, by pinning to a published file,
 * by literal `Math.exp` calls, and by a second plainly-written implementation.
 * This is a ninth: a short loop written here, sharing nothing with `rank` but
 * the tokeniser, plus fixtures below that can be checked in your head.
 */
function scoreByHand(collection: readonly Notice[], question: string, id: string): number {
  const terms = queryTerms(question);
  const texts = collection.map(each => words(searchableText(each)));
  const mine = texts[collection.findIndex(each => each.id === id)];
  let total = 0;
  for (const term of terms) {
    let occurrences = 0;
    for (const word of mine) if (word === term) occurrences += 1;
    let inNotices = 0;
    for (const text of texts) if (text.includes(term)) inNotices += 1;
    if (occurrences > 0) total += occurrences / inNotices;
  }
  return total;
}

describe('the tokeniser', () => {
  it('takes a trailing s off, and nothing else', () => {
    expect(stem('closes')).toBe('close');
    expect(stem('Saturdays')).toBe('saturday');
    expect(stem('hours')).toBe('hour');
    // Stated on screen: the rule is only the trailing s, so "closed" is a
    // different word and the maintenance notice is scored accordingly.
    expect(stem('closed')).toBe('closed');
    expect(stem('is')).toBe('is');
    expect(stem('pass')).toBe('pass');
  });

  it('takes whole words, so "poolside" is not "pool"', () => {
    expect(words('Poolside café hours')).toEqual(['poolside', 'café', 'hour']);
    expect(words('Poolside')).not.toContain('pool');
  });

  it('drops the common words, in either spelling', () => {
    // "does" stems to "doe" before anything looks at it, which once put a word
    // nobody typed into the panel's list of what the search looked for.
    expect(queryTerms(QUESTION)).toEqual(['pool', 'close', 'saturday']);
    expect(queryTerms(SAUNA)).toEqual(['sauna']);
    for (const word of STOPWORDS) expect(queryTerms(word)).toEqual([]);
  });

  it('asks each word only once', () => {
    expect(queryTerms('pool pool pool')).toEqual(['pool']);
  });
});

describe('the ranking', () => {
  it('puts the five notices in one fixed order for the opening question', () => {
    expect(rank(NOTICES, QUESTION).map(match => match.notice.id)).toEqual([
      'saturday-current',
      'saturday-old',
      'cafe',
      'maintenance',
      'lanes',
    ]);
  });

  it('agrees with the same count worked out separately', () => {
    for (const match of rank(NOTICES, QUESTION)) {
      expect(match.score, match.notice.id).toBeCloseTo(scoreByHand(NOTICES, QUESTION, match.notice.id), 12);
    }
  });

  /**
   * The arithmetic anybody can check. "pool" is in four of the five notices, so
   * it is worth a quarter each time it appears; "close" and "saturday" are in
   * three, so a third. The current notice says "Saturday" three times — in its
   * title and in both its lines — which is the whole of its lead.
   */
  it('scores the two Saturday notices as the notices themselves read', () => {
    const scores = new Map(rank(NOTICES, QUESTION).map(match => [match.notice.id, match.score]));
    expect(scores.get('saturday-current')).toBeCloseTo(3 / 3 + 1 / 4 + 1 / 3, 12);
    expect(scores.get('saturday-old')).toBeCloseTo(2 / 3 + 1 / 4 + 1 / 3, 12);
    expect(scores.get('cafe')).toBeCloseTo(1 / 3 + 1 / 3, 12);
    expect(scores.get('maintenance')).toBeCloseTo(2 / 4, 12);
    expect(scores.get('lanes')).toBeCloseTo(1 / 4, 12);
  });

  it('explains each hit with the numbers that made it', () => {
    const top = rank(NOTICES, QUESTION)[0];
    const saturday = top.hits.find(hit => hit.term === 'saturday')!;
    expect(saturday.occurrences).toBe(3);
    expect(saturday.notices).toBe(3);
    expect(saturday.contribution).toBeCloseTo(1, 12);
    // A term the notice never uses is not listed at all, rather than listed at zero.
    expect(top.hits.map(hit => hit.term)).toEqual(['pool', 'close', 'saturday']);
    expect(rank(NOTICES, QUESTION).find(match => match.notice.id === 'cafe')!.hits.map(hit => hit.term))
      .toEqual(['close', 'saturday']);
  });

  /**
   * The claim the panel makes out loud: the current notice came top because of
   * how it is worded, not because it is newer. If `rank` read a date this test
   * would fail, and the sentence on screen would be false.
   */
  it('never reads a date or a version', () => {
    const before = rank(NOTICES, QUESTION);
    const scrambled = NOTICES.map((each, index) => ({
      ...each,
      date: `nonsense ${NOTICES.length - index}`,
      version: 99 - index,
    }));
    const after = rank(scrambled, QUESTION);
    expect(after.map(match => match.notice.id)).toEqual(before.map(match => match.notice.id));
    expect(after.map(match => match.score)).toEqual(before.map(match => match.score));
  });

  it('keeps the current notice above the older one, and both above the café', () => {
    const order = rank(NOTICES, QUESTION).map(match => match.notice.id);
    expect(order.indexOf(CURRENT_NOTICE)).toBeLessThan(order.indexOf(OLDER_NOTICE));
    expect(order.indexOf(OLDER_NOTICE)).toBeLessThan(order.indexOf('cafe'));
  });

  it('breaks a tie by position in the collection, the same way every time', () => {
    const twin = (id: string): Notice => ({
      id,
      title: 'Saturday opening hours',
      date: id === 'first' ? '1 January 2026' : '31 December 2026',
      version: 1,
      lines: ['The pool closes at 8pm on Saturday.'],
    });
    const pair = [twin('first'), twin('second')];
    for (let run = 0; run < 5; run += 1) {
      const result = rank(pair, QUESTION);
      expect(result[0].score).toBe(result[1].score);
      expect(result.map(match => match.notice.id)).toEqual(['first', 'second']);
    }
    // The later date first in the list still comes first: position, not recency.
    expect(rank([twin('second'), twin('first')], QUESTION).map(match => match.notice.id))
      .toEqual(['second', 'first']);
  });

  it('comes back with nothing when nothing matches, rather than a best guess', () => {
    expect(rank(NOTICES, SAUNA)).toEqual([]);
    expect(rank(NOTICES, 'trampoline')).toEqual([]);
    expect(rank([], QUESTION)).toEqual([]);
  });

  it('leaves out a notice that shares no word with the question', () => {
    expect(rank(NOTICES, 'When does the café close?').map(match => match.notice.id))
      .not.toContain('maintenance');
  });
});

describe('the answer template', () => {
  it('reads the day out of the question', () => {
    expect(dayIn(QUESTION)).toBe('saturday');
    expect(dayIn('What happens on Sundays?')).toBe('sunday');
    expect(dayIn(SAUNA)).toBe(null);
  });

  it('gives the current notice’s time, from the current notice’s own line', () => {
    const answer = answerFrom(notice(CURRENT_NOTICE), QUESTION);
    expect(answer).toMatchObject({ kind: 'answer', text: 'The pool closes at 4pm on Saturday.', time: '4pm' });
  });

  it('gives the older notice’s time, fluently and with a real citation', () => {
    const answer = answerFrom(notice(OLDER_NOTICE), QUESTION);
    expect(answer).toMatchObject({ kind: 'answer', text: 'The pool closes at 6pm on Saturday.', time: '6pm' });
  });

  /**
   * The subject comes out of the line rather than being assumed. A template
   * that printed "the pool" whatever it was handed would be inventing the one
   * thing this panel is about.
   */
  it('answers about the café when it is handed the café notice', () => {
    expect(answerFrom(notice('cafe'), QUESTION)).toMatchObject({
      kind: 'answer',
      text: 'The café closes at 5pm on Saturday.',
    });
  });

  it('says a notice does not give the answer rather than supplying a time', () => {
    for (const id of ['lanes', 'maintenance']) {
      const answer = answerFrom(notice(id), QUESTION);
      expect(answer, id).toEqual({ kind: 'no-answer', reason: 'not-in-this-notice' });
    }
  });

  it('stops when the question names no day', () => {
    expect(answerFrom(notice(CURRENT_NOTICE), SAUNA)).toEqual({ kind: 'no-answer', reason: 'no-day-in-question' });
  });

  it('will not read a closing time off a line about a different day', () => {
    const sunday: Notice = {
      id: 'sunday-only',
      title: 'Sunday hours',
      date: '1 March 2026',
      version: 1,
      lines: ['The pool closes at 2pm on Sunday.'],
    };
    expect(answerFrom(sunday, QUESTION)).toEqual({ kind: 'no-answer', reason: 'not-in-this-notice' });
  });

  /**
   * The structural claim: the collection is not a parameter, so it cannot be
   * reached. Handed the one notice with no Saturday hours while every other
   * notice in the collection has them, it still comes back empty-handed.
   */
  it('uses only the passage it was handed, never the collection', () => {
    expect(NOTICES.filter(each => answerFrom(each, QUESTION).kind === 'answer').length).toBeGreaterThan(0);
    expect(answerFrom(notice('lanes'), QUESTION).kind).toBe('no-answer');
  });

  it('cites a line that is really in that notice and really carries the time', () => {
    for (const id of [CURRENT_NOTICE, OLDER_NOTICE, 'cafe']) {
      const source = notice(id);
      const answer = answerFrom(source, QUESTION);
      expect(answer.kind, id).toBe('answer');
      if (answer.kind !== 'answer') continue;
      expect(source.lines[answer.lineIndex], id).toBe(answer.line);
      expect(answer.line.toLowerCase().replace(/\s+/g, ''), id).toContain(answer.time);
      expect(answer.text, id).toContain(answer.time);
    }
  });

  it('never prints a time the supplied notice does not contain', () => {
    for (const source of NOTICES) {
      const answer = answerFrom(source, QUESTION);
      if (answer.kind !== 'answer') continue;
      expect(searchableText(source).toLowerCase().replace(/\s+/g, ''), source.id).toContain(answer.time);
    }
  });
});

describe('a changed source', () => {
  it('leaves an answer from another notice stale', () => {
    expect(isStale(CURRENT_NOTICE, OLDER_NOTICE)).toBe(true);
    expect(isStale(CURRENT_NOTICE, CURRENT_NOTICE)).toBe(false);
    expect(isStale(null, OLDER_NOTICE)).toBe(false);
    expect(isStale(CURRENT_NOTICE, null)).toBe(true);
  });

  it('gives a different time once the same rule is asked again', () => {
    const first = answerFrom(notice(CURRENT_NOTICE), QUESTION);
    const second = answerFrom(notice(OLDER_NOTICE), QUESTION);
    expect(first.kind).toBe('answer');
    expect(second.kind).toBe('answer');
    if (first.kind !== 'answer' || second.kind !== 'answer') return;
    expect(first.time).not.toBe(second.time);
    expect(first.line).not.toBe(second.line);
  });
});

describe('the notices themselves', () => {
  it('are not stored in date order, so the tie rule is not a date preference', () => {
    const dates = NOTICES.map(each => Date.parse(each.date));
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).not.toEqual(sorted);
    expect(dates).not.toEqual([...sorted].reverse());
  });

  it('carry a title, a date and a version for every one', () => {
    for (const each of NOTICES) {
      expect(each.title.length, each.id).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(each.date)), each.id).toBe(false);
      expect(each.version, each.id).toBeGreaterThanOrEqual(1);
      expect(each.lines.length, each.id).toBeGreaterThan(0);
    }
    expect(new Set(NOTICES.map(each => each.id)).size).toBe(NOTICES.length);
  });

  it('give the two Saturday notices the same title and different versions', () => {
    expect(notice(CURRENT_NOTICE).title).toBe(notice(OLDER_NOTICE).title);
    expect(notice(CURRENT_NOTICE).version).toBeGreaterThan(notice(OLDER_NOTICE).version);
  });
});
