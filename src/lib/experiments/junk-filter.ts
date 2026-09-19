/**
 * A small junk-mail filter, for the `train-test-split` node.
 *
 * The node's misconceptions are that holding data back is paperwork rather than
 * the only defence against fooling yourself, and that a held-out set stays a
 * fair test however many times you tune against it. Neither shifts by being
 * asserted. What shifts them is doing the three steps in order and watching the
 * third number disagree with the second.
 *
 * So the filter really learns. `learnFilter` takes a list of example messages
 * and nothing else, and the score of a message is exactly the total of its
 * known words' learned scores. No button carries a prepared answer.
 *
 * The structural guarantee is the same move as `answerWith` in `phases.ts` and
 * `fitBoth` in `generalization.ts`: a group that must not influence something
 * is not in scope where that thing is made. `learnFilter` cannot see the
 * choosing group or the final group; `runOn` takes a finished filter and can
 * only read it.
 */

/** What a message actually is. The filter never sees this for the final group until asked. */
export type Truth = 'junk' | 'wanted';

export type Message = {
  /** Stable across every render and every group. Ids are how a row is followed. */
  id: string;
  text: string;
  truth: Truth;
};

/**
 * The three groups, in the order they are allowed to be used.
 *
 * `learn` supplies the answers the word scores are built from. `choose` is read
 * to pick how cautious the filter should be — it influences a setting, not the
 * word scores. `final` is not opened until both of those are finished.
 */
export type MessageSet = {
  label: string;
  /** The situation, in the learner's words. Never what the result will be. */
  note: string;
  learn: readonly Message[];
  choose: readonly Message[];
  final: readonly Message[];
};

/**
 * The words of a message: lower case, apostrophes kept inside a word, every
 * other punctuation mark dropped. Deliberately the simplest thing that can be
 * described in one sentence to somebody reading the panel.
 */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/** The distinct words of a message, in the order they first appear. */
export function distinctWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of wordsOf(text)) {
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

export type Filter = {
  /** One learned score per word seen in the examples. Above zero leans junk. */
  scores: ReadonlyMap<string, number>;
  junkExamples: number;
  wantedExamples: number;
};

export type Learned =
  | { status: 'learned'; filter: Filter }
  | { status: 'not-enough'; reason: 'no-examples' | 'no-junk' | 'no-wanted' };

/**
 * The learned word scores.
 *
 * For each word: how often it turned up in junk examples against how often it
 * turned up in wanted ones, as a log ratio, counted once per message rather
 * than once per repeat. One added to each count so a word that appears only on
 * one side gets a large score rather than an infinite one.
 *
 * Refusing beats guessing. With no junk examples, or no wanted ones, every word
 * would lean the one way there is, and the filter would call everything junk or
 * nothing junk while looking like it had learned something. That is reported
 * with its reason instead, for the same recorded reason as `learnability` in
 * `phases.ts`.
 */
export function learnFilter(examples: readonly Message[]): Learned {
  if (examples.length === 0) return { status: 'not-enough', reason: 'no-examples' };

  const junk = examples.filter(message => message.truth === 'junk');
  const wanted = examples.filter(message => message.truth === 'wanted');
  if (junk.length === 0) return { status: 'not-enough', reason: 'no-junk' };
  if (wanted.length === 0) return { status: 'not-enough', reason: 'no-wanted' };

  const count = (group: readonly Message[]) => {
    const tally = new Map<string, number>();
    for (const message of group) {
      for (const word of distinctWords(message.text)) tally.set(word, (tally.get(word) ?? 0) + 1);
    }
    return tally;
  };

  const inJunk = count(junk);
  const inWanted = count(wanted);
  const scores = new Map<string, number>();
  for (const word of new Set([...inJunk.keys(), ...inWanted.keys()])) {
    const junkRate = ((inJunk.get(word) ?? 0) + 1) / (junk.length + 2);
    const wantedRate = ((inWanted.get(word) ?? 0) + 1) / (wanted.length + 2);
    scores.set(word, Math.log(junkRate / wantedRate));
  }

  return { status: 'learned', filter: { scores, junkExamples: junk.length, wantedExamples: wanted.length } };
}

/** One word of a message, with the score it contributed. Unknown words contribute nothing. */
export type WordScore = { word: string; score: number | null };

export function wordScores(filter: Filter, text: string): WordScore[] {
  return distinctWords(text).map(word => ({ word, score: filter.scores.get(word) ?? null }));
}

/**
 * A message's junk score: the total of its known words' scores.
 *
 * Words the examples never contained count nothing, which is both the honest
 * thing and the one-sentence explanation. Nothing else is added — no built-in
 * assumption about how common junk is. How much leaning is enough is the bar
 * below, which is the setting the middle group exists to choose.
 */
export function scoreMessage(filter: Filter, text: string): number {
  return wordScores(filter, text).reduce((total, part) => total + (part.score ?? 0), 0);
}

/**
 * How cautious the filter is about calling something junk, as the bar a
 * message's score has to clear.
 *
 * Two settings, not a slider: the point is that one choice has to be made using
 * examples whose answers we are willing to spend, and a slider invites the
 * sweep that turns the middle group into training data.
 */
export type CautionId = 'careful' | 'quick';

export type Caution = {
  id: CautionId;
  label: string;
  blurb: string;
  bar: number;
};

export const CAUTIONS: readonly Caution[] = [
  { id: 'careful', label: 'Only when it is sure', blurb: 'Call it junk only when the words point strongly that way.', bar: 1.5 },
  { id: 'quick', label: 'As soon as it leans that way', blurb: 'Call it junk as soon as the words lean that way at all.', bar: 0 },
];

export const INITIAL_CAUTION: CautionId = 'careful';

export function cautionById(id: CautionId): Caution {
  return CAUTIONS.find(caution => caution.id === id) ?? CAUTIONS[0];
}

/** What the filter did with one message. */
export type Row = {
  id: string;
  text: string;
  truth: Truth;
  score: number;
  called: Truth;
  /** The filter's answer matched what the message actually was. */
  agrees: boolean;
};

export type Outcome = {
  rows: readonly Row[];
  junkTotal: number;
  /** Junk messages the filter called junk. */
  junkCaught: number;
  wantedTotal: number;
  /** Messages you wanted that the filter called junk. The expensive mistake. */
  wantedHidden: number;
};

/**
 * The filter read over a group of messages.
 *
 * It takes a finished filter. There is no path from here back into the word
 * scores, so reading a group — any group — cannot be a further round of
 * learning.
 */
export function runOn(filter: Filter, messages: readonly Message[], bar: number): Outcome {
  const rows: Row[] = messages.map(message => {
    const score = scoreMessage(filter, message.text);
    const called: Truth = score > bar ? 'junk' : 'wanted';
    return { id: message.id, text: message.text, truth: message.truth, score, called, agrees: called === message.truth };
  });
  return {
    rows,
    junkTotal: rows.filter(row => row.truth === 'junk').length,
    junkCaught: rows.filter(row => row.truth === 'junk' && row.called === 'junk').length,
    wantedTotal: rows.filter(row => row.truth === 'wanted').length,
    wantedHidden: rows.filter(row => row.truth === 'wanted' && row.called === 'junk').length,
  };
}

/**
 * What happened, in one sentence, built from the counts.
 *
 * "It caught the junk, but also hid a message you wanted" is only ever printed
 * when both halves of it are true, because both halves are read off the same
 * outcome that produced the rows on screen.
 */
export function describeOutcome(outcome: Outcome): string {
  const { junkCaught, junkTotal, wantedHidden, wantedTotal } = outcome;

  const every = junkTotal === 1 ? 'the junk message' : junkTotal === 2 ? 'both junk messages' : `all ${junkTotal} junk messages`;
  const caught = junkTotal === 0
    ? 'There was no junk in this group'
    : junkCaught === junkTotal
      ? `It caught ${every}`
      : junkCaught === 0
        ? `It caught none of the ${junkTotal} junk messages`
        : `It caught ${junkCaught} of the ${junkTotal} junk messages`;

  // "It caught ..." carries its own subject into the second clause; "There was
  // no junk in this group" does not, so that branch says "it" again.
  const subject = junkTotal === 0 ? 'it ' : '';
  const hid = wantedTotal === 0
    ? ''
    : wantedHidden === 0
      ? `, and ${subject}hid nothing you wanted`
      : `, but ${junkTotal === 0 ? 'it ' : 'also '}hid ${wantedHidden === 1 ? 'a message' : `${wantedHidden} messages`} you wanted`;

  return `${caught}${hid}.`;
}

/** Every message the filter got wrong, either way round. */
export function mistakes(outcome: Outcome): number {
  return (outcome.junkTotal - outcome.junkCaught) + outcome.wantedHidden;
}

/**
 * The two groups compared at one setting.
 *
 * Both are read at the same caution, so the cause of any difference cannot be
 * the setting. Rates rather than counts, because the groups are not promised to
 * be the same size and a count would quietly compare four messages with six.
 *
 * This is the whole point of the panel: the middle group is what the setting
 * was chosen on, so it flatters that setting. The saved messages are the first
 * reading that was not used to make any decision.
 */
export type Comparison = {
  mistakesWhenChoosing: number;
  mistakesOnFinal: number;
  /** It hid more of the mail you wanted on the saved messages than when choosing. */
  hidMoreOnFinal: boolean;
  /** It let more junk through on the saved messages than when choosing. */
  missedMoreOnFinal: boolean;
  verdict: 'worse' | 'better' | 'same';
};

/** A difference nobody could read off the rows is reported as no difference. */
const VISIBLE = 1e-9;

export function compareGroups(choosing: Outcome, final: Outcome): Comparison {
  const rate = (outcome: Outcome, part: number) => (outcome.rows.length === 0 ? 0 : part / outcome.rows.length);
  const missRate = (outcome: Outcome) => (outcome.junkTotal === 0 ? 0 : (outcome.junkTotal - outcome.junkCaught) / outcome.junkTotal);
  const hidRate = (outcome: Outcome) => (outcome.wantedTotal === 0 ? 0 : outcome.wantedHidden / outcome.wantedTotal);

  const before = rate(choosing, mistakes(choosing));
  const after = rate(final, mistakes(final));
  const gap = after - before;

  return {
    mistakesWhenChoosing: mistakes(choosing),
    mistakesOnFinal: mistakes(final),
    hidMoreOnFinal: hidRate(final) > hidRate(choosing) + VISIBLE,
    missedMoreOnFinal: missRate(final) > missRate(choosing) + VISIBLE,
    verdict: Math.abs(gap) < VISIBLE ? 'same' : gap > 0 ? 'worse' : 'better',
  };
}

/**
 * The words that lean furthest each way, for showing that something was
 * actually learned. Ties are broken by the word itself so the list is stable
 * between renders rather than depending on Map iteration order.
 */
export function leaningWords(filter: Filter, count: number): { junk: readonly string[]; wanted: readonly string[] } {
  const ranked = [...filter.scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    junk: ranked.filter(([, score]) => score > 0).slice(0, count).map(([word]) => word),
    wanted: ranked.filter(([, score]) => score < 0).reverse().slice(0, count).map(([word]) => word),
  };
}

/**
 * Two invented sets of messages. Nothing is read from anybody's mail, no
 * account is connected, and no request leaves the browser.
 *
 * The words are ordinary and the overlap between the groups is deliberate: a
 * message you wanted that happens to say "free" is exactly where a cautious
 * setting and a quick one part company, and it is the reason the middle group
 * is worth spending at all.
 *
 * Each set is held to the case it claims in `junk-filter.test.ts` rather than
 * described in the panel copy, so editing the wording later cannot quietly turn
 * "the two settings disagree" into a set where they no longer do.
 */
export const MESSAGE_SETS: readonly MessageSet[] = [
  {
    label: 'A small mailbox',
    note: 'Six messages to learn from, four to help choose, and four saved for the final check.',
    learn: [
      { id: 'a-l1', text: 'You are a winner, claim your free prize', truth: 'junk' },
      { id: 'a-l2', text: 'Free cash offer, click here today', truth: 'junk' },
      { id: 'a-l3', text: 'Urgent, claim your prize before it ends', truth: 'junk' },
      { id: 'a-l4', text: 'Are we still on for lunch tomorrow?', truth: 'wanted' },
      { id: 'a-l5', text: 'Meeting notes from the project review', truth: 'wanted' },
      { id: 'a-l6', text: 'Can you send me the photos from the weekend?', truth: 'wanted' },
    ],
    choose: [
      { id: 'a-c1', text: 'Claim your free gift today', truth: 'junk' },
      { id: 'a-c2', text: 'Special offer inside', truth: 'junk' },
      { id: 'a-c3', text: 'Free coffee in the kitchen today', truth: 'wanted' },
      { id: 'a-c4', text: 'Meeting notes from Thursday', truth: 'wanted' },
    ],
    final: [
      { id: 'a-f1', text: 'Claim your free prize now', truth: 'junk' },
      { id: 'a-f2', text: 'Today only, half price', truth: 'junk' },
      { id: 'a-f3', text: 'Photos from the weekend', truth: 'wanted' },
      { id: 'a-f4', text: 'Claim your free lunch voucher from HR today', truth: 'wanted' },
    ],
  },
  {
    label: 'A different mailbox',
    note: 'The same three groups, a different set of messages, and a different answer about how cautious to be.',
    learn: [
      { id: 'b-l1', text: 'Congratulations, you have won a holiday', truth: 'junk' },
      { id: 'b-l2', text: 'Act now, this limited offer ends at midnight', truth: 'junk' },
      { id: 'b-l3', text: 'Click here to collect your cash reward', truth: 'junk' },
      { id: 'b-l4', text: 'Your holiday photos are ready to collect', truth: 'wanted' },
      { id: 'b-l5', text: 'Can we move the meeting to Thursday?', truth: 'wanted' },
      { id: 'b-l6', text: 'Here are the notes from this morning', truth: 'wanted' },
    ],
    choose: [
      { id: 'b-c1', text: 'Act now to claim your limited offer', truth: 'junk' },
      { id: 'b-c2', text: 'You have been selected', truth: 'junk' },
      { id: 'b-c3', text: 'The meeting notes are attached', truth: 'wanted' },
      { id: 'b-c4', text: 'Click here for the holiday photos', truth: 'wanted' },
    ],
    final: [
      { id: 'b-f1', text: 'Claim your cash reward now', truth: 'junk' },
      { id: 'b-f2', text: 'This offer ends tonight', truth: 'junk' },
      { id: 'b-f3', text: 'Can we move this to Thursday morning?', truth: 'wanted' },
      { id: 'b-f4', text: 'Click here to collect your reward', truth: 'wanted' },
    ],
  },
];

export const INITIAL_SET = MESSAGE_SETS[0];
