/**
 * The two numbers a rule keeps, for the `parameters-scale` node.
 *
 * The node's recorded misconceptions are that parameters are stored facts, and
 * that more of them means smarter. Both survive a diagram of a network, because
 * a diagram shows connections rather than what is kept between one customer and
 * the next. So there is no network here and nothing is drawn: a bike rental
 * shop keeps two numbers, a customer brings one, and the price comes out of
 * arithmetic on all three.
 *
 * Three kinds of number are deliberately separate types rather than three
 * fields on one object:
 *
 *   `Params`  what the rule keeps between customers
 *   `hours`   what this customer brought, kept nowhere
 *   `Rental`  a past rental, used only when the numbers are worked out
 *
 * `priceFor(params, hours)` takes the first two and nothing else, and
 * `fitParams(rentals)` takes the third and nothing else. So "using the rule
 * cannot change it" and "the customer's input cannot reach the fit" are the
 * shapes of the functions rather than promises in a comment — the same
 * structural move as `answerWith` in `phases.ts`.
 */

import { fitLine, round, type Example } from './regression';

/** What the rule keeps between customers. Both are in dollars. */
export type Params = { start: number; perHour: number };

/**
 * The two numbers this example opens with. They are supplied for the example,
 * not learned from anything, and the panel says so beside them — the second
 * half of the experiment is where numbers of this shape actually come from.
 */
export const SUPPLIED: Params = { start: 2, perHour: 3 };

/** The first action: the price per hour goes from $3 to $4, and nothing else moves. */
export const RAISED_PER_HOUR = 4;

/** What this customer wants. Not part of the rule, and never saved by it. */
export const INITIAL_HOURS = 2;

export const MAX_DOLLARS = 20;
export const MAX_HOURS = 12;

/**
 * The saved numbers, named, in the order the rule reads them.
 *
 * The count comes from this list rather than from a constant, so "the rule
 * keeps two numbers however many past rentals it saw" is something the panel
 * derives instead of asserting. A straight-line rule has two, and learning from
 * more examples does not add a third.
 */
export function parametersOf(params: Params): readonly { key: keyof Params; name: string; value: number }[] {
  return [
    { key: 'start', name: 'Starting price', value: params.start },
    { key: 'perHour', name: 'Price per hour', value: params.perHour },
  ];
}

/** The whole rule: the two saved numbers, and this customer's hours. */
export function priceFor(params: Params, hours: number): number {
  return params.start + params.perHour * hours;
}

/** "Start at $2, then add $3 for each hour" — the rule as one sentence. */
export function ruleSentence(params: Params): string {
  return `Start at ${money(params.start)}, then add ${money(params.perHour)} for each hour`;
}

/**
 * Dollars, with the cents dropped when there are none: $8, $10, $1.50, $3.40.
 *
 * Written out in full everywhere rather than as a bare number, because the
 * whole panel turns on telling three quantities apart and two of them are
 * prices while the third is a number of hours.
 */
export function money(value: number): string {
  const shown = round(value, 2);
  const sign = shown < 0 ? '−' : '';
  const size = Math.abs(shown);
  return `${sign}$${Number.isInteger(size) ? size : size.toFixed(2)}`;
}

/** Hours, with an "s" when it needs one. */
export function hoursPhrase(hours: number): string {
  const shown = round(hours, 2);
  return `${shown} ${shown === 1 ? 'hour' : 'hours'}`;
}

export type Situation = { params: Params; hours: number };

export type Change = {
  /** Which kind of number moved. `none` when the numbers came back to where they were. */
  changed: 'parameters' | 'input' | 'both' | 'none';
  /** The saved numbers that moved, by their visible names. */
  moved: readonly string[];
  before: Situation & { price: number };
  after: Situation & { price: number };
};

/** Money and hours are both compared at the precision the panel prints. */
const SAME = 5e-3;

/**
 * What changed between two readings, and which kind of number it was.
 *
 * This is the sentence the panel says after every action, so it is worked out
 * from the two situations rather than written next to each control. A control
 * that announces what it was expected to do would still say it on the press
 * that did nothing.
 */
export function describeChange(before: Situation, after: Situation): Change {
  const moved = parametersOf(after.params)
    .filter(entry => Math.abs(entry.value - before.params[entry.key]) >= SAME)
    .map(entry => entry.name);
  const inputMoved = Math.abs(after.hours - before.hours) >= SAME;

  return {
    changed: moved.length && inputMoved ? 'both' : moved.length ? 'parameters' : inputMoved ? 'input' : 'none',
    moved,
    before: { ...before, price: priceFor(before.params, before.hours) },
    after: { ...after, price: priceFor(after.params, after.hours) },
  };
}

/** One past rental at another shop: how long it was, and what it cost. */
export type Rental = { hours: number; price: number };

export type RentalSet = { label: string; note: string; rentals: readonly Rental[] };

/**
 * Three sets of past rentals, and the third is not decoration.
 *
 * The first two differ only in how many rentals they hold — four against ten —
 * because "more examples do not add a third saved number" is the claim this
 * node exists to make, and it is worth being able to see rather than read.
 * The third leaves the price per hour genuinely undetermined, and is reachable
 * in one press.
 */
export const RENTAL_SETS: readonly RentalSet[] = [
  {
    label: 'Four past rentals',
    note: 'Four rentals from another shop, each a different length.',
    rentals: [
      { hours: 1, price: 5 },
      { hours: 2, price: 8 },
      { hours: 3, price: 12 },
      { hours: 4, price: 15 },
    ],
  },
  {
    label: 'Ten past rentals',
    note: 'The same shop, with six more rentals added. More to learn from, and still the same two numbers to keep.',
    rentals: [
      { hours: 1, price: 5 },
      { hours: 1, price: 6 },
      { hours: 2, price: 8 },
      { hours: 2, price: 9 },
      { hours: 3, price: 12 },
      { hours: 3, price: 11 },
      { hours: 4, price: 15 },
      { hours: 4, price: 14 },
      { hours: 5, price: 18 },
      { hours: 5, price: 19 },
    ],
  },
  {
    label: 'Every rental two hours long',
    note: 'Ten rentals would not help here either. Nothing in them shows what one extra hour costs.',
    rentals: [
      { hours: 2, price: 8 },
      { hours: 2, price: 9 },
      { hours: 2, price: 7 },
    ],
  },
];

export const INITIAL_RENTAL_SET = RENTAL_SETS[0];

export type ParamFit =
  | {
      status: 'fitted';
      params: Params;
      /** The past rentals the two numbers came from, and what the rule says about each. */
      rentals: readonly Rental[];
      predictions: readonly number[];
      /** observed − the rule's price, per rental, in order. */
      misses: readonly number[];
      averageMiss: number;
      exact: boolean;
    }
  | {
      status: 'undetermined';
      rentals: readonly Rental[];
      reason: 'not-enough' | 'same-length';
    };

/**
 * The two saved numbers worked out from past rentals, or a refusal.
 *
 * `fitLine` does the arithmetic — the same least-squares fit the predictor
 * experiment uses, on the same two parameters, because this node is about what
 * a fit leaves behind rather than about how fitting works. The refusal matters
 * as much as the fit: rentals that are all the same length leave the price per
 * hour completely undetermined, and inventing one would teach the opposite of
 * a node whose whole subject is what a number actually is.
 */
export function fitParams(rentals: readonly Rental[]): ParamFit {
  const examples: Example[] = rentals.map(rental => ({ distance: rental.hours, minutes: rental.price }));
  const fit = fitLine(examples);

  if (fit.status === 'undetermined') {
    return { status: 'undetermined', rentals, reason: fit.reason === 'no-spread' ? 'same-length' : 'not-enough' };
  }

  return {
    status: 'fitted',
    params: { start: fit.intercept, perHour: fit.slope },
    rentals,
    predictions: fit.predictions,
    misses: fit.residuals,
    averageMiss: fit.meanAbsoluteError,
    exact: fit.exact,
  };
}

export { round };
