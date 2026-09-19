import { describe, expect, it } from 'vitest';

import {
  applyHallucinationAction,
  checkClaim,
  DESCRIPTION_RECIPES,
  descriptionAt,
  EXHIBITS,
  initialHallucinationDemo,
  makeDescription,
  MUSEUM_RECORDS,
  SENTENCE_PATTERNS,
  YEAR_CARDS,
  type MuseumRecord,
} from './hallucination';

describe('the prepared sentence maker', () => {
  it('combines explicit exhibit, year, and pattern pieces', () => {
    expect(descriptionAt(0)).toMatchObject({
      exhibitId: 'harbor-light-radio',
      claimedYear: 1984,
      text: 'The Harbor Light radio first appeared in the museum’s main gallery in 1984.',
    });
    expect(descriptionAt(1).text).toBe('The Sky Garden kite joined the museum collection in 1976.');
  });

  it('uses the same rule for a supported and a mixed-up combination', () => {
    const mixed = makeDescription(DESCRIPTION_RECIPES[0], EXHIBITS, YEAR_CARDS, SENTENCE_PATTERNS);
    const faithful = makeDescription(DESCRIPTION_RECIPES[1], EXHIBITS, YEAR_CARDS, SENTENCE_PATTERNS);
    expect(checkClaim(mixed).status).toBe('contradicted');
    expect(checkClaim(faithful).status).toBe('supported');
    expect(mixed.beforeYear).toContain('museum');
    expect(faithful.beforeYear).toContain('museum');
  });

  /** The structural check: making a sentence has no catalogue to consult. */
  it('does not change when the independent records change or disappear', () => {
    const recipe = DESCRIPTION_RECIPES[0];
    const description = makeDescription(recipe);
    const before = description.text;
    const changedRecords: MuseumRecord[] = MUSEUM_RECORDS.map(record => ({ ...record, year: record.year + 500 }));
    expect(changedRecords).not.toEqual(MUSEUM_RECORDS);
    expect(checkClaim(description, changedRecords)).toMatchObject({ status: 'contradicted', recordedYear: 2491 });
    expect(checkClaim(description, [])).toEqual({ status: 'not-found', claimedYear: 1984 });
    expect(makeDescription(recipe).text).toBe(before);
    expect(makeDescription(recipe).text).toBe(makeDescription(recipe, EXHIBITS, YEAR_CARDS, SENTENCE_PATTERNS).text);
  });

  it('keeps the sentence style matter-of-fact across every outcome', () => {
    const descriptions = DESCRIPTION_RECIPES.map((_, index) => descriptionAt(index));
    for (const description of descriptions) {
      expect(description.text.endsWith('.')).toBe(true);
      expect(description.text).not.toMatch(/[!?]|maybe|possibly|confidence/i);
    }
    expect(new Set(descriptions.map(description => checkClaim(description).status))).toEqual(
      new Set(['supported', 'contradicted', 'not-found']),
    );
  });
});

describe('the independent museum-record check', () => {
  it('supports a matching year', () => {
    const result = checkClaim(descriptionAt(1));
    expect(result).toMatchObject({ status: 'supported', claimedYear: 1976, recordedYear: 1976 });
  });

  it('contradicts a different year for the same stable exhibit id', () => {
    const result = checkClaim(descriptionAt(0));
    expect(result).toMatchObject({ status: 'contradicted', claimedYear: 1984, recordedYear: 1991 });
  });

  it('reports missing evidence without turning it into a false verdict', () => {
    expect(checkClaim(descriptionAt(3))).toEqual({ status: 'not-found', claimedYear: 1968 });
  });

  it('checks by id even when names could be changed or repeated', () => {
    const description = { ...descriptionAt(0), exhibitName: 'A renamed exhibit', text: 'Different visible words.' };
    expect(checkClaim(description).status).toBe('contradicted');
  });
});

describe('the experiment state', () => {
  it('opens unchecked and checks only when asked', () => {
    const start = initialHallucinationDemo();
    expect(start).toEqual({ recipeIndex: 0, check: null });
    expect(applyHallucinationAction(start, { kind: 'check' }).check?.status).toBe('contradicted');
  });

  it('resets the check whenever the sentence changes', () => {
    const checked = applyHallucinationAction(initialHallucinationDemo(), { kind: 'check' });
    const next = applyHallucinationAction(checked, { kind: 'next' });
    expect(next).toEqual({ recipeIndex: 1, check: null });
  });

  it('applies rapid next actions in order and wraps safely', () => {
    let state = initialHallucinationDemo();
    for (let press = 0; press < DESCRIPTION_RECIPES.length + 2; press += 1) {
      state = applyHallucinationAction(state, { kind: 'next' });
    }
    expect(state.recipeIndex).toBe(2);
    expect(state.check).toBeNull();
  });

  it('makes repeated checks idempotent and reset complete', () => {
    const checked = applyHallucinationAction(initialHallucinationDemo(), { kind: 'check' });
    expect(applyHallucinationAction(checked, { kind: 'check' })).toBe(checked);
    expect(applyHallucinationAction(checked, { kind: 'reset' })).toEqual(initialHallucinationDemo());
  });
});
