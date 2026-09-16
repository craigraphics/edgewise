'use client';

import { useCallback, useReducer } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  applyAction,
  chances,
  howFarOff,
  indexOfReply,
  initialChooser,
  percent,
  QUESTION,
  REPLIES,
} from '@/lib/experiments/preference';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof usePreferenceExperiment> };

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the choice or the rounds of learning behind it.
 *
 * A reducer rather than a bag of setters. The actions here are ordered and not
 * idempotent, so two presses in quick succession have to be two steps applied
 * in order — which `applyAction` guarantees, and `preference.test.ts` holds it
 * to. It also means pointing at a reply cannot train anything: `select` carries
 * the scores through by reference.
 */
export function usePreferenceExperiment() {
  const [state, dispatch] = useReducer(applyAction, undefined, initialChooser);
  const select = useCallback((id: string) => dispatch({ kind: 'select', id }), []);
  const learn = useCallback(() => dispatch({ kind: 'learn' }), []);
  const reset = useCallback(() => dispatch({ kind: 'reset' }), []);
  return { state, select, learn, reset };
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function PreferenceExperiment({ onExplain, experiment }: Props) {
  const { state, select, learn, reset } = experiment;
  const now = chances(state.scores);
  const chosenIndex = indexOfReply(state.chosen);
  const started = state.rounds > 0;
  const touched = started || state.chosen !== null;

  /*
   * The sentence that says what changed. Every figure in it is read off the
   * state that just moved — which reply, its chance before and after, and which
   * way the others went — so it cannot drift from the numbers beside it.
   */
  const changed = (() => {
    if (!state.before || !state.lastLearned) return null;
    const index = indexOfReply(state.lastLearned);
    const reply = REPLIES[index];
    const was = percent(state.before[index]);
    const became = percent(now[index]);
    const others = REPLIES.filter((_, at) => at !== index).map(each => `“${each.label}”`).join(' and ');
    return `Learned from your choice. “${reply.label}” went from ${was} to ${became}. ${others} went down to make room. Your feedback changed how likely each prepared reply is. It did not write a new reply.`;
  })();

  /** The two replies that both answer, for the preference-between-them section. */
  const shortIndex = indexOfReply('first-step');
  const longIndex = indexOfReply('fuller');
  const manner = now[shortIndex] === now[longIndex]
    ? 'They are level at the moment.'
    : now[shortIndex] > now[longIndex]
      ? `The short one leads at the moment, ${percent(now[shortIndex])} against ${percent(now[longIndex])}.`
      : `The longer one leads at the moment, ${percent(now[longIndex])} against ${percent(now[shortIndex])}.`;

  return <section className="preference-lab" aria-labelledby="preference-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A small experiment · runs in your browser</p>
        <h3 id="preference-lab-title" tabIndex={-1} className="font-display mt-2 text-xl outline-none sm:text-3xl">Why does it answer, instead of adding more questions?</h3>
      </div>
      {/* Offered only once something has changed: a Reset on an untouched screen is a control with nothing to do. */}
      {touched && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>
    <p className="mt-3 max-w-2xl text-base">Choose the reply you would rather have, and a tiny model here learns to choose it more often.</p>

    <div className="preference-stage mt-5">
      <div className="preference-ask-area">
        <div className="preference-ask">
          <p className="eyebrow">Somebody asks</p>
          <p className="font-display mt-2 text-lg sm:text-2xl">{QUESTION}</p>
        </div>
      </div>

      <div className="preference-replies-area">
        <p className="eyebrow">{started ? 'Choose again to keep going' : 'Step 1 · choose a reply'}</p>
        <p className="text-muted-foreground mt-1 mb-2 text-xs">All three were written by hand for this example. The model learns which one to choose, never what to say: it is not writing bicycle advice.</p>
        <ul className="preference-replies">
          {REPLIES.map((reply, index) => {
            const picked = state.chosen === reply.id;
            const before = state.before ? state.before[index] : null;
            return <li key={reply.id} className={cn('preference-reply', picked && 'preference-reply-picked')}>
              {/*
                * The whole card is the control, so choosing is the first thing
                * there is to do rather than something 178px into the first card.
                * The chance sits OUTSIDE it: a number that moves every round has
                * no business inside a button's accessible name.
                */}
              <button type="button" aria-pressed={picked} onClick={() => select(reply.id)} className="preference-choose">
                <span className="preference-reply-label">{reply.label}</span>
                <span className="mt-1 block text-sm">{reply.text}</span>
                <span className="text-muted-foreground mt-1 block text-xs">{reply.note}</span>
                <span className="preference-pick">{picked ? <><Check size={15} aria-hidden />You prefer this reply</> : 'Prefer this reply'}</span>
              </button>

              <p className="preference-chance">
                <span className="preference-bar" aria-hidden><span style={{ width: `${now[index] * 100}%` }} /></span>
                <span className="font-mono tabular-nums text-sm font-medium">{percent(now[index])}</span>
                {/* Just what it was. The percentage it is now is printed right beside this, and saying it twice is noise. */}
                <span className="text-muted-foreground text-xs">
                  {before === null ? 'chance of being chosen' : `was ${percent(before)} before the last round`}
                </span>
              </p>
            </li>;
          })}
        </ul>
      </div>

      <div className="preference-action-area">
        <div className="preference-action">
          <p className="eyebrow">Step 2 · teach it</p>
          <Button size="touch" className="mt-2 h-auto max-w-full py-2 text-left whitespace-normal" disabled={state.chosen === null} onClick={learn}>Learn from this choice <ArrowRight aria-hidden /></Button>
          <div aria-live="polite" className="preference-change mt-3">
            {changed
              ? <p className="text-sm">{changed}</p>
              : <p className="text-muted-foreground text-sm">{state.chosen === null ? 'Choose one of the three replies first. Choosing changes no number on its own.' : 'Nothing has moved yet. Press the button to learn from that choice.'}</p>}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            {started
              ? `${state.rounds} ${state.rounds === 1 ? 'round' : 'rounds'} of learning so far. The three chances always add up to 100%, so one can only rise if the others fall.`
              : 'The starting chances are made up for this example. They are not measured from a real model.'}
          </p>
        </div>
      </div>
    </div>

    {started && <div className="preference-name mt-5">
      <p className="eyebrow">What just happened has a name</p>
      <p className="font-display mt-2 text-xl">Training a model further on which replies people prefer is called post-training.</p>
      <p className="mt-2 text-sm">Predicting the next piece of text gets you something that continues what it is given. On its own, a question is often followed by more questions, which is why that reply started with the most chance here. Answering gets more likely when training rewards it.</p>
      <ul className="preference-points mt-3">
        <li><strong>Nothing was rewritten.</strong> All three replies are the same, word for word, and so is the question. The only thing that moved is how likely each reply is.</li>
        <li><strong>People chose.</strong> How a model answers, how much it says, and what it declines to say are choices made by people during this stage. They are not fixed properties of the technology, and different people choose differently.</li>
        <li><strong>This is one idea inside a large stage.</strong> Real post-training uses written examples of good answers as well as choices between replies, and it adjusts a great many saved numbers rather than three.</li>
      </ul>
    </div>}

    {started && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">Your choice changed how likely each prepared reply is. What did that change, and what did it leave exactly as it was?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Trying this experiment leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="preference-details mt-5">
      <summary className="preference-summary">Try another preference</summary>
      <div className="text-muted-foreground space-y-3 pb-2 text-sm">
        <p>Two of the three replies answer the question. One stops after the first step; the other says why and what to look at next. Prefer either of those above and learn from it again.</p>
        <p>{manner} Neither of them is the right answer here. A person decides which they would rather have, and a model trained on enough of those choices ends up sounding like the people who made them.</p>
        <p>That is the same mechanism doing a second job: it can steer how much a model says, not only whether it answers at all.</p>
      </div>
    </details>

    <details className="preference-details mt-2">
      <summary className="preference-summary">How it works</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>Each reply has one score. The scores are turned into chances by raising each one to a power and dividing by the total, so the three always add up to 100% and one can only go up if the others come down. None of them ever reaches 100%, and none is ever ruled out: keep pressing and the chosen reply creeps towards certainty without arriving.</p>
        <p>Learning needs a number saying how far off the choice was. Here that is how much chance the reply you chose was missing: 0 if it already had all of it, and bigger the less it had.</p>
        {chosenIndex >= 0 && <p>
          Right now, for “{REPLIES[chosenIndex].label}”, that number is <strong className="text-foreground font-mono tabular-nums">{howFarOff(state.scores, chosenIndex).toFixed(2)}</strong>
          {state.before && state.lastLearned === state.chosen ? <> — down from <strong className="text-foreground font-mono tabular-nums">{(-Math.log(state.before[chosenIndex])).toFixed(2)}</strong> before the last press.</> : '.'}
        </p>}
        <p>One press nudges every score a little in the direction that makes that number smaller: the chosen reply&rsquo;s score goes up, the others come down. Every press nudges by the same amount, and the panel does not offer to change it, because here a bigger step only moves faster — the direction is the same whatever size you take.</p>
        <p>All the arithmetic happens in your browser. Nothing is sent anywhere and no model is called.</p>
      </div>
    </details>

    <details className="preference-details mt-2">
      <summary className="preference-summary">What this example leaves out</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>This is a narrow demonstration of learning from feedback over three replies that were fixed in advance. It is not pretraining, it is not training on written example answers, and it is not any particular preference-training method.</p>
        <p>Real post-training adjusts a great many of a model&rsquo;s saved numbers, from written examples and from other kinds of feedback. It is not the same as adding an instruction to a single request, which changes nothing about the model.</p>
        <p>A model that has only been trained to continue text is not silent. It does answer questions, especially where the text in front of it makes an answer the likely continuation, and people used to get useful answers out of one by showing it a few worked examples first. Further training makes answering reliable and steerable rather than possible for the first time.</p>
        <p>Further training changes what a model knows and what it can do, not only its manner. It is also not one tidy stage: in practice it is several overlapping ones, with methods people disagree about.</p>
        <p>Nothing learned here transfers. Only the chance of choosing among these three replies moved, so this model is no better at any question these three replies do not already answer.</p>
      </div>
    </details>

    <p className="text-muted-foreground mt-5 text-sm">Predicting the next piece gives training a goal. Further training can reward examples of the replies people want.</p>
  </section>;
}
