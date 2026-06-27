import { ArrowRight, ClipboardList, Eye, FileText, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChantierDerived } from "../types";
import { shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierStatusPill } from "./ChantierStatusPill";

const PLANNING_QUICK_LINKS = [
  { label: "Préparer", path: "preparation", icon: ClipboardList },
  { label: "Documents", path: "documents", icon: FileText },
  { label: "Équipe", path: "equipe", icon: Users },
  { label: "Qualité", path: "qualite", icon: ShieldCheck },
] as const;

export function ChantiersPlanningView({ rows, onPreview }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void }) {
  const sorted = [...rows].sort((a, b) => String(a.date_fin_prevue ?? a.planning_end_date ?? "9999").localeCompare(String(b.date_fin_prevue ?? b.planning_end_date ?? "9999")));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Planning chantiers</h2>
          <p className="text-sm text-slate-500">Vue chronologique des échéances chantier avec accès direct au pilotage d'exécution.</p>
        </div>
      </div>
      <div className="space-y-3">
        {sorted.map((row) => (
          <div key={row.id} className="grid w-full gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 md:grid-cols-[140px_minmax(0,1fr)_180px_120px_auto] md:items-center">
            <div className="text-sm font-semibold text-slate-950">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-950">{row.nom}</div>
              <div className="truncate text-sm text-slate-500">{row.client ?? "Client non renseigné"}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLANNING_QUICK_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={`/chantiers/${row.id}/${link.path}`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <ChantierProgress value={row.progress} />
            <ChantierStatusPill status={row.status} />
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                type="button"
                onClick={() => onPreview(row)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                <Eye className="h-4 w-4" />
                Aperçu
              </button>
              <Link
                to={`/chantiers/${row.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                Dossier
              </Link>
              <Link
                to={`/chantiers/${row.id}/execution`}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Piloter
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
