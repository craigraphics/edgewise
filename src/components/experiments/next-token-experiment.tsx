'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, FastForward, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  chancesAfter,
  FIRST_OPENING,
  isFinished,
  lesson,
  MODEL,
  OPENINGS,
  percent,
  readable,
  runToEnd,
  SHORTLIST,
  shortlistCoverage,
  step,
  STOP,
  STORIES,
  tokenise,
  type Opening,
  type Piece,
  type Step,
} from '@/lib/experiments/next-token';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useNextTokenExperiment> };

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the story, the opening, or how far the run has got.
 */
export function useNextTokenExperiment() {
  const [opening, setOpening] = useState<Opening>(FIRST_OPENING);
  const [pieces, setPieces] = useState<readonly Piece[]>(() => tokenise(FIRST_OPENING.text));
  /** What the last press did, for the sentence that says what changed. */
  const [last, setLast] = useState<Step | null>(null);
  /** Every piece added since the opening, so the run can be read back. */
  const [history, setHistory] = useState<readonly Step[]>([]);

  /*
   * Both actions work out the whole consequence here, from the pieces currently
   * in state, rather than inside a `setPieces` updater. An updater has to be
   * pure — React may run it twice — and the three pieces of state that move
   * together are all decided by the same step.
   */
  const advance = useCallback((steps: readonly Step[]) => {
    if (steps.length === 0) return;
    setPieces(steps[steps.length - 1].after);
    setLast(steps[steps.length - 1]);
    setHistory(existing => [...existing, ...steps]);
  }, []);

  const addOne = useCallback(() => {
    if (isFinished(tokenise(opening.text), pieces)) return;
    const next = step(MODEL, pieces);
    advance(next ? [next] : []);
  }, [advance, opening, pieces]);

  const finish = useCallback(() => {
    advance(runToEnd(MODEL, tokenise(opening.text), pieces));
  }, [advance, opening, pieces]);

  const choose = useCallback((next: Opening) => {
    setOpening(next);
    setPieces(tokenise(next.text));
    setLast(null);
    setHistory([]);
  }, []);

  const reset = useCallback(() => choose(FIRST_OPENING), [choose]);

  return { opening, pieces, last, history, addOne, finish, choose, reset };
}

const spell = (n: number) => (['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n));
const quote = (piece: Piece) => (piece === STOP ? 'the full stop' : `“${piece}”`);

/** How the chances were worked out, in the learner's words. */
function endingPhrase(ending: readonly Piece[]): string {
  if (ending.length === 0) return 'nothing it recognises';
  return `“${ending.join(' ')}”`;
}

/** Local counting only: this component deliberately has no learner-model access. */
export function NextTokenExperiment({ onExplain, experiment }: Props) {
  const { opening, pieces, last, history, addOne, finish, choose, reset } = experiment;
  const [showStories, setShowStories] = useState(false);

  const start = tokenise(opening.text);
  const chances = chancesAfter(MODEL, pieces);
  const done = isFinished(start, pieces);
  const rows = chances.continuations.slice(0, SHORTLIST);
  const hidden = chances.continuations.length - rows.length;
  const covered = shortlistCoverage(chances, rows.length);
  const passage = lesson(MODEL);
  const started = history.length > 0;

  /*
   * The sentence that says what changed. Every word of it is read off the step
   * that just ran — the piece, its chance, and the ending the NEXT calculation
   * will use — so it cannot drift from what the panel is showing.
   */
  const changed = (() => {
    if (!last) return null;
    const added = `We added ${quote(last.added)}, the piece with the most chance at ${percent(last.chance)}.`;
    if (last.finished) return `${added} A full stop means the sentence is finished, so the model stops here.`;
    const next = chancesAfter(MODEL, last.after);
    return `${added} Now the model works out what could follow ${endingPhrase(next.ending)}.`;
  })();

  return <section className="next-token-lab" aria-labelledby="next-token-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A small experiment · runs in your browser</p>
        <h3 id="next-token-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">How can choosing one small piece at a time build a whole sentence?</h3>
      </div>
      {/* Offered only once something has changed: a Reset on an untouched screen is a control with nothing to do. */}
      {(started || opening.id !== FIRST_OPENING.id) && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>
    <p className="mt-3 max-w-2xl text-base">A bedtime story has started. The model below has read twelve short stories and nothing else, and it has one job: work out what piece could come next.</p>
    <p className="text-muted-foreground mt-2 max-w-2xl text-sm">Here one word is one piece. A small example made for learning, not a real chatbot.</p>

    <div className="next-token-stage mt-5">
      <div className="next-token-story-area">
        <div className="next-token-story">
          <p className="eyebrow">The story so far</p>
          <p className="font-display mt-2 text-2xl" aria-live="polite">{readable(pieces)}</p>
          <p className="text-muted-foreground mt-2 text-xs">{started ? `${spell(history.length)} ${history.length === 1 ? 'piece' : 'pieces'} added, one at a time` : 'Nothing added yet. The opening is given.'}</p>
        </div>
      </div>

      <div className="next-token-action-area">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="touch" onClick={addOne} disabled={done}><Plus aria-hidden />Add the most likely next piece</Button>
          {started && !done && <Button size="touch" variant="outline" onClick={finish}><FastForward aria-hidden />Keep going until it stops</Button>}
        </div>
        <div aria-live="polite" className="next-token-change mt-3">
          {done ? <p className="text-sm">{changed ?? 'This story has already finished.'}</p>
            : changed ? <p className="text-sm">{changed}</p>
            : <p className="text-muted-foreground text-sm">The list beside this shows what could come next. Press the button to add the most likely one.</p>}
        </div>
      </div>

      <div className="next-token-chances-area">
        <div className="next-token-chances">
          <p className="eyebrow">What could come next</p>
          <p className="text-muted-foreground mt-2 text-xs">
            {done
              ? 'The sentence has finished, so there is nothing more to work out.'
              : <>Worked out from the last {chances.ending.length === 2 ? 'two pieces' : chances.ending.length === 1 ? 'piece' : 'of the story'}: <strong className="text-foreground">{endingPhrase(chances.ending)}</strong>. Seen {chances.observations} {chances.observations === 1 ? 'time' : 'times'} in the twelve stories.</>}
          </p>

          {!done && <>
            {chances.fellBack && <p className="next-token-fallback mt-2 text-xs">
              The last two pieces never appeared together in the stories, so the model dropped back to {chances.ending.length === 1 ? 'the last piece on its own' : 'how often each piece turns up anywhere'}.
            </p>}

            <ul className="next-token-rows mt-3">
              {rows.map((row, index) => <li key={row.piece} className={cn('next-token-row', index === 0 && 'next-token-row-lead')}>
                <span className="next-token-piece">{row.piece === STOP ? <>. <span className="text-muted-foreground text-xs">(stop)</span></> : row.piece}</span>
                <span className="next-token-bar" aria-hidden><span style={{ width: `${row.chance * 100}%` }} /></span>
                <span className="next-token-chance font-mono tabular-nums">{percent(row.chance)}</span>
                <span className="text-muted-foreground next-token-count">{row.count} of {chances.observations}</span>
              </li>)}
            </ul>

            <p className="text-muted-foreground mt-3 text-xs">
              {hidden > 0
                ? `${hidden} more ${hidden === 1 ? 'piece shares' : 'pieces share'} the remaining ${percent(1 - covered)}. These rows are ${percent(covered)} of the chance, not all of it.`
                : `That is every piece that ever followed ${endingPhrase(chances.ending)} in the stories. Anything else gets no chance at all here.`}
            </p>
          </>}
        </div>
      </div>
    </div>

    {started && <div className="next-token-run mt-4">
      <p className="eyebrow">Every piece, and what it was chosen from</p>
      <ol className="next-token-steps mt-2">
        {history.map((each, index) => <li key={`${index}-${each.added}`}>
          <span className="text-muted-foreground font-mono tabular-nums">{index + 1}</span>
          <span>after {endingPhrase(each.chances.ending)} → <strong>{quote(each.added)}</strong></span>
          <span className="text-muted-foreground font-mono tabular-nums">{percent(each.chance)}</span>
        </li>)}
      </ol>
      <p className="text-muted-foreground mt-2 text-xs">Each row reads the ending the row above it produced. That is the whole loop: work out chances, add one piece, ask again.</p>
    </div>}

    {done && <div className="next-token-name mt-5">
      <p className="eyebrow">What just happened has a name</p>
      <p className="font-display mt-2 text-xl">Choosing one piece at a time is called next-token prediction.</p>
      <p className="mt-2 text-sm">It is what a language model is trained to do, and it is the only thing it does when it answers you. A whole reply is built the same way this sentence was: one piece, added to the text, then the same question asked again.</p>
      <ul className="next-token-points mt-3">
        <li><strong>The sentence was never planned.</strong> Nothing chose an ending in advance. Each piece was picked from the text that existed at that moment, and the pieces already added are part of what the next choice reads.</li>
        <li><strong>A simple goal is not a small result.</strong> &ldquo;Work out the next piece&rdquo; describes what training rewards. It does not describe everything a much larger model trained on far more text can end up able to do — to guess the next piece of a recipe, a legal argument, or working code, it has to have picked up a great deal about what produced them.</li>
        <li><strong>Assistants get more training after this.</strong> The models you talk to are trained further, on being helpful and on following instructions, so next-piece prediction is where they start rather than all of it.</li>
      </ul>
    </div>}

    {done && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">A whole sentence appeared, one piece at a time. What did the model work out at each step, and what did it read to work out the next one?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Trying this experiment leaves every mark on your map unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="next-token-details mt-5">
      <summary className="next-token-summary">Try another example</summary>
      <div className="text-muted-foreground space-y-3 pb-2 text-sm">
        <p>Each opening starts the same model from a different place. The stories it learned from do not change.</p>
        <div className="flex flex-wrap gap-2">
          {OPENINGS.map(each => <Button
            key={each.id} size="touch" variant={each.id === opening.id ? 'default' : 'outline'}
            onClick={() => choose(each)}
          >{each.label}</Button>)}
        </div>
        <p>{opening.note}</p>
      </div>
    </details>

    <details className="next-token-details mt-2">
      <summary className="next-token-summary">How it learned</summary>
      <div className="space-y-3 pb-2 text-sm">
        <p className="text-muted-foreground">This is a real passage from the first story, with one piece covered up. It is the same shape as the job the model was set while it was learning.</p>
        <div className="next-token-passage">
          <p className="font-display text-lg">{readable(passage.before)} <span className="next-token-cover">?</span></p>
          <p className="text-muted-foreground mt-2 text-xs">The ending here is {endingPhrase(passage.chances.ending)}.</p>
        </div>
        <p>The story really used <strong>{quote(passage.actual)}</strong>. This model gives it {percent(passage.chance)}, behind {quote(passage.chances.continuations[0].piece)} at {percent(passage.chances.continuations[0].chance)}.</p>
        <p className="text-muted-foreground">Training is the business of pushing chance towards the piece that really came next, over and over, across the whole text. In this tiny model that is done by counting: {quote(passage.actual)} has its {percent(passage.chance)} because it really followed {endingPhrase(passage.chances.ending)} {passage.chances.continuations[passage.rank].count} time{passage.chances.continuations[passage.rank].count === 1 ? '' : 's'}. A real model does it differently — it adjusts millions of saved numbers a little at a time, so that the real piece comes out with more chance than it did before.</p>
        <p className="text-muted-foreground">Nothing you do here changes those counts. Adding pieces only reads them.</p>
        <Button size="touch" variant="outline" onClick={() => setShowStories(on => !on)} aria-expanded={showStories}>
          {showStories ? 'Hide the twelve stories' : 'Read the twelve stories it learned from'}
        </Button>
        {showStories && <ol className="next-token-corpus">
          {STORIES.map((story, index) => <li key={index}>{story}</li>)}
        </ol>}
      </div>
    </details>

    <details className="next-token-details mt-2">
      <summary className="next-token-summary">How it works</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>The model looks at the last two pieces of the story, finds every place those two appeared together in the twelve stories, and counts what came next. A piece that came next three times out of eight gets {percent(3 / 8)}.</p>
        <p>If those two pieces never appeared together, it drops back to the last piece on its own, and says so on screen. If even that is new to it, it falls back to how often each piece appears anywhere.</p>
        <p>It always takes the piece with the most chance. When two are exactly equal, the one this ending met first in the stories wins, so the same opening always gives the same sentence.</p>
        <p>Capital letters are removed before counting, so &ldquo;The&rdquo; and &ldquo;the&rdquo; count as one piece. They are put back only so the story is comfortable to read.</p>
        <p>The percentages cover every piece ever seen after that ending, and nothing else. A piece that never followed it gets no chance at all. A real model always leaves every piece in its vocabulary some chance, however small.</p>
      </div>
    </details>

    <details className="next-token-details mt-2">
      <summary className="next-token-summary">What this example leaves out</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>This is a counting model over twelve short stories. It is not a pretrained language model, and it should not be read as showing what one does inside.</p>
        <p>It only ever looks at the last two pieces. A real model reads everything in the request, which is why it can keep track of who is speaking or what a paragraph was about.</p>
        <p>One word here is one piece. Real tokenizers split words into smaller pieces, so a rare word can arrive as several. Words are used here because a learner can read them.</p>
        <p>This one always takes the most likely piece. Real systems often pick from among the likely pieces instead, which is why the same question can get different wording twice.</p>
      </div>
    </details>

    <p className="text-muted-foreground mt-5 text-sm">The tokenizer showed text split into pieces. A language model works out chances for the next piece, then does it again with that piece added.</p>
  </section>;
}
