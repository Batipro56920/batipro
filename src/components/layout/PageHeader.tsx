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
    <header className={cn("flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", className)}>
      {/*
        Le bloc de titre garde une largeur plancher : sans elle, une barre
        d'actions bien fournie l'écrasait jusqu'à faire tomber la description
        un mot par ligne.
      */}
      <div className="min-w-0 lg:min-w-[280px] lg:flex-1">
        {eyebrow ? <div className="bt-meta font-semibold uppercase tracking-[0.18em] text-bt-accent">{eyebrow}</div> : null}
        <h1 className="bt-page-title truncate text-bt-text">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-bt-muted">{description}</p> : null}
      </div>
      {/* Pas de shrink-0 : à l'étroit, les boutons passent à la ligne entre eux. */}
      {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
    </header>
  );
}
