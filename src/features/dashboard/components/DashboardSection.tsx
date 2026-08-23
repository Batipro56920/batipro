import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type DashboardSectionProps = {
  title: string;
  /** Resume affiche quand la section est repliee : la valeur doit suffire a decider de l'ouvrir. */
  summary?: string;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * Niveau 1 de la charte : une surface, une bordure, aucune ombre.
 * Le contenu secondaire reste accessible sans occuper l'ecran en permanence.
 */
export function DashboardSection({ title, summary, action, defaultOpen = false, children }: DashboardSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="overflow-hidden rounded-card border border-subtle bg-surface">
      <div className="flex items-center gap-3 px-4 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
          aria-controls={contentId}
          className="bt-control group flex min-w-0 flex-1 items-center gap-2.5 py-3 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-[180ms] ${open ? "" : "-rotate-90"}`}
            strokeWidth={1.75}
          />
          {/* Le titre ne se tronque jamais. Le resume ne sert qu'a decider d'ouvrir :
              une fois la section ouverte, il ferait doublon avec son contenu. */}
          <span className="bt-section-title whitespace-nowrap text-ink">{title}</span>
          {summary && !open ? <span className="bt-caption min-w-0 truncate text-muted">{summary}</span> : null}
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {open ? (
        <div id={contentId} className="border-t border-subtle">
          {children}
        </div>
      ) : null}
    </section>
  );
}
