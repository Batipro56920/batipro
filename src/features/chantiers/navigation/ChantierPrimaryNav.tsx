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
    key: "planning-chantier",
    label: "Planning",
    href: "planning",
    title: "Ouvrir le planning de ce chantier",
    moduleId: "planning",
    sectionKeys: ["execution"],
  },
  {
    key: "temps-chantier",
    label: "Temps",
    href: "temps",
    title: "Ouvrir le suivi des temps de ce chantier",
    moduleId: "temps",
    sectionKeys: ["execution", "equipe"],
  },
  {
    key: "achats-chantier",
    label: "Achats",
    href: "achats",
    title: "Gérer les achats et commandes de ce chantier",
    moduleId: "approvisionnement",
    sectionKeys: ["preparation", "financier"],
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
  const reserveHref = chantierId ? `/chantiers/${encodeURIComponent(chantierId)}/reserves` : "/reserves";
  const terrainFeedbackEnabled = Boolean(chantierId) && isModuleEnabled("journal_chantier", enabledModules);
  const terrainFeedbackHref = chantierId
    ? `/chantiers/${encodeURIComponent(chantierId)}/retours-terrain`
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
  const terrainFeedbackTitle = terrainFeedbackBadge?.title ?? "Voir les retours terrain dans le dossier de ce chantier";

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

    if (!chantierId || !terrainFeedbackEnabled) {
      void Promise.resolve().then(() => {
        if (alive) setTerrainFeedbackSummary(null);
      });
      return () => {
        alive = false;
      };
    }

    async function loadTerrainFeedbackSummary() {
      try {
        if (alive) setTerrainFeedbackSummary(null);
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
            "bt-tap inline-flex items-center rounded-field px-3 py-1.5 text-sm font-semibold transition",
            isActive ? "bg-ink text-surface shadow-sm" : "border border-subtle bg-surface text-ink-secondary hover:bg-interactive",
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
            "bt-tap inline-flex items-center rounded-field border px-3 py-1.5 text-sm font-semibold transition",
            isActive
              ? "border-primary bg-primary text-primary-contrast shadow-sm"
              : "border-primary/20 bg-primary-soft text-primary-on hover:bg-selected",
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
            "bt-tap inline-flex items-center rounded-field border px-3 py-1.5 text-sm font-semibold transition",
            isActive
              ? "border-danger bg-danger text-white shadow-sm"
              : "border-warning/20 bg-warning-soft text-warning-on hover:bg-interactive",
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
          className={({ isActive }) => [
            "bt-tap inline-flex items-center gap-2 rounded-field border px-3 py-1.5 text-sm font-semibold transition",
            isActive
              ? "border-primary bg-primary text-primary-contrast shadow-sm"
              : terrainFeedbackBadge?.priority
                ? "border-danger/20 bg-danger-soft text-danger-on hover:bg-interactive"
                : "border-info/20 bg-info-soft text-info-on hover:bg-interactive",
          ].join(" ")}
        >
          <span>Retours terrain</span>
          {terrainFeedbackBadge ? (
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                terrainFeedbackBadge.priority
                  ? "bg-danger text-white"
                  : "border border-info/20 bg-surface text-info-on",
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
