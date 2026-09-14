import { describe, expect, it } from 'vitest';

import {
  applyLearningStep,
  backpropReducer,
  calculateAdvice,
  errorScore,
  INITIAL_MEASURED_LITRES,
  INITIAL_SETTINGS,
  initialBackpropState,
  LEARNING_STEP,
  MAX_MEASURED_LITRES,
  MIN_MEASURED_LITRES,
  resultSentence,
  RUN_MINUTES,
  validMeasuredLitres,
  wateringEstimate,
  type WateringSettings,
} from './backprop';

const canonicalAdvice = () => {
  const advice = calculateAdvice(INITIAL_SETTINGS, INITIAL_MEASURED_LITRES);
  if (!advice) throw new Error('expected canonical advice');
  return advice;
};

describe('the unchanged watering run', () => {
  it('estimates three litres from the two supplied settings', () => {
    expect(wateringEstimate(INITIAL_SETTINGS)).toBeCloseTo(3, 12);
    expect(RUN_MINUTES * 0.5 * 0.6).toBe(3);
  });

  it('scores the one-litre difference with half the squared error', () => {
    expect(errorScore(3, 4)).toBe(0.5);
    expect(errorScore(4, 4)).toBe(0);
    expect(errorScore(5, 4)).toBe(0.5);
  });
});

describe('working backwards', () => {
  it('produces the two named gradients from the same run', () => {
    const advice = canonicalAdvice();
    expect(advice.estimate).toBeCloseTo(3, 12);
    expect(advice.difference).toBeCloseTo(-1, 12);
    expect(advice.gradients.litresPerMinute).toBeCloseTo(-6, 12);
    expect(advice.gradients.plantShare).toBeCloseTo(-5, 12);
    expect(advice.settings).toEqual(INITIAL_SETTINGS);
  });

  it('matches independently measured finite differences for both settings', () => {
    const h = 1e-6;
    for (const measured of [0, 2.5, 4, 7, 10]) {
      const advice = calculateAdvice(INITIAL_SETTINGS, measured);
      if (!advice) throw new Error('expected advice');

      const scoreAt = (settings: WateringSettings) => errorScore(wateringEstimate(settings), measured);
      const measuredTap = (
        scoreAt({ ...INITIAL_SETTINGS, litresPerMinute: INITIAL_SETTINGS.litresPerMinute + h })
        - scoreAt({ ...INITIAL_SETTINGS, litresPerMinute: INITIAL_SETTINGS.litresPerMinute - h })
      ) / (2 * h);
      const measuredShare = (
        scoreAt({ ...INITIAL_SETTINGS, plantShare: INITIAL_SETTINGS.plantShare + h })
        - scoreAt({ ...INITIAL_SETTINGS, plantShare: INITIAL_SETTINGS.plantShare - h })
      ) / (2 * h);

      expect(advice.gradients.litresPerMinute).toBeCloseTo(measuredTap, 5);
      expect(advice.gradients.plantShare).toBeCloseTo(measuredShare, 5);
    }
  });

  it('does not change either supplied setting while calculating advice', () => {
    const settings = { ...INITIAL_SETTINGS };
    const before = structuredClone(settings);
    const advice = calculateAdvice(settings, 4);
    expect(settings).toEqual(before);
    expect(advice?.settings).not.toBe(settings);
    expect(advice?.settings).toEqual(before);
  });

  it('gives zero advice when the estimate already matches', () => {
    const advice = calculateAdvice(INITIAL_SETTINGS, 3);
    expect(advice?.difference).toBe(0);
    expect(advice?.gradients).toEqual({ litresPerMinute: 0, plantShare: 0 });
    if (!advice) throw new Error('expected advice');
    expect(applyLearningStep(advice)).toEqual({ ok: false, reason: 'no-change' });
  });

  it('normalizes an imperceptible floating-point remainder to zero advice', () => {
    const settings = { litresPerMinute: 0.1 + 0.2, plantShare: 1 };
    const advice = calculateAdvice(settings, 3);
    expect(advice?.estimate).not.toBe(3);
    expect(advice?.difference).toBe(0);
    expect(advice?.gradients).toEqual({ litresPerMinute: 0, plantShare: 0 });
  });

  it('rejects empty, out-of-range, and non-finite measurements', () => {
    for (const value of [null, -0.1, 10.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validMeasuredLitres(value)).toBe(false);
      expect(calculateAdvice(INITIAL_SETTINGS, value)).toBeNull();
    }
    expect(validMeasuredLitres(MIN_MEASURED_LITRES)).toBe(true);
    expect(validMeasuredLitres(MAX_MEASURED_LITRES)).toBe(true);
  });
});

describe('one simultaneous learning step', () => {
  it('uses both pre-update gradients and lands on the required result', () => {
    const attempt = applyLearningStep(canonicalAdvice());
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;

    // Both updates use a = 0.5 and b = 0.6. Recomputing the second gradient
    // after changing the first would land somewhere else and fail this check.
    expect(attempt.step.after.litresPerMinute).toBeCloseTo(0.56, 12);
    expect(attempt.step.after.plantShare).toBeCloseTo(0.65, 12);
    expect(attempt.step.estimateAfter).toBeCloseTo(3.64, 12);
    expect(attempt.step.scoreAfter).toBeLessThan(attempt.step.scoreBefore);
    expect(resultSentence(attempt.step)).toBe('The estimate moved from 3 litres to 3.64 litres, closer to the 4 litres we measured.');
  });

  it('keeps every allowed alternative measurement physically meaningful', () => {
    for (let measured = MIN_MEASURED_LITRES; measured <= MAX_MEASURED_LITRES; measured += 0.1) {
      const advice = calculateAdvice(INITIAL_SETTINGS, Number(measured.toFixed(1)));
      if (!advice || advice.difference === 0) continue;
      const attempt = applyLearningStep(advice);
      expect(attempt.ok, `measurement ${measured.toFixed(1)}`).toBe(true);
      if (!attempt.ok) continue;
      expect(attempt.step.after.litresPerMinute).toBeGreaterThanOrEqual(0);
      expect(attempt.step.after.plantShare).toBeGreaterThanOrEqual(0);
      expect(attempt.step.after.plantShare).toBeLessThanOrEqual(1);
      expect(Number.isFinite(attempt.step.estimateAfter)).toBe(true);
    }
  });

  it('refuses bad or physically impossible steps instead of clamping them', () => {
    expect(applyLearningStep(canonicalAdvice(), 0)).toEqual({ ok: false, reason: 'invalid-step' });
    expect(applyLearningStep(canonicalAdvice(), Number.NaN)).toEqual({ ok: false, reason: 'invalid-step' });
    expect(applyLearningStep(canonicalAdvice(), 1)).toEqual({ ok: false, reason: 'share-out-of-range' });

    const lower = calculateAdvice(INITIAL_SETTINGS, 0);
    if (!lower) throw new Error('expected lower advice');
    expect(applyLearningStep(lower, 1)).toEqual({ ok: false, reason: 'tap-out-of-range' });

    const overflow = {
      ...canonicalAdvice(),
      gradients: { litresPerMinute: -Number.MAX_VALUE, plantShare: 0 },
    };
    expect(applyLearningStep(overflow, 0.5)).toEqual({ ok: false, reason: 'non-finite-result' });
  });

  it('uses the fixed teaching step', () => {
    expect(LEARNING_STEP).toBe(0.01);
  });
});

describe('the experiment state machine', () => {
  it('separates advice from applying it', () => {
    const initial = initialBackpropState();
    const advised = backpropReducer(initial, { type: 'work-back' });
    expect(advised.settings).toEqual(INITIAL_SETTINGS);
    expect(advised.advice).not.toBeNull();
    expect(advised.result).toBeNull();

    const applied = backpropReducer(advised, { type: 'apply' });
    expect(applied.settings).toEqual({ litresPerMinute: 0.56, plantShare: 0.65 });
    expect(applied.result?.estimateAfter).toBeCloseTo(3.64, 12);
    expect(applied.hasCompletedFirstRun).toBe(true);
  });

  it('applies at most once even when Apply is dispatched repeatedly', () => {
    const advised = backpropReducer(initialBackpropState(), { type: 'work-back' });
    const applied = backpropReducer(advised, { type: 'apply' });
    expect(backpropReducer(applied, { type: 'apply' })).toBe(applied);
  });

  it('does nothing when applying before advice', () => {
    const initial = initialBackpropState();
    expect(backpropReducer(initial, { type: 'apply' })).toBe(initial);
  });

  it('starts another measurement from the same supplied settings', () => {
    const advised = backpropReducer(initialBackpropState(), { type: 'work-back' });
    const applied = backpropReducer(advised, { type: 'apply' });
    const changed = backpropReducer(applied, { type: 'set-measured', value: 6 });
    expect(changed.settings).toEqual(INITIAL_SETTINGS);
    expect(changed.measuredLitres).toBe(6);
    expect(changed.advice).toBeNull();
    expect(changed.result).toBeNull();
    expect(changed.hasCompletedFirstRun).toBe(true);
  });

  it('holds an empty measurement without inventing zero', () => {
    const changed = backpropReducer(initialBackpropState(), { type: 'set-measured', value: null });
    expect(changed.measuredLitres).toBeNull();
    expect(backpropReducer(changed, { type: 'work-back' })).toBe(changed);
  });

  it('turns invalid measurements into an empty state that cannot produce advice', () => {
    for (const value of [-0.1, 10.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const changed = backpropReducer(initialBackpropState(), { type: 'set-measured', value });
      expect(changed.measuredLitres).toBeNull();
      expect(backpropReducer(changed, { type: 'work-back' })).toBe(changed);
    }
  });

  it('reset restores the exact opening state', () => {
    const advised = backpropReducer(initialBackpropState(), { type: 'work-back' });
    const applied = backpropReducer(advised, { type: 'apply' });
    expect(backpropReducer(applied, { type: 'reset' })).toEqual(initialBackpropState());
  });
});
