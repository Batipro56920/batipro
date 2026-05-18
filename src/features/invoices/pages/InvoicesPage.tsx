import { useMemo, useState } from "react";
import { FileCheck2, Plus } from "lucide-react";
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
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => listInvoices());
  const [selectedId, setSelectedId] = useState<string | null>(invoices[0]?.id ?? null);
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;

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

  function create(type: InvoiceType) {
    const invoice = createAndSaveInvoice(type);
    setInvoices(listInvoices());
    setSelectedId(invoice.id);
  }

  function update(invoice: InvoiceRecord) {
    setInvoices((current) => current.map((row) => row.id === invoice.id ? invoice : row));
  }

  function save(invoice: InvoiceRecord) {
    saveInvoice(invoice);
    setInvoices(listInvoices());
    setSelectedId(invoice.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion"
        title="Factures"
        description="Factures d'acompte, intermediaires, finales et avoirs, generees avec le moteur documentaire Batipro."
        actions={<InvoiceCreateActions onCreate={create} />}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Factures" value={invoices.length} hint="Documents de facturation" />
        <StatCard label="Brouillons" value={stats.drafts} hint="A finaliser" />
        <StatCard label="CA facture" value={formatCurrency(stats.amount)} hint="Total TTC" />
        <StatCard label="Encaisse" value={formatCurrency(stats.paid)} hint={`${stats.overdue} en retard`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950"><FileCheck2 className="h-4 w-4 text-blue-600" /> Liste factures</div>
          <div className="space-y-2">
            {invoices.map((invoice) => {
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
                  <div className="mt-1 text-xs text-slate-500">{invoice.document.recipient.displayName || "Client a definir"}</div>
                </button>
              );
            })}
          </div>
        </aside>

        {selected ? <InvoiceEditor invoice={selected} onChange={update} onSave={save} /> : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Creez une facture pour commencer.</div>
        )}
      </section>
    </div>
  );
}

function InvoiceCreateActions({ onCreate }: { onCreate: (type: InvoiceType) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={() => onCreate("deposit")}><Plus className="h-4 w-4" /> Acompte</Button>
      <Button variant="secondary" onClick={() => onCreate("intermediate")}>Intermediaire</Button>
      <Button variant="secondary" onClick={() => onCreate("final")}>Finale</Button>
      <Button variant="secondary" onClick={() => onCreate("credit_note")}>Avoir</Button>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
