'use client';

import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

/**
 * The two things a visitor can do.
 *
 * They were two equal-weight buttons sitting side by side, so a first-time
 * visitor read them as two unrelated actions and had no way to tell which one
 * they were currently in. A segmented control says both things at once: these
 * are alternatives, and you are in this one.
 *
 * The indicator is a shared `layoutId`, so it slides between the two rather
 * than one background disappearing and another appearing. That movement is the
 * only thing that communicates "same control, different setting" — a crossfade
 * would read as two separate buttons again.
 *
 * The labels say what happens rather than naming a mode. "Session" and "Walk me
 * through it" sat here once and neither told anyone what it would do.
 */

export type Mode = 'session' | 'walk';

const OPTIONS: { id: Mode; label: string; short: string }[] = [
  { id: 'session', label: 'Find my starting point', short: 'Find my start' },
  { id: 'walk', label: 'Teach me everything', short: 'Teach me' },
];

export function ModeSwitch({
  value,
  onChange,
  className,
}: {
  value: Mode;
  onChange: (mode: Mode) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="What to do"
      className={cn(
        'bg-surface-2 border-border relative flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5',
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'relative h-10 flex-1 rounded-[7px] px-3 text-sm font-medium whitespace-nowrap transition-colors duration-[--dur] sm:flex-none',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active ? (
              <motion.span
                layoutId="mode-switch-indicator"
                className="bg-surface-0 border-border/70 absolute inset-0 rounded-[7px] border shadow-sm"
                // Critically damped: it arrives and stops. An overshoot here
                // would be the one piece of the interface that looks pleased
                // with itself.
                transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
              />
            ) : null}
            {/* The full label everywhere it fits. On a phone the switch has a
                row to itself, so both halves get their real names back. */}
            <span className="relative">
              <span className="hidden min-[400px]:inline">{option.label}</span>
              <span className="min-[400px]:hidden">{option.short}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
