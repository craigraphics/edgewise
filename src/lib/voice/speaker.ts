'use client';

/**
 * Speaking the tutor's turn aloud.
 *
 * Behind an interface because the browser's own voice is the weakest part of
 * this product and the most likely thing to be replaced. Everything above this
 * file knows only `speak`, `stop`, and `available` — swapping in a hosted TTS
 * provider is a new implementation of `Speaker`, not a change to the session.
 */

export type Speaker = {
  /** Resolves when the utterance finishes, or immediately if unavailable. */
  speak(text: string): Promise<void>;
  stop(): void;
  readonly available: boolean;
};

const NOOP: Speaker = {
  speak: async () => {},
  stop: () => {},
  available: false,
};

/**
 * Picks the least robotic English voice on offer.
 *
 * Voice quality varies enormously between machines and the default is usually
 * the worst one installed. These families are the ones that do not sound like a
 * railway announcement, in rough order of preference.
 */
const PREFERRED = ['natural', 'neural', 'google', 'samantha', 'daniel', 'karen', 'serena'];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => voice.lang.startsWith('en'));
  if (english.length === 0) return null;

  for (const family of PREFERRED) {
    const match = english.find((voice) => voice.name.toLowerCase().includes(family));
    if (match) return match;
  }

  return english.find((voice) => voice.default) ?? english[0];
}

export function browserSpeaker(): Speaker {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return NOOP;

  const synth = window.speechSynthesis;
  let voice: SpeechSynthesisVoice | null = null;

  /*
   * getVoices() is empty on first call in most browsers and populates
   * asynchronously. Reading it once at construction gets you nothing on a cold
   * page load, so listen for the event as well.
   */
  const refresh = () => {
    voice = pickVoice(synth.getVoices());
  };
  refresh();
  synth.addEventListener('voiceschanged', refresh);

  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const clearKeepAlive = () => {
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = null;
  };

  return {
    available: true,

    speak(text) {
      return new Promise<void>((resolve) => {
        // Anything still queued is stale by definition — the tutor has moved on.
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        if (voice) utterance.voice = voice;
        utterance.rate = 1.02;
        utterance.pitch = 1;

        const finish = () => {
          clearKeepAlive();
          resolve();
        };

        utterance.onend = finish;
        // Resolve on error too: a session must never hang waiting for audio.
        utterance.onerror = finish;

        synth.speak(utterance);

        /*
         * Chrome silently stops speaking after roughly fifteen seconds unless
         * the queue is nudged. A tutor's turn is short, but "explain that again"
         * can run past it, and the failure is silent — the audio just stops
         * mid-sentence with no event fired.
         */
        clearKeepAlive();
        keepAlive = setInterval(() => {
          if (!synth.speaking) return clearKeepAlive();
          synth.pause();
          synth.resume();
        }, 10_000);
      });
    },

    stop() {
      clearKeepAlive();
      synth.cancel();
    },
  };
}
