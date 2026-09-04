import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * What a simplification costs, said at the time it is made.
 *
 * `simplificationCost` is the field this product is proudest of, and thirteen
 * of the twenty-three nodes declare one. A simplification labelled with its
 * cost is a ladder; unlabelled, it becomes a misconception the learner has to
 * be rescued from later — the rubber-sheet picture of gravity being the
 * canonical example of the unlabelled kind.
 *
 * So it is drawn as a real aside rather than as a slightly indented paragraph
 * behind a 2px grey rule, which is how a footnote looks and a footnote is
 * exactly what this is not. It carries its own surface and a hairline in the
 * node's band colour: enough to read as a deliberate second voice, not enough
 * to read as a warning. It must never look like an error — the thing it is
 * flagging is the explanation the learner has just been given, not something
 * they did.
 */
export function Caveat({
  title,
  band,
  children,
  className,
}: {
  title: string;
  /** Band id, so the tint agrees with the node this belongs to. */
  band: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn('bg-surface-2/60 relative overflow-hidden rounded-lg py-3 pr-4 pl-4.5', className)}
      style={{ '--caveat': `var(--band-${band})` } as React.CSSProperties}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2.5px] rounded-full"
        style={{ background: 'var(--caveat)', opacity: 0.6 }}
      />
      <p className="text-2xs font-medium uppercase" style={{ color: 'var(--caveat)' }}>
        {title}
      </p>
      {/* Italic display face: a different voice, plainly, without a colour that
          would read as an alert. */}
      <p className="font-display text-read mt-1.5 italic">{children}</p>
    </aside>
  );
}
