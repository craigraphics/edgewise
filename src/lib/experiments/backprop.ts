/**
 * Work backwards through one small chain for the `backprop-intuition` node.
 *
 * The model estimates how much water reaches one plant in ten minutes:
 *
 *   minutes x estimated litres per minute x estimated share for this plant
 *
 * Both settings are deliberately estimates. Nothing here operates a real tap
 * or splitter. The backward pass snapshots one run and calculates the rate at
 * which its error score changes with each setting. Applying that advice is a
 * separate operation, just as backpropagation and a learning step are separate
 * jobs in a real training loop.
 */

export type WateringSettings = {
  litresPerMinute: number;
  plantShare: number;
};

export const RUN_MINUTES = 10;
export const INITIAL_SETTINGS: WateringSettings = { litresPerMinute: 0.5, plantShare: 0.6 };
export const INITIAL_MEASURED_LITRES = 4;
export const MIN_MEASURED_LITRES = 0;
export const MAX_MEASURED_LITRES = 10;
export const LEARNING_STEP = 0.01;
const ZERO_TOLERANCE = 1e-12;

export type BackwardAdvice = {
  /** A copy of the settings used for both gradients. */
  settings: WateringSettings;
  measuredLitres: number;
  minutes: number;
  estimate: number;
  /** estimate - measurement: negative means the estimate was too low. */
  difference: number;
  score: number;
  gradients: WateringSettings;
};

export type LearningStep = {
  advice: BackwardAdvice;
  stepSize: number;
  before: WateringSettings;
  after: WateringSettings;
  estimateBefore: number;
  estimateAfter: number;
  scoreBefore: number;
  scoreAfter: number;
};

export type StepAttempt =
  | { ok: true; step: LearningStep }
  | { ok: false; reason: 'invalid-step' | 'no-change' | 'tap-out-of-range' | 'share-out-of-range' | 'non-finite-result' };

export function wateringEstimate(settings: WateringSettings, minutes = RUN_MINUTES): number {
  return minutes * settings.litresPerMinute * settings.plantShare;
}

/** Half the squared difference, so its rate of change is the plain difference. */
export function errorScore(estimate: number, measuredLitres: number): number {
  const difference = estimate - measuredLitres;
  return 0.5 * difference * difference;
}

export function validMeasuredLitres(value: number | null): value is number {
  return value !== null
    && Number.isFinite(value)
    && value >= MIN_MEASURED_LITRES
    && value <= MAX_MEASURED_LITRES;
}

function validSettings(settings: WateringSettings): boolean {
  return Number.isFinite(settings.litresPerMinute)
    && Number.isFinite(settings.plantShare)
    && settings.litresPerMinute >= 0
    && settings.plantShare >= 0
    && settings.plantShare <= 1;
}

/**
 * Calculate both pieces of advice from one unchanged forward run.
 *
 * For y = minutes * rate * share and 0.5(y - measured)^2:
 *   rate gradient  = (y - measured) * minutes * share
 *   share gradient = (y - measured) * minutes * rate
 *
 * The returned settings are copied so a later learning step cannot accidentally
 * read a half-updated object. Invalid teaching inputs produce no invented result.
 */
export function calculateAdvice(
  settings: WateringSettings,
  measuredLitres: number | null,
  minutes = RUN_MINUTES,
): BackwardAdvice | null {
  if (!validSettings(settings) || !validMeasuredLitres(measuredLitres) || !Number.isFinite(minutes) || minutes <= 0) return null;

  const snapshot = { ...settings };
  const estimate = wateringEstimate(snapshot, minutes);
  const rawDifference = estimate - measuredLitres;
  // Decimal inputs such as 0.5 and 0.6 can leave a sub-picogram binary
  // remainder. In this teaching model a matching measurement must mean exactly
  // zero advice, not an invisible update.
  const difference = Math.abs(rawDifference) < ZERO_TOLERANCE ? 0 : rawDifference;
  const score = 0.5 * difference * difference;
  const gradients = {
    litresPerMinute: difference * minutes * snapshot.plantShare,
    plantShare: difference * minutes * snapshot.litresPerMinute,
  };

  if (![estimate, difference, score, gradients.litresPerMinute, gradients.plantShare].every(Number.isFinite)) return null;

  return {
    settings: snapshot,
    measuredLitres,
    minutes,
    estimate,
    difference,
    score,
    gradients,
  };
}

/**
 * Apply both gradients simultaneously from the advice's frozen settings.
 * A physically impossible rate or share is refused, never silently clamped.
 */
export function applyLearningStep(advice: BackwardAdvice, stepSize = LEARNING_STEP): StepAttempt {
  if (!Number.isFinite(stepSize) || stepSize <= 0) return { ok: false, reason: 'invalid-step' };
  if (advice.difference === 0) return { ok: false, reason: 'no-change' };

  const before = { ...advice.settings };
  const after: WateringSettings = {
    litresPerMinute: before.litresPerMinute - stepSize * advice.gradients.litresPerMinute,
    plantShare: before.plantShare - stepSize * advice.gradients.plantShare,
  };

  if (!Number.isFinite(after.litresPerMinute) || after.litresPerMinute < 0) {
    return { ok: false, reason: 'tap-out-of-range' };
  }
  if (!Number.isFinite(after.plantShare) || after.plantShare < 0 || after.plantShare > 1) {
    return { ok: false, reason: 'share-out-of-range' };
  }

  const estimateAfter = wateringEstimate(after, advice.minutes);
  const scoreAfter = errorScore(estimateAfter, advice.measuredLitres);
  if (!Number.isFinite(estimateAfter) || !Number.isFinite(scoreAfter)) {
    return { ok: false, reason: 'non-finite-result' };
  }
  return {
    ok: true,
    step: {
      advice,
      stepSize,
      before,
      after,
      estimateBefore: advice.estimate,
      estimateAfter,
      scoreBefore: advice.score,
      scoreAfter,
    },
  };
}

export function number(value: number, places = 2): string {
  const rounded = Number(value.toFixed(places));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function litres(value: number): string {
  const shown = Number(value.toFixed(2));
  return `${number(shown)} ${shown === 1 ? 'litre' : 'litres'}`;
}

export function resultSentence(step: LearningStep): string {
  const beforeDistance = Math.abs(step.estimateBefore - step.advice.measuredLitres);
  const afterDistance = Math.abs(step.estimateAfter - step.advice.measuredLitres);
  const comparison = afterDistance < beforeDistance
    ? 'closer to'
    : afterDistance > beforeDistance
      ? 'further from'
      : 'the same distance from';

  return `The estimate moved from ${litres(step.estimateBefore)} to ${litres(step.estimateAfter)}, ${comparison} the ${litres(step.advice.measuredLitres)} we measured.`;
}

export type BackpropExperimentState = {
  settings: WateringSettings;
  measuredLitres: number | null;
  advice: BackwardAdvice | null;
  result: LearningStep | null;
  hasCompletedFirstRun: boolean;
  applyError: Exclude<StepAttempt, { ok: true }>['reason'] | null;
};

export type BackpropExperimentAction =
  | { type: 'work-back' }
  | { type: 'apply' }
  | { type: 'set-measured'; value: number | null }
  | { type: 'reset' };

export function initialBackpropState(): BackpropExperimentState {
  return {
    settings: { ...INITIAL_SETTINGS },
    measuredLitres: INITIAL_MEASURED_LITRES,
    advice: null,
    result: null,
    hasCompletedFirstRun: false,
    applyError: null,
  };
}

/** A small state machine makes Apply an exactly-once transition. */
export function backpropReducer(
  state: BackpropExperimentState,
  action: BackpropExperimentAction,
): BackpropExperimentState {
  if (action.type === 'reset') return initialBackpropState();

  if (action.type === 'set-measured') {
    return {
      ...state,
      settings: { ...INITIAL_SETTINGS },
      measuredLitres: validMeasuredLitres(action.value) ? action.value : null,
      advice: null,
      result: null,
      applyError: null,
    };
  }

  if (action.type === 'work-back') {
    const advice = calculateAdvice(state.settings, state.measuredLitres);
    if (!advice) return state;
    return { ...state, advice, result: null, applyError: null };
  }

  if (!state.advice || state.result) return state;
  const attempt = applyLearningStep(state.advice);
  if (!attempt.ok) return { ...state, applyError: attempt.reason };
  return {
    ...state,
    settings: { ...attempt.step.after },
    result: attempt.step,
    hasCompletedFirstRun: true,
    applyError: null,
  };
}
