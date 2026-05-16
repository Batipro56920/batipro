import type { IntervenantChantier } from "../../../services/intervenantPortal.service";

export default function IntervenantProjectCard({
  chantier,
  selected,
  noClientLabel,
  onClick,
}: {
  chantier: IntervenantChantier;
  selected?: boolean;
  noClientLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={["w-full rounded-2xl border px-3 py-3 text-left", selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-900"].join(" ")}
    >
      <div className="text-sm font-semibold">{chantier.nom}</div>
      <div className={selected ? "mt-1 text-xs text-slate-200" : "mt-1 text-xs text-slate-500"}>{chantier.client || noClientLabel}</div>
    </button>
  );
}

