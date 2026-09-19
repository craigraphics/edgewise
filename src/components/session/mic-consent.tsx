'use client';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { useVoice } from '@/hooks/use-voice';

type Voice = ReturnType<typeof useVoice>;

/**
 * Starting the microphone, with the disclosure asked once rather than printed
 * every turn.
 *
 * The line about Google used to sit permanently under the voice switch, so it
 * guarded reading aloud as well — which sends nothing anywhere — and became
 * furniture that nobody reads by the third question. Said at the moment
 * somebody reaches for the microphone, and only then, it is the one time it is
 * actually information.
 */
export function useMicStart(voice: Voice) {
  const [asking, setAsking] = useState(false);

  const start = useCallback(() => {
    if (voice.micConsented) return voice.listen();
    setAsking(true);
  }, [voice]);

  const confirm = useCallback(() => {
    voice.consentToMic();
    setAsking(false);
    voice.listen();
  }, [voice]);

  const cancel = useCallback(() => setAsking(false), []);

  return { asking, start, confirm, cancel };
}

export function MicConsentNote({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="group" aria-label="Before the microphone opens" className="border-border bg-surface-1 space-y-2.5 rounded-lg border p-3">
      <p className="text-sm leading-relaxed">
        Your audio goes to Google to be turned into text. What you say is sent as your answer when you stop.
        Typing always works instead.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="touch" onClick={onConfirm} autoFocus>
          Open the microphone
        </Button>
        <Button size="touch" variant="ghost" onClick={onCancel}>
          Not now
        </Button>
      </div>
    </div>
  );
}
