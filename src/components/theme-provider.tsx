'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Theme, and the one place motion is configured.
 *
 * `reducedMotion="user"` is not optional here. Every hand-written animation in
 * `globals.css` is already disabled under `prefers-reduced-motion`, but
 * `motion`'s own transitions — the mode switch's sliding indicator and the
 * panel's crossfade — ignore the media query unless they are told. Without this
 * the CSS half of the motion system would respect the setting and the
 * JavaScript half would quietly not, which is worse than having neither.
 *
 * `"user"` rather than `"always"`/`"never"` so it follows the operating system
 * rather than second-guessing it. It keeps opacity transitions and drops
 * transforms, which is the right split: the crossfades still communicate that
 * something changed, and nothing slides.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
