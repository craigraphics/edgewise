'use client';

/**
 * Hearing the learner's answer.
 *
 * Uses the browser's Web Speech API, which is free and needs no server — the
 * decision that makes voice affordable at all here. The cost is that support is
 * uneven: Chrome is the target, and everything else falls back to typing, which
 * is why the text input is never hidden.
 *
 * ⚠️ In Chrome this is NOT on-device. Audio is streamed to Google's servers for
 * recognition. The spec calls this path "free, no server cost", which is true of
 * money and not of privacy — so the UI says so where someone can see it before
 * they turn the microphone on.
 */

export type ListenHandlers = {
  /** Fires repeatedly as recognition firms up. `final` marks the last one. */
  onResult(transcript: string, final: boolean): void;
  onError(reason: ListenError): void;
  /** Fires once recognition has stopped, for any reason. */
  onEnd(): void;
};

export type ListenError = 'denied' | 'no-speech' | 'no-audio' | 'network' | 'failed';

export type Listener = {
  start(handlers: ListenHandlers): void;
  stop(): void;
  readonly available: boolean;
};

/**
 * How long a pause may run before we take the answer as finished.
 *
 * The browser's own endpointing is tuned for dictation, where a pause means you
 * have stopped. Here a pause usually means you are thinking — someone working
 * out how to say what a neuron does will stop mid-sentence for several seconds —
 * and cutting them off there loses the answer and the nerve to give another.
 *
 * Erring long costs a couple of seconds at the end of each turn. Erring short
 * costs the turn.
 */
const SILENCE_MS = 4000;

/** Recogniser error codes worth telling someone about, and what they mean. */
const ERRORS: Record<string, ListenError> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'audio-capture': 'no-audio',
  network: 'network',
};

/** How often to check whether that window has elapsed. */
const TICK_MS = 400;

const NOOP: Listener = {
  start: (handlers) => handlers.onError('failed'),
  stop: () => {},
  available: false,
};

/* Minimal shape of the API. It is still not in lib.dom, and vendor-prefixed. */
type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => Recognition;

function constructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function browserListener(): Listener {
  const Recognition = constructor();
  if (!Recognition) return NOOP;

  let active: Recognition | null = null;
  /** Whether the learner still means to be talking, regardless of Chrome. */
  let wanted = false;
  let lastHeard = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const clearTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  return {
    available: true,

    start(handlers) {
      // Never run two recognisers at once: the second silently steals the
      // microphone and the first ends without ever producing a result.
      if (active) active.abort();

      /*
       * Intent, tracked separately from whether a recogniser is currently
       * running. Chrome ends recognition on its own — on its short internal
       * silence timeout, or with `no-speech` — and with `continuous` set it does
       * so mid-thought. When that happens while the learner still means to be
       * talking we restart quietly rather than reporting the turn as over.
       */
      wanted = true;
      lastHeard = Date.now();

      const finish = () => {
        wanted = false;
        clearTimer();
        const current = active;
        active = null;
        current?.stop();
        handlers.onEnd();
      };

      clearTimer();
      timer = setInterval(() => {
        if (!wanted) return clearTimer();
        if (Date.now() - lastHeard >= SILENCE_MS) finish();
      }, TICK_MS);

      const spawn = () => {
        const recognition = new Recognition();
        active = recognition;

        recognition.lang = navigator.language || 'en-GB';
        /*
         * `continuous` keeps the recogniser from calling the answer finished on
         * its own short pause. The decision about when someone has stopped
         * talking is ours, on the longer window above.
         */
        recognition.continuous = true;
        // Interim results are what make the UI feel alive during a long answer,
        // and they double as the signal that someone is still talking.
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          lastHeard = Date.now();
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            handlers.onResult(result[0].transcript, result.isFinal);
          }
        };

        recognition.onerror = (event) => {
          /*
           * Two of these are not failures.
           *
           * `no-speech` is Chrome giving up during a pause — the silence window
           * above decides when a pause has run too long, and it has not fired.
           * `aborted` is us tearing down a recogniser deliberately.
           *
           * Reporting either would put an error in front of someone who is
           * simply thinking.
           */
          if (event.error === 'no-speech' || event.error === 'aborted') return;

          wanted = false;
          handlers.onError(ERRORS[event.error] ?? 'failed');
        };

        recognition.onend = () => {
          if (active !== recognition) return;
          active = null;
          // Still meant to be listening: Chrome stopped, we did not.
          if (wanted) spawn();
          else handlers.onEnd();
        };

        try {
          recognition.start();
        } catch {
          // Throws if start() is called while one is already starting.
          active = null;
          wanted = false;
          clearTimer();
          handlers.onError('failed');
        }
      };

      spawn();
    },

    stop() {
      // stop() lets the recogniser finalise what it already heard; abort()
      // throws it away. Someone pressing stop mid-sentence means "I'm done
      // talking", not "discard that".
      wanted = false;
      clearTimer();
      active?.stop();
    },
  };
}

/** Wording for each failure. None of these may read as the learner's fault. */
export const LISTEN_ERROR_COPY: Record<ListenError, string> = {
  denied: 'The microphone is blocked for this site. You can allow it in the address bar, or just type instead.',
  'no-speech': "Did not catch anything that time. Try again, or type it.",
  'no-audio': 'No microphone found. Typing works just as well.',
  network: 'Speech recognition could not reach the network. Typing still works.',
  failed: 'Speech recognition is not working in this browser. Typing works everywhere.',
};
