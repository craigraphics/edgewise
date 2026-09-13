/**
 * One block of a transformer, run on a five-word note — for the `transformer`
 * node.
 *
 * The node's recorded misconceptions are that a transformer is a new kind of
 * maths rather than a particular arrangement of pieces that were already
 * understood, and that its decisive advantage was raw quality rather than
 * training in parallel. Both survive an architecture poster, which is why there
 * is no diagram of boxes and arrows here. There is one short sentence, one word
 * followed through the block, and two stages that each visibly change its
 * numbers.
 *
 * The node's own `simplificationCost` says position handling is left out of its
 * authored telling: "Attention alone treats a sentence as an unordered bag, so
 * transformers add a separate mechanism to encode word order." That is exactly
 * what this file puts back. Each place has its own small row of numbers, added
 * once before the first block, and `transformer.test.ts` proves the claim
 * rather than asserting it: with the place rows removed, shuffling the earlier
 * words leaves the last word's result byte-identical.
 *
 * WHAT THIS IS. A real single-head causal decoder block in the modern
 * arrangement: rescale a copy, gather from the earlier words, add the result
 * back to what the word already had; then rescale a copy, run it through a
 * small two-layer calculation with a bend in the middle, add that back too.
 * Nothing is faked and nothing is scripted. `runBlocks` runs two of them, and
 * the second one starts from the first one's output.
 *
 * WHAT IT IS NOT. Every number below was chosen by hand — picked from round
 * values so the arithmetic can be checked, and picked so each stage visibly
 * moves the result. Nothing here was learned from any text. It does not
 * understand pets, it produces no words, and it must never be read as a view
 * into a real model. The query, key and value settings are left as the
 * identity, the same deliberate simplification `attention.ts` makes and for the
 * same reason: it keeps every match number checkable against the table above.
 */

/** How many numbers each word's description carries. Real models use hundreds. */
export const NUMBERS = 3;

export type Row = readonly number[];

/**
 * The four words, and the numbers this example gives each of them.
 *
 * They are DELIBERATELY UNNAMED. The `attention` panel names its two columns so
 * the blend can be read, and `docs/words-around-it.md` records the disagreement
 * that creates with the `embeddings` node's authored "nobody decided what any
 * single dimension means". Here the only thing the learner is asked to read is
 * *that* the numbers moved and *when*, so nothing needs a name and no new
 * disagreement is created.
 */
export const WORD_VALUES: Readonly<Record<string, Row>> = {
  the: [0.2, 0.2, 0.2],
  dog: [1.0, 0.0, 0.2],
  cat: [0.0, 1.0, 0.2],
  followed: [0.2, 0.2, 1.0],
};

/** The vocabulary in the order the panel lists it. */
export const WORDS: readonly string[] = ['the', 'dog', 'cat', 'followed'];

/**
 * One row per place in the sentence, added to the word's own row before the
 * first block and never again.
 *
 * This is the whole of the order handling. Attention adds contributions up, and
 * a sum does not depend on the order of its terms, so without these rows the
 * arrangement genuinely cannot tell which word came first — proved in the test
 * by shuffling the earlier words with the places removed and getting the same
 * answer to the last digit.
 */
export const PLACES: readonly Row[] = [
  [0.4, 0.0, 0.0],
  [0.0, 0.4, 0.0],
  [0.0, 0.0, 0.4],
  [-0.4, 0.0, 0.0],
  [0.0, -0.4, 0.0],
];

export type Order = 'dog-first' | 'cat-first';

export type Sentence = {
  id: Order;
  /** The words, in order. Lower case; the panel adds the capital and the stop. */
  words: readonly string[];
  /** What the button that switches TO this order says. */
  action: string;
};

export const SENTENCES: readonly Sentence[] = [
  { id: 'dog-first', words: ['the', 'dog', 'followed', 'the', 'cat'], action: 'Swap back to the dog first' },
  { id: 'cat-first', words: ['the', 'cat', 'followed', 'the', 'dog'], action: 'Swap dog and cat' },
];

export const INITIAL_ORDER: Order = 'dog-first';

export function sentenceById(id: Order): Sentence {
  return SENTENCES.find(sentence => sentence.id === id) ?? SENTENCES[0];
}

/** "The dog followed the cat." */
export function sentenceText(sentence: Sentence): string {
  const words = sentence.words.join(' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

/**
 * The scale real attention divides its match numbers by: the square root of how
 * many numbers are being compared. Kept because leaving it out would make this
 * arithmetic subtly different from the thing it claims to be.
 */
export const SCALE = Math.sqrt(NUMBERS);

/**
 * A word with no row is a bug in the vocabulary, not something to paper over
 * with zeros: a silent zero would be scored, weighted and blended like any
 * other word, and the panel would print a share for a word it knows nothing
 * about. The same refusal as `descriptionOf` in `attention.ts`.
 */
export function wordValues(word: string): Row {
  const values = WORD_VALUES[word];
  if (!values) throw new Error(`No numbers for "${word}"`);
  return values;
}

/** A place beyond the table is refused rather than treated as no place at all. */
export function placeAt(index: number): Row {
  const place = PLACES[index];
  if (!place) throw new Error(`No place numbers for position ${index + 1}`);
  return place;
}

const add = (a: Row, b: Row): Row => a.map((value, index) => value + b[index]);
const dot = (a: Row, b: Row) => a.reduce((total, value, index) => total + value * b[index], 0);

/**
 * The word's own numbers plus its place's, which is where every run starts.
 *
 * Places go in ONCE. The second block starts from the first block's output and
 * does not add them again — asserted in the test, because adding them per block
 * would quietly say the order is re-supplied at every step.
 */
export function startingRows(words: readonly string[]): readonly Row[] {
  return words.map((word, index) => add(wordValues(word), placeAt(index)));
}

/**
 * Rescale one row so its numbers sit around zero at a comparable size.
 *
 * This is layer normalisation with no learned gain or shift. The small amount
 * added under the square root is what stops a row whose numbers are all equal
 * dividing by zero and printing `NaN` where a number should be.
 */
export function normalise(row: Row): Row {
  const mean = row.reduce((total, value) => total + value, 0) / row.length;
  const spread = row.reduce((total, value) => total + (value - mean) ** 2, 0) / row.length;
  const scale = Math.sqrt(spread + 1e-5);
  return row.map(value => (value - mean) / scale);
}

/** The bend. Without it, a stack of these collapses into a single one. */
export const bend = (value: number) => Math.max(0, value);

/**
 * Turns match numbers into shares that total 1.
 *
 * The largest is subtracted first. That changes none of the answers and it is
 * what stops a large match overflowing `Math.exp` to `Infinity`.
 */
export function shares(matches: readonly number[]): readonly number[] {
  if (matches.length === 0) return [];
  const largest = Math.max(...matches);
  const weights = matches.map(match => Math.exp(match - largest));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => weight / total);
}

export type Contribution = {
  /** 1-based, as the panel prints it. */
  position: number;
  /** How much this row overlaps what the target row is looking for, after the scale. */
  match: number;
  /** Its share of the gathered result. Never negative, and these always total 1. */
  share: number;
  /** What it actually put in: its share times its own rescaled row. */
  adds: Row;
};

export type Gather = {
  /** 1-based position of the word being worked on. */
  position: number;
  contributions: readonly Contribution[];
  /** The blend that comes out, before it is added back. */
  gathered: Row;
  /** How many later positions were not in scope at all. */
  ignoredAfter: number;
};

/**
 * Gather from the earlier rows and this one.
 *
 * Causal: the slice runs to `index` and stops. A later position is not scored,
 * not weighted and not blended — it is not in scope, which is why "it cannot use
 * what comes after it" is the shape of the function rather than a promise in a
 * comment. The same structural move as `updateAt` in `attention.ts`,
 * `answerWith` in `phases.ts` and `learnFilter` in `junk-filter.ts`.
 */
export function attendAt(rescaled: readonly Row[], index: number): Gather {
  const visible = rescaled.slice(0, index + 1);
  const query = rescaled[index];
  if (!query) throw new Error(`No row at position ${index + 1}`);

  const matches = visible.map(row => dot(query, row) / SCALE);
  const proportions = shares(matches);
  const contributions = visible.map((row, position) => ({
    position: position + 1,
    match: matches[position],
    share: proportions[position],
    adds: row.map(value => value * proportions[position]),
  }));

  return {
    position: index + 1,
    contributions,
    gathered: query.map((_, column) => contributions.reduce((total, contribution) => total + contribution.adds[column], 0)),
    ignoredAfter: rescaled.length - visible.length,
  };
}

/** The two-layer calculation each position gets, with a bend in the middle. */
export type Calculation = {
  /** Four rows of three, and four nudges: the first layer. */
  first: readonly Row[];
  nudges: readonly number[];
  /** Three rows of four, and three nudges: the second layer. */
  second: readonly Row[];
  finalNudges: Row;
};

export type Worked = {
  /** What came out of the first layer after the bend. Never negative. */
  hidden: readonly number[];
  /** What the calculation produced, before it is added back. */
  worked: Row;
};

/**
 * The same calculation, run on ONE position's row.
 *
 * It takes a single row, so it structurally cannot see another position: "every
 * position gets its own turn through the same calculation" is the signature,
 * not a claim. Same move as `answerWith(learned, distance)` in `phases.ts`.
 */
export function feedForward(row: Row, calculation: Calculation): Worked {
  const hidden = calculation.first.map((weights, index) => bend(dot(weights, row) + calculation.nudges[index]));
  return {
    hidden,
    worked: calculation.second.map((weights, index) => dot(weights, hidden) + calculation.finalNudges[index]),
  };
}

/**
 * Block one's calculation.
 *
 * Round numbers, chosen by hand, and chosen so each stage visibly moves the
 * result. Nothing here was learned from anything.
 */
export const BLOCK_ONE: Calculation = {
  first: [
    [-0.5, 0.5, 0.0],
    [-0.5, 0.0, 0.0],
    [-1.0, 0.0, -1.0],
    [0.5, -0.5, -0.5],
  ],
  nudges: [0.0, 0.5, 0.5, 0.5],
  second: [
    [0.5, -0.5, 1.0, -1.0],
    [-0.5, 0.0, -1.0, 0.5],
    [-0.5, 0.5, -0.5, 0.0],
  ],
  finalNudges: [0.1, -0.1, 0.0],
};

/**
 * Block two's calculation — a DIFFERENT set of numbers.
 *
 * Real models learn a separate set for every block. Reusing one set here would
 * make the second block the same function as the first, which is not what a
 * stack is. Nobody gave this block a different job, though: it is the same two
 * stages with its own numbers, and the panel says so, because "grammar, then
 * meaning, then reasoning" is a story about layers that nobody has earned.
 */
export const BLOCK_TWO: Calculation = {
  first: [
    [-0.5, -1.0, 0.0],
    [0.5, 0.5, -1.0],
    [-1.0, 1.0, 1.0],
    [-1.0, 0.5, 1.0],
  ],
  nudges: [0.0, 0.5, 0.0, 0.5],
  second: [
    [-0.5, -1.0, 0.0, -1.0],
    [-1.0, -1.0, 1.0, 1.0],
    [-1.0, -0.5, 0.5, 0.0],
  ],
  finalNudges: [-0.1, 0.0, 0.1],
};

export type BlockRun = {
  /** What went in. For block two this IS block one's `afterStageTwo`. */
  input: readonly Row[];
  /** Each row rescaled, which is what the gathering stage actually compares. */
  rescaledForGather: readonly Row[];
  gathers: readonly Gather[];
  /** After stage one: the input with what it gathered added back. */
  afterStageOne: readonly Row[];
  /** Each row rescaled again, which is what the calculation actually reads. */
  rescaledForWork: readonly Row[];
  works: readonly Worked[];
  /** After stage two: stage one's rows with the calculation's result added back. */
  afterStageTwo: readonly Row[];
};

/**
 * One whole block: gather, add back; calculate, add back.
 *
 * Every position is done, not only the last one — which is the other half of
 * what a block is, and why the panel can show all five.
 */
export function runBlock(rows: readonly Row[], calculation: Calculation): BlockRun {
  const rescaledForGather = rows.map(normalise);
  const gathers = rows.map((_, index) => attendAt(rescaledForGather, index));
  const afterStageOne = rows.map((row, index) => add(row, gathers[index].gathered));

  const rescaledForWork = afterStageOne.map(normalise);
  const works = rescaledForWork.map(row => feedForward(row, calculation));
  const afterStageTwo = afterStageOne.map((row, index) => add(row, works[index].worked));

  return { input: rows, rescaledForGather, gathers, afterStageOne, rescaledForWork, works, afterStageTwo };
}

/**
 * Two blocks, in order.
 *
 * The second is handed the first's output. The place numbers are not added
 * again, because they were never part of the block — they went into the rows
 * once, before any of this.
 */
export function runBlocks(words: readonly string[]): readonly [BlockRun, BlockRun] {
  const first = runBlock(startingRows(words), BLOCK_ONE);
  return [first, runBlock(first.afterStageTwo, BLOCK_TWO)];
}

/** Two decimals everywhere a number is printed, so 1.00 and 0.21 line up. */
export function value(amount: number): string {
  return (Math.abs(amount) < 5e-3 ? 0 : amount).toFixed(2);
}

/** "0.00 · 0.60 · 0.20" — one row, as the panel prints it. */
export function listValues(row: Row): string {
  return row.map(value).join(' · ');
}

/**
 * Whether a stage moved a row, judged on the UNROUNDED numbers.
 *
 * `same` and `tiny` exist so no sentence can claim a change over two identical
 * printed rows, and so a real change too small to print says so instead of
 * being called nothing. The same rule the one-step-at-a-time panel follows when
 * a real distance is under a hundredth of a minute.
 */
export function movement(before: Row, after: Row): 'same' | 'tiny' | 'moved' {
  const largest = Math.max(...before.map((amount, index) => Math.abs(after[index] - amount)));
  if (largest === 0) return 'same';
  return largest < 5e-3 ? 'tiny' : 'moved';
}

/**
 * 0.428 → "43%". Whole percentages: the panel is not claiming a tenth of one.
 *
 * A share too small to round up to 1% says so rather than printing "0%". Every
 * word a position may use gets a real share, and a printed zero would say one
 * of them was dropped.
 */
export function percent(share: number): string {
  const whole = Math.round(share * 100);
  return whole === 0 && share > 0 ? 'under 1%' : `${whole}%`;
}
