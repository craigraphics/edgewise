import { describe, expect, it } from 'vitest';

import {
  completeExamples,
  fitLine,
  hasContradiction,
  matchesFittedData,
  predictAt,
  PRESETS,
  repeatedDistances,
  round,
  type Example,
  type ExampleRow,
} from './regression';

const row = (id: string, distance: number | null, minutes: number | null): ExampleRow => ({ id, distance, minutes });
const line = (slope: number, intercept: number, xs: number[]): Example[] =>
  xs.map(x => ({ distance: x, minutes: intercept + slope * x }));

describe('fitting a line to examples', () => {
  it('recovers a known exact line and leaves nothing over', () => {
    const fit = fitLine(line(4, 10, [1, 3, 6, 10]));
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(4, 12);
    expect(fit.intercept).toBeCloseTo(10, 12);
    expect(fit.rootMeanSquaredError).toBeCloseTo(0, 12);
    expect(fit.meanAbsoluteError).toBeCloseTo(0, 12);
    expect(fit.exact).toBe(true);
    for (const residual of fit.residuals) expect(Math.abs(residual)).toBeLessThan(1e-9);
  });

  it('recovers a negative slope and a line through the origin', () => {
    const down = fitLine(line(-2.5, 40, [0, 4, 8, 12]));
    const origin = fitLine(line(3, 0, [0, 1, 2]));
    expect(down.status === 'fitted' && round(down.slope, 6)).toBe(-2.5);
    expect(down.status === 'fitted' && round(down.intercept, 6)).toBe(40);
    expect(origin.status === 'fitted' && round(origin.intercept, 6)).toBe(0);
    expect(origin.status === 'fitted' && round(origin.slope, 6)).toBe(3);
  });

  it('fits noisy observations close to the line they were built from', () => {
    // The generating rule is 12 + 3d; each observation is nudged off it.
    const noisy: Example[] = [
      { distance: 2, minutes: 19 },
      { distance: 5, minutes: 26 },
      { distance: 9, minutes: 41 },
      { distance: 14, minutes: 53 },
    ];
    const fit = fitLine(noisy);
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(236.5 / 81, 12);
    expect(fit.intercept).toBeCloseTo(34.75 - (236.5 / 81) * 7.5, 12);
    expect(fit.exact).toBe(false);
    expect(fit.rootMeanSquaredError).toBeGreaterThan(0);
    // Every fit must still be the least-squares one: nudging either parameter
    // off the answer can only make the total squared error larger.
    const squared = (slope: number, intercept: number) =>
      noisy.reduce((sum, e) => sum + (e.minutes - (intercept + slope * e.distance)) ** 2, 0);
    const best = squared(fit.slope, fit.intercept);
    for (const [ds, di] of [[0.1, 0], [-0.1, 0], [0, 0.5], [0, -0.5], [0.05, 0.3]]) {
      expect(squared(fit.slope + ds, fit.intercept + di)).toBeGreaterThan(best);
    }
  });

  it('residuals sum to zero and are orthogonal to the input, as least squares requires', () => {
    const fit = fitLine(PRESETS[0].rows);
    if (fit.status !== 'fitted') throw new Error('expected a fit');
    const sum = fit.residuals.reduce((total, r) => total + r, 0);
    const weighted = fit.residuals.reduce((total, r, i) => total + r * fit.examples[i].distance, 0);
    expect(Math.abs(sum)).toBeLessThan(1e-9);
    expect(Math.abs(weighted)).toBeLessThan(1e-9);
  });

  it('predicts from the parameters, not from the example it was handed', () => {
    const fit = fitLine(line(4, 10, [1, 3, 6, 10]));
    expect(predictAt(fit, 0)).toBeCloseTo(10, 9);
    expect(predictAt(fit, 7.5)).toBeCloseTo(40, 9);
    // A distance far outside the examples still reads the same rule.
    expect(predictAt(fit, 100)).toBeCloseTo(410, 9);
    expect(predictAt(null, 5)).toBeNull();
    expect(predictAt(fit, Number.NaN)).toBeNull();
  });
});

describe('the cases a straight line cannot resolve', () => {
  it('gives duplicate inputs one prediction and keeps both misses', () => {
    const contradictory: Example[] = [
      { distance: 2, minutes: 20 },
      { distance: 8, minutes: 50 },
      { distance: 8, minutes: 20 },
    ];
    const fit = fitLine(contradictory);
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    // Both duplicates get the identical prediction, so at least one must miss.
    expect(fit.predictions[1]).toBeCloseTo(fit.predictions[2], 12);
    expect(fit.residuals[1]).toBeCloseTo(-fit.residuals[2], 12);
    expect(Math.abs(fit.residuals[1])).toBeGreaterThan(0);
    expect(fit.exact).toBe(false);
  });

  it('lets a contradictory example move the fitted rule rather than dropping it', () => {
    const base: Example[] = [
      { distance: 2, minutes: 20 },
      { distance: 8, minutes: 50 },
    ];
    const withContradiction = fitLine([...base, { distance: 8, minutes: 20 }]);
    const clean = fitLine(base);
    if (clean.status !== 'fitted' || withContradiction.status !== 'fitted') throw new Error('expected fits');
    expect(withContradiction.slope).not.toBeCloseTo(clean.slope, 6);
    expect(withContradiction.examples).toHaveLength(3);
  });

  it('duplicates that agree are consistent with the line and change nothing else', () => {
    const exact = line(4, 10, [1, 3, 6]);
    const fit = fitLine([...exact, { distance: 3, minutes: 22 }]);
    if (fit.status !== 'fitted') throw new Error('expected a fit');
    expect(fit.slope).toBeCloseTo(4, 9);
    expect(fit.exact).toBe(true);
  });

  it('refuses to invent a slope when there is too little data', () => {
    expect(fitLine([])).toEqual({ status: 'undetermined', examples: [], reason: 'no-examples' });
    const one = fitLine([{ distance: 4, minutes: 20 }]);
    expect(one.status === 'undetermined' && one.reason).toBe('one-example');
  });

  it('refuses to invent a slope when every input is the same', () => {
    const flat = fitLine(PRESETS[3].rows);
    expect(flat.status === 'undetermined' && flat.reason).toBe('no-spread');
    const atZero = fitLine([
      { distance: 0, minutes: 5 },
      { distance: 0, minutes: 9 },
    ]);
    expect(atZero.status === 'undetermined' && atZero.reason).toBe('no-spread');
    expect(predictAt(flat, 10)).toBeNull();
  });

  it('never produces NaN or Infinity, for any of these datasets', () => {
    const datasets: Example[][] = [
      [],
      [{ distance: 0, minutes: 0 }],
      PRESETS.flatMap(preset => [...preset.rows]),
      ...PRESETS.map(preset => [...preset.rows]),
      [{ distance: 1e6, minutes: 1 }, { distance: 1e6 + 1e-6, minutes: 2 }],
      [{ distance: 0, minutes: 0 }, { distance: 0, minutes: 0 }],
    ];
    for (const data of datasets) {
      const fit = fitLine(data);
      if (fit.status !== 'fitted') continue;
      expect(Number.isFinite(fit.slope)).toBe(true);
      expect(Number.isFinite(fit.intercept)).toBe(true);
      expect(Number.isFinite(fit.rootMeanSquaredError)).toBe(true);
      for (const p of fit.predictions) expect(Number.isFinite(p)).toBe(true);
    }
  });

  it('treats inputs that differ only by floating-point noise as no spread', () => {
    const fit = fitLine([
      { distance: 1e6, minutes: 10 },
      { distance: 1e6 + 1e-9, minutes: 40 },
    ]);
    expect(fit.status === 'undetermined' && fit.reason).toBe('no-spread');
  });
});

describe('the data on screen versus the data it was fitted on', () => {
  it('ignores half-typed rows rather than guessing at them', () => {
    const rows = [row('a', 2, 19), row('b', null, 26), row('c', 9, null), row('d', 14, 53)];
    expect(completeExamples(rows)).toEqual([
      { distance: 2, minutes: 19 },
      { distance: 14, minutes: 53 },
    ]);
  });

  it('reports stale the moment a label changes, and current again when it is put back', () => {
    const rows = [row('a', 2, 19), row('b', 5, 26), row('c', 9, 41)];
    const fit = fitLine(completeExamples(rows));
    expect(matchesFittedData(rows, fit)).toBe(true);

    const edited = [row('a', 2, 19), row('b', 5, 30), row('c', 9, 41)];
    expect(matchesFittedData(edited, fit)).toBe(false);
    expect(matchesFittedData([...rows, row('d', 14, 53)], fit)).toBe(false);
    expect(matchesFittedData(rows.slice(0, 2), fit)).toBe(false);
    expect(matchesFittedData(edited.map(r => (r.id === 'b' ? row('b', 5, 26) : r)), fit)).toBe(true);
  });

  it('an incomplete new row does not by itself make the fit stale', () => {
    const rows = [row('a', 2, 19), row('b', 5, 26)];
    const fit = fitLine(completeExamples(rows));
    expect(matchesFittedData([...rows, row('c', null, null)], fit)).toBe(true);
  });

  it('has no fitted data to match before anything has been fitted', () => {
    expect(matchesFittedData([row('a', 2, 19)], null)).toBe(false);
  });
});

describe('naming what makes the data contradictory', () => {
  it('finds repeated distances and distinguishes agreement from contradiction', () => {
    expect(repeatedDistances(PRESETS[2].rows)).toEqual([9]);
    expect(hasContradiction(PRESETS[2].rows)).toBe(true);
    expect(repeatedDistances(PRESETS[0].rows)).toEqual([]);
    expect(hasContradiction(PRESETS[0].rows)).toBe(false);
    const agreeing: Example[] = [
      { distance: 4, minutes: 20 },
      { distance: 4, minutes: 20 },
    ];
    expect(repeatedDistances(agreeing)).toEqual([4]);
    expect(hasContradiction(agreeing)).toBe(false);
  });
});

describe('the presets are the cases they claim to be', () => {
  it('covers an inexact fit, an exact one, a contradiction, and an undetermined fit', () => {
    const [deliveries, exact, contradictory, flat] = PRESETS.map(preset => fitLine(preset.rows));
    expect(deliveries.status === 'fitted' && deliveries.exact).toBe(false);
    expect(exact.status === 'fitted' && exact.exact).toBe(true);
    expect(contradictory.status === 'fitted' && contradictory.exact).toBe(false);
    expect(flat.status).toBe('undetermined');
  });

  it('rounds for display without touching the stored parameters', () => {
    const fit = fitLine(PRESETS[0].rows);
    if (fit.status !== 'fitted') throw new Error('expected a fit');
    expect(round(fit.slope, 2)).toBe(2.92);
    expect(round(fit.intercept, 2)).toBe(12.85);
    expect(fit.slope).not.toBe(2.92);
    expect(round(-2.45, 1)).toBe(-2.5);
    expect(round(0, 2)).toBe(0);
  });
});
