'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoice } from '@/hooks/use-voice';
import type { ConceptNode, NodeState } from '@/lib/graph/types';
import type { SessionConfig } from '@/lib/session/config';
import { explanationReadiness } from '@/lib/session/explanation-length';

import { StateBadge } from './state-badge';

/**
 * Explaining an idea back in your own words — the only thing that clears a block.
 *
 * Available on any node, from anywhere, at any time. It is deliberately not a
 * step in the walkthrough: the walkthrough delivers, this is something the
 * learner chooses to attempt, and tying the two together would turn every
 * explanation into a checkpoint you have to pass to continue.
 *
 * Speaking it is offered because saying a thing out loud and typing it are
 * different tests. Fluent recall and real understanding diverge exactly at the
 * point where you have to produce it aloud without editing.
 */

type Props = {
  node: ConceptNode;
  state: NodeState;
  config: SessionConfig;
  onEarned: (nodeId: string, state: NodeState) => void;
  openRequest?: number;
  prompt?: string;
};

const ERRORS: Record<string, string> = {
  FREE_DAILY_SPENT: "That is the free allowance for today. It resets tomorrow — or add your own key and there is no cap at all.",
  FREE_TURNS_SPENT: 'That is the shared free allowance for this session. Your own key picks up from here.',
  FREE_TIER_UNAVAILABLE: 'The shared allowance is not configured here. You will need your own key.',
  MODEL_BUSY: "Google's models are all busy at the moment — that is temporary and nothing to do with you. Worth another go in a minute.",
  MODEL_QUOTA: 'Every model is rate-limited just now. Worth another go shortly — nothing was lost.',
  MODEL_AUTH: 'That key was rejected by Google.',
  EXPLAIN_FAILED: 'That did not come back. Nothing was lost.',
};

export function ExplainBack({ node, state, config, onEarned, openRequest = 0, prompt }: Props) {
  const [open, setOpen] = useState(openRequest > 0);
  const [lastRequest, setLastRequest] = useState(openRequest);
  // A new request reopens the existing draft instead of remounting the form.
  if (lastRequest !== openRequest) {
    setLastRequest(openRequest);
    setOpen(true);
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => { if (open) textareaRef.current?.focus(); }, [open, openRequest]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ say: string; moved: boolean; state: NodeState } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const readiness = explanationReadiness(draft);

  /*
   * The outcome replaces the form and is brought on screen.
   *
   * It used to render under the textarea and its buttons, which put it at or
   * below the fold at 1230x842 — the answer to the one thing that can change
   * the map arrived somewhere nobody was looking, beside a form that stayed
   * open as though nothing had happened. Focus moves to the next action
   * because the control that had it has just gone; `preventScroll` leaves the
   * scroll to the line above, which is the one that knows what to show.
   */
  useEffect(() => {
    if (!reply) return;
    panelRef.current?.scrollIntoView({ block: 'nearest' });
    againRef.current?.focus({ preventScroll: true });
  }, [reply]);

  const submit = useCallback(
    async (text: string) => {
      const explanation = text.trim();
      if (busy) return;
      // A spoken "ok" lands here without passing the disabled button, so the
      // same rule is held here and the reason shown against the words heard.
      if (!explanationReadiness(explanation).ready) {
        setDraft(explanation);
        return;
      }

      setBusy(true);
      setError(null);
      setReply(null);

      const controller = new AbortController();
      requestRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort('timeout'), 45_000);
      try {
        const response = await fetch('/api/explain-back', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nodeId: node.id,
            explanation,
            currentState: state,
            ...(config.apiKey.trim() ? { apiKey: config.apiKey.trim() } : {}),
            model: config.model,
            sessionToken: token,
          }),
        });

        const data = (await response.json()) as {
          say?: string;
          state?: NodeState;
          moved?: boolean;
          sessionToken?: string | null;
          error?: string;
        };

        if (controller.signal.aborted) return;
        if (!response.ok || data.error) {
          setError(ERRORS[data.error ?? ''] ?? 'Something went wrong. Nothing was lost.');
          return;
        }

        if (data.sessionToken !== undefined) setToken(data.sessionToken);
        if (data.state) onEarned(node.id, data.state);
        setReply({ say: data.say ?? '', moved: Boolean(data.moved), state: data.state ?? state });
        setDraft('');
      } catch {
        if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
        setError(controller.signal.reason === 'timeout' ? 'That took too long. Your explanation is still here; try again.' : 'Could not reach the server. Nothing was lost.');
      } finally {
        clearTimeout(timeout);
        if (!controller.signal.aborted || controller.signal.reason === 'timeout') setBusy(false);
      }
    },
    [busy, config, node.id, onEarned, state, token],
  );

  const voice = useVoice(submit);

  if (!open) {
    return (
      <Button variant="outline" size="touch" onClick={() => setOpen(true)}>
        {state === 'known' ? 'Explain it back anyway' : 'Try explaining it back'}
      </Button>
    );
  }

  const close = () => {
    setOpen(false);
    setReply(null);
    setError(null);
  };

  return (
    <div ref={panelRef} className="bg-surface-2/60 border-border scroll-my-4 space-y-2.5 rounded-xl border p-3.5">
      {reply ? null : (
        <>
          <p className="text-muted-foreground text-2xs leading-relaxed">
            In your own words, however roughly. Everyday language beats the right terminology — this is only
            useful if it is actually yours.
          </p>

          {prompt && <p className="text-sm">{prompt}</p>}
          {voice.listening ? (
            <div className="border-border flex h-20 items-center justify-between rounded-lg border border-dashed px-3">
              <span className="text-muted-foreground text-base">{voice.interim || 'Listening…'}</span>
              <Button size="touch" variant="outline" onClick={voice.stopListening}>
                Done
              </Button>
            </div>
          ) : (
            <Textarea
              ref={textareaRef}
              aria-label={prompt ?? `Your explanation of ${node.label}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`So ${node.label.toLowerCase()} is basically…`}
              rows={4}
              disabled={busy}
              className="bg-surface-1 resize-none"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="touch"
              onClick={() => void submit(draft)}
              disabled={busy || !readiness.ready}
              aria-describedby={draft.trim() && readiness.reason ? `${node.id}-explain-reason` : undefined}
            >
              Check my explanation
            </Button>
            {voice.supported.listen && !voice.listening ? (
              <Button size="touch" variant="outline" onClick={voice.listen} disabled={busy}>
                Say it instead
              </Button>
            ) : null}
            <Button size="touch" variant="ghost" disabled={busy} onClick={close}>
              Not now
            </Button>
          </div>
          {/* Said only once there is something typed: an empty field explains itself. */}
          {draft.trim() && readiness.reason ? (
            <p id={`${node.id}-explain-reason`} className="text-muted-foreground text-2xs leading-relaxed">
              {readiness.reason}
            </p>
          ) : null}
          {error ? <p role="alert" className="text-muted-foreground text-base leading-relaxed">{error}</p> : null}
        </>
      )}

      {/*
       * One live region for the whole exchange, mounted before the request so
       * its change is announced: "Reading it…", then the reply in its place.
       */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {busy ? (
          <p className="text-muted-foreground font-display text-read animate-pulse">Reading it…</p>
        ) : reply ? (
          <div className="edgewise-rise space-y-3">
            <p className="font-display text-read">{reply.say}</p>
            {/*
             * Stated plainly when something moved, and silent when it did not.
             * "Not yet" as an explicit verdict on an attempt someone volunteered
             * is the discouraging half of this interaction, and the reply above
             * already says what was missing.
             *
             * When it did move, the new mark is drawn here, beside the words
             * that earned it. The badge at the top of the panel changes too, but
             * that can be a screen away; this one is on screen by construction.
             */}
            {reply.moved ? (
              <p className="text-foreground flex flex-wrap items-center gap-2 text-2xs font-medium">
                <span
                  aria-hidden
                  className="edgewise-aura inline-block size-1.5 rounded-full"
                  style={{ background: 'var(--foreground)' }}
                />
                The map has moved on this one. It is now
                <StateBadge state={reply.state} band={node.band} />
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {reply ? (
        <div className="flex flex-wrap gap-2">
          <Button ref={againRef} size="touch" variant="outline" onClick={() => { setReply(null); requestAnimationFrame(() => textareaRef.current?.focus()); }}>
            Explain it again
          </Button>
          <Button size="touch" variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      ) : null}
    </div>
  );
}
