import { useEffect, useMemo, useState } from "react";
import { FileCheck2, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/layout/PageHeader";
import { StatCard } from "../../../components/data/StatCard";
import { calculateDocumentTotals } from "../../document-engine";
import { createAndSaveInvoice, listInvoices, saveInvoice } from "../infrastructure/invoiceRepository";
import type { InvoiceRecord, InvoiceType } from "../domain/types";
import { InvoiceEditor } from "../components/InvoiceEditor";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import { getPaidAmount } from "../application/invoicePayments";
import { invoiceTypeLabel } from "../application/invoiceFactory";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;

  useEffect(() => {
    void refresh();
  }, []);

  const stats = useMemo(() => {
    const totals = invoices.reduce((acc, invoice) => {
      const documentTotals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
      acc.amount += documentTotals.totalTtc;
      acc.paid += getPaidAmount(invoice);
      if (invoice.status === "overdue") acc.overdue += 1;
      if (invoice.status === "draft") acc.drafts += 1;
      return acc;
    }, { amount: 0, paid: 0, overdue: 0, drafts: 0 });
    return totals;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const text = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesText = !text || [
        invoice.document.number,
        invoice.document.recipient.displayName,
        invoice.document.siteAddress,
        invoice.document.title,
      ].some((value) => String(value ?? "").toLowerCase().includes(text));
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesType = typeFilter === "all" || invoice.type === typeFilter;
      return matchesText && matchesStatus && matchesType;
    });
  }, [invoices, query, statusFilter, typeFilter]);

  async function refresh(selectFirst = true) {
    setLoading(true);
    setError(null);
    try {
      const rows = await listInvoices();
      setInvoices(rows);
      if (selectFirst) setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Chargement des factures impossible.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  async function create(type: InvoiceType) {
    const invoice = await createAndSaveInvoice(type);
    const rows = await listInvoices();
    setInvoices(rows);
    setSelectedId(invoice.id);
  }

  function update(invoice: InvoiceRecord) {
    setInvoices((current) => current.map((row) => row.id === invoice.id ? invoice : row));
  }

  async function save(invoice: InvoiceRecord) {
    const saved = await saveInvoice(invoice);
    const rows = await listInvoices();
    setInvoices(rows);
    setSelectedId(saved.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion"
        title="Factures"
        description="Factures d'acompte, intermédiaires, finales et avoirs générées avec le moteur documentaire Batipro."
        actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void refresh(false)}><RefreshCw className="h-4 w-4" /> Rafraîchir</Button><InvoiceCreateActions onCreate={create} /></div>}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des factures...</div> : null}

      {!loading ? <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Factures" value={invoices.length} hint="Documents de facturation" />
        <StatCard label="Brouillons" value={stats.drafts} hint="À finaliser" />
        <StatCard label="CA facturé" value={formatCurrency(stats.amount)} hint="Total TTC" />
        <StatCard label="Encaissé" value={formatCurrency(stats.paid)} hint={`${stats.overdue} en retard`} />
      </section> : null}

      {!loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-300" placeholder="Rechercher numéro, client, chantier..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tous statuts</option>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyée</option>
              <option value="partially_paid">Partiellement payée</option>
              <option value="paid">Payée</option>
              <option value="overdue">En retard</option>
              <option value="cancelled">Annulée</option>
            </select>
            <select className={selectClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Tous types</option>
              <option value="deposit">Acompte</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="final">Finale</option>
              <option value="credit_note">Avoir</option>
            </select>
          </div>
        </section>
      ) : null}

      {!loading ? <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><FileCheck2 className="h-4 w-4 text-blue-600" /> Liste factures</div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{filteredInvoices.length}</span>
          </div>
          <div className="space-y-2">
            {filteredInvoices.map((invoice) => {
              const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
              return (
                <button key={invoice.id} type="button" onClick={() => setSelectedId(invoice.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === invoice.id ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-950">{invoice.document.number}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{invoiceTypeLabel(invoice.type)}</div>
                    </div>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(totals.totalTtc)}</div>
                  <div className="mt-1 text-xs text-slate-500">{invoice.document.recipient.displayName || "Client à définir"}</div>
                </button>
              );
            })}
            {!filteredInvoices.length ? <EmptyState title="Aucune facture" description="Aucune facture ne correspond aux filtres actifs." /> : null}
          </div>
        </aside>

        {selected ? <InvoiceEditor invoice={selected} onChange={update} onSave={save} /> : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Créez une facture pour commencer.</div>
        )}
      </section> : null}
    </div>
  );
}

function InvoiceCreateActions({ onCreate }: { onCreate: (type: InvoiceType) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={() => onCreate("deposit")}><Plus className="h-4 w-4" /> Acompte</Button>
      <Button variant="secondary" onClick={() => onCreate("intermediate")}>Intermédiaire</Button>
      <Button variant="secondary" onClick={() => onCreate("final")}>Finale</Button>
      <Button variant="secondary" onClick={() => onCreate("credit_note")}>Avoir</Button>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
      <div className="text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

const selectClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300";
