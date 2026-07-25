import { calculateDocumentTotals, calculateLineTotalHt, createBusinessDocumentPdf, flattenDocumentNodes, type BusinessDocument, type DocumentItemNode, type DocumentParty, type DocumentUnit, type PaymentMethod } from "../../document-engine";
import { getInvoiceElectronicInvoicingReadiness, normalizeInvoiceElectronicInvoicing } from "./electronicInvoicing";
import type { jsPDF } from "jspdf";

const FACTURX_XML_FILENAME = "factur-x.xml";

type FacturXExportResult = {
  filename: string;
  xml: string;
};

export type FacturXChecklistItem = {
  label: string;
  ok: boolean;
  level?: "ok" | "warning" | "error";
  detail?: string;
};

export type FacturXExportReadiness = {
  canExport: boolean;
  label: "Factur-X prévalidée" | "Factur-X à corriger";
  externalValidationLabel: "Validation externe requise" | "Corriger avant validation externe";
  badgeClassName: string;
  missingFields: string[];
  warnings: string[];
  checklist: FacturXChecklistItem[];
};

type JsPdfAttachmentInternal = jsPDF & {
  addMetadata?: (metadata: string) => void;
  internal: jsPDF["internal"] & {
    events: {
      subscribe: (topic: string, callback: () => void) => void;
    };
    newObject: () => number;
    out: (line: string) => void;
  };
};

export function getFacturXExportReadiness(document: BusinessDocument): FacturXExportReadiness {
  const metadata = normalizeInvoiceElectronicInvoicing(document.electronicInvoicing, document);
  const electronicReadiness = getInvoiceElectronicInvoicingReadiness(metadata);
  const totals = document.totals ?? calculateDocumentTotals(document);
  const lines = getFacturXLines(document);
  const lineIssues = getLineIssues(lines);
  const missingFields = [
    ...electronicReadiness.missingFields,
    ...requiredField(!["invoice", "credit_note"].includes(document.kind), "document facture ou avoir"),
    ...requiredField(!cleanText(document.number), "numéro de facture"),
    ...requiredField(!isValidDocumentDate(document.issueDate), "date de facture"),
    ...requiredField(!cleanText(document.company.displayName), "nom entreprise"),
    ...requiredField(!cleanText(document.recipient.displayName), "nom client"),
    ...requiredField(document.currency !== "EUR", "devise EUR"),
    ...requiredField(lines.length === 0, "au moins une ligne facturable"),
    ...lineIssues,
    ...requiredField(!Number.isFinite(totals.totalHt), "total HT calculable"),
    ...requiredField(!Number.isFinite(totals.totalVat), "TVA calculable"),
    ...requiredField(!Number.isFinite(totals.totalTtc) || totals.totalTtc <= 0, "total TTC positif"),
    ...requiredField(totals.vatBreakdown.length === 0, "ventilation TVA"),
  ];
  const warnings = [
    ...requiredField(!cleanText(document.company.address), "adresse entreprise non renseignée"),
    ...requiredField(!cleanText(document.recipient.address) && !cleanText(document.siteAddress), "adresse client ou chantier non renseignée"),
    ...requiredField(!document.dueDate, "échéance non renseignée"),
    ...requiredField(!metadata.pdpProvider, "PDP non choisie"),
  ];
  const canExport = missingFields.length === 0;

  return {
    canExport,
    label: canExport ? "Factur-X prévalidée" : "Factur-X à corriger",
    externalValidationLabel: canExport ? "Validation externe requise" : "Corriger avant validation externe",
    badgeClassName: canExport
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800",
    missingFields,
    warnings,
    checklist: [
      {
        label: "Données e-facturation minimales",
        ok: electronicReadiness.canMarkReady,
        detail: electronicReadiness.canMarkReady ? undefined : electronicReadiness.missingFields.join(", "),
      },
      { label: "Document facture / avoir", ok: ["invoice", "credit_note"].includes(document.kind) },
      { label: "Numéro et date", ok: Boolean(cleanText(document.number)) && isValidDocumentDate(document.issueDate) },
      { label: "Entreprise et client", ok: Boolean(cleanText(document.company.displayName) && cleanText(document.recipient.displayName)) },
      { label: "Lignes facturables", ok: lines.length > 0 && lineIssues.length === 0, detail: lineIssues[0] },
      { label: "Totaux et TVA", ok: Number.isFinite(totals.totalTtc) && totals.totalTtc > 0 && totals.vatBreakdown.length > 0 },
      {
        label: "XML enrichi Batipro",
        ok: canExport,
        detail: canExport ? "Contacts, livraison, paiement, références et TVA structurés quand disponibles" : "Corriger les blocages avant enrichissement fiable",
      },
      {
        label: "PDF avec XML embarqué",
        ok: canExport,
        detail: canExport ? FACTURX_XML_FILENAME : "Corriger les blocages avant génération du PDF Factur-X",
      },
      {
        label: "Validation externe officielle",
        ok: false,
        level: "warning",
        detail: canExport
          ? "À contrôler avec un validateur Factur-X / PDF-A3 avant dépôt PDP ou usage légal."
          : "Non lançable tant que l'export Batipro n'est pas prévalidé.",
      },
    ],
  };
}

export function buildFacturXXmlExport(document: BusinessDocument): FacturXExportResult {
  const readiness = getFacturXExportReadiness(document);

  if (!readiness.canExport) {
    throw new Error(`Export Factur-X impossible : ${readiness.missingFields.join(", ")}.`);
  }

  const metadata = normalizeInvoiceElectronicInvoicing(document.electronicInvoicing, document);
  const totals = document.totals ?? calculateDocumentTotals(document);
  const lines = getFacturXLines(document);
  const filename = `${sanitizeFilename(document.number)}-${FACTURX_XML_FILENAME}`;

  return {
    filename,
    xml: buildCrossIndustryInvoiceXml(document, metadata, totals, lines),
  };
}

export function downloadFacturXXml(document: BusinessDocument) {
  const exportResult = buildFacturXXmlExport(document);
  downloadBlob(exportResult.filename, exportResult.xml, "application/xml;charset=utf-8");
}

export function downloadFacturXPdf(document: BusinessDocument) {
  const exportResult = buildFacturXXmlExport(document);
  const pdf = createBusinessDocumentPdf(document);
  const filename = `${sanitizeFilename(document.number)}-factur-x.pdf`;

  pdf.setProperties({
    title: `${document.number} - Factur-X`,
    subject: "Facture Batipro avec donnees XML Factur-X embarquees",
    creator: "Batipro",
  });
  attachFacturXXml(pdf, exportResult.xml);
  pdf.save(filename);
  return filename;
}

function attachFacturXXml(pdf: jsPDF, xmlContent: string) {
  const target = pdf as JsPdfAttachmentInternal;
  const createdAt = new Date();
  const pdfDate = formatPdfDate(createdAt);
  const xmlByteLength = asciiByteLength(xmlContent);
  let embeddedFileObjectNumber = 0;
  let fileSpecObjectNumber = 0;

  if (typeof target.addMetadata === "function") {
    target.addMetadata(buildFacturXXmpMetadata(createdAt));
  }

  target.internal.events.subscribe("postPutResources", () => {
    embeddedFileObjectNumber = target.internal.newObject();
    target.internal.out("<<");
    target.internal.out("/Type /EmbeddedFile");
    target.internal.out("/Subtype /text#2Fxml");
    target.internal.out(`/Params << /Size ${xmlByteLength} /ModDate (${pdfDate}) >>`);
    target.internal.out(`/Length ${xmlByteLength}`);
    target.internal.out(">>");
    target.internal.out("stream");
    target.internal.out(xmlContent);
    target.internal.out("endstream");
    target.internal.out("endobj");

    fileSpecObjectNumber = target.internal.newObject();
    target.internal.out("<<");
    target.internal.out("/Type /Filespec");
    target.internal.out(`/F (${pdfString(FACTURX_XML_FILENAME)})`);
    target.internal.out(`/UF ${pdfUtf16String(FACTURX_XML_FILENAME)}`);
    target.internal.out("/AFRelationship /Alternative");
    target.internal.out("/Desc (Factur-X XML invoice data)");
    target.internal.out(`/EF << /F ${embeddedFileObjectNumber} 0 R /UF ${embeddedFileObjectNumber} 0 R >>`);
    target.internal.out(">>");
    target.internal.out("endobj");
  });

  target.internal.events.subscribe("putCatalog", () => {
    if (!fileSpecObjectNumber) return;
    target.internal.out(`/Names << /EmbeddedFiles << /Names [(${pdfString(FACTURX_XML_FILENAME)}) ${fileSpecObjectNumber} 0 R] >> >>`);
    target.internal.out(`/AF [${fileSpecObjectNumber} 0 R]`);
  });
}

function buildCrossIndustryInvoiceXml(
  document: BusinessDocument,
  metadata: ReturnType<typeof normalizeInvoiceElectronicInvoicing>,
  totals: ReturnType<typeof calculateDocumentTotals>,
  lines: DocumentItemNode[],
) {
  const invoiceTypeCode = document.kind === "credit_note" ? "381" : "380";
  const lineXml = lines.map((line, index) => buildLineXml(line, index + 1)).join("\n");
  const vatXml = totals.vatBreakdown.map(buildVatBreakdownXml).join("\n");
  const paymentTerms = document.terms.paymentTerms || document.terms.legalMentions || "Conditions de paiement Batipro";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basicwl</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xml(document.number)}</ram:ID>
    <ram:TypeCode>${invoiceTypeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatXmlDate(document.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
${document.title ? `    <ram:Name>${xml(document.title)}</ram:Name>` : ""}
${document.description ? `    <ram:IncludedNote>\n      <ram:Content>${xml(document.description)}</ram:Content>\n    </ram:IncludedNote>` : ""}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lineXml}
    <ram:ApplicableHeaderTradeAgreement>
${buyerReferenceXml(document)}
      <ram:SellerTradeParty>
        <ram:Name>${xml(document.company.displayName)}</ram:Name>
${tradeContactXml(document.company)}
${partyIdentifierXml(metadata.sellerSiret ?? metadata.sellerSiren)}
${taxRegistrationXml(metadata.sellerVatNumber)}
${postalAddressXml(document.company.address)}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xml(document.recipient.displayName)}</ram:Name>
${tradeContactXml(document.recipient)}
${partyIdentifierXml(metadata.buyerSiret ?? metadata.buyerSiren)}
${taxRegistrationXml(metadata.buyerVatNumber)}
${postalAddressXml(document.recipient.address)}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
${deliveryPartyXml(document)}
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatXmlDate(document.issueDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${document.currency}</ram:InvoiceCurrencyCode>
${paymentMeansXml(document.terms.paymentMethods)}
${vatXml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${xml(paymentTerms)}</ram:Description>
${document.dueDate ? `        <ram:DueDateDateTime>\n          <udt:DateTimeString format="102">${formatXmlDate(document.dueDate)}</udt:DateTimeString>\n        </ram:DueDateDateTime>` : ""}
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${money(totals.totalHt)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${money(totals.totalHt)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${document.currency}">${money(totals.totalVat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${money(totals.totalTtc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${money(totals.totalTtc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

function buildLineXml(line: DocumentItemNode, position: number) {
  const lineTotal = calculateLineTotalHt(line).toDecimalPlaces(2).toNumber();
  return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${position}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${xml(line.title)}</ram:Name>
${line.description ? `        <ram:Description>${xml(line.description)}</ram:Description>` : ""}
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${money(line.unitPriceHt)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode(line.unit)}">${quantity(line.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${vatCategoryCode(line.vatRate)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${quantity(line.vatRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${money(lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
}

function buildVatBreakdownXml(breakdown: { rate: number; baseHt: number; vatAmount: number }) {
  return `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${money(breakdown.vatAmount)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${money(breakdown.baseHt)}</ram:BasisAmount>
        <ram:CategoryCode>${vatCategoryCode(breakdown.rate)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${quantity(breakdown.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;
}

function buildFacturXXmpMetadata(createdAt: Date) {
  const date = createdAt.toISOString();
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${FACTURX_XML_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>BASIC WL</fx:ConformanceLevel>
      <fx:CreationDate>${date}</fx:CreationDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
}

function getFacturXLines(document: BusinessDocument) {
  return flattenDocumentNodes(document.nodes)
    .map((row) => row.node)
    .filter((node): node is DocumentItemNode => node.type === "line" || node.type === "composite");
}

function getLineIssues(lines: DocumentItemNode[]) {
  const issues: string[] = [];
  lines.forEach((line, index) => {
    const prefix = `ligne ${index + 1}`;
    if (!cleanText(line.title)) issues.push(`${prefix} sans désignation`);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) issues.push(`${prefix} quantité invalide`);
    if (!Number.isFinite(line.unitPriceHt) || line.unitPriceHt < 0) issues.push(`${prefix} prix HT invalide`);
    if (!Number.isFinite(line.vatRate) || line.vatRate < 0) issues.push(`${prefix} TVA invalide`);
  });
  return issues;
}

function buyerReferenceXml(document: BusinessDocument) {
  const reference = [document.projectId, document.chantierId, document.quoteId].map(cleanText).filter(Boolean).join(" / ");
  return reference ? `      <ram:BuyerReference>${xml(reference)}</ram:BuyerReference>` : "";
}

function tradeContactXml(party: DocumentParty) {
  const contactName = cleanText(party.contactName);
  const email = cleanText(party.email);
  const phone = cleanText(party.phone);
  if (!contactName && !email && !phone) return "";
  return `        <ram:DefinedTradeContact>
${contactName ? `          <ram:PersonName>${xml(contactName)}</ram:PersonName>` : ""}
${phone ? `          <ram:TelephoneUniversalCommunication>\n            <ram:CompleteNumber>${xml(phone)}</ram:CompleteNumber>\n          </ram:TelephoneUniversalCommunication>` : ""}
${email ? `          <ram:EmailURIUniversalCommunication>\n            <ram:URIID>${xml(email)}</ram:URIID>\n          </ram:EmailURIUniversalCommunication>` : ""}
        </ram:DefinedTradeContact>`;
}

function deliveryPartyXml(document: BusinessDocument) {
  const address = cleanText(document.siteAddress);
  if (!address) return "";
  return `      <ram:ShipToTradeParty>
        <ram:Name>${xml(document.title || document.recipient.displayName || "Chantier")}</ram:Name>
${postalAddressXml(address)}
      </ram:ShipToTradeParty>`;
}

function paymentMeansXml(paymentMethods: PaymentMethod[]) {
  const paymentMethod = paymentMethods[0];
  if (!paymentMethod) return "";
  const meta = PAYMENT_MEANS_BY_METHOD[paymentMethod];
  return `      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${meta.typeCode}</ram:TypeCode>
        <ram:Information>${xml(meta.label)}</ram:Information>
      </ram:SpecifiedTradeSettlementPaymentMeans>`;
}

const PAYMENT_MEANS_BY_METHOD: Record<PaymentMethod, { typeCode: string; label: string }> = {
  transfer: { typeCode: "58", label: "Virement" },
  card: { typeCode: "48", label: "Carte bancaire" },
  cash: { typeCode: "10", label: "Espèces" },
  cheque: { typeCode: "20", label: "Chèque" },
  direct_debit: { typeCode: "49", label: "Prélèvement" },
};

function taxRegistrationXml(vatNumber?: string | null) {
  const value = cleanText(vatNumber);
  if (!value) return "";
  return `        <ram:SpecifiedTaxRegistration>\n          <ram:ID schemeID="VA">${xml(value)}</ram:ID>\n        </ram:SpecifiedTaxRegistration>`;
}

function partyIdentifierXml(identifier?: string | null) {
  if (!identifier) return "";
  return `        <ram:SpecifiedLegalOrganization>\n          <ram:ID>${xml(identifier)}</ram:ID>\n        </ram:SpecifiedLegalOrganization>`;
}

function postalAddressXml(address?: string | null) {
  const cleanAddress = address?.trim();
  if (!cleanAddress) return "";
  return `        <ram:PostalTradeAddress>\n          <ram:LineOne>${xml(cleanAddress)}</ram:LineOne>\n          <ram:CountryID>FR</ram:CountryID>\n        </ram:PostalTradeAddress>`;
}

function vatCategoryCode(rate: number) {
  return rate > 0 ? "S" : "Z";
}

function requiredField(condition: boolean, label: string) {
  return condition ? [label] : [];
}

function cleanText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function isValidDocumentDate(value?: string | null) {
  if (!value) return false;
  const [dateOnly] = value.split("T");
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && !Number.isNaN(new Date(dateOnly).getTime());
}

function formatXmlDate(value: string) {
  const [dateOnly] = value.split("T");
  const normalized = dateOnly.replace(/-/g, "");
  return /^\d{8}$/.test(normalized) ? normalized : formatTodayXmlDate();
}

function formatTodayXmlDate() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function formatPdfDate(value: Date) {
  return `D:${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}${String(value.getUTCHours()).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")}${String(value.getUTCSeconds()).padStart(2, "0")}Z`;
}

function unitCode(unit: DocumentUnit) {
  const unitCodes: Record<DocumentUnit, string> = {
    u: "C62",
    h: "HUR",
    ml: "MTR",
    m2: "MTK",
    m3: "MTQ",
    forfait: "C62",
    kg: "KGM",
    l: "LTR",
  };
  return unitCodes[unit];
}

function money(value: number) {
  return roundMoney(value).toFixed(2);
}

function quantity(value: number) {
  return Number.isFinite(value) ? String(roundMoney(value)) : "0";
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "facture";
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function asciiByteLength(value: string) {
  return value.length;
}

function pdfString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pdfUtf16String(value: string) {
  const bytes = [0xfe, 0xff];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return `<${bytes.map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join("")}>`;
}

function xml(value?: string | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (character) => `&#${character.charCodeAt(0)};`);
}
