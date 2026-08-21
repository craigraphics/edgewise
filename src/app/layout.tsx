import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

/**
 * The canonical origin, and the base every relative metadata URL resolves
 * against.
 *
 * Hard-coded rather than read from `VERCEL_URL`, which is the per-deployment
 * hostname: canonicals built from it would point every preview at itself and
 * split the site across dozens of URLs as far as a crawler is concerned.
 */
const SITE = 'https://edgewise.craigraphics.com';

const DESCRIPTION =
  'Edgewise finds the one idea blocking the rest of your understanding of AI, shows you a map of where you are, then teaches you the whole thing from there.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Edgewise — find the idea blocking the rest',
    // Written for pages that do not exist yet; a second page should not have to
    // remember to append the product name by hand.
    template: '%s · Edgewise',
  },
  description: DESCRIPTION,
  applicationName: 'Edgewise',
  authors: [{ name: 'William Craig', url: 'https://craigraphics.com' }],
  creator: 'William Craig',
  publisher: 'William Craig',
  keywords: [
    'learn AI',
    'how AI works',
    'concept map',
    'prerequisite graph',
    'knowledge diagnostic',
    'machine learning explained',
    'large language models explained',
    'adaptive learning',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'Edgewise',
    title: 'Edgewise — find the idea blocking the rest',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Edgewise — find the idea blocking the rest',
    description: DESCRIPTION,
  },
  category: 'education',
  /*
   * Indexable, which it deliberately was not while this was unreleased. If it
   * ever goes back to being a private draft, this is the one line to flip —
   * `robots.ts` allows everything and would happily let a crawler in on its own.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport: Viewport = {
  // Both stated, so the browser chrome follows the theme the page is actually
  // showing rather than guessing from the light one.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#131c2b' },
  ],
};

/**
 * What the product is, for machines.
 *
 * Kept to what is verifiably true on the page: it is a free web app about
 * learning how AI works, and William wrote it. Inflating this with ratings or
 * an offer catalogue is how structured data earns a manual action.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Edgewise',
  url: SITE,
  description: DESCRIPTION,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any modern browser',
  inLanguage: 'en',
  author: {
    '@type': 'Person',
    name: 'William Craig',
    url: 'https://craigraphics.com',
  },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  about: { '@type': 'Thing', name: 'Artificial intelligence' },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)} suppressHydrationWarning>
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
        <script
          type="application/ld+json"
          // The content is a literal defined above, not anything a user supplied.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </body>
    </html>
  );
}
