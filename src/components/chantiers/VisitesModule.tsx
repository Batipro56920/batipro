import { useEffect, useMemo, useState } from "react";
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
  onDocumentsRefresh?: () => Promise<void>;
};

export default function VisitesModule({
  chantierId,
  chantierName,
  chantierReference,
  chantierAddress,
  clientName,
  intervenants,
  onDocumentsRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [visites, setVisites] = useState<ChantierVisiteRow[]>([]);
  const [documents, setDocuments] = useState<ChantierDocumentRow[]>([]);
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);

  const documentsById = useMemo(() => {
    const map = new Map<string, ChantierDocumentRow>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

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

      <div className="rounded-2xl border bg-white p-4">
        <div className="font-medium mb-2">Historique des visites</div>
        {loading ? (
          <div className="text-sm text-slate-500">Chargement...</div>
        ) : visites.length === 0 ? (
          <div className="text-sm text-slate-500">Aucune visite enregistree.</div>
        ) : (
          <div className="space-y-3">
            {visites.map((visite) => (
              <div key={visite.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {visite.titre || "Visite"} {visite.numero ? `#${visite.numero}` : ""} -{" "}
                    {new Date(visite.visit_datetime).toLocaleDateString("fr-FR")}
                  </div>
                  <div className="flex items-center gap-2">
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
            ))}
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
