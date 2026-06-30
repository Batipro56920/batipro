import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierIntervenantsSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const executionHref = id ? `/chantiers/${encodeURIComponent(id)}/execution` : "/chantiers";
  const planningHref = id ? `/chantiers/${encodeURIComponent(id)}/planning` : "/planning";

  return (
    <ChantierChapterDrawer
      eyebrow="Equipe chantier"
      title="Intervenants"
      subtitle="Intervenants rattaches au chantier. L'ajout ou le retrait se fait dans le panneau lateral."
      actionLabel="Gerer les intervenants"
      previewClassName="batipro-chapter-preview--intervenants"
    >
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold">Affectation terrain</div>
            <div className="mt-1 text-blue-800/80">
              Une fois l'equipe rattachee, attribuez les taches, verifiez le planning et suivez les heures depuis l'execution chantier.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={executionHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Attribuer les taches
            </Link>
            <Link
              to={planningHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Ouvrir le planning
            </Link>
            <Link
              to={executionHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Suivre les temps
            </Link>
          </div>
        </div>
      </div>
      {children}
    </ChantierChapterDrawer>
  );
}
