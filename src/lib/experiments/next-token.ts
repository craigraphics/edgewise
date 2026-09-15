/**
 * One piece at a time — for the `next-token-prediction` node.
 *
 * THE QUESTION. "How can choosing one small piece at a time build a whole
 * sentence?"
 *
 * The node's first recorded misconception is the most consequential one in the
 * whole map: "it just predicts the next word, so it cannot really reason." The
 * word doing the damage is "just". So this panel does not argue about capability
 * at all. It makes the loop itself visible — work out chances for the next
 * piece, add the one with the most chance, then work them out AGAIN from the
 * longer text — because somebody who has never seen the loop run has no picture
 * to attach either claim to.
 *
 * WHAT IS REAL HERE. Every number. The chances are counted from the twelve
 * original stories in `STORIES` below, which ship with the experiment and can be
 * read on screen. Nothing is hand-tuned, nothing is prepared, and no request
 * leaves the browser.
 *
 * WHAT IS A TEACHING CHOICE, SAID ON SCREEN.
 *
 *   - One word is one piece. Real tokenizers split words into smaller pieces,
 *     and the `tokens` experiment shows that happening. Words are used here
 *     because a learner can read them.
 *   - Only the last two pieces are looked at. A real model looks at everything
 *     in the request.
 *   - Learning here is counting. A real model nudges millions of numbers so that
 *     the piece which really came next gets more chance. The target is the same;
 *     the machinery is not.
 *   - The highest chance always wins, with a stated tie rule. Choosing at random
 *     among the likely pieces is a different idea and belongs to its own
 *     experiment.
 *
 * WHAT THE CHANCES COVER. Every piece that was ever seen after this ending, and
 * nothing else. They are normalised across that whole set, so a shortlist on
 * screen is a shortlist — the panel prints how much of the chance it is showing
 * rather than quietly rescaling the visible rows to 100%. A piece that never
 * followed this ending gets no chance at all here; a real model always leaves
 * every piece some, however small. Both are stated.
 *
 * THE COUNTS NEVER MOVE. `MODEL` is built once from `STORIES` and every function
 * below takes it as a parameter, so generating text cannot write to it. That is
 * the same structural move as `answerWith(learned, distance)` in `phases.ts`:
 * "using the model does not change it" is the shape of the functions rather than
 * a promise in a comment, and `next-token.test.ts` holds it to that.
 */

/** A word, or the full stop that ends a sentence. */
export type Piece = string;

/** The stop marker. When the model picks this, the sentence is finished. */
export const STOP = '.';

/** As many pieces as one run may add before the panel stops on its own. */
export const MAX_PIECES = 40;

/**
 * How many rows the panel shows before summarising the rest.
 *
 * Every two-piece ending these stories produce has five continuations or fewer,
 * so in practice nothing is hidden and the panel says so. The cap is here so
 * that a fallback onto a very common word cannot render forty rows, and the
 * copy reports the hidden share rather than rescaling the visible rows to 100%.
 */
export const SHORTLIST = 6;

/**
 * The training text: twelve short bedtime stories, written for this experiment.
 *
 * They share a small cast and a lot of phrasing on purpose. A model this simple
 * needs to have seen an ending more than once before it has anything to say
 * about it, and the repetition is what makes the chances on screen interesting
 * rather than a column of 100%.
 */
export const STORIES: readonly string[] = [
  'At night the little fox went down to the river. The little fox drank the cold water and looked at the moon. Then the little fox went home to the warm den and slept.',
  'At night the little owl sat on the old gate. The little owl watched the field and counted the sleepy sheep. Then the little owl flew home to the tall tree and slept.',
  'At night the little mouse made a nest under the old gate. The little mouse found a seed and carried it home. Then the little mouse slept.',
  'By the river the little fox found a smooth stone. The little fox carried the stone home to the warm den.',
  'The little owl called across the quiet field. The sleepy sheep did not wake.',
  'At night the moon rose over the tall tree and the field went quiet.',
  'The little fox and the little owl met by the old gate at night. They looked at the moon together and went home.',
  'In the morning the little mouse woke in the warm nest under the old gate.',
  'At night the little hedgehog crossed the quiet road and went home under the hedge.',
  'The old cat sat by the warm fire and washed her paws. The old cat sat by the window and watched the rain.',
  'In the garden the old cat watched the sleepy sheep in the field beyond the hedge. Then the old cat went home.',
  'At night the old cat found a smooth stone by the gate and left it on the step.',
];

/**
 * Text to pieces.
 *
 * Capitals are removed so that "The" and "the" count as the same piece, which is
 * an ordinary preprocessing choice and is said on screen. The full stop survives
 * as a piece of its own, because the model has to be able to choose to stop.
 */
export function tokenise(text: string): Piece[] {
  return text.toLowerCase().match(/[a-z']+|\./g) ?? [];
}

/** The stories, each as its own stream. Contexts never run across a story. */
export const STREAMS: readonly (readonly Piece[])[] = STORIES.map(tokenise);

type Tally = {
  count: number;
  /** Where this ending-and-piece pair was first met, for the tie rule. */
  firstSeen: number;
};

type Bucket = { total: number; pieces: Map<Piece, Tally> };

export type Model = {
  /** How many pieces of training text there are in total. */
  size: number;
  vocabulary: readonly Piece[];
  /** Keyed by the two-piece ending, then the one-piece ending. */
  two: Map<string, Bucket>;
  one: Map<string, Bucket>;
  /** How often each piece appears anywhere, for the last fallback. */
  any: Bucket;
};

const key = (pieces: readonly Piece[]) => pieces.join(' ');

function tally(bucket: Bucket, piece: Piece, at: number) {
  const seen = bucket.pieces.get(piece);
  if (seen) seen.count += 1;
  else bucket.pieces.set(piece, { count: 1, firstSeen: at });
  bucket.total += 1;
}

function record(buckets: Map<string, Bucket>, ending: string, piece: Piece, at: number) {
  let bucket = buckets.get(ending);
  if (!bucket) {
    bucket = { total: 0, pieces: new Map<Piece, Tally>() };
    buckets.set(ending, bucket);
  }
  tally(bucket, piece, at);
}

/** Counts every ending in the stories. Run once, at module load. */
function build(streams: readonly (readonly Piece[])[]): Model {
  const two = new Map<string, Bucket>();
  const one = new Map<string, Bucket>();
  const any: Bucket = { total: 0, pieces: new Map<Piece, Tally>() };
  let at = 0;

  for (const stream of streams) {
    for (let index = 0; index < stream.length; index += 1) {
      const piece = stream[index];
      tally(any, piece, at);
      if (index >= 1) record(one, key([stream[index - 1]]), piece, at);
      if (index >= 2) record(two, key([stream[index - 2], stream[index - 1]]), piece, at);
      at += 1;
    }
  }

  const vocabulary = [...any.pieces.keys()].sort();
  return { size: at, vocabulary, two, one, any };
}

export const MODEL: Model = build(STREAMS);

/** Which ending the chances were worked out from. */
export type Basis = 'two' | 'one' | 'any';

export type Continuation = {
  piece: Piece;
  count: number;
  /** Share of everything ever seen after this ending. The set sums to 1. */
  chance: number;
};

export type Chances = {
  /** The pieces actually used as the ending — two, one, or none. */
  ending: readonly Piece[];
  basis: Basis;
  /** Every piece ever seen after this ending, most likely first. */
  continuations: readonly Continuation[];
  /** How many times this ending was seen in the stories. */
  observations: number;
  /** True when the two-piece ending was not in the stories and we fell back. */
  fellBack: boolean;
};

function chancesFrom(bucket: Bucket, ending: readonly Piece[], basis: Basis, fellBack: boolean): Chances {
  const continuations = [...bucket.pieces.entries()]
    .map(([piece, tally]) => ({ piece, count: tally.count, chance: tally.count / bucket.total, firstSeen: tally.firstSeen }))
    /*
     * Most likely first. Ties go to the pair this ending met FIRST in the
     * stories — a stable rule that can be stated in one sentence and does not
     * depend on how a full stop sorts against a word. Two runs of the same
     * opening always produce the same sentence.
     */
    .sort((a, b) => b.chance - a.chance || a.firstSeen - b.firstSeen)
    .map(({ piece, count, chance }) => ({ piece, count, chance }));
  return { ending, basis, continuations, observations: bucket.total, fellBack };
}

/**
 * What could come next, given the text so far.
 *
 * The documented fallback: look at the last two pieces; if that ending never
 * appeared in the stories, look at the last one; if that never appeared either,
 * fall back to how often each piece turns up anywhere. The panel says which of
 * the three it used, because "we had never seen this before" is a fact the
 * learner is entitled to.
 */
export function chancesAfter(model: Model, pieces: readonly Piece[]): Chances {
  if (pieces.length >= 2) {
    const ending = pieces.slice(-2);
    const bucket = model.two.get(key(ending));
    if (bucket) return chancesFrom(bucket, ending, 'two', false);
  }
  if (pieces.length >= 1) {
    const ending = pieces.slice(-1);
    const bucket = model.one.get(key(ending));
    if (bucket) return chancesFrom(bucket, ending, 'one', pieces.length >= 2);
  }
  return chancesFrom(model.any, [], 'any', pieces.length >= 1);
}

/** The piece the model would add: most chance, ties as described above. */
export function chooseNext(chances: Chances): Continuation | null {
  return chances.continuations[0] ?? null;
}

export type Step = {
  /** The text before this step, so a step says what it was working from. */
  before: readonly Piece[];
  chances: Chances;
  added: Piece;
  chance: number;
  /** The text after this step. This is what the NEXT step reads. */
  after: readonly Piece[];
  /** True when the piece added was the stop marker. */
  finished: boolean;
};

/**
 * One turn of the loop.
 *
 * It returns the longer text rather than mutating anything, and the panel feeds
 * that straight back in. The test walks a whole sentence and requires each
 * step's `chances.ending` to be the last two pieces of the previous step's
 * `after`, which is the claim the whole experiment rests on: the piece that was
 * added is part of what the next calculation reads.
 */
export function step(model: Model, pieces: readonly Piece[]): Step | null {
  const chances = chancesAfter(model, pieces);
  const choice = chooseNext(chances);
  if (!choice) return null;
  const after = [...pieces, choice.piece];
  return { before: pieces, chances, added: choice.piece, chance: choice.chance, after, finished: choice.piece === STOP };
}

/** True once the sentence has stopped, or the run has gone on long enough. */
export function isFinished(opening: readonly Piece[], pieces: readonly Piece[]): boolean {
  return pieces[pieces.length - 1] === STOP || pieces.length - opening.length >= MAX_PIECES;
}

/** Adds pieces until the sentence stops or the cap is reached. */
export function runToEnd(model: Model, opening: readonly Piece[], pieces: readonly Piece[]): Step[] {
  const steps: Step[] = [];
  let current = pieces;
  while (!isFinished(opening, current) && steps.length < MAX_PIECES) {
    const next = step(model, current);
    if (!next) break;
    steps.push(next);
    current = next.after;
  }
  return steps;
}

/** How much of the total chance the visible rows account for. */
export function shortlistCoverage(chances: Chances, shown: number): number {
  return chances.continuations.slice(0, shown).reduce((total, row) => total + row.chance, 0);
}

export type Opening = {
  id: string;
  label: string;
  text: string;
  /** Why this one is offered, shown beside it. */
  note: string;
};

/**
 * The openings. The first is the one the panel starts on.
 *
 * `unseen` exists to show the fallback happening for real: "brave" is not in the
 * stories at all, so the two-piece ending cannot be found and the model has to
 * drop back to the last piece on its own. That is a genuine limit of counting,
 * and watching it is better than reading about it.
 */
export const OPENINGS: readonly Opening[] = [
  {
    id: 'night',
    label: 'At night the little…',
    text: 'At night the little',
    note: 'The opening this experiment starts from.',
  },
  {
    id: 'garden',
    label: 'In the garden the old…',
    text: 'In the garden the old',
    note: 'A different opening, and a different cast, from the same twelve stories.',
  },
  {
    id: 'unseen',
    label: 'The brave little…',
    text: 'The brave little',
    note: '“brave” is not in the stories at all, so watch the model drop back to a shorter ending.',
  },
];

export const FIRST_OPENING = OPENINGS[0];

/**
 * One real position in one real story, for "How it learned".
 *
 * Both numbers point into `STORIES`, and everything shown is read back out of
 * the training text rather than written down beside it, so editing a story can
 * never leave this section describing a passage that is no longer there.
 *
 * This cut was chosen because the piece that really came next is NOT the one the
 * model would pick. "little fox" is followed by "went" twice and by "drank"
 * once, so the real continuation sits second. A cut where the model already
 * agreed would have shown nothing: the point of the section is that the real
 * piece is what training pushes chance towards, and there has to be somewhere
 * for it to move. `next-token.test.ts` holds the cut to that property.
 */
export const LESSON = { story: 0, cut: 14 } as const;

export type Lesson = {
  /** The real passage, up to the covered piece. */
  before: readonly Piece[];
  /** The piece that really came next in the story. */
  actual: Piece;
  /** The rest of that story, revealed afterwards. */
  after: readonly Piece[];
  /** What the model gives that piece now, from this ending. */
  chances: Chances;
  /** Where the real piece sits in the chances, and what share it has. */
  rank: number;
  chance: number;
};

export function lesson(model: Model, where: { story: number; cut: number } = LESSON): Lesson {
  const stream = STREAMS[where.story];
  const before = stream.slice(0, where.cut);
  const actual = stream[where.cut];
  const chances = chancesAfter(model, before);
  const rank = chances.continuations.findIndex(row => row.piece === actual);
  return {
    before,
    actual,
    after: stream.slice(where.cut + 1),
    chances,
    rank,
    chance: chances.continuations[rank]?.chance ?? 0,
  };
}

/**
 * Pieces back into something readable: no space before a full stop, and a
 * capital at the start of each sentence.
 *
 * The capitals are put back only for reading. The model itself has none — they
 * were folded away so that "The" and "the" count as one piece — and the panel
 * says so. Without this, a run that passes a full stop renders "…the river. the
 * little fox", which reads as a defect in the panel rather than as a property of
 * the model.
 */
export function readable(pieces: readonly Piece[]): string {
  let text = '';
  let capitalise = true;
  for (const piece of pieces) {
    if (piece === STOP) { text += piece; capitalise = true; continue; }
    if (text) text += ' ';
    text += capitalise ? piece.charAt(0).toUpperCase() + piece.slice(1) : piece;
    capitalise = false;
  }
  return text;
}

/** A percentage for the screen. Never prints 0% for something genuinely possible. */
export function percent(chance: number): string {
  if (chance <= 0) return '0%';
  const rounded = Math.round(chance * 1000) / 10;
  return rounded < 0.1 ? 'under 0.1%' : `${rounded}%`;
}
