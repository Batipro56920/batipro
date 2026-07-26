import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import type { QuoteActionHandlers, QuoteWithParty } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";
import { QuoteStatusChip } from "./QuoteStatusChip";

function signatureLabel(value: string) {
  if (value === "attente_signature") return "Attente signature";
  if (value === "signe" || value === "signé") return "Signé";
  if (value === "refuse") return "Refusé";
  return value || "—";
}

function quoteHasClientApproval(row: QuoteWithParty) {
  return row.statut === "accepte" || row.signature_status === "signe" || row.signature_status === "signé";
}

function needsChantierHandoff(row: QuoteWithParty) {
  return !row.chantierPath && quoteHasClientApproval(row);
}

function ProjectLinkAction({ row, compact = false }: { row: QuoteWithParty; compact?: boolean }) {
  if (row.hasProjectLink) {
    return (
      <Link
        to={row.projectPath}
        className={compact ? "rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100" : "inline-flex h-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100"}
        title="Ouvrir le dossier projet lié à ce devis."
      >
        {compact ? "Ouvrir projet" : "Projet"}
      </Link>
    );
  }

  return (
    <Link
      to={row.quoteEditPath}
      className={compact ? "rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100" : "inline-flex h-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"}
      title="Vérifier pourquoi ce devis n'a pas de projet commercial rattaché."
    >
      {compact ? "Rattachement" : "À rattacher"}
    </Link>
  );
}

function QuoteEditAction({ row, compact = false }: { row: QuoteWithParty; compact?: boolean }) {
  if (!row.hasProjectLink) return null;
  return (
    <Link
      to={row.quoteEditPath}
      className={compact ? "rounded-lg border border-slate-900 bg-slate-950 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800" : "inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"}
      title="Modifier ce devis dans le Quote Builder."
    >
      Modifier
    </Link>
  );
}

function ChantierHandoffAction({
  row,
  actions,
  compact = false,
}: {
  row: QuoteWithParty;
  actions: QuoteActionHandlers;
  compact?: boolean;
}) {
  if (row.chantierPath) {
    return (
      <Link
        to={row.chantierPath}
        className={compact ? "rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100" : "inline-flex h-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"}
        title="Ouvrir le chantier déjà lié à ce devis."
      >
        Chantier
      </Link>
    );
  }

  if (needsChantierHandoff(row)) {
    return (
      <button
        type="button"
        onClick={() => actions.onTransform(row)}
        className={compact ? "rounded-lg border border-emerald-300 bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700" : "inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"}
        title="Créer le chantier à partir de ce devis accepté."
      >
        Créer chantier
      </button>
    );
  }

  if (compact) return null;

  return (
    <button type="button" onClick={() => actions.onTransform(row)} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
      Transformer
    </button>
  );
}

function QuoteMobileCard({
  row,
  actions,
  onSelect,
}: {
  row: QuoteWithParty;
  actions: QuoteActionHandlers;
  onSelect: (row: QuoteWithParty) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <button type="button" onClick={() => onSelect(row)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{row.quote_number}</div>
            <div className="mt-1 truncate text-base font-semibold text-slate-950">{row.partyLabel}</div>
          </div>
          <QuoteStatusChip status={row.statut} />
        </div>
        <div className="mt-3 line-clamp-2 text-sm font-medium text-slate-700">{row.description ?? row.lot ?? "Projet à compléter"}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Montant</div>
            <div className="mt-1 font-semibold text-slate-950">{eur(row.montant_ht)} HT</div>
            <div className="text-xs text-slate-500">{eur(row.montant_ttc)} TTC</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Validité</div>
            <div className="mt-1 font-semibold text-slate-950">{dateOnly(row.valid_until)}</div>
            <div className="text-xs text-slate-500">Signature : {signatureLabel(row.signature_status)}</div>
          </div>
        </div>
        {needsChantierHandoff(row) ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            Devis validé : chantier à créer pour lancer la préparation.
          </div>
        ) : null}
      </button>

      <div className="mt-4 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
        <QuoteEditAction row={row} />
        <ProjectLinkAction row={row} />
        <ChantierHandoffAction row={row} actions={actions} />
        <details className="relative">
          <summary className="flex h-9 cursor-pointer list-none items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <MoreHorizontal className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
            <button type="button" onClick={() => actions.onStatus(row, "envoye")} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">Envoyer</button>
            <button type="button" onClick={() => actions.onStatus(row, "relance_1")} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">Relancer</button>
            <button type="button" onClick={() => actions.onPdf(row)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">PDF</button>
            <button type="button" onClick={() => actions.onStatus(row, "accepte")} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">Accepter</button>
            <button type="button" onClick={() => actions.onStatus(row, "refuse")} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Refuser</button>
          </div>
        </details>
      </div>
    </article>
  );
}

export function QuotesTable({
  rows,
  actions,
  onSelect,
}: {
  rows: QuoteWithParty[];
  actions: QuoteActionHandlers;
  onSelect: (row: QuoteWithParty) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="space-y-3 bg-slate-50/60 p-3 md:hidden">
        {rows.map((row) => (
          <QuoteMobileCard key={row.id} row={row} actions={actions} onSelect={onSelect} />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <tr>
              {["N°", "Client", "Projet", "Montant", "Validité", "Statut", "Signature", "Commercial", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row)} className="group cursor-pointer border-b border-slate-100 align-top transition hover:bg-blue-50/30">
                <td className="px-4 py-3 font-semibold text-slate-950">{row.quote_number}</td>
                <td className="px-4 py-3 text-slate-700">{row.partyLabel}</td>
                <td className="px-4 py-3">
                  <div className="line-clamp-2 max-w-xs font-medium text-slate-800">{row.description ?? row.lot ?? "Projet à compléter"}</div>
                  {row.chantierPath ? (
                    <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Chantier créé</div>
                  ) : needsChantierHandoff(row) ? (
                    <div className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Chantier à créer</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{eur(row.montant_ht)} HT</div>
                  <div className="mt-1 text-xs text-slate-500">{eur(row.montant_ttc)} TTC</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{dateOnly(row.valid_until)}</td>
                <td className="px-4 py-3"><QuoteStatusChip status={row.statut} /></td>
                <td className="px-4 py-3 text-slate-600">{signatureLabel(row.signature_status)}</td>
                <td className="px-4 py-3 text-slate-600">{row.salespersonLabel}</td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-wrap gap-1">
                    <ProjectLinkAction row={row} compact />
                    <ChantierHandoffAction row={row} actions={actions} compact />
                    <QuoteEditAction row={row} compact />
                    <button type="button" onClick={() => actions.onStatus(row, "envoye")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">Envoyer</button>
                    <button type="button" onClick={() => actions.onStatus(row, "relance_1")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">Relancer</button>
                    <details className="relative">
                      <summary className="flex cursor-pointer list-none items-center rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
                        <button type="button" onClick={() => actions.onPdf(row)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">PDF</button>
                        <button type="button" onClick={() => actions.onStatus(row, "accepte")} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">Accepter</button>
                        <button type="button" onClick={() => actions.onStatus(row, "refuse")} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Refuser</button>
                        {row.chantierPath ? (
                          <Link to={row.chantierPath} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">Ouvrir chantier</Link>
                        ) : (
                          <button type="button" onClick={() => actions.onTransform(row)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">Transformer chantier</button>
                        )}
                        <button type="button" disabled className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-400" title="Duplication à finaliser dans le Quote Builder">Dupliquer</button>
                        <button type="button" disabled className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-400" title="Suppression à sécuriser">Supprimer</button>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>{rows.length} devis</span>
        <span className="hidden sm:inline">Pagination avancée à connecter si volume élevé.</span>
      </div>
    </section>
  );
}
