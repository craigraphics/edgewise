'use client';

import { Menu } from '@base-ui/react/menu';
import { EllipsisIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The drawer of things that are not for a visitor.
 *
 * `mark` is a wizard-of-oz harness for running the diagnostic on someone by
 * hand. It used to sit in the main navigation next to the two real modes, which
 * gave a first-time visitor three unlabelled choices where there are really
 * two.
 *
 * A real `Menu` rather than the hand-rolled `div` this replaced. That version
 * had no roving focus, no type-ahead, no arrow keys, no escape handling and no
 * focus return — so the whole drawer was unreachable without a mouse.
 */

type Item = { label: string; onSelect: () => void; separated?: boolean };

export function ToolsMenu({ items }: { items: Item[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button variant="ghost" size="icon-touch" aria-label="Settings and tools">
            <EllipsisIcon />
          </Button>
        }
      />
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="edgewise-raised border-border w-60 rounded-lg border p-1 outline-none">
            {items.map((item) => (
              <div key={item.label}>
                {item.separated ? <div className="bg-border my-1 h-px" /> : null}
                <Menu.Item
                  onClick={item.onSelect}
                  className="data-highlighted:bg-surface-1 flex h-10 cursor-default items-center rounded-sm px-2.5 text-sm outline-none select-none"
                >
                  {item.label}
                </Menu.Item>
              </div>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
