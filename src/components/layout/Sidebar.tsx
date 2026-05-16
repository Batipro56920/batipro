import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type SidebarItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  href?: string;
  onClick?: () => void;
};

export function Sidebar({ title = "Batipro", items, className }: { title?: string; items: SidebarItem[]; className?: string }) {
  return (
    <nav className={cn("h-full p-3", className)} aria-label="Navigation principale">
      <div className="mb-4 px-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-bt-muted">ERP BTP</div>
        <div className="bt-card-title text-bt-text">{title}</div>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onClick}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-input px-3 text-left text-sm font-medium transition-colors duration-bt",
                item.active ? "bg-bt-primary text-white" : "text-bt-muted hover:bg-bt-surface-secondary hover:text-bt-text",
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
