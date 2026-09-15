'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  answersDiffer,
  answerFrom,
  CURRENT_NOTICE,
  dayIn,
  FIRST_QUESTION,
  isStale,
  NOTICES,
  OLDER_NOTICE,
  QUESTIONS,
  queryTerms,
  rank,
  score,
  STOPWORDS,
  type Answer,
  type Match,
  type Notice,
  type Question,
} from '@/lib/experiments/retrieval';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useRagExperiment> };

type Action = 'find' | 'supply' | 'answer';

const noticeById = (id: string | null): Notice | null => NOTICES.find(each => each.id === id) ?? null;

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the search, the notice handed over, or the answer on screen.
 */
export function useRagExperiment() {
  const [question, setQuestion] = useState<Question>(FIRST_QUESTION);
  /** null until the search has been run. An empty array is a real result. */
  const [results, setResults] = useState<readonly Match[] | null>(null);
  const [supplied, setSupplied] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  /** Which notice the answer on screen came from, so a swap can invalidate it. */
  const [answeredFrom, setAnsweredFrom] = useState<string | null>(null);
  /** The previous answer, so the panel can say what changed rather than assert it. */
  const [previous, setPrevious] = useState<{ answer: Answer; from: string } | null>(null);
  const [lastAction, setLastAction] = useState<Action | null>(null);
  const [answers, setAnswers] = useState(0);

  /*
   * Every consequence is worked out here, at the moment the action is taken,
   * rather than in an effect watching the render. `react-hooks/
   * set-state-in-effect` would reject the effect version and it is right about
   * the design: which notice is now supplied is a consequence of this press.
   */
  const find = useCallback(() => {
    const found = rank(NOTICES, question.text);
    setResults(found);
    setSupplied(found[0]?.notice.id ?? null);
    setAnswer(null);
    setAnsweredFrom(null);
    setPrevious(null);
    setLastAction('find');
  }, [question]);

  const supply = useCallback((id: string) => {
    setSupplied(id);
    setLastAction('supply');
  }, []);

  const answerNow = useCallback(() => {
    const source = noticeById(supplied);
    if (!source) return;
    const next = answerFrom(source, question.text);
    if (answer && answeredFrom) setPrevious({ answer, from: answeredFrom });
    setAnswer(next);
    setAnsweredFrom(source.id);
    setLastAction('answer');
    if (next.kind === 'answer') setAnswers(count => count + 1);
  }, [answer, answeredFrom, question, supplied]);

  const choose = useCallback((next: Question) => {
    setQuestion(next);
    setResults(null);
    setSupplied(null);
    setAnswer(null);
    setAnsweredFrom(null);
    setPrevious(null);
    setLastAction(null);
    setAnswers(0);
  }, []);

  const reset = useCallback(() => choose(FIRST_QUESTION), [choose]);

  return { question, results, supplied, answer, answeredFrom, previous, lastAction, answers, find, supply, answerNow, choose, reset };
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const spell = (n: number) => WORDS[n] ?? String(n);
const list = (items: readonly string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Title, date and version, always visible and never behind a hover. */
function Provenance({ notice }: { notice: Notice }) {
  return <p className="rag-provenance">
    <span className="rag-notice-title">{notice.title},</span>
    <span>{notice.date},</span>
    <span>version {notice.version}</span>
  </p>;
}

/** Local searching only: this component deliberately has no learner-model access. */
export function RagExperiment({ onExplain, experiment }: Props) {
  const { question, results, supplied, answer, answeredFrom, previous, lastAction, answers, find, supply, answerNow, choose, reset } = experiment;

  const terms = queryTerms(question.text);
  /* `dayIn` returns the stem, and this is the middle of a sentence on screen. */
  const asked = dayIn(question.text);
  const day = asked ? asked.charAt(0).toUpperCase() + asked.slice(1) : null;
  const source = noticeById(supplied);
  const stale = isStale(answeredFrom, supplied);
  const shown = answer && !stale ? answer : null;
  const comparedAnswers = answersDiffer(previous?.answer ?? null, answer);
  const answeredNotice = noticeById(answeredFrom);
  const comparison = (() => {
    if (!comparedAnswers || !previous || previous.answer.kind !== 'answer' || answer?.kind !== 'answer' || !answeredNotice) return null;
    const previousNotice = noticeById(previous.from);
    if (!previousNotice) return null;
    return { previousAnswer: previous.answer, previousNotice, currentAnswer: answer, currentNotice: answeredNotice };
  })();
  const searched = results !== null;
  const nothingMatched = searched && results.length === 0;
  const olderIsSupplied = supplied === OLDER_NOTICE;
  const canSwap = Boolean(shown) && results !== null && results.some(match => match.notice.id === (olderIsSupplied ? CURRENT_NOTICE : OLDER_NOTICE));

  /*
   * The sentence that says what changed. Every claim in it is read off the
   * ranking or the answer that just ran — which word gave the top notice its
   * lead, which line the answer came from, what the time was before — so it
   * cannot drift from what the panel is showing.
   */
  const changed = (() => {
    if (!lastAction || !results) return null;
    if (lastAction === 'find') {
      if (results.length === 0) {
        return `No notice contains ${list(terms.map(term => `“${term}”`))}, so the search came back with nothing. There is no passage to hand over.`;
      }
      const top = results[0];
      const lead = [...top.hits].sort((a, b) => b.contribution - a.contribution)[0];
      return `The search picked ${top.notice.title}, ${top.notice.date}. “${lead.term}” gave it the lead with ${spell(lead.occurrences)} matches. It has not answered yet — it has only chosen the text the answer may read.`;
    }
    if (lastAction === 'supply') {
      const held = source ? `${source.title}, ${source.date}` : 'nothing';
      const next = stale ? ' Run the answer again to see the effect.' : '';
      return `Only the supplied notice changed: it is now ${held}. The question and answering rule stayed the same.${next}`;
    }
    if (!answer) return null;
    if (answer.kind === 'no-answer') {
      return answer.reason === 'no-day-in-question'
        ? 'This question names no day, so the rule has nothing to look for. It stops rather than supplying a time from somewhere else.'
        : `The rule was handed ${answeredNotice?.title}, ${answeredNotice?.date}, and it can use nothing else. No line in it gives a closing time for ${day}, so it stops rather than taking one from another notice.`;
    }
    const moved = previous && previous.answer.kind === 'answer' && previous.answer.time !== answer.time;
    if (moved && previous.answer.kind === 'answer') {
      return `Same question, same rule. With a different notice, the answer changed from ${previous.answer.time} to ${answer.time}.`;
    }
    return `The answer copied its time from one line of ${answeredNotice?.title}, ${answeredNotice?.date}. It never read the other four notices.`;
  })();

  return <section className="rag-lab" aria-labelledby="rag-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A small experiment · runs in your browser</p>
        <h3 id="rag-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">How can AI answer from a notice it was never trained on?</h3>
      </div>
      {/* Offered only once something has changed: a Reset on an untouched screen is a control with nothing to do. */}
      {(searched || question.id !== FIRST_QUESTION.id) && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>
    <p className="mt-3 max-w-2xl text-base">Marlow Lane Pool has five notices. Search will choose one, then the answer will be allowed to read only that notice.</p>

    <div className="rag-stage mt-5">
      <div className="rag-question-area">
        <div className="rag-question">
          <p className="eyebrow">The question · it does not change</p>
          <p className="font-display mt-2 text-xl sm:text-2xl">{question.text}</p>
          <p className="text-muted-foreground mt-2 text-xs">
            {terms.length > 0
              ? <>Common words dropped, the search looks for {list(terms.map(term => `“${term}”`))}.</>
              : <>Every word here is a common word, so the search has nothing to look for.</>}
          </p>
        </div>
      </div>

      <div className="rag-flow-area">
        <div className="rag-action-area">
          <p className="eyebrow mb-2">
            {!searched ? 'Step 1 · choose a notice' : (!answer || stale) ? 'Step 2 · answer from it' : 'Now change just the notice'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!searched && <Button size="touch" onClick={find}><Search aria-hidden />Search the notices</Button>}
            {searched && supplied && (!answer || stale) && <Button size="touch" onClick={answerNow}>Answer from this notice <ArrowRight aria-hidden /></Button>}
            {canSwap && <Button size="touch" variant={olderIsSupplied ? 'default' : 'outline'} onClick={() => supply(olderIsSupplied ? CURRENT_NOTICE : OLDER_NOTICE)}>
              {olderIsSupplied ? 'Restore the current notice' : 'Try the older notice'}
            </Button>}
            {nothingMatched && <Button size="touch" variant="outline" onClick={reset}><RotateCcw size={14} aria-hidden />Start again</Button>}
          </div>
          <div aria-live="polite" className="rag-change mt-3">
            {changed
              ? <p className="text-sm">{changed}</p>
              : <p className="text-muted-foreground text-sm">Search chooses one notice. Then the answering rule can read that notice — and no other.</p>}
          </div>
        </div>

        <div className="rag-supplied-area">
          <div className={cn('rag-supplied', !source && 'rag-supplied-empty')}>
            <p className="eyebrow">Notice sent with the question</p>
            {!source ? <p className="text-muted-foreground mt-2 text-sm">Nothing yet. Search will put one notice here. The answer cannot read the other four.</p> : <>
              <Provenance notice={source} />
              <ol className="rag-passage mt-2">
                {source.lines.map((line, index) => <li key={index} className={cn(shown?.kind === 'answer' && shown.lineIndex === index && 'rag-cited')}>{line}</li>)}
              </ol>
            </>}
          </div>

          {stale && answer && answeredNotice && <p className="rag-stale mt-2 text-sm">The answer below still came from the {answeredNotice.date} notice. It has not been rebuilt.</p>}

          {answer && answeredNotice && <div className={cn('rag-answer mt-2', stale && 'rag-answer-stale')} aria-live="polite">
            <p className="eyebrow">The answer · scripted, not a live AI reply</p>
            {answer.kind === 'answer' ? <>
              <p className="font-display mt-2 text-xl sm:text-2xl">{answer.text}</p>
              <div className="rag-citation mt-3">
                <p className="text-muted-foreground text-2xs">From line {answer.lineIndex + 1} of:</p>
                <Provenance notice={answeredNotice} />
                <p className="rag-quote mt-1">“{answer.line}”</p>
              </div>
            </> : <>
              <p className="font-display mt-2 text-xl sm:text-2xl">This notice does not give the answer.</p>
              <p className="mt-2 text-sm">{answer.reason === 'no-day-in-question'
                ? 'The question names no day, so there is nothing to look for.'
                : `No line in this notice gives a closing time for ${day}.`}</p>
            </>}
          </div>}

          {comparison && <div className="rag-contrast mt-2">
            <p className="eyebrow">Only one thing changed</p>
            <div className="rag-contrast-pair mt-3">
              <div className="rag-contrast-answer">
                <p className="text-muted-foreground text-xs">Before · {comparison.previousNotice.date}</p>
                <p className="font-display mt-1 text-2xl">{comparison.previousAnswer.time}</p>
              </div>
              <ArrowRight className="text-muted-foreground" size={18} aria-hidden />
              <div className="rag-contrast-answer">
                <p className="text-muted-foreground text-xs">Now · {comparison.currentNotice.date}</p>
                <p className="font-display mt-1 text-2xl">{comparison.currentAnswer.time}</p>
              </div>
            </div>
            <p className="mt-3 text-sm"><strong>Same question. Same answering rule.</strong> Only the notice handed to it changed.</p>
          </div>}
        </div>

        {answers > 0 && <div className="rag-name">
          <p className="eyebrow">What just happened has a name</p>
          <p className="font-display mt-2 text-xl">Search finds a passage. The passage goes into the request. The answer reads it. That is retrieval, or RAG.</p>
          <ul className="rag-points mt-3">
            <li><strong>The notice is not learned.</strong> In a real RAG system, a copy goes into the current request. Training stays untouched.</li>
            <li><strong>Search chose what the answer could read.</strong> Everything downstream depended on that source being the right one.</li>
            {comparedAnswers && <li><strong>A citation is not a truth check.</strong> The 6pm answer cites the old notice perfectly. A real model can also misread a good source or add a detail that is not there.</li>}
          </ul>
        </div>}

        {comparedAnswers && <div className="border-border border-t pt-4">
          <p className="font-display text-xl">The same question and answering rule gave two different closing times. What changed, and where did each time come from?</p>
          <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Trying this experiment leaves every mark on your map unchanged.</p>
          <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
        </div>}
      </div>

      <div className="rag-notices-area">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-xl">The pool&rsquo;s notices</h4>
          <p className="text-muted-foreground text-xs">{searched ? 'ranked by shared words' : `${spell(NOTICES.length)} notices · not yet searched`}</p>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">The pool, its notices and every date and time in them are invented for this example.</p>

        {!searched
          ? <ol className="rag-notices mt-2">
            {NOTICES.map(notice => <li key={notice.id} className="rag-notice">
              <Provenance notice={notice} />
            </li>)}
          </ol>
          : nothingMatched
            ? <div className="rag-empty mt-2">
              <p className="text-sm">No notice matched. Not one of the five contains {list(terms.map(term => `“${term}”`))}.</p>
              <p className="text-muted-foreground mt-2 text-sm">The search returns nothing rather than its closest guess, so there is no passage to hand over and no answer to build. A real system may do the same — or it may hand over its best match anyway, and a model given a passage that does not answer the question can still produce something confident-sounding.</p>
            </div>
            : <>
              <ol className="rag-notices mt-2">
                {results.map((match, position) => {
                  const isSupplied = match.notice.id === supplied;
                  return <li key={match.notice.id} className={cn('rag-notice rag-notice-ranked', isSupplied && 'rag-notice-supplied')}>
                    <div className="rag-rank-row">
                      <span className="rag-rank font-mono tabular-nums" aria-hidden>{position + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Provenance notice={match.notice} />
                        <p className="rag-score font-mono text-xs tabular-nums">
                          <span className="rag-bar" aria-hidden><span style={{ width: `${(match.score / results[0].score) * 100}%` }} /></span>
                          score {score(match.score)}
                        </p>
                        <p className="rag-hits">
                          {match.hits.map(hit => <span key={hit.term} className="rag-hit">
                            {hit.term} <span className="font-mono tabular-nums">×{hit.occurrences}</span>
                          </span>)}
                        </p>
                      </div>
                      {isSupplied
                        ? <span className="rag-chip">Handed over</span>
                        : <Button size="touch" variant="outline" onClick={() => supply(match.notice.id)} aria-label={`Hand over ${match.notice.title}, ${match.notice.date}`}>Use this one</Button>}
                    </div>
                  </li>;
                })}
              </ol>
              <p className="text-muted-foreground mt-3 text-xs">
                Choose any result to hand it to the answer and read its full text. Scores come from the shared words shown on each row.
              </p>
              <p className="rag-dates mt-2 text-sm">
                The top notice came first because of how it is worded, not because it is newer. <strong>This search never looks at the dates or the versions</strong> — only at the words. That is why an out-of-date notice can be handed over without anything noticing.
              </p>
            </>}
      </div>
    </div>

    <details className="rag-details mt-5">
      <summary className="rag-summary">Try another example</summary>
      <div className="text-muted-foreground space-y-3 pb-2 text-sm">
        <p>Each question searches the same five notices. The notices do not change.</p>
        <div className="flex flex-wrap gap-2">
          {/*
            * The shared Button is `whitespace-nowrap` at a fixed height, so a
            * whole question in one hung 30px off the right of a 276px column.
            * Measured at 320px, not reasoned about — the same defect the
            * saved-messages panel already records.
            */}
          {QUESTIONS.map(each => <Button
            key={each.id} size="touch" variant={each.id === question.id ? 'default' : 'outline'}
            className="h-auto max-w-full py-2 text-left whitespace-normal"
            onClick={() => choose(each)}
          >{each.text}</Button>)}
        </div>
        <p>{question.note}</p>
        <p>You can also hand over a notice that matched but has nothing to say about Saturday. Search, then press <strong>Use this one</strong> on the lane swimming or maintenance notice and answer from it.</p>
      </div>
    </details>

    <details className="rag-details mt-2">
      <summary className="rag-summary">How the search works</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>It is a keyword search. It counts words the question and the notice share. It does not understand either one, and it is not a search by meaning — no position in space and no distance between words is involved anywhere here.</p>
        <p>Common words go first: {list(STOPWORDS.slice(0, 8).map(word => `“${word}”`))} and a few more. What is left is what it looks for.</p>
        <p>Each remaining word scores <span className="font-mono">how often this notice uses it ÷ how many notices contain it</span>. So a word that narrows things down counts for more than one that is in nearly every notice, and a notice that uses the question&rsquo;s words more often scores higher.</p>
        <p>One crude rule tidies the words up: a trailing &ldquo;s&rdquo; comes off, so &ldquo;closes&rdquo; counts as &ldquo;close&rdquo; and &ldquo;Saturdays&rdquo; as &ldquo;Saturday&rdquo;. Nothing else changes, so &ldquo;closed&rdquo; stays a different word — which is why the maintenance notice scores on &ldquo;pool&rdquo; alone.</p>
        <p>Whole words only, so &ldquo;Poolside&rdquo; is not &ldquo;pool&rdquo;. When two notices score exactly the same, the one earlier in the collection wins; the collection is not in date order, so that is a stable rule rather than a preference for anything.</p>
        <p>A notice sharing no word at all is left out, which is why a question about a sauna returns nothing instead of a best guess.</p>
      </div>
    </details>

    <details className="rag-details mt-2">
      <summary className="rag-summary">What this example leaves out</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>The answer is a hand-written template. It finds one line naming the day and giving a closing time, and repeats the subject and the time from that line. It is here to show what an answer can and cannot reach, not to stand in for a model, and it never writes anything of its own. A real language model in its place can misread a good passage, blend two sources, or add a detail that is in neither.</p>
        <p>Real systems usually search by meaning rather than by shared words, using the kind of number lists in the word-neighbours experiment, so a notice can be found without using the question&rsquo;s vocabulary at all. That search can be wrong too, in different ways.</p>
        <p>Real collections are far larger and are split into passages before being searched, several passages are usually handed over rather than one, and something has to decide how many. Nothing here does any of that.</p>
        <p>Whether a source is current is a separate problem from whether it was found. Keeping an out-of-date notice out of the answer means removing or superseding it in the collection. No amount of better searching fixes a collection that still holds last winter&rsquo;s hours.</p>
      </div>
    </details>

    <p className="text-muted-foreground mt-5 text-sm">A request can include extra text. Search helps choose which text to include.</p>
  </section>;
}
