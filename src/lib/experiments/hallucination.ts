/**
 * A constructed museum example for the `hallucination` node.
 *
 * The sentence maker and the record checker are deliberately separate. The
 * maker receives prepared names, years, and sentence patterns. It never
 * receives the museum records, so it cannot quietly look up the right answer.
 * The checker receives the finished claim and looks up only its stable exhibit
 * id. Tests change and remove records without changing the sentence, which
 * holds that separation to something stronger than this comment.
 */

export type Exhibit = { id: string; name: string };
export type YearCard = { id: string; year: number };
export type SentencePattern = {
  id: string;
  beforeName: string;
  afterName: string;
  afterYear: string;
};

export type DescriptionRecipe = {
  id: string;
  exhibitId: string;
  yearCardId: string;
  patternId: string;
};

export type MuseumRecord = {
  exhibitId: string;
  year: number;
  note: string;
};

export type MadeDescription = {
  recipeId: string;
  exhibitId: string;
  exhibitName: string;
  claimedYear: number;
  beforeYear: string;
  afterYear: string;
  text: string;
};

export type ClaimCheck =
  | { status: 'supported'; claimedYear: number; recordedYear: number; record: MuseumRecord }
  | { status: 'contradicted'; claimedYear: number; recordedYear: number; record: MuseumRecord }
  | { status: 'not-found'; claimedYear: number };

/** Invented names, prepared for this panel rather than read from a museum. */
export const EXHIBITS: readonly Exhibit[] = [
  { id: 'harbor-light-radio', name: 'The Harbor Light radio' },
  { id: 'sky-garden-kite', name: 'The Sky Garden kite' },
  { id: 'copper-street-camera', name: 'The Copper Street camera' },
  { id: 'moon-dial-model', name: 'The Moon Dial model' },
];

/** Prepared year pieces. They are sentence material, not museum records. */
export const YEAR_CARDS: readonly YearCard[] = [
  { id: 'year-1984', year: 1984 },
  { id: 'year-1976', year: 1976 },
  { id: 'year-1991', year: 1991 },
  { id: 'year-1968', year: 1968 },
];

/** Prepared wording patterns. Every outcome gets the same matter-of-fact tone. */
export const SENTENCE_PATTERNS: readonly SentencePattern[] = [
  { id: 'gallery', beforeName: '', afterName: ' first appeared in the museum’s main gallery in ', afterYear: '.' },
  { id: 'collection', beforeName: '', afterName: ' joined the museum collection in ', afterYear: '.' },
  { id: 'display', beforeName: '', afterName: ' has been on display since ', afterYear: '.' },
];

/**
 * Inputs to the same sentence-making rule. Some happen to agree with the
 * independent records and some do not; no outcome is stored in a recipe.
 */
export const DESCRIPTION_RECIPES: readonly DescriptionRecipe[] = [
  { id: 'harbor-1984', exhibitId: 'harbor-light-radio', yearCardId: 'year-1984', patternId: 'gallery' },
  { id: 'kite-1976', exhibitId: 'sky-garden-kite', yearCardId: 'year-1976', patternId: 'collection' },
  { id: 'camera-1991', exhibitId: 'copper-street-camera', yearCardId: 'year-1991', patternId: 'display' },
  { id: 'moon-1968', exhibitId: 'moon-dial-model', yearCardId: 'year-1968', patternId: 'gallery' },
];

/** Invented catalogue records. The Moon Dial is intentionally absent. */
export const MUSEUM_RECORDS: readonly MuseumRecord[] = [
  { exhibitId: 'harbor-light-radio', year: 1991, note: 'First shown in the main gallery in 1991.' },
  { exhibitId: 'sky-garden-kite', year: 1976, note: 'Added to the museum collection in 1976.' },
  { exhibitId: 'copper-street-camera', year: 2003, note: 'First put on display in 2003.' },
];

function findById<T extends { id: string }>(items: readonly T[], id: string, kind: string): T {
  const found = items.find(item => item.id === id);
  if (!found) throw new Error(`Unknown ${kind}: ${id}`);
  return found;
}

/**
 * Combines prepared pieces. There is no record parameter and no fact-checking
 * branch: faithful and mixed-up sentences are made by this exact same rule.
 */
export function makeDescription(
  recipe: DescriptionRecipe,
  exhibits: readonly Exhibit[] = EXHIBITS,
  years: readonly YearCard[] = YEAR_CARDS,
  patterns: readonly SentencePattern[] = SENTENCE_PATTERNS,
): MadeDescription {
  const exhibit = findById(exhibits, recipe.exhibitId, 'exhibit');
  const year = findById(years, recipe.yearCardId, 'year card');
  const pattern = findById(patterns, recipe.patternId, 'sentence pattern');
  const beforeYear = `${pattern.beforeName}${exhibit.name}${pattern.afterName}`;
  const text = `${beforeYear}${year.year}${pattern.afterYear}`;
  return {
    recipeId: recipe.id,
    exhibitId: exhibit.id,
    exhibitName: exhibit.name,
    claimedYear: year.year,
    beforeYear,
    afterYear: pattern.afterYear,
    text,
  };
}

/** Looks up a claim independently, by stable exhibit id rather than its name. */
export function checkClaim(description: MadeDescription, records: readonly MuseumRecord[] = MUSEUM_RECORDS): ClaimCheck {
  const record = records.find(item => item.exhibitId === description.exhibitId);
  if (!record) return { status: 'not-found', claimedYear: description.claimedYear };
  return record.year === description.claimedYear
    ? { status: 'supported', claimedYear: description.claimedYear, recordedYear: record.year, record }
    : { status: 'contradicted', claimedYear: description.claimedYear, recordedYear: record.year, record };
}

export type HallucinationDemo = {
  recipeIndex: number;
  check: ClaimCheck | null;
};

export type HallucinationAction = { kind: 'check' } | { kind: 'next' } | { kind: 'reset' };

export function initialHallucinationDemo(): HallucinationDemo {
  return { recipeIndex: 0, check: null };
}

export function descriptionAt(index: number): MadeDescription {
  const safeIndex = ((index % DESCRIPTION_RECIPES.length) + DESCRIPTION_RECIPES.length) % DESCRIPTION_RECIPES.length;
  return makeDescription(DESCRIPTION_RECIPES[safeIndex]);
}

/** A reducer makes rapid repeated actions apply in order without stale state. */
export function applyHallucinationAction(state: HallucinationDemo, action: HallucinationAction): HallucinationDemo {
  if (action.kind === 'reset') return initialHallucinationDemo();
  if (action.kind === 'next') return { recipeIndex: (state.recipeIndex + 1) % DESCRIPTION_RECIPES.length, check: null };
  if (state.check) return state;
  return { ...state, check: checkClaim(descriptionAt(state.recipeIndex)) };
}
