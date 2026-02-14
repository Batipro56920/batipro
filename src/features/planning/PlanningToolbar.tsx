import type { PlanningPeriod } from "./planning.utils";

type Option = { value: string; label: string };

type Props = {
  period: PlanningPeriod;
  onPeriodChange: (value: PlanningPeriod) => void;
  viewMode: "gantt" | "team";
  onViewModeChange: (value: "gantt" | "team") => void;
  lotFilter: string;
  zoneFilter: string;
  intervenantFilter: string;
  lotOptions: Option[];
  zoneOptions: Option[];
  intervenantOptions: Option[];
  onLotFilterChange: (value: string) => void;
  onZoneFilterChange: (value: string) => void;
  onIntervenantFilterChange: (value: string) => void;
  onAutoSchedule: () => void;
  onExportPdf: () => void;
  skipWeekends: boolean;
  onSkipWeekendsChange: (value: boolean) => void;
};

export default function PlanningToolbar({
  period,
  onPeriodChange,
  viewMode,
  onViewModeChange,
  lotFilter,
  zoneFilter,
  intervenantFilter,
  lotOptions,
  zoneOptions,
  intervenantOptions,
  onLotFilterChange,
  onZoneFilterChange,
  onIntervenantFilterChange,
  onAutoSchedule,
  onExportPdf,
  skipWeekends,
  onSkipWeekendsChange,
}: Props) {
  return (
    <div className="rounded-2xl border bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onViewModeChange("gantt")}
            className={[
              "chip-btn",
              viewMode === "gantt" ? "chip-btn--active" : "chip-btn--inactive",
            ].join(" ")}
          >
            Vue Gantt
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("team")}
            className={[
              "chip-btn",
              viewMode === "team" ? "chip-btn--active" : "chip-btn--inactive",
            ].join(" ")}
          >
            Vue équipe
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Période</span>
          <select
            className="rounded-xl border px-3 py-1.5 text-xs"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as PlanningPeriod)}
          >
            <option value="week">Semaine</option>
            <option value="2weeks">2 semaines</option>
            <option value="month">Mois</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={skipWeekends}
              onChange={(e) => onSkipWeekendsChange(e.target.checked)}
            />
            Ignorer week-end
          </label>
          <button
            type="button"
            onClick={onAutoSchedule}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            Replanification auto
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="rounded-xl bg-[var(--color-primary)] text-white px-3 py-1.5 text-xs hover:bg-[#1479bf]"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-xl border px-3 py-1.5 text-xs"
          value={lotFilter}
          onChange={(e) => onLotFilterChange(e.target.value)}
        >
          <option value="">Lot</option>
          {lotOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="rounded-xl border px-3 py-1.5 text-xs"
          value={zoneFilter}
          onChange={(e) => onZoneFilterChange(e.target.value)}
          disabled={zoneOptions.length === 0}
        >
          <option value="">Zone</option>
          {zoneOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="rounded-xl border px-3 py-1.5 text-xs"
          value={intervenantFilter}
          onChange={(e) => onIntervenantFilterChange(e.target.value)}
        >
          <option value="">Intervenant</option>
          {intervenantOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}



