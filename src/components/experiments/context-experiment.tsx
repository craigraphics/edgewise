'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  addBeforeQuestion,
  ALLOWANCE,
  answerFrom,
  buildRequest,
  countsFrom,
  hasCode,
  INSTRUCTION,
  LONG_MESSAGE,
  newlyDropped,
  NOTES,
  OPENING_CHAT,
  remainingNotes,
  REPLY_RESERVE,
  RESEND,
  TEXTS_TO_COUNT,
  withoutMessage,
  type Counts,
  type Message,
  type Request,
} from '@/lib/experiments/context';
import type { CountRequest, CountResponse } from '@/lib/experiments/context.worker';
import { TOKENIZER_ENCODING, TOKENIZER_LIBRARY } from '@/lib/experiments/tokenizer';
import { cn } from '@/lib/utils';

type Props = { onExplain: () => void; experiment: ReturnType<typeof useContextExperiment> };

type Action = 'note' | 'resend' | 'long' | 'shorten';

/**
 * Kept at workspace level so following a link to another idea and coming back
 * never resets the conversation, the counts, or what was last done.
 */
export function useContextExperiment() {
  const [chat, setChat] = useState<readonly Message[]>(OPENING_CHAT);
  /** The conversation as it was immediately before the last action, for the before/after. */
  const [previousChat, setPreviousChat] = useState<readonly Message[] | null>(null);
  const [lastAction, setLastAction] = useState<Action | null>(null);
  /** True once anything has ever been left out, which is when the name is earned. */
  const [everDropped, setEverDropped] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [workerGeneration, setWorkerGeneration] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const latestRequest = useRef(1);

  /*
   * Built on first use inside the timeout rather than in the effect body, so a
   * browser that cannot start it reports through the same asynchronous path as
   * one that fails later. There is no fallback count: a made-up number is
   * exactly the thing this panel exists to correct.
   */
  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL('../../lib/experiments/context.worker.ts', import.meta.url));
    worker.onmessage = ({ data }: MessageEvent<CountResponse>) => {
      if (data.requestId !== latestRequest.current) return;
      if ('error' in data) { setCountError(data.error); return; }
      setCounts(countsFrom(data.counts));
      setCountError(null);
    };
    worker.onerror = event => {
      event.preventDefault();
      setCountError('The local token counter could not load. Nothing was sent anywhere.');
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, [workerGeneration]);

  useEffect(() => {
    const request: CountRequest = { requestId: latestRequest.current, texts: [...TEXTS_TO_COUNT] };
    const timer = window.setTimeout(() => {
      try { ensureWorker().postMessage(request); }
      catch { setCountError('The local token counter could not start in this browser.'); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [workerGeneration, ensureWorker]);

  /*
   * The before/after, and the one flag that unlocks the name, are worked out
   * here rather than in an effect watching the render. `react-hooks/
   * set-state-in-effect` would reject the effect version, and it is right about
   * the design: whether a message was left out is a consequence of this action,
   * which is known at the moment it is taken.
   */
  const apply = useCallback((action: Action, next: (current: readonly Message[]) => readonly Message[]) => {
    const updated = next(chat);
    setPreviousChat(chat);
    setChat(updated);
    setLastAction(action);
    if (counts && newlyDropped(buildRequest(chat, counts), buildRequest(updated, counts)).length > 0) setEverDropped(true);
  }, [chat, counts]);

  const addNote = useCallback(() => {
    apply('note', current => {
      const next = remainingNotes(current)[0];
      return next ? addBeforeQuestion(current, next) : current;
    });
  }, [apply]);

  const includeCodeAgain = useCallback(() => apply('resend', current => addBeforeQuestion(current, RESEND)), [apply]);
  const addLong = useCallback(() => apply('long', current => addBeforeQuestion(current, LONG_MESSAGE)), [apply]);
  const removeLong = useCallback(() => apply('shorten', current => withoutMessage(current, LONG_MESSAGE.id)), [apply]);

  const retry = useCallback(() => {
    latestRequest.current += 1;
    setCountError(null);
    setCounts(null);
    setWorkerGeneration(generation => generation + 1);
  }, []);

  const reset = useCallback(() => {
    setChat(OPENING_CHAT);
    setPreviousChat(null);
    setLastAction(null);
    setEverDropped(false);
  }, []);

  return { chat, previousChat, lastAction, everDropped, counts, countError, addNote, includeCodeAgain, addLong, removeLong, retry, reset };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
/** Small numbers read as words in a sentence, and as digits in the columns. */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const spell = (n: number) => WORDS[n] ?? String(n);
const list = (items: readonly string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The stacked bar. Decoration: every figure in it is printed as text beside it. */
function Meter({ request }: { request: Request }) {
  const part = (tokens: number) => `${(tokens / request.allowance) * 100}%`;
  return <div className="context-meter" aria-hidden>
    <span className="context-meter-instruction" style={{ width: part(request.instructionTokens) }} />
    <span className="context-meter-messages" style={{ width: part(request.messageTokens) }} />
    <span className="context-meter-reserve" style={{ width: part(request.reserve) }} />
  </div>;
}

/** Local counting only: this component deliberately has no learner-model access. */
export function ContextExperiment({ onExplain, experiment }: Props) {
  const { chat, previousChat, lastAction, everDropped, counts, countError, addNote, includeCodeAgain, addLong, removeLong, retry, reset } = experiment;

  const request = counts ? buildRequest(chat, counts) : null;
  const previous = counts && previousChat ? buildRequest(previousChat, counts) : null;
  const dropped = request && previous ? newlyDropped(previous, request) : [];
  const answer = request ? answerFrom(request.included) : null;
  const codeIsIn = request ? hasCode(request) : false;
  const waiting = remainingNotes(chat);
  const longIsIn = chat.some(message => message.id === LONG_MESSAGE.id);
  const includedIds = new Set(request?.included.map(message => message.id) ?? []);

  const changed = (() => {
    if (!request || !previous || !lastAction) return null;
    const names = dropped.map(message => message.summary.toLowerCase());
    const lostTheCode = !codeIsIn && hasCode(previous);
    if (lastAction === 'resend') {
      return codeIsIn
        ? 'The code is back among the newest messages, so it was sent this time. Nothing was trained and nothing was remembered: the same rule found the code again because the text was in front of it.'
        : 'The code went back into the conversation, but there is still not enough room to send it.';
    }
    if (lastAction === 'long') {
      const long = request.placements.find(placement => placement.message.id === LONG_MESSAGE.id);
      return `That one message is ${long?.tokens ?? 0} tokens by itself, and this request has room for ${request.capacity}. It cannot be sent even with everything else taken out, and nothing older than it can be sent while it is in the way.`;
    }
    if (lastAction === 'shorten') return 'The long message is out of the conversation, so there is room again.';
    if (dropped.length === 0) return `That note fitted. The request is now ${request.used} of ${request.allowance} tokens, and nothing had to be left out.`;
    // The code is named twice only when it was one of several, so a single
    // dropped message is not announced and then announced again.
    const alsoTheCode = lostTheCode && dropped.length > 1 ? ' The door code was one of them.' : '';
    return `Adding that note took the request over ${request.allowance} tokens, so the ${plural(dropped.length, 'oldest message was', `${spell(dropped.length)} oldest messages were`)} left out: ${list(names)}.${alsoTheCode} ${plural(dropped.length, 'It is', 'They are')} still in the chat above.`;
  })();

  return <section className="context-lab" aria-labelledby="context-lab-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">A small experiment · runs in your browser</p>
        <h3 id="context-lab-title" tabIndex={-1} className="font-display mt-2 text-2xl outline-none sm:text-3xl">If it is still in the chat, why can’t the model use it?</h3>
      </div>
      {/* Offered only once something has changed: a Reset on an untouched screen is a control with nothing to do. */}
      {lastAction && <button className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" onClick={reset}><RotateCcw size={14} aria-hidden />Reset experiment</button>}
    </div>
    <p className="mt-3 max-w-2xl text-base">Priya is planning a birthday party. Her first message has the door code, and you have just asked for it again.</p>
    <p className="text-muted-foreground mt-2 max-w-2xl text-sm">A small example of choosing what to send, not a live chatbot.</p>

    {countError ? <div role="alert" className="context-error mt-5">
      <p className="text-sm">{countError}</p>
      <p className="text-muted-foreground mt-1 text-xs">No count is guessed at here, so the experiment waits rather than showing a made-up number.</p>
      <Button className="mt-3" size="touch" variant="outline" onClick={retry}>Try the token counter again</Button>
    </div> : <>

      <div className="context-stage mt-5">
        <div className="context-chat-area">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-display text-xl">The chat on your screen</h4>
            <p className="text-muted-foreground text-xs">{chat.length} {plural(chat.length, 'message', 'messages')} · none ever removed</p>
          </div>
          <ol className="context-chat mt-2">
            {chat.map(message => {
              const included = includedIds.has(message.id);
              return <li key={message.id} className={cn('context-message', !request ? '' : included ? 'context-message-sent' : 'context-message-held')}>
                {/* Speaker inline with the text: a row of its own cost 30px a message and said nothing extra. */}
                <p className="context-message-text"><span className="context-message-who">{message.speaker}:</span> {message.text}</p>
                <p className="context-message-status">
                  {!request ? <span className="text-muted-foreground">measuring…</span> : <>
                    <span className={cn('context-chip', included ? 'context-chip-sent' : 'context-chip-held')}>
                      {included ? 'Sent this time' : 'Not sent this time'}
                    </span>
                    <span className="text-muted-foreground font-mono tabular-nums">{request.placements.find(placement => placement.message.id === message.id)?.tokens} tokens</span>
                  </>}
                </p>
              </li>;
            })}
          </ol>
        </div>

        <div className="context-action-area">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="touch" onClick={addNote} disabled={!request || waiting.length === 0}><Plus aria-hidden />Add more party notes</Button>
            {/* Hidden while the counts are still arriving, so it does not flash in disabled before the first frame is true. */}
            {request && !codeIsIn && <Button size="touch" variant="outline" onClick={includeCodeAgain}>Include the code again</Button>}
          </div>
          {waiting.length === 0 && <p className="text-muted-foreground mt-2 text-xs">All {spell(NOTES.length)} prepared notes are in the chat now.</p>}
          <div aria-live="polite" className="context-change mt-3">
            {changed ? <p className="text-sm">{changed}</p>
              : <p className="text-muted-foreground text-sm">Everything fits at the moment. Add a note and watch what the request has to leave behind.</p>}
          </div>
        </div>

        <div className="context-request-area">
          <div className="context-request">
            <p className="eyebrow">Included in this request</p>
            <p className="text-muted-foreground mt-2 text-xs">Text takes up tokens, and a request has room for only so many. A token is a piece of text, often a word or part of one.</p>
            {!request ? <p className="mt-3 text-sm" role="status">Counting the text…</p> : <>
              <ul className="context-lines mt-3">
                <li><span>Instructions for the assistant</span><span className="font-mono tabular-nums">{request.instructionTokens}</span></li>
                {request.included.map(message => <li key={message.id}>
                  <span>{message.summary}</span>
                  <span className="font-mono tabular-nums">{request.placements.find(placement => placement.message.id === message.id)?.tokens}</span>
                </li>)}
                <li className="context-line-reserve"><span>Room kept free for the reply</span><span className="font-mono tabular-nums">{request.reserve}</span></li>
              </ul>
              <Meter request={request} />
              <p className="mt-2 font-mono text-sm tabular-nums">{request.used} of {request.allowance} tokens used · {request.free} free</p>
              {request.included.length < chat.length && <p className="mt-2 text-sm">
                Left out this time: {list(request.placements.filter(placement => !placement.included).map(placement => placement.message.summary.toLowerCase()))}.
              </p>}
              <p className="text-muted-foreground mt-2 text-xs">When it will not all fit, this app removes the oldest whole messages until it does. A message is never cut in half.</p>
              {/*
                * Free tokens beside a list of things left out reads as a
                * contradiction, and it is not one: a message bigger than the
                * whole allowance blocks everything older than it, because this
                * app only ever removes from the oldest end. Said here rather
                * than left to be worked out.
                */}
              {request.placements.some(placement => placement.excluded === 'too-long-alone') && <p className="text-muted-foreground mt-2 text-xs">
                One message is bigger than the {request.capacity} tokens this request has room for, so it can never be sent. Everything older than it is held back with it, which is why room is left over.
              </p>}
            </>}
          </div>
        </div>
      </div>

      {request && answer && <div className="context-reply mt-4">
        <p className="eyebrow">The reply · a short scripted rule, not a model</p>
        <div aria-live="polite">
          <p className="font-display mt-2 text-xl">{answer.text}</p>
          {!codeIsIn && <p className="mt-2 text-sm">The code is not in the messages included this time.</p>}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">The rule reads the included messages and nothing else. It cannot see the chat above.</p>
      </div>}

      {everDropped && <div className="context-name mt-5">
        <p className="eyebrow">What just happened has a name</p>
        <p className="font-display mt-2 text-xl">The room in one request is called its context window.</p>
        <p className="mt-2 text-sm">It is measured in tokens, and everything has to fit inside it: the instructions, the part of the conversation that gets sent, and the reply. This one is {ALLOWANCE} tokens, so the change is visible on a screen. Real ones are far larger, and they still run out.</p>
        <ul className="context-points mt-3">
          <li><strong>Nothing was forgotten.</strong> The message was simply not sent. The chat you can see is kept by the app, not by the model, and the whole of it is re-sent from scratch every turn.</li>
          <li><strong>Other apps do other things.</strong> This one drops the oldest whole messages. A real service might refuse a request that is too big, shorten the older part into a summary, or keep its own notes and choose which to put back in.</li>
          <li><strong>Being sent is not the same as being used.</strong> Material in the middle of a long request tends to get used less reliably than material at either end, so more room does not mean everything in it counts equally.</li>
          <li><strong>What it learned in training is still there.</strong> That lives in the numbers saved inside the model and is not part of this request at all. What runs out here is room for the text of this conversation.</li>
        </ul>
      </div>}

      {everDropped && <div className="border-border mt-5 border-t pt-5">
        <p className="font-display text-xl">The door code stayed on screen the whole time, but one reply could not use it. What decides whether the model can use something you typed earlier?</p>
        <p className="text-muted-foreground mt-2 text-sm">Explain the mechanism in your own words if you want to. Trying this experiment leaves every mark on your map unchanged.</p>
        <Button className="mt-3" size="touch" onClick={onExplain}>Explain what happened <ArrowRight aria-hidden /></Button>
      </div>}

      <details className="context-details mt-5">
        <summary className="context-summary">Try another example</summary>
        <div className="text-muted-foreground space-y-3 pb-2 text-sm">
          <p>One message can be too big on its own. When that happens, dropping older messages does not help, because there was never room for it.</p>
          <Button size="touch" variant="outline" onClick={longIsIn ? removeLong : addLong} disabled={!request}>
            {longIsIn ? 'Take the very long message out' : 'Add a very long message'}
          </Button>
          {request && longIsIn && <p>It is in the chat above, marked as not sent. Everything older than it is held back too, because this app only ever removes from the oldest end.</p>}
        </div>
      </details>

      <details className="context-details mt-2">
        <summary className="context-summary">The exact text sent this time</summary>
        <div className="pb-2">
          {request && <pre className="context-transcript">{[INSTRUCTION, ...request.included.map(message => `${message.speaker}: ${message.text}`)].join('\n\n')}</pre>}
          <p className="text-muted-foreground mt-2 text-sm">That is all of it. Everything else in the conversation exists only on your screen.</p>
        </div>
      </details>

      <details className="context-details mt-2">
        <summary className="context-summary">How the counting works</summary>
        <div className="text-muted-foreground space-y-2 pb-2 text-sm">
          <p>Every number here is the real token count of the exact text above, using <code>{TOKENIZER_ENCODING}</code> from {TOKENIZER_LIBRARY}. It runs in your browser; no text is sent anywhere and no key is needed.</p>
          <p>The {ALLOWANCE}-token allowance and the {REPLY_RESERVE} tokens held back for the reply were chosen for this panel, after measuring the messages, so that adding one note visibly pushes the oldest message out. They are not any real model&rsquo;s limit.</p>
          <p>Real chat APIs also add a few tokens per message for things like who said it, and different model families count with different vocabularies. None of that is modelled here, so these totals are the text only and are not an exact bill for any provider.</p>
        </div>
      </details>

      <details className="context-details mt-2">
        <summary className="context-summary">What this example leaves out</summary>
        <div className="text-muted-foreground space-y-2 pb-2 text-sm">
          <p>The reply is a hand-written rule that looks for a door code and repeats it. It is here to show what a reply can and cannot reach, not to stand in for a model, and it never generates anything.</p>
          <p>Four different things are kept apart on purpose: the chat on your screen, which the app stores; the text sent this turn, which is the card above; the numbers saved inside the model, which training left there and which no message changes; and any notes an app keeps about you between conversations, which this example has none of.</p>
        </div>
      </details>
    </>}
  </section>;
}
