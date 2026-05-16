import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function Select({ value, onValueChange, placeholder, children }: { value?: string; onValueChange?: (value: string) => void; placeholder?: string; children: ReactNode }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className="flex h-9 w-full items-center justify-between rounded-input border border-bt-border bg-white px-3 text-sm">
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon><ChevronDown className="h-4 w-4 text-bt-muted" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 overflow-hidden rounded-card border border-bt-border bg-white shadow-card">
          <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <SelectPrimitive.Item value={value} className="cursor-pointer rounded-input px-3 py-2 text-sm outline-none hover:bg-bt-surface-secondary">
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
