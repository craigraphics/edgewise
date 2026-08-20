'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MODELS, type ModelId } from '@/lib/models';
import type { SessionConfig } from '@/lib/session/config';
import { FREE_TURN_CAP } from '@/lib/session/limits';

type Props = {
  onClose: () => void;
  config: SessionConfig;
  onSave: (config: SessionConfig) => void;
  onForget: () => void;
};

/**
 * Key and model settings.
 *
 * A centred modal, and — importantly — rendered OUTSIDE the header's dropdown.
 *
 * Two bugs live here, both already paid for. It first expanded in place inside
 * a 224px dropdown at 320px wide, so it spilled off the window and the model
 * choices could not be reached. Moving it to a modal fixed that, but leaving it
 * mounted inside the dropdown meant dismissing the menu unmounted the modal in
 * the same click — it opened and vanished instantly. Open state is owned by the
 * page for that reason, and the page mounts this only while it is open — so the
 * draft field initialises from the stored key each time rather than needing an
 * effect to reset it.
 */
export function Setup({ onClose, config, onSave, onForget }: Props) {
  const [draft, setDraft] = useState(config.apiKey);

  const byok = Boolean(config.apiKey.trim());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="setup-title"
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          // Clicking the backdrop closes; clicks inside must not bubble to it.
          onClick={onClose}
        >
          <div
            className="bg-background border-border max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <h2 id="setup-title" className="text-lg font-semibold tracking-tight">
                Your own Google AI Studio key
              </h2>
              {/*
               * Say what happens to it. Asking for an API key without telling
               * someone where it goes is not a reasonable thing to do, and this
               * app does something slightly unusual — it passes through our
               * server rather than going straight from the browser — precisely
               * because the free fallback has to exist.
               */}
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Optional. Without one you get {FREE_TURN_CAP} turns on a shared allowance. Your key is kept in this
                browser, sent to our server only on the turns that need it, used for that request, and never
                stored or logged.
              </p>
            </div>

            <Input
              type="password"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="AIza…"
              autoComplete="off"
              autoFocus
            />

            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Model</p>
              <div className="mt-2 space-y-2">
                {(Object.keys(MODELS) as ModelId[]).map((id) => {
                  const needsKey = !MODELS[id].freeTier && !draft.trim();
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={needsKey}
                      onClick={() => onSave({ apiKey: draft.trim(), model: id })}
                      className={`block w-full rounded-md border px-3 py-2.5 text-left text-sm leading-relaxed disabled:opacity-40 ${
                        config.model === id ? 'border-foreground/40' : 'border-border'
                      }`}
                    >
                      <span className="font-medium">{MODELS[id].label}</span>
                      <span className="text-muted-foreground block text-xs">{MODELS[id].note}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
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
          </div>
        </div>
  );
}

/** The label for the menu entry that opens it. */
export function setupLabel(config: SessionConfig): string {
  return config.apiKey.trim()
    ? `Your own key · ${MODELS[config.model].label}`
    : `Shared free allowance · ${FREE_TURN_CAP} turns`;
}
