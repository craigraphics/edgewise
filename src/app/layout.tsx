import type { Metadata, Viewport } from 'next';
import { Geist, Newsreader } from 'next/font/google';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { DESCRIPTION, SITE_NAME, SITE_URL, TITLE } from '@/lib/seo';
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
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s — ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  // Every page of this is one route, so there is one canonical and it is the
  // root. Without it a share link carrying `?utm_source=` is a second URL.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: 'en_GB',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  // The site was `index: false` while it was unreleased. It answers on a real
  // domain now. If it goes back to being a private draft this is the line to
  // flip — `robots.ts` allows crawling on its own and would let one in.
  robots: { index: true, follow: true },
};

/**
 * The browser chrome follows the theme the page is actually showing, which is
 * `--surface-0` in each. A single `themeColor` paints a light bar above a dark
 * page on iOS, which reads as the page not having loaded properly.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c11' },
  ],
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
