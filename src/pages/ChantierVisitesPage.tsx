import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import VisitesModule from "../components/chantiers/VisitesModule";
import { getChantierById, type ChantierRow } from "../services/chantiers.service";
import { listIntervenantsByChantierId, type IntervenantRow } from "../services/intervenants.service";
import { listByChantier as listDocumentsByChantier } from "../services/chantierDocuments.service";
import { useI18n } from "../i18n";

export default function ChantierVisitesPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedVisitId = searchParams.get("visiteId") ?? "";
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chantier, setChantier] = useState<ChantierRow | null>(null);
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);

  async function loadPage() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [chantierRow, intervenantsRows] = await Promise.all([
        getChantierById(id),
        listIntervenantsByChantierId(id),
      ]);
      setChantier(chantierRow);
      setIntervenants(intervenantsRows);
    } catch (err: any) {
      setError(err?.message ?? t("chantierVisites.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [id]);

  function clearTargetedVisit() {
    if (!searchParams.has("visiteId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("visiteId");
    setSearchParams(nextParams, { replace: true });
  }

  if (!id) {
    return <div className="text-sm text-red-700">{t("chantierVisites.notFound")}</div>;
  }

  if (loading) {
    return <div className="text-sm text-slate-500">{t("common.states.loading")}</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("chantierVisites.subtitle")}</div>
          <h1 className="text-xl font-semibold text-slate-900">{t("chantierVisites.title")}</h1>
          <p className="text-sm text-slate-500">{chantier?.nom ?? t("chantierVisites.chantierFallback")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/chantiers/${id}`} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
            {t("chantierVisites.back")}
          </Link>
          <Link to={`/chantiers/${id}/qualite`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100">
            Qualité / réserves
          </Link>
          <Link to={`/retours-terrain?chantierId=${id}`} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">
            Retours terrain
          </Link>
          <Link to={`/chantiers/${id}/planning`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Planning
          </Link>
          <Link to={`/chantiers/${id}/documents`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Documents
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Suivi chantier</div>
            <div className="mt-1 text-sm text-slate-600">
              Après une visite, poursuivez directement vers les points terrain, réserves, planning ou pièces associées au chantier.
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
            <Link
              to={`/retours-terrain?chantierId=${id}`}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Voir les retours terrain
            </Link>
            <Link
              to={`/chantiers/${id}/qualite`}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              Suivre les réserves
            </Link>
            <Link
              to={`/chantiers/${id}/planning`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Revoir le planning
            </Link>
            <Link
              to={`/chantiers/${id}/documents`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Ouvrir les documents
            </Link>
          </div>
        </div>
      </section>

      <VisitesModule
        chantierId={id}
        chantierName={chantier?.nom ?? t("chantierVisites.chantierFallback")}
        chantierReference={(chantier as any)?.reference ?? id}
        chantierAddress={chantier?.adresse ?? null}
        clientName={chantier?.client ?? null}
        intervenants={intervenants}
        targetedVisitId={targetedVisitId}
        onClearTargetedVisit={clearTargetedVisit}
        onDocumentsRefresh={async () => {
          await listDocumentsByChantier(id);
        }}
      />
    </div>
  );
}
