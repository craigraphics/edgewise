'use client';

import { useCallback, useState } from 'react';

import type { NodeState } from '@/lib/graph/types';

import type { SessionConfig } from './config';

/**
 * Drives the diagnostic conversation.
 *
 * The client holds the transcript and the learner model and posts both with
 * every turn; the server is stateless and recomputes every derived fact. That
 * keeps "which node is this, and what comes next" in one place — pure code over
 * the graph — rather than split between a model's memory and a session store.
 */

export type Message = { role: 'user' | 'assistant'; content: string };

type TurnResponse = {
  done?: boolean;
  say?: string;
  /** Scripted end-of-session line naming the frontier. Server-built, not generated. */
  closing?: string | null;
  mark?: { nodeId: string; state: NodeState } | null;
  misconception?: boolean;
  nodeId?: string | null;
  followUps?: number;
  sessionToken?: string | null;
  model?: string;
  costUsd?: number;
  error?: string;
  cap?: number;
};

/** Wording matters here: an error must not read as the learner's fault. */
const ERRORS: Record<string, string> = {
  FREE_DAILY_SPENT: "That is the free allowance for today. It resets tomorrow — or add your own key and there is no cap at all.",
  FREE_TURNS_SPENT:
    'That is as far as the shared free allowance goes for this session. Adding your own key picks up right where you left off — nothing is lost.',
  FREE_TIER_UNAVAILABLE:
    'The shared free allowance is not configured on this deployment. You will need your own key for now.',
  MODEL_BUSY: "Google's models are all busy at the moment — that is temporary and nothing to do with you. Worth another go in a minute.",
  MODEL_QUOTA:
    'Every model the app can reach is rate-limited at the moment. Your progress is saved — this is worth another go in a few minutes.',
  MODEL_AUTH: 'That key was rejected by Google. Worth checking it was copied whole.',
  MODEL_NEEDS_OWN_KEY: 'That model needs your own key — its free allowance is far too small for a session.',
  MODEL_NOT_ALLOWED: 'That model is not on the tested list.',
  MODEL_FAILED: 'The model did not answer. Your progress is saved.',
  TURN_FAILED: 'Something went wrong on our side. Your progress is saved.',
};

export function useSession(config: SessionConfig, applyMark: (nodeId: string, state: NodeState) => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'running' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [spend, setSpend] = useState(0);

  const post = useCallback(
    async (payload: Record<string, unknown>): Promise<TurnResponse | null> => {
      setStatus('thinking');
      setError(null);

      try {
        const response = await fetch('/api/turn', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            // Sent only when present. An empty string would look like a key.
            ...(config.apiKey.trim() ? { apiKey: config.apiKey.trim() } : {}),
            model: config.model,
            sessionToken: token,
          }),
        });

        const data = (await response.json()) as TurnResponse;

        if (!response.ok || data.error) {
          setError(ERRORS[data.error ?? ''] ?? 'Something went wrong. Your progress is saved.');
          setStatus('error');
          return null;
        }

        return data;
      } catch {
        setError('Could not reach the server. Your progress is saved.');
        setStatus('error');
        return null;
      }
    },
    [config.apiKey, config.model, token],
  );

  const absorb = useCallback(
    (data: TurnResponse) => {
      const spoken = [data.say, data.closing].filter((line): line is string => Boolean(line));
      if (spoken.length) {
        setMessages((current) => [...current, ...spoken.map((content) => ({ role: 'assistant' as const, content }))]);
      }
      if (data.mark) applyMark(data.mark.nodeId, data.mark.state);
      if (data.sessionToken !== undefined) setToken(data.sessionToken);
      if (typeof data.costUsd === 'number') setSpend((current) => current + data.costUsd!);

      setNodeId(data.nodeId ?? null);
      setFollowUps(data.followUps ?? 0);
      setStatus(data.done ? 'done' : 'running');
    },
    [applyMark],
  );

  const start = useCallback(
    async (states: Record<string, NodeState>) => {
      setMessages([]);
      const data = await post({ states, history: [], answer: '', currentNodeId: null, followUps: 0 });
      if (data) absorb(data);
    },
    [absorb, post],
  );

  const answer = useCallback(
    async (text: string, states: Record<string, NodeState>) => {
      const trimmed = text.trim();
      if (!trimmed || !nodeId) return;

      // Shown immediately, so the transcript never lags behind the person typing.
      const history = messages;
      setMessages((current) => [...current, { role: 'user', content: trimmed }]);

      const data = await post({
        states,
        history,
        answer: trimmed,
        currentNodeId: nodeId,
        followUps,
      });
      if (data) absorb(data);
    },
    [absorb, followUps, messages, nodeId, post],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setNodeId(null);
    setFollowUps(0);
    setStatus('idle');
    setError(null);
  }, []);

  return { messages, status, error, spend, nodeId, start, answer, reset };
}
