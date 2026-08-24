import type { ChantierListView } from "../types";

const VIEWS: Array<{ key: ChantierListView; label: string }> = [
  { key: "list", label: "Liste" },
  { key: "cards", label: "Cartes" },
  { key: "planning", label: "Planning" },
  { key: "kanban", label: "Kanban" },
];

/**
 * Selecteur de vue segmente (annexe C) : pose sur la ligne de base du titre de
 * section, jamais dans la barre d'outils. Le contenu n'est pas remplace mais
 * reordonne : c'est un radiogroup, pas un tablist.
 */
export function ChantiersViewSwitch({ view, onView }: { view: ChantierListView; onView: (view: ChantierListView) => void }) {
  function moveSelection(direction: 1 | -1) {
    const index = VIEWS.findIndex((entry) => entry.key === view);
    const next = VIEWS[(index + direction + VIEWS.length) % VIEWS.length];
    onView(next.key);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Vue des chantiers"
      className="flex w-full shrink-0 gap-1 rounded-full bg-interactive p-0.5 sm:w-auto"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveSelection(1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveSelection(-1);
        }
      }}
    >
      {VIEWS.map((entry) => {
        const active = view === entry.key;
        return (
          <button
            key={entry.key}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onView(entry.key)}
            className={`bt-tap flex-1 rounded-full px-3 text-[13px] transition-colors duration-[120ms] sm:min-w-[72px] sm:flex-none ${
              active ? "border border-strong bg-surface font-[550] text-ink" : "font-medium text-muted hover:text-ink-secondary"
            }`}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
