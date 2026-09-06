import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { browserListener, LISTENER_TIMING, type ListenError } from './listener';

/**
 * The listener against a browser that does not behave the way the spec says.
 *
 * These are all written from Chrome for Android's actual shape — a one-shot
 * platform recogniser that ignores `continuous`, is stingy with interim
 * results, and delivers its last final result on the way out. Every failure
 * modelled here is silent in the product: the learner speaks, the microphone
 * closes, and nothing is registered. That is the whole reason for the file.
 *
 * The fake is driven by the test rather than simulating a platform on its own,
 * so each case says out loud which browser behaviour it is asserting against.
 */

const { SILENCE_MS, TICK_MS, RESTART_MS, CLOSING_MS } = LISTENER_TIMING;

type Handler<T> = ((event: T) => void) | null;

class FakeRecogniser {
  static live: FakeRecogniser[] = [];
  /** Set to make `start()` throw, as it does when one is already starting. */
  static refuseStart = false;

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;

  started = false;
  stopped = false;
  aborted = false;

  onresult: Handler<{ resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }> = null;
  onerror: Handler<{ error: string }> = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecogniser.live.push(this);
  }

  start() {
    if (FakeRecogniser.refuseStart) throw new Error('InvalidStateError');
    this.started = true;
  }

  stop() {
    this.stopped = true;
  }

  abort() {
    this.aborted = true;
  }

  /* ---- driven by the test ---- */

  say(transcript: string, isFinal = true) {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript }], { isFinal })],
    });
  }

  fail(error: string) {
    this.onerror?.({ error });
  }

  end() {
    this.onend?.();
  }
}

function record() {
  const results: { text: string; final: boolean }[] = [];
  const errors: ListenError[] = [];
  let ends = 0;

  return {
    results,
    errors,
    get ends() {
      return ends;
    },
    handlers: {
      onResult: (text: string, final: boolean) => results.push({ text, final }),
      onError: (reason: ListenError) => errors.push(reason),
      onEnd: () => {
        ends += 1;
      },
    },
  };
}

/** The recogniser currently holding the microphone, as far as the fake knows. */
const latest = () => FakeRecogniser.live[FakeRecogniser.live.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecogniser.live = [];
  FakeRecogniser.refuseStart = false;
  vi.stubGlobal('window', { webkitSpeechRecognition: FakeRecogniser, isSecureContext: true });
  vi.stubGlobal('navigator', { language: 'en-GB' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the ordinary turn', () => {
  it('collects what was said and ends once when the pause runs long', () => {
    const log = record();
    browserListener().start(log.handlers);

    latest().say('a neuron', false);
    latest().say('a neuron adds things up', true);
    vi.advanceTimersByTime(SILENCE_MS + TICK_MS);
    latest().end();

    expect(log.results).toEqual([
      { text: 'a neuron', final: false },
      { text: 'a neuron adds things up', final: true },
    ]);
    expect(log.ends).toBe(1);
    expect(log.errors).toEqual([]);
  });

  it('does not close while results keep arriving', () => {
    const log = record();
    browserListener().start(log.handlers);

    // Someone thinking their way through a long answer, pausing under the
    // window each time. The turn must stay open the whole way.
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(SILENCE_MS - TICK_MS);
      latest().say(`part ${i}`, true);
    }

    expect(log.ends).toBe(0);
    expect(latest().stopped).toBe(false);
  });
});

describe('Android: the recogniser ends itself mid-answer', () => {
  it('restarts instead of ending the turn', () => {
    const log = record();
    browserListener().start(log.handlers);

    const first = latest();
    first.say('a neuron', true);
    // `continuous` is ignored on Android: it stops at the first endpoint.
    first.end();

    expect(log.ends).toBe(0);

    vi.advanceTimersByTime(RESTART_MS);
    expect(FakeRecogniser.live).toHaveLength(2);
    expect(latest().started).toBe(true);
    expect(latest()).not.toBe(first);
  });

  it('schedules the restart rather than running it inside onend', () => {
    // Restarting in the same tick throws on Android, or succeeds and comes
    // straight back — either way the microphone is never really open.
    browserListener().start(record().handlers);

    latest().end();
    expect(FakeRecogniser.live).toHaveLength(1);

    vi.advanceTimersByTime(RESTART_MS);
    expect(FakeRecogniser.live).toHaveLength(2);
  });

  it('carries the answer across a restart', () => {
    const log = record();
    browserListener().start(log.handlers);

    latest().say('it adds up its inputs', true);
    latest().end();
    vi.advanceTimersByTime(RESTART_MS);
    latest().say('and each one has a weight', true);

    vi.advanceTimersByTime(SILENCE_MS + TICK_MS);
    latest().end();

    expect(log.results.map((r) => r.text)).toEqual(['it adds up its inputs', 'and each one has a weight']);
    expect(log.ends).toBe(1);
  });
});

describe('Android: the last result arrives on the way out', () => {
  it('does not end the turn until the recogniser has finished', () => {
    const log = record();
    const listener = browserListener();
    listener.start(log.handlers);

    listener.stop();
    expect(latest().stopped).toBe(true);
    // The point: `stop()` is a request, not the end of the turn.
    expect(log.ends).toBe(0);

    // Android commonly delivers the whole answer here, after stop and before end.
    latest().say('a neuron adds up its inputs', true);
    latest().end();

    expect(log.results.map((r) => r.text)).toEqual(['a neuron adds up its inputs']);
    expect(log.ends).toBe(1);
  });

  it('keeps a final result that lands after the silence window closes it', () => {
    const log = record();
    browserListener().start(log.handlers);

    // Android does not reliably send interim results, so a whole answer can be
    // spoken with nothing advancing the window. The window closes it; the
    // recogniser then hands over what it heard.
    vi.advanceTimersByTime(SILENCE_MS + TICK_MS);
    latest().say('weights decide how much each input counts', true);
    latest().end();

    expect(log.results.map((r) => r.text)).toEqual(['weights decide how much each input counts']);
    expect(log.ends).toBe(1);
  });

  it('still ends the turn when the recogniser never says it finished', () => {
    const log = record();
    browserListener().start(log.handlers);

    vi.advanceTimersByTime(SILENCE_MS + TICK_MS);
    expect(log.ends).toBe(0);

    vi.advanceTimersByTime(CLOSING_MS);
    expect(log.ends).toBe(1);
    // The microphone is not left open behind an interface that says otherwise.
    expect(latest().aborted).toBe(true);
  });
});

describe('nothing from a finished turn reaches the next one', () => {
  it('drops a result from a superseded recogniser', () => {
    const listener = browserListener();
    const first = record();
    listener.start(first.handlers);
    const stale = latest();

    const second = record();
    listener.start(second.handlers);

    stale.say('from the turn before', true);
    stale.end();

    expect(second.results).toEqual([]);
    expect(second.ends).toBe(0);
    // The abandoned turn is not ended either: nobody asked for its answer, and
    // delivering onEnd would submit a half-heard one.
    expect(first.ends).toBe(0);
    expect(stale.aborted).toBe(true);
  });

  it('drops a result that arrives after the turn has ended', () => {
    const log = record();
    const listener = browserListener();
    listener.start(log.handlers);

    const only = latest();
    listener.stop();
    only.say('heard in time', true);
    only.end();
    expect(log.ends).toBe(1);

    only.say('too late', true);
    expect(log.results.map((r) => r.text)).toEqual(['heard in time']);
    expect(log.ends).toBe(1);
  });
});

describe('failures are reported, and always end the turn', () => {
  it('ends the turn when start() throws', () => {
    // The old code reported the error and left onEnd undelivered, so the
    // interface sat on "Listening…" over a microphone that was never open.
    FakeRecogniser.refuseStart = true;
    const log = record();
    browserListener().start(log.handlers);

    expect(log.errors).toEqual(['failed']);
    expect(log.ends).toBe(1);
  });

  it('reports a blocked microphone once', () => {
    const log = record();
    browserListener().start(log.handlers);

    latest().fail('not-allowed');
    latest().end();
    vi.advanceTimersByTime(SILENCE_MS + CLOSING_MS + TICK_MS);

    expect(log.errors).toEqual(['denied']);
    expect(log.ends).toBe(1);
  });

  it('says nothing about a pause, and keeps listening', () => {
    const log = record();
    browserListener().start(log.handlers);

    latest().fail('no-speech');
    latest().end();
    vi.advanceTimersByTime(RESTART_MS);

    expect(log.errors).toEqual([]);
    expect(log.ends).toBe(0);
    expect(FakeRecogniser.live).toHaveLength(2);
  });

  it('bounds a recogniser that keeps ending instantly', () => {
    // A microphone held by something else looks exactly like this: start,
    // no-speech, end, forever. The silence window is what stops it, and the
    // turn has to end rather than spin.
    const log = record();
    browserListener().start(log.handlers);

    for (let elapsed = 0; elapsed < SILENCE_MS * 2; elapsed += RESTART_MS) {
      latest().fail('no-speech');
      latest().end();
      vi.advanceTimersByTime(RESTART_MS);
    }
    vi.advanceTimersByTime(CLOSING_MS);

    expect(log.ends).toBe(1);
    expect(log.results).toEqual([]);
    // Bounded by the window, not unbounded by the restart.
    expect(FakeRecogniser.live.length).toBeLessThanOrEqual(SILENCE_MS / RESTART_MS + 2);
  });
});

describe('the handover before the microphone opens', () => {
  const HANDOVER = 300;

  it('waits before opening, so the tutor has released the audio device', () => {
    browserListener({ handoverMs: HANDOVER }).start(record().handlers);

    expect(FakeRecogniser.live).toHaveLength(0);
    vi.advanceTimersByTime(HANDOVER);
    expect(FakeRecogniser.live).toHaveLength(1);
  });

  it('does not charge the wait against the learner"s thinking time', () => {
    const log = record();
    browserListener({ handoverMs: HANDOVER }).start(log.handlers);

    vi.advanceTimersByTime(HANDOVER + SILENCE_MS - TICK_MS * 2);
    expect(log.ends).toBe(0);
    expect(latest().stopped).toBe(false);
  });

  it('can be stopped before it ever opens', () => {
    const log = record();
    const listener = browserListener({ handoverMs: HANDOVER });
    listener.start(log.handlers);
    listener.stop();

    vi.advanceTimersByTime(HANDOVER + CLOSING_MS);
    expect(log.ends).toBe(1);
    expect(FakeRecogniser.live).toHaveLength(0);
  });
});

describe('the recogniser is asked for what this product needs', () => {
  it('sets continuous and interim results on every recogniser it makes', () => {
    browserListener().start(record().handlers);
    latest().end();
    vi.advanceTimersByTime(RESTART_MS);

    expect(FakeRecogniser.live).toHaveLength(2);
    for (const recogniser of FakeRecogniser.live) {
      expect(recogniser.continuous).toBe(true);
      expect(recogniser.interimResults).toBe(true);
      expect(recogniser.lang).toBe('en-GB');
    }
  });
});

describe('an insecure origin', () => {
  it('says so, rather than blaming a permission the learner has not set', () => {
    // This is what opening the dev server on a phone over http looks like, and
    // Chrome reports it as `service-not-allowed` — "you have blocked this site".
    vi.stubGlobal('window', { webkitSpeechRecognition: FakeRecogniser, isSecureContext: false });

    const log = record();
    const listener = browserListener();
    listener.start(log.handlers);

    expect(listener.available).toBe(false);
    expect(log.errors).toEqual(['insecure']);
    expect(log.ends).toBe(1);
    expect(FakeRecogniser.live).toHaveLength(0);
  });
});

describe('every start owes exactly one end', () => {
  it('holds even where speech recognition does not exist', () => {
    vi.stubGlobal('window', {});

    const log = record();
    browserListener().start(log.handlers);

    expect(log.errors).toEqual(['failed']);
    expect(log.ends).toBe(1);
  });
});
