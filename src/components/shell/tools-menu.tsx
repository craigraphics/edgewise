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

/**
 * `group` starts a visibly labelled section. The testing harness sits under one
 * called "Testing", so a visitor who opens this menu can tell which items are
 * for them and which are for somebody running the gate.
 */
export type ToolItem = { label: string; onSelect: () => void; separated?: boolean; group?: string };
type Item = ToolItem;

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
          <Menu.Popup className="edgewise-raised border-border w-72 rounded-lg border p-1 outline-none">
            {sections(items).map((section, index) => (
              <Menu.Group key={section.items[0].label}>
                {index > 0 ? <Menu.Separator className="bg-border my-1 h-px" /> : null}
                {section.group ? (
                  <Menu.GroupLabel className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-2xs font-medium tracking-wide uppercase">
                    {section.group}
                  </Menu.GroupLabel>
                ) : null}
                {section.items.map((item) => (
                  <Menu.Item
                    key={item.label}
                    onClick={item.onSelect}
                    className="data-highlighted:bg-surface-1 flex min-h-10 py-2 cursor-default items-center rounded-sm px-2.5 text-sm outline-none select-none"
                  >
                    {item.label}
                  </Menu.Item>
                ))}
              </Menu.Group>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Splits the flat list wherever an item is separated or starts a group. */
function sections(items: Item[]) {
  const out: { group?: string; items: Item[] }[] = [];
  for (const item of items) {
    const last = out.at(-1);
    if (!last || item.separated || item.group) out.push({ group: item.group, items: [item] });
    else last.items.push(item);
  }
  return out;
}
