/**
 * Can it answer from the right notice? — for the `rag` node.
 *
 * THE QUESTION. "How can AI answer from a notice it was never trained on?"
 *
 * The node's two recorded misconceptions are the whole brief. The first is that
 * retrieval adds knowledge to the model; it does not, it adds text to the
 * request. The second is that retrieval fixes invented answers; it does not,
 * and its own `simplificationCost` says why — "a wrong retrieval yields a
 * fluent, well-cited, wrong answer, and that is harder to catch than an obvious
 * invention." So this panel is built so that the second one can be produced in
 * one press: the same question, the same answering rule, a real citation into a
 * real line, and the wrong closing time, because the notice handed over was out
 * of date.
 *
 * WHAT IS REAL HERE. The search. Every score on screen is counted from the text
 * of the notices below, which ship with the experiment and can be read on
 * screen. Nothing is hand-ranked and no request leaves the browser.
 *
 * WHAT IS INVENTED, SAID ON SCREEN. Marlow Lane Pool, its notices, and every
 * date and time in them. They are written for this panel.
 *
 * WHAT IS A TEACHING CHOICE, SAID ON SCREEN.
 *
 *   - This is a KEYWORD search. It counts words the question and the notice
 *     share, weighted so a word in few notices counts for more. It is not a
 *     meaning search, no embedding distance is invented anywhere here, and the
 *     panel never calls it one. The `embeddings` experiment next door is where
 *     positions-in-space are real.
 *   - The answer is a TEMPLATE. It reads one line out of the supplied notice and
 *     fills in the subject and the time. It is not a language model, and the
 *     panel says so beside every answer it produces. A template is used on
 *     purpose: it isolates the effect of the retrieved passage, because it can
 *     only ever repeat what it was handed.
 *
 * TWO THINGS ARE THE SHAPE OF THE FUNCTIONS RATHER THAN A PROMISE IN A COMMENT.
 *
 *   - `rank` never reads `date` or `version`. `retrieval.test.ts` replaces every
 *     one of them with nonsense and requires the ranking to come out identical.
 *     This matters: the current notice comes top because of how it is worded,
 *     not because it is newer, and a learner is entitled to know that the thing
 *     choosing their source has no idea which source is current.
 *   - `answerFrom(notice, question)` takes ONE notice, so the rest of the
 *     collection is not in scope where the answer is built. The same structural
 *     move as `answerWith(learned, distance)` in `phases.ts` and
 *     `answerFrom(request.included)` in `context.ts`. The test hands it a notice
 *     with no answer while the collection is full of them.
 */

export type Notice = {
  id: string;
  title: string;
  /** Shown on screen. Never read by the search. */
  date: string;
  /** Shown on screen. Never read by the search. */
  version: number;
  /** The passage, one sentence per line, so a citation can name one of them. */
  lines: readonly string[];
};

/**
 * Five notices from an invented swimming pool.
 *
 * Deliberately NOT stored in date order. Ties in the ranking are broken by
 * position in this list, and if that list were newest-first the tie rule would
 * quietly be a date preference — the exact thing the panel tells the learner is
 * not happening.
 *
 * Two of them share a title and differ by version, which is the ordinary shape
 * of a notice being replaced. Only the text says which supersedes which; there
 * is no field carrying it, because a field would invite the search to use it.
 */
export const NOTICES: readonly Notice[] = [
  {
    id: 'lanes',
    title: 'Lane swimming times',
    date: '12 February 2026',
    version: 1,
    lines: [
      'Lane swimming runs from 7am to 9am every weekday.',
      'The main pool is open to everyone at all other times.',
    ],
  },
  {
    id: 'saturday-old',
    title: 'Saturday opening hours',
    date: '6 January 2026',
    version: 1,
    lines: [
      'The pool closes at 6pm on Saturday.',
      'Last entry is 30 minutes before closing.',
    ],
  },
  {
    id: 'cafe',
    title: 'Poolside café hours',
    date: '1 March 2026',
    version: 1,
    lines: [
      'The café closes at 5pm on Saturday.',
      'Hot food stops 30 minutes earlier.',
    ],
  },
  {
    id: 'saturday-current',
    title: 'Saturday opening hours',
    date: '14 March 2026',
    version: 2,
    lines: [
      'From Saturday 14 March the pool closes at 4pm.',
      'This replaces the Saturday hours published in January.',
    ],
  },
  {
    id: 'maintenance',
    title: 'Pool closed for maintenance',
    date: '2 March 2026',
    version: 1,
    lines: [
      'The pool is closed all day on Sunday 8 March.',
      'Lessons and lane swimming are cancelled.',
    ],
  },
] as const;

/** Which notice the panel starts from, once a search has run. */
export const CURRENT_NOTICE = 'saturday-current';
export const OLDER_NOTICE = 'saturday-old';

/**
 * Words too common to narrow anything down, removed before the count.
 *
 * Short and shown on screen. A longer list would work better and would stop the
 * learner being able to check the arithmetic, which matters more here.
 */
export const STOPWORDS: readonly string[] = [
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'does', 'for', 'from',
  'how', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'there', 'this', 'to',
  'was', 'what', 'when', 'where', 'which', 'with',
];

/*
 * Both spellings, because `words` stems before anything else looks at a word
 * and "does" comes out as "doe". Without this the panel's list of what the
 * search looked for carried a word nobody typed.
 */
const STOP = new Set([...STOPWORDS, ...STOPWORDS.map(stem)]);

/**
 * One crude rule, stated on screen: a trailing "s" comes off.
 *
 * That is enough for "closes" to count as "close" and "Saturdays" as
 * "Saturday". Nothing else is changed, so "closed" stays a different word from
 * "close" — which is true of the rule as written, visible in the scores, and a
 * fair picture of how blunt this kind of search is.
 */
export function stem(word: string): string {
  const lower = word.toLowerCase();
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

/**
 * Text to whole words.
 *
 * Whole words on purpose: "poolside" is not "pool" here, and the café notice is
 * written to make that visible rather than to hide it.
 */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map(stem);
}

/** Everything the search can see in one notice: its title and its lines. */
export function searchableText(notice: Notice): string {
  return [notice.title, ...notice.lines].join(' ');
}

/** The words of the question the search will actually look for. */
export function queryTerms(question: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const word of words(question)) {
    if (STOP.has(word) || seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
  }
  return terms;
}

export type TermHit = {
  term: string;
  /** How many times it appears in this notice's title and lines. */
  occurrences: number;
  /** How many notices in the collection contain it at all. */
  notices: number;
  /** 1 divided by that, so a word in few notices counts for more. */
  weight: number;
  contribution: number;
};

export type Match = { notice: Notice; score: number; hits: readonly TermHit[] };

function count(text: readonly string[], term: string): number {
  let total = 0;
  for (const word of text) if (word === term) total += 1;
  return total;
}

/**
 * The ranking. Real, local, and a keyword count — never called anything else.
 *
 *   score = Σ over the question's words of (times the word appears in the
 *           notice) × (1 ÷ how many notices contain that word)
 *
 * Both halves are one sentence each on screen, and both are checkable by hand
 * against the notices above.
 *
 * `date` and `version` are not read. Ties go to the notice that comes first in
 * the collection, which is a stable rule and not a preference for anything.
 * Notices scoring nothing are left out entirely, so "no notice matched" is a
 * real outcome rather than a fabricated best guess.
 */
export function rank(notices: readonly Notice[], question: string): Match[] {
  const terms = queryTerms(question);
  const texts = notices.map(notice => words(searchableText(notice)));
  const spread = new Map<string, number>();
  for (const term of terms) {
    spread.set(term, texts.filter(text => text.includes(term)).length);
  }

  return notices
    .map((notice, index) => {
      const text = texts[index];
      const hits: TermHit[] = [];
      let score = 0;
      for (const term of terms) {
        const occurrences = count(text, term);
        if (occurrences === 0) continue;
        const inNotices = spread.get(term) ?? 0;
        const weight = inNotices === 0 ? 0 : 1 / inNotices;
        const contribution = occurrences * weight;
        score += contribution;
        hits.push({ term, occurrences, notices: inNotices, weight, contribution });
      }
      return { notice, score, hits, index };
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ notice, score, hits }) => ({ notice, score, hits }));
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Day = (typeof DAYS)[number];

/** The day a question asks about, or null when it names none. */
export function dayIn(question: string): Day | null {
  const said = words(question);
  return DAYS.find(day => said.includes(day)) ?? null;
}

const CLOSING = /([\p{L}]+)\s+closes?\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/iu;

export type Answer =
  | {
      kind: 'answer';
      text: string;
      /** The exact line this came out of, and where it sits in the notice. */
      line: string;
      lineIndex: number;
      /** The time as the line itself writes it. */
      time: string;
    }
  | { kind: 'no-answer'; reason: 'no-day-in-question' | 'not-in-this-notice' };

/**
 * The template.
 *
 * One notice in, one answer out. The collection is not a parameter, so "the
 * answer can only use the passage it was handed" is the shape of this function.
 *
 * It looks for a single line of THIS notice that names the day the question
 * asked about and gives a closing time, and it takes the subject from that
 * line rather than assuming one. That is why selecting the café notice answers
 * about the café: a template that printed "the pool" regardless would be
 * inventing the very thing the panel is about.
 *
 * When no line does both it says so and stops. It never reaches for another
 * notice and it never supplies a time from anywhere else.
 */
export function answerFrom(notice: Notice, question: string): Answer {
  const day = dayIn(question);
  if (!day) return { kind: 'no-answer', reason: 'no-day-in-question' };

  for (let index = 0; index < notice.lines.length; index += 1) {
    const line = notice.lines[index];
    if (!words(line).includes(day)) continue;
    const found = line.match(CLOSING);
    if (!found) continue;
    const subject = found[1].toLowerCase();
    const time = found[2].replace(/\s+/g, '').toLowerCase();
    return {
      kind: 'answer',
      text: `The ${subject} closes at ${time} on ${titleCase(day)}.`,
      line,
      lineIndex: index,
      time,
    };
  }
  return { kind: 'no-answer', reason: 'not-in-this-notice' };
}

/**
 * Whether a shown answer still came from the notice now supplied.
 *
 * Pure, so "changing the source invalidates the answer" is something a test can
 * hold rather than something an effect happens to do. The panel marks the old
 * answer stale and waits to be asked again; it does not quietly recompute,
 * which would hide the one step this experiment exists to show.
 */
export function isStale(answeredFrom: string | null, supplied: string | null): boolean {
  return answeredFrom !== null && answeredFrom !== supplied;
}

/** Whether the learner has actually produced the contrast the closing names. */
export function answersDiffer(previous: Answer | null, current: Answer | null): boolean {
  return previous?.kind === 'answer'
    && current?.kind === 'answer'
    && previous.time !== current.time;
}

export type Question = {
  id: string;
  text: string;
  /** Why this one is offered, shown beside it. */
  note: string;
};

/**
 * The questions. The first is the one the panel starts on.
 *
 * `sauna` exists so the empty result can be seen for real: nothing in the five
 * notices contains the word, so the search comes back with nothing rather than
 * with a best guess. Watching that is better than reading about it, and it is
 * the honest half of a pair — the panel also says a real system handed nothing
 * useful may still answer confidently.
 */
export const QUESTIONS: readonly Question[] = [
  {
    id: 'saturday',
    text: 'When does the pool close on Saturday?',
    note: 'The question this experiment starts from.',
  },
  {
    id: 'sauna',
    text: 'Is there a sauna?',
    note: 'No notice mentions a sauna, so watch the search come back with nothing at all.',
  },
];

export const FIRST_QUESTION = QUESTIONS[0];

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A score for the screen. Two decimals, so the arithmetic can be followed. */
export function score(value: number): string {
  return value.toFixed(2);
}
