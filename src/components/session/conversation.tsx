'use client';

import { ArrowRightIcon, AudioLines, Square, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMicLevel } from '@/hooks/use-mic-level';
import { useVoice } from '@/hooks/use-voice';
import type { ConceptNode, NodeState } from '@/lib/graph/types';
import type { Message } from '@/lib/session/use-session';
import { cn } from '@/lib/utils';

import { MicConsentNote, useMicStart } from './mic-consent';
import { VoiceHalo } from './voice-halo';

type Props = {
  messages: Message[];
  status: 'idle' | 'thinking' | 'running' | 'done' | 'error';
  error: string | null;
  /** Nothing on the map is marked yet — say plainly what this is. */
  firstTime: boolean;
  /** A conversation left partway through, found in this browser. */
  resumable: { question: string | null } | null;
  onStart: () => void;
  onResume: () => void;
  /** Throws the stored conversation away and begins a new one. Marks are kept. */
  onStartAgain: () => void;
  onAnswer: (text: string) => void;
  /** Clears the transcript only. Marks are kept. */
  onNewConversation: () => void;
  /** Asks first, then clears the map. */
  onClearMap: () => void;
  onRetry: () => void;
  onConfigure: () => void;
  onExplore: () => void;
  onWalk: () => void;
  onPlay: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  /** The node the map is pointing at, and what rests on it. */
  lead: { node: ConceptNode; state: NodeState; resting: number } | null;
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
export function Conversation({
  messages,
  status,
  error,
  firstTime,
  resumable,
  onStart,
  onResume,
  onStartAgain,
  onAnswer,
  onNewConversation, onClearMap, onRetry, onConfigure, onExplore, onWalk, onPlay, draft, onDraftChange,
  lead,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  const busy = status === 'thinking';
  const answering = status === 'running' || status === 'thinking';

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status !== 'running') return;
      onAnswer(trimmed);
      onDraftChange('');
    },
    [status, onAnswer, onDraftChange],
  );

  /*
   * Whether the learner's last answer was spoken.
   *
   * Hands-free is not a switch any more; it is what somebody is already doing.
   * Answer out loud and the next question, read aloud, opens the microphone
   * after it. Type an answer and it does not — the microphone opening on its
   * own for somebody who has just chosen the keyboard is the surprise this
   * split exists to remove.
   */
  const answeringAloud = useRef(false);

  const submitSpoken = useCallback(
    (text: string) => {
      answeringAloud.current = true;
      submit(text);
    },
    [submit],
  );

  const submitTyped = useCallback(
    (text: string) => {
      answeringAloud.current = false;
      submit(text);
    },
    [submit],
  );

  const voice = useVoice(submitSpoken);
  const mic = useMicStart(voice);

  /*
   * Measured only while the microphone is actually open. The tutor's own turn is
   * spoken through `speechSynthesis`, whose output cannot be metered from the
   * page, so the halo shows for both voices but only reacts to one — which is
   * the right way round, since the question it answers is "can it hear me".
   */
  // Not while the permission prompt is up: a second capture asking at the same
  // moment has nothing to measure yet.
  const micLevel = useMicLevel(voice.listening && !voice.waiting);

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
    if (!voice.readAloud) {
      lastSpoken.current = Math.max(0, messages.length - 1);
      return;
    }

    const latest = messages.length - 1;
    if (latest < lastSpoken.current) return;

    const message = messages[latest];
    if (!message || message.role !== 'assistant') return;

    lastSpoken.current = messages.length;
    // Leaving the microphone open after "that's everything" is unsettling.
    if (status === 'running' || status === 'done') void voice.say(message.content, status === 'running' && answeringAloud.current);
    /*
     * Deps are narrowed deliberately: the whole `voice` object is rebuilt every
     * render, so depending on it re-runs this constantly. `readAloud` and `say`
     * are the only fields read here, and `say` is stable per `readAloud`. The
     * marker guards against double-speaking, but relying on a guard to undo an
     * effect that should not have fired is how the sibling project ended up
     * with three stale audio loops fighting over one recorder.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, voice.readAloud, voice.say]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status, voice.interim]);

  /*
   * One name per destination, and it is the name the header switch uses:
   * "Find my starting point" and "Teach me everything". The walkthrough was
   * called five different things in this file alone — explore the walkthrough,
   * open walkthrough, open the walkthrough, revisit the walkthrough — so a
   * visitor had no way to tell they were all the same door.
   *
   * The rule that settles it: an ACTION says what happens, using the
   * destination's one name. A PLACE LABEL says where you are, so the phone tab
   * and the panel's `aria-label` still say "Walkthrough", exactly as they say
   * "Conversation" opposite "Find my starting point".
   */
  if (status === 'idle' && resumable) {
    return (
      <div className="shrink-0">
        <p className="eyebrow">Find your starting point</p>
        <h2 className="font-display mt-5 text-[clamp(2rem,3.1vw,3rem)] leading-[1.08] tracking-tight">
          Your conversation,<br /><em>where you left it.</em>
        </h2>
        {resumable.question && <>
          <p className="text-muted-foreground mt-5 text-sm">The last question was</p>
          <p className="font-display text-read border-border mt-2 max-w-[60ch] border-l-2 pl-3.5">{resumable.question}</p>
        </>}
        <Button size="touch" onClick={onResume} className="mt-6 min-h-12 w-full justify-between px-5">
          Pick up where you left off <ArrowRightIcon />
        </Button>
        {/* Starting again keeps every mark. Only the conversation goes. */}
        <Button size="touch" variant="outline" onClick={onStartAgain} className="mt-3 w-full">
          Start again
        </Button>
        <p className="text-muted-foreground mt-3 text-sm">Either way, your map stays as it is.</p>
        <p className="text-muted-foreground border-border mt-6 border-t pt-4 text-xs leading-relaxed">
          Your map and this conversation are saved in this browser. Answers go to our server and Google’s AI to find your starting point. Voice transcription also goes to Google.
        </p>
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <div className="shrink-0">
        <div>
          <p className="eyebrow">Find your starting point</p>
          <h2 className="font-display mt-5 text-[clamp(2rem,3.1vw,3rem)] leading-[1.08] tracking-tight">
            {firstTime ? <>Read the explainers.<br /><em>Still not clicking?</em></> : <>Your map,<br /><em>ready to revisit.</em></>}
          </h2>
          <p className="mt-5 text-base leading-relaxed">
            {firstTime ? 'One half-held idea can make everything after it harder to follow. A short conversation helps find where to begin.' : lead ? 'Keep exploring from the ideas already on your map. You can revisit any connection or continue the conversation.' : 'Every idea on this map is marked solid. Revisit an explanation, or have the whole thing taught again.'}
          </p>
          <Button size="touch" onClick={!firstTime && !lead ? onWalk : onStart} className="mt-6 min-h-12 w-full justify-between px-5">
            {firstTime ? 'Find my starting point' : lead ? 'Continue from my map' : 'Teach me everything'} <ArrowRightIcon />
          </Button>
          <p className="text-muted-foreground mt-3 text-sm">Speak or type. No maths or code. “I don’t know” is a useful place to start.</p>
          <button onClick={onPlay} className="mt-4 min-h-11 w-full text-left text-sm underline underline-offset-4">Or see how one neuron scores a movie →</button>
          {!firstTime && lead && <button onClick={onExplore} className="starting-point mt-6 w-full text-left">
            <span className="eyebrow">A place to explore</span>
            <span className="font-display mt-2 block text-xl">{lead.node.label}</span>
            <span className="text-muted-foreground mt-2 block text-sm">{lead.resting ? `${lead.resting} later ideas build on this one.` : lead.node.subtitle}</span>
          </button>}
          <div className="border-border mt-8 border-t pt-5">
            <p className="eyebrow">What you leave with</p>
            <p className="font-display mt-3 text-read">A map of what holds, what is half-held, and what to explore next.</p>
            <p className="text-muted-foreground mt-3 text-sm">Read any idea now. Listening to an explanation never changes a mark; explaining it in your own words can.</p>
            <button onClick={onWalk} className="mt-4 min-h-10 text-sm underline underline-offset-4">Or teach me everything</button>
          </div>
          <p className="text-muted-foreground border-border mt-6 border-t pt-4 text-xs leading-relaxed">
            Your map is saved in this browser. Answers go to our server and Google’s AI to find your starting point. Voice transcription also goes to Google.
          </p>
        </div>
      </div>
    );
  }

  /*
   * The pinned turn is the tutor's most recent one: the live question, and at
   * the end the closing.
   *
   * The closing used to drop into the transcript with everything else, on the
   * reasoning that there was nothing left to answer. But the pinned turn is the
   * live region, so a screen reader heard every question and then silence: the
   * sentence naming where to begin, and the control that goes there, were
   * never announced. Keeping the same element and changing what is in it is
   * what makes the ending heard.
   */
  const lastTutor = [...messages].reverse().find((message) => message.role !== 'user');
  const done = status === 'done';
  const pinned = lastTutor ?? null;
  const current = pinned?.content ?? null;
  const history = pinned ? messages.filter((message) => message !== pinned) : messages;

  return (
    // The shell sizes this now; it fills whatever the panel gives it.
    <VoiceHalo
      active={voice.listening || voice.speaking}
      level={micLevel}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/*
       * The question being asked sits OUTSIDE the scroll container.
       *
       * This project's own layout rule — what you look at while listening does
       * not move — held for the progress line and the current concept and not
       * for the one thing the learner is actually being asked. The transcript
       * grows, the pane scrolls to its end, and a long turn puts the top of the
       * question above the fold: somebody had to scroll up to find out what
       * they were answering. That is the single worst thing this panel could
       * do.
       *
       * So the live turn is pinned here, and only what came before it scrolls.
       */}
      {current ? (
        <div className={cn('border-border/60 mb-4 shrink-0 overflow-y-auto border-b pb-4', done ? 'max-h-[70%]' : 'max-h-[42%]')} tabIndex={0} role="region" aria-label={done ? 'Where this leaves you' : 'Current question'}>
          {/*
           * Reading aloud is a preference about the question, so it sits with
           * the question. It used to live at the bottom of the composer, under
           * a divider, fused to the microphone.
           */}
          <div className="mb-2 flex min-h-10 items-center justify-between gap-2">
            <p className="eyebrow">{done ? 'Where this leaves you' : 'A place to begin'}</p>
            <ReadAloudControl voice={voice} />
          </div>
          <div aria-live="polite" aria-atomic="true">
            <p key={current} className="font-display text-read edgewise-rise max-w-[60ch]">{current}</p>
            {done ? (
              <div className="mt-5 space-y-3">
                <p className="eyebrow">Your next step</p>
                {lead && <p className="font-display text-xl">{lead.node.label}</p>}
                <Button size="touch" onClick={onExplore} className="min-h-12 w-full">
                  {lead ? 'Explore this idea' : 'Teach me everything'} <ArrowRightIcon />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/*
       * The transcript only claims the spare room once there is a transcript.
       *
       * Bottom-anchored from the first turn, the composer sat six hundred
       * pixels below the question with nothing in between — so the two things
       * somebody needs at once, what they were asked and where to answer it,
       * were at opposite ends of the panel. With history it behaves the usual
       * way and the composer stays put at the bottom.
       */}
      <div
        className={cn(
          'min-h-0 space-y-6 overflow-y-auto pr-1',
          history.length > 0 && 'flex-1',
        )}
      >
        {history.map((message, index) =>
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
          <p role="status" className="text-muted-foreground font-display text-read">Working with your answer…</p>
        ) : null}
        {error ? <p role="alert" className="text-base leading-relaxed">{error}</p> : null}
        {voice.error ? (
          <p role="alert" className="text-base leading-relaxed">{voice.error}</p>
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
        {status === 'error' ? (
          <div className="space-y-3">
            <p className="text-sm">Your answer is still here. Retry when you’re ready, or read the ideas while you wait.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="touch" onClick={onRetry}>Retry this turn</Button>
              <Button size="touch" variant="outline" onClick={onConfigure}>Connection settings</Button>
              <Button size="touch" variant="ghost" onClick={onWalk}>Teach me everything</Button>
            </div>
          </div>
        ) : status === 'done' ? (
          <div className="space-y-3">
            {/*
             * Two different actions, deliberately far apart in weight. A fresh
             * conversation keeps every mark; it used to wipe the whole map in
             * one unconfirmed press, from the screen somebody reaches at the
             * exact moment the map has become worth having.
             */}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="touch" onClick={onNewConversation}>Start a fresh conversation</Button>
              <Button variant="ghost" size="touch" onClick={onClearMap} className="text-muted-foreground">Clear my map…</Button>
            </div>
          </div>
        ) : (
          <>
            {voice.listening ? (
              /* Holds the textarea's height so nothing under it moves when the
                 microphone opens. Stopping lives in the button below, which is
                 the same control that started it. */
              <div className="border-border flex h-[5.25rem] items-center rounded-lg border border-dashed px-3">
                <span role="status" className={cn('text-muted-foreground', voice.waiting ? 'text-sm' : 'text-base')}>
                  {voice.waiting ? 'Waiting for the microphone… allow it when your browser asks.' : 'Listening…'}
                </span>
              </div>
            ) : (
              <Textarea
                aria-label="Your answer"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitTyped(draft);
                  }
                }}
                placeholder="Say what you think — half-formed is fine"
                rows={3}
                disabled={!answering || busy}
                className="bg-surface-1 resize-none"
              />
            )}

            {mic.asking ? (
              <div className="mt-2.5">
                <MicConsentNote onConfirm={mic.confirm} onCancel={mic.cancel} />
              </div>
            ) : null}

            {/*
             * Two groups, not one wrapping row. The alternative answer on the
             * left, and the two ways of sending on the right, with Send last —
             * where the eye ends and where every composer people have used puts
             * it.
             */}
            <div className="mt-2.5 flex flex-wrap items-start justify-between gap-x-2 gap-y-2.5">
              {/*
               * A real button, not permission buried in a prompt — and not a
               * ghost either. The escape hatch has to be as easy to reach as
               * the answer, or someone who feels they should know will guess
               * instead, which tells the diagnostic nothing and makes them feel
               * worse.
               *
               * Why it helps sits directly under it and is tied to it. Set
               * beside both buttons, it read as a caption for the row, and it
               * was unclear which of the two it described.
               */}
              {/*
               * The two alternatives to answering sit together, with the
               * caption under the pair rather than in a column of its own:
               * set as its own column it was the widest thing on the row, and
               * with Skip beside it the row overflowed a laptop's panel by 2px
               * and broke unevenly.
               *
               * Skip is always valid and always moves on. The server recognises
               * it before any model call and records it as "I don't know" is
               * recorded, so it can never come back as the same question.
               */}
              <div className="flex flex-col items-start gap-1">
                <div className="flex gap-2">
                  <Button
                    size="touch"
                    variant="outline"
                    onClick={() => submit("I don't know")}
                    disabled={!answering || busy}
                    aria-describedby="idk-why"
                  >
                    I don&rsquo;t know
                  </Button>
                  <Button size="touch" variant="outline" onClick={() => submit('Skip')} disabled={!answering || busy}>
                    Skip
                  </Button>
                </div>
                <span id="idk-why" className="text-muted-foreground text-2xs">
                  helps me find where to begin
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/*
                 * One control for talking, not two: it starts the microphone and
                 * stops it, the way voice mode works everywhere else people have
                 * met it. Available whether or not the questions are read aloud
                 * — answering out loud and listening are separate choices.
                 *
                 * Wave rather than a microphone, beside Send rather than inside
                 * the field, because this is not dictation. What you say is not
                 * typed into the box for you to edit: it IS the answer, and it
                 * goes off the moment you stop. That is the convention people
                 * have already met — a wave next to Send is voice mode, a
                 * microphone in the field is dictation.
                 *
                 * An icon at rest, labelled once it is doing something. With a
                 * label as well, the row needed ~400px and the panel gives it
                 * 349 on a laptop, so it wrapped into a ragged second line. The
                 * first press explains itself through the consent note, and the
                 * listening state says "Stop and send" in words.
                 */}
                {voice.supported.listen ? (
                  <Button
                    size={voice.listening ? 'touch' : 'icon-touch'}
                    variant={voice.listening ? 'default' : 'outline'}
                    onClick={voice.listening ? voice.stopListening : mic.start}
                    // Stopping stays available even mid-request; only starting is
                    // held back while a turn is in flight.
                    disabled={(busy || !answering || mic.asking) && !voice.listening}
                    aria-label={voice.waiting ? 'Cancel' : voice.listening ? 'Stop talking and send it' : 'Answer out loud'}
                    title={voice.waiting ? 'Cancel' : voice.listening ? 'Stop talking and send it' : 'Answer out loud'}
                  >
                    {voice.listening ? <Square className="fill-current" /> : <AudioLines />}
                    {/* Nothing has been heard yet, so there is nothing to send. */}
                    {voice.waiting ? 'Cancel' : voice.listening ? 'Stop and send' : null}
                  </Button>
                ) : null}

                {voice.listening ? null : (
                  <Button size="touch" onClick={() => submitTyped(draft)} disabled={busy || !draft.trim()}>
                    Send
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </VoiceHalo>
  );
}

/**
 * Whether the tutor's turns are read out. A standing preference, not a mode:
 * it changes nothing about how somebody answers.
 *
 * While a turn is being read the same place offers to stop it, since that is
 * where somebody looks when they want the reading to stop — and stopping one
 * reading is not the same as turning reading off.
 */
function ReadAloudControl({ voice }: { voice: ReturnType<typeof useVoice> }) {
  if (!voice.supported.speak) return null;

  if (voice.speaking) {
    return (
      <Button size="touch" variant="ghost" onClick={voice.stopSpeaking} className="-mr-2">
        <Square className="fill-current" /> Stop reading
      </Button>
    );
  }

  return (
    <Button
      size="touch"
      variant="ghost"
      onClick={voice.toggleReadAloud}
      aria-pressed={voice.readAloud}
      className={cn('-mr-2', !voice.readAloud && 'text-muted-foreground')}
    >
      {voice.readAloud ? <Volume2 /> : <VolumeX />} Read aloud
    </Button>
  );
}
