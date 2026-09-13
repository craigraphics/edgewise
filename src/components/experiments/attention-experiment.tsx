'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  COLUMNS,
  descriptionOf,
  INITIAL_SENTENCE,
  percent,
  roundingShows,
  SENTENCES,
  sentenceById,
  updateAt,
  updateLast,
  value,
  WORDS,
  type Contribution,
  type Sentence,
  type Update,
} from '@/lib/experiments/attention';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useAttentionExperiment> };

/** The word both sentences end on, and the only one either panel updates. */
const SUBJECT = 'bank';

/**
 * The optional look at a word that is not last, which is where "it cannot look
 * ahead" is actually visible: `river` has three words after it.
 */
const AHEAD_POSITION = 4;

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets which sentence is on screen or which sections were opened.
 */
export function useAttentionExperiment() {
  const [sentenceId, setSentenceId] = useState<Sentence['id']>(INITIAL_SENTENCE.id);
  const [showShares, setShowShares] = useState(false);
  const [showAhead, setShowAhead] = useState(false);
  const [showHow, setShowHow] = useState(false);

  const switchSentence = useCallback(() => {
    setSentenceId(current => (current === 'river' ? 'money' : 'river'));
  }, []);

  const reset = useCallback(() => {
    setSentenceId(INITIAL_SENTENCE.id);
    setShowShares(false);
    setShowAhead(false);
    setShowHow(false);
  }, []);

  return { sentenceId, showShares, showAhead, showHow, switchSentence, reset, setShowShares, setShowAhead, setShowHow };
}

/** The sentence, with the word being updated marked by more than its colour. */
function SentenceLine({ sentence, targetPosition }: { sentence: Sentence; targetPosition: number }) {
  return <p className="attention-sentence">
    {sentence.words.map((word, index) => {
      const shown = index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
      const last = index === sentence.words.length - 1;
      /*
       * Real spaces between real inline spans. An earlier draft laid the words
       * out as flex children with a gap, which looks identical and reads as
       * "Wewalkedbesidethe" to anything taking the text rather than the picture.
       */
      return <Fragment key={`${word}-${index}`}>
        {index > 0 && ' '}
        <span className={cn('attention-word', index + 1 === targetPosition && 'attention-word-target')}>{shown}</span>
        {last && '.'}
      </Fragment>;
    })}
  </p>;
}

/** One column of a description, printed as a label and a number. */
function Columns({ description, className }: { description: readonly number[]; className?: string }) {
  return <span className={cn('attention-columns', className)}>
    {COLUMNS.map((column, index) => <span key={column} className="attention-column">
      <span className="attention-column-name">{column}</span>
      <strong className="font-mono tabular-nums">{value(description[index])}</strong>
    </span>)}
  </span>;
}

/** The per-word breakdown: match, share, and what that share actually added. */
function Shares({ update }: { update: Update }) {
  const widest = Math.max(...update.contributions.map(contribution => contribution.share));
  return <>
    <ol className="attention-shares">
      {update.contributions.map((contribution: Contribution) => <li key={contribution.position} className="attention-share">
        <span className="attention-share-word">
          {contribution.word}
          {contribution.position === update.position && <span className="attention-share-self"> (the word itself)</span>}
        </span>
        <span className="attention-bar" aria-hidden><span className="attention-bar-fill" style={{ width: `${(contribution.share / widest) * 100}%` }} /></span>
        <span className="attention-share-figures font-mono tabular-nums">
          match {value(contribution.match)} · share {percent(contribution.share)} ·{' '}
          {contribution.adds.every(amount => Math.abs(amount) < 5e-3)
            ? 'adds nothing'
            : `adds ${COLUMNS.map((column, index) => `${column} ${value(contribution.adds[index])}`).join(' · ')}`}
        </span>
      </li>)}
    </ol>
    <p className="attention-total font-mono tabular-nums">
      totals: {COLUMNS.map((column, index) => `${column} ${value(update.after[index])}`).join(' · ')}
    </p>
    {roundingShows(update) && <p className="text-muted-foreground mt-1 text-xs">Every figure above is rounded to two places, so adding the column by hand can land a hundredth away from the total. The unrounded ones add up exactly.</p>}
  </>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function AttentionExperiment({ onExplain, experiment }: Props) {
  const { sentenceId, showShares, showAhead, showHow, switchSentence, reset, setShowShares, setShowAhead, setShowHow } = experiment;

  const sentence = sentenceById(sentenceId);
  const other = SENTENCES.find(candidate => candidate.id !== sentenceId) ?? INITIAL_SENTENCE;
  const update = useMemo(() => updateLast(sentence), [sentence]);
  const river = sentenceById('river');
  const ahead = useMemo(() => updateAt(river.words, AHEAD_POSITION), [river]);

  return <section className="attention-lab" aria-labelledby="attention-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="attention-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">How can the words around &ldquo;{SUBJECT}&rdquo; change what it means here?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>

    <p className="mt-3 max-w-2xl text-base">The last word below can mean two different things. Watch what the words before it do to it.</p>

    <div className="attention-stage mt-4">
      <SentenceLine sentence={sentence} targetPosition={update.position} />
      <p className="attention-caption">Updating the last word: <strong>{update.target}</strong></p>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button size="touch" onClick={switchSentence}>{other.action} <ArrowRight aria-hidden /></Button>
      <p className="text-muted-foreground text-sm">A small example with numbers chosen to show the steps.</p>
    </div>

    <div className="attention-readout mt-4" aria-live="polite" aria-atomic="true">
      <p className="eyebrow">What came out</p>
      <div className="attention-before-after mt-3">
        <span className="attention-state">
          <span className="attention-state-label">{update.target} on its own</span>
          <Columns description={update.before} />
        </span>
        <ArrowRight className="attention-state-arrow" aria-hidden />
        <span className="attention-state">
          <span className="attention-state-label">{update.target} in this sentence</span>
          <Columns description={update.after} className="attention-columns-after" />
        </span>
      </div>
      <p className="mt-3 text-sm">
        The earlier words changed what went into the last word&rsquo;s description.
        The largest share came from <strong>{update.leading.word}</strong> ({percent(update.leading.share)}).
        Nothing was left out: every earlier word, and the word itself, got a share.
      </p>
    </div>

    <p className="text-muted-foreground mt-3 max-w-2xl text-sm">The word-neighbours experiment gave each word one saved list of numbers. Here that description changes with the words around it.</p>

    <details className="attention-details mt-5" open={showShares} onToggle={event => setShowShares(event.currentTarget.open)}>
      <summary className="attention-summary">See the shares</summary>
      <div className="pt-3">
        <p className="text-sm">Each earlier word gets a <strong>match number</strong>: how well it fits what {update.target} is looking for. The match numbers are turned into proportions that add up to 1, and each word then contributes its own description in that proportion. Add those up and you have the new description above.</p>
        <Shares update={update} />
        <p className="text-muted-foreground mt-3 text-sm">Words carrying nothing this example measures &mdash; <em>we</em>, <em>the</em>, <em>to</em>, <em>beside</em> &mdash; all match equally, so they all get the same share. They still get one. Nothing is dropped.</p>
      </div>
    </details>

    <details className="attention-details mt-2" open={showAhead} onToggle={event => setShowAhead(event.currentTarget.open)}>
      <summary className="attention-summary">Why it cannot look ahead</summary>
      <div className="pt-3">
        <p className="text-sm">The same arithmetic, run on an earlier word in the river sentence. <strong>{ahead.target}</strong> is word {ahead.position}, so it may use words 1 to {ahead.position} and nothing else. These words come later and are not used at all:</p>
        <p className="attention-withheld mt-2">{ahead.withheld.map((word, index) => <span key={`${word}-${index}`} className="attention-withheld-word">{word}</span>)}</p>
        <p className="text-muted-foreground mt-2 text-sm">Not a small share. No share, no match number, not in the arithmetic. This kind of model reads left to right and has not seen them yet.</p>
        <Shares update={ahead} />
        <p className="text-muted-foreground mt-3 text-sm">Notice how little <strong>{ahead.target}</strong> moves: it started at {COLUMNS.map((column, index) => `${column} ${value(ahead.before[index])}`).join(' · ')} and ended at {COLUMNS.map((column, index) => `${column} ${value(ahead.after[index])}`).join(' · ')}. It is already a clear word, so it mostly keeps its own description. {SUBJECT} is not, so it moves a lot.</p>
      </div>
    </details>

    <details className="attention-details mt-2" open={showHow} onToggle={event => setShowHow(event.currentTarget.open)}>
      <summary className="attention-summary">How it works, and what it leaves out</summary>
      <div className="space-y-3 pt-3 text-sm">
        <p><strong>Every number here was chosen by hand.</strong> Each word has one description, and these are all of them:</p>
        <ul className="attention-vocab">
          {WORDS.map(word => <li key={word}>
            <span>{word}</span>
            <span className="font-mono tabular-nums">{COLUMNS.map((column, index) => `${column} ${value(descriptionOf(word)[index])}`).join(' · ')}</span>
          </li>)}
        </ul>
        <p><strong>The proper names.</strong> The match number is an <em>attention score</em>. What the word being updated is looking for is its <em>query</em>; what each earlier word offers is its <em>key</em>; what it contributes is its <em>value</em>. Turning the match numbers into proportions is <em>softmax</em>. The scores are divided by the square root of how many numbers are being compared first, which keeps them in a comfortable range.</p>
        <p><strong>We named the two columns.</strong> Calling them &ldquo;outdoors&rdquo; and &ldquo;money&rdquo; is what makes this readable. In a real model nobody labels the columns, there are hundreds of them, and no single one means anything you could name.</p>
        <p><strong>Real models learn three sets of numbers</strong> that turn a word&rsquo;s description into what it looks for, what it offers and what it contributes. Here those three steps are left alone, so every number on screen is one you can check against the table above. That is the main thing this example leaves out.</p>
        <p><strong>Nothing here is looking or noticing.</strong> The shares are arithmetic on numbers somebody chose. A large share is not a reason the model answered anything, and in a real model the shares are not an explanation of its reasoning either, however much they look like one.</p>
      </div>
    </details>

    <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">The word &ldquo;{SUBJECT}&rdquo; has one description on its own, and a different one in each sentence. What made the difference?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Switching sentences here leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>
  </section>;
}
