import { describe, expect, it } from 'vitest';

import {
  describeChange,
  fitParams,
  hoursPhrase,
  INITIAL_HOURS,
  INITIAL_RENTAL_SET,
  money,
  parametersOf,
  priceFor,
  RAISED_PER_HOUR,
  RENTAL_SETS,
  ruleSentence,
  SUPPLIED,
  type Params,
  type Rental,
} from './parameters';

/**
 * The expectations here are worked out by hand or by a second route, never by
 * calling the thing under test. Asserting a fit against the function that
 * produced it is the trap the tokenizer closed by decoding `bpe_ranks`
 * independently, the predictor by checking the least-squares conditions, the
 * representation playground by brute force, the loss panel by hand arithmetic,
 * the generalization panel by answers on paper, and the word lists by pinning
 * to the published file. This one closes it with hand arithmetic plus the
 * normal equations, which share none of `fitLine`'s working.
 */

describe('the price on the first screen', () => {
  it('is the two saved numbers and the customer’s hours, and nothing else', () => {
    // $2 to start, $3 an hour, two hours: 2 + 3 × 2 = 8.
    expect(priceFor(SUPPLIED, INITIAL_HOURS)).toBe(8);
  });

  it('is $10 once the price per hour alone goes to $4', () => {
    const raised: Params = { ...SUPPLIED, perHour: RAISED_PER_HOUR };
    expect(priceFor(raised, INITIAL_HOURS)).toBe(10);
    // The customer did not change: the hours going in are the same number.
    expect(INITIAL_HOURS).toBe(2);
  });

  it('computes every hour length from the same two numbers', () => {
    for (const params of [SUPPLIED, { start: 1.5, perHour: 3.4 }, { start: 0, perHour: 0 }]) {
      for (const hours of [0, 0.5, 1, 2, 3.5, 12]) {
        expect(priceFor(params, hours)).toBeCloseTo(params.start + params.perHour * hours, 12);
      }
    }
  });

  it('says the rule in one sentence', () => {
    expect(ruleSentence(SUPPLIED)).toBe('Start at $2, then add $3 for each hour');
    expect(ruleSentence({ start: 1.5, perHour: 3.4 })).toBe('Start at $1.50, then add $3.40 for each hour');
  });
});

describe('the saved numbers', () => {
  it('are two, named, and read in the order the rule uses them', () => {
    expect(parametersOf(SUPPLIED).map(entry => entry.name)).toEqual(['Starting price', 'Price per hour']);
    expect(parametersOf(SUPPLIED).map(entry => entry.value)).toEqual([2, 3]);
  });

  /**
   * The node's first misconception in its own terms. A rule of this shape keeps
   * two numbers; learning from more examples gives it more to fit, not more to
   * keep. The counts below run from the smallest fit there is to a dozen.
   */
  it('stay at two however many past rentals the fit saw', () => {
    for (let count = 2; count <= 12; count += 1) {
      const rentals: Rental[] = Array.from({ length: count }, (_, index) => ({ hours: index + 1, price: 4 + 3 * index }));
      const fit = fitParams(rentals);
      expect(fit.status).toBe('fitted');
      if (fit.status !== 'fitted') return;
      expect(parametersOf(fit.params)).toHaveLength(2);
    }
  });
});

describe('what changed, and which kind of number it was', () => {
  const at = (params: Params, hours: number) => ({ params, hours });

  it('reports a saved number moving while the input stands still', () => {
    const change = describeChange(at(SUPPLIED, 2), at({ ...SUPPLIED, perHour: 4 }, 2));
    expect(change.changed).toBe('parameters');
    expect(change.moved).toEqual(['Price per hour']);
    expect(change.before.price).toBe(8);
    expect(change.after.price).toBe(10);
  });

  it('reports the input moving while the saved numbers stand still', () => {
    const change = describeChange(at(SUPPLIED, 2), at(SUPPLIED, 3));
    expect(change.changed).toBe('input');
    expect(change.moved).toEqual([]);
    expect(change.after.price).toBe(11);
    expect(change.after.params).toEqual(SUPPLIED);
  });

  it('names both saved numbers when a fit replaces them', () => {
    const change = describeChange(at(SUPPLIED, 2), at({ start: 1.5, perHour: 3.4 }, 2));
    expect(change.changed).toBe('parameters');
    expect(change.moved).toEqual(['Starting price', 'Price per hour']);
  });

  it('reports nothing when the numbers come back to where they were', () => {
    const change = describeChange(at(SUPPLIED, 2), at({ ...SUPPLIED }, 2));
    expect(change.changed).toBe('none');
    expect(change.moved).toEqual([]);
  });

  it('reports both when a saved number and the input move together', () => {
    const change = describeChange(at(SUPPLIED, 2), at({ ...SUPPLIED, start: 3 }, 5));
    expect(change.changed).toBe('both');
    expect(change.moved).toEqual(['Starting price']);
  });
});

describe('working the numbers out from past rentals', () => {
  /**
   * Worked on paper. Four rentals at 1, 2, 3 and 4 hours costing $5, $8, $12 and
   * $15: the mean rental is 2.5 hours at $10, the spread of the hours is 5, and
   * the hours and prices vary together by 17. So the price per hour is
   * 17 ÷ 5 = $3.40 and the starting price is 10 − 3.4 × 2.5 = $1.50.
   */
  it('lands on the numbers worked out by hand', () => {
    const fit = fitParams(INITIAL_RENTAL_SET.rentals);
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.params.perHour).toBeCloseTo(3.4, 10);
    expect(fit.params.start).toBeCloseTo(1.5, 10);
  });

  /** Ten rentals, mean 3 hours at $11.70, spread 20, covariation 64: $3.20 and $2.10. */
  it('lands on the hand-worked numbers for the longer set too', () => {
    const fit = fitParams(RENTAL_SETS[1].rentals);
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.params.perHour).toBeCloseTo(3.2, 10);
    expect(fit.params.start).toBeCloseTo(2.1, 10);
  });

  /**
   * The second route. Whatever produced the two numbers, a least-squares fit
   * leaves misses that sum to zero and that do not lean with the hours; nothing
   * in these two sums repeats `fitLine`'s working.
   */
  it('satisfies the conditions a best fit has to satisfy', () => {
    for (const set of [RENTAL_SETS[0], RENTAL_SETS[1]]) {
      const fit = fitParams(set.rentals);
      expect(fit.status).toBe('fitted');
      if (fit.status !== 'fitted') return;
      const misses = set.rentals.map(rental => rental.price - priceFor(fit.params, rental.hours));
      expect(misses.reduce((sum, miss) => sum + miss, 0)).toBeCloseTo(0, 10);
      expect(misses.reduce((sum, miss, index) => sum + miss * set.rentals[index].hours, 0)).toBeCloseTo(0, 10);
    }
  });

  it('reports the rule’s price and miss for each past rental', () => {
    const fit = fitParams(INITIAL_RENTAL_SET.rentals);
    if (fit.status !== 'fitted') throw new Error('expected a fit');
    expect(fit.predictions.map(price => Number(price.toFixed(2)))).toEqual([4.9, 8.3, 11.7, 15.1]);
    expect(fit.misses.map(miss => Number(miss.toFixed(2)))).toEqual([0.1, -0.3, 0.3, -0.1]);
    expect(fit.averageMiss).toBeCloseTo(0.2, 10);
    expect(fit.exact).toBe(false);
  });

  /**
   * Rentals that are all the same length leave the price per hour completely
   * undetermined: every rate fits them equally well. The refusal names the
   * reason instead of dividing by a spread of zero and printing whatever came
   * out.
   */
  it('refuses when every past rental is the same length', () => {
    const fit = fitParams(RENTAL_SETS[2].rentals);
    expect(fit.status).toBe('undetermined');
    if (fit.status !== 'undetermined') return;
    expect(fit.reason).toBe('same-length');
  });

  it('refuses when there is not enough to fit', () => {
    expect(fitParams([])).toMatchObject({ status: 'undetermined', reason: 'not-enough' });
    expect(fitParams([{ hours: 2, price: 8 }])).toMatchObject({ status: 'undetermined', reason: 'not-enough' });
  });

  it('never produces a number that is not a number', () => {
    for (const set of RENTAL_SETS) {
      const fit = fitParams(set.rentals);
      if (fit.status !== 'fitted') continue;
      expect(Number.isFinite(fit.params.start)).toBe(true);
      expect(Number.isFinite(fit.params.perHour)).toBe(true);
      for (const price of fit.predictions) expect(Number.isFinite(price)).toBe(true);
    }
  });

  /**
   * The customer's hours are not in scope where the fit happens, so this is a
   * fact about the shape of the code rather than a promise. The test states it
   * anyway, because the panel makes the claim in words.
   */
  it('gives the same two numbers whatever the customer is asking for', () => {
    const fit = fitParams(INITIAL_RENTAL_SET.rentals);
    if (fit.status !== 'fitted') throw new Error('expected a fit');
    for (const hours of [0, 1, 2, 7.5, 12]) {
      expect(fitParams(INITIAL_RENTAL_SET.rentals)).toEqual(fit);
      // Reading the rule at any hour length leaves the two numbers alone.
      expect(priceFor(fit.params, hours)).toBeCloseTo(fit.params.start + fit.params.perHour * hours, 12);
    }
  });

  it('describes each set honestly', () => {
    expect(RENTAL_SETS[1].rentals.length).toBeGreaterThan(RENTAL_SETS[0].rentals.length);
    expect(new Set(RENTAL_SETS[2].rentals.map(rental => rental.hours)).size).toBe(1);
  });
});

describe('the way numbers are written', () => {
  it('drops pence that are not there', () => {
    expect(money(2)).toBe('$2');
    expect(money(10)).toBe('$10');
    expect(money(1.5)).toBe('$1.50');
    expect(money(3.4)).toBe('$3.40');
    expect(money(8.299999999999999)).toBe('$8.30');
    expect(money(-1.25)).toBe('−$1.25');
  });

  it('counts hours in words that read', () => {
    expect(hoursPhrase(1)).toBe('1 hour');
    expect(hoursPhrase(2)).toBe('2 hours');
    expect(hoursPhrase(0.5)).toBe('0.5 hours');
  });
});
