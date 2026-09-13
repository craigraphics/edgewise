import { describe, expect, it } from 'vitest';

import {
  curveAt,
  DATASETS,
  evaluate,
  fitBoth,
  fitCurve,
  INITIAL_DATASET,
  onHeldOutSales,
  scoreOn,
  timesFurther,
  type PhoneSale,
} from './generalization';
import { fitLine, predictAt } from './regression';

const [DAMAGED, EARLY_DROP, CLEAN] = DATASETS;

/**
 * The trap this project has now closed five different ways — the tokenizer by
 * decoding `bpe_ranks` independently, the predictor by checking the
 * least-squares conditions, the representation playground by brute force, the
 * loss panel by hand arithmetic. Here it is closed by interpolation problems
 * whose answers can be worked out on paper.
 */
describe('the flexible curve, against answers worked out by hand', () => {
  it('finds the parabola through three points', () => {
    // p(x) = ax² + bx + c through (0,1), (1,3), (2,9): c = 1, a + b = 2,
    // 4a + 2b = 8, so a = 2, b = 0 — the curve is 2x² + 1.
    const fit = fitCurve([{ ageMonths: 0, soldFor: 1 }, { ageMonths: 1, soldFor: 3 }, { ageMonths: 2, soldFor: 9 }]);
    expect(curveAt(fit, 3)).toBeCloseTo(19, 10);
    expect(curveAt(fit, 0.5)).toBeCloseTo(1.5, 10);
    expect(curveAt(fit, -1)).toBeCloseTo(3, 10);
  });

  it('finds the straight line through two points', () => {
    const fit = fitCurve([{ ageMonths: 2, soldFor: 10 }, { ageMonths: 6, soldFor: 30 }]);
    expect(curveAt(fit, 4)).toBeCloseTo(20, 10);
    expect(curveAt(fit, 0)).toBeCloseTo(0, 10);
  });

  /**
   * "One clean pattern" is exactly `820 - 10a`. A curve free to bend has no
   * reason to when the sales do not, so its answers must be the line's answers —
   * checked against `fitLine`, which is a different implementation.
   */
  it('agrees with the straight line when the sales are exactly on one', () => {
    const curve = fitCurve(CLEAN.past);
    const line = fitLine(CLEAN.past.map(sale => ({ distance: sale.ageMonths, minutes: sale.soldFor })));
    for (const age of [0, 12, 24, 36, 48, 60]) {
      expect(curveAt(curve, age)).toBeCloseTo(820 - 10 * age, 8);
      expect(curveAt(curve, age)).toBeCloseTo(predictAt(line, age) as number, 8);
    }
  });

  it('passes through every past sale it was fitted to', () => {
    for (const dataset of DATASETS) {
      const fit = fitCurve(dataset.past);
      for (const sale of dataset.past) {
        expect(curveAt(fit, sale.ageMonths), `${dataset.label} at ${sale.ageMonths} months`).toBeCloseTo(sale.soldFor, 9);
      }
    }
  });
});

describe('sales that cannot determine a curve', () => {
  it('reports the reason instead of inventing one', () => {
    expect(fitCurve([])).toEqual({ status: 'undetermined', reason: 'no-examples' });
    expect(fitCurve([{ ageMonths: 3, soldFor: 20 }])).toEqual({ status: 'undetermined', reason: 'one-example' });
    expect(fitCurve([{ ageMonths: 3, soldFor: 20 }, { ageMonths: 3, soldFor: 40 }]))
      .toEqual({ status: 'undetermined', reason: 'repeated-input' });
  });

  it('never produces a number from an undetermined fit', () => {
    const awkward: PhoneSale[][] = [[], [{ ageMonths: 3, soldFor: 20 }], [{ ageMonths: 3, soldFor: 20 }, { ageMonths: 3, soldFor: 41 }]];
    for (const sales of awkward) {
      expect(curveAt(fitCurve(sales), 5)).toBeNull();
      expect(fitBoth(sales).curveRule).toBeNull();
    }
  });

  it('never returns NaN over the three datasets', () => {
    for (const dataset of DATASETS) {
      const outcome = evaluate(dataset);
      for (const score of [outcome.linePast, outcome.lineHeldOut, outcome.curvePast, outcome.curveHeldOut]) {
        expect(score).not.toBeNull();
        for (const value of [...score!.answers, ...score!.misses, score!.meanOff, score!.worstOff]) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

/** The held-out answers cannot influence either fitted rule. */
describe('the held-out sales never reach a rule', () => {
  it('gives identical rules whatever the held-out sales say', () => {
    const readings = (heldOut: readonly PhoneSale[]) => {
      const rules = fitBoth(DAMAGED.past);
      void heldOut;
      return [0, 12, 30, 54].map(age => [rules.lineRule!(age), rules.curveRule!(age)]);
    };
    expect(readings(DAMAGED.heldOut)).toEqual(readings([{ ageMonths: 12, soldFor: 999 }, { ageMonths: 36, soldFor: -50 }]));
  });

  it('scores a rule without being able to change it', () => {
    const rules = fitBoth(DAMAGED.past);
    const before = [0, 24, 48].map(age => rules.curveRule!(age));
    scoreOn(rules.curveRule!, [{ ageMonths: 12, soldFor: 1000 }, { ageMonths: 36, soldFor: -1000 }]);
    expect([0, 24, 48].map(age => rules.curveRule!(age))).toEqual(before);
  });
});

describe('each dataset is the case it claims to be', () => {
  it('keeps every held-out sale inside the phone ages used for fitting', () => {
    for (const dataset of DATASETS) {
      const low = Math.min(...dataset.past.map(sale => sale.ageMonths));
      const high = Math.max(...dataset.past.map(sale => sale.ageMonths));
      for (const heldOut of dataset.heldOut) {
        expect(heldOut.ageMonths, `${dataset.label} held out ${heldOut.ageMonths} months`).toBeGreaterThan(low);
        expect(heldOut.ageMonths).toBeLessThan(high);
      }
    }
  });

  it('never tests a phone age the rules were fitted on', () => {
    for (const dataset of DATASETS) {
      const seen = new Set(dataset.past.map(sale => sale.ageMonths));
      for (const heldOut of dataset.heldOut) expect(seen.has(heldOut.ageMonths), dataset.label).toBe(false);
    }
  });

  /** The whole first screen: perfect on the past, worse on the held-out set. */
  it('“One damaged phone” has the flexible fit matching the past and doing worse when held out', () => {
    const outcome = evaluate(DAMAGED);
    expect(outcome.curvePast!.allExact).toBe(true);
    expect(outcome.curvePast!.meanOff).toBeLessThan(1e-9);
    expect(outcome.linePast!.allExact).toBe(false);
    expect(outcome.linePast!.meanOff).toBeGreaterThan(1);

    expect(outcome.linePast!.meanOff).toBeGreaterThan(outcome.curvePast!.meanOff);
    expect(outcome.curveHeldOut!.meanOff).toBeGreaterThan(outcome.lineHeldOut!.meanOff);
    expect(onHeldOutSales(outcome)).toBe('line-better');
    expect(timesFurther(outcome)!).toBeGreaterThan(2);
  });

  /** The honesty case. A closer fit is not worse by nature, and here it is better. */
  it('“The early price drop” has the flexible fit doing better when held out', () => {
    const outcome = evaluate(EARLY_DROP);
    expect(outcome.curvePast!.allExact).toBe(true);
    expect(outcome.curveHeldOut!.meanOff).toBeLessThan(outcome.lineHeldOut!.meanOff);
    expect(onHeldOutSales(outcome)).toBe('curve-better');
    expect(timesFurther(outcome)!).toBeGreaterThan(2);
  });

  it('“One clean pattern” has both rules exact on both sets', () => {
    const outcome = evaluate(CLEAN);
    for (const score of [outcome.linePast, outcome.lineHeldOut, outcome.curvePast, outcome.curveHeldOut]) {
      expect(score!.allExact).toBe(true);
    }
    expect(onHeldOutSales(outcome)).toBe('tie');
    expect(timesFurther(outcome)).toBeNull();
  });

  it('the three datasets do not all say the same thing', () => {
    expect(new Set(DATASETS.map(dataset => onHeldOutSales(evaluate(dataset))))).toEqual(new Set(['line-better', 'curve-better', 'tie']));
  });

  it('opens on the case the panel is written about', () => {
    expect(INITIAL_DATASET).toBe(DAMAGED);
  });

  it('describes the situation without announcing the result', () => {
    for (const dataset of DATASETS) {
      const note = dataset.note.toLowerCase();
      for (const giveaway of ['overfit', 'better', 'worse', 'memoris', 'fails', 'warning']) {
        expect(note, dataset.label).not.toContain(giveaway);
      }
    }
  });
});

describe('scoring', () => {
  it('has no average over an empty list, rather than an average of nothing', () => {
    expect(scoreOn(() => 10, [])).toBeNull();
  });

  it('measures how far off, ignoring which side', () => {
    const score = scoreOn(() => 30, [{ ageMonths: 1, soldFor: 25 }, { ageMonths: 2, soldFor: 35 }])!;
    expect(score.misses).toEqual([5, 5]);
    expect(score.meanOff).toBe(5);
    expect(score.worstOff).toBe(5);
    expect(score.allExact).toBe(false);
  });
});
