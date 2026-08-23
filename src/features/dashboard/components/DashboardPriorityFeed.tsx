import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { TONE_SOFT, TONE_SOLID } from "./tone";
import type { DashboardFilterChip, DashboardQueueFilter, DashboardQueueItem } from "../types";

type DashboardPriorityFeedProps = {
  items: DashboardQueueItem[];
  chips: DashboardFilterChip[];
  activeFilter: DashboardQueueFilter;
  onSelectFilter: (filter: DashboardQueueFilter) => void;
  totalCount: number;
  compact: boolean;
};

function QueueRow({ item }: { item: DashboardQueueItem }) {
  return (
    <li>
      <Link
        to={item.href}
        className="bt-row relative flex items-start gap-3 px-4 py-3 transition-colors duration-[90ms] hover:bg-interactive focus-visible:bg-interactive sm:items-center sm:px-5"
      >
        {/* Trait de bord : la severite se scanne en colonne. Toujours double d'un libelle. */}
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${TONE_SOLID[item.tone]}`} />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="bt-card-title text-ink">{item.title}</span>
            {item.isCritical ? (
              <span className={`bt-caption rounded-full px-1.5 py-px ${TONE_SOFT.danger}`}>Urgent</span>
            ) : null}
          </span>
          <span className="bt-secondary mt-0.5 block text-muted sm:truncate">
            <span className="text-ink-secondary">{item.chantierNom}</span>
            {item.detail ? <span> · {item.detail}</span> : null}
          </span>
        </span>

        <span className="bt-caption bt-num mt-0.5 shrink-0 text-muted sm:mt-0">{item.ageLabel}</span>
      </Link>
    </li>
  );
}

/**
 * Zone centrale du dashboard : une file unique triee par score de priorite.
 * Les chips filtrent la liste EN PLACE, ils ne changent jamais d'ecran.
 */
export function DashboardPriorityFeed({ items, chips, activeFilter, onSelectFilter, totalCount, compact }: DashboardPriorityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  // Sur mobile, au-dela de trois lignes le bloc suivant n est plus jamais atteint.
  const collapsedRows = compact ? 3 : 6;
  const visibleItems = expanded ? items : items.slice(0, collapsedRows);
  const hiddenCount = items.length - visibleItems.length;
  // "Alertes chantier" et "Matériel" restent des filtres d'URL valides, mais ils
  // recouvrent trop largement la file pour occuper le rail en permanence.
  const broadChips: DashboardQueueFilter[] = ["alertes", "materiel"];
  const visibleChips = chips.filter(
    (chip) =>
      chip.key === "all" ||
      (chip.value > 0 && (!broadChips.includes(chip.key) || activeFilter === chip.key)),
  );

  return (
    <section className="overflow-hidden rounded-card border border-subtle bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-4 sm:px-5">
        <h2 className="bt-section-title text-ink">À traiter</h2>
        <span className="bt-caption bt-num text-muted">
          {items.length === totalCount ? `${totalCount} élément${totalCount > 1 ? "s" : ""}` : `${items.length} sur ${totalCount}`}
        </span>
      </div>

      {visibleChips.length > 1 ? (
        <div
          role="group"
          aria-label="Filtrer la file"
          className="flex gap-1.5 overflow-x-auto px-4 py-3 [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] [scrollbar-width:none] sm:flex-wrap sm:px-5 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleChips.map((chip) => {
            const active = activeFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectFilter(active && chip.key !== "all" ? "all" : chip.key)}
                className={[
                  "bt-tap inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-[120ms]",
                  active
                    ? "bg-primary text-primary-contrast"
                    : "bg-interactive text-ink-secondary hover:text-ink",
                ].join(" ")}
              >
                {chip.key !== "all" ? (
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary-contrast/70" : TONE_SOLID[chip.tone]}`} />
                ) : null}
                {chip.label}
                <span className={`bt-num text-[12px] ${active ? "opacity-75" : "text-muted"}`}>{chip.value}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-subtle px-5 py-10 text-center">
          <CheckCircle2 className="h-6 w-6 text-success" strokeWidth={1.75} />
          <p className="bt-card-title text-ink">
            {totalCount === 0 ? "Rien à traiter" : "Aucun élément dans ce filtre"}
          </p>
          <p className="bt-secondary text-muted">
            {totalCount === 0 ? "Vos chantiers ne remontent aucun point ouvert." : "Choisissez « Tout » pour revoir la file complète."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-subtle border-t border-subtle">
          {visibleItems.map((item) => (
            <QueueRow key={item.key} item={item} />
          ))}
        </ul>
      )}

      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="bt-control w-full border-t border-subtle text-[13px] font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink"
        >
          {expanded ? "Réduire la file" : `Afficher ${hiddenCount} élément${hiddenCount > 1 ? "s" : ""} de plus`}
        </button>
      ) : null}
    </section>
  );
}
