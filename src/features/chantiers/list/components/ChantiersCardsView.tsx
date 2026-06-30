import { AlertTriangle, CalendarDays, FileText, Hammer, MapPin, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, commercialAmountLabel, commercialSourceLabel, hasCommercialContext, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

export function ChantiersCardsView({ rows, onPreview, actions }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void; actions: ChantierListActions }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const terrainFeedbackOpenCount = row.terrainFeedbackOpenCount ?? 0;
        const terrainFeedbackPriorityCount = row.terrainFeedbackPriorityCount ?? 0;
        const hasOpenTerrainFeedbacks = terrainFeedbackOpenCount > 0;
        const hasPriorityTerrainFeedbacks = terrainFeedbackPriorityCount > 0;
        const terrainFeedbackLabel = hasPriorityTerrainFeedbacks
          ? `${terrainFeedbackPriorityCount} retour terrain urgent`
          : `${terrainFeedbackOpenCount} retour${terrainFeedbackOpenCount > 1 ? "s" : ""} terrain à traiter`;

        return (
          <article key={row.id} role="button" tabIndex={0} onClick={() => onPreview(row)} onKeyDown={(event) => event.key === "Enter" && onPreview(row)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-slate-950">{row.nom}</h3>
                <p className="mt-1 truncate text-sm text-slate-500">{row.client ?? "Client non renseigné"}</p>
              </div>
              <ChantierStatusPill status={row.status} />
            </div>
            {hasCommercialContext(row) ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                  <FileText className="h-3 w-3" />
                  {commercialSourceLabel(row)}
                </span>
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {commercialAmountLabel(row)}
                </span>
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{row.adresse ?? "Adresse non renseignée"}</span>
            </div>
            <div className="mt-4">
              <ChantierProgress value={row.progress} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Metric label="Budget" value={budgetLabel(row.budgetHt)} />
              <Metric label="Temps" value={timeLabel(row.heures_prevues, row.heures_passees)} />
              <Metric label="Échéance" value={shortDate(row.date_fin_prevue ?? row.planning_end_date)} />
            </div>
            {row.isLate || hasOpenTerrainFeedbacks ? (
              <div className="mt-4 space-y-2">
                {row.isLate ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">En retard</div>
                ) : null}
                {hasOpenTerrainFeedbacks ? (
                  <div className={["rounded-xl border px-3 py-2 text-sm font-medium", hasPriorityTerrainFeedbacks ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"].join(" ")}>{terrainFeedbackLabel}</div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2" onClick={(event) => event.stopPropagation()}>
              <QuickLink href={`/chantiers/${row.id}/execution`} icon={Hammer} label="Exécution" />
              <QuickLink href={`/chantiers/${row.id}/planning`} icon={CalendarDays} label="Planning" />
              <QuickLink href={`/retours-terrain?chantierId=${encodeURIComponent(row.id)}`} icon={AlertTriangle} label="Retours" tone={hasPriorityTerrainFeedbacks ? "red" : hasOpenTerrainFeedbacks ? "amber" : "slate"} />
              <QuickLink href={`/chantiers/${row.id}/documents`} icon={FileText} label="Documents" />
            </div>
            <div className="mt-4">
              <ChantierRowActions row={row} actions={actions} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-950">
        {label === "Échéance" ? <CalendarDays className="mr-1 inline h-3.5 w-3.5 text-slate-400" /> : null}
        {value}
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, tone = "slate" }: { href: string; icon: LucideIcon; label: string; tone?: "slate" | "amber" | "red" }) {
  const className =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <Link
      to={href}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition ${className}`}
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
