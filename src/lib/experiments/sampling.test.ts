import { describe, expect, it } from 'vitest';

import {
  adjust,
  BATCH_SIZE,
  describeChange,
  drawBatch,
  drawFrom,
  ENDINGS,
  FIRST_SETTING,
  percent,
  SETTINGS,
  settingById,
  STARTING_CHANCES,
} from './sampling';

/**
 * The expectations here are worked out INDEPENDENTLY of the implementation.
 * Asserting a rescaling against the function that did the rescaling is the trap
 * this project has now closed nine different ways — `bpe_ranks` decoded
 * independently, the least-squares conditions, brute force over 65,536
 * pictures, hand arithmetic, answers worked out on paper, pinning to a
 * published file, literal `Math.exp` calls, a second implementation of a whole
 * transformer block, and a naive scan of raw story text.
 *
 * This is the tenth: the POWER FORM. `softmax(log p / T)` is algebraically
 * `p^(1/T)` scaled to add up to 1, and `byPower` below computes exactly that
 * with `Math.pow`, sharing no code and no intermediate value with `adjust`. It
 * is only a valid check across temperatures where `Math.pow` itself stays in
 * range — the whole reason `adjust` is written the other way — so the sweep
 * below stops well short of the extremes, which are checked by their limits
 * instead.
 *
 * Alongside it, arithmetic anybody can do: at T = 0.5 each chance is squared
 * and the three are scaled to add up to 1.
 */
function byPower(chances: readonly number[], temperature: number): number[] {
  const raised = chances.map(chance => (chance > 0 ? Math.pow(chance, 1 / temperature) : 0));
  const total = raised.reduce((sum, value) => sum + value, 0);
  return raised.map(value => value / total);
}

/** A seeded generator, so a distribution check is repeatable rather than flaky. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A source that hands back exactly these values, for driving a boundary. */
const feed = (...values: number[]) => {
  let at = 0;
  return () => values[Math.min(at++, values.length - 1)];
};

const total = (chances: readonly number[]) => chances.reduce((sum, chance) => sum + chance, 0);
const close = (actual: number, expected: number, tolerance = 1e-12) =>
  expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThan(tolerance);

describe('the chances this example starts from', () => {
  it('adds up to all of the chance', () => {
    close(total(STARTING_CHANCES), 1);
  });

  it('gives every ending some chance, so none of them is impossible', () => {
    for (const ending of ENDINGS) expect(ending.chance).toBeGreaterThan(0);
  });

  it('lists them most likely first, so the top option is also the first row', () => {
    const sorted = [...STARTING_CHANCES].sort((a, b) => b - a);
    expect(STARTING_CHANCES).toEqual(sorted);
  });

  it('gives every ending a word of its own', () => {
    expect(new Set(ENDINGS.map(ending => ending.word)).size).toBe(ENDINGS.length);
    expect(new Set(ENDINGS.map(ending => ending.id)).size).toBe(ENDINGS.length);
  });
});

describe('changing how the chance is spread', () => {
  it('leaves the chances where they were when nothing is being favoured', () => {
    const result = adjust(STARTING_CHANCES, 1);
    result.forEach((chance, index) => close(chance, STARTING_CHANCES[index]));
  });

  it('agrees with the power form, which shares none of its arithmetic', () => {
    for (const temperature of [0.25, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 4]) {
      const mine = adjust(STARTING_CHANCES, temperature);
      const theirs = byPower(STARTING_CHANCES, temperature);
      mine.forEach((chance, index) => close(chance, theirs[index], 1e-12));
    }
  });

  it('squares each chance at the halfway setting, checked by hand', () => {
    // 0.6, 0.3 and 0.1 squared are 0.36, 0.09 and 0.01, which total 0.46.
    const result = adjust(STARTING_CHANCES, 0.5);
    close(result[0], 0.36 / 0.46);
    close(result[1], 0.09 / 0.46);
    close(result[2], 0.01 / 0.46);
  });

  it('always hands out exactly all of the chance', () => {
    for (const temperature of [0, 0.01, 0.1, 0.5, 1, 2, 5, 25, 100]) {
      close(total(adjust(STARTING_CHANCES, temperature)), 1, 1e-12);
    }
  });

  it('gives the top ending steadily more as the setting favours the usual', () => {
    const cooling = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25, 0.1];
    const tops = cooling.map(temperature => adjust(STARTING_CHANCES, temperature)[0]);
    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index], `at T=${cooling[index]}`).toBeGreaterThan(tops[index - 1]);
    }
    expect(adjust(STARTING_CHANCES, 0.05)[0]).toBeGreaterThan(0.999);
  });

  it('evens the chances out as the setting favours the unusual', () => {
    const warming = [0.5, 1, 2, 4, 8, 16, 32];
    const spreads = warming.map(temperature => {
      const chances = adjust(STARTING_CHANCES, temperature);
      return Math.max(...chances) - Math.min(...chances);
    });
    for (let index = 1; index < spreads.length; index += 1) {
      expect(spreads[index], `at T=${warming[index]}`).toBeLessThan(spreads[index - 1]);
    }
    for (const chance of adjust(STARTING_CHANCES, 50)) {
      expect(Math.abs(chance - 1 / 3)).toBeLessThan(0.01);
    }
  });

  it('never reorders the endings, however the chance is spread', () => {
    for (const temperature of [0.1, 0.5, 1, 2, 10, 100]) {
      const chances = adjust(STARTING_CHANCES, temperature);
      expect(chances[0], `at T=${temperature}`).toBeGreaterThanOrEqual(chances[1]);
      expect(chances[1], `at T=${temperature}`).toBeGreaterThanOrEqual(chances[2]);
    }
  });

  it('stays a real answer at a setting that would overflow the obvious arithmetic', () => {
    // exp(log(0.6) / 0.0005) is exp(-1021), which underflows to zero. Written
    // the obvious way all three weights do, the total is zero, and every chance
    // comes out NaN.
    const naive = STARTING_CHANCES.map(chance => Math.exp(Math.log(chance) / 0.0005));
    expect(total(naive)).toBe(0);

    const result = adjust(STARTING_CHANCES, 0.0005);
    for (const chance of result) expect(Number.isFinite(chance)).toBe(true);
    close(total(result), 1);
    expect(result).toEqual([1, 0, 0]);
  });

  it('does not touch the chances it was given', () => {
    const given = [...STARTING_CHANCES];
    adjust(given, 0.5);
    adjust(given, 2);
    adjust(given, 0);
    expect(given).toEqual([...STARTING_CHANCES]);
    expect(STARTING_CHANCES).toEqual([0.6, 0.3, 0.1]);
    expect(ENDINGS.map(ending => ending.chance)).toEqual([0.6, 0.3, 0.1]);
  });

  it('refuses a setting that is not a number of zero or more', () => {
    for (const temperature of [-1, -0.0001, Number.NaN, Infinity, -Infinity]) {
      expect(() => adjust(STARTING_CHANCES, temperature), `${temperature}`).toThrow(RangeError);
    }
  });
});

describe('taking the top option', () => {
  it('gives all of the chance to the highest and none to the rest', () => {
    expect(adjust(STARTING_CHANCES, 0)).toEqual([1, 0, 0]);
  });

  it('gives a tie to the one listed first', () => {
    expect(adjust([0.25, 0.5, 0.5, 0.25], 0)).toEqual([0, 1, 0, 0]);
  });

  it('cannot pick an ending with no chance, even when it is listed first', () => {
    expect(adjust([0, 0.4, 0.6], 0)).toEqual([0, 0, 1]);
  });

  it('draws the same ending every single time', () => {
    const chances = adjust(STARTING_CHANCES, 0);
    const random = mulberry32(7);
    for (let draw = 0; draw < 200; draw += 1) expect(drawFrom(chances, random)).toBe(0);
  });
});

describe('an ending with no chance at all', () => {
  const chances = [0.5, 0, 0.5];

  it('still has none after any setting', () => {
    for (const temperature of [0.1, 0.5, 1, 2, 10]) {
      expect(adjust(chances, temperature)[1], `at T=${temperature}`).toBe(0);
    }
  });

  it('is never drawn, wherever the random value lands', () => {
    for (let step = 0; step < 1000; step += 1) {
      expect(drawFrom(chances, feed(step / 1000))).not.toBe(1);
    }
  });

  it('gives up entirely when nothing is possible', () => {
    expect(drawFrom([0, 0, 0], feed(0.5))).toBe(-1);
    expect(adjust([0, 0, 0], 1)).toEqual([0, 0, 0]);
    expect(adjust([0, 0, 0], 0)).toEqual([0, 0, 0]);
  });
});

describe('the draw itself', () => {
  it('takes the first ending at the very bottom of the range', () => {
    expect(drawFrom(STARTING_CHANCES, feed(0))).toBe(0);
  });

  it('takes the last ending at the very top of the range', () => {
    expect(drawFrom(STARTING_CHANCES, feed(0.999999999))).toBe(2);
  });

  it('puts a value just inside a boundary in the earlier ending', () => {
    expect(drawFrom(STARTING_CHANCES, feed(0.5999999))).toBe(0);
    expect(drawFrom(STARTING_CHANCES, feed(0.8999999))).toBe(1);
  });

  it('puts a value exactly on a boundary in the later ending', () => {
    expect(drawFrom(STARTING_CHANCES, feed(0.6))).toBe(1);
    expect(drawFrom(STARTING_CHANCES, feed(0.9))).toBe(2);
  });

  it('skips past an impossible ending rather than landing on it', () => {
    expect(drawFrom([0, 0.6, 0.4], feed(0))).toBe(1);
    expect(drawFrom([0, 0.6, 0.4], feed(0.6))).toBe(2);
  });

  it('still answers when the chances add up to a hair under one', () => {
    expect(drawFrom([0.3, 0.3, 0.3], feed(0.99))).toBe(2);
  });
});

describe('a batch of draws', () => {
  it('counts every draw it was asked for', () => {
    const counts = drawBatch(STARTING_CHANCES, 500, mulberry32(11));
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(500);
  });

  it('lands near the chances it was drawing from', () => {
    const counts = drawBatch(STARTING_CHANCES, 20000, mulberry32(20260914));
    counts.forEach((count, index) => {
      expect(Math.abs(count / 20000 - STARTING_CHANCES[index]), `ending ${index}`).toBeLessThan(0.02);
    });
  });

  it('lands near the adjusted chances once a setting has been applied', () => {
    for (const temperature of [0.5, 2]) {
      const chances = adjust(STARTING_CHANCES, temperature);
      const counts = drawBatch(chances, 20000, mulberry32(4242));
      counts.forEach((count, index) => {
        expect(Math.abs(count / 20000 - chances[index]), `T=${temperature}, ending ${index}`).toBeLessThan(0.02);
      });
    }
  });

  it('gives every draw to one ending when the top option is taken', () => {
    const counts = drawBatch(adjust(STARTING_CHANCES, 0), 300, mulberry32(3));
    expect(counts).toEqual([300, 0, 0]);
  });

  it('gives the same counts for the same seed', () => {
    expect(drawBatch(STARTING_CHANCES, 100, mulberry32(5)))
      .toEqual(drawBatch(STARTING_CHANCES, 100, mulberry32(5)));
  });
});

describe('the four settings', () => {
  it('starts on the one that leaves the chances alone', () => {
    expect(FIRST_SETTING.id).toBe('as-given');
    expect(FIRST_SETTING.temperature).toBe(1);
  });

  it('is a complete, unique set that can always be looked up', () => {
    expect(new Set(SETTINGS.map(setting => setting.id)).size).toBe(SETTINGS.length);
    for (const setting of SETTINGS) {
      expect(settingById(setting.id)).toBe(setting);
      expect(setting.temperature).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(setting.temperature)).toBe(true);
      expect(setting.label.length).toBeGreaterThan(0);
      expect(setting.note.length).toBeGreaterThan(0);
    }
  });

  /*
   * Held to what each setting DOES, not to what its own copy says. Rewriting a
   * label can never quietly turn "favour the usual" into something that spreads
   * the chance out instead.
   */
  it('does what each one says: favouring the usual raises the top ending', () => {
    const before = STARTING_CHANCES[0];
    expect(adjust(STARTING_CHANCES, settingById('usual').temperature)[0]).toBeGreaterThan(before);
  });

  it('does what each one says: favouring the unusual raises the bottom ending', () => {
    const last = STARTING_CHANCES.length - 1;
    const before = STARTING_CHANCES[last];
    expect(adjust(STARTING_CHANCES, settingById('unusual').temperature)[last]).toBeGreaterThan(before);
  });

  it('does what each one says: the top option leaves no chance anywhere else', () => {
    expect(adjust(STARTING_CHANCES, settingById('top').temperature)).toEqual([1, 0, 0]);
  });

  /** A label says how the chance is spread. It never says how a draw will turn out. */
  it('never tells the learner how a result will go', () => {
    for (const setting of SETTINGS) {
      const words = `${setting.label} ${setting.note}`.toLowerCase();
      for (const verdict of ['best', 'worst', 'worse', 'better', 'too far', 'past it', 'wrong', 'correct']) {
        expect(words, setting.id).not.toContain(verdict);
      }
    }
  });

  it('draws a batch in whole presses', () => {
    expect(BATCH_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(BATCH_SIZE)).toBe(true);
  });
});

describe('saying what a setting did', () => {
  it('says nothing happened when the chances were left alone', () => {
    expect(describeChange(STARTING_CHANCES, adjust(STARTING_CHANCES, 1))).toBeNull();
  });

  it('names the usual ending when the usual endings are favoured', () => {
    const change = describeChange(STARTING_CHANCES, adjust(STARTING_CHANCES, 0.5));
    expect(change?.index).toBe(0);
    close(change!.from, 0.6);
    close(change!.to, 0.36 / 0.46);
  });

  it('names the rare ending when the unusual endings are given more chance', () => {
    const change = describeChange(STARTING_CHANCES, adjust(STARTING_CHANCES, 2));
    expect(change?.index).toBe(2);
    close(change!.from, 0.1);
    expect(change!.to).toBeGreaterThan(0.1);
  });

  it('names the ending that takes everything when the top option is taken', () => {
    const change = describeChange(STARTING_CHANCES, adjust(STARTING_CHANCES, 0));
    expect(change).toEqual({ index: 0, from: 0.6, to: 1 });
  });
});

describe('putting a chance on screen', () => {
  it('reads as a percentage', () => {
    expect(percent(0.6)).toBe('60%');
    expect(percent(0.1957)).toBe('19.6%');
    expect(percent(1)).toBe('100%');
  });

  it('says nothing is possible only when nothing is', () => {
    expect(percent(0)).toBe('0%');
  });

  it('never prints 0% for something that can genuinely happen', () => {
    expect(percent(0.0004)).toBe('under 0.1%');
    expect(percent(1e-9)).toBe('under 0.1%');
  });
});
