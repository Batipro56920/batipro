import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import VisitesModule from "../components/chantiers/VisitesModule";
import { getChantierById, type ChantierRow } from "../services/chantiers.service";
import { listIntervenantsByChantierId, type IntervenantRow } from "../services/intervenants.service";
import { listByChantier as listDocumentsByChantier } from "../services/chantierDocuments.service";
import { useI18n } from "../i18n";

export default function ChantierVisitesPage() {
  const { id } = useParams<{ id: string }>();
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("chantierVisites.subtitle")}</div>
          <h1 className="text-xl font-semibold text-slate-900">{t("chantierVisites.title")}</h1>
          <p className="text-sm text-slate-500">{chantier?.nom ?? t("chantierVisites.chantierFallback")}</p>
        </div>
        <Link to={`/chantiers/${id}`} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
          {t("chantierVisites.back")}
        </Link>
      </div>

      <VisitesModule
        chantierId={id}
        chantierName={chantier?.nom ?? t("chantierVisites.chantierFallback")}
        chantierReference={(chantier as any)?.reference ?? id}
        chantierAddress={chantier?.adresse ?? null}
        clientName={chantier?.client ?? null}
        intervenants={intervenants}
        onDocumentsRefresh={async () => {
          await listDocumentsByChantier(id);
        }}
      />
    </div>
  );
}
