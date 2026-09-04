import type { Metadata } from 'next';
import { Geist, Newsreader } from 'next/font/google';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

/**
 * The tutor's voice, and every heading.
 *
 * A text serif rather than a display one: the tutor's turns run to two or three
 * sentences at 17px, which is reading size, and display serifs fall apart
 * there. Newsreader also has a real italic, which the walkthrough's asides use.
 *
 * Self-hosted by `next/font`, so the CSP's `font-src 'self'` covers it and no
 * request leaves the page to render text.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  // 500 for headings, 400 for prose, italic for the asides.
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Edgewise',
  description: 'Find the one idea that is blocking the rest, then work from there.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={cn('font-sans', geist.variable, newsreader.variable)}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/*
           * The theme toggle used to be fixed to the top-right corner, where it
           * sat on top of the header's own controls. It lives in the header now,
           * in the flow, so it cannot overlap anything.
           */}
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
