/**
 * What actually gets sent — for the `context-window` node.
 *
 * THE QUESTION. "If it is still in the chat, why can't the model use it?"
 *
 * The node's first recorded misconception is believing the model remembers the
 * conversation, rather than the whole conversation being re-sent every turn.
 * That survives any amount of explaining, because the chat stays on screen and
 * looks like memory. So this panel puts two things side by side and lets them
 * disagree: the conversation, which never loses a message, and the request,
 * which has a fixed amount of room and drops the oldest messages to stay inside
 * it.
 *
 * WHAT IS REAL HERE. The token counts. Every number the panel prints is
 * `cl100k_base` run over the exact text on screen, by the same pinned
 * `js-tiktoken` the tokenizer playground uses, in a worker in the browser. The
 * allowance was then chosen FROM those measurements so that the first press
 * visibly pushes the oldest message out; it is not a real model's limit, and
 * the panel says so.
 *
 * WHAT IS SCRIPTED. The reply. `answerFrom` is a hand-written rule that looks
 * for a door code and repeats it, and the panel labels it as one every time it
 * is shown. It is not a model, it does not generate text, and nothing here
 * should be read as a view into one. What makes it worth having is its
 * SIGNATURE: it takes the included messages and nothing else, so "the reply can
 * only use what was sent" is the shape of the function rather than a promise in
 * a comment. `context.test.ts` hands it a conversation whose visible history is
 * full of door codes and whose included list has none, and requires it to come
 * back empty-handed.
 *
 * WHAT THIS TOY DOES NOT CLAIM. That every service drops the oldest whole
 * messages. Some reject an oversized request outright, some summarise what came
 * before, some keep their own notes and choose what to re-send. This one has
 * exactly one rule, and it is stated on screen.
 */

/** Who is speaking. Two people, so the chat reads without avatars. */
export type Speaker = 'Priya' | 'You';

export type MessageKind = 'opening' | 'note' | 'resend' | 'long' | 'question';

export type Message = {
  id: string;
  speaker: Speaker;
  text: string;
  kind: MessageKind;
  /** What the "Included in this request" card calls it, so a long line has a short name. */
  summary: string;
};

/**
 * The instructions this toy sends with every request. Counted exactly, like any
 * other text, because the point is that they use space too.
 */
export const INSTRUCTION = 'You are helping with a birthday party. Answer using only the messages included below.';

/**
 * The whole allowance, in tokens, and the part of it held back for the reply.
 *
 * Both are deliberately tiny. Real models are in the tens or hundreds of
 * thousands, and at that size nothing on this screen would ever change. The
 * number was picked after measuring the messages below: it leaves the opening
 * conversation fitting with room to spare, and the first prepared note pushes
 * it over.
 */
export const ALLOWANCE = 80;
export const REPLY_RESERVE = 24;

/** The conversation before the learner touches anything. */
export const OPENING: readonly Message[] = [
  { id: 'code', speaker: 'Priya', text: 'The door code is 47A.', kind: 'opening', summary: 'The door code' },
  { id: 'start', speaker: 'Priya', text: 'Party starts at seven on Saturday, at my flat.', kind: 'opening', summary: 'The start time' },
];

/** The current turn. Always last, and never dropped while anything is. */
export const QUESTION: Message = {
  id: 'question', speaker: 'You', text: 'What was the door code again?', kind: 'question', summary: 'Your question',
};

/** Added one at a time by the first action, in this order. */
export const NOTES: readonly Message[] = [
  { id: 'balloons', speaker: 'Priya', text: 'Balloons are ordered. Twenty of them, mixed colours, arriving Friday morning.', kind: 'note', summary: 'The balloons note' },
  { id: 'music', speaker: 'You', text: 'Are we doing live music, or a playlist on the speaker?', kind: 'note', summary: 'The music question' },
  { id: 'playlist', speaker: 'Priya', text: 'A playlist. Forty minutes of nineties pop first, then something calmer for later.', kind: 'note', summary: 'The playlist note' },
  { id: 'cake', speaker: 'Priya', text: 'The cake is being collected at four, so I may be out for half an hour.', kind: 'note', summary: 'The cake note' },
];

/** What "Include the code again" puts back into the conversation. */
export const RESEND: Message = {
  id: 'resend', speaker: 'Priya', text: 'Sending it again: the door code is 47A.', kind: 'resend', summary: 'The door code again',
};

/**
 * One message that is larger than the whole allowance on its own.
 *
 * It is a real boundary rather than a curiosity: no amount of dropping older
 * messages can make room for it, so the panel has to say that instead of
 * quietly leaving it out like any other. Offered under "Try another example".
 */
export const LONG_MESSAGE: Message = {
  id: 'directions',
  speaker: 'Priya',
  kind: 'long',
  summary: 'The long directions',
  text: 'Directions, in case you are driving: come off the ring road at junction four, follow signs for the retail park, turn left at the second set of lights, then right past the old cinema, and the flats are behind the corner shop with the green awning. Parking is free after six on the road itself, but the car park behind the flats is residents only and they do tow. If you are on the bus it is the 42 or the 176, and you want the stop after the library, not the one before it.',
};

/** Every message this panel can ever show, in the order it would arrive. */
export const ALL_MESSAGES: readonly Message[] = [...OPENING, ...NOTES, LONG_MESSAGE, RESEND, QUESTION];

/** Every string whose tokens have to be counted before the panel can say anything. */
export const TEXTS_TO_COUNT: readonly string[] = [INSTRUCTION, ...ALL_MESSAGES.map(message => message.text)];

/** Token counts, keyed by message id, plus the instruction under its own key. */
export const INSTRUCTION_KEY = '__instruction__';
export type Counts = Readonly<Record<string, number>>;

export function countsFrom(values: readonly number[]): Counts {
  const counts: Record<string, number> = { [INSTRUCTION_KEY]: values[0] };
  ALL_MESSAGES.forEach((message, index) => { counts[message.id] = values[index + 1]; });
  return counts;
}

export const OPENING_CHAT: readonly Message[] = [...OPENING, QUESTION];

/** Why a message is not in the request. */
export type Exclusion = 'no-room' | 'too-long-alone';

export type Placement = {
  message: Message;
  tokens: number;
  included: boolean;
  excluded: Exclusion | null;
};

export type Request = {
  allowance: number;
  instructionTokens: number;
  reserve: number;
  /** What is left for messages once the instructions and the reply space are taken. */
  capacity: number;
  /** Chat order, oldest first. */
  placements: readonly Placement[];
  included: readonly Message[];
  messageTokens: number;
  /** Instructions plus included messages plus the reply space. */
  used: number;
  free: number;
};

/**
 * Which messages fit, under this app's one rule: drop the OLDEST whole messages
 * until the request is inside the allowance.
 *
 * Walking newest-first and stopping at the first message that will not fit is
 * that rule exactly. It also means a message too long to fit blocks everything
 * older than it, which is a consequence of the rule rather than a separate
 * decision, and the panel says so rather than reaching past it for something
 * smaller. Reaching past would be "choosing other material to send", which is a
 * different thing that some services really do and this toy does not.
 *
 * Nothing is ever split. A message is in or out.
 */
export function buildRequest(chat: readonly Message[], counts: Counts): Request {
  const instructionTokens = counts[INSTRUCTION_KEY] ?? 0;
  const capacity = ALLOWANCE - instructionTokens - REPLY_RESERVE;

  const placements: Placement[] = chat.map(message => ({
    message, tokens: counts[message.id] ?? 0, included: false, excluded: 'no-room' as Exclusion | null,
  }));

  let messageTokens = 0;
  let room = true;
  for (let index = placements.length - 1; index >= 0; index -= 1) {
    const placement = placements[index];
    if (placement.tokens > capacity) {
      // No amount of dropping older messages can make room for this one.
      placement.excluded = 'too-long-alone';
      room = false;
      continue;
    }
    if (!room || messageTokens + placement.tokens > capacity) {
      room = false;
      continue;
    }
    placement.included = true;
    placement.excluded = null;
    messageTokens += placement.tokens;
  }

  const included = placements.filter(placement => placement.included).map(placement => placement.message);
  const used = instructionTokens + messageTokens + REPLY_RESERVE;
  return {
    allowance: ALLOWANCE, instructionTokens, reserve: REPLY_RESERVE, capacity,
    placements, included, messageTokens, used, free: ALLOWANCE - used,
  };
}

export type Answer = { code: string | null; text: string };

/**
 * The scripted reply rule.
 *
 * It takes the INCLUDED messages and nothing else — no chat, no history, no
 * store — so it cannot reach back to text that was not sent. That is the whole
 * reason it is a separate function taking a list rather than a method on the
 * panel's state, and `context.test.ts` holds it to it.
 *
 * It reads the text it is given, rather than a flag someone set on a message,
 * so putting the code into any included message is enough and removing it from
 * the included ones is enough to take it away.
 */
const DOOR_CODE = /door code is\s+([0-9A-Za-z]+)/i;

export function answerFrom(included: readonly Message[]): Answer {
  for (const message of included) {
    const found = DOOR_CODE.exec(message.text);
    if (found) return { code: found[1], text: `The door code is ${found[1]}.` };
  }
  return { code: null, text: 'I cannot see a door code in the messages I was given.' };
}

/** The notes still waiting to be added, in order. */
export function remainingNotes(chat: readonly Message[]): readonly Message[] {
  const present = new Set(chat.map(message => message.id));
  return NOTES.filter(note => !present.has(note.id));
}

/**
 * Adds a message immediately before the question, because the question is the
 * turn being answered and everything else happened before it.
 */
export function addBeforeQuestion(chat: readonly Message[], message: Message): readonly Message[] {
  const rest = chat.filter(existing => existing.id !== message.id && existing.id !== QUESTION.id);
  return [...rest, message, QUESTION];
}

export function withoutMessage(chat: readonly Message[], id: string): readonly Message[] {
  return chat.filter(message => message.id !== id);
}

/** The ids that were included before but are not now. Chat order. */
export function newlyDropped(before: Request, after: Request): readonly Message[] {
  const now = new Set(after.included.map(message => message.id));
  return before.included.filter(message => !now.has(message.id));
}

export function hasCode(request: Request): boolean {
  return answerFrom(request.included).code !== null;
}
