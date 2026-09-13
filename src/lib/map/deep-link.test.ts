import { describe, expect, it } from 'vitest';

import { hashFor, parseDeepLink } from './deep-link';
import { EXPERIMENT_IDS } from '@/lib/experiments/registry';
import { GRAPH } from '@/lib/graph/load';

const parse = (hash: string) => parseDeepLink(hash, GRAPH);

describe('the links a URL can name', () => {
  it('names an idea and an experiment separately', () => {
    expect(parse('#idea/tokens')).toEqual({ kind: 'idea', id: 'tokens' });
    expect(parse('#play/tokens')).toEqual({ kind: 'play', id: 'tokens' });
  });

  /** What somebody types. It is accepted, and rewritten once the app has it. */
  it('reads a bare id as the idea', () => {
    expect(parse('#tokens')).toEqual({ kind: 'idea', id: 'tokens' });
    expect(parse('tokens')).toEqual({ kind: 'idea', id: 'tokens' });
  });

  it('round-trips every link it produces', () => {
    for (const node of GRAPH.nodes) {
      expect(parse(hashFor({ kind: 'idea', id: node.id }))).toEqual({ kind: 'idea', id: node.id });
    }
    for (const id of EXPERIMENT_IDS) {
      expect(parse(hashFor({ kind: 'play', id }))).toEqual({ kind: 'play', id });
    }
  });

  it('has no hash for the ordinary first screen', () => {
    expect(hashFor(null)).toBe('');
    expect(parse('')).toBeNull();
    expect(parse('#')).toBeNull();
  });

  /**
   * A stale or mistyped link should land on the ordinary first screen, not on
   * an empty panel that reads as the app having failed to load.
   */
  it('refuses an id that is not in the graph', () => {
    expect(parse('#idea/transformers')).toBeNull();
    expect(parse('#play/transformers')).toBeNull();
    expect(parse('#neurons')).toBeNull();
    expect(parse('#what/tokens')).toBeNull();
  });

  /**
   * Experiments are added one idea at a time. A link written for an idea whose
   * experiment does not exist yet — or one whose experiment is later removed —
   * still arrives somewhere true rather than nowhere.
   */
  it('falls back to the idea when it asks to play one that has no experiment', () => {
    const plain = GRAPH.nodes.find(node => !(EXPERIMENT_IDS as readonly string[]).includes(node.id))!;
    expect(parse(`#play/${plain.id}`)).toEqual({ kind: 'idea', id: plain.id });
  });

  it('survives a hand-edited URL', () => {
    expect(parse('#/idea/tokens/')).toEqual({ kind: 'idea', id: 'tokens' });
    expect(parse('#idea%2Ftokens')).toEqual({ kind: 'idea', id: 'tokens' });
    // A stray percent sign makes the hash undecodable, which names no idea.
    expect(parse('#idea/%zz')).toBeNull();
  });

  /** Every experiment in the registry is reachable by its own link. */
  it('can name all seven experiments', () => {
    expect(EXPERIMENT_IDS.map(id => parse(`#play/${id}`))).toEqual(
      EXPERIMENT_IDS.map(id => ({ kind: 'play', id })),
    );
  });
});
