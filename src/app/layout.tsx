import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Edgewise',
  description: 'Find the one idea that is blocking the rest, then work from there.',
  robots: { index: false, follow: false },
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
      </body>
    </html>
  );
}
