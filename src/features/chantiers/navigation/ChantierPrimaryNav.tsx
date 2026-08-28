import { useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import type { CompanyFeatureModuleId } from "../../../config/companyFeatures";
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

type ChantierPilotageShortcut = {
  key: string;
  label: string;
  href: string;
  title: string;
  moduleId: CompanyFeatureModuleId;
  sectionKeys: string[];
};

const OPEN_TERRAIN_FEEDBACK_STATUSES = new Set(["nouveau", "en_cours"]);
const PRIORITY_TERRAIN_FEEDBACK_URGENCIES = new Set(["critique", "urgente"]);

const CHANTIER_PILOTAGE_SHORTCUTS: ChantierPilotageShortcut[] = [
  {
    key: "temps-chantier",
    label: "Temps",
    href: "temps",
    title: "Ouvrir le suivi des temps de ce chantier",
    moduleId: "temps",
    sectionKeys: ["execution", "equipe"],
  },
];

function isModuleEnabled(moduleId: CompanyFeatureModuleId, enabledModules: Set<CompanyFeatureModuleId> | null) {
  return !enabledModules || enabledModules.has(moduleId);
}

export function ChantierPrimaryNav({ sections }: { sections: ChantierPrimarySection[] }) {
  const { id: chantierId } = useParams<{ id: string }>();
  const [enabledModules, setEnabledModules] = useState<Set<CompanyFeatureModuleId> | null>(null);
  const [terrainFeedbackSummary, setTerrainFeedbackSummary] = useState<TerrainFeedbackSummary | null>(null);
  const enabledSectionKeys = useMemo(
    () => new Set(sections.filter((section) => section.enabled).map((section) => section.key)),
    [sections],
  );
  const reserveShortcutEnabled =
    Boolean(chantierId) &&
    enabledSectionKeys.has("qualite") &&
    isModuleEnabled("reserves", enabledModules);
  const reserveHref = chantierId ? `/chantiers/${encodeURIComponent(chantierId)}/qualite` : "/reserves";
  const terrainFeedbackEnabled = Boolean(chantierId) && isModuleEnabled("journal_chantier", enabledModules);
  const terrainFeedbackHref = chantierId
    ? `/retours-terrain?chantierId=${encodeURIComponent(chantierId)}`
    : "/retours-terrain";
  const pilotageShortcuts = useMemo(() => {
    if (!chantierId) return [];
    return CHANTIER_PILOTAGE_SHORTCUTS.filter((shortcut) => {
      const sectionVisible = shortcut.sectionKeys.some((sectionKey) => enabledSectionKeys.has(sectionKey));
      return sectionVisible && isModuleEnabled(shortcut.moduleId, enabledModules);
    }).map((shortcut) => ({
      ...shortcut,
      href: `/chantiers/${encodeURIComponent(chantierId)}/${shortcut.href}`,
    }));
  }, [chantierId, enabledModules, enabledSectionKeys]);
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
  const reserveTitle = "Ouvrir les réserves qualité de ce chantier";
  const terrainFeedbackTitle = terrainFeedbackBadge?.title ?? "Voir les retours terrain filtrés sur ce chantier";

  useEffect(() => {
    let alive = true;

    async function loadFeatureSettings() {
      try {
        const settings = await getCompanySettings();
        if (!alive) return;
        setEnabledModules(new Set(getEnabledCompanyModulesFromSettings(settings)));
      } catch {
        if (!alive) return;
        setEnabledModules(null);
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

    if (!chantierId || !terrainFeedbackEnabled) {
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
  }, [chantierId, terrainFeedbackEnabled]);

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
      {pilotageShortcuts.map((shortcut) => (
        <NavLink
          key={shortcut.key}
          to={shortcut.href}
          title={shortcut.title}
          aria-label={shortcut.title}
          className={({ isActive }) => [
            "rounded-xl border px-3 py-2 text-sm font-semibold transition",
            isActive
              ? "border-blue-700 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
              : "border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100",
          ].join(" ")}
        >
          {shortcut.label}
        </NavLink>
      ))}
      {reserveShortcutEnabled ? (
        <NavLink
          to={reserveHref}
          title={reserveTitle}
          aria-label={reserveTitle}
          className={({ isActive }) => [
            "rounded-xl border px-3 py-2 text-sm font-semibold transition",
            isActive
              ? "border-red-700 bg-red-600 text-white shadow-sm shadow-red-600/20"
              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
          ].join(" ")}
        >
          Réserves
        </NavLink>
      ) : null}
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
