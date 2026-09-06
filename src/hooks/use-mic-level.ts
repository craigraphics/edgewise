'use client';

import { useEffect, useState } from 'react';

import { meterMaySharePlatformMicrophone } from '@/lib/voice/platform';

/**
 * How loudly the learner is talking, 0–1, while the microphone is open.
 *
 * The Web Speech API reports words and nothing else — it has no amplitude, no
 * levels, no events between results. So this opens its own capture alongside
 * recognition purely to measure. Desktop Chrome runs both on one microphone
 * without complaint, and the second stream is the only way to show someone that
 * they are being heard *while* they are still mid-sentence rather than a second
 * later when a word lands.
 *
 * On a handset it does not, and the cost of finding out is the whole turn: the
 * platform recogniser and this capture compete for one input, and the loser
 * gets silence rather than an error. So on a phone this does not open at all —
 * see `meterMaySharePlatformMicrophone`. The meter is decoration; the
 * recognition is the answer, and a decoration is never allowed to cost one.
 *
 * Nothing measured here leaves the browser. Recognition already sends the audio
 * to Google and the UI says so; this adds no new exposure, only a meter.
 *
 * Failing to open it is not an error worth reporting. The turn is carried by
 * recognition; this is the animation on top of it, so it fails to zero and the
 * halo simply breathes instead of reacting.
 */

/** UI updates per second. The analysis loop itself runs at the display rate. */
const LEVEL_HZ = 15;

/**
 * Quietest peak treated as "someone talking".
 *
 * The gain below normalises against the loudest thing heard recently, which on
 * its own would stretch room tone up to full scale in a silent room and leave
 * the halo pulsing at a fridge. This is the floor that stops it.
 */
const MIN_PEAK = 0.02;

/**
 * How fast the reference peak decays, per frame.
 *
 * Normalising against a recent peak rather than a fixed constant is what makes
 * this work on a headset and a laptop microphone, and for a quiet talker and a
 * loud one, without a calibration step. At 60fps this halves in roughly two
 * seconds — long enough to span a sentence, short enough that it follows you
 * when you drop your voice.
 */
const PEAK_DECAY = 0.995;

export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active || !meterMaySharePlatformMicrophone()) return;

    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;

    async function meter() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return;
      }

      // The turn can end while the permission round-trip is in flight; without
      // this the stream outlives the effect that asked for it and the recording
      // indicator stays lit after the microphone is supposed to be closed.
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);

      const samples = new Float32Array(analyser.fftSize);
      let peak = MIN_PEAK;
      let lastPush = 0;

      const tick = () => {
        frame = requestAnimationFrame(tick);

        analyser.getFloatTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) sumSquares += samples[i] * samples[i];
        const rms = Math.sqrt(sumSquares / samples.length);

        peak = Math.max(rms, peak * PEAK_DECAY, MIN_PEAK);

        // Throttled because every push re-renders the panel. The loop still runs
        // at frame rate so the peak keeps tracking between updates.
        const now = performance.now();
        if (now - lastPush < 1000 / LEVEL_HZ) return;
        lastPush = now;

        setLevel(Math.min(1, rms / peak));
      };

      frame = requestAnimationFrame(tick);
    }

    void meter();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      setLevel(0);
    };
  }, [active]);

  return level;
}
