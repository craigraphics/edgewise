import { describe, expect, it } from 'vitest';

import { GRAPH } from '@/lib/graph/load';

import { emptyConversation, isResumable, lastQuestion, parseConversation, type StoredConversation } from './stored-conversation';

const live: StoredConversation = {
  graphVersion: GRAPH.version,
  messages: [
    { role: 'assistant', content: 'What does a neuron do?' },
    { role: 'user', content: 'It adds things up' },
    { role: 'assistant', content: 'And then?' },
  ],
  nodeId: GRAPH.nodes[1].id,
  followUps: 1,
  done: false,
  token: 'signed',
};

describe('parseConversation', () => {
  it('round-trips a conversation left partway through', () => {
    const parsed = parseConversation(GRAPH, JSON.stringify(live));
    expect(parsed).toEqual(live);
    expect(isResumable(parsed)).toBe(true);
    expect(lastQuestion(parsed)).toBe('And then?');
  });

  it('treats nothing stored, and corrupt storage, as no conversation', () => {
    expect(parseConversation(GRAPH, null)).toEqual(emptyConversation(GRAPH));
    expect(parseConversation(GRAPH, '{nope')).toEqual(emptyConversation(GRAPH));
    expect(isResumable(parseConversation(GRAPH, null))).toBe(false);
  });

  it('discards a transcript written against another graph, but keeps the allowance token', () => {
    const parsed = parseConversation(GRAPH, JSON.stringify({ ...live, graphVersion: -1 }));
    expect(parsed.messages).toEqual([]);
    expect(parsed.token).toBe('signed');
  });

  it('does not resume on a node that no longer exists', () => {
    const parsed = parseConversation(GRAPH, JSON.stringify({ ...live, nodeId: 'renamed-away' }));
    expect(isResumable(parsed)).toBe(false);
  });

  it('drops malformed messages rather than rendering them', () => {
    const parsed = parseConversation(GRAPH, JSON.stringify({ ...live, messages: [...live.messages, { role: 'system', content: 'x' }, null] }));
    expect(parsed.messages).toEqual(live.messages);
  });

  it('keeps a finished conversation, but does not offer to resume it', () => {
    const parsed = parseConversation(GRAPH, JSON.stringify({ ...live, nodeId: null, done: true }));
    expect(parsed.done).toBe(true);
    expect(parsed.messages).toHaveLength(3);
    expect(isResumable(parsed)).toBe(false);
  });
});
