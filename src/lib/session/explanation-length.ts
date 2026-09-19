/**
 * Whether an explanation has enough in it to be checked.
 *
 * "ok" enabled "Check my explanation", spent a request against a shared
 * allowance, and came back with the assessor politely asking for more — a round
 * trip that could only ever end one way. Words rather than characters, because
 * "It multiplies each input by a weight" is short and genuinely an explanation.
 *
 * The reason is said in words beside the control. A disabled button with no
 * explanation reads as broken.
 */

export const MIN_EXPLANATION_WORDS = 4;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function explanationReadiness(text: string): { ready: boolean; reason: string | null } {
  const words = wordCount(text);
  if (words === 0) return { ready: false, reason: 'Write or say a sentence or two first.' };
  if (words < MIN_EXPLANATION_WORDS) {
    return { ready: false, reason: 'A few more words first. A sentence about what it does is enough to check.' };
  }
  return { ready: true, reason: null };
}
