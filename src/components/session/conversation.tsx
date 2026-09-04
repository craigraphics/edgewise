'use client';

import { AudioLines, InfoIcon, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMicLevel } from '@/hooks/use-mic-level';
import { useVoice } from '@/hooks/use-voice';
import type { Message } from '@/lib/session/use-session';
import { cn } from '@/lib/utils';

import { VoiceHalo } from './voice-halo';

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

/**
 * The conversation, as a reading surface rather than a chat app.
 *
 * The tutor's turns are the emotional centre of this product — they are the
 * only place it speaks to a person — and they were set in the same 14px UI face
 * as a button label, sixteen pixels apart, with the learner's replies marked
 * only by a grey chip and a 24px indent.
 *
 * So: the tutor speaks in the display face at reading size on a comfortable
 * measure, and the learner's own words are set smaller and quieter in the UI
 * face. No bubbles either way. The asymmetry is the point — one of these voices
 * is being read, the other is being recorded.
 */
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
   * Measured only while the microphone is actually open. The tutor's own turn is
   * spoken through `speechSynthesis`, whose output cannot be metered from the
   * page, so the halo shows for both voices but only reacts to one — which is
   * the right way round, since the question it answers is "can it hear me".
   */
  const micLevel = useMicLevel(voice.listening);

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
    /*
     * Deps are narrowed deliberately: the whole `voice` object is rebuilt every
     * render, so depending on it re-runs this constantly. `enabled` and `say`
     * are the only fields read here, and `say` is stable per `enabled`. The
     * marker guards against double-speaking, but relying on a guard to undo an
     * effect that should not have fired is how the sibling project ended up
     * with three stale audio loops fighting over one recorder.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, voice.enabled, voice.say]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status, voice.interim]);

  if (status === 'idle') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/*
         * A first-time visitor has no idea which of the two modes to pick or
         * what either does. This is the one place to say it, in the order it
         * happens.
         */}
        {firstTime ? (
          <>
            <h2 className="font-display text-2xl font-semibold">Start here</h2>
            <ol className="mt-5 space-y-3.5">
              {[
                'A few questions, so it can work out what you already have. Two minutes.',
                'The map fills in as you go.',
                'Then it walks you through the whole thing, whatever you knew.',
              ].map((line, index) => (
                <li key={line} className="flex gap-3">
                  <span className="border-border text-muted-foreground tabular mt-px flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground text-base leading-relaxed">{line}</span>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground mt-5 text-base leading-relaxed">
              Nothing is scored, and &ldquo;I don&rsquo;t know&rdquo; is a genuinely useful answer.
            </p>
          </>
        ) : (
          <p className="font-display text-read max-w-[60ch]">
            A short conversation to find where your understanding of this currently stops. Nothing is
            scored, and &ldquo;I don&rsquo;t know&rdquo; is a genuinely useful answer.
          </p>
        )}
        <Button size="touch" onClick={onStart} className="mt-6">
          {firstTime ? 'Start the questions' : 'Start'}
        </Button>
        {error ? <p className="text-muted-foreground mt-4 text-base leading-relaxed">{error}</p> : null}
      </div>
    );
  }

  return (
    // The shell sizes this now; it fills whatever the panel gives it.
    <VoiceHalo
      active={voice.listening || voice.speaking}
      level={micLevel}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        {messages.map((message, index) =>
          message.role === 'user' ? (
            /*
             * The learner's own words, set back and set quieter. Not a bubble:
             * bubbles make a transcript, and a transcript of being questioned
             * is the exam this product cannot look like.
             */
            <div key={index} className="border-border/70 border-l-2 pl-3.5">
              <p className="text-muted-foreground text-base leading-relaxed">{message.content}</p>
            </div>
          ) : (
            <p key={index} className="font-display text-read edgewise-rise max-w-[60ch]">
              {message.content}
            </p>
          ),
        )}

        {voice.interim ? (
          <div className="border-border/40 border-l-2 pl-3.5">
            <p className="text-muted-foreground text-base leading-relaxed italic">{voice.interim}</p>
          </div>
        ) : null}

        {/*
         * Thinking, in the tutor's own face — so the wait reads as the same
         * voice pausing rather than as the interface loading. No bouncing dots.
         */}
        {busy ? (
          <p className="text-muted-foreground font-display text-read animate-pulse">Thinking…</p>
        ) : null}
        {error ? <p className="text-muted-foreground text-base leading-relaxed">{error}</p> : null}
        {voice.error ? (
          <p className="text-muted-foreground text-base leading-relaxed">{voice.error}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      {/*
       * The composer, on a surface of its own.
       *
       * Without one the panel had no visible bottom edge, so at rest it read as
       * a column of text that happened to stop — and the voice halo, which
       * lights the panel's real edges, had nothing at this end to come off.
       */}
      <div className="edgewise-raised border-border relative z-10 mt-4 shrink-0 rounded-xl border p-3">
        {status === 'done' ? (
          /* Named for what the tools menu already calls this exact action, now
             that it does the same thing: the map is cleared, not just the
             transcript. */
          <Button variant="outline" size="touch" onClick={onReset} className="w-full">
            Start over
          </Button>
        ) : (
          <>
            {voice.listening ? (
              /* Holds the textarea's height so nothing under it moves when the
                 microphone opens. Stopping lives in the button below, which is
                 the same control that started it. */
              <div className="border-border flex h-[5.25rem] items-center rounded-lg border border-dashed px-3">
                <span className="text-muted-foreground text-base">Listening…</span>
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
                className="bg-surface-1 resize-none"
              />
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button size="touch" onClick={() => submit(draft)} disabled={busy || !draft.trim()}>
                Send
              </Button>

              {/*
               * A real button, not permission buried in a prompt — and not a
               * ghost either. The escape hatch has to be as easy to reach as
               * the answer, or someone who feels they should know will guess
               * instead, which tells the diagnostic nothing and makes them feel
               * worse. It was styled as the quietest control on the row, next
               * to "Stop reading"; it is the most useful answer anyone gives
               * here and it is now styled like one.
               */}
              <Button size="touch" variant="outline" onClick={() => submit("I don't know")} disabled={busy}>
                I don&rsquo;t know
              </Button>

              {voice.speaking ? (
                <Button size="touch" variant="ghost" onClick={voice.stopSpeaking}>
                  Stop reading
                </Button>
              ) : null}

              {/*
               * One control for talking, not two: it starts the microphone and
               * stops it, the way voice mode works everywhere else people have
               * met it.
               *
               * Wave rather than a microphone because this is not dictation.
               * What you say is not typed into the box for you to edit and
               * send: it IS the answer, it goes off the moment you stop, and
               * the tutor talks back. A microphone icon would promise a
               * transcript you get to correct first.
               */}
              {voice.supported.listen && voice.enabled ? (
                <Button
                  size="touch"
                  className="ml-auto w-10 px-0"
                  variant={voice.listening ? 'default' : 'outline'}
                  onClick={voice.listening ? voice.stopListening : voice.listen}
                  // Stopping stays available even mid-request; only starting is
                  // held back while a turn is in flight.
                  disabled={busy && !voice.listening}
                  aria-label={voice.listening ? 'Stop talking and send it' : 'Answer out loud'}
                  title={voice.listening ? 'Stop talking and send it' : 'Answer out loud'}
                >
                  {voice.listening ? <Square className="fill-current" /> : <AudioLines />}
                </Button>
              ) : null}
            </div>

            <VoiceToggle voice={voice} />
          </>
        )}
      </div>
    </VoiceHalo>
  );
}

function VoiceToggle({ voice }: { voice: ReturnType<typeof useVoice> }) {
  const [noteOpen, setNoteOpen] = useState(false);

  if (!voice.supported.listen && !voice.supported.speak) {
    return (
      <p className="text-muted-foreground mt-2.5 text-2xs">
        This browser has no speech support — Chrome does. Typing works everywhere.
      </p>
    );
  }

  return (
    <div className="mt-2.5 flex items-center gap-2">
      <button
        type="button"
        onClick={voice.toggle}
        className={cn(
          'text-2xs transition-colors duration-[--dur-fast]',
          voice.enabled ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {voice.enabled ? 'Turn the voice off' : 'Read the questions aloud'}
      </button>

      {/*
       * Chrome's recognition is not on-device — the audio goes to Google — and
       * the spec's description of this path as "free, no server cost" is true
       * of money and not of privacy. So it is still said before the microphone
       * opens, and still not buried in a policy page. It is behind a control
       * rather than printed under the composer because as permanent body text
       * it became furniture, which is the one thing a disclosure must not be.
       */}
      {voice.enabled ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setNoteOpen((open) => !open)}
            aria-expanded={noteOpen}
            aria-label="Where your voice goes"
            className="text-muted-foreground hover:text-foreground flex items-center transition-colors duration-[--dur-fast]"
          >
            <InfoIcon className="size-3.5" />
          </button>
          {noteOpen ? (
            <div className="edgewise-raised border-border absolute bottom-full left-0 z-40 mb-2 w-64 rounded-lg border p-3">
              <p className="text-muted-foreground text-2xs leading-relaxed">
                Chrome sends what you say to Google to transcribe it — it is not done on your computer.
                Typing stays available throughout.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
