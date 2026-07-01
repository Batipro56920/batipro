import { useEffect, useMemo, useRef, useState } from "react";
import type { IntervenantRow } from "../../services/intervenants.service";
import { listByChantier as listDocumentsByChantier, getSignedUrl, type ChantierDocumentRow } from "../../services/chantierDocuments.service";
import { listVisites, type ChantierVisiteRow } from "../../services/chantierVisites.service";
import VisiteWizardDrawer from "./VisiteWizardDrawer";

type Props = {
  chantierId: string;
  chantierName: string;
  chantierReference?: string | null;
  chantierAddress?: string | null;
  clientName?: string | null;
  intervenants: IntervenantRow[];
  targetedVisitId?: string | null;
  onClearTargetedVisit?: () => void;
  onDocumentsRefresh?: () => Promise<void>;
};

export default function VisitesModule({
  chantierId,
  chantierName,
  chantierReference,
  chantierAddress,
  clientName,
  intervenants,
  targetedVisitId,
  onClearTargetedVisit,
  onDocumentsRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [visites, setVisites] = useState<ChantierVisiteRow[]>([]);
  const [documents, setDocuments] = useState<ChantierDocumentRow[]>([]);
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const targetedVisitRef = useRef<HTMLDivElement | null>(null);

  const documentsById = useMemo(() => {
    const map = new Map<string, ChantierDocumentRow>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

  const targetedVisit = useMemo(() => {
    if (!targetedVisitId) return null;
    return visites.find((visite) => visite.id === targetedVisitId) ?? null;
  }, [targetedVisitId, visites]);

  const targetedVisitMissing = Boolean(targetedVisitId && !loading && !targetedVisit);

  useEffect(() => {
    if (!targetedVisit || loading) return;
    const frame = window.requestAnimationFrame(() => {
      targetedVisitRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, targetedVisit?.id]);

  async function refreshAll() {
    if (!chantierId) return;
    setLoading(true);
    setError(null);
    try {
      const [visitesRows, docsRows] = await Promise.all([
        listVisites(chantierId),
        listDocumentsByChantier(chantierId),
      ]);
      setVisites(visitesRows);
      setDocuments(docsRows);
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement visites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, [chantierId]);

  async function openPdf(visite: ChantierVisiteRow) {
    if (!visite.pdf_document_id) return;
    const doc = documentsById.get(visite.pdf_document_id);
    if (!doc) {
      setError("Document PDF introuvable. Rafraichis la liste.");
      return;
    }
    setOpeningPdfId(visite.id);
    try {
      const signedUrl = await getSignedUrl(doc.storage_path, 120);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err?.message ?? "Erreur ouverture PDF.");
    } finally {
      setOpeningPdfId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold section-title">Visites de chantier</div>
          <div className="text-sm text-slate-500">Creation de compte-rendu pro avec snapshot fige.</div>
        </div>
        <button
          type="button"
          className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
          onClick={() => setWizardOpen(true)}
        >
          Nouvelle visite
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {targetedVisitId ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            targetedVisitMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {targetedVisitMissing ? "Visite chantier ciblee introuvable" : "Visite chantier ciblee depuis la recherche globale"}
              </div>
              <p className={targetedVisitMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {targetedVisit
                  ? `${targetedVisit.titre || "Visite"} ${targetedVisit.numero ? `#${targetedVisit.numero}` : ""} est surlignee dans l'historique.`
                  : "Le lien de recherche pointe vers une visite supprimee ou non visible avec les droits actuels."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {targetedVisit?.pdf_document_id ? (
                <button
                  type="button"
                  onClick={() => void openPdf(targetedVisit)}
                  disabled={openingPdfId === targetedVisit.id}
                  className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  {openingPdfId === targetedVisit.id ? "Ouverture..." : "Ouvrir le PDF"}
                </button>
              ) : null}
              {onClearTargetedVisit ? (
                <button
                  type="button"
                  onClick={onClearTargetedVisit}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  Retirer le ciblage
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-4">
        <div className="font-medium mb-2">Historique des visites</div>
        {loading ? (
          <div className="text-sm text-slate-500">Chargement...</div>
        ) : visites.length === 0 ? (
          <div className="text-sm text-slate-500">Aucune visite enregistree.</div>
        ) : (
          <div className="space-y-3">
            {visites.map((visite) => {
              const isTargeted = targetedVisitId === visite.id;
              return (
                <div
                  key={visite.id}
                  ref={isTargeted ? targetedVisitRef : undefined}
                  data-visite-target={isTargeted ? "true" : undefined}
                  className={[
                    "rounded-xl border p-3 scroll-mt-24",
                    isTargeted ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {visite.titre || "Visite"} {visite.numero ? `#${visite.numero}` : ""} -{" "}
                      {new Date(visite.visit_datetime).toLocaleDateString("fr-FR")}
                    </div>
                    <div className="flex items-center gap-2">
                      {isTargeted ? <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-700">Cible recherche</span> : null}
                      {visite.phase && <span className="text-xs rounded-full border px-2 py-0.5">{visite.phase}</span>}
                      <button
                        type="button"
                        disabled={!visite.pdf_document_id || openingPdfId === visite.id}
                        className={[
                          "rounded-lg border px-3 py-1 text-xs",
                          visite.pdf_document_id && openingPdfId !== visite.id
                            ? "hover:bg-slate-50"
                            : "text-slate-400 border-slate-200",
                        ].join(" ")}
                        onClick={() => void openPdf(visite)}
                      >
                        {openingPdfId === visite.id ? "Ouverture..." : "Exporter PDF"}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Redacteur: {visite.redactor_email || "-"} | PDF: {visite.pdf_document_id ? "OK" : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <VisiteWizardDrawer
        open={wizardOpen}
        chantierId={chantierId}
        chantierName={chantierName}
        chantierReference={chantierReference}
        chantierAddress={chantierAddress}
        clientName={clientName}
        intervenants={intervenants}
        documents={documents}
        onClose={() => setWizardOpen(false)}
        onSaved={async () => {
          await refreshAll();
          if (onDocumentsRefresh) {
            await onDocumentsRefresh();
          }
        }}
      />
    </div>
  );
}