import { Tiktoken } from 'js-tiktoken/lite';
import cl100kBase from 'js-tiktoken/ranks/cl100k_base';

import { describeToken, type TokenPiece } from './tokenizer';

type EncoderInternals = Tiktoken & {
  textMap: Map<number, Uint8Array>;
  inverseSpecialTokens: Record<number, Uint8Array>;
};

let encoder: Tiktoken | null = null;

function getEncoder() {
  encoder ??= new Tiktoken(cl100kBase);
  return encoder;
}

function bytesForToken(encoding: Tiktoken, id: number) {
  // js-tiktoken's pinned implementation keeps the byte vocabulary on these
  // fields but omits it from its public type. Reading it is necessary here:
  // decoding one byte-fragment token as UTF-8 would invent a replacement
  // character, precisely the corruption this playground must not teach.
  const internals = encoding as EncoderInternals;
  const bytes = internals.textMap.get(id) ?? internals.inverseSpecialTokens[id];
  if (!bytes) throw new Error(`The ${id} token is missing from the pinned vocabulary.`);
  return bytes;
}

export function tokenizeText(text: string): TokenPiece[] {
  if (!text) return [];
  const encoding = getEncoder();
  // No invisible start/end tokens are added. Strings resembling special
  // tokens are intentionally encoded as ordinary user text.
  return encoding.encode(text, [], []).map(id => describeToken(id, bytesForToken(encoding, id)));
}

export function decodeTokenization(tokens: TokenPiece[]) {
  const length = tokens.reduce((total, token) => total + token.bytes.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const token of tokens) {
    bytes.set(token.bytes, offset);
    offset += token.bytes.length;
  }
  return new TextDecoder().decode(bytes);
}
