'use client';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoice } from '@/hooks/use-voice';
import type { ConceptNode, NodeState } from '@/lib/graph/types';
import type { SessionConfig } from '@/lib/session/config';

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

export function ExplainBack({ node, state, config, onEarned }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ say: string; moved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const submit = useCallback(
    async (text: string) => {
      const explanation = text.trim();
      if (!explanation || busy) return;

      setBusy(true);
      setError(null);
      setReply(null);

      try {
        const response = await fetch('/api/explain-back', {
          method: 'POST',
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

        if (!response.ok || data.error) {
          setError(ERRORS[data.error ?? ''] ?? 'Something went wrong. Nothing was lost.');
          return;
        }

        if (data.sessionToken !== undefined) setToken(data.sessionToken);
        if (data.state) onEarned(node.id, data.state);
        setReply({ say: data.say ?? '', moved: Boolean(data.moved) });
        setDraft('');
      } catch {
        setError('Could not reach the server. Nothing was lost.');
      } finally {
        setBusy(false);
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

  return (
    <div className="bg-surface-2/60 border-border space-y-2.5 rounded-xl border p-3.5">
      <p className="text-muted-foreground text-2xs leading-relaxed">
        In your own words, however roughly. Everyday language beats the right terminology — this is only
        useful if it is actually yours.
      </p>

      {voice.listening ? (
        <div className="border-border flex h-20 items-center justify-between rounded-lg border border-dashed px-3">
          <span className="text-muted-foreground text-base">{voice.interim || 'Listening…'}</span>
          <Button size="touch" variant="outline" onClick={voice.stopListening}>
            Done
          </Button>
        </div>
      ) : (
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`So ${node.label.toLowerCase()} is basically…`}
          rows={4}
          disabled={busy}
          className="bg-surface-1 resize-none"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="touch" onClick={() => void submit(draft)} disabled={busy || !draft.trim()}>
          Check my explanation
        </Button>
        {voice.supported.listen && !voice.listening ? (
          <Button size="touch" variant="outline" onClick={voice.listen} disabled={busy}>
            Say it instead
          </Button>
        ) : null}
        <Button
          size="touch"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setReply(null);
            setError(null);
          }}
        >
          Not now
        </Button>
      </div>

      {busy ? (
        <p className="text-muted-foreground font-display text-read animate-pulse">Reading it…</p>
      ) : null}
      {error ? <p className="text-muted-foreground text-base leading-relaxed">{error}</p> : null}

      {reply ? (
        <div className="edgewise-rise space-y-2 pt-1">
          <p className="font-display text-read">{reply.say}</p>
          {/*
           * Stated plainly when something moved, and silent when it did not.
           * "Not yet" as an explicit verdict on an attempt someone volunteered
           * is the discouraging half of this interaction, and the reply above
           * already says what was missing.
           *
           * When it did move, it is worth a moment: this is the only thing in
           * the product that changes the map, and the same pulse fires on the
           * node itself, so the two read as one event in two places.
           */}
          {reply.moved ? (
            <p className="text-foreground flex items-center gap-1.5 text-2xs font-medium">
              <span
                aria-hidden
                className="edgewise-aura inline-block size-1.5 rounded-full"
                style={{ background: 'var(--foreground)' }}
              />
              The map has moved on this one.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
