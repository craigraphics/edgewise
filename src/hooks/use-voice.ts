'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { browserListener, LISTEN_ERROR_COPY, type Listener } from '@/lib/voice/listener';
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
    listener.current = browserListener();
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
        if (reason !== 'no-speech') setError(LISTEN_ERROR_COPY[reason]);
      },
      onEnd: () => {
        setListening(false);
        setInterim('');

        const heard = finalText.current.trim();
        finalText.current = '';
        if (heard) submit.current(heard);
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
