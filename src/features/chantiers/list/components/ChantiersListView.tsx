import { Bell, Clock3, MapPin, Users } from "lucide-react";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

type Props = {
  rows: ChantierDerived[];
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onPreview: (row: ChantierDerived) => void;
  actions: ChantierListActions;
};

export function ChantiersListView({ rows, selectedIds, onToggleSelection, onPreview, actions }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="grid grid-cols-[40px_minmax(260px,1.5fr)_110px_110px_130px_100px_120px_170px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        <span />
        <span>Chantier</span>
        <span>Statut</span>
        <span>Budget</span>
        <span>Temps</span>
        <span>Échéance</span>
        <span>Alertes</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.id} role="button" tabIndex={0} onClick={() => onPreview(row)} onKeyDown={(event) => event.key === "Enter" && onPreview(row)} className="grid cursor-pointer grid-cols-[40px_minmax(260px,1.5fr)_110px_110px_130px_100px_120px_170px] items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
            <div onClick={(event) => event.stopPropagation()}>
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={selectedIds.includes(row.id)} onChange={() => onToggleSelection(row.id)} aria-label={`Sélectionner ${row.nom}`} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-950">{row.nom}</div>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                <span className="truncate">{row.client ?? "Client non renseigné"}</span>
                <span className="text-slate-300">•</span>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{row.adresse ?? "Adresse non renseignée"}</span>
              </div>
            </div>
            <ChantierStatusPill status={row.status} />
            <div className="text-sm font-semibold text-slate-900">{budgetLabel(row.budgetHt)}</div>
            <div className="text-sm text-slate-600">
              {timeLabel(row.heures_prevues, row.heures_passees)}
            </div>
            <div className="text-sm text-slate-600">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</div>
            <div className="flex items-center gap-2">
              {row.isLate ? <Badge icon={Bell} label="En retard" tone="red" /> : <Badge icon={Clock3} label="À jour" tone="slate" />}
              <Badge icon={Users} label="Équipe" tone="blue" />
            </div>
            <ChantierRowActions row={row} actions={actions} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Badge({ icon: Icon, label, tone }: { icon: typeof Bell; label: string; tone: "red" | "slate" | "blue" }) {
  const classes = tone === "red" ? "border-red-200 bg-red-50 text-red-700" : tone === "blue" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
