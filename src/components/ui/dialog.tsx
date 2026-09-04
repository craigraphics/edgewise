'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

import { cn } from '@/lib/utils';

/**
 * The shared dialog surface.
 *
 * Both of this app's dialogs were `role="dialog" aria-modal="true"` on a plain
 * `div`. That tells a screen reader the rest of the page is inert while Tab
 * walks straight into it, and neither trapped focus, restored it on close, or
 * marked the background `aria-hidden`. That is a correctness bug rather than a
 * styling one, which is why it is fixed with a real primitive rather than more
 * attributes.
 *
 * Presentation is a bottom sheet on a phone and a centred card above it. A
 * centred card on a small screen puts its dismiss button in the middle of the
 * viewport, which is the hardest place on a phone for a thumb to reach.
 */

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogPanel({
  className,
  children,
  labelledBy,
}: {
  className?: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-100 bg-black/55 backdrop-blur-[2px] transition-opacity duration-[--dur-slow] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Popup
        aria-labelledby={labelledBy}
        className={cn(
          'bg-surface-1 border-border fixed z-100 flex flex-col overflow-hidden border shadow-2xl outline-none',
          // Phone: a sheet off the bottom edge, so the dismiss lands under a thumb.
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl',
          // Above that: a centred card.
          'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          'transition-[opacity,transform] duration-[--dur-slow] ease-[--ease]',
          'data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0',
          'data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0',
          'sm:data-[starting-style]:translate-y-[calc(-50%+0.75rem)] sm:data-[ending-style]:translate-y-[calc(-50%+0.5rem)]',
          className,
        )}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export const DialogClose = DialogPrimitive.Close;
