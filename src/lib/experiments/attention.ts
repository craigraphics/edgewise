/**
 * One word's description, rebuilt from the words around it — for the
 * `attention` node.
 *
 * The node's recorded misconceptions are that the model "pays attention to the
 * important words", and that the shares are an explanation of its reasoning.
 * Both survive a diagram of arrows between words: arrows look like choosing,
 * and a thick arrow looks like a reason. So there are no arrows here. There is
 * one word being updated, the earlier words it may use, the proportion each one
 * contributes, and the blend that comes out — every number computed from the
 * descriptions below.
 *
 * This is real single-head causal self-attention with the query, key and value
 * settings left as the identity. That is a deliberate simplification and the
 * panel says so: it makes every number on screen one the learner can check by
 * hand, which is worth more here than showing three matrices nobody would
 * multiply. Real models LEARN those three settings, and they are not this tidy.
 *
 * The descriptions are hand-chosen for this example. They are not learned from
 * anything and must never be read as a view into a real model — the
 * `embeddings` experiment is where the real learned values live.
 */

/**
 * The two columns every description is written in.
 *
 * They are NAMED so the blend can be read, and that is a simplification worth
 * stating rather than hiding: in a real model nobody labels the columns and
 * nothing decides what one means. `docs/words-around-it.md` records the
 * disagreement with the `embeddings` node's authored text; the panel states it
 * under "How it works".
 */
export const COLUMNS = ['outdoors', 'money'] as const;

export type Description = readonly number[];

/**
 * The whole vocabulary. Every word in every sentence has one description, and
 * it is the same description in both sentences — the settings do not move when
 * the sentence does, which is the point of the second sentence.
 *
 * `bank` is deliberately even: on its own it is exactly as much about being
 * outdoors as about money. Nothing but the words around it breaks that tie.
 * The four function words are all-zero, which is honest — they carry nothing
 * this example is measuring — and it is also what makes "equal match, equal
 * share" visible on screen rather than only in a test.
 */
export const VOCABULARY: Readonly<Record<string, Description>> = {
  bank: [1, 1],
  river: [3, 0],
  cash: [0, 3],
  walked: [1, 0],
  took: [0, 1],
  we: [0, 0],
  beside: [0, 0],
  the: [0, 0],
  to: [0, 0],
};

/**
 * The vocabulary in the order the panel lists it: the words that carry
 * something first, the four that carry nothing last, so the table reads as an
 * argument rather than as an alphabetical dump.
 */
export const WORDS: readonly string[] = ['bank', 'river', 'cash', 'walked', 'took', 'we', 'beside', 'the', 'to'];

export type Sentence = {
  id: 'river' | 'money';
  /** The words, in order. Lower case; the panel adds the capital and the stop. */
  words: readonly string[];
  /** What the button that switches TO this sentence says. */
  action: string;
};

export const SENTENCES: readonly Sentence[] = [
  { id: 'river', words: ['we', 'walked', 'beside', 'the', 'river', 'to', 'the', 'bank'], action: 'Back to the river sentence' },
  { id: 'money', words: ['we', 'took', 'cash', 'to', 'the', 'bank'], action: 'Try a money sentence' },
];

export const INITIAL_SENTENCE = SENTENCES[0];

export function sentenceById(id: Sentence['id']): Sentence {
  return SENTENCES.find(sentence => sentence.id === id) ?? INITIAL_SENTENCE;
}

/** "We walked beside the river to the bank." */
export function sentenceText(sentence: Sentence): string {
  const words = sentence.words.join(' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

/**
 * The scale real attention divides its scores by before normalising: the square
 * root of how many numbers are being compared. It is kept because leaving it
 * out would make this arithmetic subtly different from the thing it claims to
 * be, and because it is one line. It is named only under "How it works".
 */
export const SCALE = Math.sqrt(COLUMNS.length);

const dot = (a: Description, b: Description) => a.reduce((total, value, index) => total + value * b[index], 0);

/**
 * Turns match numbers into proportions.
 *
 * The largest is subtracted first. That changes none of the answers — adding a
 * constant to every input leaves the result identical — and it is what stops a
 * large match overflowing `Math.exp` to `Infinity` and printing `NaN` where a
 * proportion should be. A panel about where a number came from cannot afford to
 * print one that came from nowhere.
 */
export function shares(matches: readonly number[]): readonly number[] {
  if (matches.length === 0) return [];
  const largest = Math.max(...matches);
  const weights = matches.map(match => Math.exp(match - largest));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => weight / total);
}

export type Contribution = {
  word: string;
  /** 1-based, as the panel prints it. */
  position: number;
  /** How well this word matches what the target is looking for, after the scale. */
  match: number;
  /** Its proportion of the blend. Never negative, and these always total 1. */
  share: number;
  /** What it actually added to each column: its share times its own description. */
  adds: readonly number[];
};

export type Update = {
  target: string;
  /** 1-based position of the word being updated. */
  position: number;
  /** The target word's own description, before anything around it is used. */
  before: Description;
  /** The blend that comes out. */
  after: Description;
  /** One per word the target may use: earlier positions, and itself. */
  contributions: readonly Contribution[];
  /** The words after the target, which it is not allowed to use. */
  withheld: readonly string[];
  /** The largest contributor, derived — never authored, so no label can disagree. */
  leading: Contribution;
};

/**
 * Rebuild one word's description from the words around it.
 *
 * Causal: the loop runs to `index` and stops. A word later in the sentence is
 * not scored, not weighted and not blended — it is not in scope at all, which
 * is why "it cannot look ahead" is the shape of the function rather than a
 * promise in a comment. The same structural move as `answerWith` in `phases.ts`
 * and `learnFilter` in `junk-filter.ts`.
 */
export function updateAt(words: readonly string[], index: number): Update {
  const target = words[index];
  const query = descriptionOf(target);
  const visible = words.slice(0, index + 1);

  const matches = visible.map(word => dot(query, descriptionOf(word)) / SCALE);
  const proportions = shares(matches);

  const contributions: Contribution[] = visible.map((word, position) => ({
    word,
    position: position + 1,
    match: matches[position],
    share: proportions[position],
    adds: descriptionOf(word).map(value => value * proportions[position]),
  }));

  const after = COLUMNS.map((_, column) => contributions.reduce((total, contribution) => total + contribution.adds[column], 0));

  return {
    target,
    position: index + 1,
    before: query,
    after,
    contributions,
    withheld: words.slice(index + 1),
    leading: contributions.reduce((best, contribution) => (contribution.share > best.share ? contribution : best)),
  };
}

/** The last word of a sentence, which is the one both sentences are about. */
export function updateLast(sentence: Sentence): Update {
  return updateAt(sentence.words, sentence.words.length - 1);
}

/**
 * A word with no description is a bug in the vocabulary, not something to paper
 * over with zeros: a silent zero would be scored, weighted and blended like any
 * other word, and the panel would print a proportion for a word it knows
 * nothing about.
 */
export function descriptionOf(word: string): Description {
  const description = VOCABULARY[word];
  if (!description) throw new Error(`No description for "${word}"`);
  return description;
}

/** Which column leads a description, by name. `null` when they are level. */
export function leadingColumn(description: Description): string | null {
  let best = 0;
  for (let index = 1; index < description.length; index += 1) if (description[index] > description[best]) best = index;
  const level = description.some((amount, index) => index !== best && Math.abs(amount - description[best]) < 1e-9);
  return level ? null : COLUMNS[best];
}

/** 0.428 → "43%". Whole percentages: the panel is not claiming a tenth of one. */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Two decimals everywhere a description is printed, so 1.00 and 0.21 line up. */
export function value(amount: number): string {
  return (Math.abs(amount) < 5e-3 ? 0 : amount).toFixed(2);
}
