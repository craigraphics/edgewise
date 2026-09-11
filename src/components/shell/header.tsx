'use client';

import Link from 'next/link';

import { ModeSwitch, type Mode } from './mode-switch';
import { ToolsMenu } from './tools-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

export function AppHeader({ mode, onModeChange, marking, onLeaveMarking, tools }: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  marking: boolean;
  onLeaveMarking: () => void;
  tools: { label: string; onSelect: () => void; separated?: boolean }[];
}) {
  return (
    <header className="border-border shrink-0 border-b">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-8">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight" aria-label="Edgewise home">edgewise<span className="text-[var(--band-learning)]">.</span></Link>
        <span className="text-muted-foreground hidden text-sm md:inline">How AI actually works</span>
        <div className="ml-auto flex items-center gap-1">
          <ToolsMenu items={tools} />
          <ThemeToggle />
        </div>
        {marking ? (
          <Button variant="outline" size="touch" onClick={onLeaveMarking}>Done marking</Button>
        ) : (
          <ModeSwitch value={mode} onChange={onModeChange} className="hidden panel:flex" />
        )}
      </div>
    </header>
  );
}
