import { Link } from "react-router-dom";

export type ChantierPrimarySection = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
  active?: boolean;
};

export type ChantierSecondarySection = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
  active?: boolean;
  badge?: string | null;
  priority?: boolean;
};

export function ChantierPrimaryNav({ sections }: { sections: ChantierPrimarySection[] }) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-subtle"
      aria-label="Espaces du chantier"
    >
      {sections.filter((section) => section.enabled).map((section) => (
        <Link
          key={section.key}
          to={section.href}
          aria-current={section.active ? "page" : undefined}
          className={[
            "bt-tap -mb-px inline-flex shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-semibold transition",
            section.active
              ? "border-primary text-primary-on"
              : "border-transparent text-muted hover:border-subtle hover:text-ink",
          ].join(" ")}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}

export function ChantierSecondaryNav({ sections }: { sections: ChantierSecondarySection[] }) {
  const visibleSections = sections.filter((section) => section.enabled);
  if (visibleSections.length <= 1) return null;

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Rubriques de l'espace chantier">
      {visibleSections.map((section) => (
        <Link
          key={section.key}
          to={section.href}
          aria-current={section.active ? "page" : undefined}
          className={[
            "bt-tap inline-flex items-center gap-2 rounded-field border px-3 py-1.5 text-sm font-semibold transition",
            section.active
              ? "border-primary bg-primary-soft text-primary-on"
              : "border-subtle bg-surface text-ink-secondary hover:bg-interactive",
          ].join(" ")}
        >
          <span>{section.label}</span>
          {section.badge ? (
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                section.priority
                  ? "bg-danger text-white"
                  : "border border-subtle bg-surface text-muted",
              ].join(" ")}
            >
              {section.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
