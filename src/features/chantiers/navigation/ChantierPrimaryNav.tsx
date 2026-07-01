import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  getCompanySettings,
  getEnabledCompanyModulesFromSettings,
} from "../../../services/companySettings.service";

export type ChantierPrimarySection = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
};

export function ChantierPrimaryNav({ sections }: { sections: ChantierPrimarySection[] }) {
  const { id: chantierId } = useParams<{ id: string }>();
  const [terrainFeedbackModuleEnabled, setTerrainFeedbackModuleEnabled] = useState(true);
  const terrainFeedbackEnabled = Boolean(chantierId) && terrainFeedbackModuleEnabled;
  const terrainFeedbackHref = chantierId
    ? `/chantiers/${encodeURIComponent(chantierId)}/retours-terrain`
    : "/retours-terrain";

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
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
        >
          Retours terrain
        </NavLink>
      ) : null}
    </nav>
  );
}