'use client';

import { Dialog, DialogPanel } from '@/components/ui/dialog';
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
 *
 * It is a real `Dialog` now. The previous version was a `div` wearing
 * `aria-modal="true"`, which announces the page as inert to a screen reader
 * while leaving Tab free to walk into it. The focus management that used to be
 * hand-rolled here — including the `preventScroll` fix, which existed because
 * focusing the dismiss button scrolled a long panel to its last line and opened
 * the dialog with its title off screen — is the primitive's job now.
 */

const KEY = 'edgewise.welcome.v1';

export function Welcome() {
  const hydrated = useHydrated();
  const seen = usePersisted(KEY);

  // Nothing renders until storage has been read, so it cannot flash on a return visit.
  if (!hydrated || seen) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && writePersisted(KEY, 'seen')}>
      <DialogPanel labelledBy="welcome-title" className="w-full sm:max-w-xl">
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          {/*
           * The argument, made in a picture before it is made in words: three
           * ideas, each resting on the one before, and the one you are missing
           * is the one holding up the rest. Built from the map's own node
           * language so it reads as a detail of the thing behind the dialog
           * rather than as stock illustration.
           */}
          <Premise />

          <h2 id="welcome-title" className="font-display mt-6 text-2xl font-semibold sm:text-3xl">
            You cannot ask a good question about something you do not understand yet
          </h2>

          <div className="mt-5 space-y-4">
            <p className="font-display text-read">
              That is the awkward part of teaching yourself something hard. The information is all out
              there — the problem is that you do not know what you are missing, so you cannot ask for it.
              Chat assistants answer whatever you put to them, which makes them least useful at exactly the
              moment you are most stuck.
            </p>

            <p className="font-display text-read">
              So this does not start by explaining. It starts by working out{' '}
              <em className="not-italic underline decoration-[1.5px] underline-offset-4">
                where your understanding actually stops
              </em>{' '}
              — and then shows you the shape of what is above and below that line.
            </p>

            <p className="text-muted-foreground bg-surface-2/60 rounded-lg px-4 py-3 text-base leading-relaxed">
              The subject is how AI actually works — machine learning, neural networks, language models,
              agents. Twenty-three ideas, each resting on the ones before it. No maths, no code.
            </p>
          </div>

          <h3 className="text-muted-foreground mt-8 text-2xs font-medium uppercase">How it goes</h3>
          <ol className="mt-3 space-y-3.5">
            {[
              [
                'Find my starting point.',
                'A few questions, spoken or typed. Two minutes. Nothing is scored, and “I don’t know” is genuinely the most useful answer you can give — it is information, not a wrong answer.',
              ],
              [
                'The map fills in.',
                'Solid, half-held, not yet. The useful part is seeing how much sits on top of the one idea in your way.',
              ],
              [
                'Teach me everything.',
                'It goes through all twenty-three, whatever you already knew. Turn on Read it to me and it works through them on its own while you listen.',
              ],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="border-border text-muted-foreground tabular mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs">
                  {index + 1}
                </span>
                <span className="text-base leading-relaxed">
                  <span className="font-medium">{title}</span>{' '}
                  <span className="text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ol>

          <h3 className="text-muted-foreground mt-8 text-2xs font-medium uppercase">Worth knowing</h3>
          <ul className="text-muted-foreground mt-3 space-y-2.5 text-base leading-relaxed">
            <li>
              <span className="text-foreground font-medium">Being taught something does not tick it off.</span>{' '}
              To move an idea to solid you have to explain it back in your own words — clumsy everyday
              language is fine, and beats the right terminology.
            </li>
            <li>
              <span className="text-foreground font-medium">Ask for it simpler as often as you like.</span> It
              is the most useful button here, not an admission of anything.
            </li>
            <li>
              <span className="text-foreground font-medium">Click any box on the map</span> to read about it,
              at any time.
            </li>
            <li>Your progress stays in this browser. Nothing is sent anywhere or kept by us.</li>
          </ul>
        </div>

        {/* Pinned, so the way out is reachable without reading to the bottom
            first — which on a phone is four screens down. */}
        <div className="border-border bg-surface-1 flex shrink-0 justify-end border-t px-6 py-4 sm:px-8">
          <Button size="touch" onClick={() => writePersisted(KEY, 'seen')}>
            Let&rsquo;s go
          </Button>
        </div>
      </DialogPanel>
    </Dialog>
  );
}

/**
 * Three nodes and two edges, in the map's own vocabulary.
 *
 * The middle one is `blocked` — an open ring, drawn as waiting — and the one
 * below it is greyed, because that is the whole claim: the thing under you is
 * what is holding up the thing above.
 */
function Premise() {
  return (
    <svg
      viewBox="0 0 220 104"
      className="h-[104px] w-full max-w-[220px]"
      role="img"
      aria-label="Three ideas, each resting on the one before it. The middle one is not yet held, so the one above it is out of reach."
    >
      {/* The edges run BETWEEN the cards, not through them: 24px card, 16px gap. */}
      <g fill="none" strokeLinecap="round">
        <path d="M92 24 L 92 40" className="stroke-foreground/40" strokeWidth={1.6} />
        <path d="M92 64 L 92 80" className="stroke-foreground/12" strokeWidth={1.2} />
      </g>

      {[
        { y: 0, band: 'foundations', state: 'known' as const, label: 'you have this' },
        { y: 40, band: 'networks', state: 'blocked' as const, label: 'this one is missing' },
        { y: 80, band: 'language', state: 'unexplored' as const, label: 'out of reach' },
      ].map((row) => (
        <g key={row.band} transform={`translate(12, ${row.y})`}>
          <rect
            width={160}
            height={24}
            rx={7}
            className="fill-surface-2 stroke-border"
            strokeWidth={1}
          />
          {row.state === 'known' ? (
            <rect
              width={160}
              height={24}
              rx={7}
              fill={`var(--band-${row.band})`}
              fillOpacity={0.14}
            />
          ) : null}
          <path
            d={`M 0 7 A 7 7 0 0 1 7 0 L 3 0 L 3 24 L 7 24 A 7 7 0 0 1 0 17 Z`}
            fill={`var(--band-${row.band})`}
            fillOpacity={row.state === 'known' ? 1 : row.state === 'blocked' ? 0.55 : 0.3}
          />
          {row.state === 'known' ? (
            <circle cx={16} cy={12} r={3.5} fill={`var(--band-${row.band})`} />
          ) : row.state === 'blocked' ? (
            <circle
              cx={16}
              cy={12}
              r={3.5}
              fill="none"
              stroke={`var(--band-${row.band})`}
              strokeWidth={1.4}
            />
          ) : (
            <circle cx={16} cy={12} r={1.6} className="fill-muted-foreground" fillOpacity={0.7} />
          )}
          <text
            x={28}
            y={12}
            dominantBaseline="central"
            className={row.state === 'unexplored' ? 'fill-muted-foreground' : 'fill-foreground'}
            style={{ fontSize: 10 }}
          >
            {row.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
