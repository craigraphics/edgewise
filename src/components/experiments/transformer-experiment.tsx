'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  BLOCK_ONE,
  BLOCK_TWO,
  INITIAL_ORDER,
  PLACES,
  SENTENCES,
  WORDS,
  listValues,
  movement,
  percent,
  placeAt,
  runBlocks,
  sentenceById,
  sentenceText,
  value,
  wordValues,
  type Calculation,
  type Order,
  type Row,
  type Sentence,
} from '@/lib/experiments/transformer';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useTransformerExperiment> };

/** What the two stages are called everywhere in this panel. */
const STEPS = [
  { title: 'Share clues from earlier words', plain: 'sharing clues from the earlier words' },
  { title: 'Work on each word’s new description', plain: 'the calculation after that' },
] as const;

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets which order is on screen, whether the block has been run, or
 * which sections were opened.
 */
export function useTransformerExperiment() {
  const [order, setOrder] = useState<Order>(INITIAL_ORDER);
  const [hasRun, setHasRun] = useState(false);
  const [hasSwapped, setHasSwapped] = useState(false);
  const [showSecond, setShowSecond] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showHow, setShowHow] = useState(false);

  const run = useCallback(() => setHasRun(true), []);

  /** Swapping reruns on the same settings, so the two results are comparable. */
  const swap = useCallback(() => {
    setOrder(current => (current === 'dog-first' ? 'cat-first' : 'dog-first'));
    setHasSwapped(true);
  }, []);

  const reset = useCallback(() => {
    setOrder(INITIAL_ORDER);
    setHasRun(false);
    setHasSwapped(false);
    setShowSecond(false);
    setShowNumbers(false);
    setShowHow(false);
  }, []);

  return { order, hasRun, hasSwapped, showSecond, showNumbers, showHow, run, swap, reset, setShowSecond, setShowNumbers, setShowHow };
}

/** The note, with the word being followed marked by more than its colour. */
function SentenceLine({ sentence }: { sentence: Sentence }) {
  return <p className="transformer-sentence">
    {sentence.words.map((word, index) => {
      const shown = index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
      const last = index === sentence.words.length - 1;
      // Real spaces between real inline spans. Flex children with a gap look
      // identical and read as one run-together word to anything taking the text.
      return <Fragment key={`${word}-${index}`}>
        {index > 0 && ' '}
        <span className={cn('transformer-word', last && 'transformer-word-target')}>{shown}</span>
        {last && '.'}
      </Fragment>;
    })}
  </p>;
}

/** One labelled row of numbers. */
function Moment({ label, row }: { label: string; row: Row }) {
  return <span className="transformer-moment">
    <span className="transformer-moment-label">{label}</span>
    <strong className="font-mono tabular-nums">{listValues(row)}</strong>
  </span>;
}

/**
 * What a stage did, read off the unrounded numbers rather than written down.
 *
 * A real change too small to print says so instead of being called nothing, and
 * two identical rows are never described as a change — the same rule the
 * one-step-at-a-time panel follows when a distance is under a hundredth.
 */
function saidMovement(before: Row, after: Row, again = false): string {
  const moved = movement(before, after);
  const them = again ? 'them again' : 'its numbers';
  if (moved === 'moved') return `changed ${them}`;
  if (moved === 'tiny') return `changed ${them} by less than 0.01`;
  return 'left them exactly as they were';
}

/** Small counts read better as words in a sentence than as digits. */
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

/** A small table of numbers, scrollable on its own rather than widening the panel. */
function NumberTable({ caption, head, rows }: { caption: string; head: readonly string[]; rows: readonly (readonly string[])[] }) {
  return <div className="transformer-scroller mt-2">
    <table className="transformer-table">
      <caption>{caption}</caption>
      <thead><tr>{head.map(cell => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => <tr key={index}>
          {row.map((cell, column) => column === 0
            ? <th key={column} scope="row">{cell}</th>
            : <td key={column} className="font-mono tabular-nums">{cell}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

/** The hand-set numbers behind one block's calculation. */
function CalculationTable({ name, calculation }: { name: string; calculation: Calculation }) {
  return <>
    <NumberTable
      caption={`${name}: the first layer — four rows of three, each with one nudge added.`}
      head={['Row', 'Numbers', 'Nudge']}
      rows={calculation.first.map((weights, index) => [`${index + 1}`, listValues(weights), value(calculation.nudges[index])])}
    />
    <NumberTable
      caption={`${name}: the second layer — three rows of four, each with one nudge added.`}
      head={['Row', 'Numbers', 'Nudge']}
      rows={calculation.second.map((weights, index) => [`${index + 1}`, listValues(weights), value(calculation.finalNudges[index])])}
    />
  </>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function TransformerExperiment({ onExplain, experiment }: Props) {
  const { order, hasRun, hasSwapped, showSecond, showNumbers, showHow, run, swap, reset, setShowSecond, setShowNumbers, setShowHow } = experiment;

  const sentence = sentenceById(order);
  const other = SENTENCES.find(candidate => candidate.id !== order) ?? SENTENCES[0];
  const [first, second] = useMemo(() => runBlocks(sentence.words), [sentence]);
  const otherFirst = useMemo(() => runBlocks(other.words)[0], [other]);

  /** Whether anything has happened yet, which is what makes Reset worth offering. */
  const touched = hasRun || hasSwapped || showSecond || showNumbers || showHow;

  const last = sentence.words.length - 1;
  const target = sentence.words[last];
  const started = first.input[last];
  const midway = first.afterStageOne[last];
  const finished = first.afterStageTwo[last];

  const gather = first.gathers[last];
  const work = first.works[last];

  return <section className="transformer-lab" aria-labelledby="transformer-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="transformer-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">How do a few simple steps work together on a sentence?</h3>
      </div>
      {/*
        * Offered only once there is something to undo. On the first screen it
        * was a control that did nothing, and at 390px it wrapped onto its own
        * row above the panel's actual first action and pushed it 52px further
        * down. The same call the saved-messages panel already records.
        */}
      {touched && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>

    <p className="mt-3 max-w-2xl text-base">We follow the last word of this note through one block: the pair of steps below.</p>

    <div className="transformer-note mt-4">
      <SentenceLine sentence={sentence} />
      <p className="transformer-caption">Following the last word: <strong>{target}</strong></p>
    </div>

    <div className="transformer-run mt-4">
      <ol className="transformer-steps">
        {STEPS.map((step, index) => <li key={step.title} className="transformer-step">
          <span className="transformer-step-number" aria-hidden>{index + 1}</span>
          <span className="min-w-0">
            {step.title}
            {hasRun && <span className="transformer-step-done">{' '}done</span>}
          </span>
        </li>)}
      </ol>
      {hasRun
        ? <Button size="touch" onClick={swap}>{other.action} <ArrowRight aria-hidden /></Button>
        : <Button size="touch" onClick={run}>Run one block <ArrowRight aria-hidden /></Button>}
    </div>

    {hasRun && <div className="transformer-readout mt-4">
      <p className="eyebrow">What happened to the last word</p>
      {/*
        * The sentence that makes the numbers readable, inside the card so it
        * arrives with them rather than standing in front of the first action —
        * and outside the live region below, because it never changes and a
        * screen reader should not hear it again on every press.
        */}
      <p className="mt-2 text-sm">Every word here carries three numbers. That is the model’s whole description of a word. Nobody decided what any single one of them means, so the thing to read is whether they changed, and when.</p>
      <div aria-live="polite" aria-atomic="true">
        <div className="transformer-moments mt-3">
          <Moment label={`${target}, before the block`} row={started} />
          <Moment label="after step 1" row={midway} />
          <Moment label="after step 2" row={finished} />
        </div>
        <p className="mt-3 text-sm">
          The last word is <strong>{target}</strong>. Sharing clues from the {COUNT_WORDS[last] ?? last} words before it{' '}
          {saidMovement(started, midway)}. The calculation after that {saidMovement(midway, finished, true)}. Two steps, one
          after the other, and the second one worked on what the first one left.
        </p>
      </div>
    </div>}

    {hasRun && <p className="text-muted-foreground mt-3 max-w-2xl text-sm">Attention combines clues from other words. A transformer repeats that step, with another small calculation in between.</p>}

    {hasSwapped && <div className="transformer-readout mt-4">
      <p className="eyebrow">Same words, different order</p>
      <div className="transformer-compare">
        {[{ side: sentence, block: first }, { side: other, block: otherFirst }].map(entry => {
          const end = entry.side.words.length - 1;
          const current = entry.side.id === sentence.id;
          return <div key={entry.side.id} className={cn('transformer-compare-row', current && 'transformer-compare-row-current')}>
            <span>{sentenceText(entry.side)}{current && <span className="text-muted-foreground"> · on screen now</span>}</span>
            <span className="font-mono tabular-nums">{entry.side.words[end]} → {listValues(entry.block.afterStageTwo[end])}</span>
          </div>;
        })}
      </div>
      <p className="mt-3 text-sm">Different order, different result. Two things moved at once: which word is last, and where each word sits. The second only reaches the arithmetic because every place has its own small row of numbers, added in before the block runs — sharing clues adds contributions up, and a total does not depend on the order you add things in.</p>
    </div>}

    {hasRun && <details className="transformer-details mt-5" open={showSecond} onToggle={event => setShowSecond(event.currentTarget.open)}>
      <summary className="transformer-summary">Try another step</summary>
      <div className="pt-3">
        <p className="text-sm">A second block is the same pair of steps again. It does not go back to the note. It is handed exactly what the first block produced.</p>
        <div className="transformer-moments mt-3">
          <Moment label="what block 1 produced" row={first.afterStageTwo[last]} />
          <Moment label="what block 2 was given" row={second.input[last]} />
        </div>
        <p className="text-muted-foreground mt-2 text-sm">Those are the same numbers, because they are the same numbers. The place numbers are not added again either — they went in once, before block 1.</p>
        <div className="transformer-moments mt-3">
          <Moment label="after block 2, step 1" row={second.afterStageOne[last]} />
          <Moment label="after block 2, step 2" row={second.afterStageTwo[last]} />
        </div>
        <p className="mt-3 text-sm">Block 2 has its own set of numbers to work with, the way a real model learns a fresh set for every block. Nobody gave it a different <em>job</em>: no block here is in charge of grammar, or meaning, or reasoning. Real stacks have dozens or hundreds of these, and adding more does not on its own make the answers better.</p>
      </div>
    </details>}

    {hasRun && <details className="transformer-details mt-2" open={showNumbers} onToggle={event => setShowNumbers(event.currentTarget.open)}>
      <summary className="transformer-summary">See the numbers</summary>
      <div className="space-y-4 pt-3 text-sm">
        <p><strong>Every number here was chosen by hand.</strong> Four words, three numbers each, and one row per place in the sentence.</p>
        <NumberTable caption="The four words." head={['Word', 'Its three numbers']} rows={WORDS.map(word => [word, listValues(wordValues(word))])} />
        <NumberTable caption="One row per place, added to the word’s own numbers before the block runs." head={['Place', 'Its three numbers']} rows={PLACES.map((_, index) => [`${index + 1}`, listValues(placeAt(index))])} />

        <div>
          <p><strong>Where each word starts.</strong> Its own numbers plus its place’s.</p>
          <NumberTable
            caption={`“${sentenceText(sentence)}”`}
            head={['Word', 'Starts at']}
            rows={sentence.words.map((word, index) => [`${index + 1} ${word}`, listValues(first.input[index])])}
          />
          <p className="text-muted-foreground mt-2">Words 1 and 4 are the same word and do not start in the same place. That difference is the place rows and nothing else.</p>
        </div>

        <div>
          <p><strong>Step 1, for {target}.</strong> Each row is rescaled first, then compared with {target}’s rescaled row. The overlap, divided by the same fixed number every time, is the match. The matches become shares that total 1, and each word puts in its own rescaled row in that share.</p>
          <NumberTable
            caption={`What went into ${target}’s new numbers.`}
            head={['Word', 'Rescaled', 'Match', 'Share', 'Puts in']}
            rows={gather.contributions.map(contribution => [
              `${contribution.position} ${sentence.words[contribution.position - 1]}`,
              listValues(first.rescaledForGather[contribution.position - 1]),
              value(contribution.match),
              percent(contribution.share),
              listValues(contribution.adds),
            ])}
          />
          <p className="mt-2 font-mono text-xs tabular-nums">gathered {listValues(gather.gathered)} + what it already had {listValues(started)} = {listValues(midway)}</p>
        </div>

        <div>
          <p><strong>Step 2, for {target}.</strong> Its row is rescaled again, run through four sums with anything negative flattened to nothing, and turned back into three numbers. Then that is added back too.</p>
          <p className="font-mono text-xs tabular-nums">rescaled {listValues(first.rescaledForWork[last])} → four values {work.hidden.map(value).join(' · ')} → {listValues(work.worked)}</p>
          <p className="mt-1 font-mono text-xs tabular-nums">{listValues(work.worked)} + {listValues(midway)} = {listValues(finished)}</p>
          <CalculationTable name="Block 1" calculation={BLOCK_ONE} />
          <CalculationTable name="Block 2" calculation={BLOCK_TWO} />
        </div>

        <div>
          <p><strong>Every word gets both steps, not only the last one.</strong> A word may use the words before it and itself, never the ones after — so the earlier words have less to gather from.</p>
          <NumberTable
            caption="One block, all five positions."
            head={['Word', 'Starts at', 'After step 1', 'After step 2', 'Later words it cannot use']}
            rows={sentence.words.map((word, index) => [
              `${index + 1} ${word}`,
              listValues(first.input[index]),
              listValues(first.afterStageOne[index]),
              listValues(first.afterStageTwo[index]),
              `${first.gathers[index].ignoredAfter}`,
            ])}
          />
        </div>
      </div>
    </details>}

    <details className={cn('transformer-details', hasRun ? 'mt-2' : 'mt-5')} open={showHow} onToggle={event => setShowHow(event.currentTarget.open)}>
      <summary className="transformer-summary">How it works, and what it leaves out</summary>
      <div className="space-y-3 pt-3 text-sm">
        <p><strong>This is the arrangement, not a language model.</strong> The steps and their order are real. The numbers are hand-picked so the arithmetic is small enough to follow and each step visibly moves the result. Nothing here learned anything from any text, it does not understand pets, and it produces no words. A real model ends its stack with one more step that turns the numbers into a guess at the next word; there is no such step here.</p>
        <p><strong>The order has to be supplied.</strong> Step 1 adds contributions up, and a total does not depend on the order you add things in — so on its own it genuinely cannot tell which word came first. Each place has its own small row of numbers, added in once at the start. That is the whole of the order handling, and it is the part the written explanation of this idea leaves out.</p>
        <p><strong>Nothing may use what comes after it.</strong> Each word gathers from the words before it and itself. That is the arrangement used for writing text, so nothing can read ahead to a word that has not been produced yet.</p>
        <p><strong>Rescaling, and adding back.</strong> Each step works on a rescaled copy and then adds its result back to what the word already had. Adding back is what lets a word keep most of itself while a step nudges it; rescaling is what stops the numbers growing out of range as blocks stack up. Both are in the arithmetic above.</p>
        <p><strong>Three shortcuts.</strong> A real block turns each word’s numbers into three separate things — what it is looking for, what it offers, and what it contributes — using three sets of learned numbers. Here those three are left alone, so every match can be checked against the tables above. A real block also runs several of these side by side at once, uses hundreds of numbers per word instead of three, and drops some values at random while training.</p>
        <p><strong>Parallel means reading, not writing.</strong> The reason this arrangement won is that a whole known text can be worked on at every position at once while training. Writing new text still goes one word at a time.</p>
      </div>
    </details>

    <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">One block did two things to the last word, one after the other. What were they, and what did the second block start from?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Running the block here leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>
  </section>;
}
