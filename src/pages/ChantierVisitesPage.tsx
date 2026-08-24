import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
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
    return <div className="rounded-surface border border-danger/20 bg-danger-soft p-4 text-sm font-medium text-danger-on">{t("chantierVisites.notFound")}</div>;
  }

  if (loading) {
    return <div className="rounded-surface border border-subtle bg-surface p-4 text-sm text-muted">{t("common.states.loading")}</div>;
  }

  if (error) {
    return <div className="rounded-surface border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-on">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-surface border border-subtle bg-surface p-4 shadow-elevated">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link to={`/chantiers/${id}`} className="bt-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field border border-subtle bg-surface text-ink-secondary hover:bg-interactive" aria-label={t("chantierVisites.back")}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <div className="min-w-0">
              <div className="bt-caption text-muted">{t("chantierVisites.subtitle")}</div>
              <h1 className="bt-page-title mt-1 text-ink">{t("chantierVisites.title")}</h1>
              <div className="bt-secondary mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted">
                <span>{chantier?.nom ?? t("chantierVisites.chantierFallback")}</span>
                <span>{chantier?.client || "Client non renseigné"}</span>
                <span>{intervenants.length} intervenant{intervenants.length > 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/chantiers/${id}/qualite`} className="bt-control inline-flex items-center gap-2 rounded-field border border-info/20 bg-info-soft px-3 py-2 text-sm font-semibold text-info-on hover:bg-interactive">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
              Qualité / réserves
            </Link>
            <Link to={`/retours-terrain?chantierId=${id}`} className="bt-control inline-flex items-center gap-2 rounded-field border border-warning/20 bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-on hover:bg-interactive">
              <TriangleAlert className="h-4 w-4" strokeWidth={1.75} />
              Retours terrain
            </Link>
            <Link to={`/chantiers/${id}/planning`} className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
              Planning
            </Link>
            <Link to={`/chantiers/${id}/documents`} className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Documents
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-card border border-subtle bg-surface p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="bt-card-title text-ink">Suivi chantier</div>
            <div className="bt-secondary mt-1 text-muted">
              Après une visite, poursuivez directement vers les points terrain, réserves, planning ou pièces associées au chantier.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/retours-terrain?chantierId=${id}`} className="bt-control rounded-field border border-warning/20 bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-on hover:bg-interactive">Voir les retours terrain</Link>
            <Link to={`/chantiers/${id}/qualite`} className="bt-control rounded-field border border-info/20 bg-info-soft px-3 py-2 text-sm font-semibold text-info-on hover:bg-interactive">Suivre les réserves</Link>
            <Link to={`/chantiers/${id}/planning`} className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Revoir le planning</Link>
            <Link to={`/chantiers/${id}/documents`} className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Ouvrir les documents</Link>
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
