import { calculateDocumentTotals } from "../application/documentCalculations";
import { flattenDocumentNodes } from "../application/documentNumbering";
import type { BusinessDocument, FlatDocumentNode } from "../domain/types";

export function DocumentPreview({ document }: { document: BusinessDocument }) {
  const rows = flattenDocumentNodes(document.nodes);
  const totals = document.totals ?? calculateDocumentTotals(document);

  return (
    <div className="mx-auto max-w-5xl rounded-sm border border-slate-200 bg-white p-10 shadow-sm">
      <header className="flex justify-between gap-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{document.company.displayName}</div>
          <h1 className="mt-6 text-3xl font-bold text-slate-950">{document.title} {document.number}</h1>
          <p className="mt-2 text-sm text-slate-600">Date : {formatDate(document.issueDate)}</p>
        </div>
        <div className="w-80 rounded-xl bg-slate-50 p-5 text-sm text-slate-700">
          <div className="font-semibold text-slate-950">{document.recipient.displayName || "Destinataire a definir"}</div>
          <div className="mt-1 whitespace-pre-line">{document.siteAddress || document.recipient.address || "Adresse a definir"}</div>
        </div>
      </header>

      {document.description ? <p className="mt-8 text-sm leading-6 text-slate-700">{document.description}</p> : null}

      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[70px_1fr_100px_100px_120px] bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
          <span>N</span>
          <span>Designation</span>
          <span className="text-right">Qte</span>
          <span>Unite</span>
          <span className="text-right">Total HT</span>
        </div>
        {rows.map((row) => <DocumentPreviewRow key={row.id} row={row} />)}
      </div>

      <div className="ml-auto mt-8 w-80 rounded-xl border border-slate-200 p-4">
        <TotalRow label="Total HT" value={totals.totalHt} />
        <TotalRow label="TVA" value={totals.totalVat} />
        <TotalRow label="Total TTC" value={totals.totalTtc} strong />
      </div>

      <section className="mt-10 text-sm leading-6 text-slate-700">
        <strong>Conditions</strong>
        <br />
        {document.terms.paymentTerms}
      </section>
    </div>
  );
}

function DocumentPreviewRow({ row }: { row: FlatDocumentNode }) {
  if (row.node.type === "section") {
    return <div className="grid grid-cols-[70px_1fr_100px_100px_120px] bg-blue-50 px-4 py-3 text-sm font-bold text-slate-950"><span>{row.number}</span><span className="col-span-4">{row.node.title}</span></div>;
  }
  if (row.node.type === "subsection") {
    return <div className="grid grid-cols-[70px_1fr_100px_100px_120px] bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900"><span>{row.number}</span><span className="col-span-4">{row.node.title}</span></div>;
  }
  if (row.node.type === "text") {
    return <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">{row.node.content}</div>;
  }
  if (row.node.type !== "line" && row.node.type !== "composite") {
    return <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">{row.node.title}</div>;
  }
  return (
    <div className="grid grid-cols-[70px_1fr_100px_100px_120px] border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
      <span>{row.number}</span>
      <span>{row.node.title}</span>
      <span className="text-right">{row.node.quantity}</span>
      <span>{formatUnit(row.node.unit)}</span>
      <span className="text-right font-semibold text-slate-950">{formatCurrency(row.node.quantity * row.node.unitPriceHt)}</span>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex justify-between py-1 ${strong ? "font-bold text-slate-950" : "text-slate-600"}`}><span>{label}</span><span>{formatCurrency(value)}</span></div>;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatUnit(value: string) {
  if (value === "m2") return "m2";
  if (value === "m3") return "m3";
  return value;
}
