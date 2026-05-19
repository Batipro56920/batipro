import { Download, FileSignature, Mail, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { calculateDocumentTotals } from "../application/documentCalculations";
import { flattenDocumentNodes } from "../application/documentNumbering";
import { getDocumentTemplate } from "../domain/documentTemplates";
import type { BusinessDocument, DocumentItemNode, FlatDocumentNode } from "../domain/types";

export function DocumentPreview({ document, onDownload, onSend }: { document: BusinessDocument; onDownload?: () => void; onSend?: () => void }) {
  const rows = flattenDocumentNodes(document.nodes);
  const totals = document.totals ?? calculateDocumentTotals(document);
  const template = getDocumentTemplate(document);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-100 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Prévisualisation client</div>
          <div className="text-sm font-semibold text-slate-950">{template.label} {document.number}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button"><ZoomOut className="h-4 w-4" /> 90%</Button>
          <Button variant="secondary" type="button"><ZoomIn className="h-4 w-4" /> Zoom</Button>
          <Button variant="secondary" type="button" onClick={onDownload}><Download className="h-4 w-4" /> Télécharger</Button>
          <Button variant="secondary" type="button" onClick={onSend}><Mail className="h-4 w-4" /> Envoyer</Button>
        </div>
      </div>

      <article className="mx-auto max-w-5xl overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
        <header className="bg-[#0F2747] px-10 py-7 text-white">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">{document.company.displayName || "Batipro"}</div>
              <h1 className="mt-6 text-3xl font-bold">{template.label} {document.number}</h1>
              <p className="mt-2 text-sm text-blue-100">Date : {formatDate(document.issueDate)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-4 text-sm text-blue-50">
              <div className="font-semibold text-white">{template.accentLabel}</div>
              <div className="mt-1">{document.status}</div>
            </div>
          </div>
        </header>

        <div className="p-10">
          <section className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Entreprise" lines={[document.company.displayName, document.company.address, document.company.email, document.company.phone]} />
            <InfoCard title={template.recipientLabel} lines={[document.recipient.displayName, document.recipient.contactName, document.siteAddress || document.recipient.address, document.recipient.email]} />
          </section>

          {document.description ? <p className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">{document.description}</p> : null}

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[70px_1fr_90px_90px_110px] bg-blue-600 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white">
              <span>N°</span>
              <span>Désignation</span>
              <span className="text-right">Qté</span>
              <span>Unité</span>
              <span className="text-right">Total HT</span>
            </div>
            {rows.map((row) => <DocumentPreviewRow key={row.id} row={row} />)}
          </div>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4 text-sm leading-6 text-slate-700">
              <PreviewBlock title={template.legalBlockTitle} value={document.terms.paymentTerms} />
              <PreviewBlock title="Mentions légales" value={document.terms.legalMentions} />
              <PreviewBlock title="Gestion des déchets" value={document.terms.wasteManagement} />
              <PreviewBlock title="Notes de bas de page" value={document.terms.footerNotes} />
            </div>
            <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <TotalRow label="Total HT" value={totals.totalHt} />
              <TotalRow label="TVA" value={totals.totalVat} />
              <TotalRow label="Total TTC" value={totals.totalTtc} strong />
              <div className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-white">
                <div className="flex justify-between text-sm font-bold"><span>Net à payer</span><span>{formatCurrency(totals.totalTtc)}</span></div>
              </div>
              {totals.vatBreakdown.length ? (
                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  {totals.vatBreakdown.map((line) => (
                    <div key={line.rate} className="flex justify-between"><span>TVA {line.rate}%</span><span>{formatCurrency(line.vatAmount)}</span></div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          {template.showSignature ? (
            <section className="mt-10">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950"><FileSignature className="h-4 w-4" /> {template.signatureLabel}</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-28 rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Client</div>
                <div className="h-28 rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Entreprise</div>
              </div>
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function InfoCard({ title, lines }: { title: string; lines: Array<string | null | undefined> }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        {lines.filter(Boolean).map((line) => <div key={String(line)}>{line}</div>)}
      </div>
    </div>
  );
}

function DocumentPreviewRow({ row }: { row: FlatDocumentNode }) {
  if (row.node.type === "section") {
    return <div className="grid grid-cols-[70px_1fr_90px_90px_110px] bg-blue-50 px-4 py-3 text-sm font-bold text-slate-950"><span>{row.number}</span><span className="col-span-4">{row.node.title}</span></div>;
  }
  if (row.node.type === "subsection") {
    return <div className="grid grid-cols-[70px_1fr_90px_90px_110px] bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900"><span>{row.number}</span><span className="col-span-4">{row.node.title}</span></div>;
  }
  if (row.node.type === "text") {
    return <div className="border-t border-slate-100 px-4 py-3 text-sm leading-6 text-slate-600">{row.node.content}</div>;
  }
  if (row.node.type !== "line" && row.node.type !== "composite") {
    return <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">{row.node.title}</div>;
  }
  const item = row.node as DocumentItemNode;
  return (
    <div className="grid grid-cols-[70px_1fr_90px_90px_110px] border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
      <span>{row.number}</span>
      <span>
        <span className="font-medium text-slate-950">{item.title}</span>
        {item.description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span> : null}
      </span>
      <span className="text-right">{item.quantity}</span>
      <span>{formatUnit(item.unit)}</span>
      <span className="text-right font-semibold text-slate-950">{formatCurrency(item.quantity * item.unitPriceHt)}</span>
    </div>
  );
}

function PreviewBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-semibold text-slate-950">{title}</div>
      <div className="mt-1 whitespace-pre-line text-slate-600">{value}</div>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex justify-between py-1 ${strong ? "text-base font-bold text-slate-950" : "text-sm text-slate-600"}`}><span>{label}</span><span>{formatCurrency(value)}</span></div>;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function formatUnit(value: string) {
  if (value === "m2") return "m²";
  if (value === "m3") return "m³";
  return value;
}

