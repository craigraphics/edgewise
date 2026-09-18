'use client';

import { ArrowRightIcon, AudioLines, Square } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMicLevel } from '@/hooks/use-mic-level';
import { useVoice } from '@/hooks/use-voice';
import type { ConceptNode, NodeState } from '@/lib/graph/types';
import type { Message } from '@/lib/session/use-session';
import { cn } from '@/lib/utils';

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
    const voiced = voice.readAloud || voice.handsFree;
    if (!voiced) {
      lastSpoken.current = Math.max(0, messages.length - 1);
      return;
    }

    const latest = messages.length - 1;
    if (latest < lastSpoken.current) return;

    const message = messages[latest];
    if (!message || message.role !== 'assistant') return;

    lastSpoken.current = messages.length;
    // Leaving the microphone open after "that's everything" is unsettling.
    if (status === 'running' || status === 'done') void voice.say(message.content, status === 'running');
    /*
     * Deps are narrowed deliberately: the whole `voice` object is rebuilt every
     * render, so depending on it re-runs this constantly. The two settings and `say`
     * are the only fields read here, and `say` is stable per setting. The
     * marker guards against double-speaking, but relying on a guard to undo an
     * effect that should not have fired is how the sibling project ended up
     * with three stale audio loops fighting over one recorder.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, voice.readAloud, voice.handsFree, voice.say]);

  /*
   * A listen press re-reads the question on screen and then opens the
   * microphone. With reading aloud already on, that question has been spoken
   * and the marker is past it, so without parking it here the press would do
   * nothing at all.
   */
  const talkAndListen = useCallback(() => {
    lastSpoken.current = Math.max(0, messages.length - 1);
    voice.startHandsFree();
  }, [messages.length, voice]);

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
          <p className="eyebrow mb-3">{done ? 'Where this leaves you' : 'A place to begin'}</p>
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
                <span className="text-muted-foreground text-base">Listening…</span>
              </div>
            ) : (
              <Textarea
                aria-label="Your answer"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
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
              <Button size="touch" variant="outline" onClick={() => submit("I don't know")} disabled={!answering || busy}>
                I don&rsquo;t know
              </Button>

              {/*
               * Skip is always valid and always moves on. The server recognises
               * it before any model call and records it as "I don't know" is
               * recorded, so it can never come back as the same question.
               */}
              <Button size="touch" variant="outline" onClick={() => submit('Skip')} disabled={!answering || busy}>
                Skip
              </Button>

              {/*
               * Why it helps, next to the button rather than in a paragraph
               * somewhere.
               *
               * Styled as the alternative to a disabled Send, it still read as
               * the thing you press when you have failed at the real one. It is
               * the most useful answer anybody gives here — it is information,
               * not an absence of it — and the sentence saying so has to be
               * within a glance of the control, at the moment somebody is
               * deciding whether to guess instead.
               */}
              <span className="text-muted-foreground order-last w-full text-2xs sm:order-none sm:w-auto">
                helps me find where to begin
              </span>

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
              {voice.supported.listen && voice.handsFree ? (
                <Button
                  size="touch"
                  className="ml-auto"
                  variant={voice.listening ? 'default' : 'outline'}
                  onClick={voice.listening ? voice.stopListening : voice.listen}
                  // Stopping stays available even mid-request; only starting is
                  // held back while a turn is in flight.
                  disabled={busy && !voice.listening}
                  title={voice.listening ? 'Stop talking and send it' : 'Answer out loud'}
                >
                  {voice.listening ? <Square className="fill-current" /> : <AudioLines />}
                  {/* Labelled, not an icon on its own. Answering out loud is a
                      different route through the product rather than a
                      preference, and an unlabelled glyph makes it look like a
                      setting somebody else has already decided about. */}
                  {voice.listening ? 'Stop and send' : 'Answer out loud'}
                </Button>
              ) : null}
            </div>

            <VoiceControls voice={voice} onTalkAndListen={talkAndListen} />
          </>
        )}
      </div>
    </VoiceHalo>
  );
}

/**
 * Two separate consents, two separate controls.
 *
 * Reading aloud sends nothing anywhere and is remembered. Talking and listening
 * opens the microphone and sends audio to Google, so it is never remembered: it
 * needs a press in this conversation, and the sentence saying what will happen
 * sits above that press rather than appearing after it.
 */
function VoiceControls({ voice, onTalkAndListen }: { voice: ReturnType<typeof useVoice>; onTalkAndListen: () => void }) {
  if (!voice.supported.listen && !voice.supported.speak) {
    return <p className="text-muted-foreground mt-3 text-sm">Voice isn’t available in this browser. You can type every answer.</p>;
  }
  return (
    <div className="border-border mt-3 space-y-2 border-t pt-3">
      {voice.supported.listen && !voice.handsFree ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Talk and listen reads each question, then opens your mic automatically. Google transcribes your audio. Typing stays available.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {voice.supported.listen ? (
          <Button variant="outline" size="touch" onClick={voice.handsFree ? voice.stopHandsFree : onTalkAndListen} aria-pressed={voice.handsFree}>
            <AudioLines /> {voice.handsFree ? 'Stop talking and listening' : 'Talk and listen'}
          </Button>
        ) : null}
        {voice.supported.speak && !voice.handsFree ? (
          <Button variant="ghost" size="touch" onClick={() => voice.setReadAloud(!voice.readAloud)} aria-pressed={voice.readAloud}>
            {voice.readAloud ? 'Stop reading questions aloud' : 'Read questions aloud'}
          </Button>
        ) : null}
      </div>
      {voice.handsFree ? (
        <p className="text-muted-foreground text-xs leading-relaxed">Your mic opens after each question. Google transcribes your audio.</p>
      ) : !voice.supported.listen ? (
        <p className="text-muted-foreground text-xs leading-relaxed">Questions can be read aloud. Type your answers below.</p>
      ) : null}
    </div>
  );
}
