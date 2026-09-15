'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, Dices, Repeat, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  adjust,
  BATCH_SIZE,
  describeChange,
  drawBatch,
  drawFrom,
  ENDINGS,
  FIRST_SETTING,
  OPENING,
  percent,
  SETTINGS,
  settingById,
  STARTING_CHANCES,
  type SettingId,
} from '@/lib/experiments/sampling';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useSamplingExperiment> };

/** One draw: which ending came out, and the chance it had at that moment. */
type Pick = { index: number; chance: number; settingId: SettingId };
type Tally = { counts: readonly number[]; draws: number };

/** The most recent picks kept on screen. Older ones are counted, not listed. */
const RECENT = 12;

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the setting, the picks, or the counts.
 */
export function useSamplingExperiment() {
  const [settingId, setSettingId] = useState<SettingId>(FIRST_SETTING.id);
  const [picks, setPicks] = useState<readonly Pick[]>([]);
  const [tally, setTally] = useState<Tally | null>(null);
  /** True once a draw has happened while the chances were being reshaped. */
  const [reshaped, setReshaped] = useState(false);

  /*
   * Both actions draw here, in the handler, and hand the finished result to
   * `setState`. An updater has to be pure — React may run it twice — and a
   * random draw inside one would produce two different answers for one press.
   * Drawing during render would be worse still: the server and the browser
   * would disagree about what came out.
   */
  const pick = useCallback(() => {
    const chances = adjust(STARTING_CHANCES, settingById(settingId).temperature);
    const index = drawFrom(chances, Math.random);
    if (index < 0) return;
    const drawn: Pick = { index, chance: chances[index], settingId };
    setPicks(existing => [...existing, drawn]);
    if (settingId !== FIRST_SETTING.id) setReshaped(true);
  }, [settingId]);

  const drawMore = useCallback(() => {
    const chances = adjust(STARTING_CHANCES, settingById(settingId).temperature);
    const counts = drawBatch(chances, BATCH_SIZE, Math.random);
    setTally(existing => (existing
      ? { counts: existing.counts.map((count, index) => count + counts[index]), draws: existing.draws + BATCH_SIZE }
      : { counts, draws: BATCH_SIZE }));
    if (settingId !== FIRST_SETTING.id) setReshaped(true);
  }, [settingId]);

  /*
   * The counts belong to one setting. Carrying them across a change would put
   * a column of counts beside chances they were never drawn from, which is the
   * one thing a tally must never do.
   */
  const choose = useCallback((next: SettingId) => {
    setSettingId(next);
    setTally(null);
  }, []);

  const reset = useCallback(() => {
    setSettingId(FIRST_SETTING.id);
    setPicks([]);
    setTally(null);
    setReshaped(false);
  }, []);

  return { settingId, picks, tally, reshaped, pick, drawMore, choose, reset };
}

const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** Local drawing only: this component deliberately has no learner-model access. */
export function SamplingExperiment({ onExplain, experiment }: Props) {
  const { settingId, picks, tally, reshaped, pick, drawMore, choose, reset } = experiment;

  const setting = settingById(settingId);
  const chances = adjust(STARTING_CHANCES, setting.temperature);
  const change = describeChange(STARTING_CHANCES, chances);
  const last = picks[picks.length - 1] ?? null;
  const touched = picks.length > 0 || tally !== null || settingId !== FIRST_SETTING.id;

  /*
   * Two different endings out of ONE set of chances. Picks made under different
   * settings were not drawn from the same chances, so they cannot carry the
   * claim the panel makes from this, and the sentence below would be false.
   */
  const variedOnOneSetting = SETTINGS.some(each =>
    new Set(picks.filter(each_pick => each_pick.settingId === each.id).map(each_pick => each_pick.index)).size > 1);

  /*
   * What the last press did. Every word of it is read off the draw that just
   * ran — the ending and the chance it actually had — so it cannot drift from
   * what the panel is showing. The sentence card is not a live region itself,
   * because this names the word it puts there and two announcements for one
   * press is worse than one.
   */
  const changed = last
    ? `This pick gave “${ENDINGS[last.index].word}”, which had ${percent(last.chance)} of the chance.`
      + (variedOnOneSetting
        ? ' The same chances have now given more than one ending.'
        : ' The chances have not moved.')
    : null;

  /** What the current setting did, read off the two sets of numbers. */
  const spread = change === null
    ? 'These are the chances the model produced, used exactly as they came.'
    : `${change.to >= 1
        ? `${cap(ENDINGS[change.index].word)} takes all of the chance now, and the other two cannot come up at all.`
        : `${cap(ENDINGS[change.index].word)} has more of the chance now: ${percent(change.to)} instead of ${percent(change.from)}.`
      } The three chances the model produced have not changed. What changed is how we draw from them.`;

  return <section className="sampling-lab" aria-labelledby="sampling-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A small experiment · runs in your browser</p>
        <h3 id="sampling-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Why can the same beginning get a different next word?</h3>
      </div>
      {/* Offered only once something has changed: a Reset on an untouched screen is a control with nothing to do. */}
      {touched && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>
    <p className="mt-3 max-w-2xl text-base">A model has been given the start of a sentence. It has not chosen a word. It has produced three possible endings, each with a share of the chance.</p>
    <p className="text-muted-foreground mt-2 max-w-2xl text-sm">These three chances were chosen for this example. They were not measured from a language model.</p>

    <div className="sampling-stage mt-5">
      <div className="sampling-sentence-area">
        <div className="sampling-sentence">
          <p className="eyebrow">The sentence</p>
          <p className="font-display mt-2 text-2xl">{OPENING} {last ? <strong>{ENDINGS[last.index].word}</strong> : <span className="sampling-blank">?</span>}</p>
        </div>
      </div>

      <div className="sampling-action-area">
        <Button size="touch" onClick={pick}><Dices aria-hidden />Pick an ending</Button>
        <div aria-live="polite" className="sampling-change mt-3">
          {changed
            ? <p className="text-sm">{changed}</p>
            : <p className="text-muted-foreground text-sm">Press the button. The same three chances are used every time.</p>}
        </div>
      </div>

      <div className="sampling-chances-area">
        <div className="sampling-chances">
          <p className="eyebrow">The chance of each ending</p>
          <ul className="sampling-rows mt-3">
            {ENDINGS.map((ending, index) => <li key={ending.id} className={cn('sampling-row', index === 0 && 'sampling-row-lead')}>
              <span className="sampling-word">{ending.word}</span>
              <span className="sampling-bar" aria-hidden><span style={{ width: `${chances[index] * 100}%` }} /></span>
              <span className="sampling-chance font-mono tabular-nums">{percent(chances[index])}</span>
              {change !== null && <span className="sampling-was">started at {percent(STARTING_CHANCES[index])}</span>}
            </li>)}
          </ul>
          <p className="text-muted-foreground mt-3 text-xs">{change === null
            ? 'These add up to all of the chance. Nothing else can come out.'
            : 'Each row shows what it has now and what it started with. The model produced the starting numbers; the setting below reshaped them.'}</p>
        </div>
      </div>
    </div>

    {picks.length > 0 && <div className="sampling-picks mt-4">
      <p className="eyebrow">The picks so far</p>
      <ol className="sampling-pick-list mt-2">
        {picks.slice(-RECENT).map((each, at) => <li key={picks.length - Math.min(picks.length, RECENT) + at} className="sampling-pick">{ENDINGS[each.index].word}</li>)}
      </ol>
      <p className="text-muted-foreground mt-2 text-xs">
        {picks.length} {picks.length === 1 ? 'pick' : 'picks'}{picks.length > RECENT ? `, showing the last ${RECENT}` : ''}.
        {variedOnOneSetting
          ? ' Same opening, the same chances, and not the same ending.'
          : ' The chances above have not changed while you have been pressing.'}
      </p>
    </div>}

    <div className="sampling-settings mt-4">
      <p className="eyebrow">Change how the chance is spread</p>
      {picks.length < 2 && <p className="text-muted-foreground mt-2 text-sm">Pick a couple of times first, then come back to these.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {SETTINGS.filter(each => each.id !== 'top').map(each => <Button
          key={each.id} size="touch" variant={each.id === settingId ? 'default' : 'outline'}
          className="h-auto max-w-full py-2 text-left whitespace-normal"
          onClick={() => choose(each.id)}
        >{each.label}</Button>)}
      </div>
      <div aria-live="polite" className="sampling-spread mt-3"><p className="text-sm">{spread}</p></div>
      <div className="sampling-top mt-3">
        <Button
          size="touch" variant={settingId === 'top' ? 'default' : 'outline'}
          className="h-auto max-w-full py-2 text-left whitespace-normal"
          onClick={() => choose('top')}
        >{settingById('top').label}</Button>
        <p className="text-muted-foreground mt-2 text-xs">A different kind of choice, so it sits on its own: nothing is drawn at all. The ending with the most chance is taken every time, and if two were exactly level the one listed first would win.</p>
      </div>
    </div>

    {reshaped && <div className="sampling-name mt-5">
      <p className="eyebrow">What just happened has a name</p>
      <p className="font-display mt-2 text-xl">Drawing one ending out of a list of chances is called sampling. The setting you changed is called temperature.</p>
      <ul className="sampling-points mt-3">
        <li><strong>Temperature changes how strongly the likely endings are favoured.</strong> Low, and the usual ending takes nearly all of the chance. High, and the chance is shared out more evenly. It is applied to the chances after the model has produced them, which is why the starting numbers on screen never move.</li>
        <li><strong>It does not add anything the model did not have.</strong> It cannot make an ending more accurate, it does not measure imagination, and it has no way of checking whether an answer is true. The same three numbers go in every time.</li>
        <li><strong>Always taking the top option is a real choice, not a mistake.</strong> For a short factual answer it is often what you want. Over a long piece of writing it tends to circle back on itself, because the most likely continuation of a sentence you have already written is often that sentence again.</li>
      </ul>
    </div>}

    {reshaped && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">Nothing about the model’s three chances changed while you were pressing. So what decided which ending came out each time, and what did changing the setting do to that?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Trying this experiment leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="sampling-details mt-5">
      <summary className="sampling-summary">Try a few more</summary>
      <div className="space-y-3 pb-2 text-sm">
        <p className="text-muted-foreground">One pick tells you very little. Drawing {BATCH_SIZE} at a time is enough to see the shape of the chances in the counts.</p>
        <Button size="touch" onClick={drawMore}><Repeat aria-hidden />Draw {BATCH_SIZE} more</Button>
        <div aria-live="polite">
          {tally ? <>
            <ul className="sampling-tally">
              {ENDINGS.map((ending, index) => <li key={ending.id} className="sampling-tally-row">
                <span>{ending.word}</span>
                <span className="font-mono tabular-nums">{tally.counts[index]} of {tally.draws}</span>
                <span className="font-mono tabular-nums">{percent(tally.counts[index] / tally.draws)}</span>
                <span className="text-muted-foreground">chance {percent(chances[index])}</span>
              </li>)}
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">Those counts describe these {tally.draws} draws and nothing else. A long run usually sits close to the chances; a short one can sit some way off, and that is ordinary drawing rather than a fault in it.</p>
          </> : <p className="text-muted-foreground">No draws counted yet.</p>}
        </div>
        <p className="text-muted-foreground text-xs">Changing the setting starts the counts again, because a count only means something beside the chances it was drawn from.</p>
      </div>
    </details>

    <details className="sampling-details mt-2">
      <summary className="sampling-summary">How it works</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>To draw one ending, the three shares are laid end to end along a line from 0 to 1, a number in that range is taken at random, and whichever share it lands in wins. Flower covers the first {percent(STARTING_CHANCES[0])} of that line, so it wins about six times in ten.</p>
        <p>A setting reshapes the shares before the draw. Each chance is raised to the power of 1 divided by the setting’s number, and the three results are scaled so they add up to all of the chance again. That number is the temperature:</p>
        <ul className="sampling-list">
          {SETTINGS.map(each => <li key={each.id}><strong className="text-foreground">{each.label}</strong> is {each.temperature}. {each.note}</li>)}
        </ul>
        <p>At 1 nothing changes at all. Below 1 the gaps between the chances widen, so the usual endings take more. Above 1 the gaps narrow, so the rare endings take more. Written the usual way that is <span className="font-mono">softmax(log p / T)</span>, which is the same arithmetic.</p>
        <p>Zero is a separate rule rather than a very small number, because no amount of dividing reaches it: take the ending with the most chance, and give a tie to the one listed first.</p>
        <p>Every setting is worked out from the same three starting chances, which are never written to. That is why moving between the settings always comes back to the same numbers.</p>
      </div>
    </details>

    <details className="sampling-details mt-2">
      <summary className="sampling-summary">What this example leaves out</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>The three starting chances were chosen for this example. They were not measured from a language model, and no model ran to produce them.</p>
        <p>Three endings, against the tens of thousands of pieces a real model has a chance for. Almost all of those would have very little of the chance, and every one of them would still be on the list.</p>
        <p>Real systems usually cut the least likely pieces off the list before drawing at all. That cut is a separate setting from this one, and nothing here does it.</p>
        <p>Taking the top option here gives the same word every time, because this is a closed list of three with nothing level in it. That is not a promise that asking a real service the same question twice gives the same answer. The same setting can still vary there, for reasons that have nothing to do with this one.</p>
        <p>A dragon in a garden is unusual, and that is all it is. Nothing in the drawing treats it differently from the other two.</p>
      </div>
    </details>

    <p className="text-muted-foreground mt-5 text-sm">A language model works out a chance for every possible next piece. Sampling is how one of those pieces gets picked.</p>
  </section>;
}
