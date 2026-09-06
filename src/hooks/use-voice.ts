'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { browserListener, LISTEN_ERROR_COPY, LISTENER_TIMING, type Listener } from '@/lib/voice/listener';
import { needsMicrophoneHandover } from '@/lib/voice/platform';
import { browserSpeaker, type Speaker } from '@/lib/voice/speaker';

/**
 * Binds the speaker and listener to React, and runs the hands-free loop.
 *
 * The loop is: speak the tutor's turn, then open the microphone, then hand the
 * finished transcript back for sending. Hands-free is the point of a spoken
 * tutor — having to click between every exchange puts you back at a keyboard,
 * which is the thing text mode is already for.
 *
 * Voice is opt-in and never the only way in. Chrome is the only reliable target,
 * the recognition is not on-device, and plenty of people are somewhere they
 * cannot talk out loud.
 */

const KEY = 'edgewise.voice.v1';

export function useVoice(onFinalTranscript: (text: string) => void) {
  const speaker = useRef<Speaker | null>(null);
  const listener = useRef<Listener | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState({ speak: false, listen: false });
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** What recognition has settled on so far this turn. */
  const finalText = useRef('');
  /** Whether this turn already reported a reason, so the fallback stays quiet. */
  const failed = useRef(false);
  /*
   * Held in a ref because the listener's callbacks are registered once per
   * `start` and would otherwise close over a stale `onFinalTranscript` — an
   * answer would be recognised correctly and then handed to a dead callback.
   *
   * Assigned in an effect rather than during render: writing to a ref while
   * rendering is a real hazard under concurrent rendering, where a render can
   * be thrown away after the write has already happened.
   */
  const submit = useRef(onFinalTranscript);
  useEffect(() => {
    submit.current = onFinalTranscript;
  });

  useEffect(() => {
    speaker.current = browserSpeaker();
    listener.current = browserListener({
      // On a handset the microphone cannot be opened in the same breath as the
      // tutor's voice stopping. See `needsMicrophoneHandover`.
      handoverMs: needsMicrophoneHandover() ? LISTENER_TIMING.HANDOVER_MS : 0,
    });
    setSupported({ speak: speaker.current.available, listen: listener.current.available });

    try {
      setEnabled(window.localStorage.getItem(KEY) === 'on');
    } catch {
      /* storage unavailable; voice just starts off */
    }

    return () => {
      speaker.current?.stop();
      listener.current?.stop();
    };
  }, []);

  const listen = useCallback(() => {
    if (!listener.current?.available) return;

    // Stop talking the moment the microphone opens, or the tutor's own voice
    // is the first thing the recogniser hears.
    speaker.current?.stop();
    setSpeaking(false);

    finalText.current = '';
    failed.current = false;
    setInterim('');
    setError(null);
    setListening(true);

    listener.current.start({
      onResult: (transcript, isFinal) => {
        if (isFinal) {
          finalText.current = `${finalText.current} ${transcript}`.trim();
          setInterim('');
        } else {
          setInterim(transcript);
        }
      },
      onError: (reason) => {
        // "no speech" is not an error worth showing when they simply paused.
        if (reason !== 'no-speech') {
          failed.current = true;
          setError(LISTEN_ERROR_COPY[reason]);
        }
      },
      onEnd: () => {
        setListening(false);
        setInterim('');

        const heard = finalText.current.trim();
        finalText.current = '';
        if (heard) return submit.current(heard);

        /*
         * A turn that heard nothing must say so.
         *
         * It used to close the microphone and do nothing at all — no answer, no
         * message, no error — which from the learner's side is indistinguishable
         * from the product ignoring them, and is exactly what an Android session
         * looked like. Whatever the cause, somebody who spoke and was not heard
         * has to be told, or they will keep talking at a closed microphone.
         *
         * Suppressed when an error was already reported: that message is more
         * specific than this one and has just been put on screen.
         */
        if (!failed.current) setError(LISTEN_ERROR_COPY['no-speech']);
      },
    });
  }, []);

  const stopListening = useCallback(() => {
    listener.current?.stop();
  }, []);

  /**
   * Speaks a turn, then opens the microphone.
   *
   * `andListen` is false for the closing turn — nothing is being asked, and
   * leaving the microphone open after "that's everything" is unsettling.
   */
  const say = useCallback(
    async (text: string, andListen: boolean) => {
      if (!enabled || !speaker.current?.available) return;

      setSpeaking(true);
      await speaker.current.speak(text);
      setSpeaking(false);

      if (andListen) listen();
    },
    [enabled, listen],
  );

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      if (!next) {
        speaker.current?.stop();
        listener.current?.stop();
        setSpeaking(false);
        setListening(false);
      }
      try {
        window.localStorage.setItem(KEY, next ? 'on' : 'off');
      } catch {
        /* preference just will not persist */
      }
      return next;
    });
  }, []);

  return {
    enabled,
    supported,
    speaking,
    listening,
    interim,
    error,
    toggle,
    say,
    listen,
    stopListening,
    stopSpeaking: () => {
      speaker.current?.stop();
      setSpeaking(false);
    },
  };
}
