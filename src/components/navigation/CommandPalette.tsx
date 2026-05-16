import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function CommandPalette({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30" />
        <Dialog.Content className="bt-dialog-enter fixed left-1/2 top-[16vh] z-50 w-[min(92vw,640px)] -translate-x-1/2 rounded-dialog border border-bt-border bg-white shadow-dialog">
          <Command>
            <Command.Input className="h-12 w-full border-b border-bt-border px-4 text-sm outline-none" placeholder="Rechercher une action, un client, un chantier..." />
            <Command.List className="max-h-[420px] overflow-y-auto p-2">{children}</Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CommandPaletteItem({ value, children, onSelect }: { value: string; children: ReactNode; onSelect?: (value: string) => void }) {
  return <Command.Item value={value} onSelect={onSelect} className="cursor-pointer rounded-input px-3 py-2 text-sm data-[selected=true]:bg-bt-surface-secondary">{children}</Command.Item>;
}
