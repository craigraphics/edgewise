import { describe, expect, it } from 'vitest';

import {
  answerWith,
  compare,
  describeRule,
  FRESH_ROW_ID,
  initialRows,
  learn,
  learnability,
  PAST_DELIVERIES,
  type Learned,
} from './phases';
import { completeExamples, fitLine, matchesFittedData, type ExampleRow } from './regression';

/** The opening rule, the one the first screen shows as already learned. */
function opening(): Learned {
  const learned = learn(initialRows(), null);
  if (!learned) throw new Error('the opening deliveries must determine a rule');
  return learned;
}

function edit(rows: readonly ExampleRow[], id: string, field: 'distance' | 'minutes', value: number | null): ExampleRow[] {
  return rows.map(row => (row.id === id ? { ...row, [field]: value } : row));
}

describe('the rule the experiment opens with', () => {
  it('is learned from the four past deliveries, not written down', () => {
    const learned = opening();
    const independent = fitLine(PAST_DELIVERIES);
    if (independent.status !== 'fitted') throw new Error('unreachable');
    expect(learned.fit.slope).toBeCloseTo(independent.slope, 12);
    expect(learned.fit.intercept).toBeCloseTo(independent.intercept, 12);
    expect(learned.round).toBe(1);
  });

  /** Guards the dataset itself: editing these numbers later must not leave the first screen ruleless. */
  it('comes from deliveries at more than one distance', () => {
    expect(new Set(PAST_DELIVERIES.map(d => d.distance)).size).toBeGreaterThan(1);
    expect(PAST_DELIVERIES.length).toBeGreaterThanOrEqual(2);
  });

  it('describes itself in words, with the direction the rate actually goes', () => {
    expect(describeRule(opening(), 'km')).toBe('Start at 12.9 minutes, then add 2.92 minutes for every km');
    const falling = learn([
      { id: 'a', distance: 2, minutes: 40 },
      { id: 'b', distance: 8, minutes: 10 },
    ], null);
    expect(describeRule(falling, 'km')).toContain('subtract 5 minutes');
    expect(describeRule(null, 'km')).toBeNull();
  });
});

describe('using the rule', () => {
  /**
   * The claim the whole experiment rests on. Reading the rule at forty different
   * distances must leave it byte-identical, because `answerWith` cannot see the
   * rows and nothing else writes to it.
   */
  it('never changes the rule, however many answers are read out of it', () => {
    const learned = opening();
    const before = JSON.stringify(learned);
    const answers = [];
    for (let distance = 0; distance <= 60; distance += 1.5) answers.push(answerWith(learned, distance));
    expect(JSON.stringify(learned)).toBe(before);
    expect(new Set(answers).size).toBeGreaterThan(1);
  });

  it('reads every answer out of the stored rule, not out of the fields', () => {
    const learned = opening();
    // The deliveries on screen now say something different from the ones it learned from.
    const edited = edit(initialRows(), 'past3', 'minutes', 75);
    const refit = fitLine(completeExamples(edited));
    if (refit.status !== 'fitted') throw new Error('unreachable');

    for (const distance of [0, 3, 7, 12, 40]) {
      expect(answerWith(learned, distance)).toBeCloseTo(learned.fit.intercept + learned.fit.slope * distance, 12);
    }
    // And the stored answer is genuinely the old one, not the edited fields' answer.
    expect(answerWith(learned, 7)).not.toBeCloseTo(refit.intercept + refit.slope * 7, 3);
  });

  it('has no answer before anything has been learned', () => {
    expect(answerWith(null, 7)).toBeNull();
  });
});

describe('learning again', () => {
  it('refuses while the deliveries are the ones it already learned from', () => {
    const learned = opening();
    expect(learnability(initialRows(), learned)).toEqual({ ok: false, reason: 'unchanged' });
    expect(learn(initialRows(), learned)).toBeNull();
  });

  it('is offered the moment a delivery time changes, and moves the rule when taken', () => {
    const learned = opening();
    const edited = edit(initialRows(), 'past3', 'minutes', 75);
    expect(learnability(edited, learned)).toEqual({ ok: true });

    // Editing alone changes nothing: the rule is still the one on screen.
    expect(matchesFittedData(edited, learned.fit)).toBe(false);
    expect(learned.fit.slope).toBeCloseTo(2.9197530864, 8);

    const again = learn(edited, learned);
    expect(again?.round).toBe(2);
    expect(again!.fit.slope).toBeCloseTo(4.6851851851, 8);
    expect(again!.fit.intercept).toBeCloseTo(5.1111111111, 8);
  });

  it('comes back to exactly the same rule when the edit is undone', () => {
    const learned = opening();
    const away = edit(initialRows(), 'past1', 'minutes', 31);
    const back = edit(away, 'past1', 'minutes', PAST_DELIVERIES[1].minutes);
    const detour = learn(away, learned);
    expect(detour).not.toBeNull();
    expect(learnability(back, detour)).toEqual({ ok: true });
    const returned = learn(back, detour);
    expect(returned!.fit.slope).toBeCloseTo(learned.fit.slope, 12);
    expect(returned!.fit.intercept).toBeCloseTo(learned.fit.intercept, 12);
    expect(returned!.round).toBe(3);
  });

  it('counts a delivery it has not seen before, once both of its numbers are there', () => {
    const learned = opening();
    const half = edit(initialRows(), FRESH_ROW_ID, 'distance', 20);
    expect(learnability(half, learned)).toEqual({ ok: false, reason: 'unchanged' });

    const whole = edit(half, FRESH_ROW_ID, 'minutes', 90);
    expect(learnability(whole, learned)).toEqual({ ok: true });
    const again = learn(whole, learned);
    expect(again!.fit.examples).toHaveLength(5);
    expect(again!.fit.slope).toBeGreaterThan(learned.fit.slope);
  });

  /** A rule already in hand is never destroyed by an emptied field. */
  it('refuses, with a reason, when the deliveries left cannot determine a rule', () => {
    const learned = opening();
    const stripped = ['past1', 'past2', 'past3'].reduce((rows, id) => edit(rows, id, 'minutes', null), initialRows());
    expect(learnability(stripped, learned)).toEqual({ ok: false, reason: 'too-few' });
    expect(learn(stripped, learned)).toBeNull();
    expect(answerWith(learned, 7)).toBeCloseTo(33.2901234567, 8);

    const flat: ExampleRow[] = [
      { id: 'a', distance: 5, minutes: 20 },
      { id: 'b', distance: 5, minutes: 30 },
    ];
    expect(learnability(flat, learned)).toEqual({ ok: false, reason: 'no-spread' });
    expect(learn(flat, learned)).toBeNull();
  });
});

describe('comparing the rule before and after', () => {
  it('reads both rules at one distance, and reports which way the answer moved', () => {
    const first = opening();
    const second = learn(edit(initialRows(), 'past3', 'minutes', 75), first)!;
    const later = compare(first, second, 7);
    expect(later).not.toBeNull();
    expect(later!.distance).toBe(7);
    expect(later!.before).toBeCloseTo(33.2901234567, 8);
    expect(later!.after).toBeCloseTo(37.9, 1);
    expect(later!.direction).toBe('later');
    expect(later!.gap).toBeCloseTo(later!.after - later!.before, 12);
    expect(later!.startMoved).toBe(true);
    expect(later!.rateMoved).toBe(true);

    const earlier = compare(second, first, 7);
    expect(earlier!.direction).toBe('earlier');
    expect(earlier!.gap).toBeCloseTo(later!.gap, 12);
  });

  /**
   * Two rules can cross. At the distance where they agree the honest report is
   * that the answer did not move, even though the rule plainly did.
   */
  it('says the answer is the same where two different rules agree', () => {
    const first = opening();
    const second = learn(edit(initialRows(), 'past3', 'minutes', 75), first)!;
    const crossing = (second.fit.intercept - first.fit.intercept) / (first.fit.slope - second.fit.slope);
    const at = compare(first, second, crossing)!;
    expect(at.direction).toBe('same');
    expect(at.gap).toBeLessThan(0.05);
    expect(at.rateMoved).toBe(true);
  });

  it('reports no movement at all when the same rule is compared with itself', () => {
    const learned = opening();
    const same = compare(learned, learned, 12)!;
    expect(same.direction).toBe('same');
    expect(same.startMoved).toBe(false);
    expect(same.rateMoved).toBe(false);
  });
});
