import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";

export function ContextMenu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{trigger}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="z-50 min-w-44 rounded-card border border-bt-border bg-white p-1 shadow-card">
          {children}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

export function ContextMenuItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return <ContextMenuPrimitive.Item onSelect={onSelect} className="cursor-pointer rounded-input px-3 py-2 text-sm outline-none hover:bg-bt-surface-secondary">{children}</ContextMenuPrimitive.Item>;
}
