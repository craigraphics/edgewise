'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { usePersisted, writePersisted } from '@/lib/persisted';
import { browserListener, LISTEN_ERROR_COPY, LISTENER_TIMING, type Listener } from '@/lib/voice/listener';
import { needsMicrophoneHandover } from '@/lib/voice/platform';
import { browserSpeaker, type Speaker } from '@/lib/voice/speaker';

/**
 * Binds the speaker and listener to React, and runs the hands-free loop.
 *
 * The two directions are separate choices, because they cost different things.
 * Reading aloud is local and private; answering out loud needs the microphone
 * and sends audio to Google. They used to be one "Talk and listen" switch, so
 * somebody who only wanted to hear the questions had to accept the microphone
 * to get them — and on Android, where recognition is the unreliable half and
 * speech is not, a broken microphone took working speech down with it.
 *
 * - `readAloud` is a standing preference about the tutor's turns, and persists.
 *   Hearing text read out sends nothing anywhere.
 * - Answering out loud is a per-turn press, behind a consent that is NEVER
 *   remembered. The sentence saying audio goes to Google comes before the
 *   microphone first opens in each mounted conversation (`micConsented`, held
 *   in state here and so gone on unmount).
 * - Hands-free is not a third switch. It is what happens when both are in use:
 *   `say(text, true)` reads the turn and then opens the microphone. The caller
 *   passes true only after a spoken answer in this same conversation.
 *
 * The old combined flag, `edgewise.voice.v1`, is why the consent is not stored.
 * Pressing "Read it to me" in the walkthrough set it, and the next conversation
 * then read its first question and opened the microphone without anybody
 * having pressed a listen control. Audio going to Google has to follow a press
 * made in that conversation, after the sentence saying so.
 *
 * Voice is opt-in and never the only way in. Chrome is the only reliable target,
 * the recognition is not on-device, and plenty of people are somewhere they
 * cannot talk out loud.
 */

const READ_ALOUD_KEY = 'edgewise.read-aloud.v1';
/** The old combined flag. Never read; removed so a stale "on" cannot linger. */
const LEGACY_KEY = 'edgewise.voice.v1';
const WAITING_SHOWN_AFTER_MS = 500;

export function useVoice(onFinalTranscript: (text: string) => void) {
  const speaker = useRef<Speaker | null>(null);
  const listener = useRef<Listener | null>(null);

  // Through the shared store, so the walkthrough and the conversation agree
  // about the preference rather than each reading it once on mount.
  const readAloud = usePersisted(READ_ALOUD_KEY) === 'on';
  const [micConsented, setMicConsented] = useState(false);
  const [supported, setSupported] = useState({ speak: false, listen: false });
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  /*
   * Listening has been asked for and the microphone is not open yet — on a
   * first visit, Chrome's permission prompt is up. Saying "Listening…" over
   * that is untrue, and somebody who starts answering into it loses the start
   * of their answer.
   */
  const [waiting, setWaiting] = useState(false);
  /*
   * Shown only if opening takes a noticeable time. With permission already
   * granted the microphone opens in about a tenth of a second, and flashing
   * "Waiting for the microphone" for that long on every hands-free turn is
   * noise. A prompt takes seconds.
   */
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWaiting = useCallback(() => {
    if (waitingTimer.current) clearTimeout(waitingTimer.current);
    waitingTimer.current = null;
    setWaiting(false);
  }, []);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** What recognition has settled on so far this turn. */
  const finalText = useRef('');
  /** Whether this turn already reported a reason, so the fallback stays quiet. */
  const failed = useRef(false);
  /** Stopped by the learner before the microphone ever opened: a cancel, not a miss. */
  const cancelled = useRef(false);
  const opened = useRef(false);
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
    writePersisted(LEGACY_KEY, null);

    return () => {
      speaker.current?.stop();
      listener.current?.stop();
      if (waitingTimer.current) clearTimeout(waitingTimer.current);
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
    cancelled.current = false;
    opened.current = false;
    setInterim('');
    setError(null);
    setListening(true);
    clearWaiting();
    waitingTimer.current = setTimeout(() => {
      if (!opened.current) setWaiting(true);
    }, WAITING_SHOWN_AFTER_MS);

    listener.current.start({
      onOpen: () => {
        opened.current = true;
        clearWaiting();
      },
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
        clearWaiting();
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
        if (!failed.current && !cancelled.current) setError(LISTEN_ERROR_COPY['no-speech']);
      },
    });
  }, [clearWaiting]);

  const stopListening = useCallback(() => {
    // Backing out of the prompt is not a turn where nothing was heard.
    if (!opened.current) cancelled.current = true;
    listener.current?.stop();
  }, []);

  /**
   * Speaks a turn, then — if asked — opens the microphone.
   *
   * `andListen` is the caller's to decide, and should be true only when the
   * learner is already answering out loud. It is false for the closing turn —
   * nothing is being asked, and leaving the microphone open after "that's
   * everything" is unsettling.
   */
  const say = useCallback(
    async (text: string, andListen: boolean) => {
      if (!readAloud || !speaker.current?.available) return;

      setSpeaking(true);
      await speaker.current.speak(text);
      setSpeaking(false);

      if (andListen) listen();
    },
    [readAloud, listen],
  );

  /*
   * Turning reading off stops the reading and nothing else. A microphone the
   * learner opened themselves is theirs to close — it is a different choice
   * now, and silencing the tutor should not cut somebody off mid-answer.
   */
  const setReadAloud = useCallback((next: boolean) => {
    if (!next) {
      speaker.current?.stop();
      setSpeaking(false);
    }
    writePersisted(READ_ALOUD_KEY, next ? 'on' : 'off');
  }, []);

  const toggleReadAloud = useCallback(() => setReadAloud(!readAloud), [readAloud, setReadAloud]);

  /** For this mounted conversation only. Never persisted — see above. */
  const consentToMic = useCallback(() => setMicConsented(true), []);

  return {
    readAloud,
    micConsented,
    supported,
    speaking,
    listening,
    waiting,
    interim,
    error,
    setReadAloud,
    toggleReadAloud,
    consentToMic,
    say,
    listen,
    stopListening,
    stopSpeaking: () => {
      speaker.current?.stop();
      setSpeaking(false);
    },
  };
}
