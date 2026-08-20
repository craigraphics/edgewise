'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoice } from '@/hooks/use-voice';
import type { Message } from '@/lib/session/use-session';

type Props = {
  messages: Message[];
  status: 'idle' | 'thinking' | 'running' | 'done' | 'error';
  error: string | null;
  /** No marks and no walkthrough progress yet — say plainly what this is. */
  firstTime: boolean;
  onStart: () => void;
  onAnswer: (text: string) => void;
  onReset: () => void;
};

export function Conversation({ messages, status, error, firstTime, onStart, onAnswer, onReset }: Props) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const busy = status === 'thinking';
  const answering = status === 'running' || status === 'thinking';

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      onAnswer(trimmed);
      setDraft('');
    },
    [busy, onAnswer],
  );

  const voice = useVoice(submit);

  /*
   * Speak each new tutor turn once.
   *
   * Tracked by index rather than by content because the same question can
   * legitimately be asked twice — a follow-up often rephrases very little — and
   * comparing text would silently skip it.
   */
  const lastSpoken = useRef(0);

  useEffect(() => {
    /*
     * Turning voice on mid-question reads THAT question, and nothing older.
     * Parking the marker one behind means the turn already on screen gets
     * spoken when voice comes on — which is what someone reaching for the
     * toggle is asking for — while the backlog stays silent, because only the
     * latest message is ever considered below.
     */
    if (!voice.enabled) {
      lastSpoken.current = Math.max(0, messages.length - 1);
      return;
    }

    const latest = messages.length - 1;
    if (latest < lastSpoken.current) return;

    const message = messages[latest];
    if (!message || message.role !== 'assistant') return;

    lastSpoken.current = messages.length;
    // Leaving the microphone open after "that's everything" is unsettling.
    void voice.say(message.content, status !== 'done');
    // Depends on the two stable fields rather than the whole `voice` object,
    // which is rebuilt every render and would re-run this on each one. The
    // marker guards against double-speaking, but relying on a guard to undo an
    // effect that should not have fired is how the sibling project ended up
    // with three stale audio loops fighting over one recorder.
    /*
     * Deps are narrowed deliberately: the whole `voice` object is rebuilt every
     * render, so depending on it re-runs this constantly. `enabled` and `say`
     * are the only fields read here, and `say` is stable per `enabled`.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, voice.enabled, voice.say]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status, voice.interim]);

  if (status === 'idle') {
    return (
      <div className="space-y-4">
        {/*
         * A first-time visitor has no idea which of the two buttons above to
         * press or what either does. This is the one place to say it, in the
         * order it happens.
         */}
        {firstTime ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">Start here</h2>
            <ol className="text-muted-foreground space-y-2 text-sm leading-relaxed">
              <li>
                <span className="text-foreground font-medium">1.</span> A few questions, so it can work out what
                you already have. Two minutes.
              </li>
              <li>
                <span className="text-foreground font-medium">2.</span> The map fills in as you go.
              </li>
              <li>
                <span className="text-foreground font-medium">3.</span> Then it walks you through the whole thing,
                whatever you knew.
              </li>
            </ol>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Nothing is scored, and &ldquo;I don&rsquo;t know&rdquo; is a genuinely useful answer.
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed">
            A short conversation to find where your understanding of this currently stops. Nothing is scored, and
            &ldquo;I don&rsquo;t know&rdquo; is a genuinely useful answer.
          </p>
        )}
        <Button size="touch" onClick={onStart}>
          {firstTime ? 'Start the questions' : 'Start'}
        </Button>
        {error ? <p className="text-muted-foreground text-sm leading-relaxed">{error}</p> : null}
      </div>
    );
  }

  return (
    // The shell sizes this now; it fills whatever the aside gives it.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'pl-6' : undefined}>
            <p
              className={
                message.role === 'user'
                  ? 'bg-muted rounded-lg px-3 py-2 text-sm leading-relaxed'
                  : 'text-sm leading-relaxed'
              }
            >
              {message.content}
            </p>
          </div>
        ))}

        {voice.interim ? (
          <div className="pl-6">
            <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm leading-relaxed italic">
              {voice.interim}
            </p>
          </div>
        ) : null}

        {busy ? <p className="text-muted-foreground text-sm">…</p> : null}
        {error ? <p className="text-muted-foreground text-sm leading-relaxed">{error}</p> : null}
        {voice.error ? <p className="text-muted-foreground text-sm leading-relaxed">{voice.error}</p> : null}
        <div ref={endRef} />
      </div>

      <div className="mt-4 space-y-2">
        {status === 'done' ? (
          <Button variant="outline" size="touch" onClick={onReset}>
            Start again
          </Button>
        ) : (
          <>
            {voice.listening ? (
              <div className="border-foreground/25 flex h-[5.25rem] items-center justify-between rounded-md border border-dashed px-3">
                <span className="text-muted-foreground text-sm">Listening…</span>
                <Button size="touch" variant="outline" onClick={voice.stopListening}>
                  Done talking
                </Button>
              </div>
            ) : (
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit(draft);
                  }
                }}
                placeholder="Say what you think — half-formed is fine"
                rows={3}
                disabled={!answering || busy}
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="touch" onClick={() => submit(draft)} disabled={busy || !draft.trim()}>
                Send
              </Button>

              {/*
               * A real button, not permission buried in a prompt. The escape
               * hatch has to be as easy to reach as the answer, or someone who
               * feels they should know will guess instead — which tells the
               * diagnostic nothing and makes them feel worse.
               */}
              <Button size="touch" variant="ghost" onClick={() => submit("I don't know")} disabled={busy}>
                I don&rsquo;t know
              </Button>

              {voice.supported.listen && voice.enabled && !voice.listening ? (
                <Button size="touch" variant="outline" onClick={voice.listen} disabled={busy}>
                  Answer out loud
                </Button>
              ) : null}

              {voice.speaking ? (
                <Button size="touch" variant="ghost" onClick={voice.stopSpeaking}>
                  Stop reading
                </Button>
              ) : null}
            </div>

            <VoiceToggle voice={voice} />
          </>
        )}
      </div>
    </div>
  );
}

function VoiceToggle({ voice }: { voice: ReturnType<typeof useVoice> }) {
  if (!voice.supported.listen && !voice.supported.speak) {
    return (
      <p className="text-muted-foreground text-xs">
        This browser has no speech support — Chrome does. Typing works everywhere.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 pt-1">
      <button
        type="button"
        onClick={voice.toggle}
        className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
      >
        {voice.enabled ? 'Turn the voice off' : 'Read the questions aloud'}
      </button>
      {/*
       * Said before the microphone opens, not buried in a policy page. Chrome's
       * recognition is not on-device — the audio goes to Google — and the spec's
       * description of this path as "free, no server cost" is true of money and
       * not of privacy.
       */}
      {voice.enabled ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Chrome sends what you say to Google to transcribe it. Typing stays available throughout.
        </p>
      ) : null}
    </div>
  );
}
