'use client';

import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  /** The microphone is open, or the tutor is reading a turn out loud. */
  active: boolean;
  /** 0–1 from `useMicLevel`. Stays at 0 while the tutor is the one talking. */
  level: number;
  className?: string;
  children: ReactNode;
};

/**
 * A gradient glow off the edges of the conversation panel while voice is in use.
 *
 * Voice here is hands-free: the tutor reads its turn, the microphone opens by
 * itself, and the answer is taken from a four-second pause. Nothing about that
 * is visible from the panel, so the two questions someone actually has — is it
 * listening, and can it hear me — had only a "Listening…" label to answer them.
 * A ring that swells with your own voice answers the second one continuously,
 * which is the one a label cannot do.
 *
 * Everything animates in CSS off a single `--halo-level` custom property, so a
 * new level is one inline style rather than a React-driven animation. The
 * property is registered in `globals.css`, which is what lets it interpolate
 * between the 15Hz samples instead of stepping.
 */
export function VoiceHalo({ active, level, className, children }: Props) {
  return (
    <div
      // Deliberately NOT positioned: the aura inside resolves against the
      // panel that wraps this, so the light comes off the panel's own edge
      // rather than off an invisible box in the middle of it.
      className={cn('edgewise-halo', className)}
      style={{ '--halo-level': active ? level.toFixed(3) : '0' } as CSSProperties}
    >
      {children}

      <div className="edgewise-halo-aura" data-active={active} aria-hidden>
        <div className="edgewise-halo-breathe">
          <div className="edgewise-halo-glow" />
          <div className="edgewise-halo-ring" />
        </div>
      </div>
    </div>
  );
}
