import { describe, expect, it } from 'vitest';

import cl100kBase from 'js-tiktoken/ranks/cl100k_base';

import { decodeTokenization, tokenizeText } from './tokenizer-engine';
import {
  clipTokenizerText,
  describeToken,
  isLatestTokenization,
  MAX_TOKENIZER_CHARACTERS,
  visibleWhitespace,
} from './tokenizer';

describe('the cl100k_base tokenizer playground', () => {
  it('matches OpenAI reference IDs and bytes rather than checking itself', () => {
    expect(tokenizeText('antidisestablishmentarianism')).toEqual([
      { id: 519, bytes: [97, 110, 116], text: 'ant', display: 'ant' },
      { id: 85342, bytes: [105, 100, 105, 115], text: 'idis', display: 'idis' },
      { id: 34500, bytes: [101, 115, 116, 97, 98, 108, 105, 115, 104], text: 'establish', display: 'establish' },
      { id: 479, bytes: [109, 101, 110, 116], text: 'ment', display: 'ment' },
      { id: 8997, bytes: [97, 114, 105, 97, 110], text: 'arian', display: 'arian' },
      { id: 2191, bytes: [105, 115, 109], text: 'ism', display: 'ism' },
    ]);
    expect(tokenizeText('2 + 2 = 4').map(token => token.id)).toEqual([17, 489, 220, 17, 284, 220, 19]);
    expect(tokenizeText('2 + 2 = 4').map(token => token.bytes)).toEqual([
      [50], [32, 43], [32], [50], [32, 61], [32], [52],
    ]);
  });

  it('keeps byte fragments faithful when one token is only part of a character', () => {
    const tokens = tokenizeText('お誕生日おめでとう');
    expect(tokens.map(token => token.id)).toEqual([33334, 45918, 243, 21990, 9080, 33334, 62004, 16556, 78699]);
    expect(tokens.map(token => token.bytes)).toEqual([
      [227, 129, 138], [232, 170], [149], [231, 148, 159], [230, 151, 165],
      [227, 129, 138], [227, 130, 129], [227, 129, 167], [227, 129, 168, 227, 129, 134],
    ]);
    expect(tokens[1]).toMatchObject({ text: null, display: 'bytes E8 AA' });
    expect(tokens[2]).toMatchObject({ text: null, display: 'bytes 95' });
  });

  it.each([
    '',
    'two  spaces',
    'first line\nsecond line',
    'Wait...  what?!',
    'e\u0301 and é',
    '👨‍👩‍👧‍👦 👍🏽',
    '中文 العربية हिन्दी',
    '<|endoftext|>',
  ])('round trips exact text without implicit special tokens: %s', text => {
    const tokens = tokenizeText(text);
    expect(decodeTokenization(tokens)).toBe(text);
    if (!text) expect(tokens).toHaveLength(0);
  });

  it('makes whitespace visible without changing the source value', () => {
    expect(visibleWhitespace(' a\tb\nc\u00a0')).toBe('␠a⇥b↵c⟦U+00A0⟧');
    expect(describeToken(220, new Uint8Array([32]))).toMatchObject({ text: ' ', display: '␠' });
  });

  it('clips long input without leaving half a surrogate pair', () => {
    const clipped = clipTokenizerText(`${'a'.repeat(MAX_TOKENIZER_CHARACTERS - 1)}😀tail`);
    expect(clipped.clipped).toBe(true);
    expect(clipped.text).toBe('a'.repeat(MAX_TOKENIZER_CHARACTERS - 1));
    expect(clipTokenizerText('short')).toEqual({ text: 'short', clipped: false });
  });

  it('accepts only the newest response after rapid edits', () => {
    expect(isLatestTokenization(7, 8)).toBe(false);
    expect(isLatestTokenization(8, 8)).toBe(true);
  });

  /**
   * The fixtures above would still pass if the encoder and the expectations were
   * both wrong in the same way. This decodes the pinned rank table directly,
   * without the Tiktoken class, and holds every emitted ID to that vocabulary.
   */
  it('emits IDs that match the pinned vocabulary decoded independently', () => {
    const vocabulary = new Map<number, string>();
    for (const line of cl100kBase.bpe_ranks.split('\n')) {
      if (!line) continue;
      const [, offset, ...entries] = line.split(' ');
      entries.forEach((entry, index) => {
        vocabulary.set(Number.parseInt(offset, 10) + index, Buffer.from(entry, 'base64').join(','));
      });
    }
    expect(vocabulary.size).toBe(100_256);

    for (const sample of ['The cat sat on the mat.', "How many r's are in strawberry?", 'お誕生日おめでとう', '👍🏽']) {
      for (const token of tokenizeText(sample)) {
        expect(vocabulary.get(token.id)).toBe(token.bytes.join(','));
      }
    }
  });

  it('splits one word into several tokens, which is why counts differ from words', () => {
    // Computed, never asserted as a memorised count: the point is that a single
    // word is not a single token, not that this vocabulary yields any given number.
    const strawberry = tokenizeText('strawberry');
    expect(strawberry.length).toBeGreaterThan(1);
    expect(decodeTokenization(strawberry)).toBe('strawberry');
    expect(new Set(strawberry.map(token => token.id)).size).toBe(strawberry.length);

    // The same letters, differently placed, cross different boundaries.
    expect(tokenizeText(' strawberry').map(token => token.id)).not.toEqual(strawberry.map(token => token.id));
  });

  it('keeps repeated spaces and blank lines as their own pieces', () => {
    const spaces = tokenizeText('a    b');
    expect(decodeTokenization(spaces)).toBe('a    b');
    expect(spaces.some(token => token.text !== null && /^ +$/.test(token.text))).toBe(true);

    const lines = tokenizeText('one\n\n\ntwo');
    expect(decodeTokenization(lines)).toBe('one\n\n\ntwo');
    expect(lines.some(token => token.display.includes('↵'))).toBe(true);
  });

  it('separates a combining mark from its base letter without merging them', () => {
    const decomposed = tokenizeText('e\u0301');
    expect(decodeTokenization(decomposed)).toBe('e\u0301');
    // Precomposed and decomposed look identical and are not the same token run.
    expect(decomposed.map(token => token.id)).not.toEqual(tokenizeText('\u00e9').map(token => token.id));
  });

  it('spans a joined emoji across separate token IDs that rejoin exactly', () => {
    const family = tokenizeText('👨‍👩‍👧‍👦');
    expect(family.length).toBeGreaterThan(1);
    expect(decodeTokenization(family)).toBe('👨‍👩‍👧‍👦');
    // Some pieces are partial characters; none is shown as a replacement symbol.
    expect(family.some(token => token.text === null)).toBe(true);
    expect(family.every(token => !token.display.includes('�'))).toBe(true);
  });

  it('treats special-token spellings as ordinary text', () => {
    const tokens = tokenizeText('<|endoftext|>');
    expect(tokens.length).toBeGreaterThan(1);
    expect(decodeTokenization(tokens)).toBe('<|endoftext|>');
    expect(tokens.every(token => token.id < 100_256)).toBe(true);
  });

  it('leaves text at exactly the limit unclipped', () => {
    const exact = 'a'.repeat(MAX_TOKENIZER_CHARACTERS);
    expect(clipTokenizerText(exact)).toEqual({ text: exact, clipped: false });
    expect(clipTokenizerText(`${exact}b`).text).toHaveLength(MAX_TOKENIZER_CHARACTERS);
  });
});
