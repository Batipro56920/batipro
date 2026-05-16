import type { ReactNode } from "react";

export function Breadcrumb({ items }: { items: Array<{ label: ReactNode; href?: string }> }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-sm text-bt-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 ? <span>/</span> : null}
            {item.href ? <a href={item.href} className="hover:text-bt-text">{item.label}</a> : <span className="text-bt-text">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
