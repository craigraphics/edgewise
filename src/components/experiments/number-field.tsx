'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A number field that can genuinely be empty, so a half-typed row is never
 * guessed at: clearing it yields `null` rather than snapping to zero and
 * silently adding an observation nobody made.
 *
 * `h-10` is load-bearing. The shared `Input` primitive is 32px, below the 40px
 * finger target this project records, and that was measured at 320px rather than
 * reasoned about. Shared by the predictor and the two-phase experiment so the
 * measurement lives in one place.
 */
export function NumberField({ id, label, name, unit, value, max, step = 0.5, className, onChange }: {
  id: string;
  label: string;
  /** The accessible name, which says which row this is. The visible label cannot. */
  name: string;
  unit: string;
  value: number | null;
  max: number;
  step?: number;
  className?: string;
  onChange: (value: number | null) => void;
}) {
  return <span className={cn('min-w-0 flex-1', className)}>
    <label htmlFor={id} className="text-muted-foreground block text-2xs">{label}</label>
    <span className="mt-1 flex items-center gap-1.5">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        aria-label={name}
        min={0}
        max={max}
        step={step}
        value={value === null ? '' : String(value)}
        onChange={event => {
          const raw = event.target.value;
          if (raw === '') return onChange(null);
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : null);
        }}
        className="h-10 font-mono tabular-nums"
      />
      <span aria-hidden className="text-muted-foreground text-xs">{unit}</span>
    </span>
  </span>;
}
