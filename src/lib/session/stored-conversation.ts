import type { ConceptGraph } from '@/lib/graph/types';

/**
 * The diagnostic conversation, as it is kept in this browser.
 *
 * It used to live only in component state, so a refresh or a second tab threw
 * it away: the panel said "Your map, ready to revisit" and "Continue from my
 * map" began a new conversation from the first question. Somebody three answers
 * in lost the thread for having reloaded a page.
 *
 * Only settled turns are written — a transcript the server has replied to. An
 * answer still in flight is held in memory, so a reload can never resume on a
 * dangling reply that nothing answered.
 *
 * Parsed the way `parseStored` parses marks: a record written against another
 * graph is discarded rather than migrated, because a node id that no longer
 * exists cannot be asked about.
 */

export const CONVERSATION_KEY = 'edgewise.conversation.v1';

export type Message = { role: 'user' | 'assistant'; content: string };

export type StoredConversation = {
  graphVersion: number;
  messages: Message[];
  /** The node the live question is about. Null once the conversation is over. */
  nodeId: string | null;
  followUps: number;
  done: boolean;
  /**
   * The signed free-allowance token. Kept across a fresh conversation, as it
   * always was in memory, and now across a reload too — otherwise reloading
   * would quietly hand out a new allowance.
   */
  token: string | null;
};

export function emptyConversation(graph: ConceptGraph, token: string | null = null): StoredConversation {
  return { graphVersion: graph.version, messages: [], nodeId: null, followUps: 0, done: false, token };
}

export function parseConversation(graph: ConceptGraph, raw: string | null): StoredConversation {
  if (!raw) return emptyConversation(graph);
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConversation>;
    const token = typeof parsed.token === 'string' ? parsed.token : null;
    if (parsed.graphVersion !== graph.version || !Array.isArray(parsed.messages)) return emptyConversation(graph, token);

    const messages = parsed.messages.filter(
      (message): message is Message =>
        Boolean(message) &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string',
    );
    const nodeId = typeof parsed.nodeId === 'string' && graph.nodes.some((node) => node.id === parsed.nodeId) ? parsed.nodeId : null;
    const done = parsed.done === true;

    // A live conversation needs a node to be about. Without one there is no
    // question to return to, so there is nothing to resume.
    if (!done && !nodeId) return emptyConversation(graph, token);

    const followUps = Number.isInteger(parsed.followUps) ? Math.min(3, Math.max(0, parsed.followUps!)) : 0;
    return { graphVersion: graph.version, messages, nodeId, followUps, done, token };
  } catch {
    return emptyConversation(graph);
  }
}

/** A conversation somebody left partway through, which can be picked up. */
export function isResumable(conversation: StoredConversation): boolean {
  return !conversation.done && conversation.nodeId !== null && conversation.messages.length > 0;
}

/** The question they were last asked, for the resume offer. */
export function lastQuestion(conversation: StoredConversation): string | null {
  return [...conversation.messages].reverse().find((message) => message.role === 'assistant')?.content ?? null;
}
