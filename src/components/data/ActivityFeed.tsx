import type { ReactNode } from "react";

export function ActivityFeed({ items }: { items: Array<{ id: string; actor?: ReactNode; action: ReactNode; date?: ReactNode }> }) {
  return (
    <div className="divide-y divide-bt-border rounded-card border border-bt-border bg-white">
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 p-3 text-sm">
          <div>
            {item.actor ? <span className="font-medium text-bt-text">{item.actor} </span> : null}
            <span className="text-bt-muted">{item.action}</span>
          </div>
          {item.date ? <div className="bt-meta shrink-0">{item.date}</div> : null}
        </div>
      ))}
    </div>
  );
}
