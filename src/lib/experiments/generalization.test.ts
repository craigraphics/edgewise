import { describe, expect, it } from 'vitest';

import {
  curveAt,
  DATASETS,
  evaluate,
  fitBoth,
  fitCurve,
  INITIAL_DATASET,
  onNewDeliveries,
  scoreOn,
  timesFurther,
  type Delivery,
} from './generalization';
import { fitLine, predictAt } from './regression';

const [USUAL, SPEEDS_UP, CLEAN] = DATASETS;

/**
 * The trap this project has now closed five different ways — the tokenizer by
 * decoding `bpe_ranks` independently, the predictor by checking the
 * least-squares conditions, the representation playground by brute force, the
 * loss panel by hand arithmetic. Here it is closed by interpolation problems
 * whose answers can be worked out on paper.
 */
describe('the close-following curve, against answers worked out by hand', () => {
  it('finds the parabola through three points', () => {
    // p(x) = ax² + bx + c through (0,1), (1,3), (2,9): c = 1, a + b = 2,
    // 4a + 2b = 8, so a = 2, b = 0 — the curve is 2x² + 1.
    const fit = fitCurve([{ distance: 0, minutes: 1 }, { distance: 1, minutes: 3 }, { distance: 2, minutes: 9 }]);
    expect(curveAt(fit, 3)).toBeCloseTo(19, 10);
    expect(curveAt(fit, 0.5)).toBeCloseTo(1.5, 10);
    expect(curveAt(fit, -1)).toBeCloseTo(3, 10);
  });

  it('finds the straight line through two points', () => {
    const fit = fitCurve([{ distance: 2, minutes: 10 }, { distance: 6, minutes: 30 }]);
    expect(curveAt(fit, 4)).toBeCloseTo(20, 10);
    expect(curveAt(fit, 0)).toBeCloseTo(0, 10);
  });

  /**
   * "One clean pattern" is exactly `14 + 3d`. A curve free to bend has no reason
   * to when the deliveries do not, so its answers must be the line's answers —
   * checked against `fitLine`, which is a different implementation.
   */
  it('agrees with the straight line when the deliveries are exactly on one', () => {
    const curve = fitCurve(CLEAN.past);
    const line = fitLine(CLEAN.past);
    for (const distance of [0, 1.25, 4, 7.5, 13, 14]) {
      expect(curveAt(curve, distance)).toBeCloseTo(14 + 3 * distance, 8);
      expect(curveAt(curve, distance)).toBeCloseTo(predictAt(line, distance) as number, 8);
    }
  });

  it('passes through every past delivery it was fitted to', () => {
    for (const dataset of DATASETS) {
      const fit = fitCurve(dataset.past);
      for (const delivery of dataset.past) {
        expect(curveAt(fit, delivery.distance), `${dataset.label} at ${delivery.distance} km`).toBeCloseTo(delivery.minutes, 9);
      }
    }
  });
});

describe('deliveries that cannot determine a curve', () => {
  it('reports the reason instead of inventing one', () => {
    expect(fitCurve([])).toEqual({ status: 'undetermined', reason: 'no-examples' });
    expect(fitCurve([{ distance: 3, minutes: 20 }])).toEqual({ status: 'undetermined', reason: 'one-example' });
    expect(fitCurve([{ distance: 3, minutes: 20 }, { distance: 3, minutes: 40 }]))
      .toEqual({ status: 'undetermined', reason: 'repeated-distance' });
  });

  it('never produces a number from an undetermined fit', () => {
    for (const bad of [[], [{ distance: 3, minutes: 20 }], [{ distance: 3, minutes: 20 }, { distance: 3, minutes: 41 }]] as Delivery[][]) {
      expect(curveAt(fitCurve(bad), 5)).toBeNull();
      const rules = fitBoth(bad);
      expect(rules.curveRule).toBeNull();
    }
  });

  it('never returns NaN over the awkward datasets', () => {
    for (const dataset of DATASETS) {
      const outcome = evaluate(dataset);
      for (const score of [outcome.linePast, outcome.lineFresh, outcome.curvePast, outcome.curveFresh]) {
        expect(score).not.toBeNull();
        for (const value of [...score!.answers, ...score!.misses, score!.meanOff, score!.worstOff]) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

/**
 * The guarantee the panel makes in words, held as a property rather than as a
 * comment: a rule is built from the past deliveries and nothing else, so the
 * held-out ones cannot have influenced it.
 */
describe('the held-out deliveries never reach a rule', () => {
  it('gives identical rules whatever the held-out deliveries say', () => {
    const readings = (fresh: readonly Delivery[]) => {
      const rules = fitBoth(USUAL.past);
      void fresh;
      return [0, 2.5, 7, 13.75].map(d => [rules.lineRule!(d), rules.curveRule!(d)]);
    };
    expect(readings(USUAL.fresh)).toEqual(readings([{ distance: 3.5, minutes: 999 }, { distance: 9, minutes: -50 }]));
  });

  it('scores a rule without being able to change it', () => {
    const rules = fitBoth(USUAL.past);
    const before = [0, 5, 10].map(d => rules.curveRule!(d));
    scoreOn(rules.curveRule!, [{ distance: 4, minutes: 1000 }, { distance: 6, minutes: -1000 }]);
    expect([0, 5, 10].map(d => rules.curveRule!(d))).toEqual(before);
  });
});

describe('each dataset is the case it claims to be', () => {
  it('every held-out delivery sits inside the distances the rules were fitted over', () => {
    for (const dataset of DATASETS) {
      const low = Math.min(...dataset.past.map(d => d.distance));
      const high = Math.max(...dataset.past.map(d => d.distance));
      for (const fresh of dataset.fresh) {
        expect(fresh.distance, `${dataset.label} held out ${fresh.distance} km`).toBeGreaterThan(low);
        expect(fresh.distance).toBeLessThan(high);
      }
    }
  });

  it('never asks about a distance the rules were fitted on', () => {
    for (const dataset of DATASETS) {
      const seen = new Set(dataset.past.map(d => d.distance));
      for (const fresh of dataset.fresh) expect(seen.has(fresh.distance), `${dataset.label}`).toBe(false);
    }
  });

  /** The whole first screen: perfect on the past, worse on the new. */
  it('“The usual deliveries” has the closer fit matching every past delivery and doing worse on new ones', () => {
    const outcome = evaluate(USUAL);
    expect(outcome.curvePast!.allExact).toBe(true);
    expect(outcome.curvePast!.meanOff).toBeLessThan(1e-9);
    expect(outcome.linePast!.allExact).toBe(false);
    expect(outcome.linePast!.meanOff).toBeGreaterThan(1);

    // The line is the worse of the two on the past deliveries and the better of
    // the two on deliveries neither has seen. That reversal is the experiment.
    expect(outcome.linePast!.meanOff).toBeGreaterThan(outcome.curvePast!.meanOff);
    expect(outcome.curveFresh!.meanOff).toBeGreaterThan(outcome.lineFresh!.meanOff);
    expect(onNewDeliveries(outcome)).toBe('line-better');
    expect(timesFurther(outcome)!).toBeGreaterThan(2);
  });

  /** The honesty case. A closer fit is not worse by nature, and here it is better. */
  it('“A road that speeds up” has the closer fit doing better on new deliveries', () => {
    const outcome = evaluate(SPEEDS_UP);
    expect(outcome.curvePast!.allExact).toBe(true);
    expect(outcome.curveFresh!.meanOff).toBeLessThan(outcome.lineFresh!.meanOff);
    expect(onNewDeliveries(outcome)).toBe('curve-better');
    expect(timesFurther(outcome)!).toBeGreaterThan(2);
  });

  it('“One clean pattern” has both rules exact on both sets', () => {
    const outcome = evaluate(CLEAN);
    for (const score of [outcome.linePast, outcome.lineFresh, outcome.curvePast, outcome.curveFresh]) {
      expect(score!.allExact).toBe(true);
    }
    expect(onNewDeliveries(outcome)).toBe('tie');
    // Nothing to be a multiple of when both are exact, and Infinity is not a
    // sentence anybody can read.
    expect(timesFurther(outcome)).toBeNull();
  });

  it('the three datasets do not all say the same thing', () => {
    expect(new Set(DATASETS.map(d => onNewDeliveries(evaluate(d))))).toEqual(new Set(['line-better', 'curve-better', 'tie']));
  });

  it('opens on the case the panel is written about', () => {
    expect(INITIAL_DATASET).toBe(USUAL);
  });

  it('describes the situation without announcing the result', () => {
    for (const dataset of DATASETS) {
      const note = dataset.note.toLowerCase();
      for (const giveaway of ['overfit', 'better', 'worse', 'memoris', 'fails', 'warning']) {
        expect(note, `${dataset.label} note`).not.toContain(giveaway);
      }
    }
  });
});

describe('scoring', () => {
  it('has no average over an empty list, rather than an average of nothing', () => {
    expect(scoreOn(() => 10, [])).toBeNull();
  });

  it('measures how far off, ignoring which side', () => {
    const score = scoreOn(() => 30, [{ distance: 1, minutes: 25 }, { distance: 2, minutes: 35 }])!;
    expect(score.misses).toEqual([5, 5]);
    expect(score.meanOff).toBe(5);
    expect(score.worstOff).toBe(5);
    expect(score.allExact).toBe(false);
  });
});
