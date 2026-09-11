'use client';

import Link from 'next/link';

import { motion, useReducedMotion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { EFFECTS, type EffectId, type Effects } from './effects';

/**
 * The lab's control panel.
 *
 * One switch per effect, each with the sentence it is meant to be saying, so
 * the judgement being made is "is that true and is it worth it" rather than
 * "do I like it". Everything is toggleable individually because the interesting
 * failures are combinations: cascade and current together can read as busy
 * where either alone reads as alive.
 */

type Props = {
  effects: Effects;
  onToggle: (id: EffectId) => void;
  onAll: (on: boolean) => void;
  onReplay: () => void;
  onMark: () => void;
  onReset: () => void;
  markLabel: string;
  canMark: boolean;
};

export function LabControls({
  effects,
  onToggle,
  onAll,
  onReplay,
  onMark,
  onReset,
  markLabel,
  canMark,
}: Props) {
  const reduced = useReducedMotion();

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <header className="space-y-1">
        <Link href="/" className="mb-3 inline-flex min-h-10 items-center text-sm underline underline-offset-4">Back to Edgewise</Link>
        <h1 className="font-display text-xl font-medium">Motion lab</h1>
        <p className="eyebrow">Illustrative marks · not your map</p>
        <p className="text-muted-foreground text-sm">
          The same graph, the same states, the same layout — only the drawing differs. Each effect
          carries the claim it makes and the one thing allowed to fire it in the product. Turn one
          off and see whether the map lost anything it was using.
        </p>
      </header>

      {reduced ? (
        <p className="border-border/70 bg-surface-2 text-muted-foreground rounded-lg border p-3 text-xs">
          Your system asks for reduced motion, so every effect below is switched off at the CSS
          level. That is the behaviour under test as much as the animation is — turn the setting off
          to see them run.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onAll(true)}>
          All on
        </Button>
        <Button variant="outline" size="sm" onClick={() => onAll(false)}>
          All off
        </Button>
        <Button variant="outline" size="sm" onClick={onReplay}>
          Replay entrance
        </Button>
      </div>

      <ul className="space-y-1">
        {EFFECTS.map((effect) => (
          <li key={effect.id}>
            <button
              type="button"
              role="switch"
              aria-checked={effects[effect.id]}
              onClick={() => onToggle(effect.id)}
              className={cn(
                'group hover:bg-surface-2 focus-visible:ring-ring/60 w-full rounded-lg p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                effects[effect.id] ? 'bg-surface-2/60' : 'bg-transparent',
              )}
            >
              <span className="flex items-center gap-3">
                <Track on={effects[effect.id]} />
                <span className="text-sm font-medium">{effect.name}</span>
              </span>
              <span className="text-muted-foreground mt-1.5 block text-xs leading-relaxed">
                {effect.claim}
              </span>
              <span className="text-muted-foreground/80 mt-2 block text-2xs leading-relaxed">
                <span className="text-foreground/70 font-medium tracking-wide uppercase">Fires on </span>
                {effect.trigger}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="border-border/60 mt-auto space-y-3 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          Marking a node solid is what the unlock wave is drawn on — it is the only moment the map
          ever asserts something new.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onMark} disabled={!canMark}>
            {markLabel}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset marks
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The switch itself. The thumb slides with a layout animation rather than a
 *  transition, so it keeps its momentum if the switch is hammered. */
function Track({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
        on ? 'bg-foreground/85' : 'bg-foreground/15',
        on ? 'justify-end' : 'justify-start',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 620, damping: 34, mass: 0.6 }}
        className={cn('block size-4 rounded-full', on ? 'bg-background' : 'bg-foreground/45')}
      />
    </span>
  );
}
