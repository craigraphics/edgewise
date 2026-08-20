'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * What a client-side throw looks like mid-session.
 *
 * Without this the screen goes blank, which in a twenty-three step walkthrough
 * reads as having lost everything. Nothing is actually lost — progress lives in
 * this browser's storage, not in the render tree — so the first job of this
 * screen is to say so before anything else.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[boundary] client error:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Something broke on our side.</h1>
        {/*
         * Stated first and plainly. Someone eighteen steps into a walkthrough
         * needs to know their place survived before they need anything else.
         */}
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Your progress is safe — where you have got to is kept in this browser, not in the page. Carrying on
          should pick up exactly where you were.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="touch" onClick={reset}>
          Carry on
        </Button>
        <Button size="touch" variant="outline" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>

      {error.digest ? (
        <p className="text-muted-foreground text-xs">
          If you report this, the reference is <code className="font-mono">{error.digest}</code>.
        </p>
      ) : null}
    </main>
  );
}
