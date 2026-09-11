/**
 * Least-squares straight-line fit, for the `prediction-from-examples` node.
 *
 * The point of the node is that nobody writes the rule down: examples go in and
 * a rule comes out. So this file really fits a line — it never selects a
 * prewritten answer, and every number the panel shows is computed here.
 *
 * We choose the family (one straight line). The examples choose the parameters.
 * That division is the whole lesson, and it is why `fitLine` refuses to guess
 * when the examples cannot pin a line down: a fabricated slope would teach the
 * opposite of what this node exists to teach.
 */

/** One labelled example. `null` means the learner has cleared the field. */
export type ExampleRow = { id: string; distance: number | null; minutes: number | null };
export type Example = { distance: number; minutes: number };

export const MAX_DISTANCE = 60;
export const MAX_MINUTES = 300;
export const MAX_ROWS = 12;
/** Both fields are in the same units everywhere: kilometres in, minutes out. */
export const DISTANCE_UNIT = 'km';
export const MINUTES_UNIT = 'min';

export type Preset = { label: string; note: string; rows: readonly Example[] };

/**
 * Four deterministic datasets. The last three are not decoration: they are the
 * three things a straight line handles differently, reachable in one tap.
 */
export const PRESETS: readonly Preset[] = [
  {
    label: 'Past deliveries',
    note: 'Real-looking observations: close to a line, but never exactly on one.',
    rows: [
      { distance: 2, minutes: 19 },
      { distance: 5, minutes: 26 },
      { distance: 9, minutes: 41 },
      { distance: 14, minutes: 53 },
    ],
  },
  {
    label: 'Exactly on a line',
    note: 'Every observation sits on one rule, so the fit reproduces it with nothing left over.',
    rows: [
      { distance: 1, minutes: 14 },
      { distance: 3, minutes: 22 },
      { distance: 6, minutes: 34 },
      { distance: 10, minutes: 50 },
    ],
  },
  {
    label: 'Two answers for 9 km',
    note: 'The same distance was observed twice with different times. One rule cannot return both.',
    rows: [
      { distance: 2, minutes: 19 },
      { distance: 5, minutes: 26 },
      { distance: 9, minutes: 41 },
      { distance: 9, minutes: 21 },
      { distance: 14, minutes: 53 },
    ],
  },
  {
    label: 'Every trip 5 km',
    note: 'No spread in the input at all, so nothing in the data says how time changes with distance.',
    rows: [
      { distance: 5, minutes: 22 },
      { distance: 5, minutes: 27 },
      { distance: 5, minutes: 24 },
    ],
  },
];

export const INITIAL_PRESET = PRESETS[0];

export type FittedModel = {
  status: 'fitted';
  /** The snapshot the parameters came from, so the panel can say what it was fitted on. */
  examples: readonly Example[];
  /** Minutes added per kilometre. */
  slope: number;
  /** Minutes at zero distance. */
  intercept: number;
  predictions: readonly number[];
  /** observed − predicted, per example, in input order. */
  residuals: readonly number[];
  meanAbsoluteError: number;
  rootMeanSquaredError: number;
  /** Every example reproduced to within floating-point noise. */
  exact: boolean;
};

export type UndeterminedModel = {
  status: 'undetermined';
  examples: readonly Example[];
  /**
   * `no-examples` and `one-example` mean too little data; `no-spread` means the
   * inputs are all the same value, so every slope fits the data equally well.
   */
  reason: 'no-examples' | 'one-example' | 'no-spread';
};

export type FitResult = FittedModel | UndeterminedModel;

/** Rows the learner has filled in completely. Half-typed rows are excluded, not guessed at. */
export function completeExamples(rows: readonly ExampleRow[]): Example[] {
  const done: Example[] = [];
  for (const row of rows) {
    if (row.distance === null || row.minutes === null) continue;
    if (!Number.isFinite(row.distance) || !Number.isFinite(row.minutes)) continue;
    done.push({ distance: row.distance, minutes: row.minutes });
  }
  return done;
}

/**
 * Ordinary least squares in centred form.
 *
 * The centred numerator and denominator are used rather than the textbook
 * `(nΣxy − ΣxΣy)` because that form loses precision badly once the inputs are
 * far from zero, and this panel prints the parameters to the learner.
 */
export function fitLine(examples: readonly Example[]): FitResult {
  if (examples.length === 0) return { status: 'undetermined', examples, reason: 'no-examples' };
  if (examples.length === 1) return { status: 'undetermined', examples, reason: 'one-example' };

  const n = examples.length;
  const meanX = examples.reduce((sum, e) => sum + e.distance, 0) / n;
  const meanY = examples.reduce((sum, e) => sum + e.minutes, 0) / n;

  let spread = 0;
  let covariance = 0;
  let magnitude = 0;
  for (const e of examples) {
    const dx = e.distance - meanX;
    spread += dx * dx;
    covariance += dx * (e.minutes - meanY);
    magnitude += e.distance * e.distance;
  }

  // Identical inputs leave the slope completely undetermined: every line through
  // (meanX, meanY) has the same total error. Returning 0, or a division by a
  // near-zero spread, would invent a relationship the examples never contained.
  if (spread <= Math.max(Number.EPSILON, magnitude * 1e-12)) {
    return { status: 'undetermined', examples, reason: 'no-spread' };
  }

  const slope = covariance / spread;
  const intercept = meanY - slope * meanX;

  const predictions = examples.map(e => intercept + slope * e.distance);
  const residuals = examples.map((e, i) => e.minutes - predictions[i]);
  const meanAbsoluteError = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / n;
  const rootMeanSquaredError = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / n);
  const scale = Math.max(1, ...examples.map(e => Math.abs(e.minutes)));

  return {
    status: 'fitted',
    examples,
    slope,
    intercept,
    predictions,
    residuals,
    meanAbsoluteError,
    rootMeanSquaredError,
    exact: rootMeanSquaredError <= scale * 1e-9,
  };
}

/** The fitted rule read at a new input. Never extrapolated from unfitted data. */
export function predictAt(fit: FitResult | null, distance: number): number | null {
  if (!fit || fit.status !== 'fitted' || !Number.isFinite(distance)) return null;
  return fit.intercept + fit.slope * distance;
}

/**
 * Whether the examples on screen still match the ones the parameters came from.
 *
 * Compared by value, not by row identity: editing a number and putting it back
 * genuinely leaves the fit current, and saying otherwise would be a lie about
 * where the parameters came from.
 */
export function matchesFittedData(rows: readonly ExampleRow[], fit: FitResult | null): boolean {
  if (!fit) return false;
  const current = completeExamples(rows);
  if (current.length !== fit.examples.length) return false;
  return current.every((e, i) => e.distance === fit.examples[i].distance && e.minutes === fit.examples[i].minutes);
}

/** Distances that appear more than once — the reason one rule cannot match everything. */
export function repeatedDistances(examples: readonly Example[]): number[] {
  const counts = new Map<number, number>();
  for (const e of examples) counts.set(e.distance, (counts.get(e.distance) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([distance]) => distance).sort((a, b) => a - b);
}

/** True only when one distance carries two genuinely different observed answers. */
export function hasContradiction(examples: readonly Example[]): boolean {
  const seen = new Map<number, number>();
  for (const e of examples) {
    const first = seen.get(e.distance);
    if (first !== undefined && first !== e.minutes) return true;
    if (first === undefined) seen.set(e.distance, e.minutes);
  }
  return false;
}

/**
 * Display rounding, kept out of the maths so stored parameters stay exact.
 *
 * The magnitude is rounded and the sign put back, because `Math.round` breaks
 * ties towards positive infinity: a miss of −2.45 and one of +2.45 would
 * otherwise print as different sizes beside each other in the same column.
 */
export function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}

export function clampNumber(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}
