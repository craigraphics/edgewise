/**
 * Two rules fitted to the same past phone sales, for the
 * `generalization-overfitting` node.
 *
 * The node's misconceptions are that a perfect score on the examples is good
 * news, and that overfitting means the model is broken rather than that it
 * learned the wrong thing very well. Neither can be argued away in prose: the
 * only thing that shifts them is watching a rule that matched every past sale
 * exactly do worse on sales it was kept from than a rule that matched none of
 * them exactly.
 *
 * So both rules are really fitted, and both are fitted from the past sales
 * alone. `fitLine` and `fitCurve` take a list of sales and nothing else — a
 * dataset's `heldOut` rows are never in scope inside either. That is
 * the same structural move as `answerWith` in `phases.ts`: "the answers cannot
 * influence the rule" is the shape of the function rather than a promise in a
 * comment.
 *
 * The straight line is the predictor's own least-squares fit, unchanged. This
 * node is about what a fit is worth on unseen data, not about how fitting works.
 */

import { judge } from './loss';
import { fitLine, predictAt, round, type FitResult } from './regression';

/** One used-phone sale: the input the rule sees, and the answer it tries to estimate. */
export type PhoneSale = { ageMonths: number; soldFor: number };

/**
 * A rule that can estimate a price at any phone age.
 *
 * Deliberately a plain function of one number. Nothing a rule is asked can hand
 * it more data, so no reading can quietly become a further round of fitting.
 */
export type Rule = (ageMonths: number) => number;

export type CurveFit =
  | { status: 'fitted'; nodes: readonly number[]; coefficients: readonly number[] }
  | { status: 'undetermined'; reason: 'no-examples' | 'one-example' | 'repeated-input' };

/**
 * The one curve of the right flexibility that passes through every sale,
 * built by Newton divided differences.
 *
 * Exact interpolation is the point: "nothing off on any past sale" has to be
 * a fact about the arithmetic rather than a claim in the copy, or the whole
 * panel is asserting the thing it exists to demonstrate.
 *
 * Divided differences rather than solving a Vandermonde system: it is exact for
 * this job, needs no matrix, and cannot quietly return a near-singular answer.
 * Two sales at the same age have no single curve through different prices, and
 * that is reported rather than divided by.
 */
export function fitCurve(sales: readonly PhoneSale[]): CurveFit {
  if (sales.length === 0) return { status: 'undetermined', reason: 'no-examples' };
  if (sales.length === 1) return { status: 'undetermined', reason: 'one-example' };

  const nodes = sales.map(sale => sale.ageMonths);
  if (new Set(nodes).size !== nodes.length) return { status: 'undetermined', reason: 'repeated-input' };

  const coefficients = sales.map(sale => sale.soldFor);
  for (let order = 1; order < sales.length; order += 1) {
    for (let i = sales.length - 1; i >= order; i -= 1) {
      coefficients[i] = (coefficients[i] - coefficients[i - 1]) / (nodes[i] - nodes[i - order]);
    }
  }
  return { status: 'fitted', nodes, coefficients };
}

/** The curve read at a phone age, by Horner over the Newton form. */
export function curveAt(fit: CurveFit, ageMonths: number): number | null {
  if (fit.status !== 'fitted' || !Number.isFinite(ageMonths)) return null;
  let value = fit.coefficients[fit.coefficients.length - 1];
  for (let i = fit.coefficients.length - 2; i >= 0; i -= 1) {
    value = value * (ageMonths - fit.nodes[i]) + fit.coefficients[i];
  }
  return value;
}

/** How a rule did on a set of sales. Nothing here can change the rule. */
export type Score = {
  /** What the rule answered, in the order the sales were given. */
  answers: readonly number[];
  /** How far off each answer was, never negative. */
  misses: readonly number[];
  /** The average of those, in dollars. */
  meanOff: number;
  worstOff: number;
  /** Every sale reproduced to within floating-point noise. */
  allExact: boolean;
  counted: number;
};

/**
 * A rule read at each phone age and compared with its actual sale price.
 *
 * `judge` is the how-far-off from the `loss` panel, so the phrase means exactly
 * the same thing on both nodes rather than nearly the same thing.
 */
export function scoreOn(rule: Rule, sales: readonly PhoneSale[]): Score | null {
  if (sales.length === 0) return null;
  const answers = sales.map(sale => rule(sale.ageMonths));
  const judgements = sales.map((sale, i) => judge(answers[i], sale.soldFor));
  const misses = judgements.map(j => j.off);
  return {
    answers,
    misses,
    meanOff: misses.reduce((sum, off) => sum + off, 0) / misses.length,
    worstOff: misses.reduce((most, off) => Math.max(most, off), 0),
    allExact: judgements.every(j => j.exact),
    counted: sales.length,
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
 * Fits both rules to the past sales.
 *
 * The only argument is the past. A dataset's held-out sales cannot reach this
 * function, which makes "they were never used to build the rules" checkable.
 */
export function fitBoth(past: readonly PhoneSale[]): Rules {
  const line = fitLine(past.map(sale => ({ distance: sale.ageMonths, minutes: sale.soldFor })));
  const curve = fitCurve(past);
  return {
    line,
    curve,
    lineRule: line.status === 'fitted' ? (ageMonths: number) => predictAt(line, ageMonths) as number : null,
    curveRule: curve.status === 'fitted' ? (ageMonths: number) => curveAt(curve, ageMonths) as number : null,
  };
}

export type Dataset = {
  label: string;
  /** What the situation is, in the learner's words. Never what the result will be. */
  note: string;
  /** The only sales either rule is fitted to. */
  past: readonly PhoneSale[];
  /** Kept hidden while fitting. Both rules answer; neither is fitted to these. */
  heldOut: readonly PhoneSale[];
};

/**
 * Three datasets, and they are three different answers to the node's question.
 *
 * Each is held to the case it claims in `generalization.test.ts` rather than
 * described here, so editing the numbers later cannot quietly turn "the closer
 * fit does worse" into something that no longer does. Every held-out sale
 * sits inside the range of ages the rules were fitted over: the failure in the
 * first dataset is genuine overfitting, not a rule being asked about a phone
 * much older or newer than anything it saw.
 */
export const DATASETS: readonly Dataset[] = [
  {
    label: 'One damaged phone',
    note: 'Five past sales. The 30-month-old phone had a cracked screen; the others were in similar condition.',
    past: [
      { ageMonths: 6, soldFor: 650 },
      { ageMonths: 18, soldFor: 555 },
      { ageMonths: 30, soldFor: 300 },
      { ageMonths: 42, soldFor: 365 },
      { ageMonths: 54, soldFor: 270 },
    ],
    heldOut: [
      { ageMonths: 12, soldFor: 605 },
      { ageMonths: 24, soldFor: 510 },
      { ageMonths: 36, soldFor: 415 },
      { ageMonths: 48, soldFor: 320 },
    ],
  },
  {
    label: 'The early price drop',
    note: 'Phones lose value fastest while they are nearly new, then the fall slows. The real pattern bends.',
    past: [
      { ageMonths: 6, soldFor: 760 },
      { ageMonths: 18, soldFor: 590 },
      { ageMonths: 30, soldFor: 480 },
      { ageMonths: 42, soldFor: 410 },
      { ageMonths: 54, soldFor: 370 },
    ],
    heldOut: [
      { ageMonths: 12, soldFor: 665 },
      { ageMonths: 24, soldFor: 530 },
      { ageMonths: 36, soldFor: 440 },
      { ageMonths: 48, soldFor: 387 },
    ],
  },
  {
    label: 'One clean pattern',
    note: 'Every extra year takes exactly $120 from the resale price, with no unusual phones in the examples.',
    past: [
      { ageMonths: 6, soldFor: 760 },
      { ageMonths: 18, soldFor: 640 },
      { ageMonths: 30, soldFor: 520 },
      { ageMonths: 42, soldFor: 400 },
      { ageMonths: 54, soldFor: 280 },
    ],
    heldOut: [
      { ageMonths: 12, soldFor: 700 },
      { ageMonths: 24, soldFor: 580 },
      { ageMonths: 36, soldFor: 460 },
      { ageMonths: 48, soldFor: 340 },
    ],
  },
];

export const INITIAL_DATASET = DATASETS[0];

/** Everything the panel prints, computed in one place from one dataset. */
export type Outcome = {
  rules: Rules;
  linePast: Score | null;
  lineHeldOut: Score | null;
  curvePast: Score | null;
  curveHeldOut: Score | null;
};

export function evaluate(dataset: Dataset): Outcome {
  const rules = fitBoth(dataset.past);
  return {
    rules,
    linePast: rules.lineRule ? scoreOn(rules.lineRule, dataset.past) : null,
    lineHeldOut: rules.lineRule ? scoreOn(rules.lineRule, dataset.heldOut) : null,
    curvePast: rules.curveRule ? scoreOn(rules.curveRule, dataset.past) : null,
    curveHeldOut: rules.curveRule ? scoreOn(rules.curveRule, dataset.heldOut) : null,
  };
}

/**
 * Which rule did better on held-out sales, at the precision the
 * panel prints. A gap nobody can read on screen is reported as a tie rather
 * than as a difference the learner is then told to look for.
 */
const VISIBLE = 0.05;

export type Verdict = 'line-better' | 'curve-better' | 'tie';

export function onHeldOutSales(outcome: Outcome): Verdict | null {
  const { lineHeldOut, curveHeldOut } = outcome;
  if (!lineHeldOut || !curveHeldOut) return null;
  const gap = curveHeldOut.meanOff - lineHeldOut.meanOff;
  if (Math.abs(gap) < VISIBLE) return 'tie';
  return gap > 0 ? 'line-better' : 'curve-better';
}

/**
 * How many times further off one rule was than the other on held-out sales.
 *
 * Returned unrounded, for the reason recorded on `timesWorse` in `loss.ts`:
 * rounding here and inverting afterwards prints a ratio that is not the answer.
 * Undefined when the better rule is exact, and said so rather than printed as
 * Infinity.
 */
export function timesFurther(outcome: Outcome): number | null {
  const { lineHeldOut, curveHeldOut } = outcome;
  if (!lineHeldOut || !curveHeldOut) return null;
  const better = Math.min(lineHeldOut.meanOff, curveHeldOut.meanOff);
  const worse = Math.max(lineHeldOut.meanOff, curveHeldOut.meanOff);
  if (better < VISIBLE) return null;
  return worse / better;
}

/** The straight line in words. Two unexplained numbers are not a rule anybody can read. */
export function describeLine(fit: FitResult): string | null {
  if (fit.status !== 'fitted') return null;
  const rate = round(fit.slope, 2);
  return `About $${round(fit.intercept, 1)} new, then $${Math.abs(rate)} ${rate < 0 ? 'less' : 'more'} per month`;
}

export { round };
