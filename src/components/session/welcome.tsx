'use client';

import { useCallback, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useHydrated, usePersisted, writePersisted } from '@/lib/persisted';

/**
 * Shown once, on a first visit.
 *
 * Everything else here is designed to explain itself in place, but the *premise*
 * cannot be — why a map of what you do not know is worth having at all is an
 * argument, not a label, and there is nowhere in the running interface to make
 * it without getting in the way every time afterwards.
 *
 * Dismissal is persisted rather than kept in memory: a modal that returns on
 * every reload is worse than no modal.
 */

const KEY = 'edgewise.welcome.v1';

export function Welcome() {
  const hydrated = useHydrated();
  const seen = usePersisted(KEY);
  const dismissRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => writePersisted(KEY, 'seen'), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  useEffect(() => {
    // preventScroll matters: focusing the button at the end of a long panel
    // scrolls it into view, so the dialog opened at its last line with the
    // title off screen.
    if (hydrated && !seen) dismissRef.current?.focus({ preventScroll: true });
  }, [hydrated, seen]);

  // Nothing renders until storage has been read, so it cannot flash on a return visit.
  if (!hydrated || seen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className="fixed inset-0 z-100 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="bg-background border-border max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-xl border p-6 shadow-2xl sm:p-8">
        <h2 id="welcome-title" className="text-2xl font-semibold tracking-tight">
          You cannot ask a good question about something you do not understand yet
        </h2>

        <div className="mt-5 space-y-4 text-sm leading-relaxed">
          <p>
            That is the awkward part of teaching yourself something hard. The information is all out there — the
            problem is that you do not know what you are missing, so you cannot ask for it. Chat assistants answer
            whatever you put to them, which makes them least useful at exactly the moment you are most stuck.
          </p>

          <p>
            So this does not start by explaining. It starts by working out{' '}
            <span className="text-foreground font-medium">where your understanding actually stops</span> — and then
            shows you the shape of what is above and below that line.
          </p>

          <div className="border-foreground/15 border-l-2 pl-4">
            <p className="text-muted-foreground">
              The subject is how AI actually works — machine learning, neural networks, language models, agents.
              Twenty-three ideas, each resting on the ones before it. No maths, no code.
            </p>
          </div>
        </div>

        <h3 className="mt-7 text-sm font-semibold tracking-wide uppercase">How it goes</h3>
        <ol className="mt-3 space-y-3 text-sm leading-relaxed">
          <li className="flex gap-3">
            <span className="text-muted-foreground shrink-0 tabular-nums">1.</span>
            <span>
              <span className="font-medium">Find my starting point.</span> A few questions, spoken or typed. Two
              minutes. Nothing is scored, and &ldquo;I don&rsquo;t know&rdquo; is genuinely the most useful answer
              you can give — it is information, not a wrong answer.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground shrink-0 tabular-nums">2.</span>
            <span>
              <span className="font-medium">The map fills in.</span> Solid, half-held, not yet. The useful part is
              seeing how much sits on top of the one idea in your way.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground shrink-0 tabular-nums">3.</span>
            <span>
              <span className="font-medium">Teach me everything.</span> It goes through all twenty-three, whatever
              you already knew. Turn on <span className="font-medium">Read it to me</span> and it works through
              them on its own while you listen.
            </span>
          </li>
        </ol>

        <h3 className="mt-7 text-sm font-semibold tracking-wide uppercase">Worth knowing</h3>
        <ul className="text-muted-foreground mt-3 space-y-2 text-sm leading-relaxed">
          <li>
            <span className="text-foreground">Being taught something does not tick it off.</span> To move an idea to
            solid you have to explain it back in your own words — clumsy everyday language is fine, and beats the
            right terminology.
          </li>
          <li>
            <span className="text-foreground">Ask for it simpler as often as you like.</span> It is the most useful
            button here, not an admission of anything.
          </li>
          <li>
            <span className="text-foreground">Click any box on the map</span> to read about it, at any time.
          </li>
          <li>Your progress stays in this browser. Nothing is sent anywhere or kept by us.</li>
        </ul>

        <div className="mt-8 flex justify-end">
          <Button ref={dismissRef} size="touch" onClick={dismiss}>
            Let&rsquo;s go
          </Button>
        </div>
      </div>
    </div>
  );
}
