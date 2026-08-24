import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus } from "lucide-react";
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
      <div className="flex items-start justify-between gap-3 rounded-surface border border-subtle bg-surface p-4 shadow-sm">
        <div>
          <div className="bt-section-title text-ink">Visites de chantier</div>
          <div className="bt-secondary mt-1 text-muted">Creation de compte-rendu pro avec snapshot fige.</div>
        </div>
        <button
          type="button"
          className="bt-control inline-flex items-center gap-2 rounded-field bg-primary px-3 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover"
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Nouvelle visite
        </button>
      </div>

      {error && <div className="rounded-card border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-on">{error}</div>}

      {targetedVisitId ? (
        <div
          className={[
            "rounded-card border px-4 py-3 text-sm",
            targetedVisitMissing ? "border-warning/20 bg-warning-soft text-warning-on" : "border-primary/20 bg-primary-soft text-primary-on",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {targetedVisitMissing ? "Visite chantier ciblee introuvable" : "Visite chantier ciblee depuis la recherche globale"}
              </div>
              <p className="mt-1">
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
                  className="rounded-field border border-primary/20 bg-surface px-4 py-2 text-sm font-semibold text-primary-on hover:bg-interactive disabled:cursor-not-allowed disabled:border-subtle disabled:text-muted"
                >
                  {openingPdfId === targetedVisit.id ? "Ouverture..." : "Ouvrir le PDF"}
                </button>
              ) : null}
              {onClearTargetedVisit ? (
                <button
                  type="button"
                  onClick={onClearTargetedVisit}
                  className="rounded-field border border-subtle bg-surface px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive"
                >
                  Retirer le ciblage
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
        <div className="bt-card-title mb-3 text-ink">Historique des visites</div>
        {loading ? (
          <div className="text-sm text-muted">Chargement...</div>
        ) : visites.length === 0 ? (
          <div className="rounded-card border border-dashed border-subtle bg-interactive p-4 text-sm text-muted">Aucune visite enregistree.</div>
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
                    "rounded-card border p-3 scroll-mt-24",
                    isTargeted ? "border-primary/40 bg-primary-soft ring-2 ring-primary/20" : "border-subtle bg-surface",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {visite.titre || "Visite"} {visite.numero ? `#${visite.numero}` : ""} -{" "}
                      {new Date(visite.visit_datetime).toLocaleDateString("fr-FR")}
                    </div>
                    <div className="flex items-center gap-2">
                      {isTargeted ? <span className="rounded-full border border-primary/20 bg-surface px-2 py-0.5 text-xs font-medium text-primary-on">Cible recherche</span> : null}
                      {visite.phase && <span className="text-xs rounded-full border px-2 py-0.5">{visite.phase}</span>}
                      <button
                        type="button"
                        disabled={!visite.pdf_document_id || openingPdfId === visite.id}
                        className={[
                          "inline-flex items-center gap-1 rounded-field border px-3 py-1 text-xs font-semibold",
                          visite.pdf_document_id && openingPdfId !== visite.id
                            ? "border-subtle text-ink-secondary hover:bg-interactive"
                            : "text-muted border-subtle",
                        ].join(" ")}
                        onClick={() => void openPdf(visite)}
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {openingPdfId === visite.id ? "Ouverture..." : "Exporter PDF"}
                      </button>
                    </div>
                  </div>
                  <div className="bt-caption mt-1 text-muted">
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
