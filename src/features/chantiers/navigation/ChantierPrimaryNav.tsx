import { NavLink, useParams } from "react-router-dom";

export type ChantierPrimarySection = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
};

export function ChantierPrimaryNav({ sections }: { sections: ChantierPrimarySection[] }) {
  const { id: chantierId } = useParams<{ id: string }>();
  const terrainFeedbackEnabled = Boolean(
    chantierId && sections.some((section) => section.key === "historique" && section.enabled),
  );

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
          to={`/chantiers/${encodeURIComponent(chantierId ?? "")}/retours-terrain`}
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
        >
          Retours terrain
        </NavLink>
      ) : null}
    </nav>
  );
}
