'use client';

import { useCallback, useReducer } from 'react';
import { ArrowRight, Check, CircleAlert, FileQuestion, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  applyHallucinationAction,
  descriptionAt,
  initialHallucinationDemo,
  type ClaimCheck,
} from '@/lib/experiments/hallucination';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useHallucinationExperiment> };

/** Kept at workspace level so a trip to another view does not reset the example. */
export function useHallucinationExperiment() {
  const [state, dispatch] = useReducer(applyHallucinationAction, undefined, initialHallucinationDemo);
  const check = useCallback(() => dispatch({ kind: 'check' }), []);
  const next = useCallback(() => dispatch({ kind: 'next' }), []);
  const reset = useCallback(() => dispatch({ kind: 'reset' }), []);
  return { state, check, next, reset };
}

function Result({ result }: { result: ClaimCheck }) {
  const status = result.status === 'supported'
    ? { icon: Check, label: 'Supported by this record' }
    : result.status === 'contradicted'
      ? { icon: CircleAlert, label: 'Does not match this record' }
      : { icon: FileQuestion, label: 'Not found in these records' };
  const Icon = status.icon;

  return <div className="hallucination-result">
    <p className="hallucination-result-status"><Icon size={17} aria-hidden />{status.label}</p>
    {result.status === 'not-found' ? <>
      <p className="mt-2 text-sm"><strong>Sentence claim:</strong> {result.claimedYear}</p>
      <p className="mt-2 text-sm">Not found in these records. That means this tiny catalogue has no evidence for the claim. It does not prove the claim is false.</p>
    </> : <>
      <dl className="hallucination-compare mt-3">
        <div><dt>Sentence says</dt><dd>{result.claimedYear}</dd></div>
        <div><dt>Museum record says</dt><dd>{result.recordedYear}</dd></div>
      </dl>
      <p className="text-muted-foreground mt-2 text-xs">Invented record: {result.record.note}</p>
      <p className="mt-3 text-sm">{result.status === 'supported'
        ? 'The sentence sounds ordinary, and its year matches this record.'
        : 'The sentence sounds ordinary, but its year does not match this record.'}</p>
    </>}
  </div>;
}

/** Prepared local rules only: no API call and no learner-model access. */
export function HallucinationExperiment({ onExplain, experiment }: Props) {
  const { state, check, next, reset } = experiment;
  const description = descriptionAt(state.recipeIndex);
  const touched = state.recipeIndex !== 0 || state.check !== null;

  return <section className="hallucination-lab" aria-labelledby="hallucination-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">An invented museum · a small demonstration</p>
        <h3 id="hallucination-lab-title" tabIndex={-1} className="font-display mt-2 text-xl outline-none sm:text-3xl">Does sounding right mean the detail was checked?</h3>
      </div>
      {touched && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>
    <p className="mt-3 max-w-2xl text-base">Read the description, then check its year against the museum record.</p>

    <div className="hallucination-stage mt-5">
      <div className="hallucination-sentence">
        <p className="eyebrow">Made-up description</p>
        <p className="text-muted-foreground mt-1 text-xs">Prepared names, years, and wording. No live AI.</p>
        <p className="font-display mt-3 text-xl leading-snug sm:text-2xl">
          {description.beforeYear}<mark className="hallucination-claim">{description.claimedYear}</mark>{description.afterYear}
        </p>
        <Button size="touch" className="mt-3 h-auto max-w-full py-2 text-left whitespace-normal" onClick={check} disabled={state.check !== null}>Check the museum record <ArrowRight aria-hidden /></Button>
      </div>

      <div className="hallucination-check">
        <p className="eyebrow">After checking</p>
        <div className="mt-2" aria-live="polite" aria-atomic="true">
          {state.check ? <Result result={state.check} /> : <p className="text-muted-foreground text-sm">Nothing has been checked yet. Making the sentence and looking in the records are two separate steps.</p>}
        </div>
      </div>
    </div>

    {state.check && <>
      <div className="hallucination-conclusion mt-4">
        <p className="font-display text-xl">Plausible text is not the same thing as a checked fact.</p>
        <p className="mt-2 text-sm">Producing a smooth sentence does not by itself verify the year inside it. The same outwardly sure wording can sit beside a match, a mismatch, or a record that is missing.</p>
        <p className="text-muted-foreground mt-2 text-sm">A likely next piece can fit the sentence without matching the source.</p>
        <p className="text-muted-foreground mt-2 text-xs">This constructed example isolates the missing check. It is not a complete language model and it does not measure a real hallucination rate.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="touch" onClick={next}>Try another description <ArrowRight aria-hidden /></Button>
        <p className="text-muted-foreground text-xs">The next sentence starts unchecked. The maker still does not look at the records.</p>
      </div>

      <div className="border-border mt-5 border-t pt-5">
        <p className="font-display text-xl">The sentence sounded just as sure before and after the record check. What did making it do, and what separate step checked it?</p>
        <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Making or checking descriptions leaves every mark on your map unchanged.</p>
        <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
      </div>
    </>}

    <details className="hallucination-details mt-5">
      <summary className="hallucination-summary">How it works</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>The sentence maker has four prepared exhibit names, four prepared years, and three prepared sentence patterns. One rule combines those pieces. It does not receive the museum records.</p>
        <p>Only <strong className="text-foreground">Check the museum record</strong> looks in the separate catalogue. It searches by the exhibit&rsquo;s stable ID, then compares the two years.</p>
        <p>One combination matches. Others mix a familiar name with a year that belongs nowhere in that exhibit&rsquo;s record. The wording stays equally smooth either way.</p>
        <p>Everything runs in your browser. No account, model, or outside source is used.</p>
      </div>
    </details>

    <details className="hallucination-details mt-2">
      <summary className="hallucination-summary">What this example leaves out</summary>
      <div className="text-muted-foreground space-y-2 pb-2 text-sm">
        <p>A language model is not a random word shuffler. This panel uses a much smaller prepared rule only to make the missing fact-check visible.</p>
        <p>Real systems can be trained further to improve factual accuracy and to acknowledge uncertainty. They can also use search, retrieval, and other tools to check sources. Fluent wording on its own is still not proof that any check happened.</p>
        <p>There is no confidence meter here because token likelihood is not a truth score. A model can produce a smooth true sentence or a smooth false one without an outward signal that tells them apart.</p>
        <p>“Not found in these records” means only that this tiny catalogue has no matching entry. It is missing evidence, not proof that the claim is false.</p>
      </div>
    </details>
  </section>;
}
