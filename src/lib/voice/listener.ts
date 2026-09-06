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
 *
 * ## What Android does differently, and why this file is a state machine
 *
 * Chrome for Android does not implement `continuous` — it hands off to the
 * platform recogniser, which is one-shot and ends at the first endpoint it
 * detects. So "the pause window is ours, not Chrome's", the fix that came out
 * of real use, does not hold there: the recogniser stops on its own, mid-answer,
 * several times per turn.
 *
 * Restarting it is the only way through, and the three things that go wrong all
 * go wrong SILENTLY — no error, no exception, just a turn where the learner
 * spoke and nothing was registered:
 *
 * 1. **A restart in the same tick as `onend`** either throws or comes straight
 *    back, so the microphone is never really open. It is scheduled instead.
 * 2. **The last result arrives on the way out.** Android commonly delivers a
 *    final result between `stop()` and `onend`. Firing `onEnd` at the moment we
 *    ask it to stop throws that away — and, because the recogniser is still
 *    live, drops it into the NEXT turn. So closing now waits for the
 *    recogniser's own `onend`, with a deadline so a recogniser that never ends
 *    cannot hang the turn.
 * 3. **Every callback is guarded on identity.** A superseded recogniser that is
 *    still finishing must not be able to write into the turn that replaced it.
 *
 * None of that is Android-specific in its own right; it is correct everywhere
 * and only load-bearing there.
 */

export type ListenHandlers = {
  /** Fires repeatedly as recognition firms up. `final` marks the last one. */
  onResult(transcript: string, final: boolean): void;
  onError(reason: ListenError): void;
  /** Fires exactly once per `start`, once recognition has stopped for any reason. */
  onEnd(): void;
};

export type ListenError = 'denied' | 'insecure' | 'no-speech' | 'no-audio' | 'network' | 'failed';

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

/** How often to check whether that window has elapsed. */
const TICK_MS = 400;

/**
 * The gap before a recogniser that stopped by itself is started again.
 *
 * Android's recogniser needs the audio input back before it will take it again.
 * Restarting inside its own `onend` either throws `InvalidStateError` or
 * succeeds and ends immediately, which spins until the silence window closes
 * the turn — the failure this whole file exists to prevent, arrived at by
 * trying too hard to stay open.
 */
const RESTART_MS = 250;

/**
 * The beat between the tutor's voice stopping and the microphone opening.
 *
 * Only on a handset — see `needsMicrophoneHandover`. Charged against the
 * silence window's start, not before it, so it never shortens someone's
 * thinking time.
 */
const HANDOVER_MS = 300;

/**
 * How long to wait for a recogniser to finish after being asked to stop.
 *
 * Long enough for Android to deliver the final result it was holding; short
 * enough that a recogniser which never fires `onend` cannot leave the interface
 * saying "Listening…" over a closed microphone.
 */
const CLOSING_MS = 1200;

/** Recogniser error codes worth telling someone about, and what they mean. */
const ERRORS: Record<string, ListenError> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'audio-capture': 'no-audio',
  network: 'network',
};

const NOOP: Listener = {
  // Ends as well as reports: every `start` owes exactly one `onEnd`, or the
  // interface is left saying "Listening…" over a microphone that never opened.
  start: (handlers) => {
    handlers.onError('failed');
    handlers.onEnd();
  },
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

/**
 * One attempt at hearing one answer.
 *
 * Scoped per `start` so that everything belonging to a finished turn — a
 * recogniser still winding down, a scheduled restart, a late result — can be
 * identified as belonging to it and ignored.
 */
type Turn = {
  handlers: ListenHandlers;
  /** Whether the learner still means to be talking, regardless of the browser. */
  wanted: boolean;
  /** Whether `onEnd` has been delivered. Guarantees it happens exactly once. */
  settled: boolean;
  /**
   * When the turn last had a reason to stay open — a result, or the microphone
   * first opening.
   *
   * Advanced by results and by nothing else. An earlier draft reseeded it on
   * every restart so the restart gaps would not eat into someone's thinking
   * time; that made the silence window unreachable whenever the recogniser was
   * ending instantly, which is precisely the case it exists to catch — a
   * microphone held by something else restarts forever and never closes the
   * turn. The gaps come out of the window. Four seconds is generous enough to
   * absorb them.
   */
  lastHeard: number;
  recogniser: Recognition | null;
  /** The silence-window poll. One per turn, cleared when the turn settles. */
  tick: ReturnType<typeof setInterval> | null;
  timers: ReturnType<typeof setTimeout>[];
};

export type ListenerOptions = {
  /** See `needsMicrophoneHandover`. Injected so the delay is testable. */
  handoverMs?: number;
};

export function browserListener(options: ListenerOptions = {}): Listener {
  const Recognition = constructor();
  if (!Recognition) return NOOP;

  /*
   * An insecure origin has the constructor and cannot use it.
   *
   * Chrome refuses the microphone off HTTPS and reports it as
   * `service-not-allowed`, which reads as "you have blocked this site" and
   * sends somebody to a permission setting that is not the problem. It is worth
   * its own message because it is exactly what happens when the app is opened
   * on a phone over `http://<the laptop's address>:3000` to test voice — the
   * one setup in which anyone is likely to hit it.
   */
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { ...NOOP, start: (handlers) => { handlers.onError('insecure'); handlers.onEnd(); } };
  }

  const handoverMs = options.handoverMs ?? 0;
  let turn: Turn | null = null;

  const clearTimers = (subject: Turn) => {
    subject.timers.forEach((timer) => clearTimeout(timer));
    subject.timers = [];
    if (subject.tick) clearInterval(subject.tick);
    subject.tick = null;
  };

  const after = (subject: Turn, ms: number, run: () => void) => {
    subject.timers.push(setTimeout(run, ms));
  };

  /**
   * Ends the turn, once. Everything that reaches here has already decided the
   * turn is over; this is the only place that says so out loud.
   */
  const settle = (subject: Turn, error?: ListenError) => {
    if (subject.settled) return;
    subject.settled = true;
    subject.wanted = false;
    clearTimers(subject);

    const recogniser = subject.recogniser;
    subject.recogniser = null;
    // Belt and braces: a turn settled by deadline or error may still have a
    // live recogniser holding the microphone.
    try {
      recogniser?.abort();
    } catch {
      /* already gone */
    }

    if (turn === subject) turn = null;
    if (error) subject.handlers.onError(error);
    subject.handlers.onEnd();
  };

  /**
   * Asks the recogniser to stop and waits for it to say it has.
   *
   * `stop()` lets it finalise what it already heard; `abort()` throws it away.
   * Somebody pressing stop mid-sentence means "I'm done talking", not "discard
   * that" — and on Android what it already heard is often the whole answer,
   * delivered on the way out.
   */
  const close = (subject: Turn) => {
    if (subject.settled) return;
    subject.wanted = false;
    clearTimers(subject);

    if (!subject.recogniser) return settle(subject);

    try {
      subject.recogniser.stop();
    } catch {
      return settle(subject);
    }

    // If it never fires `onend`, the turn still has to end.
    after(subject, CLOSING_MS, () => settle(subject));
  };

  const spawn = (subject: Turn) => {
    if (subject.settled || !subject.wanted) return;

    const recognition = new Recognition();
    subject.recogniser = recognition;

    recognition.lang = navigator.language || 'en-GB';
    /*
     * `continuous` keeps the recogniser from calling the answer finished on its
     * own short pause. The decision about when someone has stopped talking is
     * ours, on the longer window above.
     *
     * Chrome for Android ignores this. The restart in `onend` is what stands in
     * for it there.
     */
    recognition.continuous = true;
    // Interim results are what make the UI feel alive during a long answer, and
    // they double as the signal that someone is still talking. Android does not
    // reliably send them, which is why the window is not the only thing keeping
    // the turn open.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    /** True only while this recogniser is the one the current turn is using. */
    const mine = () => turn === subject && subject.recogniser === recognition && !subject.settled;

    recognition.onresult = (event) => {
      // A superseded recogniser finishing its last thought must not be able to
      // write into the turn that replaced it.
      if (!mine()) return;

      subject.lastHeard = Date.now();
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        subject.handlers.onResult(result[0].transcript, result.isFinal);
      }
    };

    recognition.onerror = (event) => {
      if (!mine()) return;

      /*
       * Two of these are not failures.
       *
       * `no-speech` is the browser giving up during a pause — the silence
       * window above decides when a pause has run too long, and it has not
       * fired. `aborted` is us tearing down a recogniser deliberately.
       *
       * Reporting either would put an error in front of someone who is simply
       * thinking. `onend` follows and decides whether to restart.
       */
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      settle(subject, ERRORS[event.error] ?? 'failed');
    };

    recognition.onend = () => {
      if (!mine()) return;
      subject.recogniser = null;

      // Still meant to be listening: the browser stopped, we did not. Scheduled
      // rather than immediate — see RESTART_MS.
      if (subject.wanted) after(subject, RESTART_MS, () => spawn(subject));
      else settle(subject);
    };

    try {
      recognition.start();
    } catch {
      /*
       * Throws if `start()` is called while one is already starting. Ending the
       * turn is not optional here: the old code reported the error and left
       * `onEnd` undelivered, so the interface sat on "Listening…" over a
       * microphone that was never open.
       */
      subject.recogniser = null;
      settle(subject, 'failed');
    }
  };

  return {
    available: true,

    start(handlers) {
      // Never run two recognisers at once: the second silently steals the
      // microphone and the first ends without ever producing a result. The
      // superseded turn is abandoned rather than ended — nobody asked for its
      // answer, and delivering `onEnd` for it would submit a half-heard one.
      if (turn) {
        const previous = turn;
        previous.settled = true;
        previous.wanted = false;
        clearTimers(previous);
        try {
          previous.recogniser?.abort();
        } catch {
          /* already gone */
        }
        previous.recogniser = null;
      }

      const subject: Turn = {
        handlers,
        wanted: true,
        settled: false,
        // Seeded when the microphone actually opens, below, so the handover is
        // not charged against the learner's thinking time.
        lastHeard: Date.now(),
        recogniser: null,
        tick: null,
        timers: [],
      };
      turn = subject;

      subject.tick = setInterval(() => {
        if (subject.settled || !subject.wanted) return;
        if (Date.now() - subject.lastHeard >= SILENCE_MS) close(subject);
      }, TICK_MS);

      if (handoverMs > 0) {
        after(subject, handoverMs, () => {
          subject.lastHeard = Date.now();
          spawn(subject);
        });
      } else {
        spawn(subject);
      }
    },

    stop() {
      if (turn) close(turn);
    },
  };
}

/** Wording for each failure. None of these may read as the learner's fault. */
export const LISTEN_ERROR_COPY: Record<ListenError, string> = {
  denied: 'The microphone is blocked for this site. You can allow it in the address bar, or just type instead.',
  insecure: 'Talking out loud needs a secure connection (https). Typing works here either way.',
  'no-speech': 'Did not catch anything that time. Try again, or type it.',
  'no-audio': 'No microphone found. Typing works just as well.',
  network: 'Speech recognition could not reach the network. Typing still works.',
  failed: 'Speech recognition is not working in this browser. Typing works everywhere.',
};

export const LISTENER_TIMING = { SILENCE_MS, TICK_MS, RESTART_MS, HANDOVER_MS, CLOSING_MS };
