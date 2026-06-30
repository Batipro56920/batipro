import { Bell, Clock3, FileText, MapPin, Users, type LucideIcon } from "lucide-react";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, commercialAmountLabel, commercialSourceLabel, hasCommercialContext, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

type Props = {
  rows: ChantierDerived[];
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onPreview: (row: ChantierDerived) => void;
  actions: ChantierListActions;
};

const TABLE_COLUMNS = "40px minmax(260px,1.5fr) 110px 110px 130px 100px 120px 170px";

export function ChantiersListView({ rows, selectedIds, onToggleSelection, onPreview, actions }: Props) {
  return (
    <section className="space-y-3 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:shadow-sm lg:shadow-slate-950/[0.03]">
      <div className="hidden border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 lg:grid lg:gap-3" style={{ gridTemplateColumns: TABLE_COLUMNS }}>
        <span />
        <span>Chantier</span>
        <span>Statut</span>
        <span>Budget</span>
        <span>Temps</span>
        <span>Échéance</span>
        <span>Alertes</span>
        <span className="text-right">Actions</span>
      </div>

      <div className="hidden divide-y divide-slate-100 lg:block">
        {rows.map((row) => (
          <div
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => onPreview(row)}
            onKeyDown={(event) => event.key === "Enter" && onPreview(row)}
            className="grid cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
            style={{ gridTemplateColumns: TABLE_COLUMNS }}
          >
            <div onClick={(event) => event.stopPropagation()}>
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={selectedIds.includes(row.id)} onChange={() => onToggleSelection(row.id)} aria-label={`Sélectionner ${row.nom}`} />
            </div>
            <ChantierIdentity row={row} />
            <ChantierStatusPill status={row.status} />
            <div className="text-sm font-semibold text-slate-900">{budgetLabel(row.budgetHt)}</div>
            <div className="text-sm text-slate-600">{timeLabel(row.heures_prevues, row.heures_passees)}</div>
            <div className="text-sm text-slate-600">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</div>
            <AlertBadges row={row} />
            <ChantierRowActions row={row} actions={actions} />
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <article
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => onPreview(row)}
            onKeyDown={(event) => event.key === "Enter" && onPreview(row)}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] transition hover:border-blue-200"
          >
            <div className="flex items-start gap-3">
              <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={selectedIds.includes(row.id)} onChange={() => onToggleSelection(row.id)} aria-label={`Sélectionner ${row.nom}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <ChantierIdentity row={row} />
                  <ChantierStatusPill status={row.status} />
                </div>
                <div className="mt-4">
                  <ChantierProgress value={row.progress} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Budget" value={budgetLabel(row.budgetHt)} />
              <Metric label="Temps" value={timeLabel(row.heures_prevues, row.heures_passees)} />
              <Metric label="Échéance" value={shortDate(row.date_fin_prevue ?? row.planning_end_date)} />
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Alertes</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <AlertBadges row={row} />
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <ChantierRowActions row={row} actions={actions} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChantierIdentity({ row }: { row: ChantierDerived }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-slate-950">{row.nom}</div>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
        <span className="truncate">{row.client ?? "Client non renseigné"}</span>
        <span className="text-slate-300">•</span>
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{row.adresse ?? "Adresse non renseignée"}</span>
      </div>
      {hasCommercialContext(row) ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
            <FileText className="h-3 w-3" />
            {commercialSourceLabel(row)}
          </span>
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            {commercialAmountLabel(row)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function AlertBadges({ row }: { row: ChantierDerived }) {
  const hasOpenTerrainFeedbacks = row.terrainFeedbackOpenCount > 0;
  const terrainTone = row.terrainFeedbackPriorityCount > 0 ? "red" : "amber";
  const terrainLabel = row.terrainFeedbackPriorityCount > 0
    ? `${row.terrainFeedbackPriorityCount} retour urgent`
    : `${row.terrainFeedbackOpenCount} retour${row.terrainFeedbackOpenCount > 1 ? "s" : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {row.isLate ? <Badge icon={Bell} label="En retard" tone="red" /> : <Badge icon={Clock3} label="À jour" tone="slate" />}
      {hasOpenTerrainFeedbacks ? <Badge icon={Bell} label={terrainLabel} tone={terrainTone} /> : null}
      <Badge icon={Users} label="Équipe" tone="blue" />
    </div>
  );
}

function Badge({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: "red" | "slate" | "blue" | "amber" }) {
  const classes =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "blue"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
