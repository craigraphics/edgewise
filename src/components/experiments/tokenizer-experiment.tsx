'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  clipTokenizerText,
  isLatestTokenization,
  MAX_TOKENIZER_CHARACTERS,
  TOKENIZER_ENCODING,
  TOKENIZER_EXAMPLES,
  TOKENIZER_LIBRARY,
  type TokenPiece,
  type TokenizeRequest,
  type TokenizeResponse,
} from '@/lib/experiments/tokenizer';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useTokenizerExperiment> };
const INITIAL_TEXT = TOKENIZER_EXAMPLES[0].text;

/** Kept at workspace level so changing map views never resets the text or selection. */
export function useTokenizerExperiment() {
  const [text, setTextState] = useState<string>(INITIAL_TEXT);
  const [tokens, setTokens] = useState<TokenPiece[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [workerGeneration, setWorkerGeneration] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const latestRequest = useRef(1);

  /**
   * The worker is built on first use rather than in an effect body, so a browser
   * that cannot start it reports through the same asynchronous path as a worker
   * that fails later. Every failure here is stated; none is filled in with a
   * guessed count.
   */
  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL('../../lib/experiments/tokenizer.worker.ts', import.meta.url));
    worker.onmessage = ({ data }: MessageEvent<TokenizeResponse>) => {
      if (!isLatestTokenization(data.requestId, latestRequest.current)) return;
      if ('error' in data) {
        setStatus('error');
        setError(data.error);
        return;
      }
      setTokens(data.tokens);
      setSelectedIndex(previous => previous !== null && previous < data.tokens.length ? previous : data.tokens.length ? 0 : null);
      setStatus('ready');
      setError(null);
    };
    worker.onerror = event => {
      event.preventDefault();
      setStatus('error');
      setError('The local tokenizer could not load. Nothing was sent anywhere.');
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, [workerGeneration]);

  useEffect(() => {
    if (!text) return;
    const request: TokenizeRequest = { requestId: latestRequest.current, text };
    const timer = window.setTimeout(() => {
      try {
        ensureWorker().postMessage(request);
      } catch {
        setStatus('error');
        setError('The local tokenizer could not start in this browser.');
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [text, workerGeneration, ensureWorker]);

  const setText = useCallback((value: string) => {
    const clipped = clipTokenizerText(value);
    latestRequest.current += 1;
    setTextState(clipped.text);
    setLimitHit(clipped.clipped);
    setSelectedIndex(null);
    setError(null);
    if (clipped.text) {
      setStatus('loading');
    } else {
      setTokens([]);
      setStatus('ready');
    }
  }, []);

  const retry = useCallback(() => {
    latestRequest.current += 1;
    setStatus(text ? 'loading' : 'ready');
    setError(null);
    setWorkerGeneration(generation => generation + 1);
  }, [text]);

  const reset = useCallback(() => setText(INITIAL_TEXT), [setText]);
  return { text, tokens, selectedIndex, status, error, limitHit, setText, setSelectedIndex, retry, reset };
}

/** Local tokenization only: this component deliberately has no learner-model access. */
export function TokenizerExperiment({ onExplain, experiment }: Props) {
  const { text, tokens, selectedIndex, status, error, limitHit, setText, setSelectedIndex, retry, reset } = experiment;
  const selected = selectedIndex === null ? null : tokens[selectedIndex] ?? null;

  return <section className="tokenizer-lab" aria-labelledby="tokenizer-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A playable idea · live in your browser</p>
        <h3 id="tokenizer-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">See the pieces the model gets.</h3>
      </div>
      <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>
    </div>
    <p className="mt-3 max-w-2xl text-base">Change the text. Its actual token pieces and IDs update below; spaces and line breaks get visible marks so they cannot hide inside a piece.</p>

    <div className="tokenizer-engine mt-5">
      <p className="text-sm font-medium">Using <code>{TOKENIZER_ENCODING}</code> from {TOKENIZER_LIBRARY}</p>
      <p className="text-muted-foreground mt-1 text-xs">This is one real OpenAI encoding, not a universal token count and not the Gemini tokenizer Edgewise uses for assessment. It runs locally; your text is not transmitted.</p>
    </div>

    <div className="mt-5">
      <p className="text-sm font-medium">Try an editable example</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {/* `touch`, not `sm`: these are finger targets on a phone, where `sm` measured 28px. */}
        {TOKENIZER_EXAMPLES.map(example => <Button key={example.label} type="button" size="touch" variant={text === example.text ? 'default' : 'outline'} onClick={() => setText(example.text)}>{example.label}</Button>)}
      </div>
    </div>

    <div className="mt-4">
      <label htmlFor="tokenizer-text" className="text-sm font-medium">Text to tokenize</label>
      <Textarea
        id="tokenizer-text"
        value={text}
        maxLength={MAX_TOKENIZER_CHARACTERS}
        onChange={event => setText(event.target.value)}
        rows={5}
        spellCheck={false}
        className="bg-surface-0 mt-2 resize-y font-mono text-sm"
      />
      <div className="text-muted-foreground mt-1 flex flex-wrap justify-between gap-2 text-xs">
        <span>{text.length.toLocaleString()} / {MAX_TOKENIZER_CHARACTERS.toLocaleString()} characters</span>
        <span>No start, end, or other special tokens are added.</span>
      </div>
      {limitHit && <p role="alert" className="mt-2 text-sm">That reached the {MAX_TOKENIZER_CHARACTERS.toLocaleString()}-character local limit. The rest was not added.</p>}
    </div>

    <div className="mt-5" aria-busy={status === 'loading'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-xl">Token pieces</h4>
        <p role="status" aria-live="polite" className="font-mono text-sm tabular-nums">
          {status === 'loading' ? 'Tokenizing…' : status === 'error' ? 'Tokenizer unavailable' : `${tokens.length} ordinary text ${tokens.length === 1 ? 'token' : 'tokens'}`}
        </p>
      </div>

      {error ? <div role="alert" className="tokenizer-error mt-3">
        <p className="text-sm">{error}</p>
        <Button className="mt-3" size="touch" variant="outline" onClick={retry}>Retry local tokenizer</Button>
      </div> : status === 'ready' && tokens.length === 0 ? <p className="text-muted-foreground mt-3 text-sm">Empty text has zero ordinary text tokens.</p> : (
        <ol className="tokenizer-pieces mt-3" aria-label="Token pieces and IDs">
          {tokens.map((token, index) => <li key={`${index}-${token.id}`}>
            <button
              type="button"
              aria-pressed={selectedIndex === index}
              aria-label={`Token ${index + 1}: ${token.display}; ID ${token.id}`}
              onClick={() => setSelectedIndex(index)}
              onFocus={() => setSelectedIndex(index)}
              className={cn('tokenizer-piece', selectedIndex === index && 'tokenizer-piece-selected')}
            >
              <span className={cn('block font-mono text-sm', token.text === null && 'text-xs')}>{token.display || '∅'}</span>
              <span className="text-muted-foreground mt-1 block font-mono text-2xs">ID {token.id}</span>
            </button>
          </li>)}
        </ol>
      )}
    </div>

    {selected && <div className="tokenizer-connection mt-4" aria-live="polite">
      <p className="eyebrow">Piece → vocabulary ID</p>
      <p className="mt-2 text-sm"><strong className="font-mono">{selected.display || '∅'}</strong> is identified by <strong className="font-mono">{selected.id}</strong>. The ID is only a lookup key; a larger number does not mean a bigger or more important meaning.</p>
      {selected.text === null && <p className="text-muted-foreground mt-2 text-xs">This token holds only part of a UTF-8 character, so it is shown as exact bytes instead of a corrupted replacement symbol. Its neighbouring token IDs remain separate and their bytes join back into the original text.</p>}
    </div>}

    {status === 'ready' && tokens.length > 0 && <div className="mt-5 border-t border-border pt-5">
      <p className="font-display text-xl">Why can the number of tokens differ from the number of words?</p>
      <p className="text-muted-foreground mt-2 text-sm">If you want, explain the mechanism in your own words. Trying the playground itself leaves every mark unchanged.</p>
      <Button className="mt-3" size="touch" onClick={onExplain}>Explain what you noticed <ArrowRight aria-hidden /></Button>
    </div>}

    <details className="text-muted-foreground mt-5 text-sm">
      <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-4">What this playground leaves out</summary>
      <p className="pt-2">Different model families can use different vocabularies and boundaries. This playground encodes plain text with <code>{TOKENIZER_ENCODING}</code>; strings that look like special markers are treated as ordinary text, and it adds no chat-message framing or invisible special tokens.</p>
    </details>
  </section>;
}
