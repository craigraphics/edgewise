import { afterEach, describe, expect, it, vi } from 'vitest';

import { isHandheld, meterMaySharePlatformMicrophone, needsMicrophoneHandover } from './platform';

/**
 * Sniffing the user agent is the wrong tool for almost everything, so the two
 * places it is used here are pinned down: the cases it must catch, the cases it
 * must not, and the fact that both callers agree with it.
 */

function agent(fields: { userAgent?: string; maxTouchPoints?: number; userAgentData?: { mobile: boolean } }) {
  vi.stubGlobal('navigator', { userAgent: '', maxTouchPoints: 0, ...fields });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SAFARI_IPADOS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

describe('isHandheld', () => {
  it('believes the client hint when there is one', () => {
    agent({ userAgent: CHROME_MAC, userAgentData: { mobile: true } });
    expect(isHandheld()).toBe(true);

    agent({ userAgent: CHROME_ANDROID, userAgentData: { mobile: false } });
    expect(isHandheld()).toBe(false);
  });

  it('catches Android Chrome, the browser this exists for', () => {
    agent({ userAgent: CHROME_ANDROID });
    expect(isHandheld()).toBe(true);
  });

  it('catches iOS, which has the same one-shot recogniser', () => {
    agent({ userAgent: SAFARI_IOS });
    expect(isHandheld()).toBe(true);
  });

  it('catches iPadOS, which claims to be a Mac', () => {
    // The touch count is the only thing separating these two strings.
    agent({ userAgent: SAFARI_IPADOS, maxTouchPoints: 5 });
    expect(isHandheld()).toBe(true);
  });

  it('leaves the desktop alone', () => {
    agent({ userAgent: CHROME_MAC, maxTouchPoints: 0 });
    expect(isHandheld()).toBe(false);
  });

  it('is false where there is no navigator at all', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isHandheld()).toBe(false);
  });
});

describe('the two callers', () => {
  it('keep the level meter off a phone and on a desktop', () => {
    agent({ userAgent: CHROME_ANDROID });
    expect(meterMaySharePlatformMicrophone()).toBe(false);

    agent({ userAgent: CHROME_MAC });
    expect(meterMaySharePlatformMicrophone()).toBe(true);
  });

  it('leave a handover beat on a phone and none on a desktop', () => {
    agent({ userAgent: CHROME_ANDROID });
    expect(needsMicrophoneHandover()).toBe(true);

    agent({ userAgent: CHROME_MAC });
    expect(needsMicrophoneHandover()).toBe(false);
  });

  it('agree with each other, because both are one question', () => {
    for (const userAgent of [CHROME_ANDROID, SAFARI_IOS, CHROME_MAC]) {
      agent({ userAgent });
      expect(needsMicrophoneHandover()).toBe(!meterMaySharePlatformMicrophone());
    }
  });
});
