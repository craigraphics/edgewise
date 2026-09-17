'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogPanel } from '@/components/ui/dialog';
import type { Confirmation } from '@/lib/session/confirmations';

/**
 * Asks before something that cannot be undone.
 *
 * Focus is put on the safe choice explicitly, so a reflexive Enter keeps the
 * map. Left to the default it stayed on the menu item that opened the dialog. The
 * destructive button is the outlined one on purpose: this product reserves red
 * for nothing, and a loud "Clear" is the one styling that invites the press.
 */
export function Confirm({
  copy,
  onConfirm,
  onClose,
}: {
  copy: Confirmation;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPanel labelledBy="confirm-title" initialFocus={keep} className="w-full sm:max-w-md">
        <div className="space-y-4 p-6">
          <h2 id="confirm-title" className="font-display text-xl font-semibold">{copy.title}</h2>
          <div className="space-y-2">
            <p className="text-base leading-relaxed">{copy.body}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{copy.kept}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <DialogClose render={<Button ref={keep} size="touch">{copy.cancel}</Button>} />
            <Button
              size="touch"
              variant="outline"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {copy.confirm}
            </Button>
          </div>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
