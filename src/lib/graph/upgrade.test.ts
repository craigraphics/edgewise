import { describe, expect, it } from 'vitest';

import type { NodeState } from './types';
import { isUpgrade, upgrade } from './upgrade';

const STATES: NodeState[] = ['unexplored', 'blocked', 'shaky', 'known'];

describe('upgrade', () => {
  it('lets a good explanation clear a block', () => {
    expect(upgrade('blocked', 'known')).toBe('known');
  });

  it('lets a partial explanation move a block to shaky', () => {
    expect(upgrade('blocked', 'shaky')).toBe('shaky');
  });

  it('never downgrades, so attempting to explain can never cost you', () => {
    // Someone marked down for volunteering an explanation does not volunteer a
    // second one, and the willingness to try is worth more than any one mark.
    expect(upgrade('known', 'shaky')).toBe('known');
    expect(upgrade('known', 'blocked')).toBe('known');
    expect(upgrade('shaky', 'blocked')).toBe('shaky');
  });

  it('treats blocked and unexplored as the same standing', () => {
    // They differ in what WE know, not in what the learner knows.
    expect(upgrade('unexplored', 'blocked')).toBe('unexplored');
    expect(upgrade('blocked', 'unexplored')).toBe('blocked');
  });

  it('is idempotent', () => {
    for (const state of STATES) expect(upgrade(state, state)).toBe(state);
  });

  it('agrees with isUpgrade in every combination', () => {
    for (const current of STATES) {
      for (const earned of STATES) {
        expect(upgrade(current, earned) === earned && current !== earned).toBe(
          isUpgrade(current, earned),
        );
      }
    }
  });
});
