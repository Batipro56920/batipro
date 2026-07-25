import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, FileCode2, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { calculateDocumentTotals, createDocumentLine, createDocumentSection, DocumentPreview, DocumentSendDialog, DocumentTotalsCard, downloadBusinessDocumentPdf, flattenDocumentNodes, validateBusinessDocument, type BusinessDocument, type BusinessDocumentNode, type DocumentItemKind, type ElectronicInvoicingCustomerType, type ElectronicInvoicingMetadata, type ElectronicInvoicingOperationType, type ElectronicInvoicingTransmissionStatus, type FacturXExternalValidationStatus } from "../../document-engine";
import { addInvoicePayment, createProfitabilitySnapshot, getPaidAmount, getRemainingAmount, removeInvoicePayment } from "../application/invoicePayments";
import { appendPdpSimulationEvent, buildPdpSimulationEvent, canUseInvoiceElectronicInvoicingStatus, cleanInvoiceElectronicInvoicingIdentifier, cleanInvoiceElectronicInvoicingText, ELECTRONIC_INVOICING_TRANSMISSION_STATUS_LABELS, FACTURX_EXTERNAL_VALIDATION_STATUS_LABELS, getInvoiceElectronicInvoicingReadiness, getInvoicePdpTransmissionReadiness, INVOICE_ELECTRONIC_INVOICING_STRATEGY, normalizeInvoiceElectronicInvoicing, normalizeInvoiceElectronicInvoicingPatch, PDP_SIMULATION_STATUS_LABELS } from "../application/electronicInvoicing";
import { downloadFacturXPdf, getFacturXExportReadiness, type FacturXExportReadiness } from "../application/facturxExport";
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

const TRANSMISSION_STATUS_LABELS = ELECTRONIC_INVOICING_TRANSMISSION_STATUS_LABELS;

export function InvoiceEditor({ invoice, hasUnsavedChanges, clientWorkflowStatus = null, onUnsavedChange, onChange, onSave }: InvoiceEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingFacturX, setExportingFacturX] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const document = invoice.document;
  const electronicInvoicing = normalizeInvoiceElectronicInvoicing(document.electronicInvoicing, document);
  const facturXReadiness = useMemo(() => getFacturXExportReadiness(document), [document]);
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
    updateDocument({ electronicInvoicing: normalizeInvoiceElectronicInvoicingPatch(electronicInvoicing, patch, document) });
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

  async function exportFacturXPdf() {
    if (exportingFacturX) return;
    setSaveError(null);
    setExportingFacturX(true);
    try {
      const filename = downloadFacturXPdf(document);
      const exportedAt = new Date().toISOString();
      const nextElectronicInvoicing = normalizeInvoiceElectronicInvoicingPatch(electronicInvoicing, {
        lastFacturXExportAt: exportedAt,
        lastFacturXExportFilename: filename,
        facturXExportCount: (electronicInvoicing.facturXExportCount ?? 0) + 1,
      }, document);
      const nextDocument = {
        ...document,
        electronicInvoicing: nextElectronicInvoicing,
      };
      const nextInvoice = {
        ...invoice,
        document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) },
        updatedAt: exportedAt,
      };
      onChange(nextInvoice);
      await onSave(nextInvoice);
      onUnsavedChange(invoice.id, false);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Export Factur-X impossible."));
    } finally {
      setExportingFacturX(false);
    }
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
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${facturXReadiness.badgeClassName}`}>{facturXReadiness.label}</span>
              {facturXReadiness.canExport ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">{facturXReadiness.externalValidationLabel}</span> : null}
              {electronicInvoicing.lastFacturXExportAt ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Export généré</span> : null}
              {electronicInvoicing.facturXExternalValidationStatus === "valid" ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Validation externe OK</span> : null}
              {electronicInvoicing.pdpSimulationStatus === "queued" ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">Simulation PDP en file</span> : null}
              {electronicInvoicing.pdpSimulationStatus === "simulated" ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Simulation PDP OK</span> : null}
              {hasUnsavedChanges ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Non enregistré</span> : null}
            </div>
            <p className="mt-1 break-words text-sm text-slate-500">{document.title}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setPreviewOpen((open) => !open)}>Aperçu</Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => downloadBusinessDocumentPdf(document)}><Download className="h-4 w-4" /> PDF</Button>
            <Button className="w-full sm:w-auto" variant="secondary" disabled={!facturXReadiness.canExport || exportingFacturX} onClick={() => void exportFacturXPdf()}><FileCode2 className="h-4 w-4" /> {exportingFacturX ? "Export..." : "Factur-X PDF"}</Button>
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

          <ElectronicInvoicingPanel document={document} metadata={electronicInvoicing} onChange={updateElectronicInvoicing} />

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

function ElectronicInvoicingPanel({ document, metadata, onChange }: { document: BusinessDocument; metadata: ElectronicInvoicingMetadata; onChange: (patch: Partial<ElectronicInvoicingMetadata>) => void }) {
  const readiness = getInvoiceElectronicInvoicingReadiness(metadata);
  const pdpReadiness = getInvoicePdpTransmissionReadiness(metadata);
  const facturXReadiness = getFacturXExportReadiness(document);
  const blockedTransmissionStatuses = getBlockedTransmissionStatusOptions(metadata);
  const canRunSimulation = pdpReadiness.canTransmit && metadata.pdpSimulationStatus === "queued";

  function updateExternalValidationStatus(status: FacturXExternalValidationStatus) {
    onChange({
      facturXExternalValidationStatus: status,
      facturXExternalValidationAt: status === "valid" ? metadata.facturXExternalValidationAt ?? new Date().toISOString() : null,
    });
  }

  function queuePdpSimulation() {
    if (!pdpReadiness.canTransmit) return;
    const queuedAt = new Date().toISOString();
    const event = buildPdpSimulationEvent("queued", "Facture mise en file PDP simulée", `PDP : ${metadata.pdpProvider ?? "non renseignée"}`);
    onChange({
      pdpSimulationStatus: "queued",
      pdpSimulationQueuedAt: queuedAt,
      pdpSimulationEventLog: appendPdpSimulationEvent(metadata, event),
      transmissionStatus: "pending_pdp",
    });
  }

  function runPdpSimulation() {
    if (!canRunSimulation) return;
    const simulatedAt = new Date().toISOString();
    const event = buildPdpSimulationEvent("simulated", "Dépôt PDP simulé", "Simulation interne Batipro, sans envoi à une PDP réelle.");
    onChange({
      pdpSimulationStatus: "simulated",
      pdpSimulationLastRunAt: simulatedAt,
      pdpSimulationEventLog: appendPdpSimulationEvent(metadata, event),
      transmissionStatus: "pending_pdp",
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Facturation électronique</div>
          <div className="mt-1 text-sm text-slate-600">{INVOICE_ELECTRONIC_INVOICING_STRATEGY.description}</div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${readiness.badgeClassName}`}>
            {readiness.label}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${pdpReadiness.badgeClassName}`}>
            {pdpReadiness.label}
          </span>
          <Button variant="secondary" size="sm" disabled={!readiness.canMarkReady || metadata.transmissionStatus === "ready"} onClick={() => onChange({ transmissionStatus: "ready" })}>
            {INVOICE_ELECTRONIC_INVOICING_STRATEGY.readyActionLabel}
          </Button>
          <Button variant="secondary" size="sm" disabled={!pdpReadiness.canTransmit} onClick={queuePdpSimulation}>
            Mettre en file simulation PDP
          </Button>
          <Button variant="secondary" size="sm" disabled={!canRunSimulation} onClick={runPdpSimulation}>
            Simuler dépôt PDP
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SelectField label="Client" value={metadata.customerType} onChange={(customerType) => onChange({ customerType: customerType as ElectronicInvoicingCustomerType })} options={CUSTOMER_TYPE_LABELS} />
        <SelectField label="Opération" value={metadata.operationType} onChange={(operationType) => onChange({ operationType: operationType as ElectronicInvoicingOperationType })} options={OPERATION_TYPE_LABELS} />
        <Field label="SIREN entreprise" value={metadata.sellerSiren ?? ""} onChange={(sellerSiren) => onChange({ sellerSiren: cleanInvoiceElectronicInvoicingIdentifier(sellerSiren) })} />
        <Field label="SIRET entreprise" value={metadata.sellerSiret ?? ""} onChange={(sellerSiret) => onChange({ sellerSiret: cleanInvoiceElectronicInvoicingIdentifier(sellerSiret), sellerSiren: null })} />
        <Field label="SIREN client" value={metadata.buyerSiren ?? ""} onChange={(buyerSiren) => onChange({ buyerSiren: cleanInvoiceElectronicInvoicingIdentifier(buyerSiren) })} />
        <Field label="SIRET client" value={metadata.buyerSiret ?? ""} onChange={(buyerSiret) => onChange({ buyerSiret: cleanInvoiceElectronicInvoicingIdentifier(buyerSiret), buyerSiren: null })} />
        <Field label="TVA intra client" value={metadata.buyerVatNumber ?? ""} onChange={(buyerVatNumber) => onChange({ buyerVatNumber: cleanInvoiceElectronicInvoicingText(buyerVatNumber) })} />
        <SelectField label="Exigibilité TVA" value={metadata.vatExigibility ?? "payment"} onChange={(vatExigibility) => onChange({ vatExigibility: vatExigibility as ElectronicInvoicingMetadata["vatExigibility"] })} options={{ payment: "À l'encaissement", debit: "Sur les débits" }} />
        <SelectField label="Validation externe Factur-X" value={metadata.facturXExternalValidationStatus ?? "not_checked"} onChange={(status) => updateExternalValidationStatus(status as FacturXExternalValidationStatus)} options={FACTURX_EXTERNAL_VALIDATION_STATUS_LABELS} />
        <Field label="Validateur externe" value={metadata.facturXExternalValidator ?? ""} onChange={(facturXExternalValidator) => onChange({ facturXExternalValidator: cleanInvoiceElectronicInvoicingText(facturXExternalValidator) })} />
        <SelectField label="Statut e-facturation" value={metadata.transmissionStatus} onChange={(transmissionStatus) => onChange({ transmissionStatus: transmissionStatus as ElectronicInvoicingTransmissionStatus })} options={TRANSMISSION_STATUS_LABELS} disabledOptions={blockedTransmissionStatuses} />
        <Field label="Plateforme PDP" value={metadata.pdpProvider ?? ""} onChange={(pdpProvider) => onChange({ pdpProvider: cleanInvoiceElectronicInvoicingText(pdpProvider) })} />
      </div>

      {readiness.missingFields.length ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800">
          Champs à compléter avant export Factur-X / transmission PDP : {readiness.missingFields.join(", ")}.
        </div>
      ) : null}
      {!pdpReadiness.canTransmit ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          Transmission PDP bloquée : {pdpReadiness.missingFields.join(", ")}.
        </div>
      ) : null}

      <PdpPreTransmissionPanel document={document} metadata={metadata} />
      <PdpSimulationTrace metadata={metadata} />
      <FacturXExportTrace metadata={metadata} />
      <FacturXChecklist readiness={facturXReadiness} />
    </div>
  );
}

function PdpPreTransmissionPanel({ document, metadata }: { document: BusinessDocument; metadata: ElectronicInvoicingMetadata }) {
  const readiness = getInvoicePdpTransmissionReadiness(metadata);
  const minimumReadiness = getInvoiceElectronicInvoicingReadiness(metadata);
  const totals = document.totals ?? calculateDocumentTotals(document);
  const checklist = [
    { label: "Données minimales", ok: minimumReadiness.canMarkReady },
    { label: "Export Factur-X généré", ok: Boolean(metadata.lastFacturXExportAt) },
    { label: "Validation externe Factur-X", ok: metadata.facturXExternalValidationStatus === "valid" },
    { label: "PDP choisie", ok: Boolean(metadata.pdpProvider) },
  ];

  return (
    <div className={`mt-4 rounded-xl border px-3 py-3 text-xs ${readiness.canTransmit ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold text-slate-950">Pré-transmission PDP</div>
          <div className="mt-1 text-slate-500">Récapitulatif interne avant futur connecteur PDP. Aucun envoi réel n'est déclenché ici.</div>
        </div>
        <span className={`w-fit rounded-full border px-2.5 py-1 font-semibold ${readiness.badgeClassName}`}>{readiness.label}</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <Line label="Facture" value={document.number} />
        <Line label="Client" value={document.recipient.displayName || "Client à définir"} />
        <Line label="Montant TTC" value={formatCurrency(totals.totalTtc)} />
        <Line label="PDP" value={metadata.pdpProvider ?? "PDP à renseigner"} />
        <Line label="SIRET entreprise" value={metadata.sellerSiret ?? metadata.sellerSiren ?? "À renseigner"} />
        <Line label="SIRET client" value={metadata.buyerSiret ?? metadata.buyerSiren ?? "À renseigner"} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${item.ok ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="font-medium">{item.label}</span>
          </div>
        ))}
      </div>
      {!readiness.canTransmit ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-medium text-red-700">Pré-transmission bloquée : {readiness.missingFields.join(", ")}.</div> : null}
    </div>
  );
}

function PdpSimulationTrace({ metadata }: { metadata: ElectronicInvoicingMetadata }) {
  const events = metadata.pdpSimulationEventLog ?? [];
  const status = metadata.pdpSimulationStatus ?? "not_queued";
  const statusClassName = status === "simulated"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : status === "queued"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : status === "blocked"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-white text-slate-600";

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${statusClassName}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="font-semibold">Simulation PDP : {PDP_SIMULATION_STATUS_LABELS[status]}</div>
        {metadata.pdpSimulationQueuedAt ? <div>Mise en file : {formatDateTime(metadata.pdpSimulationQueuedAt)}</div> : null}
        {metadata.pdpSimulationLastRunAt ? <div>Simulation : {formatDateTime(metadata.pdpSimulationLastRunAt)}</div> : null}
      </div>
      <div className="mt-1 text-slate-500">Simulation interne uniquement : aucun dépôt réel PDP n'est effectué depuis cet écran.</div>
      {events.length ? (
        <div className="mt-2 space-y-1">
          {events.slice(-3).reverse().map((event) => (
            <div key={event.id} className="rounded-lg bg-white/70 px-2 py-1">
              <span className="font-medium">{formatDateTime(event.at)}</span> · {event.label}{event.detail ? ` — ${event.detail}` : ""}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FacturXExportTrace({ metadata }: { metadata: ElectronicInvoicingMetadata }) {
  if (!metadata.lastFacturXExportAt) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Aucun export Factur-X généré pour cette facture.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900">
      <div className="font-semibold">Dernier export Factur-X : {formatDateTime(metadata.lastFacturXExportAt)}</div>
      <div className="mt-1 text-emerald-800">Fichier : {metadata.lastFacturXExportFilename ?? "nom non enregistré"}</div>
      <div className="mt-0.5 text-emerald-800">Exports générés : {metadata.facturXExportCount ?? 1}</div>
      {metadata.facturXExternalValidationStatus === "valid" ? <div className="mt-0.5 text-emerald-800">Validation externe : {formatDateTime(metadata.facturXExternalValidationAt ?? metadata.lastFacturXExportAt)}</div> : null}
    </div>
  );
}

function FacturXChecklist({ readiness }: { readiness: FacturXExportReadiness }) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contrôle export Factur-X</div>
          <div className="mt-1 text-xs text-slate-500">Prévalidation Batipro. La validation officielle reste externe avant dépôt PDP ou usage légal.</div>
        </div>
        <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${readiness.badgeClassName}`}>{readiness.label}</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {readiness.checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-2 text-xs text-slate-700">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.level === "warning" ? "bg-amber-400" : item.ok ? "bg-emerald-500" : "bg-red-500"}`} />
            <span>
              <span className="font-semibold text-slate-900">{item.label}</span>
              {item.detail ? <span className="mt-0.5 block text-slate-500">{item.detail}</span> : null}
            </span>
          </div>
        ))}
      </div>
      {readiness.canExport ? <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800">{readiness.externalValidationLabel} : contrôler le PDF avec un validateur Factur-X / PDF-A3 avant transmission PDP.</div> : null}
      {readiness.missingFields.length ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">À corriger : {readiness.missingFields.join(", ")}.</div> : null}
      {readiness.warnings.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800">À vérifier : {readiness.warnings.join(", ")}.</div> : null}
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

function SelectField({ label, value, onChange, options, disabledOptions = new Set() }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string>; disabledOptions?: Set<string> }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
      {label}
      <select className={`${inputClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)}>
        {Object.entries(options).map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue} disabled={disabledOptions.has(optionValue)}>{optionLabel}</option>)}
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

function getBlockedTransmissionStatusOptions(metadata: ElectronicInvoicingMetadata) {
  return new Set(
    Object.keys(TRANSMISSION_STATUS_LABELS).filter(
      (status) => !canUseInvoiceElectronicInvoicingStatus(metadata, status as ElectronicInvoicingTransmissionStatus),
    ),
  );
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

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
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