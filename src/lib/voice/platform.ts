'use client';

/**
 * The two places the voice stack has to know it is on a phone.
 *
 * Everything else in `src/lib/voice/` is written against the Web Speech API as
 * specified. These are the points where the specification and Chrome for
 * Android disagree, and where guessing wrong loses somebody's answer rather
 * than degrading the polish.
 *
 * Sniffing the user agent is the wrong tool for almost everything and the only
 * tool available for these two: neither behaviour is feature-detectable. There
 * is no property that says "`continuous` is ignored here", and the microphone
 * conflict below shows up as silence, not as an error. So the detector is
 * narrow, documented, and used in exactly two places.
 */

/**
 * A handset or tablet, where speech recognition runs through the platform
 * recogniser rather than Chrome's own.
 *
 * `userAgentData.mobile` is the supported answer and is Chromium-only, which is
 * fine — Chromium is where recognition exists. The string test carries iOS,
 * where Safari's `webkitSpeechRecognition` has the same one-shot shape, and
 * iPadOS, which reports a desktop user agent and is caught by the touch count.
 */
export function isHandheld(): boolean {
  if (typeof navigator === 'undefined') return false;

  const data = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof data?.mobile === 'boolean') return data.mobile;

  const agent = navigator.userAgent;
  if (/Android|iPhone|iPod/i.test(agent)) return true;
  // iPadOS presents itself as a Mac. Macs do not have a touchscreen.
  return /iPad|Macintosh/i.test(agent) && navigator.maxTouchPoints > 1;
}

/**
 * Whether the level meter may open its own capture alongside recognition.
 *
 * On a desktop the two coexist — `use-mic-level.ts` was written and measured
 * against exactly that. On Android they are competing for one input through the
 * platform audio stack, and the loser gets silence rather than an error. The
 * meter is decoration; the recognition is the turn. So on a handset the meter
 * does not open at all and the halo simply breathes.
 */
export function meterMaySharePlatformMicrophone(): boolean {
  return !isHandheld();
}

/**
 * Whether to leave a beat between the tutor's voice stopping and the
 * microphone opening.
 *
 * The hands-free loop speaks a turn and then listens. `speechSynthesis.cancel()`
 * returns immediately but Android releases audio focus asynchronously, and a
 * recogniser started inside that window opens against an output device that is
 * still winding down — it hears nothing, ends on its own silence timeout, and
 * the turn is lost with no error anywhere.
 *
 * Desktop does not need it and is not given it: that path has been used and is
 * working, and this project does not change validated behaviour without a
 * measurement.
 */
export function needsMicrophoneHandover(): boolean {
  return isHandheld();
}
