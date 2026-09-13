import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Image, Loader2, PackagePlus, ReceiptText, Unlink, UploadCloud } from "lucide-react";
import type { SupplierRow } from "../../../services/suppliers.service";
import type { ProductCatalogDraft, ProductKnowledge } from "../domain/types";
import { saveProductCatalogItem } from "../infrastructure/productCatalogRepository";
import { analyzeProductTextWithCoco } from "../services/productKnowledge.service";
import { extractQuoteProducts, knowledgeFromQuoteLine } from "../services/productQuoteImport.service";
import { detectSupplierQuote } from "../services/supplierQuoteDetection";
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

/**
 * Un produit candidat. Une fiche technique en donne un ; un devis fournisseur
 * en donne autant qu'il a de lignes d'articles.
 */
type ProductCandidate = {
  id: string;
  fileId: string;
  groupId: string;
  knowledge: ProductKnowledge | null;
  signature: ProductImportSignature | null;
  patch: ProductDraftPatch;
};

type AnalyzedFile = {
  id: string;
  file: File;
  status: FileStatus;
  /** Un devis lu ligne a ligne, par opposition a une fiche decrivant un seul produit. */
  fromQuote: boolean;
  candidates: ProductCandidate[];
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
  candidates: ProductCandidate[];
  sources: { candidateId: string; file: File }[];
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
 * Import en lot. On depose tout d'un coup — fiches techniques, captures de
 * tarifs et devis fournisseurs melanges.
 *
 * Deux natures de documents, deux lectures. Une fiche technique decrit un
 * produit : elle donne une ligne. Un devis fournisseur est un tableau
 * d'articles : chacune de ses lignes est un produit distinct, avec son code
 * article et son prix net. Les confondre revenait a ecraser quinze articles en
 * une seule fiche, et a prendre les prix de deux produits differents pour un
 * prix d'achat et un prix de vente.
 *
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
  const quoteCount = files.filter((row) => row.status === "analyzed" && row.fromQuote).length;
  const failedFiles = files.filter((row) => row.status === "failed");
  const busy = analyzing || creating;

  const groups = useMemo<ProductGroup[]>(() => {
    const fileById = new Map(files.map((row) => [row.id, row]));
    const byGroup = new Map<string, ProductCandidate[]>();
    for (const row of files) {
      if (row.status !== "analyzed") continue;
      for (const candidate of row.candidates) {
        const bucket = byGroup.get(candidate.groupId);
        if (bucket) bucket.push(candidate);
        else byGroup.set(candidate.groupId, [candidate]);
      }
    }

    return Array.from(byGroup, ([id, rows]) => {
      // L'identite vient de la source la plus descriptive : la fiche technique
      // plutot que la capture de prix.
      const ordered = [...rows].sort((a, b) => Number(b.signature?.hasIdentity) - Number(a.signature?.hasIdentity));
      const merged = mergeProductPatches(ordered.map((row) => row.patch));
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

      const sources = ordered
        .map((candidate) => {
          const source = fileById.get(candidate.fileId);
          return source ? { candidateId: candidate.id, file: source.file } : null;
        })
        .filter((source): source is { candidateId: string; file: File } => source !== null);

      const warnings = Array.from(new Set(ordered.flatMap((candidate) => fileById.get(candidate.fileId)?.storageNotes ?? [])));
      if (!draft.mainSupplierName) warnings.push("Fournisseur non identifie");
      if (!draft.standardPurchasePriceHt) warnings.push("Prix d'achat non trouve");

      return { id, candidates: ordered, sources, draft, edits: edit, warnings };
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
      fromQuote: false,
      candidates: [],
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

      const quote = detectSupplierQuote(text);
      // Le devis est depose une seule fois et rattache a chacun de ses articles :
      // c'est la piece qui justifie leur prix. Il n'ira pas au DOE.
      const stored = await storeProductFiles(
        "",
        [row.file],
        quote.isQuote ? { kind: "other", usage: { task: true, doe: false } } : {},
      );

      const candidates: ProductCandidate[] = [];

      if (quote.isQuote) {
        for (const line of await extractQuoteProducts(text)) {
          const knowledge = knowledgeFromQuoteLine(line);
          candidates.push({
            id: crypto.randomUUID(),
            fileId: row.id,
            groupId: crypto.randomUUID(),
            knowledge,
            signature: buildImportSignature(knowledge),
            // Sans le texte du devis : y repecher un prix ferait entrer celui
            // d'une autre ligne dans le produit courant.
            patch: buildProductPatch(createEmptyProductDraft(), knowledge, stored.documents, suppliers, ""),
          });
        }
      }

      if (candidates.length) {
        patchFile(row.id, { status: "analyzed", fromQuote: true, candidates, storageNotes: stored.notes });
        return;
      }

      // Fiche technique, capture de tarif, ou devis dont aucune ligne n'a pu
      // etre lue : un seul produit, analyse sur l'ensemble du document.
      const base = createEmptyProductDraft();
      const knowledge = await analyzeProductTextWithCoco(base, text, images);
      patchFile(row.id, {
        status: "analyzed",
        fromQuote: false,
        candidates: [{
          id: crypto.randomUUID(),
          fileId: row.id,
          groupId: crypto.randomUUID(),
          knowledge,
          signature: buildImportSignature(knowledge),
          patch: buildProductPatch(base, knowledge, stored.documents, suppliers, text),
        }],
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
      setFiles((current) => regroupCandidates(current));
    } finally {
      setAnalyzing(false);
    }
  }

  /** Detache une source de son produit : elle repart seule, a regrouper autrement. */
  function detachCandidate(candidateId: string) {
    setFiles((current) => current.map((row) => ({
      ...row,
      candidates: row.candidates.map((candidate) => (
        candidate.id === candidateId ? { ...candidate, groupId: crypto.randomUUID() } : candidate
      )),
    })));
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
            Deposez tout d'un coup : fiches techniques, captures de tarifs et devis fournisseurs melanges. Une fiche
            technique donne un produit ; un devis est lu ligne par ligne et donne autant de produits qu'il contient
            d'articles. Coco rapproche ensuite les documents qui parlent du meme produit — marque, fournisseur, prix
            d'achat, prix de vente conseille — avec les pieces conservees pour le DOE.
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2">Marque</th>
                  <th className="px-3 py-2">Fournisseur</th>
                  <th className="px-3 py-2 text-right">Achat HT</th>
                  <th className="px-3 py-2 text-right">Vente HT</th>
                  <th className="px-3 py-2">Documents rattaches</th>
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
                            {group.draft.manufacturerReference ? (
                              <div className="mt-1 text-xs text-slate-400">Ref. {group.draft.manufacturerReference}</div>
                            ) : null}
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
                          {group.sources.map((source) => (
                            <span
                              key={source.candidateId}
                              className="inline-flex max-w-52 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                              title={source.file.name}
                            >
                              {isImageFile(source.file) ? <Image className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                              <span className="truncate">{source.file.name}</span>
                              {group.sources.length > 1 && !isCreated ? (
                                <button
                                  type="button"
                                  onClick={() => detachCandidate(source.candidateId)}
                                  disabled={busy}
                                  className="shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-50"
                                  title="Detacher ce document de ce produit"
                                  aria-label={`Detacher ${source.file.name}`}
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
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              {groups.length} produit(s) detecte(s) a partir de {analyzedCount} fichier(s) · {selectedGroups.length} a creer
              {quoteCount ? ` · ${quoteCount} devis lu(s) ligne par ligne` : ""}
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

      {quoteCount && !analyzing ? (
        <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Les devis fournisseurs sont conserves comme piece justificative du prix, mais exclus du DOE : ils portent vos
            prix d'achat et vos remises.
          </span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Rapproche les sources decrivant le meme produit. On part des documents
 * identifiants, puis on rattache a chacun ceux dont le contenu correspond —
 * typiquement la capture du tarif du meme produit.
 *
 * Deux lignes d'un meme devis ne se rejoignent jamais : ce sont deux articles
 * distincts par construction, meme quand leurs libelles se ressemblent.
 */
function regroupCandidates(files: AnalyzedFile[]): AnalyzedFile[] {
  const all = files
    .filter((row) => row.status === "analyzed")
    .flatMap((row) => row.candidates)
    .filter((candidate) => candidate.signature);
  if (all.length < 2) return files;

  const anchors = all.filter((candidate) => candidate.signature?.hasIdentity);
  const groupOf = new Map<string, string>();
  const filesInGroup = new Map<string, Set<string>>();

  const assign = (candidate: ProductCandidate, groupId: string) => {
    groupOf.set(candidate.id, groupId);
    const sources = filesInGroup.get(groupId) ?? new Set<string>();
    sources.add(candidate.fileId);
    filesInGroup.set(groupId, sources);
  };

  const canJoin = (candidate: ProductCandidate, groupId: string) => !filesInGroup.get(groupId)?.has(candidate.fileId);

  // Chaque document identifiant ouvre un produit, sauf s'il rejoint un produit deja ouvert.
  for (const anchor of anchors) {
    let best: { id: string; score: number } | null = null;
    for (const other of anchors) {
      if (other.id === anchor.id) continue;
      const groupId = groupOf.get(other.id);
      if (!groupId || !canJoin(anchor, groupId)) continue;
      const score = scoreSignatureMatch(anchor.signature!, other.signature!);
      if (score >= PRODUCT_MATCH_THRESHOLD && (!best || score > best.score)) best = { id: groupId, score };
    }
    assign(anchor, best?.id ?? anchor.groupId);
  }

  // Les documents sans identite propre (captures de prix) rejoignent le meilleur produit.
  for (const candidate of all) {
    if (groupOf.has(candidate.id)) continue;
    let best: { id: string; score: number } | null = null;
    for (const anchor of anchors) {
      const groupId = groupOf.get(anchor.id) ?? anchor.groupId;
      if (!canJoin(candidate, groupId)) continue;
      const score = scoreSignatureMatch(candidate.signature!, anchor.signature!);
      if (score > 0 && (!best || score > best.score)) best = { id: groupId, score };
    }
    assign(candidate, best && best.score >= PRODUCT_MATCH_THRESHOLD ? best.id : candidate.groupId);
  }

  return files.map((row) => ({
    ...row,
    candidates: row.candidates.map((candidate) => {
      const groupId = groupOf.get(candidate.id);
      return groupId && groupId !== candidate.groupId ? { ...candidate, groupId } : candidate;
    }),
  }));
}
