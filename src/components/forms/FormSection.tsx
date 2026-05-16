import type { ReactNode } from "react";

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-bt-border bg-white p-4 shadow-subtle">
      <div className="mb-4">
        <h2 className="bt-card-title">{title}</h2>
        {description ? <p className="mt-1 text-sm text-bt-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
