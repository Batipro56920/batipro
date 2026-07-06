import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierTimeSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const encodedChantierId = id ? encodeURIComponent(id) : "";
  const chantierLinks = id
    ? [
        { label: "Exécution", href: `/chantiers/${encodedChantierId}/execution`, tone: "blue" },
        { label: "Planning", href: `/chantiers/${encodedChantierId}/planning`, tone: "slate" },
        { label: "Retours terrain", href: `/chantiers/${encodedChantierId}/retours-terrain`, tone: "amber" },
        { label: "Journal chantier", href: `/chantiers/${encodedChantierId}/historique`, tone: "slate" },
      ]
    : [];

  function linkClass(tone: string) {
    if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100";
    if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
    return "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  }

  return (
    <ChantierChapterDrawer
      eyebrow="Execution"
      title="Temps chantier"
      subtitle="Temps deja saisi par tache. L'ajout d'une saisie se fait dans le panneau lateral."
      actionLabel="Saisir du temps"
      previewClassName="batipro-chapter-preview--time"
    >
      {chantierLinks.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-slate-950">Temps relié au pilotage chantier</div>
              <div className="mt-1 text-slate-500">
                Comparez les heures saisies avec les tâches, le planning et les retours terrain avant arbitrage.
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {chantierLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={["inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold", linkClass(link.tone)].join(" ")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </ChantierChapterDrawer>
  );
}
