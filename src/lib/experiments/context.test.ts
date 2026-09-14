import { describe, expect, it } from 'vitest';

import { countTokens } from './tokenizer-engine';
import {
  addBeforeQuestion,
  ALL_MESSAGES,
  ALLOWANCE,
  answerFrom,
  buildRequest,
  countsFrom,
  hasCode,
  INSTRUCTION,
  INSTRUCTION_KEY,
  LONG_MESSAGE,
  NOTES,
  newlyDropped,
  OPENING,
  OPENING_CHAT,
  QUESTION,
  remainingNotes,
  REPLY_RESERVE,
  RESEND,
  TEXTS_TO_COUNT,
  withoutMessage,
  type Counts,
  type Message,
} from './context';

/**
 * The counts the panel prints come from the worker at runtime. These are the
 * same encoder called directly, so a text edited without re-measuring the
 * allowance fails here rather than on screen.
 */
const COUNTS: Counts = countsFrom(TEXTS_TO_COUNT.map(countTokens));
const size = (id: string) => COUNTS[id];

describe('the measured sizes', () => {
  it('counts every text the panel needs and nothing else', () => {
    expect(TEXTS_TO_COUNT).toHaveLength(ALL_MESSAGES.length + 1);
    expect(TEXTS_TO_COUNT[0]).toBe(INSTRUCTION);
    for (const message of ALL_MESSAGES) expect(size(message.id)).toBeGreaterThan(0);
  });

  /*
   * The exact figures, written down. They are what the allowance was chosen
   * against, so editing a message without re-checking the sequence below is a
   * failing test rather than a panel that quietly stops demonstrating anything.
   */
  it('is the cl100k_base count of the exact text on screen', () => {
    expect(size(INSTRUCTION_KEY)).toBe(16);
    expect(size('code')).toBe(8);
    expect(size('start')).toBe(11);
    expect(size('balloons')).toBe(17);
    expect(size('music')).toBe(13);
    expect(size('playlist')).toBe(18);
    expect(size('cake')).toBe(18);
    expect(size('resend')).toBe(12);
    expect(size('question')).toBe(7);
    expect(size('directions')).toBe(110);
  });

  it('leaves real room for messages once the instructions and the reply space are taken', () => {
    const request = buildRequest(OPENING_CHAT, COUNTS);
    expect(request.capacity).toBe(ALLOWANCE - size(INSTRUCTION_KEY) - REPLY_RESERVE);
    expect(request.capacity).toBeGreaterThan(0);
  });
});

describe('what fits', () => {
  it('holds the whole opening conversation, with room left over', () => {
    const request = buildRequest(OPENING_CHAT, COUNTS);
    expect(request.included.map(message => message.id)).toEqual(['code', 'start', 'question']);
    expect(request.used).toBe(66);
    expect(request.free).toBe(14);
    expect(request.used).toBeLessThanOrEqual(ALLOWANCE);
    expect(hasCode(request)).toBe(true);
  });

  /* The whole first action, in one assertion: one press pushes the code out. */
  it('drops the oldest message the moment the first note arrives', () => {
    const before = buildRequest(OPENING_CHAT, COUNTS);
    const after = buildRequest(addBeforeQuestion(OPENING_CHAT, NOTES[0]), COUNTS);
    expect(newlyDropped(before, after).map(message => message.id)).toEqual(['code']);
    expect(after.included.map(message => message.id)).toEqual(['start', 'balloons', 'question']);
    expect(after.used).toBeLessThanOrEqual(ALLOWANCE);
    expect(hasCode(after)).toBe(false);
  });

  it('never exceeds the allowance, and never splits a message', () => {
    let chat = OPENING_CHAT;
    for (const note of NOTES) {
      chat = addBeforeQuestion(chat, note);
      const request = buildRequest(chat, COUNTS);
      expect(request.used).toBeLessThanOrEqual(ALLOWANCE);
      const summed = request.included.reduce((total, message) => total + size(message.id), 0);
      expect(request.messageTokens).toBe(summed);
      // Included messages are always a contiguous run ending at the newest one.
      const ids = chat.map(message => message.id);
      const includedIds = request.included.map(message => message.id);
      expect(ids.slice(ids.length - includedIds.length)).toEqual(includedIds);
    }
  });

  it('removes as many whole messages as it takes, not just one', () => {
    const chatBefore = NOTES.slice(0, 3).reduce(addBeforeQuestion, OPENING_CHAT);
    const before = buildRequest(chatBefore, COUNTS);
    const after = buildRequest(addBeforeQuestion(chatBefore, NOTES[3]), COUNTS);
    expect(newlyDropped(before, after).map(message => message.id)).toEqual(['music', 'playlist']);
  });

  it('keeps the question in every step of the walk', () => {
    let chat = OPENING_CHAT;
    for (const note of [...NOTES, RESEND]) {
      chat = addBeforeQuestion(chat, note);
      expect(buildRequest(chat, COUNTS).included.some(message => message.id === QUESTION.id)).toBe(true);
    }
  });

  it('puts the code back when it is sent again, with no other change', () => {
    const full = NOTES.reduce(addBeforeQuestion, OPENING_CHAT);
    expect(hasCode(buildRequest(full, COUNTS))).toBe(false);
    const restored = buildRequest(addBeforeQuestion(full, RESEND), COUNTS);
    expect(hasCode(restored)).toBe(true);
    expect(restored.used).toBeLessThanOrEqual(ALLOWANCE);
    expect(answerFrom(restored.included).text).toBe('The door code is 47A.');
  });
});

describe('the boundary', () => {
  const fake = (id: string, text: string): Message => ({ id, speaker: 'You', text, kind: 'note', summary: id });

  /** Counts supplied directly, so the boundary is exact rather than nearly exact. */
  function sized(sizes: Record<string, number>): Counts {
    return { [INSTRUCTION_KEY]: sizes[INSTRUCTION_KEY] ?? 0, ...sizes };
  }

  it('includes a message that fills the last free token exactly', () => {
    const counts = sized({ [INSTRUCTION_KEY]: 16, a: 20, b: 20 });
    const request = buildRequest([fake('a', 'a'), fake('b', 'b')], counts);
    expect(request.capacity).toBe(40);
    expect(request.included.map(message => message.id)).toEqual(['a', 'b']);
    expect(request.used).toBe(ALLOWANCE);
    expect(request.free).toBe(0);
  });

  it('excludes a message that overshoots by one token', () => {
    const counts = sized({ [INSTRUCTION_KEY]: 16, a: 21, b: 20 });
    const request = buildRequest([fake('a', 'a'), fake('b', 'b')], counts);
    expect(request.included.map(message => message.id)).toEqual(['b']);
    expect(request.placements[0].excluded).toBe('no-room');
  });

  it('says a message is too long on its own, rather than calling it unlucky', () => {
    const chat = addBeforeQuestion(OPENING_CHAT, LONG_MESSAGE);
    const request = buildRequest(chat, COUNTS);
    const long = request.placements.find(placement => placement.message.id === LONG_MESSAGE.id)!;
    expect(long.tokens).toBeGreaterThan(request.capacity);
    expect(long.included).toBe(false);
    expect(long.excluded).toBe('too-long-alone');
    expect(request.included.map(message => message.id)).toEqual(['question']);
  });

  it('recovers completely when the long message is taken away again', () => {
    const chat = addBeforeQuestion(OPENING_CHAT, LONG_MESSAGE);
    const back = buildRequest(withoutMessage(chat, LONG_MESSAGE.id), COUNTS);
    expect(back.included.map(message => message.id)).toEqual(buildRequest(OPENING_CHAT, COUNTS).included.map(message => message.id));
    expect(hasCode(back)).toBe(true);
  });

  it('keeps nothing when the instructions and the reply space use the whole allowance', () => {
    const request = buildRequest([fake('a', 'a')], sized({ [INSTRUCTION_KEY]: ALLOWANCE - REPLY_RESERVE, a: 1 }));
    expect(request.capacity).toBe(0);
    expect(request.included).toEqual([]);
    expect(request.placements[0].excluded).toBe('too-long-alone');
  });
});

describe('the scripted reply', () => {
  /*
   * The rule reads the messages it is handed and has no way to reach anything
   * else. Here the visible conversation is full of door codes and the included
   * list has none: if the reply could see past its argument, this is where it
   * would show.
   */
  it('cannot reach a message that was not included', () => {
    const shouting: Message[] = [
      { id: 'x1', speaker: 'Priya', text: 'The door code is 99Z.', kind: 'note', summary: 'x1' },
      { id: 'x2', speaker: 'Priya', text: 'Reminder, the door code is 12B.', kind: 'note', summary: 'x2' },
    ];
    expect(answerFrom(shouting).code).toBe('99Z');
    expect(answerFrom([QUESTION]).code).toBe(null);
    expect(answerFrom([]).code).toBe(null);
  });

  it('is not set off by the question itself', () => {
    expect(answerFrom([QUESTION]).text).toBe('I cannot see a door code in the messages I was given.');
  });

  it('reads the text, not a flag on the message', () => {
    const invented: Message = { ...QUESTION, id: 'invented', text: 'By the way the door code is 8QQ.' };
    expect(answerFrom([invented]).code).toBe('8QQ');
  });

  it('answers from the included messages at every step of the walk', () => {
    let chat = OPENING_CHAT;
    expect(answerFrom(buildRequest(chat, COUNTS).included).code).toBe('47A');
    chat = addBeforeQuestion(chat, NOTES[0]);
    expect(answerFrom(buildRequest(chat, COUNTS).included).code).toBe(null);
    chat = addBeforeQuestion(chat, RESEND);
    expect(answerFrom(buildRequest(chat, COUNTS).included).code).toBe('47A');
  });
});

describe('the conversation itself', () => {
  it('keeps every message on screen whatever the request holds', () => {
    const chat = NOTES.reduce(addBeforeQuestion, OPENING_CHAT);
    const request = buildRequest(chat, COUNTS);
    expect(request.placements).toHaveLength(chat.length);
    expect(request.placements.map(placement => placement.message.id)).toEqual(chat.map(message => message.id));
    expect(request.included.length).toBeLessThan(chat.length);
  });

  it('adds each prepared note once, in order, and then runs out', () => {
    let chat = OPENING_CHAT;
    expect(remainingNotes(chat)).toEqual(NOTES);
    for (let index = 0; index < NOTES.length; index += 1) {
      expect(remainingNotes(chat)[0]).toEqual(NOTES[index]);
      chat = addBeforeQuestion(chat, NOTES[index]);
    }
    expect(remainingNotes(chat)).toEqual([]);
    expect(chat.filter(message => message.id === 'balloons')).toHaveLength(1);
  });

  it('always ends on the question', () => {
    let chat = OPENING_CHAT;
    for (const message of [...NOTES, LONG_MESSAGE, RESEND]) {
      chat = addBeforeQuestion(chat, message);
      expect(chat[chat.length - 1].id).toBe(QUESTION.id);
    }
  });

  it('opens with the code first, so the message that drops is the one being asked about', () => {
    expect(OPENING[0].id).toBe('code');
    expect(OPENING_CHAT[0].id).toBe('code');
  });
});
