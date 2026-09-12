'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowRight, RotateCcw, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  averageBrightness,
  CELL_COUNT,
  describePixel,
  differingPositions,
  ENCODINGS,
  encodingById,
  formatBrightness,
  GRID_SIZE,
  INITIAL_SCENARIO,
  pixelList,
  positionOf,
  quarterTurn,
  sameEncoding,
  SCENARIOS,
  sharingPictures,
  toggle,
  TOTAL_PICTURES,
  whiteCount,
  type EncodingId,
  type Grid,
  type Scenario,
} from '@/lib/experiments/representation';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useRepresentationExperiment> };
type Side = 'a' | 'b';

/** What a quarter turn actually did, worked out by comparing the picture before and after. */
type TurnReport = { side: Side; moved: number; brightness: number };

const SIDE_NAME: Record<Side, string> = { a: 'Picture A', b: 'Picture B' };
const grouped = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the two pictures, the chosen encoding, or the position being
 * inspected.
 */
export function useRepresentationExperiment() {
  const [pictures, setPictures] = useState<{ a: Grid; b: Grid }>(() => ({ a: INITIAL_SCENARIO.a, b: INITIAL_SCENARIO.b }));
  const [scenarioLabel, setScenarioLabel] = useState<string | null>(INITIAL_SCENARIO.label);
  const [encoding, setEncoding] = useState<EncodingId>('average');
  /** Zero-based index into the ordered list, or null while nothing is being inspected. */
  const [position, setPosition] = useState<number | null>(null);
  const [turn, setTurn] = useState<TurnReport | null>(null);

  const flip = useCallback((side: Side, index: number) => {
    setPictures(current => ({ ...current, [side]: toggle(current[side], index) }));
    setScenarioLabel(null);
    setTurn(null);
  }, []);

  const rotate = useCallback((side: Side) => {
    const before = pictures[side];
    const turned = quarterTurn(before);
    setPictures(current => ({ ...current, [side]: turned }));
    setTurn({ side, moved: differingPositions(before, turned).length, brightness: averageBrightness(turned) });
    setScenarioLabel(null);
  }, [pictures]);

  const chooseScenario = useCallback((scenario: Scenario) => {
    setPictures({ a: scenario.a, b: scenario.b });
    setScenarioLabel(scenario.label);
    setTurn(null);
  }, []);

  const reset = useCallback(() => {
    setPictures({ a: INITIAL_SCENARIO.a, b: INITIAL_SCENARIO.b });
    setScenarioLabel(INITIAL_SCENARIO.label);
    setEncoding('average');
    setPosition(null);
    setTurn(null);
  }, []);

  return { pictures, scenarioLabel, encoding, position, turn, flip, rotate, chooseScenario, setEncoding, setPosition, reset };
}

/**
 * The picture, as sixteen buttons.
 *
 * Roving tabindex rather than sixteen tab stops each: this is a grid of cells
 * and arrow keys are how one is crossed. Every cell is still a plain button
 * carrying its own row, column and pressed state, so nothing here depends on a
 * custom widget role being interpreted correctly.
 */
function PixelGrid({ grid, selected, labelledBy, describedBy, onFlip }: {
  grid: Grid; selected: number | null; labelledBy: string; describedBy: string; onFlip: (index: number) => void;
}) {
  const [cursor, setCursor] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const focusCell = (index: number) => {
    const clamped = Math.max(0, Math.min(CELL_COUNT - 1, index));
    setCursor(clamped);
    containerRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${clamped}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: GRID_SIZE, ArrowUp: -GRID_SIZE };
    if (event.key in steps) { event.preventDefault(); focusCell(index + steps[event.key]); }
    else if (event.key === 'Home') { event.preventDefault(); focusCell(0); }
    else if (event.key === 'End') { event.preventDefault(); focusCell(CELL_COUNT - 1); }
  };

  return <div ref={containerRef} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="representation-grid">
    {grid.map((value, index) => {
      const { row, column } = positionOf(index);
      return <button
        key={index}
        type="button"
        data-cell={index}
        data-value={value}
        data-selected={selected === index ? '' : undefined}
        tabIndex={index === cursor ? 0 : -1}
        aria-pressed={value === 1}
        aria-label={`Position ${index + 1}, row ${row}, column ${column}, ${describePixel(value)}`}
        className="representation-cell"
        onKeyDown={event => onKeyDown(event, index)}
        onClick={() => { setCursor(index); onFlip(index); }}
      ><span aria-hidden>{value}</span></button>;
    })}
  </div>;
}

/** The list as the model receives it: one flat run of sixteen numbers. */
function OrderedList({ grid, selected }: { grid: Grid; selected: number | null }) {
  return <p className="representation-numbers">
    {pixelList(grid).map((value, index) => <span key={index}>
      <span data-selected={selected === index ? '' : undefined}>{value}</span>
      {index < CELL_COUNT - 1 && (index + 1) % GRID_SIZE === 0 ? <span aria-hidden className="representation-numbers-break"> · </span> : null}
    </span>)}
  </p>;
}

/** Local arithmetic only: this component deliberately has no learner-model access. */
export function RepresentationExperiment({ onExplain, experiment }: Props) {
  const { pictures, scenarioLabel, encoding, position, turn, flip, rotate, chooseScenario, setEncoding, setPosition, reset } = experiment;
  const chosen = encodingById(encoding);
  const listed = encoding === 'list';
  const highlighted = listed ? position : null;

  const brightness = { a: averageBrightness(pictures.a), b: averageBrightness(pictures.b) };
  const differences = differingPositions(pictures.a, pictures.b);
  const identical = differences.length === 0;
  const collides = sameEncoding(pictures.a, pictures.b, encoding);
  const inspected = position === null ? null : { ...positionOf(position), a: pictures.a[position], b: pictures.b[position] };

  const scenario = SCENARIOS.find(candidate => candidate.label === scenarioLabel);
  const scenarioNote = scenario?.note;
  const openingLetters = scenarioLabel === INITIAL_SCENARIO.label;
  const pictureName = (side: Side) => scenario?.names[side === 'a' ? 0 : 1] ?? SIDE_NAME[side];

  function outputFor(side: Side) {
    const grid = pictures[side];
    const whites = whiteCount(grid);
    return <div key={side} className="representation-flow">
      <div className="representation-picture">
        <p id={`representation-${side}-title`} className="text-sm font-medium">{pictureName(side)}</p>
        <p id={`representation-${side}-hint`} className="text-muted-foreground mt-1 text-xs">Tap a cell to flip it. Black is 0; white is 1. Arrow keys move between cells.</p>
        <PixelGrid grid={grid} selected={highlighted} labelledBy={`representation-${side}-title`} describedBy={`representation-${side}-hint`} onFlip={index => flip(side, index)} />
      </div>
      <div className="representation-flow-arrow" aria-hidden>
        <ArrowDown />
        <span>{encoding === 'average' ? 'keep only the average' : 'keep every position'}</span>
      </div>
      <div className="representation-output">
        <p className="eyebrow">Numbers handed to the model</p>
        {encoding === 'average' ? <>
          <p className="representation-output-value font-mono tabular-nums">{formatBrightness(brightness[side])}</p>
          <p className="mt-1 text-sm">{whites} white cells ÷ {CELL_COUNT} total cells.</p>
        </> : <>
          <OrderedList grid={grid} selected={highlighted} />
          <p className="mt-1 text-sm">One number per cell, read row by row.</p>
        </>}
      </div>
    </div>;
  }

  return <section className="representation-lab" aria-labelledby="representation-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A quick experiment · runs in your browser</p>
        <h3 id="representation-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">How can an H and a T become the same number?</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>
    <p className="mt-3 max-w-2xl text-base">A model does not see a picture as an H or a T. It receives numbers. An <strong>encoding</strong> decides which numbers will stand in for the picture.</p>
    <p className="mt-3 max-w-2xl text-base">You are not being tested. You are testing one idea: <strong>the model can only notice differences those numbers preserve.</strong></p>
    <ol className="text-muted-foreground mt-3 list-decimal space-y-1 pl-5 text-sm">
      <li>Compare the <strong className="text-foreground">H</strong> and the <strong className="text-foreground">T</strong> below.</li>
      <li>See what reaches the model when the encoding keeps only average brightness.</li>
      <li>Switch to <strong className="text-foreground">Keep every cell&apos;s position</strong> and compare again.</li>
    </ol>

    <fieldset className="representation-split mt-5 min-w-0">
      <legend className="text-sm font-medium">1. Choose what the encoding keeps</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {ENCODINGS.map(option => <label key={option.id} className={cn('representation-choice', encoding === option.id && 'representation-choice-selected')}>
          <input type="radio" name="representation-encoding" value={option.id} checked={encoding === option.id} onChange={() => setEncoding(option.id)} />
          <span><span className="block font-medium">{option.id === 'average' ? 'Keep only average brightness' : 'Keep every cell\'s position'}</span><span className="text-muted-foreground block text-xs">{option.id === 'average' ? '1 number' : `${CELL_COUNT} numbers, read row by row`}</span></span>
        </label>)}
      </div>
      <p className="mt-3 text-sm"><strong>Keeps:</strong> {chosen.keeps}</p>
      <p className="mt-1 text-sm"><strong>Throws away:</strong> {chosen.discards}</p>
    </fieldset>

    <div className="mt-5">
      <h4 className="font-display text-xl">2. Follow each picture into the model</h4>
      {scenarioNote && <p className="text-muted-foreground mt-1 text-sm">{scenarioNote}</p>}
      <div className="representation-pair mt-3">{(['a', 'b'] as const).map(outputFor)}</div>

      <div aria-live="polite" aria-atomic="true" className="mt-4">
        <div className={cn('representation-verdict', collides && !identical && 'representation-verdict-collision')}>
          {encoding === 'average' ? (
            identical ? <>
              <p className="font-display text-xl">One number, and the same picture twice.</p>
              <p className="mt-2 text-sm">These two are identical, cell for cell, so of course they encode alike. Change one of them to see what a single number does keep.</p>
            </> : collides ? <>
              <p className="font-display text-xl">{openingLetters ? 'To the model, the H and the T now look identical.' : 'To the model, these pictures now look identical.'}</p>
              <p className="mt-2 text-sm">They differ at {differences.length} of their {CELL_COUNT} positions, but both became {formatBrightness(brightness.a)}. From that number alone, the model cannot know which picture was drawn.</p>
              <p className="text-muted-foreground mt-2 text-sm">In fact, {grouped(sharingPictures(pictures.a, encoding))} of the {grouped(TOTAL_PICTURES)} possible grids produce this same number.</p>
            </> : <>
              <p className="font-display text-xl">These two came out as different numbers.</p>
              <p className="mt-2 text-sm">Picture A is {formatBrightness(brightness.a)}, picture B is {formatBrightness(brightness.b)}. One number separates these two — but only by overall brightness. Any two pictures with the same count of white cells still collide.</p>
            </>
          ) : (
            identical ? <>
              <p className="font-display text-xl">Two identical lists, from two identical pictures.</p>
              <p className="mt-2 text-sm">Nothing separates them because there is nothing to separate. Flip a cell in either picture and the lists part company at that exact position.</p>
            </> : <>
              <p className="font-display text-xl">Now the distinction survives.</p>
              <p className="mt-2 text-sm">The lists differ at {differences.length} of their {CELL_COUNT} positions{differences.length <= 6 ? ` — ${differences.map(index => index + 1).join(', ')}` : ''}. The same pictures that collided as one number now arrive as different data. That costs {CELL_COUNT} numbers instead of 1.</p>
              <p className="text-muted-foreground mt-2 text-sm">Each exact list belongs to just one of the {grouped(TOTAL_PICTURES)} possible grids, so this encoding threw no cell away.</p>
            </>
          )}
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-base"><strong>This is representation:</strong> choosing the numbers that stand in for the original thing. When two inputs arrive as the same numbers, nothing later can tell them apart — not a larger model and not more training.</p>

      {listed && <div className="mt-5">
        <h5 className="text-sm font-medium">Look up one position</h5>
        <p className="text-muted-foreground mt-1 text-xs">Choose a position in the list and the cell it came from is outlined in both pictures. Positions exist only in this encoding; the single number has none.</p>
        <div className="representation-strip mt-2">
          <div role="group" aria-label="Positions in the ordered list" className="representation-strip-row">
            {pixelList(pictures.a).map((value, index) => {
              const { row, column } = positionOf(index);
              const differs = pictures.a[index] !== pictures.b[index];
              return <button
                key={index}
                type="button"
                aria-pressed={position === index}
                aria-label={`Position ${index + 1}, row ${row}, column ${column}. Picture A ${describePixel(value)}, picture B ${describePixel(pictures.b[index])}.`}
                className="representation-position"
                onClick={() => setPosition(position === index ? null : index)}
              >
                <span aria-hidden className="representation-position-index">{index + 1}</span>
                <span aria-hidden className="font-mono">A {value}</span>
                <span aria-hidden className="font-mono">B {pictures.b[index]}</span>
                <span aria-hidden className="representation-position-mark">{differs ? '≠' : '='}</span>
              </button>;
            })}
          </div>
        </div>
        <p className="representation-readout mt-3 text-sm">{inspected
          ? `Position ${(position ?? 0) + 1} is row ${inspected.row}, column ${inspected.column}. Picture A has ${inspected.a} (${describePixel(inspected.a)}) there; picture B has ${inspected.b} (${describePixel(inspected.b)}).`
          : 'No position chosen yet. Every position in the list points at one cell, and always the same cell.'}</p>
      </div>}
    </div>

    <div className="border-border mt-6 border-t pt-5">
      <h4 className="font-display text-xl">3. Change the evidence</h4>
      <p className="text-muted-foreground mt-1 text-sm">Flip any square above, try another pair, or rearrange the same cells. The numbers update from the pictures you make.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SCENARIOS.map(candidate => <Button key={candidate.label} type="button" size="touch" variant={scenarioLabel === candidate.label ? 'default' : 'outline'} onClick={() => chooseScenario(candidate)}>{candidate.label}</Button>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['a', 'b'] as const).map(side => <Button key={side} type="button" variant="outline" size="touch" onClick={() => rotate(side)}><RotateCw aria-hidden />Turn {SIDE_NAME[side]} a quarter turn</Button>)}
      </div>
      {turn && <p className="representation-turn mt-3 text-sm">{turn.moved > 0
        ? `The same ${CELL_COUNT} cells moved to new places in ${SIDE_NAME[turn.side]}. Its average stayed ${formatBrightness(turn.brightness)}, while its ordered list changed at ${turn.moved} positions.`
        : `That picture looks the same after a quarter turn, so both encodings stayed the same too. Try a pattern that is not symmetrical.`}</p>}
    </div>

    <div className="border-border mt-6 border-t pt-5">
      <p className="font-display text-xl">If both pictures become the same number, what has the model lost?</p>
      <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Flipping cells here leaves every mark on your map unchanged; only your own explanation can move this idea.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
    </div>

    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this model leaves out</summary>
      <div className="space-y-2 pt-2">
        <p>Sixteen cells, and only two brightness levels. A real photograph has millions of pixels and many levels per pixel, usually across three colour channels.</p>
        <p>Average brightness is a deliberately crude encoding, chosen because the collision is easy to see in one number. Real image models are not handed an average; they usually start from the per-pixel values and derive features from those. Language models do not use pixel grids at all — text is turned into token ids and then into learned vectors.</p>
        <p>So this is not a claim about how any particular model encodes its input. The part that carries over is the shape of the problem: something has to choose the numbers, that choice decides what is distinguishable, and no later stage can recover what it left out.</p>
        <p>Nothing here recognises or classifies anything. The panel compares two encodings and counts; there is no model in it.</p>
      </div>
    </details>
  </section>;
}
