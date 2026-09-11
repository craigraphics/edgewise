'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Caveat } from '@/components/session/caveat';
import { Completion } from '@/components/session/completion';
import { ExplainBack } from '@/components/session/explain-back';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoice } from '@/hooks/use-voice';
import { stateOf } from '@/lib/graph/frontier';
import type { ConceptGraph, LearnerModel, NodeState } from '@/lib/graph/types';
import type { SessionConfig } from '@/lib/session/config';
import { spokenForm, stepFor } from '@/lib/walkthrough/script';
import { useWalkthrough } from '@/lib/walkthrough/store';

type Props = {
  graph: ConceptGraph;
  model: LearnerModel;
  config: SessionConfig;
  onNodeChange: (nodeId: string | null) => void;
  onEarned: (nodeId: string, state: NodeState) => void;
};

/** Wording must never read as the learner's fault. */
const ERRORS: Record<string, string> = {
  FREE_DAILY_SPENT: "That is the free allowance for today. It resets tomorrow — or add your own key and there is no cap at all.",
  FREE_TURNS_SPENT: 'That is the shared free allowance for this session. Your own key picks up from here.',
  FREE_TIER_UNAVAILABLE: 'The shared allowance is not configured here. You will need your own key.',
  MODEL_BUSY: "Google's models are all busy at the moment — that is temporary and nothing to do with you. Worth another go in a minute.",
  MODEL_QUOTA: 'Every model is rate-limited just now. The walkthrough itself still works — only this bit needs one.',
  MODEL_AUTH: 'That key was rejected by Google.',
  REWORD_FAILED: 'That did not come back. The walkthrough itself is unaffected.',
};

export function Walkthrough({ graph, model, config, onNodeChange, onEarned }: Props) {
  const walk = useWalkthrough(graph);
  const [playing, setPlaying] = useState(false);
  const [aside, setAside] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);

  const voice = useVoice(() => {});

  // Pulled out as a plain value: `walk.current` reads like a ref to the linter,
  // and a dependency it refuses to track is one that will silently go stale.
  const currentNode = walk.current;
  const step = currentNode ? stepFor(currentNode, stateOf(model, currentNode.id)) : null;

  useEffect(() => {
    onNodeChange(currentNode?.id ?? null);
  }, [currentNode, onNodeChange]);

  /*
   * A new step starts at the top; an answer scrolls itself into view.
   *
   * The pane is a fixed height, so without this an answer to "simpler" lands
   * below the fold and looks like nothing happened — which is exactly what it
   * looked like the first time this was tried.
   */
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [walk.position]);

  useEffect(() => {
    if (!aside) return;
    // Scrolls the container rather than calling scrollIntoView on the element:
    // measured, the latter moved 34px of a needed 267 and left the answer off
    // screen, which reads as the button having done nothing.
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [aside]);

  /*
   * The walk drives itself.
   *
   * "It will follow the entire flow by itself and the user will listen to it" —
   * so with voice on, finishing a step advances to the next one. No clicking
   * between twenty-three steps; the controls are there to interrupt, not to
   * operate.
   *
   * Auto-advance is gated on voice being enabled. Without it the promise
   * resolves immediately and the whole walk would flash past in one frame.
   */
  const spokenAt = useRef(-1);
  const advance = walk.advance;

  useEffect(() => {
    if (!playing || !step || !voice.enabled) return;
    if (spokenAt.current === walk.position) return;

    spokenAt.current = walk.position;
    let cancelled = false;

    void (async () => {
      await voice.say(spokenForm(step), false);
      if (!cancelled) advance();
    })();

    return () => {
      cancelled = true;
    };
  }, [advance, playing, step, voice, walk.position]);

  // Leaving playback running while it talks over an answer is disorienting.
  const interrupt = useCallback(() => {
    setPlaying(false);
    voice.stopSpeaking();
  }, [voice]);

  const ask = useCallback(
    async (mode: 'simpler' | 'question', text: string | null) => {
      if (!currentNode || busy) return;
      interrupt();
      setBusy(true);
      setError(null);
      setAside(null);

      try {
        const response = await fetch('/api/reword', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nodeId: currentNode.id,
            mode,
            question: text,
            alreadySaid: step ? spokenForm(step) : '',
            ...(config.apiKey.trim() ? { apiKey: config.apiKey.trim() } : {}),
            model: config.model,
            sessionToken: token,
          }),
        });

        const data = (await response.json()) as { say?: string; error?: string; sessionToken?: string | null };
        if (!response.ok || data.error) {
          setError(ERRORS[data.error ?? ''] ?? 'Something went wrong. The walkthrough itself is unaffected.');
          return;
        }

        if (data.sessionToken !== undefined) setToken(data.sessionToken);
        setAside(data.say ?? null);
        setQuestion('');
        if (data.say && voice.enabled) void voice.say(data.say, false);
      } catch {
        setError('Could not reach the server. The walkthrough itself is unaffected.');
      } finally {
        setBusy(false);
      }
    },
    [busy, config, currentNode, interrupt, step, token, voice],
  );

  if (!walk.hydrated) return null;

  if (walk.finished) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <Completion
          graph={graph}
          model={model}
          onRestart={walk.restart}
          // Sends them back a step, where the explain-back control for that idea
          // is already sitting — rather than to a map with no obvious next move.
          onExplainMore={walk.back}
        />
      </div>
    );
  }

  if (!step) return null;

  return (
    // The shell sizes this now; it fills whatever the aside gives it.
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
       * Which idea this is, and how far through — outside the scrolling region
       * on purpose. These are the things you look up at while listening, and
       * they must not scroll away with the prose.
       */}
      <div className="shrink-0 pb-4">
        {/*
         * How far through, drawn rather than counted in prose. Twenty-three
         * ticks read as twenty-three ideas; a percentage would read as a score,
         * and this product does not have one.
         */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-0.5" aria-hidden>
            {walk.order.map((node, index) => (
              <span
                key={node.id}
                className="h-0.5 flex-1 rounded-full transition-colors duration-[--dur]"
                style={{
                  background:
                    index <= walk.position ? `var(--band-${node.band})` : 'var(--muted-foreground)',
                  opacity: index <= walk.position ? 1 : 0.2,
                }}
              />
            ))}
          </div>
          <p className="text-muted-foreground tabular shrink-0 text-2xs">
            {walk.position + 1} of {walk.order.length}
          </p>
        </div>
        <h2 className="font-display mt-3 text-xl font-semibold">{step.node.label}</h2>
        {step.brief ? (
          <p className="text-muted-foreground mt-1 text-2xs">You already had this one — just in passing.</p>
        ) : null}
      </div>

      {/* Keep a usable reading area when the fixed controls exceed a short
          viewport. The outer guide then scrolls the controls into view too. */}
      <div ref={scroller} className="min-h-32 flex-1 space-y-4 overflow-y-auto pr-1">
        {step.body.map((paragraph) => (
          <p key={paragraph} className="font-display text-read max-w-[60ch]">
            {paragraph}
          </p>
        ))}

        {/*
         * The caveat is part of the step, not a footnote. A simplification
         * labelled with what it costs is a ladder; unlabelled, it becomes
         * something the learner has to be rescued from later.
         */}
        {step.caveat ? (
          <Caveat title="What this simplification gets wrong" band={step.node.band}>
            {step.caveat}
          </Caveat>
        ) : null}

        {aside ? (
          <div className="bg-surface-2 edgewise-rise rounded-xl px-4 py-3">
            <p className="font-display text-read">{aside}</p>
          </div>
        ) : null}

        {busy ? (
          <p className="text-muted-foreground font-display text-read animate-pulse">Thinking…</p>
        ) : null}
        {error ? <p className="text-muted-foreground text-base leading-relaxed">{error}</p> : null}

        {/*
         * Offered after the step, never required before advancing. Gating the
         * walk on explaining each idea back would turn twenty-three deliveries
         * into twenty-three checkpoints, which is the exam this is not.
         */}
        <div className="pt-2">
          <ExplainBack
            node={step.node}
            state={stateOf(model, step.node.id)}
            config={config}
            onEarned={onEarned}
          />
        </div>
      </div>

      <div className="edgewise-raised border-border mt-4 shrink-0 space-y-2.5 rounded-xl border p-3">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (question.trim()) void ask('question', question.trim());
            }
          }}
          placeholder="Ask anything about this — or just let it run"
          rows={2}
          disabled={busy}
          className="bg-surface-1 resize-none"
        />

        {/*
         * One way to move, one way to listen.
         *
         * "Play" and "Go on" both advanced the walk, which meant two buttons
         * competing to be the obvious next action and neither explaining itself.
         * Moving is now always Next; Play became a toggle that is plainly about
         * audio, and the line underneath says that it also moves on by itself,
         * because that is surprising and has to be stated rather than
         * discovered.
         */}
        {/*
         * A 2x2 grid rather than a wrapping row: four controls of very
         * different label lengths wrapped into ragged rows that read as
         * unrelated. Equal cells make them read as one set of four choices.
         */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="touch"
            variant="ghost"
            onClick={() => {
              interrupt();
              setAside(null);
              walk.back();
            }}
            disabled={walk.position === 0}
          >
            Back
          </Button>

          <Button
            size="touch"
            onClick={() => {
              interrupt();
              setAside(null);
              walk.advance();
            }}
          >
            Next idea
          </Button>

          {/*
           * Asking for it simpler is the most useful thing anyone does here, so
           * it sits with the primary controls rather than tucked away as a
           * lesser option.
           */}
          <Button size="touch" variant="outline" onClick={() => void ask('simpler', null)} disabled={busy}>
            Say it more simply
          </Button>

          {voice.supported.speak ? (
            <Button
              size="touch"
              variant={playing ? 'default' : 'outline'}
              onClick={() => {
                if (playing) {
                  interrupt();
                  return;
                }
                if (!voice.enabled) voice.toggle();
                // Re-read the step we are on rather than skipping it.
                spokenAt.current = -1;
                setPlaying(true);
              }}
            >
              {playing ? 'Pause reading' : 'Read it to me'}
            </Button>
          ) : null}

          {voice.speaking && !playing ? (
            <Button size="touch" variant="ghost" onClick={voice.stopSpeaking}>
              Stop
            </Button>
          ) : null}
        </div>

        <VoiceLine voice={voice} playing={playing} />
      </div>
    </div>
  );
}

function VoiceLine({ voice, playing }: { voice: ReturnType<typeof useVoice>; playing: boolean }) {
  if (!voice.supported.speak) {
    return (
      <p className="text-muted-foreground text-2xs">This browser cannot read it aloud — Chrome can.</p>
    );
  }

  /*
   * Auto-advance is genuinely surprising, so it is stated while it is happening
   * rather than left to be discovered when the screen changes on its own.
   */
  return (
    <p className="text-muted-foreground text-2xs leading-relaxed">
      {playing
        ? 'Reading aloud, and it moves to the next idea on its own. Interrupt whenever.'
        : 'It can read the whole thing to you and move through it by itself.'}
    </p>
  );
}
