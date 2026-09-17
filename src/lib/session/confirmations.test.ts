import { describe, expect, it } from 'vitest';

import { CLEAR_MAP, LOAD_EXAMPLE } from './confirmations';

describe('destructive confirmations', () => {
  it('name the map marks as what is lost, and say it cannot be undone', () => {
    for (const copy of [CLEAR_MAP, LOAD_EXAMPLE]) {
      expect(copy.body).toMatch(/mark/);
      expect(copy.body).toMatch(/cannot be undone/);
    }
  });

  it('clearing the map also names the conversation, the typed answer and the experiments', () => {
    expect(CLEAR_MAP.body).toMatch(/conversation/);
    expect(CLEAR_MAP.body).toMatch(/typed/);
    expect(CLEAR_MAP.body).toMatch(/experiments/);
  });

  it('the example loader says it is a testing tool', () => {
    expect(LOAD_EXAMPLE.body).toMatch(/testing tool/);
  });

  /* The cancel is the safe choice and must read as keeping, not as backing out. */
  it('offer keeping as the alternative, and never quote a count', () => {
    for (const copy of [CLEAR_MAP, LOAD_EXAMPLE]) {
      expect(copy.cancel).toMatch(/keep/i);
      expect(`${copy.title} ${copy.body} ${copy.kept}`).not.toMatch(/\d/);
    }
  });
});
