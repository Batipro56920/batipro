import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { calculateDocumentTotals, createDocumentLine, createDocumentSection, DocumentPreview, DocumentSendDialog, DocumentTotalsCard, downloadBusinessDocumentPdf, flattenDocumentNodes, validateBusinessDocument, type BusinessDocument, type BusinessDocumentNode, type DocumentItemKind, type ElectronicInvoicingCustomerType, type ElectronicInvoicingMetadata, type ElectronicInvoicingOperationType, type ElectronicInvoicingTransmissionStatus } from "../../document-engine";
import { addInvoicePayment, createProfitabilitySnapshot, getPaidAmount, getRemainingAmount, removeInvoicePayment } from "../application/invoicePayments";
import type { InvoicePayment, InvoiceRecord } from "../domain/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

const PAYMENT_METHOD_LABELS: Record<InvoicePayment["method"], string> = {
  transfer: "Virement",
  card: "Carte",
  cash: "Espèces",
  cheque: "Chèque",
  direct_debit: "Prélèvement",
};

type InvoiceClientWorkflowStatus = "sent" | "viewed" | "modification_requested" | "expired";

type InvoiceEditorProps = {
  invoice: InvoiceRecord;
  hasUnsavedChanges: boolean;
  clientWorkflowStatus?: InvoiceClientWorkflowStatus | null;
  onUnsavedChange: (invoiceId: string, dirty: boolean) => void;
  onChange: (invoice: InvoiceRecord) => void;
  onSave: (invoice: InvoiceRecord) => void | Promise<void>;
};

type ContextLink = {
  label: string;
  description: string;
  href: string;
};

const CLIENT_WORKFLOW_PANEL_META: Record<InvoiceClientWorkflowStatus, { label: string; description: string; actionLabel: string; className: string }> = {
  sent: {
    label: "Document envoyé",
    description: "Le document client attend encore une validation ou une signature. Relancez le client depuis le workflow existant.",
    actionLabel: "Relancer le client",
    className: "border-blue-200 bg-blue-50 text-blue-900",
  },
  viewed: {
    label: "Document consulté",
    description: "Le client a ouvert le document sans finaliser sa réponse. Préparez une relance avec le lien client.",
    actionLabel: "Relancer le client",
    className: "border-cyan-200 bg-cyan-50 text-cyan-900",
  },
  modification_requested: {
    label: "Modification demandée",
    description: "Le client a demandé une modification. Contrôlez la facture puis renvoyez une version à jour si nécessaire.",
    actionLabel: "Renvoyer au client",
    className: "border-amber-200 bg-amber-50 text-amber-950",
  },
  expired: {
    label: "Lien client expiré",
    description: "Le lien de consultation n'est plus utilisable. Générez un nouveau workflow client depuis cette facture.",
    actionLabel: "Renvoyer un lien",
    className: "border-red-200 bg-red-50 text-red-900",
  },
};

const CUSTOMER_TYPE_LABELS: Record<ElectronicInvoicingCustomerType, string> = {
  b2b_fr: "Entreprise France",
  b2c_fr: "Particulier France",
  public_fr: "Secteur public",
  foreign: "Client étranger",
};

const OPERATION_TYPE_LABELS: Record<ElectronicInvoicingOperationType, string> = {
  services: "Prestation de services",
  goods: "Livraison de biens",
  mixed: "Mixte biens + services",
  works: "Travaux bâtiment",
};

const TRANSMISSION_STATUS_LABELS: Record<ElectronicInvoicingTransmissionStatus, string> = {
  not_ready: "À compléter",
  ready: "Prête PDP",
  pending_pdp: "En attente PDP",
  transmitted: "Transmise",
  rejected: "Rejetée",
};

export function InvoiceEditor({ invoice, hasUnsavedChanges, clientWorkflowStatus = null, onUnsavedChange, onChange, onSave }: InvoiceEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const document = invoice.document;
  const electronicInvoicing = normalizeElectronicInvoicing(document.electronicInvoicing);
  const totals = document.totals ?? calculateDocumentTotals(document);
  const rows = useMemo(() => flattenDocumentNodes(document.nodes), [document.nodes]);
  const profitability = createProfitabilitySnapshot(invoice);
  const contextLinks = useMemo(() => buildInvoiceContextLinks(invoice), [invoice]);

  function updateDocument(patch: Partial<BusinessDocument>) {
    const nextDocument = { ...document, ...patch };
    setSaveError(null);
    onUnsavedChange(invoice.id, true);
    onChange({ ...invoice, document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) }, updatedAt: new Date().toISOString() });
  }

  function updateElectronicInvoicing(patch: Partial<ElectronicInvoicingMetadata>) {
    updateDocument({ electronicInvoicing: normalizeElectronicInvoicing({ ...electronicInvoicing, ...patch }) });
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
    setSaveError(null);
    onUnsavedChange(invoice.id, true);
    onChange(addInvoicePayment(invoice, payment));
  }

  function removePayment(paymentId: string) {
    setSaveError(null);
    onUnsavedChange(invoice.id, true);
    onChange(removeInvoicePayment(invoice, paymentId));
  }

  async function save() {
    if (saving) return;
    setSaveError(null);
    const validation = validateBusinessDocument(document);
    if (!validation.success) {
      setSaveError(validation.error.issues.map((issue) => issue.message).join(", "));
      return;
    }

    const overpaidAmount = getOverpaidAmount(invoice);
    if (overpaidAmount > 0) {
      setSaveError(`Les paiements dépassent le total TTC de ${formatCurrency(overpaidAmount)}. Retirez un paiement ou ajustez le montant avant d'enregistrer.`);
      return;
    }

    setSaving(true);
    try {
      await onSave(invoice);
      onUnsavedChange(invoice.id, false);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Enregistrement de la facture impossible."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Facturation</div>
            <div className="mt-2 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <input className="w-full min-w-0 rounded-xl border border-transparent text-xl font-bold text-slate-950 outline-none hover:border-slate-200 focus:border-blue-300 sm:w-auto sm:text-2xl" value={document.number} onChange={(event) => updateDocument({ number: event.target.value })} />
              <InvoiceStatusBadge status={invoice.status} />
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{TRANSMISSION_STATUS_LABELS[electronicInvoicing.transmissionStatus]}</span>
              {hasUnsavedChanges ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Non enregistré</span> : null}
            </div>
            <p className="mt-1 break-words text-sm text-slate-500">{document.title}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setPreviewOpen((open) => !open)}>Aperçu</Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => downloadBusinessDocumentPdf(document)}><Download className="h-4 w-4" /> PDF</Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Envoyer</Button>
            <Button className="col-span-2 w-full sm:w-auto" variant="primary" disabled={saving} onClick={save}><Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </div>
        {contextLinks.length ? <InvoiceContextLinks links={contextLinks} /> : null}
        {saveError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{saveError}</div> : null}
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Client" value={document.recipient.displayName} onChange={(displayName) => updateDocument({ recipient: { ...document.recipient, displayName } })} />
            <Field label="Adresse" value={document.siteAddress ?? ""} onChange={(siteAddress) => updateDocument({ siteAddress })} />
            <Field label="Date facture" type="date" value={document.issueDate} onChange={(issueDate) => updateDocument({ issueDate })} />
            <Field label="Echéance" type="date" value={document.dueDate ?? ""} onChange={(dueDate) => updateDocument({ dueDate })} />
          </div>

          <ElectronicInvoicingPanel metadata={electronicInvoicing} onChange={updateElectronicInvoicing} />

          <div className="flex flex-wrap gap-2 border-y border-slate-100 py-3">
            <Button variant="secondary" onClick={addSection}><Plus className="h-4 w-4" /> Section</Button>
            <Button variant="secondary" onClick={() => addLine("fourniture")}><Plus className="h-4 w-4" /> Ligne</Button>
            <Button variant="secondary" onClick={() => addLine("main_oeuvre")}><Plus className="h-4 w-4" /> Main d'oeuvre</Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[70px_1fr_110px_110px_120px] bg-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
                <span>N</span><span>Désignation</span><span className="text-right">Qte</span><span>PU HT</span><span className="text-right">Total HT</span>
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
        </div>

        <aside className="space-y-4">
          <ClientWorkflowActionPanel status={clientWorkflowStatus} onSend={() => setSendOpen(true)} />
          <DocumentTotalsCard document={document} totals={totals} />
          <PaymentPanel invoice={invoice} hasUnsavedChanges={hasUnsavedChanges} onAdd={addPayment} onRemove={removePayment} />
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

function ElectronicInvoicingPanel({ metadata, onChange }: { metadata: ElectronicInvoicingMetadata; onChange: (patch: Partial<ElectronicInvoicingMetadata>) => void }) {
  const missingRequiredFields = getElectronicInvoicingMissingFields(metadata);
  const readinessClass = missingRequiredFields.length
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Facturation électronique</div>
          <div className="mt-1 text-sm text-slate-600">Qualification PDP / e-reporting pour la réforme française.</div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${readinessClass}`}>
          {missingRequiredFields.length ? "À compléter" : "Données minimales OK"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SelectField label="Client" value={metadata.customerType} onChange={(customerType) => onChange({ customerType: customerType as ElectronicInvoicingCustomerType })} options={CUSTOMER_TYPE_LABELS} />
        <SelectField label="Opération" value={metadata.operationType} onChange={(operationType) => onChange({ operationType: operationType as ElectronicInvoicingOperationType })} options={OPERATION_TYPE_LABELS} />
        <Field label="SIREN client" value={metadata.buyerSiren ?? ""} onChange={(buyerSiren) => onChange({ buyerSiren: cleanIdentifier(buyerSiren) })} />
        <Field label="SIRET client" value={metadata.buyerSiret ?? ""} onChange={(buyerSiret) => onChange({ buyerSiret: cleanIdentifier(buyerSiret) })} />
        <Field label="TVA intra client" value={metadata.buyerVatNumber ?? ""} onChange={(buyerVatNumber) => onChange({ buyerVatNumber: cleanText(buyerVatNumber) })} />
        <SelectField label="Exigibilité TVA" value={metadata.vatExigibility ?? "payment"} onChange={(vatExigibility) => onChange({ vatExigibility: vatExigibility as ElectronicInvoicingMetadata["vatExigibility"] })} options={{ payment: "À l'encaissement", debit: "Sur les débits" }} />
        <SelectField label="Statut PDP" value={metadata.transmissionStatus} onChange={(transmissionStatus) => onChange({ transmissionStatus: transmissionStatus as ElectronicInvoicingTransmissionStatus })} options={TRANSMISSION_STATUS_LABELS} />
        <Field label="Plateforme PDP" value={metadata.pdpProvider ?? ""} onChange={(pdpProvider) => onChange({ pdpProvider: cleanText(pdpProvider) })} />
      </div>

      {missingRequiredFields.length ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800">
          Champs à compléter avant transmission PDP : {missingRequiredFields.join(", ")}.
        </div>
      ) : null}
    </div>
  );
}

function ClientWorkflowActionPanel({ status, onSend }: { status?: InvoiceClientWorkflowStatus | null; onSend: () => void }) {
  if (!status) return null;
  const meta = CLIENT_WORKFLOW_PANEL_META[status];

  return (
    <div className={`rounded-2xl border p-4 text-sm shadow-sm ${meta.className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Suivi client</div>
          <div className="mt-1 text-base font-bold">{meta.label}</div>
        </div>
        <Send className="h-4 w-4 shrink-0 opacity-70" />
      </div>
      <p className="mt-2 text-xs leading-5 opacity-90">{meta.description}</p>
      <Button className="mt-4 w-full" variant="secondary" onClick={onSend}>
        <Send className="h-4 w-4" /> {meta.actionLabel}
      </Button>
    </div>
  );
}

function InvoiceContextLinks({ links }: { links: ContextLink[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Contexte lié</div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} to={link.href} className="group flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-blue-200 hover:bg-blue-50">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-950">{link.label}</span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">{link.description}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-blue-600 transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function PaymentPanel({ invoice, hasUnsavedChanges, onAdd, onRemove }: { invoice: InvoiceRecord; hasUnsavedChanges: boolean; onAdd: (payment: Omit<InvoicePayment, "id">) => void; onRemove: (paymentId: string) => void }) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(getTodayInputDate);
  const [method, setMethod] = useState<InvoicePayment["method"]>("transfer");
  const [reference, setReference] = useState("");
  const parsedAmount = parseCommittedFrenchNumber(amount);
  const remainingAmount = getRemainingAmount(invoice);
  const overpaidAmount = getOverpaidAmount(invoice);
  const isInvoiceSettled = remainingAmount <= 0;
  const exceedsRemainingAmount = !isInvoiceSettled && parsedAmount !== null && parsedAmount > remainingAmount;
  const canAddPayment = parsedAmount !== null && parsedAmount > 0 && Boolean(paidAt) && !isInvoiceSettled && !exceedsRemainingAmount;

  useEffect(() => {
    setAmount("");
    setPaidAt(getTodayInputDate());
    setMethod("transfer");
    setReference("");
  }, [invoice.id]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">Paiements</div>
          <div className="mt-2 text-slate-500">Encaissé : {formatCurrency(getPaidAmount(invoice))} · Reste : {formatCurrency(remainingAmount)}</div>
        </div>
        {hasUnsavedChanges ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Non enregistré</span> : null}
      </div>
      {hasUnsavedChanges ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Les modifications de la facture seront validées à l'enregistrement.</div> : null}
      {overpaidAmount > 0 ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Les paiements dépassent le total TTC de {formatCurrency(overpaidAmount)}. Retirez un paiement ou ajustez la facture avant d'enregistrer.</div> : null}
      <div className="mt-4 space-y-2">
        {invoice.payments.length ? invoice.payments.map((payment) => (
          <div key={payment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-950">{formatCurrency(payment.amount)}</div>
                <div className="mt-1 text-xs text-slate-500">{formatDate(payment.paidAt)} · {PAYMENT_METHOD_LABELS[payment.method]}</div>
                {payment.reference ? <div className="mt-1 text-xs text-slate-500">Ref. {payment.reference}</div> : null}
              </div>
              <Button variant="ghost" size="sm" title="Retirer ce paiement" onClick={() => onRemove(payment.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Aucun paiement enregistré.</div>
        )}
      </div>
      <div className="mt-4 grid gap-2">
        <input className={inputClass} inputMode="decimal" placeholder="Montant" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <div className="text-xs text-slate-500">
          {isInvoiceSettled ? "Cette facture est déjà soldée." : `Reste dû actuel : ${formatCurrency(remainingAmount)}`}
        </div>
        {exceedsRemainingAmount ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Le montant saisi dépasse le reste dû.</div> : null}
        <input className={inputClass} type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value as InvoicePayment["method"])}>
          <option value="transfer">Virement</option>
          <option value="card">Carte</option>
          <option value="cash">Espèces</option>
          <option value="cheque">Chèque</option>
          <option value="direct_debit">Prélèvement</option>
        </select>
        <input className={inputClass} placeholder="Référence" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Button variant="secondary" disabled={!canAddPayment} onClick={() => {
          if (!canAddPayment) return;
          const trimmedReference = reference.trim();
          onAdd({ amount: parsedAmount, paidAt, method, ...(trimmedReference ? { reference: trimmedReference } : {}) });
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

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
      {label}
      <select className={`${inputClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)}>
        {Object.entries(options).map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(() => formatEditableNumber(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatEditableNumber(value));
  }, [focused, value]);

  return (
    <input
      className={`${inputClass} text-right`}
      inputMode="decimal"
      value={draft}
      onBlur={() => {
        setFocused(false);
        const parsed = parseCommittedFrenchNumber(draft);
        if (parsed === null) {
          setDraft(formatEditableNumber(value));
          return;
        }
        setDraft(formatEditableNumber(parsed));
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        const parsed = parseCommittedFrenchNumber(nextDraft);
        if (parsed !== null) onChange(parsed);
      }}
      onFocus={() => setFocused(true)}
    />
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span>{label}</span><span className="font-semibold text-slate-950">{value}</span></div>;
}

function buildInvoiceContextLinks(invoice: InvoiceRecord): ContextLink[] {
  const links: ContextLink[] = [];
  const projectId = routeProjectId(invoice.document.projectId) ?? routeProjectId(invoice.projectId);
  const quoteId = cleanText(invoice.document.quoteId) ?? cleanText(invoice.sourceQuoteId);
  const chantierId = cleanText(invoice.document.chantierId) ?? cleanText(invoice.chantierId);

  if (projectId) {
    links.push({
      label: "Projet commercial",
      description: "Ouvrir l'onglet Devis",
      href: `/projets/${projectId}?tab=quotes`,
    });
  }

  if (quoteId) {
    links.push({
      label: "Devis source",
      description: projectId ? "Modifier le devis depuis le projet" : "Retrouver le devis et son projet",
      href: projectId ? `/projets/${projectId}/devis/${encodeURIComponent(quoteId)}/edit` : `/crm/devis/${encodeURIComponent(quoteId)}/edit`,
    });
  }

  links.push({
    label: "Encaissements",
    description: "Suivre les règlements et le reste dû",
    href: "/financier/encaissements",
  });

  if (chantierId) {
    links.push({
      label: "Chantier lié",
      description: "Ouvrir le dossier chantier",
      href: `/chantiers/${encodeURIComponent(chantierId)}/financier`,
    });
  }

  return links;
}

function routeProjectId(value?: string | null) {
  const id = cleanText(value);
  if (!id) return null;
  if (id.startsWith("opportunity-") || id.startsWith("prospect-") || id.startsWith("client-")) return id;
  return null;
}

function getElectronicInvoicingMissingFields(metadata: ElectronicInvoicingMetadata) {
  const missing: string[] = [];
  if (metadata.customerType === "b2b_fr" && !metadata.buyerSiren && !metadata.buyerSiret) missing.push("SIREN ou SIRET client");
  if (!metadata.operationType) missing.push("type d'opération");
  if (!metadata.vatExigibility) missing.push("exigibilité TVA");
  return missing;
}

function normalizeElectronicInvoicing(value?: ElectronicInvoicingMetadata | null): ElectronicInvoicingMetadata {
  return {
    customerType: value?.customerType ?? "b2b_fr",
    operationType: value?.operationType ?? "services",
    transmissionStatus: value?.transmissionStatus ?? "not_ready",
    buyerSiren: cleanIdentifier(value?.buyerSiren),
    buyerSiret: cleanIdentifier(value?.buyerSiret),
    sellerSiren: cleanIdentifier(value?.sellerSiren),
    sellerSiret: cleanIdentifier(value?.sellerSiret),
    buyerVatNumber: cleanText(value?.buyerVatNumber),
    sellerVatNumber: cleanText(value?.sellerVatNumber),
    vatExigibility: value?.vatExigibility ?? "payment",
    pdpProvider: cleanText(value?.pdpProvider),
    pdpReference: cleanText(value?.pdpReference),
    lastTransmissionAt: value?.lastTransmissionAt ?? null,
    rejectionReason: cleanText(value?.rejectionReason),
  };
}

function cleanIdentifier(value?: string | null) {
  return cleanText(value)?.replace(/\s/g, "") ?? null;
}

function cleanText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
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

function parseCommittedFrenchNumber(value: string) {
  const text = value.trim();
  if (!text || /[,.]$/.test(text)) return null;
  return parseFrenchNumber(text);
}

function parseFrenchNumber(value: string) {
  const text = value.trim();
  if (!text) return null;
  const normalized = text.includes(",")
    ? text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    : text.replace(/\s/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatEditableNumber(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function getTodayInputDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "-";
  const [dateOnly] = value.split("T");
  const parts = dateOnly.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return new Date(value).toLocaleDateString("fr-FR");
}

function getOverpaidAmount(invoice: InvoiceRecord) {
  const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
  return roundMoney(Math.max(0, getPaidAmount(invoice) - totals.totalTtc));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}