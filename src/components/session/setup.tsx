'use client';

import { CheckIcon } from 'lucide-react';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogPanel } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MODELS, type ModelId } from '@/lib/models';
import type { SessionConfig } from '@/lib/session/config';
import { FREE_TURN_CAP } from '@/lib/session/limits';
import { cn } from '@/lib/utils';

type Props = {
  onClose: () => void;
  config: SessionConfig;
  onSave: (config: SessionConfig) => void;
  onForget: () => void;
};

/**
 * Key and model settings.
 *
 * A real `Dialog`, and — importantly — rendered OUTSIDE the tools menu.
 *
 * Two bugs live here, both already paid for. It first expanded in place inside
 * a 224px dropdown at 320px wide, so it spilled off the window and the model
 * choices could not be reached. Moving it to a modal fixed that, but leaving it
 * mounted inside the dropdown meant dismissing the menu unmounted the modal in
 * the same click — it opened and vanished instantly. Open state is owned by the
 * page for that reason, and the page mounts this only while it is open — so the
 * draft field initialises from the stored key each time rather than needing an
 * effect to reset it.
 *
 * A third is now fixed too: the hand-rolled backdrop trapped no focus and
 * restored none, so Tab left the dialog and wandered the page behind it.
 */
export function Setup({ onClose, config, onSave, onForget }: Props) {
  const [draft, setDraft] = useState(config.apiKey);

  const byok = Boolean(config.apiKey.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPanel labelledBy="setup-title" className="w-full sm:max-w-md">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <div>
            <h2 id="setup-title" className="font-display text-xl font-semibold">
              Your own Google AI Studio key
            </h2>
            {/*
             * Say what happens to it. Asking for an API key without telling
             * someone where it goes is not a reasonable thing to do, and this
             * app does something slightly unusual — it passes through our
             * server rather than going straight from the browser — precisely
             * because the free fallback has to exist.
             */}
            <p className="text-muted-foreground mt-2 text-base leading-relaxed">
              Optional. Without one you get <span className="tabular">{FREE_TURN_CAP}</span> turns on a
              shared allowance. Your key is kept in this browser, sent to our server only on the turns that
              need it, used for that request, and never stored or logged.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-key" className="text-2xs text-muted-foreground font-medium uppercase">
              API key
            </Label>
            <Input
              id="setup-key"
              type="password"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="AIza…"
              autoComplete="off"
              autoFocus
              className="bg-surface-2"
            />
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground text-2xs font-medium uppercase">Model</p>
            <div className="space-y-2">
              {(Object.keys(MODELS) as ModelId[]).map((id) => {
                const needsKey = !MODELS[id].freeTier && !draft.trim();
                const chosen = config.model === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={needsKey}
                    aria-pressed={chosen}
                    onClick={() => onSave({ apiKey: draft.trim(), model: id })}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors duration-[--dur-fast] disabled:opacity-40',
                      chosen
                        ? 'border-foreground/35 bg-surface-2'
                        : 'border-border hover:bg-surface-2/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                        chosen ? 'border-foreground bg-foreground text-background' : 'border-border',
                      )}
                      aria-hidden
                    >
                      {chosen ? <CheckIcon className="size-2.5" strokeWidth={3.5} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-medium">{MODELS[id].label}</span>
                      <span className="text-muted-foreground block text-2xs leading-relaxed">
                        {MODELS[id].note}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-border bg-surface-1 flex shrink-0 flex-wrap justify-end gap-2 border-t px-6 py-4">
          {byok ? (
            <Button
              size="touch"
              variant="ghost"
              onClick={() => {
                onForget();
                setDraft('');
                onClose();
              }}
            >
              Forget key
            </Button>
          ) : null}
          <Button size="touch" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            size="touch"
            onClick={() => {
              onSave({ apiKey: draft.trim(), model: config.model });
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </DialogPanel>
    </Dialog>
  );
}

/** The label for the menu entry that opens it. */
export function setupLabel(config: SessionConfig): string {
  return config.apiKey.trim()
    ? `Your own key · ${MODELS[config.model].label}`
    : `Shared free allowance · ${FREE_TURN_CAP} turns`;
}
