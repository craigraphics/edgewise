'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DIMENSIONS,
  neighboursOf,
  OPENING_WORDS,
  projection,
  projectionDisagreesWith,
  SHOWN_VALUES,
  matchesFor,
  similarity,
  SOURCE,
  suggestionsFor,
  topicOf,
  TOPICS,
  vectorFor,
  WORDS,
  type Neighbour,
} from '@/lib/experiments/embeddings';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useEmbeddingsExperiment> };

type Slot = 'first' | 'second';

/** A word whose one saved list carries traces of two different meanings. */
const TWO_MEANINGS = 'mouse';

const score = (value: number) => value.toFixed(2);

/** "bass, drums, piano, keyboard and guitarist" — a list to be read aloud, not scanned. */
function listOf(neighbours: readonly Neighbour[]): string {
  const words = neighbours.map(neighbour => neighbour.word);
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the two chosen words, the typed searches, or whether the numbers
 * and the flat picture are open.
 */
export function useEmbeddingsExperiment() {
  const [first, setFirst] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  const [queries, setQueries] = useState<Record<Slot, string>>({ first: '', second: '' });
  const [showValues, setShowValues] = useState(false);
  const [showPicture, setShowPicture] = useState(false);
  const [showSenses, setShowSenses] = useState(false);

  const choose = useCallback((slot: Slot, word: string) => {
    if (slot === 'first') setFirst(word);
    else setSecond(word);
    setQueries(current => ({ ...current, [slot]: '' }));
  }, []);

  const clear = useCallback((slot: Slot) => {
    if (slot === 'first') setFirst(null);
    else setSecond(null);
  }, []);

  const search = useCallback((slot: Slot, text: string) => {
    setQueries(current => ({ ...current, [slot]: text }));
  }, []);

  const reset = useCallback(() => {
    setFirst(null);
    setSecond(null);
    setQueries({ first: '', second: '' });
    setShowValues(false);
    setShowPicture(false);
    setShowSenses(false);
  }, []);

  return { first, second, queries, showValues, showPicture, showSenses, choose, clear, search, reset, setShowValues, setShowPicture, setShowSenses };
}

/** One word's neighbours, with the number each one scored printed beside it. */
function Neighbours({ neighbours }: { neighbours: readonly Neighbour[] }) {
  return <ol className="embeddings-neighbours mt-3">
    {neighbours.map(neighbour => <li key={neighbour.word} className="embeddings-neighbour">
      <span className="embeddings-neighbour-word">{neighbour.word}</span>
      <span className="embeddings-bar" aria-hidden><span className="embeddings-bar-fill" style={{ width: `${Math.max(0, neighbour.similarity) * 100}%` }} /></span>
      <span className="embeddings-neighbour-score font-mono tabular-nums">{score(neighbour.similarity)}</span>
    </li>)}
  </ol>;
}

/**
 * The way in, and the only control on the first screen.
 *
 * Four familiar words from four different parts of life are visible without
 * opening anything; the other 159 are behind a search field and a list, so the
 * first action is one press rather than a decision about a vocabulary.
 */
function Chooser({ slot, exclude, query, onSearch, onChoose }: {
  slot: Slot; exclude: string | null; query: string; onSearch: (text: string) => void; onChoose: (word: string) => void;
}) {
  const needle = query.trim().toLowerCase();
  const matches = matchesFor(needle).filter(word => word !== exclude);
  const missing = needle.length > 0 && matches.length === 0;
  const offered = OPENING_WORDS.filter(word => word !== exclude);
  // Only words the four buttons above are not already offering: a "try these
  // instead" that repeats what is on screen is noise, not a way back.
  const instead = missing ? suggestionsFor(needle).filter(word => word !== exclude && !offered.includes(word)) : [];

  return <div>
    <div className="flex flex-wrap gap-2">
      {offered.map(word => <Button key={word} type="button" size="touch" variant="outline" onClick={() => onChoose(word)}>{word}</Button>)}
    </div>

    <div className="mt-3">
      <label htmlFor={`embeddings-search-${slot}`} className="text-muted-foreground block text-2xs">Or find another word</label>
      <span className="mt-1 flex items-center gap-2">
        <Search size={15} aria-hidden className="text-muted-foreground shrink-0" />
        <Input
          id={`embeddings-search-${slot}`}
          type="search"
          autoComplete="off"
          placeholder="type a word"
          value={query}
          onChange={event => onSearch(event.target.value)}
          className="h-10 max-w-[14rem]"
        />
      </span>
      {matches.length > 0 && <div className="mt-2 flex flex-wrap gap-2">
        {matches.map(word => <Button key={word} type="button" size="touch" variant="outline" onClick={() => onChoose(word)}>{word}</Button>)}
      </div>}
      {missing && <div aria-live="polite" className="mt-2 text-sm">
        <p><strong>{query.trim()}</strong> is not in this small saved collection, so there are no numbers here to compare it with.</p>
        {instead.length > 0 ? <>
          <p className="text-muted-foreground mt-1">These are in it:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {instead.map(word => <Button key={word} type="button" size="touch" variant="outline" onClick={() => onChoose(word)}>{word}</Button>)}
          </div>
        </> : <p className="text-muted-foreground mt-1">The words above are in it, and the full list is below.</p>}
      </div>}
    </div>

    <details className="text-muted-foreground mt-3 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">All {WORDS.length} words in the collection</summary>
      <div className="space-y-3 pt-2">
        <p>We sorted these into areas so they are easy to find. Nothing in the numbers knows about the areas — several words below sit with neighbours from somewhere else entirely.</p>
        {TOPICS.map(topic => <div key={topic.id}>
          <p className="text-foreground text-xs font-medium">{topic.label}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topic.words.filter(word => word !== exclude).map(word => <button key={word} type="button" onClick={() => onChoose(word)} className="embeddings-chip">{word}</button>)}
          </div>
        </div>)}
      </div>
    </details>
  </div>;
}

/**
 * The optional flat picture.
 *
 * Every dot is one word, placed from its full list of 100 numbers squeezed down
 * to two. Only the chosen words and their neighbours are labelled; the rest are
 * context. Nothing here is read back — the neighbour lists above come from the
 * full values, and `projectionDisagreesWith` measures the gap between the two.
 */
function Picture({ first, second }: { first: string; second: string | null }) {
  const { points, disagreeing } = useMemo(() => {
    const all = projection();
    return { points: all, disagreeing: projectionDisagreesWith(all) };
  }, []);

  const named = new Set<string>([first, ...neighboursOf(first)!.map(n => n.word)]);
  if (second) for (const word of [second, ...neighboursOf(second)!.map(n => n.word)]) named.add(word);

  const width = 320;
  const height = 220;
  const pad = 26;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const span = (values: number[]) => {
    const low = Math.min(...values);
    const high = Math.max(...values);
    return { low, size: high - low || 1 };
  };
  const sx = span(xs);
  const sy = span(ys);
  const px = (x: number) => pad + ((x - sx.low) / sx.size) * (width - pad * 2);
  const py = (y: number) => height - pad - ((y - sy.low) / sy.size) * (height - pad * 2);

  /*
   * Labels are placed greedily and nudged downwards out of each other, because
   * the clusters this picture exists to show are exactly where the labels pile
   * up. The order is the collection's own, so the same words land in the same
   * places every time.
   */
  const labels: { word: string; x: number; y: number }[] = [];
  for (const point of points.filter(point => named.has(point.word))) {
    const x = px(point.x) + 5;
    let y = py(point.y) + 3;
    for (let tries = 0; tries < 6; tries += 1) {
      const clash = labels.some(placed => Math.abs(placed.y - y) < 8 && Math.abs(placed.x - x) < (Math.max(placed.word.length, point.word.length) * 4.3));
      if (!clash) break;
      y += 8.5;
    }
    labels.push({ word: point.word, x, y });
  }

  return <div className="mt-3">
    <svg viewBox={`0 0 ${width} ${height}`} className="embeddings-plot" role="img" aria-label={`A flat picture of all ${points.length} words, with ${first}${second ? ` and ${second}` : ''} and their neighbours labelled. Every neighbour list on this page is read from the full lists of numbers, not from this picture.`}>
      {points.map(point => <circle key={point.word} cx={px(point.x)} cy={py(point.y)} r={named.has(point.word) ? 3 : 1.6}
        fill={point.word === first || point.word === second ? 'var(--foreground)' : named.has(point.word) ? 'var(--band-language)' : 'var(--muted-foreground)'}
        opacity={named.has(point.word) ? 1 : 0.35} />)}
      {labels.map(label => <text key={`label-${label.word}`}
        x={label.x} y={label.y} fontSize={8}
        fill={label.word === first || label.word === second ? 'var(--foreground)' : 'var(--muted-foreground)'}
        fontWeight={label.word === first || label.word === second ? 600 : 400}>{label.word}</text>)}
    </svg>
    <p className="mt-2 text-sm">This flat picture leaves a lot out. The list uses all {DIMENSIONS} numbers, and squeezing them into two loses most of what separates one word from another.</p>
    <p className="text-muted-foreground mt-2 text-sm">Counted in this collection: <strong className="text-foreground">{disagreeing.length} of the {points.length} words</strong> have a different closest word in this picture than they do in the full lists. That is why the lists above are read from all {DIMENSIONS} numbers and never off the drawing.</p>
  </div>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function EmbeddingsExperiment({ onExplain, experiment }: Props) {
  const { first, second, queries, showValues, showPicture, showSenses, choose, clear, search, reset, setShowValues, setShowPicture, setShowSenses } = experiment;

  const pairScore = first && second ? similarity(vectorFor(first)!, vectorFor(second)!) : null;
  const firstNeighbours = first ? neighboursOf(first)! : null;
  const secondNeighbours = second ? neighboursOf(second)! : null;

  function slotCard(slot: Slot, word: string | null, neighbours: readonly Neighbour[] | null) {
    const other = slot === 'first' ? second : first;
    return <div className="embeddings-slot">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">{slot === 'first' ? 'First word' : 'Second word'}</p>
        {word && <button className="text-muted-foreground min-h-10 text-xs underline underline-offset-4" onClick={() => clear(slot)}>Choose a different word</button>}
      </div>
      {word && neighbours ? <>
        <p className="font-display mt-2 text-2xl">{word}</p>
        <p className="text-muted-foreground text-xs">We filed it under {topicOf(word)}</p>
        <p className="mt-3 text-sm">Nearest words in this collection:</p>
        <Neighbours neighbours={neighbours} />
        <p className="mt-3 text-sm">Nearby means their lists of numbers are similar. The number beside each word says how similar.</p>
      </> : <>
        <p className="mt-2 text-sm">{slot === 'first' ? 'Pick a word and see which words sit nearest to it.' : 'Now pick one from somewhere else in life, and compare the two lists.'}</p>
        <div className="mt-3"><Chooser slot={slot} exclude={other} query={queries[slot]} onSearch={text => search(slot, text)} onChoose={chosen => choose(slot, chosen)} /></div>
      </>}
    </div>;
  }

  return <section className="embeddings-lab" aria-labelledby="embeddings-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="embeddings-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">Which words might belong together?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>
    <p className="mt-3 max-w-2xl text-base">You saw how text becomes pieces. Now see how lists of numbers let a computer compare one word with another. Every word below has a saved list of {DIMENSIONS} numbers.</p>

    <div className="embeddings-pair mt-5">
      {slotCard('first', first, firstNeighbours)}
      {first && slotCard('second', second, secondNeighbours)}
    </div>

    <div aria-live="polite" aria-atomic="true" className="mt-4">
      {first && firstNeighbours && <div className="embeddings-readout">
        {second && secondNeighbours && pairScore !== null
          ? <>
            <p><strong>{first}</strong> and <strong>{second}</strong> score <strong className="font-mono tabular-nums">{score(pairScore)}</strong> against each other, while <strong>{first}</strong> and <strong>{firstNeighbours[0].word}</strong> score <strong className="font-mono tabular-nums">{score(firstNeighbours[0].similarity)}</strong>. Two different parts of life, two different sets of neighbours.</p>
            <p className="mt-2">Nobody sorted these words into topics for the computer. Nobody wrote down what {first} or {second} means. The only thing being compared is one list of {DIMENSIONS} numbers against another.</p>
          </>
          : <p>Nobody wrote down what {first} means. Those five words came out nearest because their lists of numbers are most like {first}&rsquo;s. Pick a second word to compare.</p>}
      </div>}
    </div>

    {first && <div className="mt-5">
      <Button size="touch" variant="outline" onClick={() => setShowValues(!showValues)} aria-expanded={showValues}>{showValues ? 'Hide the numbers' : 'See the numbers'}</Button>
      {showValues && <div className="embeddings-values mt-3">
        <p className="text-sm">This is the start of each saved list. The first {SHOWN_VALUES} of {DIMENSIONS} numbers:</p>
        {[first, second].filter((word): word is string => Boolean(word)).map(word => <p key={word} className="mt-3 text-sm">
          <span className="font-medium">{word}</span>
          <span className="embeddings-numbers mt-1 block font-mono text-xs tabular-nums">{vectorFor(word)!.slice(0, SHOWN_VALUES).map(value => value.toFixed(2)).join('  ')} <span className="text-muted-foreground">… {DIMENSIONS - SHOWN_VALUES} more</span></span>
        </p>)}
        <p className="mt-3 text-sm">No single number means anything on its own. Nobody chose what any of them stand for. What the comparison uses is the whole list at once: two words score close to <strong>1.00</strong> when their lists rise and fall together, and near <strong>0</strong> when they have nothing in common.</p>
      </div>}
    </div>}

    {first && second && <div className="mt-5">
      <h4 className="font-display text-xl">One word, one list</h4>
      <p className="mt-2 text-sm">Each word here gets a single saved list, whatever the word is doing in a sentence. So a word with two meanings cannot pick one.</p>
      {showSenses ? <div className="embeddings-readout mt-3">
        <p>The nearest words to <strong>{TWO_MEANINGS}</strong> are {listOf(neighboursOf(TWO_MEANINGS, 6)!)}.</p>
        <p className="mt-2">The animal and the thing beside a keyboard are both in there, mixed into one list, because the text these numbers came from used the word both ways. A language model does not stop here: it works out a fresh list for each word every time, using the rest of the sentence. These saved lists cannot do that.</p>
      </div> : <Button className="mt-3" size="touch" variant="outline" onClick={() => setShowSenses(true)}>Look at the word “{TWO_MEANINGS}”</Button>}
    </div>}

    {first && <div className="mt-5">
      <h4 className="font-display text-xl">A flat picture, if you want one</h4>
      <p className="text-muted-foreground mt-1 text-sm">Optional. Everything above is already readable as a list, and the picture is not what any of it was worked out from.</p>
      <Button className="mt-3" size="touch" variant="outline" onClick={() => setShowPicture(!showPicture)} aria-expanded={showPicture}>{showPicture ? 'Hide the picture' : 'Show the picture'}</Button>
      {showPicture && <Picture first={first} second={second} />}
    </div>}

    {first && second && <div className="border-border mt-5 border-t pt-5">
      <p className="font-display text-xl">What can these lists of numbers help us compare, and what does the flat picture miss?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Reading neighbours here leaves every mark on your map unchanged; comparing lists of numbers is arithmetic, not evidence that anything understood a word.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">How the comparison works</summary>
      <div className="space-y-2 pt-2">
        <p>Each word is a list of {DIMENSIONS} numbers. To compare two, the lists are multiplied together position by position and the results added up, then divided by the length of each list. That gives a number between −1 and 1.</p>
        <p>Dividing by the lengths is what makes it a comparison of direction rather than of size, so a common word does not look unlike a rare one purely for having larger numbers. The usual name for it is cosine similarity.</p>
        <p>Every neighbour on this page is worked out that way, against all {WORDS.length} words in the collection, from all {DIMENSIONS} numbers.</p>
      </div>
    </details>

    <details className="text-muted-foreground mt-2 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">Where these numbers came from, and what they leave out</summary>
      <div className="space-y-2 pt-2">
        <p>They are real learned values, not made up for this panel: {SOURCE.name}, trained on {SOURCE.corpus}. {SOURCE.citation}. Released under the {SOURCE.licence}, which is why a slice of them can sit in this page. Values are rounded to four decimal places, and every number shown is computed from the rounded values.</p>
        <p><strong>This is a small saved collection</strong> of {WORDS.length} words, not a tool that can look up any word you can think of. A word that is not in it has no numbers here.</p>
        <p>These are <strong>static</strong> lists: one per word, worked out from how often words appeared near each other across a lot of text. {SOURCE.kindNote}</p>
        <p>Real models use hundreds or thousands of numbers per piece of text rather than {DIMENSIONS}, and the pieces are tokens rather than whole words. Words appearing in similar places is also not the same as words meaning the same thing — opposites often keep close company.</p>
      </div>
    </details>
  </section>;
}
