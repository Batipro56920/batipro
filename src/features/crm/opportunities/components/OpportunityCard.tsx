import { CalendarClock, GripVertical, UserRound } from "lucide-react";
import type { OpportunityWithParty } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";

function priority(row: OpportunityWithParty) {
  if (row.status === "gagnee" || row.stage_key === "gagne") return { label: "Gagné", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (row.status === "perdue" || row.stage_key === "perdu") return { label: "Perdu", cls: "border-red-200 bg-red-50 text-red-700" };
  if (row.probabilite >= 75) return { label: "Chaud", cls: "border-red-200 bg-red-50 text-red-700" };
  if (row.probabilite >= 40) return { label: "Tiède", cls: "border-amber-200 bg-amber-50 text-amber-700" };
  return { label: "Froid", cls: "border-slate-200 bg-slate-50 text-slate-600" };
}

export function OpportunityCard({
  row,
  onDragStart,
  onOpen,
}: {
  row: OpportunityWithParty;
  onDragStart: () => void;
  onOpen: () => void;
}) {
  const badge = priority(row);
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="group cursor-grab rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{row.nom_affaire}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <UserRound className="h-3.5 w-3.5" />
            <span className="truncate">{row.partyLabel}</span>
          </div>
        </div>
        <GripVertical className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-950">{eur(row.montant_estime)}</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-500">
        <div className="flex items-center justify-between gap-2">
          <span>Probabilité</span>
          <span className="font-semibold text-slate-700">{row.probabilite}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, row.probabilite))}%` }} />
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          <span>{row.echeance ? `Échéance ${dateOnly(row.echeance)}` : "Échéance à définir"}</span>
        </div>
        <div>Commercial : {row.responsable_id ?? "—"}</div>
      </div>

      {row.prochaine_action ? (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">CTA : {row.prochaine_action}</div>
      ) : (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">CTA : définir la prochaine action</div>
      )}
    </article>
  );
}
