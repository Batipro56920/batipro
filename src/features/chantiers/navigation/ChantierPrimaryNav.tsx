import { useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  getCompanySettings,
  getEnabledCompanyModulesFromSettings,
} from "../../../services/companySettings.service";
import { listTerrainFeedbacks } from "../../../services/terrainFeedback.service";

export type ChantierPrimarySection = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
};

type TerrainFeedbackSummary = {
  open: number;
  priority: number;
};

const OPEN_TERRAIN_FEEDBACK_STATUSES = new Set(["nouveau", "en_cours"]);
const PRIORITY_TERRAIN_FEEDBACK_URGENCIES = new Set(["critique", "urgente"]);

export function ChantierPrimaryNav({ sections }: { sections: ChantierPrimarySection[] }) {
  const { id: chantierId } = useParams<{ id: string }>();
  const [terrainFeedbackModuleEnabled, setTerrainFeedbackModuleEnabled] = useState(true);
  const [terrainFeedbackSummary, setTerrainFeedbackSummary] = useState<TerrainFeedbackSummary | null>(null);
  const terrainFeedbackEnabled = Boolean(chantierId) && terrainFeedbackModuleEnabled;
  const terrainFeedbackHref = chantierId
    ? `/retours-terrain?chantierId=${encodeURIComponent(chantierId)}`
    : "/retours-terrain";
  const terrainFeedbackBadge = useMemo(() => {
    if (!terrainFeedbackSummary?.open) return null;
    if (terrainFeedbackSummary.priority > 0) {
      return {
        label: `${terrainFeedbackSummary.priority} urgent${terrainFeedbackSummary.priority > 1 ? "s" : ""}`,
        title: `${terrainFeedbackSummary.priority} retour${terrainFeedbackSummary.priority > 1 ? "s" : ""} terrain urgent${terrainFeedbackSummary.priority > 1 ? "s" : ""}`,
        priority: true,
      };
    }

    return {
      label: `${terrainFeedbackSummary.open} ouvert${terrainFeedbackSummary.open > 1 ? "s" : ""}`,
      title: `${terrainFeedbackSummary.open} retour${terrainFeedbackSummary.open > 1 ? "s" : ""} terrain ouvert${terrainFeedbackSummary.open > 1 ? "s" : ""}`,
      priority: false,
    };
  }, [terrainFeedbackSummary]);
  const terrainFeedbackTitle = terrainFeedbackBadge?.title ?? "Voir les retours terrain filtrés sur ce chantier";

  useEffect(() => {
    let alive = true;

    async function loadFeatureSettings() {
      try {
        const settings = await getCompanySettings();
        if (!alive) return;
        const enabledModules = getEnabledCompanyModulesFromSettings(settings);
        setTerrainFeedbackModuleEnabled(enabledModules.includes("journal_chantier"));
      } catch {
        if (!alive) return;
        setTerrainFeedbackModuleEnabled(true);
      }
    }

    void loadFeatureSettings();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setTerrainFeedbackSummary(null);

    if (!chantierId || !terrainFeedbackModuleEnabled) {
      return () => {
        alive = false;
      };
    }

    async function loadTerrainFeedbackSummary() {
      try {
        const rows = await listTerrainFeedbacks({ chantierId });
        if (!alive) return;
        const openRows = rows.filter((row) => OPEN_TERRAIN_FEEDBACK_STATUSES.has(row.status));
        setTerrainFeedbackSummary({
          open: openRows.length,
          priority: openRows.filter((row) => PRIORITY_TERRAIN_FEEDBACK_URGENCIES.has(row.urgency)).length,
        });
      } catch {
        if (!alive) return;
        setTerrainFeedbackSummary(null);
      }
    }

    void loadTerrainFeedbackSummary();

    return () => {
      alive = false;
    };
  }, [chantierId, terrainFeedbackModuleEnabled]);

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Navigation chantier principale">
      {sections.filter((section) => section.enabled).map((section) => (
        <NavLink
          key={section.key}
          to={section.href}
          end={section.key === "cockpit"}
          className={({ isActive }) => [
            "rounded-xl px-3 py-2 text-sm font-semibold transition",
            isActive ? "bg-slate-950 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          {section.label}
        </NavLink>
      ))}
      {terrainFeedbackEnabled ? (
        <NavLink
          to={terrainFeedbackHref}
          title={terrainFeedbackTitle}
          aria-label={terrainFeedbackTitle}
          className={[
            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
            terrainFeedbackBadge?.priority
              ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
              : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
          ].join(" ")}
        >
          <span>Retours terrain</span>
          {terrainFeedbackBadge ? (
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                terrainFeedbackBadge.priority
                  ? "bg-red-600 text-white"
                  : "border border-blue-200 bg-white text-blue-800",
              ].join(" ")}
            >
              {terrainFeedbackBadge.label}
            </span>
          ) : null}
        </NavLink>
      ) : null}
    </nav>
  );
}
