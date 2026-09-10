import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Image, Loader2, PackagePlus, Unlink, UploadCloud } from "lucide-react";
import type { SupplierRow } from "../../../services/suppliers.service";
import type { ProductCatalogDraft, ProductKnowledge } from "../domain/types";
import { saveProductCatalogItem } from "../infrastructure/productCatalogRepository";
import { analyzeProductTextWithCoco } from "../services/productKnowledge.service";
import {
  ACCEPTED_PRODUCT_FILES,
  SUPPORTED_PRODUCT_FILE_LABEL,
  isImageFile,
  isSupportedProductFile,
  readProductFilesForAnalysis,
} from "../services/productFileReader";
import {
  PRODUCT_MATCH_THRESHOLD,
  buildImportSignature,
  buildProductPatch,
  createEmptyProductDraft,
  mergeProductPatches,
  parseLooseNumber,
  scoreSignatureMatch,
  storeProductFiles,
  type ProductDraftPatch,
  type ProductImportSignature,
} from "../services/productImportMapper";

/** Analyses menees en parallele. Assez pour aller vite, assez peu pour ne pas saturer la fonction edge. */
const ANALYSIS_CONCURRENCY = 3;

type FileStatus = "pending" | "analyzing" | "analyzed" | "failed";

type AnalyzedFile = {
  id: string;
  file: File;
  status: FileStatus;
  groupId: string;
  knowledge: ProductKnowledge | null;
  signature: ProductImportSignature | null;
  patch: ProductDraftPatch | null;
  storageNotes: string[];
  error: string | null;
};

type GroupEdits = {
  designation?: string;
  brand?: string;
  supplierId?: string;
  purchasePrice?: string;
  salePrice?: string;
};

type ProductGroup = {
  id: string;
  files: AnalyzedFile[];
  draft: ProductCatalogDraft;
  edits: GroupEdits;
  warnings: string[];
};

const CURRENCY = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const cellClass = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-blue-400 disabled:opacity-60";

/**
 * Tant que l'utilisateur n'a rien saisi, on montre ce que Coco a trouve. Des
 * qu'il saisit, on lui rend son texte tel quel pour ne pas gener la frappe.
 */
function priceFieldValue(edited: string | undefined, value: number | null | undefined): string {
  if (edited !== undefined) return edited;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? String(value) : "";
}

function formatPrice(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? CURRENCY.format(value) : "—";
}

/**
 * Import en lot. On depose tout d'un coup — fiches techniques et captures de
 * tarifs melangees. Chaque fichier est analyse separement, puis les fichiers qui
 * decrivent le meme produit sont rapproches pour ne creer qu'une seule fiche.
 * Rien n'est ecrit au catalogue avant validation.
 */
export default function ProductBulkImportPanel({
  suppliers,
  onImported,
}: {
  suppliers: SupplierRow[];
  onImported: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<AnalyzedFile[]>([]);
  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());
  const [createdGroups, setCreatedGroups] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [batchSupplierId, setBatchSupplierId] = useState("");
  const [edits, setEdits] = useState<Record<string, GroupEdits>>({});

  const analyzedCount = files.filter((row) => row.status === "analyzed").length;
  const failedFiles = files.filter((row) => row.status === "failed");
  const busy = analyzing || creating;

  const groups = useMemo<ProductGroup[]>(() => {
    const byGroup = new Map<string, AnalyzedFile[]>();
    for (const row of files) {
      if (row.status !== "analyzed" || !row.patch) continue;
      const bucket = byGroup.get(row.groupId);
      if (bucket) bucket.push(row);
      else byGroup.set(row.groupId, [row]);
    }

    return Array.from(byGroup, ([id, rows]) => {
      // L'identite vient du fichier le plus descriptif : la fiche technique
      // plutot que la capture de prix.
      const ordered = [...rows].sort((a, b) => Number(b.signature?.hasIdentity) - Number(a.signature?.hasIdentity));
      const merged = mergeProductPatches(ordered.map((row) => row.patch as ProductDraftPatch));
      const draft = { ...createEmptyProductDraft(), ...merged } as ProductCatalogDraft;

      const batchSupplier = batchSupplierId ? suppliers.find((row) => row.id === batchSupplierId) ?? null : null;
      if (!draft.mainSupplierId && batchSupplier) {
        draft.mainSupplierId = batchSupplier.id;
        draft.mainSupplierName = batchSupplier.name;
      }

      const edit = edits[id] ?? {};
      if (edit.designation !== undefined) draft.designation = edit.designation;
      if (edit.brand !== undefined) draft.brand = edit.brand.trim() || null;
      if (edit.supplierId !== undefined) {
        const chosen = suppliers.find((row) => row.id === edit.supplierId) ?? null;
        draft.mainSupplierId = chosen?.id ?? null;
        draft.mainSupplierName = chosen?.name ?? null;
      }
      if (edit.purchasePrice !== undefined) draft.standardPurchasePriceHt = parseLooseNumber(edit.purchasePrice) ?? 0;
      if (edit.salePrice !== undefined) draft.recommendedSalePriceHt = parseLooseNumber(edit.salePrice) ?? 0;

      const warnings = ordered.flatMap((row) => row.storageNotes);
      if (!draft.mainSupplierName) warnings.push("Fournisseur non identifie");
      if (!draft.standardPurchasePriceHt) warnings.push("Prix d'achat non trouve");

      return { id, files: ordered, draft, edits: edit, warnings };
    }).filter((group) => Boolean(group.draft.designation?.trim()));
  }, [files, batchSupplierId, suppliers, edits]);

  const selectedGroups = groups.filter((group) => !excludedGroups.has(group.id) && !createdGroups.has(group.id));

  function patchFile(id: string, patch: Partial<AnalyzedFile>) {
    setFiles((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function onFilesSelected(fileList: FileList | null) {
    setError(null);
    setSummary(null);
    if (!fileList?.length) return;

    const selected = Array.from(fileList);
    const unsupported = selected.find((file) => !isSupportedProductFile(file));
    if (unsupported) {
      setError(`Fichier non pris en charge : ${unsupported.name}. Formats acceptes : ${SUPPORTED_PRODUCT_FILE_LABEL}.`);
      return;
    }

    const nextRows: AnalyzedFile[] = selected.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending",
      groupId: crypto.randomUUID(),
      knowledge: null,
      signature: null,
      patch: null,
      storageNotes: [],
      error: null,
    }));
    setFiles((current) => [...current, ...nextRows]);
    if (inputRef.current) inputRef.current.value = "";
    await analyzeFiles(nextRows);
  }

  async function analyzeOne(row: AnalyzedFile) {
    patchFile(row.id, { status: "analyzing", error: null });
    try {
      const { text, images } = await readProductFilesForAnalysis([row.file]);
      if (text.length < 20 && images.length === 0) {
        throw new Error("Contenu illisible : aucune information exploitable.");
      }

      const base = createEmptyProductDraft();
      const knowledge = await analyzeProductTextWithCoco(base, text, images);
      const stored = await storeProductFiles("", [row.file]);
      const patch = buildProductPatch(base, knowledge, stored.documents, suppliers, text);

      patchFile(row.id, {
        status: "analyzed",
        knowledge,
        signature: buildImportSignature(knowledge),
        patch,
        storageNotes: stored.notes,
      });
    } catch (err: any) {
      patchFile(row.id, { status: "failed", error: err?.message ?? "Analyse impossible." });
    }
  }

  async function analyzeFiles(targets: AnalyzedFile[]) {
    setAnalyzing(true);
    try {
      const queue = [...targets];
      const workers = Array.from({ length: Math.min(ANALYSIS_CONCURRENCY, queue.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          await analyzeOne(next);
        }
      });
      await Promise.all(workers);
      setFiles((current) => regroupFiles(current));
    } finally {
      setAnalyzing(false);
    }
  }

  /** Detache un fichier de son produit : il repart seul, a regrouper autrement. */
  function detachFile(id: string) {
    patchFile(id, { groupId: crypto.randomUUID() });
  }

  function editGroup(id: string, patch: GroupEdits) {
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function toggleGroup(id: string, include: boolean) {
    setExcludedGroups((current) => {
      const next = new Set(current);
      if (include) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createSelectedProducts() {
    if (!selectedGroups.length) return;
    setCreating(true);
    setError(null);
    setSummary(null);

    let created = 0;
    const failures: string[] = [];
    const done = new Set(createdGroups);

    for (const group of selectedGroups) {
      try {
        await saveProductCatalogItem(group.draft, "import en lot fiches produits");
        done.add(group.id);
        created += 1;
      } catch (err: any) {
        failures.push(`${group.draft.designation} : ${err?.message ?? "creation refusee"}`);
      }
    }

    setCreatedGroups(done);
    setCreating(false);
    setSummary(created ? `${created} produit(s) cree(s) au catalogue.` : null);
    if (failures.length) setError(failures.join("\n"));
    if (created) await onImported();
  }

  function reset() {
    setFiles([]);
    setEdits({});
    setBatchSupplierId("");
    setExcludedGroups(new Set());
    setCreatedGroups(new Set());
    setError(null);
    setSummary(null);
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">Import en lot de fiches produits</div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Deposez tout d'un coup : fiches techniques et captures de tarifs melangees. Coco lit chaque fichier, rapproche
            ceux qui parlent du meme produit et vous propose une fiche par produit — marque, fournisseur, prix d'achat,
            prix de vente conseille — avec les pieces conservees pour le DOE.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-blue-300">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {analyzing ? "Analyse..." : "Deposer les fichiers"}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_PRODUCT_FILES}
              disabled={busy}
              className="sr-only"
              onChange={(event) => void onFilesSelected(event.target.files)}
            />
          </label>
          {files.length ? (
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Vider
            </button>
          ) : null}
        </div>
      </div>

      {analyzing ? (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-white px-3 py-2 text-sm text-blue-800">
          {analyzedCount} / {files.length} fichier(s) analyse(s)...
        </div>
      ) : null}

      {groups.length ? (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor="batch-supplier" className="text-sm font-semibold text-slate-800">Fournisseur du lot</label>
          <select
            id="batch-supplier"
            className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-sm sm:max-w-xs"
            value={batchSupplierId}
            disabled={busy}
            onChange={(event) => setBatchSupplierId(event.target.value)}
          >
            <option value="">Laisser ce que Coco a trouve</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            Applique aux produits dont le fournisseur n'a pas ete trouve. Une capture de tarif ne le nomme pas toujours.
          </span>
        </div>
      ) : null}

      {error ? <div className="mt-4 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {summary ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> {summary}
        </div>
      ) : null}

      {failedFiles.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-semibold">{failedFiles.length} fichier(s) non exploitable(s)</div>
          <ul className="mt-1 space-y-0.5">
            {failedFiles.map((row) => (
              <li key={row.id} className="truncate">{row.file.name} — {row.error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {groups.length ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-blue-100 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2">Marque</th>
                <th className="px-3 py-2">Fournisseur</th>
                <th className="px-3 py-2 text-right">Achat HT</th>
                <th className="px-3 py-2 text-right">Vente HT</th>
                <th className="px-3 py-2">Fichiers rattaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => {
                const isCreated = createdGroups.has(group.id);
                return (
                  <tr key={group.id} className={isCreated ? "bg-emerald-50/60" : undefined}>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={!excludedGroups.has(group.id) && !isCreated}
                        disabled={busy || isCreated}
                        onChange={(event) => toggleGroup(group.id, event.target.checked)}
                        aria-label={`Inclure ${group.draft.designation}`}
                        title={group.draft.designation}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      {isCreated ? (
                        <>
                          <div className="font-medium text-slate-950">{group.draft.designation}</div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Cree au catalogue
                          </div>
                        </>
                      ) : (
                        <>
                          <textarea
                            className={cellClass + " min-h-[52px] resize-y font-medium text-slate-950"}
                            value={group.draft.designation}
                            disabled={busy}
                            onChange={(event) => editGroup(group.id, { designation: event.target.value })}
                            aria-label="Designation du produit"
                          />
                          {group.warnings.length ? (
                            <div className="mt-1 flex items-start gap-1 text-xs text-amber-600">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {group.warnings.join(" · ")}
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600">
                      {isCreated ? (group.draft.brand || "—") : (
                        <input
                          className={cellClass}
                          value={group.draft.brand ?? ""}
                          disabled={busy}
                          onChange={(event) => editGroup(group.id, { brand: event.target.value })}
                          aria-label="Marque"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600">
                      {isCreated ? (group.draft.mainSupplierName || "—") : (
                        <select
                          className={cellClass}
                          value={group.draft.mainSupplierId ?? ""}
                          disabled={busy}
                          onChange={(event) => editGroup(group.id, { supplierId: event.target.value })}
                          aria-label="Fournisseur"
                        >
                          <option value="">Aucun</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-slate-900">
                      {isCreated ? formatPrice(group.draft.standardPurchasePriceHt) : (
                        <input
                          className={cellClass + " text-right"}
                          inputMode="decimal"
                          value={priceFieldValue(group.edits.purchasePrice, group.draft.standardPurchasePriceHt)}
                          disabled={busy}
                          onChange={(event) => editGroup(group.id, { purchasePrice: event.target.value })}
                          aria-label="Prix d'achat HT"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-slate-900">
                      {isCreated ? formatPrice(group.draft.recommendedSalePriceHt) : (
                        <input
                          className={cellClass + " text-right"}
                          inputMode="decimal"
                          value={priceFieldValue(group.edits.salePrice, group.draft.recommendedSalePriceHt)}
                          disabled={busy}
                          onChange={(event) => editGroup(group.id, { salePrice: event.target.value })}
                          aria-label="Prix de vente conseille HT"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {group.files.map((row) => (
                          <span
                            key={row.id}
                            className="inline-flex max-w-52 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                            title={row.file.name}
                          >
                            {isImageFile(row.file) ? <Image className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{row.file.name}</span>
                            {group.files.length > 1 && !isCreated ? (
                              <button
                                type="button"
                                onClick={() => detachFile(row.id)}
                                disabled={busy}
                                className="shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-50"
                                title="Detacher ce fichier de ce produit"
                                aria-label={`Detacher ${row.file.name}`}
                              >
                                <Unlink className="h-3 w-3" />
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              {groups.length} produit(s) detecte(s) a partir de {analyzedCount} fichier(s) · {selectedGroups.length} a creer
              {createdGroups.size ? ` · ${createdGroups.size} deja cree(s)` : ""}
            </div>
            <button
              type="button"
              onClick={() => void createSelectedProducts()}
              disabled={busy || selectedGroups.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
              {creating ? "Creation..." : `Creer ${selectedGroups.length} produit(s)`}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Rapproche les fichiers decrivant le meme produit. On part des fiches
 * identifiantes, puis on rattache a chacune les fichiers dont le contenu
 * correspond — typiquement la capture du tarif du meme produit.
 */
function regroupFiles(rows: AnalyzedFile[]): AnalyzedFile[] {
  const analyzed = rows.filter((row) => row.status === "analyzed" && row.signature);
  if (analyzed.length < 2) return rows;

  const anchors = analyzed.filter((row) => row.signature?.hasIdentity);
  const groupByFileId = new Map<string, string>();

  // Chaque fiche identifiante ouvre un produit, sauf si elle rejoint une fiche deja ouverte.
  for (const anchor of anchors) {
    let best: { id: string; score: number } | null = null;
    for (const other of anchors) {
      if (other.id === anchor.id) continue;
      const groupId = groupByFileId.get(other.id);
      if (!groupId) continue;
      const score = scoreSignatureMatch(anchor.signature!, other.signature!);
      if (score >= PRODUCT_MATCH_THRESHOLD && (!best || score > best.score)) best = { id: groupId, score };
    }
    groupByFileId.set(anchor.id, best?.id ?? anchor.groupId);
  }

  // Les fichiers sans identite propre (captures de prix) rejoignent la meilleure fiche.
  for (const row of analyzed) {
    if (groupByFileId.has(row.id)) continue;
    let best: { id: string; score: number } | null = null;
    for (const anchor of anchors) {
      const score = scoreSignatureMatch(row.signature!, anchor.signature!);
      if (score > 0 && (!best || score > best.score)) best = { id: groupByFileId.get(anchor.id) ?? anchor.groupId, score };
    }
    groupByFileId.set(row.id, best && best.score >= PRODUCT_MATCH_THRESHOLD ? best.id : row.groupId);
  }

  return rows.map((row) => {
    const groupId = groupByFileId.get(row.id);
    return groupId && groupId !== row.groupId ? { ...row, groupId } : row;
  });
}
