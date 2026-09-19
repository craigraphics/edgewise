/**
 * Picking a word — for the `sampling-temperature` node.
 *
 * THE QUESTION. "Why can the same beginning get a different next word?"
 *
 * The node's first recorded misconception is that the model "decides" to phrase
 * things differently. It does not decide anything. It hands out a chance for
 * every possible next piece, and something outside it draws one. So this panel
 * does not argue: it puts three chances on screen, leaves them there, and lets
 * somebody press one button until the same three chances have produced two
 * different words. That is the whole first half.
 *
 * The second half is the node's other misconception — that always taking the
 * most likely piece must give the best output. `SETTINGS` below makes that one
 * of four explicit choices rather than the silent default it is in the
 * one-piece-at-a-time experiment next door, whose own header says so:
 *
 *   "The highest chance always wins, with a stated tie rule. Choosing at random
 *    among the likely pieces is a different idea and belongs to its own
 *    experiment."
 *
 * This is that experiment.
 *
 * WHAT IS REAL HERE. Every adjustment and every draw. `adjust` is a real
 * temperature rescaling and `drawFrom` is a real weighted draw, both computed in
 * the browser with no request and no key.
 *
 * WHAT IS A TEACHING CHOICE, SAID ON SCREEN.
 *
 *   - The three starting chances were CHOSEN for this example. They were not
 *     measured from a language model, and the panel says so beside them.
 *   - Three endings, against a real vocabulary of tens of thousands.
 *   - Real systems usually also cut the unlikely tail off before drawing
 *     (top-k, top-p). Nothing here does that, and the panel says so.
 *   - Temperature zero here gives the same word every single time. That is a
 *     fact about a closed three-word example, NOT a promise that a deployed
 *     service returns an identical answer twice.
 *
 * NO PREDICTION STEP. The learner has been given nothing they could use to work
 * out which word will come out — that is the point of the panel — and asking
 * somebody to guess an unexplained result is what `AGENTS.md` forbids.
 *
 * THE STARTING CHANCES NEVER MOVE. `adjust` takes them as a parameter and
 * returns a new array; nothing here can write to `ENDINGS`. "Changing the
 * setting does not change what the model produced" is the shape of the
 * functions rather than a promise in a comment, the same structural move as
 * `answerWith(learned, distance)` in `phases.ts`, and `sampling.test.ts` holds
 * it to that.
 *
 * THE RANDOMNESS IS A PARAMETER. `drawFrom` and `drawBatch` take the source of
 * randomness in their signatures rather than reaching for `Math.random` inside.
 * That is what lets the tests drive exact boundary values and a seeded sequence,
 * and it puts the one genuinely non-deterministic thing in this repo somewhere
 * it can be seen. `Math.random` is named once, at the call site.
 */

export type Ending = {
  id: string;
  word: string;
  /** Share of the chance this ending starts with. The set sums to 1. */
  chance: number;
};

/** The beginning every draw continues. */
export const OPENING = 'In the garden I found a';

/**
 * The three endings and their starting chances.
 *
 * Chosen for this example, not measured from a language model — which is said
 * on screen next to them rather than only here. They are ordered most likely
 * first, so "the top option" is also the first row, and they are far enough
 * apart that one press is usually the usual word and a run of presses is not.
 */
export const ENDINGS: readonly Ending[] = [
  { id: 'flower', word: 'flower', chance: 0.6 },
  { id: 'stone', word: 'stone', chance: 0.3 },
  { id: 'dragon', word: 'dragon', chance: 0.1 },
];

export const STARTING_CHANCES: readonly number[] = ENDINGS.map(ending => ending.chance);

export type SettingId = 'as-given' | 'usual' | 'unusual' | 'top';

export type Setting = {
  id: SettingId;
  /**
   * What the button says. It names what the setting DOES, never how the draw
   * will turn out — "past it", "too far", "best" and "worse" are all verdicts
   * on a result the learner has not seen yet, and the same rule is already
   * tested in `steps.ts`.
   */
  label: string;
  /**
   * The number behind the label. Zero means "take the top option", which is a
   * separate rule rather than a very small temperature: no amount of dividing
   * gets you exactly there, and rounding towards it would be a lie about a
   * decision somebody actually made.
   */
  temperature: number;
  note: string;
};

/**
 * The four choices, in the order they are offered.
 *
 * "Temperature" is deliberately absent from every label and note. The word is
 * introduced on screen only after one of these has been used and a real change
 * is visible, which is the order every panel in this project uses for a name.
 */
export const SETTINGS: readonly Setting[] = [
  {
    id: 'as-given',
    label: 'Keep the chances as they are',
    temperature: 1,
    note: 'The chances the model produced, used exactly as they came.',
  },
  {
    id: 'usual',
    label: 'Favour the usual endings',
    temperature: 0.5,
    note: 'The likely endings take more of the chance. The unlikely ones keep a little.',
  },
  {
    id: 'unusual',
    label: 'Give unusual endings more chance',
    temperature: 2,
    note: 'The chance is spread more evenly, so the rare endings come up more often.',
  },
  {
    id: 'top',
    label: 'Always pick the top option',
    temperature: 0,
    note: 'No drawing at all. The ending with the most chance is taken every time.',
  },
];

export const FIRST_SETTING = SETTINGS[0];

export function settingById(id: SettingId): Setting {
  return SETTINGS.find(setting => setting.id === id) ?? FIRST_SETTING;
}

/** How many draws one press of the batch button makes. */
export const BATCH_SIZE = 20;

/** Anything at or below zero is impossible, and stays impossible at every setting. */
const possible = (chance: number) => (chance > 0 ? chance : 0);

/**
 * The chances after a setting has been applied.
 *
 * For a temperature above zero this is the usual rescaling, written stably:
 * score each chance as `log(p) / T`, subtract the largest score before taking
 * `exp`, then scale the results to add up to 1. Algebraically that is
 * `p^(1/T)` normalised, which is how the test checks it — a second route
 * through `Math.pow` that shares no code with this one.
 *
 * The subtraction is not tidiness. Written the obvious way, every weight is
 * `exp` of a negative number, and a small enough temperature drives all of them
 * below what a double can hold: at T = 0.0005 the largest is `exp(-1021)`,
 * which underflows to zero, so the total is zero and every chance comes out
 * `NaN`. Taking the largest score off first pins that one weight at exactly 1,
 * so the total can never be zero. A panel that printed `NaN` as a chance would
 * be teaching the exact thing this node exists to correct.
 *
 * At temperature zero there is no drawing to weight, so this is an explicit
 * argmax instead: all of the chance to the highest, none to the rest, and a
 * tie goes to the one listed first. That rule is stated on screen.
 *
 * A chance of zero survives as a zero at every setting: `log(0)` is `-Infinity`
 * and its weight is zero. Nothing here can make an impossible ending possible.
 */
export function adjust(chances: readonly number[], temperature: number): number[] {
  if (!Number.isFinite(temperature) || temperature < 0) {
    throw new RangeError(`temperature must be a finite number of 0 or more, got ${temperature}`);
  }

  if (temperature === 0) {
    let best = -1;
    for (let index = 0; index < chances.length; index += 1) {
      if (possible(chances[index]) === 0) continue;
      // Strictly greater, so an equal chance leaves the earlier one in place.
      if (best === -1 || chances[index] > chances[best]) best = index;
    }
    return chances.map((_, index) => (index === best ? 1 : 0));
  }

  const scores = chances.map(chance => (possible(chance) > 0 ? Math.log(chance) / temperature : -Infinity));
  const highest = Math.max(...scores.filter(Number.isFinite));
  if (!Number.isFinite(highest)) return chances.map(() => 0);

  const weights = scores.map(score => (Number.isFinite(score) ? Math.exp(score - highest) : 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return chances.map(() => 0);
  return weights.map(weight => weight / total);
}

/**
 * One draw. Returns the index of the ending picked, or -1 if nothing is
 * possible at all.
 *
 * Walks the chances adding them up and stops at the first one the random value
 * falls inside. A value sitting exactly on a boundary falls into the LATER
 * bucket, which is stated here because a rule like that has to be somewhere and
 * the test drives both sides of it. An ending with no chance is skipped rather
 * than given a zero-width slot to land in.
 */
export function drawFrom(chances: readonly number[], random: () => number): number {
  const value = random();
  let reached = 0;
  for (let index = 0; index < chances.length; index += 1) {
    const chance = possible(chances[index]);
    if (chance === 0) continue;
    reached += chance;
    if (value < reached) return index;
  }
  /*
   * Only reachable when the chances add up to slightly under 1 through ordinary
   * floating-point error and the value lands in the sliver above them. The last
   * possible ending takes it, rather than the draw failing.
   */
  for (let index = chances.length - 1; index >= 0; index -= 1) {
    if (possible(chances[index]) > 0) return index;
  }
  return -1;
}

/** How many times each ending came up over `count` draws. */
export function drawBatch(chances: readonly number[], count: number, random: () => number): number[] {
  const counts = chances.map(() => 0);
  for (let draw = 0; draw < count; draw += 1) {
    const index = drawFrom(chances, random);
    if (index >= 0) counts[index] += 1;
  }
  return counts;
}

export type Change = {
  /** Which ending took the most extra chance. */
  index: number;
  from: number;
  to: number;
};

/**
 * What a setting actually did, read off the two sets of numbers.
 *
 * The panel's sentence about the change is built from this rather than written
 * down beside each setting, so it cannot end up describing a rescaling that no
 * longer happens. `null` means nothing moved, which is the honest answer for
 * the setting that leaves the chances alone.
 */
export function describeChange(base: readonly number[], adjusted: readonly number[]): Change | null {
  let best = -1;
  let gain = 1e-9;
  for (let index = 0; index < base.length; index += 1) {
    const moved = adjusted[index] - base[index];
    if (moved > gain) {
      gain = moved;
      best = index;
    }
  }
  return best === -1 ? null : { index: best, from: base[best], to: adjusted[best] };
}

/**
 * A percentage for the screen. Never prints 0% for something genuinely
 * possible — the same rule as the one-piece-at-a-time panel, kept here rather
 * than imported, because that module builds its whole counting model the
 * moment it is loaded and this panel has no use for it.
 */
export function percent(chance: number): string {
  if (chance <= 0) return '0%';
  const rounded = Math.round(chance * 1000) / 10;
  return rounded < 0.1 ? 'under 0.1%' : `${rounded}%`;
}
