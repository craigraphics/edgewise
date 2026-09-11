export const TOKENIZER_ENCODING = 'cl100k_base';
export const TOKENIZER_LIBRARY = 'js-tiktoken 1.0.21';
export const MAX_TOKENIZER_CHARACTERS = 12_000;

export type TokenPiece = {
  id: number;
  bytes: number[];
  text: string | null;
  display: string;
};

export type TokenizeRequest = { requestId: number; text: string };
export type TokenizeSuccess = { requestId: number; tokens: TokenPiece[] };
export type TokenizeFailure = { requestId: number; error: string };
export type TokenizeResponse = TokenizeSuccess | TokenizeFailure;

export const TOKENIZER_EXAMPLES = [
  { label: 'A sentence', text: 'The cat sat on the mat.' },
  // This node's authored example asks why a model miscounts letters in
  // "strawberry". The playground shows the actual pieces rather than repeating
  // a memorised count, which would be a claim about a vocabulary nobody checked.
  { label: 'The strawberry question', text: "How many r's are in strawberry?" },
  { label: 'An unusual word', text: 'antidisestablishmentarianism' },
  { label: 'Spacing & punctuation', text: 'Wait...  what?\nYes!' },
  { label: 'Emoji', text: 'Family: 👨‍👩‍👧‍👦 👍🏽' },
  { label: 'Japanese', text: 'お誕生日おめでとう' },
] as const;

const decoder = new TextDecoder('utf-8', { fatal: true });

export function visibleWhitespace(value: string) {
  return Array.from(value, character => {
    if (character === ' ') return '␠';
    if (character === '\n') return '↵';
    if (character === '\r') return '␍';
    if (character === '\t') return '⇥';
    if (/\s/u.test(character)) return `⟦U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}⟧`;
    return character;
  }).join('');
}

export function describeToken(id: number, bytes: Uint8Array): TokenPiece {
  try {
    const text = decoder.decode(bytes);
    return { id, bytes: Array.from(bytes), text, display: visibleWhitespace(text) };
  } catch {
    return {
      id,
      bytes: Array.from(bytes),
      text: null,
      display: `bytes ${Array.from(bytes, byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`,
    };
  }
}

export function clipTokenizerText(value: string) {
  if (value.length <= MAX_TOKENIZER_CHARACTERS) return { text: value, clipped: false };
  let text = value.slice(0, MAX_TOKENIZER_CHARACTERS);
  const last = text.charCodeAt(text.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1);
  return { text, clipped: true };
}

export function isLatestTokenization(responseId: number, latestRequestId: number) {
  return responseId === latestRequestId;
}
