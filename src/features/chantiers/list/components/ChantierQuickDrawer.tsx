import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, currency, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

const TABS = ["Vue rapide", "Tâches", "Équipe", "Documents", "Alertes"] as const;

export function ChantierQuickDrawer({ row, actions, onClose }: { row: ChantierDerived | null; actions: ChantierListActions; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Vue rapide");
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2"><ChantierStatusPill status={row.status} /></div>
              <h2 className="truncate text-xl font-semibold text-slate-950">{row.nom}</h2>
              <p className="mt-1 text-sm text-slate-500">{row.client ?? "Client non renseigné"}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4">
            <ChantierRowActions row={row} actions={actions} />
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 py-3">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
            {TABS.map((entry) => (
              <button key={entry} type="button" onClick={() => setTab(entry)} className={["shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition", tab === entry ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950"].join(" ")}>
                {entry}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {tab === "Vue rapide" ? (
            <>
              <InfoGrid row={row} />
              <div className="rounded-2xl border border-slate-200 p-4">
                <ChantierProgress value={row.progress} />
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-950">Description projet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{row.crm_project_description || "Aucune description projet renseignée."}</p>
              </div>
            </>
          ) : tab === "Alertes" ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              {row.isLate ? <p className="text-sm font-medium text-red-700">Le chantier est en retard par rapport à l'échéance prévue.</p> : <p className="text-sm text-slate-500">Aucune alerte critique détectée dans la liste chantier.</p>}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Aperçu rapide à connecter aux données détaillées de la fiche chantier. Utilisez “Ouvrir” pour accéder au module complet.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

function InfoGrid({ row }: { row: ChantierDerived }) {
  const items = [
    ["Adresse", row.adresse ?? "—"],
    ["Budget", budgetLabel(row.budgetHt)],
    ["Marge estimée", currency(row.estimatedMargin)],
    ["Date début", shortDate(row.date_debut ?? row.planning_start_date)],
    ["Date fin", shortDate(row.date_fin_prevue ?? row.planning_end_date)],
    ["Temps", timeLabel(row.heures_prevues, row.heures_passees)],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-1 font-semibold text-slate-950">{value}</div>
        </div>
      ))}
    </div>
  );
}
