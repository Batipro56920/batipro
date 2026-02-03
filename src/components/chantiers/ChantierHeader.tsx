import { Link } from "react-router-dom";
import type { ChantierRow } from "../../services/chantiers.service";

function statusBadge(status?: string | null) {
  const s = status ?? "PREPARATION";
  if (s === "EN_COURS") {
    return { label: "En cours", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (s === "TERMINE") {
    return { label: "Terminé", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: "Préparation", className: "bg-slate-50 text-slate-700 border-slate-200" };
}

export default function ChantierHeader({ item }: { item: ChantierRow }) {
  const badge = statusBadge(item?.status);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2 min-w-0">
        <div className="text-sm text-slate-500">
          <Link to="/chantiers" className="hover:underline">
            Chantiers
          </Link>{" "}
          / <span className="text-slate-700">{item.nom}</span>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold truncate">{item.nom}</h1>
          <span className={["text-xs px-2 py-1 rounded-full border", badge.className].join(" ")}>
            {badge.label}
          </span>
        </div>

        <div className="text-slate-500 text-sm">
          {item.client ?? "—"} • {item.adresse ?? "—"}
        </div>
      </div>

      <Link to="/chantiers" className="rounded-xl border px-4 py-2 hover:bg-slate-50">
        Retour
      </Link>
    </div>
  );
}
