/**
 * Two rules fitted to the same past deliveries, for the
 * `generalization-overfitting` node.
 *
 * The node's misconceptions are that a perfect score on the examples is good
 * news, and that overfitting means the model is broken rather than that it
 * learned the wrong thing very well. Neither can be argued away in prose: the
 * only thing that shifts them is watching a rule that matched every past
 * delivery exactly do worse on deliveries it has never seen than a rule that
 * matched none of them exactly.
 *
 * So both rules are really fitted, and both are fitted from the past deliveries
 * alone. `fitLine` and `fitCurve` take a list of deliveries and nothing else —
 * a dataset's held-out `fresh` rows are never in scope inside either. That is
 * the same structural move as `answerWith` in `phases.ts`: "the answers cannot
 * influence the rule" is the shape of the function rather than a promise in a
 * comment.
 *
 * The straight line is the predictor's own least-squares fit, unchanged. This
 * node is about what a fit is worth on unseen data, not about how fitting works.
 */

import { judge } from './loss';
import { fitLine, predictAt, round, type FitResult } from './regression';

/** One delivery: how far the customer was, and how long the food took. */
export type Delivery = { distance: number; minutes: number };

/**
 * A rule that can answer at any distance.
 *
 * Deliberately a plain function of one number. Nothing a rule is asked can hand
 * it more data, so no reading can quietly become a further round of fitting.
 */
export type Rule = (distance: number) => number;

export type CurveFit =
  | { status: 'fitted'; nodes: readonly number[]; coefficients: readonly number[] }
  | { status: 'undetermined'; reason: 'no-examples' | 'one-example' | 'repeated-distance' };

/**
 * The one curve of the right flexibility that passes through every delivery,
 * built by Newton divided differences.
 *
 * Exact interpolation is the point: "nothing off on any past delivery" has to be
 * a fact about the arithmetic rather than a claim in the copy, or the whole
 * panel is asserting the thing it exists to demonstrate.
 *
 * Divided differences rather than solving a Vandermonde system: it is exact for
 * this job, needs no matrix, and cannot quietly return a near-singular answer.
 * Two deliveries at the same distance have no curve through them, and that is
 * reported rather than divided by.
 */
export function fitCurve(deliveries: readonly Delivery[]): CurveFit {
  if (deliveries.length === 0) return { status: 'undetermined', reason: 'no-examples' };
  if (deliveries.length === 1) return { status: 'undetermined', reason: 'one-example' };

  const nodes = deliveries.map(d => d.distance);
  if (new Set(nodes).size !== nodes.length) return { status: 'undetermined', reason: 'repeated-distance' };

  const coefficients = deliveries.map(d => d.minutes);
  for (let order = 1; order < deliveries.length; order += 1) {
    for (let i = deliveries.length - 1; i >= order; i -= 1) {
      coefficients[i] = (coefficients[i] - coefficients[i - 1]) / (nodes[i] - nodes[i - order]);
    }
  }
  return { status: 'fitted', nodes, coefficients };
}

/** The curve read at a distance, by Horner over the Newton form. */
export function curveAt(fit: CurveFit, distance: number): number | null {
  if (fit.status !== 'fitted' || !Number.isFinite(distance)) return null;
  let value = fit.coefficients[fit.coefficients.length - 1];
  for (let i = fit.coefficients.length - 2; i >= 0; i -= 1) {
    value = value * (distance - fit.nodes[i]) + fit.coefficients[i];
  }
  return value;
}

/** How a rule did on a set of deliveries. Nothing here can change the rule. */
export type Score = {
  /** What the rule answered, in the order the deliveries were given. */
  answers: readonly number[];
  /** How far off each answer was, never negative. */
  misses: readonly number[];
  /** The average of those, in minutes. */
  meanOff: number;
  worstOff: number;
  /** Every delivery reproduced to within floating-point noise. */
  allExact: boolean;
  counted: number;
};

/**
 * A rule read at each delivery and compared with what actually happened.
 *
 * `judge` is the how-far-off from the `loss` panel, so the phrase means exactly
 * the same thing on both nodes rather than nearly the same thing.
 */
export function scoreOn(rule: Rule, deliveries: readonly Delivery[]): Score | null {
  if (deliveries.length === 0) return null;
  const answers = deliveries.map(d => rule(d.distance));
  const judgements = deliveries.map((d, i) => judge(answers[i], d.minutes));
  const misses = judgements.map(j => j.off);
  return {
    answers,
    misses,
    meanOff: misses.reduce((sum, off) => sum + off, 0) / misses.length,
    worstOff: misses.reduce((most, off) => Math.max(most, off), 0),
    allExact: judgements.every(j => j.exact),
    counted: deliveries.length,
  };
}

/** Both rules, and how each did on both sets. */
export type Rules = {
  line: FitResult;
  curve: CurveFit;
  lineRule: Rule | null;
  curveRule: Rule | null;
};

/**
 * Fits both rules to the past deliveries.
 *
 * The only argument is the past. A dataset's held-out deliveries cannot reach
 * this function, which is what makes "they were never used to build the rules"
 * checkable rather than trusted.
 */
export function fitBoth(past: readonly Delivery[]): Rules {
  const line = fitLine(past);
  const curve = fitCurve(past);
  return {
    line,
    curve,
    lineRule: line.status === 'fitted' ? (distance: number) => predictAt(line, distance) as number : null,
    curveRule: curve.status === 'fitted' ? (distance: number) => curveAt(curve, distance) as number : null,
  };
}

export type Dataset = {
  label: string;
  /** What the situation is, in the learner's words. Never what the result will be. */
  note: string;
  /** The only deliveries either rule is fitted to. */
  past: readonly Delivery[];
  /** Held back. Both rules answer for these; neither is ever fitted to them. */
  fresh: readonly Delivery[];
};

/**
 * Three datasets, and they are three different answers to the node's question.
 *
 * Each is held to the case it claims in `generalization.test.ts` rather than
 * described here, so editing the numbers later cannot quietly turn "the closer
 * fit does worse" into something that no longer does. Every held-out delivery
 * sits inside the range of distances the rules were fitted over: the failure in
 * the first dataset is genuine overfitting, not a rule being asked about a
 * distance far outside anything it saw.
 */
export const DATASETS: readonly Dataset[] = [
  {
    label: 'The usual deliveries',
    note: 'Five deliveries from last week. One of them, the 8 km order, was held up by a road closure that has since cleared.',
    past: [
      { distance: 2, minutes: 19 },
      { distance: 5, minutes: 26 },
      { distance: 8, minutes: 45 },
      { distance: 11, minutes: 44 },
      { distance: 14, minutes: 53 },
    ],
    fresh: [
      { distance: 3.5, minutes: 23 },
      { distance: 6.5, minutes: 31 },
      { distance: 9.5, minutes: 40 },
      { distance: 12.5, minutes: 48 },
    ],
  },
  {
    label: 'A road that speeds up',
    note: 'Short trips crawl through the town centre; longer ones join a fast road. Time really does not rise in a straight line here.',
    past: [
      { distance: 1, minutes: 18 },
      { distance: 3, minutes: 27 },
      { distance: 6, minutes: 34 },
      { distance: 10, minutes: 39 },
      { distance: 15, minutes: 42 },
    ],
    fresh: [
      { distance: 2, minutes: 23 },
      { distance: 4.5, minutes: 31 },
      { distance: 8, minutes: 37 },
      { distance: 12.5, minutes: 41 },
    ],
  },
  {
    label: 'One clean pattern',
    note: 'A quiet week with nothing unusual in it. Every delivery followed the same pattern exactly.',
    past: [
      { distance: 2, minutes: 20 },
      { distance: 5, minutes: 29 },
      { distance: 8, minutes: 38 },
      { distance: 11, minutes: 47 },
      { distance: 14, minutes: 56 },
    ],
    fresh: [
      { distance: 3.5, minutes: 24.5 },
      { distance: 6.5, minutes: 33.5 },
      { distance: 9.5, minutes: 42.5 },
      { distance: 12.5, minutes: 51.5 },
    ],
  },
];

export const INITIAL_DATASET = DATASETS[0];

/** Everything the panel prints, computed in one place from one dataset. */
export type Outcome = {
  rules: Rules;
  linePast: Score | null;
  lineFresh: Score | null;
  curvePast: Score | null;
  curveFresh: Score | null;
};

export function evaluate(dataset: Dataset): Outcome {
  const rules = fitBoth(dataset.past);
  return {
    rules,
    linePast: rules.lineRule ? scoreOn(rules.lineRule, dataset.past) : null,
    lineFresh: rules.lineRule ? scoreOn(rules.lineRule, dataset.fresh) : null,
    curvePast: rules.curveRule ? scoreOn(rules.curveRule, dataset.past) : null,
    curveFresh: rules.curveRule ? scoreOn(rules.curveRule, dataset.fresh) : null,
  };
}

/**
 * Which rule did better on deliveries neither had seen, at the precision the
 * panel prints. A gap nobody can read on screen is reported as a tie rather
 * than as a difference the learner is then told to look for.
 */
const VISIBLE = 0.05;

export type Verdict = 'line-better' | 'curve-better' | 'tie';

export function onNewDeliveries(outcome: Outcome): Verdict | null {
  const { lineFresh, curveFresh } = outcome;
  if (!lineFresh || !curveFresh) return null;
  const gap = curveFresh.meanOff - lineFresh.meanOff;
  if (Math.abs(gap) < VISIBLE) return 'tie';
  return gap > 0 ? 'line-better' : 'curve-better';
}

/**
 * How many times further off one rule was than the other on the new deliveries.
 *
 * Returned unrounded, for the reason recorded on `timesWorse` in `loss.ts`:
 * rounding here and inverting afterwards prints a ratio that is not the answer.
 * Undefined when the better rule is exact, and said so rather than printed as
 * Infinity.
 */
export function timesFurther(outcome: Outcome): number | null {
  const { lineFresh, curveFresh } = outcome;
  if (!lineFresh || !curveFresh) return null;
  const better = Math.min(lineFresh.meanOff, curveFresh.meanOff);
  const worse = Math.max(lineFresh.meanOff, curveFresh.meanOff);
  if (better < VISIBLE) return null;
  return worse / better;
}

/** The straight line in words. Two unexplained numbers are not a rule anybody can read. */
export function describeLine(fit: FitResult, unit: string): string | null {
  if (fit.status !== 'fitted') return null;
  const rate = round(fit.slope, 2);
  return `Start at ${round(fit.intercept, 1)} minutes, then ${rate < 0 ? 'subtract' : 'add'} ${Math.abs(rate)} minutes for every ${unit}`;
}

export { round };
