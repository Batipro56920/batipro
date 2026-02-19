import { useEffect, useMemo, useState } from "react";
import type { ChantierDocumentRow } from "../../services/chantierDocuments.service";
import { getSignedUrl, uploadDocument } from "../../services/chantierDocuments.service";
import {
  listDoeItemsByChantierId,
  removeDoeItem,
  reorderDoeItems,
  upsertDoeItem,
} from "../../services/chantierDoe.service";
import { generateDoeFinalPdfBlob } from "../../services/chantiersReportsPdf.service";
import { getCompanyBrandingForPdf } from "../../services/companySettings.service";

type Props = {
  chantierId: string;
  chantierName: string;
  chantierAddress?: string | null;
  clientName?: string | null;
  documents: ChantierDocumentRow[];
  onDocumentsRefresh: () => Promise<void>;
};

export default function DoeTab({
  chantierId,
  chantierName,
  chantierAddress,
  clientName,
  documents,
  onDocumentsRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("__ALL__");
  const [typeFilter, setTypeFilter] = useState("__ALL__");

  const docsById = useMemo(() => {
    const map = new Map<string, ChantierDocumentRow>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

  const categories = useMemo(() => {
    return Array.from(new Set(documents.map((doc) => doc.category || "Divers"))).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const types = useMemo(() => {
    return Array.from(new Set(documents.map((doc) => doc.document_type || "AUTRE"))).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (categoryFilter !== "__ALL__" && (doc.category || "") !== categoryFilter) return false;
      if (typeFilter !== "__ALL__" && (doc.document_type || "") !== typeFilter) return false;
      return true;
    });
  }, [documents, categoryFilter, typeFilter]);

  const orderedDocuments = useMemo(() => {
    return orderedIds.map((id) => docsById.get(id)).filter((doc): doc is ChantierDocumentRow => Boolean(doc));
  }, [orderedIds, docsById]);

  async function loadItems() {
    if (!chantierId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await listDoeItemsByChantierId(chantierId);
      setOrderedIds(items.map((item) => item.document_id));
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement DOE.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [chantierId]);

  async function toggleInclude(documentId: string, checked: boolean) {
    if (!chantierId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (checked) {
        await upsertDoeItem({
          chantier_id: chantierId,
          document_id: documentId,
          sort_order: orderedIds.length + 1,
        });
        setOrderedIds((prev) => [...prev, documentId]);
      } else {
        const next = orderedIds.filter((id) => id !== documentId);
        await removeDoeItem(chantierId, documentId);
        if (next.length > 0) {
          await reorderDoeItems(chantierId, next);
        }
        setOrderedIds(next);
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise à jour DOE.");
    } finally {
      setSaving(false);
    }
  }

  async function moveItem(documentId: string, direction: -1 | 1) {
    const index = orderedIds.findIndex((id) => id === documentId);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setOrderedIds(next);
    try {
      await reorderDoeItems(chantierId, next);
    } catch (err: any) {
      setError(err?.message ?? "Erreur tri DOE.");
    }
  }

  async function generateDoeFinal() {
    if (!chantierId) return;
    if (!orderedDocuments.length) {
      setError("Sélectionnez au moins un document.");
      return;
    }
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const docsForPdf = [];
      for (const doc of orderedDocuments) {
        if (!doc.storage_path) continue;
        const signedUrl = await getSignedUrl(doc.storage_path, 180);
        docsForPdf.push({
          title: doc.title || doc.file_name || "Document",
          mimeType: doc.mime_type,
          signedUrl,
        });
      }
      if (!docsForPdf.length) {
        throw new Error("Aucun document exploitable pour le DOE final.");
      }
      const nowIso = new Date().toISOString();
      const company = await getCompanyBrandingForPdf();
      const blob = await generateDoeFinalPdfBlob({
        chantierName,
        chantierAddress,
        clientName,
        companyName: company.companyName,
        generatedAt: nowIso,
        documents: docsForPdf,
        company,
      });
      const datePart = nowIso.slice(0, 10);
      const file = new File([blob], `DOE-final-${datePart}.pdf`, { type: "application/pdf" });
      await uploadDocument({
        chantierId,
        file,
        title: `DOE final - ${datePart}`,
        category: "DOE",
        documentType: "PDF",
        visibility_mode: "GLOBAL",
      });
      await onDocumentsRefresh();
      await loadItems();
      setMessage("DOE final généré et classé dans Documents.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur génération DOE.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold section-title">DOE</div>
          <div className="text-sm text-slate-500">Sélectionnez, ordonnez et générez le DOE final.</div>
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={generateDoeFinal}
          className={[
            "rounded-xl px-4 py-2 text-sm",
            generating ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
          ].join(" ")}
        >
          {generating ? "Génération..." : "Générer DOE final"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <div className="text-xs text-slate-600">Filtrer par catégorie</div>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="__ALL__">Toutes</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <div className="text-xs text-slate-600">Filtrer par type</div>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="__ALL__">Tous</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="font-medium">Pièces DOE</div>
        {loading ? (
          <div className="text-sm text-slate-500">Chargement...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun document.</div>
        ) : (
          <div className="space-y-2">
            {filteredDocuments.map((doc) => {
              const checked = orderedIds.includes(doc.id);
              const orderIndex = orderedIds.indexOf(doc.id);
              return (
                <div key={doc.id} className="rounded-xl border p-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm min-w-[240px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={(e) => toggleInclude(doc.id, e.target.checked)}
                    />
                    <span>{doc.title || doc.file_name}</span>
                  </label>
                  <div className="text-xs text-slate-500">
                    {doc.category} - {doc.document_type}
                  </div>
                  {checked && (
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="text-xs text-slate-500">Ordre #{orderIndex + 1}</div>
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => moveItem(doc.id, -1)}
                        disabled={orderIndex <= 0}
                      >
                        Haut
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => moveItem(doc.id, 1)}
                        disabled={orderIndex >= orderedIds.length - 1}
                      >
                        Bas
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="font-medium mb-2">Ordre final</div>
        {orderedDocuments.length === 0 ? (
          <div className="text-sm text-slate-500">Aucune pièce sélectionnée.</div>
        ) : (
          <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
            {orderedDocuments.map((doc) => (
              <li key={doc.id}>{doc.title || doc.file_name}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
