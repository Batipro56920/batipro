import { useEffect, useMemo, useRef, useState } from "react";
import type { IntervenantRow } from "../../services/intervenants.service";
import { extractTextFromPdf } from "../../services/pdfText.service";
import {
  CONTROLLED_LOTS,
  extractTasksFromDevisText,
  extractTasksFromDevisTextSimple,
  normalizeDevisText,
  summarizeExtractedTasks,
  type TaskLine,
} from "../../services/devisTasksExtraction.service";
import { createDevis, createDevisLigne, deleteDevis } from "../../services/devis.service";
import { createTask, deleteTasksByIds } from "../../services/chantierTasks.service";
import { deleteDocument, linkDocumentToTask, uploadDocument } from "../../services/chantierDocuments.service";

type ImportMode = "AI" | "SIMPLE";

type PreviewRow = TaskLine & {
  id: string;
  include: boolean;
  intervenant_id: string | null;
  showSource: boolean;
};

export type DevisImportResult = {
  devisId: string;
  linesInserted: number;
  tasksCreated: number;
  documentId: string | null;
  mode: ImportMode;
};

type Props = {
  open: boolean;
  chantierId: string | null;
  intervenants: IntervenantRow[];
  onClose: () => void;
  onImported: (result: DevisImportResult) => Promise<void> | void;
};

const UNIT_OPTIONS = ["m2", "ml", "u", "h", "forfait"] as const;

function stripExtension(name: string) {
  return (name ?? "").replace(/\.[^/.]+$/, "");
}

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function guessIntervenantId(name: string | null, intervenants: IntervenantRow[]): string | null {
  const source = normalizeText(name ?? "");
  if (!source) return null;
  for (const it of intervenants) {
    const candidate = normalizeText(it.nom ?? "");
    if (!candidate) continue;
    if (candidate.includes(source) || source.includes(candidate)) return it.id;
  }
  return null;
}

function isEmptyIntervenant(line: Pick<PreviewRow, "intervenant_id" | "intervenant_name">): boolean {
  const id = String(line.intervenant_id ?? "").trim();
  if (!id || id === "__NONE__") return true;

  const name = String(line.intervenant_name ?? "").trim().toLowerCase();
  return !name || name === "aucun" || name === "none" || name === "-";
}

export default function DevisImportDrawer({ open, chantierId, intervenants, onClose, onImported }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [devisName, setDevisName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("AI");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [bulkIntervenantId, setBulkIntervenantId] = useState("__NONE__");
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const bulkToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setFile(null);
    setDevisName("");
    setAnalyzing(false);
    setCreating(false);
    setError(null);
    setWarning(null);
    setMode("AI");
    setRows([]);
    setBulkIntervenantId("__NONE__");
    setBulkToast(null);
  }, [open]);

  const includedCount = useMemo(() => rows.filter((row) => row.include).length, [rows]);
  const debugSummary = useMemo(() => summarizeExtractedTasks(rows), [rows]);

  useEffect(() => {
    return () => {
      if (bulkToastTimerRef.current !== null) {
        window.clearTimeout(bulkToastTimerRef.current);
      }
    };
  }, []);

  function showBulkToast(message: string) {
    setBulkToast(message);
    if (bulkToastTimerRef.current !== null) {
      window.clearTimeout(bulkToastTimerRef.current);
    }
    bulkToastTimerRef.current = window.setTimeout(() => {
      setBulkToast(null);
      bulkToastTimerRef.current = null;
    }, 2400);
  }

  function onPickFile(next: File | null) {
    setFile(next);
    setError(null);
    if (next && !devisName.trim()) setDevisName(stripExtension(next.name));
  }

  async function onAnalyzePdf() {
    if (!chantierId) {
      setError("Chantier manquant.");
      return;
    }
    if (!file) {
      setError("Sélectionnez un PDF.");
      return;
    }
    if (!devisName.trim()) {
      setError("Nom du devis requis.");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setWarning(null);
    try {
      const rawText = await extractTextFromPdf(file);
      const cleanedText = normalizeDevisText(rawText);

      let extracted: TaskLine[] = [];
      let extractedMode: ImportMode = "AI";
      try {
        extracted = await extractTasksFromDevisText(cleanedText);
      } catch (aiError: any) {
        extractedMode = "SIMPLE";
        extracted = extractTasksFromDevisTextSimple(cleanedText);
        setWarning(
          `Mode IA indisponible (${aiError?.message ?? "erreur inconnue"}). Basculé en mode simple (regex).`,
        );
      }

      if (!extracted.length) {
        throw new Error("Aucune ligne de travaux détectée.");
      }

      const previewRows: PreviewRow[] = extracted.map((line, index) => ({
        ...line,
        id: `row-${index}-${crypto.randomUUID()}`,
        include: true,
        intervenant_id: guessIntervenantId(line.intervenant_name, intervenants),
        showSource: false,
      }));

      setMode(extractedMode);
      setRows(previewRows);
      setStep(2);
    } catch (err: any) {
      setError(err?.message ?? "Erreur analyse PDF.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateRow(rowId: string, patch: Partial<PreviewRow>) {
    setRows((previous) => previous.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function applyIntervenantAll(intervenantId: string) {
    const targetId = intervenantId === "__NONE__" ? null : intervenantId;
    if (!targetId) {
      setError("Selectionnez un intervenant par defaut.");
      return;
    }

    let changed = 0;
    setRows((previous) =>
      previous.map((row) => {
        if (!row.include) return row;
        if (row.intervenant_id === targetId) return row;
        changed += 1;
        return { ...row, intervenant_id: targetId };
      }),
    );
    showBulkToast(`Intervenant applique a ${changed} ligne(s).`);
  }

  function applyIntervenantOnlyEmpty(intervenantId: string) {
    const targetId = intervenantId === "__NONE__" ? null : intervenantId;
    if (!targetId) {
      setError("Selectionnez un intervenant par defaut.");
      return;
    }

    let changed = 0;
    setRows((previous) =>
      previous.map((row) => {
        if (!row.include) return row;
        if (!isEmptyIntervenant(row)) return row;
        changed += 1;
        return { ...row, intervenant_id: targetId };
      }),
    );
    showBulkToast(`Intervenant applique a ${changed} ligne(s).`);
  }

  function clearIntervenantAll() {
    let changed = 0;
    setRows((previous) =>
      previous.map((row) => {
        if (!row.include) return row;
        if (row.intervenant_id === null) return row;
        changed += 1;
        return { ...row, intervenant_id: null };
      }),
    );
    showBulkToast(`Intervenant efface sur ${changed} ligne(s).`);
  }

  async function onCreateTasks() {
    if (!chantierId) {
      setError("Chantier manquant.");
      return;
    }

    const selectedRows = rows.filter((row) => row.include);
    if (!selectedRows.length) {
      setError("Sélectionnez au moins une ligne.");
      return;
    }
    if (!file) {
      setError("PDF introuvable.");
      return;
    }

    setCreating(true);
    setError(null);

    let createdDevisId: string | null = null;
    let createdDocument: { id: string; storage_path?: string | null } | null = null;
    const createdTaskIds: string[] = [];

    try {
      const createdDevis = await createDevis({
        chantier_id: chantierId,
        nom: devisName.trim(),
      });
      createdDevisId = createdDevis.id;

      const createdDoc = await uploadDocument({
        chantierId,
        file,
        title: devisName.trim(),
        category: "Administratif",
        documentType: "PDF",
        visibility_mode: "GLOBAL",
      });
      createdDocument = { id: createdDoc.id, storage_path: createdDoc.storage_path };

      let ordre = 1;
      for (const row of selectedRows) {
        await createDevisLigne({
          devis_id: createdDevis.id,
          ordre,
          corps_etat: row.lot,
          entreprise: row.intervenant_name,
          designation: row.title,
          unite: row.unit,
          quantite: row.quantity,
          generer_tache: true,
          titre_tache: row.source_line,
          date_prevue: row.date,
        });
        ordre += 1;

        const createdTask = await createTask({
          chantier_id: chantierId,
          titre: row.title,
          corps_etat: row.lot,
          date: row.date,
          status: "A_FAIRE",
          intervenant_id: row.intervenant_id,
          quantite: row.quantity ?? 1,
          unite: row.unit,
        });
        createdTaskIds.push(createdTask.id);

        await linkDocumentToTask(createdTask.id, createdDoc.id);
      }

      await onImported({
        devisId: createdDevis.id,
        linesInserted: selectedRows.length,
        tasksCreated: createdTaskIds.length,
        documentId: createdDoc.id,
        mode,
      });
      onClose();
    } catch (err: any) {
      const cleanupErrors: string[] = [];

      try {
        if (createdTaskIds.length) await deleteTasksByIds(createdTaskIds);
      } catch (cleanupErr: any) {
        cleanupErrors.push(`Rollback tâches: ${cleanupErr?.message ?? cleanupErr}`);
      }

      try {
        if (createdDocument?.id) await deleteDocument(createdDocument.id, createdDocument.storage_path ?? null);
      } catch (cleanupErr: any) {
        cleanupErrors.push(`Rollback document: ${cleanupErr?.message ?? cleanupErr}`);
      }

      try {
        if (createdDevisId) await deleteDevis(createdDevisId);
      } catch (cleanupErr: any) {
        cleanupErrors.push(`Rollback devis: ${cleanupErr?.message ?? cleanupErr}`);
      }

      const baseMessage = err?.message ?? "Erreur création devis/tâches.";
      setError(cleanupErrors.length ? `${baseMessage} (${cleanupErrors.join(" | ")})` : baseMessage);
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-screen w-full sm:w-[92vw] lg:w-[82vw] xl:w-[74vw] bg-white border-l shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">Importer devis (PDF)</div>
          <button type="button" className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="px-4 py-2 border-b flex items-center gap-2 text-xs">
          <span className={["chip-btn", step === 1 ? "chip-btn--active" : "chip-btn--inactive"].join(" ")}>1. Upload + analyse</span>
          <span className={["chip-btn", step === 2 ? "chip-btn--active" : "chip-btn--inactive"].join(" ")}>2. Aperçu + validation</span>
          {mode === "SIMPLE" && (
            <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
              Mode simple (regex)
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {warning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{warning}</div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Nom du devis</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={devisName}
                    onChange={(event) => setDevisName(event.target.value)}
                    placeholder="Ex: Devis rénovation salle de bains"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Fichier PDF</div>
                  <input type="file" accept="application/pdf" onChange={(event) => onPickFile(event.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {"Pipeline: extraction PDF -> nettoyage -> IA -> fallback regex -> apercu obligatoire."}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                <div className="text-sm font-semibold text-slate-800">Edition en masse</div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="min-w-[260px] rounded-lg border px-2 py-1.5 text-sm bg-white disabled:bg-slate-100"
                    value={bulkIntervenantId}
                    onChange={(event) => setBulkIntervenantId(event.target.value)}
                    disabled={creating || intervenants.length === 0}
                  >
                    <option value="__NONE__">Intervenant par defaut</option>
                    {intervenants.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.nom}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-lg border px-2.5 py-1.5 text-sm hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => applyIntervenantAll(bulkIntervenantId)}
                    disabled={creating || intervenants.length === 0 || bulkIntervenantId === "__NONE__"}
                  >
                    Appliquer a toutes les lignes
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-2.5 py-1.5 text-sm hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => applyIntervenantOnlyEmpty(bulkIntervenantId)}
                    disabled={creating || intervenants.length === 0 || bulkIntervenantId === "__NONE__"}
                  >
                    Appliquer uniquement aux lignes vides
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={clearIntervenantAll}
                    disabled={creating}
                  >
                    Effacer sur toutes les lignes
                  </button>
                </div>
                <div className="text-xs text-slate-600">
                  Astuce : applique l&apos;intervenant a toutes les lignes pour gagner du temps.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border bg-slate-50 px-2 py-1">Lignes extraites: {debugSummary.extractedCount}</span>
                <span className="rounded-full border bg-slate-50 px-2 py-1">Avec lot: {debugSummary.withLot}</span>
                <span className="rounded-full border bg-slate-50 px-2 py-1">Avec quantité: {debugSummary.withQuantity}</span>
              </div>

              <div className="rounded-xl border overflow-auto">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs">
                    <tr>
                      <th className="p-2 text-left">Inclure</th>
                      <th className="p-2 text-left">Titre</th>
                      <th className="p-2 text-left">Lot</th>
                      <th className="p-2 text-left">Qté</th>
                      <th className="p-2 text-left">Unité</th>
                      <th className="p-2 text-left">Intervenant</th>
                      <th className="p-2 text-left">Conf.</th>
                      <th className="p-2 text-left">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t align-top">
                        <td className="p-2">
                          <input type="checkbox" checked={row.include} onChange={(event) => updateRow(row.id, { include: event.target.checked })} />
                        </td>
                        <td className="p-2">
                          <input
                            className="w-full rounded-lg border px-2 py-1.5 text-sm"
                            value={row.title}
                            onChange={(event) => updateRow(row.id, { title: event.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className="w-full rounded-lg border px-2 py-1.5 text-sm"
                            value={row.lot ?? ""}
                            onChange={(event) => updateRow(row.id, { lot: (event.target.value || null) as any })}
                          >
                            <option value="">—</option>
                            {CONTROLLED_LOTS.map((lot) => (
                              <option key={lot} value={lot}>
                                {lot}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            className="w-[88px] rounded-lg border px-2 py-1.5 text-sm"
                            value={row.quantity ?? ""}
                            onChange={(event) => {
                              const raw = event.target.value.trim().replace(",", ".");
                              const next = raw === "" ? null : Number(raw);
                              updateRow(row.id, { quantity: Number.isFinite(next as number) ? (next as number) : null });
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className="w-[100px] rounded-lg border px-2 py-1.5 text-sm"
                            value={row.unit ?? ""}
                            onChange={(event) => updateRow(row.id, { unit: event.target.value || null })}
                          >
                            <option value="">—</option>
                            {UNIT_OPTIONS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            className="w-full rounded-lg border px-2 py-1.5 text-sm"
                            value={row.intervenant_id ?? "__NONE__"}
                            onChange={(event) => updateRow(row.id, { intervenant_id: event.target.value === "__NONE__" ? null : event.target.value })}
                          >
                            <option value="__NONE__">Aucun</option>
                            {intervenants.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.nom}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <span className="rounded-full border px-2 py-1 text-xs">{Math.round((row.confidence ?? 0) * 100)}%</span>
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => updateRow(row.id, { showSource: !row.showSource })}
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            {row.showSource ? "Masquer" : "Voir"}
                          </button>
                          {row.showSource && <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{row.source_line}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">{step === 2 ? `${includedCount} ligne(s) incluse(s)` : "Étape 1 sur 2"}</div>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setStep(1)}
                disabled={creating}
              >
                Retour
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                className={["rounded-xl px-4 py-2 text-sm text-white", analyzing ? "bg-slate-400" : "bg-[#2563EB] hover:bg-[#1d4ed8]"].join(" ")}
                onClick={onAnalyzePdf}
                disabled={analyzing}
              >
                {analyzing ? "Analyse..." : "Analyser le PDF"}
              </button>
            ) : (
              <button
                type="button"
                className={["rounded-xl px-4 py-2 text-sm text-white", creating ? "bg-slate-400" : "bg-[#2563EB] hover:bg-[#1d4ed8]"].join(" ")}
                onClick={onCreateTasks}
                disabled={creating}
              >
                {creating ? "Création..." : `Créer ${includedCount} tâche(s)`}
              </button>
            )}
          </div>
        </div>

        {bulkToast && (
          <div className="absolute bottom-20 right-4 z-10 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-md">
            {bulkToast}
          </div>
        )}
      </div>
    </div>
  );
}
