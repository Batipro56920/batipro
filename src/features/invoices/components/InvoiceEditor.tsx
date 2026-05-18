import { useMemo, useState } from "react";
import { Download, Plus, Save, Send } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { calculateDocumentTotals, createDocumentLine, createDocumentSection, DocumentPreview, DocumentSendDialog, DocumentTotalsCard, downloadBusinessDocumentPdf, flattenDocumentNodes, validateBusinessDocument, type BusinessDocument, type BusinessDocumentNode, type DocumentItemKind } from "../../document-engine";
import { addInvoicePayment, createProfitabilitySnapshot, getPaidAmount, getRemainingAmount } from "../application/invoicePayments";
import type { InvoicePayment, InvoiceRecord } from "../domain/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

export function InvoiceEditor({ invoice, onChange, onSave }: { invoice: InvoiceRecord; onChange: (invoice: InvoiceRecord) => void; onSave: (invoice: InvoiceRecord) => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const document = invoice.document;
  const totals = document.totals ?? calculateDocumentTotals(document);
  const rows = useMemo(() => flattenDocumentNodes(document.nodes), [document.nodes]);
  const profitability = createProfitabilitySnapshot(invoice);

  function updateDocument(patch: Partial<BusinessDocument>) {
    const nextDocument = { ...document, ...patch };
    onChange({ ...invoice, document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) }, updatedAt: new Date().toISOString() });
  }

  function updateNode(nodeId: string, patch: Partial<BusinessDocumentNode>) {
    const nodes = updateNodeTree(document.nodes, nodeId, patch);
    updateDocument({ nodes });
  }

  function addSection() {
    updateDocument({ nodes: [...document.nodes, createDocumentSection("Nouveau lot", document.nodes.length)] });
  }

  function addLine(kind: DocumentItemKind) {
    const section = document.nodes.find((node) => node.type === "section");
    const nextSection = section ?? createDocumentSection("Prestations", 0);
    const line = createDocumentLine(nextSection.id, kind, nextSection.type === "section" ? nextSection.children.length : 0);
    const nodes = section ? appendChild(document.nodes, section.id, line) : [{ ...nextSection, children: [line] }];
    updateDocument({ nodes });
  }

  function addPayment(payment: Omit<InvoicePayment, "id">) {
    onChange(addInvoicePayment(invoice, payment));
  }

  function save() {
    const validation = validateBusinessDocument(document);
    if (!validation.success) throw new Error(validation.error.issues.map((issue) => issue.message).join(", "));
    onSave(invoice);
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Facturation</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input className="rounded-xl border border-transparent text-2xl font-bold text-slate-950 outline-none hover:border-slate-200 focus:border-blue-300" value={document.number} onChange={(event) => updateDocument({ number: event.target.value })} />
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{document.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
            <Button variant="secondary" onClick={() => downloadBusinessDocumentPdf(document)}><Download className="h-4 w-4" /> PDF</Button>
            <Button variant="secondary" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Envoyer</Button>
            <Button variant="primary" onClick={save}><Save className="h-4 w-4" /> Enregistrer</Button>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Client" value={document.recipient.displayName} onChange={(displayName) => updateDocument({ recipient: { ...document.recipient, displayName } })} />
            <Field label="Adresse" value={document.siteAddress ?? ""} onChange={(siteAddress) => updateDocument({ siteAddress })} />
            <Field label="Date facture" type="date" value={document.issueDate} onChange={(issueDate) => updateDocument({ issueDate })} />
            <Field label="Echéance" type="date" value={document.dueDate ?? ""} onChange={(dueDate) => updateDocument({ dueDate })} />
          </div>

          <div className="flex flex-wrap gap-2 border-y border-slate-100 py-3">
            <Button variant="secondary" onClick={addSection}><Plus className="h-4 w-4" /> Section</Button>
            <Button variant="secondary" onClick={() => addLine("fourniture")}><Plus className="h-4 w-4" /> Ligne</Button>
            <Button variant="secondary" onClick={() => addLine("main_oeuvre")}><Plus className="h-4 w-4" /> Main d'oeuvre</Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[70px_1fr_110px_110px_120px] bg-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
              <span>N</span><span>Designation</span><span className="text-right">Qte</span><span>PU HT</span><span className="text-right">Total HT</span>
            </div>
            {rows.length ? rows.map((row) => (
              <div key={row.id} className={`grid grid-cols-[70px_1fr_110px_110px_120px] items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm ${row.node.type === "section" ? "bg-blue-50 font-bold" : row.node.type === "subsection" ? "bg-slate-50 font-semibold" : ""}`}>
                <span className="font-mono text-xs text-slate-500">{row.number}</span>
                <input className="rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300" value={row.node.title} onChange={(event) => updateNode(row.id, { title: event.target.value })} />
                {row.node.type === "line" || row.node.type === "composite" ? <NumberCell value={row.node.quantity} onChange={(quantity) => updateNode(row.id, { quantity } as Partial<BusinessDocumentNode>)} /> : <span />}
                {row.node.type === "line" || row.node.type === "composite" ? <NumberCell value={row.node.unitPriceHt} onChange={(unitPriceHt) => updateNode(row.id, { unitPriceHt } as Partial<BusinessDocumentNode>)} /> : <span />}
                <span className="text-right font-semibold">{row.node.type === "line" || row.node.type === "composite" ? formatCurrency(row.node.quantity * row.node.unitPriceHt) : ""}</span>
              </div>
            )) : <div className="p-8 text-center text-sm text-slate-500">Ajoutez une section puis des lignes de facture.</div>}
          </div>
        </div>

        <aside className="space-y-4">
          <DocumentTotalsCard document={document} totals={totals} />
          <PaymentPanel invoice={invoice} onAdd={addPayment} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <div className="font-semibold text-slate-950">Rentabilité projet</div>
            <div className="mt-3 space-y-2 text-slate-600">
              <Line label="Facturé TTC" value={formatCurrency(profitability.invoicedTtc)} />
              <Line label="Encaissé TTC" value={formatCurrency(profitability.paidTtc)} />
              <Line label="Reste à encaisser" value={formatCurrency(profitability.remainingToCollectTtc)} />
            </div>
          </div>
        </aside>
      </section>

      {previewOpen ? <DocumentPreview document={document} /> : null}
      {sendOpen ? <DocumentSendDialog document={document} onClose={() => setSendOpen(false)} onDownload={() => downloadBusinessDocumentPdf(document)} /> : null}
    </div>
  );
}

function PaymentPanel({ invoice, onAdd }: { invoice: InvoiceRecord; onAdd: (payment: Omit<InvoicePayment, "id">) => void }) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<InvoicePayment["method"]>("transfer");
  const [reference, setReference] = useState("");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="font-semibold text-slate-950">Paiements</div>
      <div className="mt-2 text-slate-500">Encaissé : {formatCurrency(getPaidAmount(invoice))} · Reste : {formatCurrency(getRemainingAmount(invoice))}</div>
      <div className="mt-4 grid gap-2">
        <input className={inputClass} type="number" placeholder="Montant" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input className={inputClass} type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value as InvoicePayment["method"])}>
          <option value="transfer">Virement</option>
          <option value="card">Carte</option>
          <option value="cash">Especes</option>
          <option value="cheque">Cheque</option>
          <option value="direct_debit">Prelevement</option>
        </select>
        <input className={inputClass} placeholder="Référence" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Button variant="secondary" onClick={() => {
          if (!amount) return;
          onAdd({ amount: Number(amount), paidAt, method, reference });
          setAmount("");
          setReference("");
        }}>Ajouter paiement</Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}<input className={`${inputClass} mt-1`} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className={`${inputClass} text-right`} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span>{label}</span><span className="font-semibold text-slate-950">{value}</span></div>;
}

function updateNodeTree(nodes: BusinessDocumentNode[], nodeId: string, patch: Partial<BusinessDocumentNode>): BusinessDocumentNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return { ...node, ...patch } as BusinessDocumentNode;
    if (node.type === "section" || node.type === "subsection") return { ...node, children: updateNodeTree(node.children, nodeId, patch) };
    return node;
  });
}

function appendChild(nodes: BusinessDocumentNode[], parentId: string, child: BusinessDocumentNode): BusinessDocumentNode[] {
  return nodes.map((node) => {
    if ((node.type === "section" || node.type === "subsection") && node.id === parentId) return { ...node, children: [...node.children, child] };
    if (node.type === "section" || node.type === "subsection") return { ...node, children: appendChild(node.children, parentId, child) };
    return node;
  });
}

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
