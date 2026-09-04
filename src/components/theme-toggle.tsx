'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { useHydrated } from '@/lib/persisted';

/**
 * Renders a size-matched placeholder until mounted. `resolvedTheme` is
 * undefined on the server (and on the client's first render, before
 * next-themes reads localStorage), so rendering the real icon immediately
 * would flash the wrong one or mismatch during hydration.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known client-side, so the button holds its place until
  // hydration rather than rendering an icon the server had to guess at.
  const mounted = useHydrated();

  return (
    <Button
      variant="ghost"
      size="icon-touch"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {mounted && resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
