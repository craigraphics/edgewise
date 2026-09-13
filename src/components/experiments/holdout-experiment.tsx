'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, Check, EyeOff, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  CAUTIONS,
  cautionById,
  compareGroups,
  describeOutcome,
  INITIAL_SET,
  leaningWords,
  learnFilter,
  MESSAGE_SETS,
  runOn,
  type Caution,
  type CautionId,
  type Learned,
  type MessageSet,
  type Outcome,
  type Row,
} from '@/lib/experiments/junk-filter';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useHoldoutExperiment> };

/** What a message actually was, in the words the panel uses everywhere. */
const TRUTH_COPY = { junk: 'Junk', wanted: 'You wanted this' } as const;

/**
 * The filter the learner last pressed the button on.
 *
 * A snapshot, for the reason recorded on the predictor's fit: a filter that
 * changed the instant an example was unticked would hide the one step this
 * panel is about. It remembers which examples it was built from so the panel
 * can say plainly when the two have drifted apart.
 */
type Snapshot = { setLabel: string; ids: readonly string[]; learned: Learned };

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never loses which mailbox is on screen, which setting was chosen, whether the
 * saved messages have been opened, or the note saying they have.
 */
export function useHoldoutExperiment() {
  const [set, setSet] = useState<MessageSet>(INITIAL_SET);
  /** Learn-group messages the learner has switched off. Ids, so they survive a set change. */
  const [excluded, setExcluded] = useState<readonly string[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  /** No implicit choice: choosing the setting is the point of the middle group. */
  const [caution, setCaution] = useState<CautionId | null>(null);
  /** Mailboxes whose final check has been opened. Each mailbox has its own saved messages. */
  const [revealedSets, setRevealedSets] = useState<readonly string[]>([]);
  /** Mailboxes where the filter changed after its final answers were on screen. */
  const [tamperedSets, setTamperedSets] = useState<readonly string[]>([]);
  /**
   * Deliberately survives this panel's own Reset.
   *
   * Reset starts the same exercise again; it does not un-see an answer. Saying
   * the screen is fresh when the person reading it remembers the saved answers
   * would be the panel telling exactly the lie it exists to warn about.
   */
  const [everRevealed, setEverRevealed] = useState(false);
  const [moreExamples, setMoreExamples] = useState(false);

  const used = set.learn.filter(message => !excluded.includes(message.id));
  const revealed = revealedSets.includes(set.label);

  /** Any change to the filter, from either control, once the answers are out. */
  const noteChange = useCallback((label: string, seen: boolean) => {
    if (seen) setTamperedSets(current => (current.includes(label) ? current : [...current, label]));
  }, []);

  const learn = useCallback(() => {
    setSnapshot({ setLabel: set.label, ids: used.map(message => message.id), learned: learnFilter(used) });
  }, [set.label, used]);

  const toggleExample = useCallback((id: string) => {
    setExcluded(current => (current.includes(id) ? current.filter(other => other !== id) : [...current, id]));
    noteChange(set.label, revealed);
  }, [noteChange, revealed, set.label]);

  const chooseCaution = useCallback((id: CautionId) => {
    setCaution(id);
    noteChange(set.label, revealed);
  }, [noteChange, revealed, set.label]);

  /**
   * A different mailbox is a different exercise, with its own saved messages.
   * Switching to one whose final check has not been opened is a fresh check,
   * and switching back to one that has does not make it fresh again.
   */
  const chooseSet = useCallback((next: MessageSet) => {
    setSet(next);
    setSnapshot(null);
    setExcluded([]);
    setCaution(null);
  }, []);

  const reveal = useCallback(() => {
    setRevealedSets(current => (current.includes(set.label) ? current : [...current, set.label]));
    setEverRevealed(true);
  }, [set.label]);

  const reset = useCallback(() => {
    setSet(INITIAL_SET);
    setExcluded([]);
    setSnapshot(null);
    setCaution(null);
    setRevealedSets([]);
    setTamperedSets([]);
    setMoreExamples(false);
  }, []);

  return {
    set, excluded, snapshot, caution, moreExamples, everRevealed,
    used, revealed, tampered: tamperedSets.includes(set.label),
    learn, toggleExample, chooseCaution, chooseSet, reveal, reset, setMoreExamples,
  };
}

/**
 * One message, its score, what the filter called it, and what it actually was.
 *
 * There is no "hide the answer" flag here on purpose. A group whose answers are
 * not to be seen is not rendered at all, which is a stronger guarantee than a
 * prop that could be passed the wrong way round.
 */
function MessageRow({ row, bar }: { row: Row; bar: number }) {
  const mistake = row.truth === 'wanted' && row.called === 'junk'
    ? 'It hid mail you wanted'
    : row.truth === 'junk' && row.called === 'wanted'
      ? 'Junk got through'
      : null;

  return <li className="holdout-row">
    <p className="holdout-row-text">“{row.text}”</p>
    <span className="holdout-said">
      <span className="holdout-said-label">Filter said</span>
      <strong>{row.called === 'junk' ? 'Junk' : 'Not junk'}</strong>
    </span>
    <span className="holdout-said">
      <span className="holdout-said-label">It actually was</span>
      <strong>{TRUTH_COPY[row.truth]}</strong>
    </span>
    <span className="holdout-said">
      <span className="holdout-said-label">Junk score</span>
      <strong className="font-mono tabular-nums">{row.score.toFixed(1)}</strong>
      <span className="text-muted-foreground text-xs">bar {bar.toFixed(1)}</span>
    </span>
    <p className={cn('holdout-row-note', mistake && 'holdout-row-note-mistake')}>{mistake ?? 'It got this one right'}</p>
  </li>;
}

/** The middle group exists to make this an explicit decision, not a silent default. */
function SettingChoice({ option, outcome, selected, onChoose }: {
  option: Caution;
  outcome: Outcome;
  selected: boolean;
  onChoose: () => void;
}) {
  return <button
    type="button"
    className={cn('holdout-choice', selected && 'holdout-choice-selected')}
    aria-pressed={selected}
    onClick={onChoose}
  >
    <span className="holdout-choice-head">
      <strong>{option.label}</strong>
      <span>{selected ? <><Check size={14} aria-hidden />Chosen</> : 'Choose this'}</span>
    </span>
    <span className="holdout-choice-result">Caught {outcome.junkCaught} of {outcome.junkTotal} junk</span>
    <span className={cn('text-sm', outcome.wantedHidden > 0 && 'font-medium')}>{outcome.wantedHidden === 0 ? 'Hid none of the mail you wanted' : `Hid ${outcome.wantedHidden} message you wanted`}</span>
  </button>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function HoldoutExperiment({ onExplain, experiment }: Props) {
  const { set, excluded, snapshot, caution, moreExamples, everRevealed, used, revealed, tampered,
    learn, toggleExample, chooseCaution, chooseSet, reveal, reset, setMoreExamples } = experiment;

  const chosen = caution === null ? null : cautionById(caution);
  const filter = snapshot?.learned.status === 'learned' ? snapshot.learned.filter : null;
  const refused = snapshot?.learned.status === 'not-enough' ? snapshot.learned.reason : null;
  const stale = snapshot !== null && (snapshot.setLabel !== set.label
    || snapshot.ids.length !== used.length
    || snapshot.ids.some((id, index) => id !== used[index]?.id));
  const live = stale ? null : filter;

  const choosing = live && chosen ? runOn(live, set.choose, chosen.bar) : null;
  const finalCheck = live && chosen ? runOn(live, set.final, chosen.bar) : null;
  const comparison = choosing && finalCheck ? compareGroups(choosing, finalCheck) : null;
  const leaning = live ? leaningWords(live, 4) : null;

  const openCheck = () => {
    reveal();
    requestAnimationFrame(() => document.getElementById('holdout-check-title')?.focus());
  };

  const openMore = () => {
    setMoreExamples(true);
    requestAnimationFrame(() => document.getElementById('holdout-more-title')?.focus());
  };

  const seenNote = tampered
    ? 'We have seen these answers now. This is no longer a fresh check.'
    : null;

  const step = !live ? 1 : caution === null ? 2 : 3;
  const canReset = snapshot !== null
    || caution !== null
    || revealed
    || moreExamples
    || excluded.length > 0
    || set.label !== INITIAL_SET.label;

  return <section className="holdout-lab" aria-labelledby="holdout-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="holdout-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Can we trust a result we helped choose?</h3>
      </div>
      {canReset && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>

    <p className="mt-3 max-w-2xl text-base">You’ll build a tiny junk-mail filter, choose how cautious it should be, then check it on messages whose answers you have not used.</p>

    <p className="holdout-rule mt-4 max-w-2xl"><strong>The rule:</strong> do not open the four saved messages until the filter and its setting are finished.</p>

    <div className="mt-5">
      {(!snapshot || stale) && <>
        <Button size="touch" onClick={learn} className="h-auto max-w-full py-2 text-left whitespace-normal">{stale ? 'Teach it again with these messages' : `Start with step 1 · teach it with ${used.length} messages`} <ArrowRight aria-hidden /></Button>
        <p className="mt-2 max-w-2xl text-sm font-medium">{stale ? 'You changed the examples. Teach it again before using the other groups.' : 'The filter sees which of these are junk and which you wanted. It will not see either later group.'}</p>
      </>}
      {live && <p className="holdout-complete"><Check size={17} aria-hidden /><span><strong>Step 1 complete.</strong> The filter was built from these {used.length} messages, and nothing else.</span></p>}
      <p className="text-muted-foreground mt-2 max-w-2xl text-xs">Every message here is invented for this page. No mailbox is connected, and nothing leaves your browser.</p>
    </div>

    <ol className="holdout-groups mt-4">
      <li className={cn('holdout-group', live && 'holdout-group-done', step === 1 && 'holdout-group-active')} aria-current={step === 1 ? 'step' : undefined}>
        <p className="holdout-group-head"><span className="eyebrow">{live ? <><Check size={12} aria-hidden />Done</> : 'Step 1'}</span><strong className="text-sm">Teach the filter</strong></p>
        <span className="text-muted-foreground block text-xs">{set.learn.length} labelled messages build its word scores.</span>
      </li>
      <li className={cn('holdout-group', caution !== null && 'holdout-group-done', step === 2 && 'holdout-group-active')} aria-current={step === 2 ? 'step' : undefined}>
        <p className="holdout-group-head"><span className="eyebrow">{caution !== null ? <><Check size={12} aria-hidden />Done</> : 'Step 2'}</span><strong className="text-sm">Choose a setting</strong></p>
        <span className="text-muted-foreground block text-xs">{set.choose.length} labelled messages show the trade-off.</span>
      </li>
      <li className={cn('holdout-group', 'holdout-group-saved', revealed && 'holdout-group-done', step === 3 && !revealed && 'holdout-group-active')} aria-current={step === 3 && !revealed ? 'step' : undefined}>
        <p className="holdout-group-head"><span className="eyebrow">{revealed ? <><Check size={12} aria-hidden />Opened</> : 'Step 3'}</span><strong className="text-sm">Check once</strong></p>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs"><EyeOff size={12} aria-hidden />{set.final.length} messages stay hidden until your choice is made.</span>
      </li>
    </ol>

    <details className="holdout-examples mt-5" open={!live}>
      <summary>
        <span className="font-display text-xl">What the filter gets to see</span>
        <span className="text-muted-foreground text-xs">{used.length} labelled messages</span>
      </summary>
      <p className="text-muted-foreground mt-1 text-sm">These labels are the answers it learns from.</p>
      <ul className="holdout-chips mt-2">
        {used.map(message => <li key={message.id} className="holdout-chip">
          <span className="text-sm">“{message.text}”</span>
          <span className="holdout-tag">{TRUTH_COPY[message.truth]}</span>
        </li>)}
      </ul>
      {used.length < set.learn.length && <p className="text-muted-foreground mt-2 text-xs">{set.learn.length - used.length} of this mailbox’s example messages are switched off, under “Change what it learns from”.</p>}
    </details>

    <div>
      {refused && !stale && <div className="holdout-refused mt-5" aria-live="polite" aria-atomic="true">
        <p className="font-display text-xl">It cannot learn from these.</p>
        <p className="mt-2 text-sm">{
          refused === 'no-examples' ? 'There are no example messages switched on, so there is nothing to learn from.'
            : refused === 'no-junk' ? 'Every example left is a message you wanted. With no junk to compare against, every word would look equally innocent, and the filter would let everything through.'
            : 'Every example left is junk. With nothing wanted to compare against, every word would look suspicious, and the filter would hide everything.'
        }</p>
        <p className="text-muted-foreground mt-2 text-sm">It needs at least one of each. Switch some back on under “Change what it learns from”, then learn again.</p>
        {!moreExamples && <Button className="mt-3" size="touch" variant="outline" onClick={openMore}>Change the examples <ArrowRight aria-hidden /></Button>}
      </div>}

      {live && leaning && <>
        <div className="holdout-learned mt-5">
          <p className="eyebrow">What it learned</p>
          <p className="mt-2 text-base">Every word in those messages now has a score. Words that showed up mostly in junk lean one way; words that showed up mostly in mail you wanted lean the other.</p>
          <div className="holdout-lean mt-3">
            <p><span className="holdout-lean-label">Leans junk</span>{leaning.junk.map(word => <span key={word} className="holdout-word">{word}</span>)}</p>
            <p><span className="holdout-lean-label">Leans wanted</span>{leaning.wanted.map(word => <span key={word} className="holdout-word">{word}</span>)}</p>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">Nobody typed those lists. They come from counting how often each word turned up in {live.junkExamples} junk {live.junkExamples === 1 ? 'example' : 'examples'} against {live.wantedExamples} you wanted. A message’s junk score is the total of its words’ scores.</p>
        </div>

        <div className="mt-6">
          <p className="eyebrow">Step 2 · Choose before you peek</p>
          <h4 className="font-display mt-2 text-xl">Which mistake would you rather risk?</h4>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">We can read the answers for these four choosing messages. One setting catches more junk; the other protects more mail you wanted. Compare them, then make a choice.</p>
          <div className="holdout-choices mt-3" role="group" aria-label="Choose how cautious the filter should be">
            {CAUTIONS.map(option => <SettingChoice
              key={option.id}
              option={option}
              outcome={runOn(live, set.choose, option.bar)}
              selected={option.id === caution}
              onChoose={() => chooseCaution(option.id)}
            />)}
          </div>
          {chosen && <p className="mt-3 max-w-2xl text-sm"><strong>Your choice:</strong> {chosen.blurb}</p>}
        </div>

        {seenNote && <p className="holdout-seen mt-4">{seenNote}</p>}

        {choosing && chosen && <div className="mt-5">
          <p className="holdout-readout" aria-live="polite" aria-atomic="true">On the choosing messages: {describeOutcome(choosing)}</p>
          <details className="text-muted-foreground mt-2 text-sm">
            <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">See what happened to each choosing message</summary>
            <p className="pb-2">These answers are allowed to help with your choice. Looking at them does not change the word scores learned in step 1.</p>
            <ul className="space-y-2 text-foreground">
              {choosing.rows.map(row => <MessageRow key={row.id} row={row} bar={chosen.bar} />)}
            </ul>
          </details>
        </div>}

        {choosing && !revealed && <div className="mt-6">
          <p className="eyebrow">Step 3 · The honest check</p>
          <h4 className="font-display mt-2 text-xl">Your filter and setting are finished. Now open the saved messages.</h4>
          <p className="mt-2 max-w-2xl text-sm">These {set.final.length} answers have been out of view since the start. They could not help build the filter or influence your choice.</p>
          <Button className="mt-3" size="touch" onClick={openCheck}>Open saved messages with this choice <ArrowRight aria-hidden /></Button>
          {/*
            * Reset puts the screen back. It cannot put back not having seen the
            * answers, and saying otherwise would be this panel making the exact
            * mistake it is about.
            */}
          {everRevealed && <p className="holdout-seen mt-3">You have opened a final check already in this visit. Resetting clears the screen, not what you remember, so treat a second reading as less independent than the first.</p>}
        </div>}

        {revealed && chosen && finalCheck && comparison && <div className="mt-6">
          <p className="eyebrow">Step 3 · First unseen result</p>
          <h4 id="holdout-check-title" tabIndex={-1} className="font-display mt-2 text-xl outline-none">The filter had no chance to prepare for these {set.final.length} messages.</h4>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Nothing in this group helped build the filter or choose its setting.</p>

          <div className="holdout-result mt-3">
            {/*
              * Only the sentence that moves is announced. A live region around
              * the whole results area re-read the entire experiment every time
              * the caution setting changed.
              */}
            <p className="font-display text-xl" aria-live="polite" aria-atomic="true">{describeOutcome(finalCheck)}</p>
            <p className="mt-2 text-sm">{
              comparison.verdict === 'worse'
                ? `On the messages we used to choose, it got ${comparison.mistakesWhenChoosing} of ${set.choose.length} wrong. On these saved messages it got ${comparison.mistakesOnFinal} of ${set.final.length} wrong.`
                : comparison.verdict === 'better'
                  ? `It did better here than on the messages we used to choose: ${comparison.mistakesOnFinal} of ${set.final.length} wrong, against ${comparison.mistakesWhenChoosing} of ${set.choose.length}.`
                  : `It made the same share of mistakes here as on the messages we used to choose.`
            }{comparison.hidMoreOnFinal ? ' It hid more of the mail you wanted here than it did while we were choosing.' : ''}{comparison.missedMoreOnFinal ? ' It let more junk through here than it did while we were choosing.' : ''}</p>
            <p className="mt-2 text-sm"><strong>Why this result tells us something new:</strong> the choosing group helped pick the setting, so a good result there is partly expected. These answers influenced no decision. That is the whole reason they were saved.</p>
            {seenNote && <p className="holdout-seen mt-3">{seenNote}</p>}
          </div>

          <details className="text-muted-foreground mt-2 text-sm">
            <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">See what happened to each saved message</summary>
            <ul className="space-y-2 pt-2 text-foreground">
              {finalCheck.rows.map(row => <MessageRow key={row.id} row={row} bar={chosen.bar} />)}
            </ul>
          </details>

          <div className="holdout-name mt-5">
            <p className="eyebrow">Now the names have something to attach to</p>
            <div className="holdout-terms mt-3">
              <p><strong>Training set</strong><span>Build the filter</span></p>
              <p><strong>Validation set</strong><span>Choose a setting</span></p>
              <p><strong>Test set</strong><span>Check once, after every choice</span></p>
            </div>
            <p className="text-muted-foreground mt-3 text-sm">The names matter less than the order. Each group answers a different question, and it can only do that job while its answers are unused.</p>
            <p className="text-muted-foreground mt-2 text-sm">Looking at a final result does not literally add those messages to the filter. But if you look, then change the setting, then look again, you are choosing with their answers, and the check stops being independent.</p>
          </div>

          <p className="mt-4 max-w-2xl text-base">This follows on from the phone-price experiment: a rule can do well on examples it has seen. Saved messages help us find out whether it works on new ones too.</p>

          <div className="border-border mt-5 border-t pt-5">
            <p className="font-display text-xl">Why was the saved group a fairer check, and what would stop it being fair?</p>
            <p className="text-muted-foreground mt-2 text-sm">Say it in your own words if you want. This panel does not change your map. Your own explanation can.</p>
            <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
          </div>
        </div>}
      </>}
    </div>

    {!moreExamples
      ? <div className="mt-6">
        <Button size="touch" variant="outline" onClick={openMore}>Try another example <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">A second mailbox, and a way to change which examples the filter learns from.</p>
      </div>
      : <div className="mt-6">
        <h4 id="holdout-more-title" tabIndex={-1} className="font-display text-xl outline-none">Other things to try</h4>

        <p className="mt-3 text-sm font-medium">A different mailbox</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MESSAGE_SETS.map(option => <Button key={option.label} type="button" size="touch" variant={option.label === set.label ? 'default' : 'outline'} onClick={() => chooseSet(option)}>{option.label}</Button>)}
        </div>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{set.note} Each mailbox keeps its own saved messages, so switching gives you a check you have not opened yet.</p>

        <p className="mt-4 text-sm font-medium">Change what it learns from</p>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Switch an example off and learn again. Fewer examples, or examples of only one kind, change what the filter can work out.</p>
        <ul className="holdout-toggles mt-2">
          {set.learn.map(message => {
            const on = !excluded.includes(message.id);
            return <li key={message.id}>
              <label className="holdout-toggle">
                <input type="checkbox" checked={on} onChange={() => toggleExample(message.id)} className="holdout-check" />
                <span className="min-w-0 flex-1"><span className="block text-sm">“{message.text}”</span><span className="text-muted-foreground block text-xs">{TRUTH_COPY[message.truth]}</span></span>
              </label>
            </li>;
          })}
        </ul>
      </div>}

    <details className="text-muted-foreground mt-6 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How it works</summary>
      <div className="space-y-2 pt-2">
        <p><strong>Learning.</strong> Each message is split into words. For every word, the filter counts how many junk examples contained it and how many wanted ones did, and turns that pair into one score. A word seen only in junk examples leans junk; a word seen in both leans neither way. One is added to each count, so a word that only ever appeared on one side gets a large score rather than an endless one.</p>
        <p><strong>Scoring.</strong> A message’s junk score is the total of its words’ scores. A word the examples never contained counts nothing at all.</p>
        <p><strong>The bar.</strong> The score is compared with one number. Above it, the message is called junk. That number is the only thing the second group changes, and it is the only thing you are choosing.</p>
        <p><strong>Nothing is prepared.</strong> Every score, call and count on this page is worked out in your browser from the messages you can see. No button carries a stored answer.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this leaves out</summary>
      <div className="space-y-2 pt-2">
        <p><strong>Fourteen messages is far too few.</strong> A real filter is checked on thousands, and four saved messages could easily agree with the middle group by chance. The shape of the problem is the same; the confidence is not.</p>
        <p><strong>Real filters learn from far more than single words.</strong> They use who sent it, how often you have replied to them, and where the links point. This one has words and nothing else.</p>
        <p><strong>Holding messages back is not a guarantee.</strong> The saved messages can share the same oddities as the examples. And once a team has tuned against the same saved set many times, its answers have quietly become part of how the filter was built, however carefully nobody trained on them.</p>
        <p><strong>The expensive mistake is not symmetrical.</strong> Junk in your inbox is annoying. A message you needed, silently hidden, can be much worse. A single count of mistakes hides that difference, which is the choice the two settings put in front of you.</p>
      </div>
    </details>
  </section>;
}
