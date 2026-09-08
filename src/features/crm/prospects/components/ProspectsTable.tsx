import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mail, MoreHorizontal, Phone } from "lucide-react";
import type { CrmProspectRow } from "../../../../services/crm.service";
import { dateOnly, entityLabel, eur } from "../../components/crmFormat";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import type { ProspectActionHandlers } from "../types";

function initials(row: CrmProspectRow) {
  const label = entityLabel(row);
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

const MENU_WIDTH = 184;
const MENU_ENTRY_COUNT = 4;

/**
 * Les actions secondaires vivent dans un menu : alignées en ligne elles passaient
 * à la ligne dans une colonne étroite et imposaient plus de 200px de hauteur à
 * chaque ligne du tableau, pour des boutons invisibles hors survol.
 */
function ProspectRowActions({ row, actions }: { row: CrmProspectRow; actions: ProspectActionHandlers }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const phone = row.mobile ?? row.telephone ?? null;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const height = MENU_ENTRY_COUNT * 29 + 8;
    // Positionnement fixe : le tableau vit dans un conteneur scrollable qui
    // rognerait un menu positionné en absolu. On rabat ensuite le menu dans la
    // fenêtre, la colonne Actions pouvant se trouver au bord de l'écran.
    const below = rect.bottom + 4;
    setPosition({
      top: below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : below,
      left: Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (triggerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  const menuEntries: Array<{ label: string; run: () => void }> = [
    { label: "Nouvelle tâche", run: () => actions.onTask(row) },
    { label: "Créer une affaire", run: () => actions.onCreateOpportunity(row) },
    { label: "Planifier un RDV", run: () => actions.onCreateAppointment(row) },
    { label: "Créer un devis", run: () => actions.onCreateQuote(row) },
  ];

  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
      <a
        href={phone ? `tel:${phone}` : undefined}
        title={phone ? `Appeler ${phone}` : "Aucun téléphone"}
        aria-label="Appeler"
        className={`bt-control inline-flex h-7 w-7 items-center justify-center rounded-field border border-subtle text-ink-secondary hover:bg-interactive ${phone ? "" : "pointer-events-none opacity-40"}`}
      >
        <Phone className="h-3.5 w-3.5" />
      </a>
      <a
        href={row.email ? `mailto:${row.email}` : undefined}
        title={row.email ? `Écrire à ${row.email}` : "Aucun email"}
        aria-label="Envoyer un email"
        className={`bt-control inline-flex h-7 w-7 items-center justify-center rounded-field border border-subtle text-ink-secondary hover:bg-interactive ${row.email ? "" : "pointer-events-none opacity-40"}`}
      >
        <Mail className="h-3.5 w-3.5" />
      </a>
      <button
        type="button"
        onClick={() => actions.onConvert(row)}
        className="bt-control rounded-field border border-success/20 bg-success-soft px-2 py-1 text-xs font-semibold text-success-on hover:bg-interactive"
      >
        Convertir
      </button>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Autres actions"
        className="bt-control inline-flex h-7 w-7 items-center justify-center rounded-field border border-subtle text-ink-secondary hover:bg-interactive"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && position ? (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-50 overflow-hidden rounded-field border border-subtle bg-surface py-1 shadow-lg"
        >
          {menuEntries.map((entry) => (
            <button
              key={entry.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                entry.run();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs font-medium text-ink-secondary hover:bg-interactive"
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProspectsTable({
  rows,
  actions,
  onSelect,
}: {
  rows: CrmProspectRow[];
  actions: ProspectActionHandlers;
  onSelect: (row: CrmProspectRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-surface border border-subtle bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-subtle bg-interactive text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            <tr>
              {["Prospect", "Projet", "Budget", "Source", "Commercial", "Activité", "Statut", "Actions"].map((heading) => (
                <th key={heading} className={`px-3 py-2 ${heading === "Actions" ? "text-right" : "text-left"}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row)} className="group cursor-pointer border-b border-subtle align-middle transition hover:bg-interactive">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-primary text-[11px] font-semibold text-primary-contrast">{initials(row)}</div>
                    <div className="min-w-0 max-w-[230px]">
                      <div className="truncate font-semibold text-ink">{entityLabel(row)}</div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="inline-flex min-w-0 items-center gap-1"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{row.email ?? "—"}</span></span>
                        <span className="inline-flex shrink-0 items-center gap-1"><Phone className="h-3 w-3" />{row.mobile ?? row.telephone ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="truncate font-medium text-ink-secondary">{row.type_projet ?? "—"}</div>
                  <div className="line-clamp-1 max-w-[240px] text-xs text-muted">{row.description_besoin ?? row.notes ?? "Aucune description"}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{row.budget_estime ? eur(row.budget_estime) : "—"}</td>
                <td className="px-3 py-2 text-ink-secondary"><div className="max-w-[130px] truncate">{row.source_acquisition ?? "—"}</div></td>
                <td className="px-3 py-2 text-ink-secondary"><div className="max-w-[110px] truncate" title={row.owner_id ?? undefined}>{row.owner_id ?? "—"}</div></td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">{dateOnly(row.updated_at ?? row.created_at)}</td>
                <td className="px-3 py-2"><ProspectStatusBadge status={row.statut} /></td>
                <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                  <ProspectRowActions row={row} actions={actions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-subtle px-3 py-2 text-xs text-muted">
        <span>{rows.length} prospect(s)</span>
        <span>Pagination avancée à connecter si volume élevé.</span>
      </div>
    </section>
  );
}
