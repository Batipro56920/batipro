import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="bt-meta font-semibold uppercase tracking-[0.18em] text-bt-accent">{eyebrow}</div> : null}
        <h1 className="bt-page-title truncate text-bt-text">{title}</h1>
        {description ? <p className="mt-1 max-w-4xl text-sm text-bt-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
