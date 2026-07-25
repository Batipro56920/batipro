import { calculateDocumentTotals, flattenDocumentNodes, type BusinessDocument, type DocumentItemNode, type DocumentUnit } from "../../document-engine";
import { getInvoiceElectronicInvoicingReadiness, normalizeInvoiceElectronicInvoicing } from "./electronicInvoicing";

const FACTURX_XML_FILENAME_SUFFIX = "factur-x.xml";

type FacturXExportResult = {
  filename: string;
  xml: string;
};

export function buildFacturXXmlExport(document: BusinessDocument): FacturXExportResult {
  const metadata = normalizeInvoiceElectronicInvoicing(document.electronicInvoicing, document);
  const readiness = getInvoiceElectronicInvoicingReadiness(metadata);

  if (!readiness.canMarkReady) {
    throw new Error(`Export Factur-X impossible : ${readiness.missingFields.join(", ")}.`);
  }

  const totals = document.totals ?? calculateDocumentTotals(document);
  const lines = flattenDocumentNodes(document.nodes)
    .map((row) => row.node)
    .filter((node): node is DocumentItemNode => node.type === "line" || node.type === "composite");
  const filename = `${sanitizeFilename(document.number)}-${FACTURX_XML_FILENAME_SUFFIX}`;

  return {
    filename,
    xml: buildCrossIndustryInvoiceXml(document, metadata, totals, lines),
  };
}

export function downloadFacturXXml(document: BusinessDocument) {
  const exportResult = buildFacturXXmlExport(document);
  const blob = new Blob([exportResult.xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = exportResult.filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lineXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xml(document.company.displayName)}</ram:Name>
${partyIdentifierXml(metadata.sellerSiret ?? metadata.sellerSiren)}
${postalAddressXml(document.company.address)}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xml(document.recipient.displayName)}</ram:Name>
${partyIdentifierXml(metadata.buyerSiret ?? metadata.buyerSiren)}
${postalAddressXml(document.recipient.address)}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatXmlDate(document.issueDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${document.currency}</ram:InvoiceCurrencyCode>
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
  const lineTotal = roundMoney(line.quantity * line.unitPriceHt);
  return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${position}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${xml(line.title)}</ram:Name>
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
          <ram:CategoryCode>S</ram:CategoryCode>
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
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${quantity(breakdown.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;
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

function formatXmlDate(value: string) {
  const [dateOnly] = value.split("T");
  const normalized = dateOnly.replace(/-/g, "");
  return /^\d{8}$/.test(normalized) ? normalized : formatTodayXmlDate();
}

function formatTodayXmlDate() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
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

function xml(value?: string | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
