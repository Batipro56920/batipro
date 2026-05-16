import type { ReactNode } from "react";

export function Timeline({ items }: { items: Array<{ id: string; title: ReactNode; meta?: ReactNode; content?: ReactNode }> }) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="relative pl-6">
          <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-bt-accent" />
          <div className="font-medium text-bt-text">{item.title}</div>
          {item.meta ? <div className="bt-meta mt-0.5">{item.meta}</div> : null}
          {item.content ? <div className="mt-2 text-sm text-bt-muted">{item.content}</div> : null}
        </li>
      ))}
    </ol>
  );
}
