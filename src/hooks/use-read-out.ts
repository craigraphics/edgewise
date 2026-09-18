'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { browserSpeaker, type Speaker } from '@/lib/voice/speaker';

/**
 * Reads one piece of text on request. Speaker only.
 *
 * `useVoice` is the conversation's loop — a standing preference, a listener, a
 * transcript. Hearing an idea read out is none of that: it is one press, one
 * reading, and it must not open a microphone or flip a preference that then
 * starts reading questions somewhere else.
 *
 * `resetKey` stops the reading when what it was reading goes away — opening a
 * different idea mid-sentence should not leave the old one talking over it.
 */
export function useReadOut(resetKey: string) {
  const speaker = useRef<Speaker | null>(null);
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /** Bumped on every start and stop, so a finished reading from before cannot clear a newer one. */
  const turn = useRef(0);

  useEffect(() => {
    speaker.current = browserSpeaker();
    setAvailable(speaker.current.available);
    return () => speaker.current?.stop();
  }, []);

  const stop = useCallback(() => {
    turn.current += 1;
    speaker.current?.stop();
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [resetKey, stop]);

  const read = useCallback(async (text: string) => {
    if (!speaker.current?.available) return;
    const mine = ++turn.current;
    setSpeaking(true);
    await speaker.current.speak(text);
    if (turn.current === mine) setSpeaking(false);
  }, []);

  return { available, speaking, read, stop };
}
