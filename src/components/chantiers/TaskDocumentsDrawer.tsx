import { useEffect, useMemo, useState } from "react";
import { getSignedUrl, type ChantierDocumentRow } from "../../services/chantierDocuments.service";

type Props = {
  open: boolean;
  taskTitle: string;
  documents: ChantierDocumentRow[];
  selectedIds: string[];
  onSelectionChange: (next: string[]) => void;
  query: string;
  onQueryChange: (next: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error?: string | null;
  loading?: boolean;
};

export default function TaskDocumentsDrawer({
  open,
  taskTitle,
  documents,
  selectedIds,
  onSelectionChange,
  query,
  onQueryChange,
  onClose,
  onSave,
  saving,
  error,
  loading,
}: Props) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [signedUrlCache, setSignedUrlCache] = useState<Record<string, string>>({});

  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => {
      const title = (doc.title ?? "").toLowerCase();
      const fileName = (doc.file_name ?? "").toLowerCase();
      const category = (doc.category ?? "").toLowerCase();
      const docType = (doc.document_type ?? "").toLowerCase();
      return (
        title.includes(q) ||
        fileName.includes(q) ||
        category.includes(q) ||
        docType.includes(q)
      );
    });
  }, [documents, query]);

  const selectedDoc = useMemo(() => {
    if (!selectedDocId) return null;
    return documents.find((doc) => doc.id === selectedDocId) ?? null;
  }, [documents, selectedDocId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSelectedDocId(null);
      setPreviewUrl("");
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    if (!selectedDocId && filteredDocuments.length > 0) {
      setSelectedDocId(filteredDocuments[0].id);
    }
  }, [open, filteredDocuments, selectedDocId]);

  useEffect(() => {
    async function loadPreviewUrl(doc: ChantierDocumentRow) {
      if (!doc.storage_path) {
        setPreviewError("Chemin de stockage manquant.");
        setPreviewUrl("");
        setPreviewLoading(false);
        return;
      }

      const cached = signedUrlCache[doc.id];
      if (cached) {
        setPreviewUrl(cached);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const url = await getSignedUrl(doc.storage_path, 60);
        setSignedUrlCache((prev) => ({ ...prev, [doc.id]: url }));
        setPreviewUrl(url);
      } catch (err: any) {
        setPreviewError(err?.message ?? "Impossible de generer l'URL signee.");
        setPreviewUrl("");
      } finally {
        setPreviewLoading(false);
      }
    }

    if (selectedDoc) {
      void loadPreviewUrl(selectedDoc);
    } else {
      setPreviewUrl("");
      setPreviewError(null);
      setPreviewLoading(false);
    }
  }, [selectedDoc, signedUrlCache]);

  async function openSelectedInNewTab() {
    if (!selectedDoc?.storage_path) return;
    try {
      const url = previewUrl || (await getSignedUrl(selectedDoc.storage_path, 60));
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      setPreviewError(err?.message ?? "Impossible d'ouvrir le document.");
    }
  }

  if (!open) return null;

  const canPreviewImage = (selectedDoc?.mime_type ?? "").startsWith("image/");
  const canPreviewPdf = selectedDoc?.mime_type === "application/pdf";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-screen w-[50vw] max-w-[900px] min-w-[360px] bg-white border-l shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold truncate">Lier des documents — {taskTitle}</div>
          <button
            type="button"
            className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
            onClick={onClose}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-[55%] border-r overflow-auto p-4 space-y-3">
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Rechercher un document..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />

            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Sel.</th>
                      <th className="px-3 py-2 text-left font-medium">Document</th>
                      <th className="px-3 py-2 text-left font-medium">Categorie</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-slate-500" colSpan={4}>
                          Chargement...
                        </td>
                      </tr>
                    ) : filteredDocuments.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-slate-500" colSpan={4}>
                          Aucun document trouve.
                        </td>
                      </tr>
                    ) : (
                      filteredDocuments.map((doc) => {
                        const checked = selectedIds.includes(doc.id);
                        const isSelected = doc.id === selectedDocId;

                        return (
                          <tr
                            key={doc.id}
                            className={[
                              "border-t cursor-pointer",
                              isSelected ? "bg-slate-50" : "hover:bg-slate-50/60",
                            ].join(" ")}
                            onClick={() => setSelectedDocId(doc.id)}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() =>
                                  onSelectionChange(
                                    checked
                                      ? selectedIds.filter((id) => id !== doc.id)
                                      : [...selectedIds, doc.id],
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium truncate">{doc.title}</div>
                              <div className="text-xs text-slate-500 truncate">{doc.file_name}</div>
                            </td>
                            <td className="px-3 py-2">{doc.category}</td>
                            <td className="px-3 py-2">{doc.document_type}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="w-[45%] overflow-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Apercu</div>
              <button
                type="button"
                onClick={openSelectedInNewTab}
                className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                disabled={!selectedDoc || previewLoading}
              >
                Ouvrir
              </button>
            </div>

            {previewLoading ? (
              <div className="text-sm text-slate-500">Chargement...</div>
            ) : previewError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {previewError}
              </div>
            ) : !selectedDoc ? (
              <div className="text-sm text-slate-500">Selectionnez un document.</div>
            ) : canPreviewImage ? (
              <img src={previewUrl} alt={selectedDoc.title} className="max-h-[70vh] w-auto mx-auto" />
            ) : canPreviewPdf ? (
              <iframe
                src={previewUrl}
                title={selectedDoc.title}
                className="w-full h-[70vh] rounded-xl border"
              />
            ) : (
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                Apercu non disponible.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 my-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="border-t p-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={[
              "rounded-xl px-4 py-2 text-sm",
              saving ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
            ].join(" ")}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}


