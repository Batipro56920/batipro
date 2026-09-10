import { useEffect, useState } from "react";
import { PackagePlus } from "lucide-react";
import {
  acceptProductProposal,
  listPendingProductProposals,
  rejectProductProposal,
  type ProductProposal,
} from "../../../services/productProposals.service";

type Draft = { designation: string; unit: string; purchasePriceHt: string; category: string };

/**
 * File d'attente des produits vus sur les bons de livraison et absents du
 * catalogue. Rien n'entre au catalogue sans passer par ici : un produit mal
 * créé fausse durablement tous les coûts qui s'appuient sur son prix.
 */
export function ProductProposalsPanel({ onAccepted }: { onAccepted?: () => void }) {
  const [proposals, setProposals] = useState<ProductProposal[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const rows = await listPendingProductProposals();
    setProposals(rows);
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!next[row.id]) {
          next[row.id] = {
            designation: row.designation,
            unit: row.unit,
            purchasePriceHt: row.unitPriceHt !== null ? String(row.unitPriceHt) : "",
            category: "",
          };
        }
      }
      return next;
    });
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!proposals.length) return null;

  async function accept(proposal: ProductProposal) {
    const draft = drafts[proposal.id];
    const price = Number(String(draft?.purchasePriceHt ?? "").replace(",", "."));
    if (!draft?.designation.trim()) {
      setError("Une désignation est nécessaire.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Renseigne le prix d'achat : c'est lui qui alimente le coût des chantiers.");
      return;
    }
    setBusyId(proposal.id);
    setError(null);
    try {
      await acceptProductProposal(proposal, {
        designation: draft.designation.trim(),
        unit: draft.unit.trim() || "u",
        purchasePriceHt: price,
        category: draft.category.trim() || null,
      });
      await refresh();
      onAccepted?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Création impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(proposalId: string) {
    setBusyId(proposalId);
    setError(null);
    try {
      await rejectProductProposal(proposalId);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Refus impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
          <PackagePlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-950">{proposals.length} produit(s) à créer</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vus sur un bon de livraison, absents du catalogue. Vérifie la fiche avant de l&apos;ajouter : le prix
            d&apos;achat alimente le coût matériaux des chantiers.
          </p>
        </div>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      <div className="mt-4 space-y-3">
        {proposals.map((proposal) => {
          const draft = drafts[proposal.id];
          return (
            <article key={proposal.id} className="rounded-2xl border border-amber-200 bg-white p-3">
              <div className="text-xs text-slate-500">
                {proposal.supplierName ?? "Fournisseur inconnu"}
                {proposal.chantierName ? ` · ${proposal.chantierName}` : ""}
                {` · ${proposal.quantity} ${proposal.unit} reçu(s)`}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Désignation</span>
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    value={draft?.designation ?? ""}
                    onChange={(event) => setDrafts((c) => ({ ...c, [proposal.id]: { ...c[proposal.id], designation: event.target.value } }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unité</span>
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    value={draft?.unit ?? ""}
                    onChange={(event) => setDrafts((c) => ({ ...c, [proposal.id]: { ...c[proposal.id], unit: event.target.value } }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prix d&apos;achat HT</span>
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    inputMode="decimal"
                    placeholder={proposal.unitPriceHt === null ? "Non lu sur le bon" : ""}
                    value={draft?.purchasePriceHt ?? ""}
                    onChange={(event) => setDrafts((c) => ({ ...c, [proposal.id]: { ...c[proposal.id], purchasePriceHt: event.target.value } }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Catégorie</span>
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    value={draft?.category ?? ""}
                    onChange={(event) => setDrafts((c) => ({ ...c, [proposal.id]: { ...c[proposal.id], category: event.target.value } }))}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void accept(proposal)}
                  disabled={busyId === proposal.id}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busyId === proposal.id ? "Création..." : "Créer le produit et enregistrer la réception"}
                </button>
                <button
                  type="button"
                  onClick={() => void reject(proposal.id)}
                  disabled={busyId === proposal.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
                >
                  Écarter
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
