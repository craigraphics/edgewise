import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A page that is not here, said in the product's voice.
 *
 * This was the framework default: a bare "404 | This page could not be found"
 * with no way back. On an app whose whole premise is that somebody's progress
 * is theirs and is kept safely, a dead end that does not even offer a link home
 * is the wrong thing to hand them.
 *
 * Mirrors `error.tsx` — same shell, same first move, which is to say plainly
 * that nothing was lost before anything else. One difference worth keeping:
 * that one is a client component only because it needs `reset`, and this needs
 * nothing, so it stays on the server. It also renders inside the root layout,
 * so it declares no fonts, no `<html>` and no theme provider.
 *
 * `title` is a plain string on purpose, so the root layout's template renders
 * "Page not found — Edgewise" — the same template `/intro` had to opt out of.
 */
export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-6 py-12">
      <div>
        <p className="eyebrow">Nothing at this address</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">That page is not here.</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Your map is safe — it is kept in this browser, not in the page you were trying to reach. Whatever
          you had marked, and wherever you had got to, is still there.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/" className={cn(buttonVariants({ size: 'touch' }))}>
          Back to the map
        </Link>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        If you followed a link to a particular idea, it may have been renamed. The map opens on whichever
        idea comes next for you.
      </p>
    </main>
  );
}
