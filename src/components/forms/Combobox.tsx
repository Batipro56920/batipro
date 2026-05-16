import { Command } from "cmdk";
import type { ReactNode } from "react";

export function Combobox({ children, placeholder = "Rechercher..." }: { children: ReactNode; placeholder?: string }) {
  return (
    <Command className="rounded-card border border-bt-border bg-white shadow-card">
      <Command.Input className="h-9 w-full border-b border-bt-border px-3 text-sm outline-none" placeholder={placeholder} />
      <Command.List className="max-h-72 overflow-y-auto p-1">{children}</Command.List>
    </Command>
  );
}

export function ComboboxItem({ value, children, onSelect }: { value: string; children: ReactNode; onSelect?: (value: string) => void }) {
  return <Command.Item value={value} onSelect={onSelect} className="cursor-pointer rounded-input px-3 py-2 text-sm data-[selected=true]:bg-bt-surface-secondary">{children}</Command.Item>;
}
