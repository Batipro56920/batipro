import { useMemo, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import type { SupplierRow } from "../../../services/suppliers.service";
import type { ProductCatalogDraft, ProductCatalogItem } from "../domain/types";

type ProductDraftPatch = Partial<ProductCatalogDraft | ProductCatalogItem>;

const ACCEPTED_PRODUCT_FILES = "application/pdf,.pdf,.xlsx,.xls,.csv,.txt,text/plain,text/csv";
const SUPPORTED_FILE_LABEL = "PDF, Excel, CSV ou texte";

export default function ProductFileImportPanel(props: {
  currentProduct: ProductCatalogDraft | ProductCatalogItem;
  suppliers: SupplierRow[];
  onApply: (patch: ProductDraftPatch) => void;
}) {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const hasFiles = fileNames.length > 0;
  const label = useMemo(() => fileNames.slice(0, 3).join(", ") + (fileNames.length > 3 ? ` +${fileNames.length - 3}` : ""), [fileNames]);
  const currentDesignation = props.currentProduct.designation.trim();
  const knownSuppliers = props.suppliers.length;

  function onFileChange(files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    const unsupported = selectedFiles.find((file) => !isSupportedProductFile(file));
    setFileNames(selectedFiles.map((file) => file.name));

    if (unsupported) {
      setMessage(`Fichier non pris en charge : ${unsupported.name}. Formats acceptes : ${SUPPORTED_FILE_LABEL}.`);
      return;
    }

    setMessage("Import automatique temporairement securise : la fiche produit reste modifiable manuellement sans bloquer la page.");
  }

  function clearFiles() {
    setFileNames([]);
    setMessage(null);
  }

  function keepManualEntry() {
    props.onApply({});
    setMessage("Saisie manuelle conservee. Renseignez les champs utiles puis enregistrez la fiche produit.");
  }

  return (
    <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Import intelligent par Coco</div>
          <p className="mt-1 text-sm text-slate-600">
            La creation produit est securisee. L'analyse automatique des fichiers est mise en attente pour eviter de bloquer l'ouverture de la fiche.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {currentDesignation ? `Fiche en cours : ${currentDesignation}.` : "Nouvelle fiche produit."} {knownSuppliers} fournisseur{knownSuppliers > 1 ? "s" : ""} disponible{knownSuppliers > 1 ? "s" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
            <UploadCloud className="h-4 w-4" />
            Selectionner fichier(s)
            <input
              type="file"
              multiple
              accept={ACCEPTED_PRODUCT_FILES}
              className="sr-only"
              onChange={(event) => onFileChange(event.target.files)}
            />
          </label>
          <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50" onClick={keepManualEntry}>
            Saisie manuelle
          </button>
        </div>
      </div>

      {hasFiles ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-blue-800">
          <span className="truncate"><FileText className="mr-2 inline h-4 w-4" />{label}</span>
          <button type="button" onClick={clearFiles} className="rounded-lg p-1 hover:bg-blue-50" aria-label="Retirer les fichiers">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {message ? <div className="mt-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-blue-800">{message}</div> : null}
    </div>
  );
}

function isSupportedProductFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return [".pdf", ".xlsx", ".xls", ".csv", ".txt"].some((extension) => name.endsWith(extension))
    || ["application/pdf", "text/plain", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type);
}
