'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GRAPH } from '@/lib/graph/load';
import type { NodeState } from '@/lib/graph/types';
import { usePersisted, writePersisted } from '@/lib/persisted';

import type { SessionConfig } from './config';
import {
  CONVERSATION_KEY,
  emptyConversation,
  isResumable,
  parseConversation,
  type Message,
  type StoredConversation,
} from './stored-conversation';

/**
 * Drives the diagnostic conversation.
 *
 * The client holds the transcript and the learner model and posts both with
 * every turn; the server is stateless and recomputes every derived fact. That
 * keeps "which node is this, and what comes next" in one place — pure code over
 * the graph — rather than split between a model's memory and a session store.
 *
 * The settled transcript lives in localStorage (`stored-conversation.ts`), read
 * through `usePersisted`, so a reload or a second tab finds the same question
 * rather than an empty panel. What is in flight — the answer just sent, the wait,
 * an error — stays in memory and belongs to this tab.
 */

export type { Message };

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
  const raw = usePersisted(CONVERSATION_KEY);
  const stored = useMemo(() => parseConversation(GRAPH, raw), [raw]);
  /*
   * Whether this tab is showing the stored conversation or the start screen.
   *
   * A conversation found in storage is offered, not imposed: a reload lands on
   * "pick up where you left off" beside "start again", and only a press joins
   * it. Opening straight onto a half-finished question — possibly with the
   * microphone about to open — is not what somebody reloading a page expects.
   */
  const [attached, setAttached] = useState(false);
  /** The answer just sent, shown at once and written only once the server replies. */
  const [sent, setSent] = useState<string | null>(null);
  const [phase, setPhase] = useState<'ready' | 'thinking' | 'error'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [spend, setSpend] = useState(0);
  /*
   * Changes whenever the conversation is thrown away. The panel is keyed on it,
   * so anything that belongs to one conversation — above all, permission to
   * open the microphone — cannot carry into the next.
   */
  const [conversation, setConversation] = useState(0);
  const pending = useRef<Record<string, unknown> | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  const live = attached && (stored.done || stored.nodeId !== null);
  const status: 'idle' | 'thinking' | 'running' | 'done' | 'error' =
    phase === 'thinking' ? 'thinking' : phase === 'error' ? 'error' : !live ? 'idle' : stored.done ? 'done' : 'running';
  const messages = useMemo<Message[]>(
    () => (live || phase !== 'ready' ? [...stored.messages, ...(sent ? [{ role: 'user' as const, content: sent }] : [])] : []),
    [live, phase, sent, stored.messages],
  );

  /** Always from storage, never from a render: another tab may have moved on. */
  const current = useCallback((): StoredConversation => {
    try {
      return parseConversation(GRAPH, window.localStorage.getItem(CONVERSATION_KEY));
    } catch {
      return stored;
    }
  }, [stored]);
  const commit = useCallback((next: StoredConversation) => writePersisted(CONVERSATION_KEY, JSON.stringify(next)), []);

  const post = useCallback(
    async (payload: Record<string, unknown>): Promise<TurnResponse | null> => {
      if (active.current) return null;
      const controller = new AbortController();
      active.current = controller;
      pending.current = payload;
      const timeout = setTimeout(() => controller.abort(), 45_000);
      setPhase('thinking');
      setError(null);

      try {
        const response = await fetch('/api/turn', {
          signal: controller.signal,
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            // Sent only when present. An empty string would look like a key.
            ...(config.apiKey.trim() ? { apiKey: config.apiKey.trim() } : {}),
            model: config.model,
            sessionToken: current().token,
          }),
        });

        const data = (await response.json()) as TurnResponse;
        if (active.current !== controller) return null;

        if (!response.ok || data.error) {
          setError(ERRORS[data.error ?? ''] ?? 'Something went wrong. Your progress is saved.');
          setPhase('error');
          return null;
        }

        pending.current = null;
        return data;
      } catch {
        if (active.current !== controller) return null;
        setError(controller.signal.aborted ? 'The server took too long to respond. Your answer is still here.' : 'Could not reach the server. Your answer is still here.');
        setPhase('error');
        return null;
      } finally {
        clearTimeout(timeout);
        if (active.current === controller) active.current = null;
      }
    },
    [config.apiKey, config.model, current],
  );

  /** Writes one settled turn: the history it was sent with, the answer, and the reply. */
  const absorb = useCallback(
    (data: TurnResponse, history: Message[], answered: string | null) => {
      const spoken = [data.say, data.closing].filter((line): line is string => Boolean(line));
      if (data.mark) applyMark(data.mark.nodeId, data.mark.state);
      if (typeof data.costUsd === 'number') setSpend((total) => total + data.costUsd!);

      const before = current();
      commit({
        graphVersion: GRAPH.version,
        messages: [
          ...history,
          ...(answered ? [{ role: 'user' as const, content: answered }] : []),
          ...spoken.map((content) => ({ role: 'assistant' as const, content })),
        ],
        nodeId: data.nodeId ?? null,
        followUps: data.followUps ?? 0,
        done: Boolean(data.done),
        token: data.sessionToken !== undefined ? data.sessionToken : before.token,
      });
      setSent(null);
      setPhase('ready');
      setAttached(true);
    },
    [applyMark, commit, current],
  );

  const start = useCallback(
    async (states: Record<string, NodeState>) => {
      if (active.current) return;
      setSent(null);
      setAttached(true);
      commit(emptyConversation(GRAPH, current().token));
      const data = await post({ states, history: [], answer: '', currentNodeId: null, followUps: 0 });
      if (data) absorb(data, [], null);
    },
    [absorb, commit, current, post],
  );

  /** Joins the conversation found in storage. */
  const resume = useCallback(() => {
    if (isResumable(current())) setAttached(true);
  }, [current]);

  const answer = useCallback(
    async (text: string, states: Record<string, NodeState>) => {
      const trimmed = text.trim();
      const before = current();
      if (!trimmed || !before.nodeId || before.done || active.current) return;

      // Shown immediately, so the transcript never lags behind the person typing.
      setSent(trimmed);
      const history = before.messages;
      const data = await post({
        states,
        history,
        answer: trimmed,
        currentNodeId: before.nodeId,
        followUps: before.followUps,
      });
      if (data) absorb(data, history, trimmed);
    },
    [absorb, current, post],
  );

  const retry = useCallback(async () => {
    const payload = pending.current;
    if (!payload || active.current) return;
    const data = await post(payload);
    if (data) absorb(data, (payload.history as Message[]) ?? [], (payload.answer as string) || null);
  }, [absorb, post]);

  const reset = useCallback(() => {
    const previous = active.current;
    active.current = null;
    previous?.abort();
    pending.current = null;
    commit(emptyConversation(GRAPH, current().token));
    setSent(null);
    setAttached(false);
    setPhase('ready');
    setError(null);
    setConversation((count) => count + 1);
  }, [commit, current]);

  const nodeId = live && !stored.done ? stored.nodeId : null;
  const resumable = !attached && phase === 'ready' && isResumable(stored) ? stored : null;

  return { messages, status, error, spend, nodeId, conversation, resumable, start, resume, answer, retry, reset };
}
