import jsPDF from "jspdf";

import type { CompanyBrandingPdf } from "./companySettings.service";
import type {
  ChantierReportChangeOrderItem,
  ChantierReportDataset,
  ChantierReportKind,
  ChantierReportPurchaseItem,
  ChantierReportReserveItem,
  ChantierReportTaskItem,
  ChantierReportTimeItem,
} from "./chantierReports.service";

const PAGE = {
  left: 14,
  right: 14,
  top: 18,
  bottom: 18,
};

function toCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function toHours(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1).replace(".", ",")} h`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return value.includes("T") ? parsed.toLocaleString("fr-FR") : parsed.toLocaleDateString("fr-FR");
}

function cleanText(value: string | null | undefined, fallback = "-"): string {
  return String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
}

function clampText(value: string, maxLength = 120): string {
  const text = cleanText(value, "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function hexToRgb(value: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  const match = String(value ?? "").trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return fallback;
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function imageFormatFromDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  const raw = String(dataUrl ?? "").toLowerCase();
  if (raw.startsWith("data:image/png")) return "PNG";
  if (raw.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - PAGE.bottom) return y;
  pdf.addPage();
  return PAGE.top;
}

function drawHeaderFooter(pdf: jsPDF, company: CompanyBrandingPdf, label: string) {
  const totalPages = pdf.getNumberOfPages();
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const primary = hexToRgb(company.primaryColor, [37, 99, 235]);

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(PAGE.left, 12, width - PAGE.right, 12);
    pdf.line(PAGE.left, height - 10, width - PAGE.right, height - 10);

    if (company.logoDataUrl) {
      try {
        pdf.addImage(company.logoDataUrl, imageFormatFromDataUrl(company.logoDataUrl), PAGE.left, 4.2, 10, 6.6);
      } catch {
        // Keep export resilient if logo embedding fails.
      }
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...primary);
    pdf.text(cleanText(company.companyName, "Batipro"), company.logoDataUrl ? PAGE.left + 13 : PAGE.left, 8.5);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, width - PAGE.right, 8.5, { align: "right" });
    pdf.text(cleanText(company.email ?? company.phone ?? company.siret ?? "Batipro"), PAGE.left, height - 5);
    pdf.text(`Page ${page}/${totalPages}`, width - PAGE.right, height - 5, { align: "right" });
  }
}

function drawSectionTitle(pdf: jsPDF, y: number, title: string): number {
  const width = pdf.internal.pageSize.getWidth();
  const posY = ensureSpace(pdf, y, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title, PAGE.left, posY);
  pdf.setDrawColor(219, 234, 254);
  pdf.line(PAGE.left, posY + 2, width - PAGE.right, posY + 2);
  return posY + 9;
}

function drawKeyValueGrid(pdf: jsPDF, y: number, rows: Array<[string, string]>): number {
  const width = pdf.internal.pageSize.getWidth();
  const cardWidth = (width - PAGE.left - PAGE.right - 8) / 2;
  let posY = y;

  rows.forEach((row, index) => {
    const column = index % 2;
    if (column === 0) posY = ensureSpace(pdf, posY, 18);
    const x = PAGE.left + column * (cardWidth + 8);
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(x, posY - 5, cardWidth, 14, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(clampText(row[0], 30).toUpperCase(), x + 4, posY);
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(clampText(row[1], 30), x + 4, posY + 5);
    if (column === 1 || index === rows.length - 1) posY += 18;
  });

  return posY + 2;
}

function drawBullets(pdf: jsPDF, y: number, title: string, lines: string[], emptyText: string): number {
  let posY = drawSectionTitle(pdf, y, title);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = pageWidth - PAGE.left - PAGE.right - 4;
  const rows = lines.length > 0 ? lines : [emptyText];

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(30, 41, 59);

  for (const row of rows) {
    const wrapped = pdf.splitTextToSize(`- ${row}`, maxWidth);
    posY = ensureSpace(pdf, posY, wrapped.length * 4.8 + 2);
    pdf.text(wrapped, PAGE.left + 2, posY);
    posY += wrapped.length * 4.8 + 1.6;
  }

  return posY + 2;
}

function formatTask(task: ChantierReportTaskItem, internal: boolean): string {
  const period = task.date_debut || task.date_fin
    ? `${formatDate(task.date_debut)} -> ${formatDate(task.date_fin)}`
    : "planning non date";
  const status = task.quality_status === "a_reprendre" ? "a reprendre" : task.status;
  const timePart = internal ? ` | prevu ${toHours(task.temps_prevu_h)} | reel ${toHours(task.temps_reel_h)}` : "";
  return `${task.lot} | ${task.titre} | ${status} | ${period}${timePart}`;
}

function formatReserve(reserve: ChantierReportReserveItem): string {
  return `${reserve.title} | ${reserve.status} | ${reserve.priority} | ${cleanText(reserve.zone_nom, "sans zone")} | ${cleanText(reserve.intervenant_nom, "non assigne")} | ${formatDate(reserve.created_at)}`;
}

function formatTimeEntry(entry: ChantierReportTimeItem): string {
  return `${formatDate(entry.work_date)} | ${entry.intervenant_nom} | ${entry.task_titre} | ${toHours(entry.duration_hours)}${entry.note ? ` | ${entry.note}` : ""}`;
}

function formatPurchase(purchase: ChantierReportPurchaseItem, internal: boolean): string {
  const costPart = internal
    ? ` | prevu ${toCurrency(purchase.cout_prevu_ht)} | reel ${toCurrency(purchase.cout_reel_ht)}`
    : "";
  return `${purchase.titre} | ${purchase.statut_commande} | ${cleanText(purchase.supplier_name, "fournisseur non renseigne")} | ${cleanText(purchase.task_titre, "sans tache")}${costPart}`;
}

function formatChangeOrder(changeOrder: ChantierReportChangeOrderItem, internal: boolean): string {
  const moneyPart = internal ? ` | impact ${toCurrency(changeOrder.impact_cout_ht)} / ${toHours(changeOrder.impact_temps_h)}` : "";
  return `${changeOrder.titre} | ${changeOrder.statut} | ${formatDate(changeOrder.created_at)}${moneyPart}`;
}

export async function generateChantierReportPdfBlob(input: {
  dataset: ChantierReportDataset;
  kind: ChantierReportKind;
  company: CompanyBrandingPdf;
}): Promise<Blob> {
  const { dataset, kind, company } = input;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();
  const primary = hexToRgb(company.primaryColor, [37, 99, 235]);
  const internal = kind === "interne";

  pdf.setFillColor(...primary);
  pdf.rect(0, 0, width, 38, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  pdf.text(internal ? "Rapport chantier interne" : "Rapport chantier client", PAGE.left, 20);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(cleanText(dataset.chantier.nom, "Chantier"), PAGE.left, 28);
  pdf.text(
    `Periode du ${formatDate(dataset.periodStart)} au ${formatDate(dataset.periodEnd)} | genere le ${formatDate(dataset.generatedAt)}`,
    PAGE.left,
    34,
  );

  let y = 50;
  y = drawKeyValueGrid(pdf, y, [
    ["Avancement", `${dataset.summary.avancement_pct}%`],
    ["Preparation", dataset.preparation.statut === "chantier_pret" ? "Chantier pret" : "Chantier incomplet"],
    ["Taches terminees", `${dataset.summary.taches_terminees}/${dataset.summary.taches_total}`],
    ["A reprendre", String(dataset.summary.taches_a_reprendre)],
    ["Heures periode", toHours(dataset.summary.heures_periode_h)],
    ["Reserves ouvertes", `${dataset.summary.reserves_ouvertes} dont ${dataset.summary.reserves_urgentes} urgentes`],
    ["Achats non livres", String(dataset.summary.achats_non_livres)],
    [
      internal ? "Marge reelle" : "Avenants valides",
      internal
        ? `${dataset.summary.marge_reelle_pct.toFixed(1).replace(".", ",")}%`
        : toCurrency(dataset.summary.avenants_valides_ht),
    ],
  ]);

  y = drawBullets(
    pdf,
    y,
    "Taches de la periode",
    dataset.tasks.slice(0, 40).map((task) => formatTask(task, internal)),
    "Aucune tache datee sur la periode.",
  );
  y = drawBullets(
    pdf,
    y,
    "Reserves",
    dataset.reserves.slice(0, 40).map(formatReserve),
    "Aucune reserve significative sur la periode.",
  );
  y = drawBullets(
    pdf,
    y,
    "Approvisionnements",
    dataset.purchases.slice(0, 40).map((purchase) => formatPurchase(purchase, internal)),
    "Aucun approvisionnement significatif sur la periode.",
  );

  if (internal) {
    y = drawBullets(
      pdf,
      y,
      "Temps terrain",
      dataset.timeEntries.slice(0, 60).map(formatTimeEntry),
      "Aucun temps saisi sur la periode.",
    );
    y = drawBullets(
      pdf,
      y,
      "Imprevus / travaux supplementaires",
      dataset.changeOrders.slice(0, 40).map((changeOrder) => formatChangeOrder(changeOrder, true)),
      "Aucun avenant ou ecart sur la periode.",
    );
    drawKeyValueGrid(pdf, ensureSpace(pdf, y, 60), [
      ["CA prevu", toCurrency(dataset.budget.chiffreAffairesPrevuHt)],
      ["Cout prevu", toCurrency(dataset.budget.coutPrevuHt)],
      ["Cout reel", toCurrency(dataset.budget.coutReelHt)],
      ["Marge reelle", toCurrency(dataset.budget.margeReelleHt)],
      ["Depassement budget", toCurrency(dataset.summary.budget_depassement_ht)],
      ["Objectif marge", `${dataset.budget.settings.objectif_marge_pct.toFixed(1).replace(".", ",")}%`],
    ]);
  } else {
    drawBullets(
      pdf,
      y,
      "Avenants valides",
      dataset.changeOrders
        .filter(
          (changeOrder) =>
            changeOrder.type_ecart === "travaux_supplementaires" &&
            ["valide_client", "en_cours", "termine", "facture"].includes(changeOrder.statut),
        )
        .slice(0, 30)
        .map((changeOrder) => formatChangeOrder(changeOrder, false)),
      "Aucun avenant valide sur la periode.",
    );
  }

  drawHeaderFooter(pdf, company, internal ? "Rapport chantier interne" : "Rapport chantier client");
  return pdf.output("blob");
}
