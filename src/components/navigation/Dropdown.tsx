import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export function Dropdown({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-card border border-bt-border bg-white p-1 shadow-card">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function DropdownItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return <DropdownMenu.Item onSelect={onSelect} className="cursor-pointer rounded-input px-3 py-2 text-sm outline-none hover:bg-bt-surface-secondary">{children}</DropdownMenu.Item>;
}
