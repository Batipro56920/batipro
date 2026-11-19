import { useState, type FormEvent } from "react";
import type { ProjectRecord } from "../types";
import { importObatQuoteToProject, type ObatImportInput } from "../../../services/obatProjectQuotes.service";

type ObatQuoteStatus = ObatImportInput["status"];

export function ImportObatQuoteDialog({
  project,
  onClose,
  onImported,
}: {
  project: ProjectRecord;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [description, setDescription] = useState("");
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().slice(0, 10));
  const [amountHt, setAmountHt] = useState("");
  const [amountTtc, setAmountTtc] = useState("");
  const [status, setStatus] = useState<ObatQuoteStatus>("envoye");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || saving) return;
    setSaving(true);
    setError(null);
    try {
      await importObatQuoteToProject({
        project,
        file,
        quoteNumber,
        description,
        dateIssued,
        amountHt: Number(amountHt.replace(",", ".")),
        amountTtc: Number(amountTtc.replace(",", ".")),
        status,
      });
      await onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import du devis Obat impossible.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Importer un devis Obat">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Importer un devis Obat</h2>
            <p className="mt-1 text-sm text-slate-500">Rattacher le PDF et ses montants au projet « {project.name} ».</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Fermer</button>
        </div>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <label className="block text-sm font-medium text-slate-700">
            PDF du devis *
            <input required type="file" accept=".pdf,application/pdf" className={inputClass}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <span className="mt-1 block text-xs font-normal text-slate-500">Document original conservé dans un stockage privé — 20 Mo maximum.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Numéro du devis Obat *
              <input required className={inputClass} value={quoteNumber} placeholder="DEV-..."
                onChange={(event) => setQuoteNumber(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Date du devis *
              <input required type="date" className={inputClass} value={dateIssued}
                onChange={(event) => setDateIssued(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Montant HT (€) *
              <input required inputMode="decimal" className={inputClass} value={amountHt} placeholder="Ex. 12500,00"
                onChange={(event) => setAmountHt(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Montant TTC (€) *
              <input required inputMode="decimal" className={inputClass} value={amountTtc} placeholder="Ex. 13750,00"
                onChange={(event) => setAmountTtc(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Statut commercial
              <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as ObatQuoteStatus)}>
                <option value="brouillon">Brouillon</option>
                <option value="envoye">Envoyé</option>
                <option value="accepte">Accepté</option>
                <option value="refuse">Refusé</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Description
              <input className={inputClass} value={description} placeholder="Rénovation globale..."
                onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>
          <p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-900">
            Le devis reste édité et facturé dans Obat. Batipro conserve sa référence et son PDF, sans recréer ses lignes ni déclencher une facture ou un chantier automatiquement.
          </p>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} className="rounded-xl border px-4 py-2.5 text-sm" onClick={onClose}>Annuler</button>
            <button type="submit" disabled={saving || !file} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Import en cours..." : "Rattacher au projet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
