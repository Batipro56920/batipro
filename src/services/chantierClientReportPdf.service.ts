import jsPDF from "jspdf";
import type { CompanyBrandingPdf } from "./companySettings.service";

type ClientReserveItem = {
  reserve_id: string;
  number?: number;
  titre: string;
  description?: string | null;
  statut: string;
};

type ClientReservePlanGroup = {
  plan_document_id: string;
  plan_title: string;
  plan_data_url?: string | null;
  items: ClientReserveItem[];
};

type ClientLotProgress = {
  lot: string;
  percent: number;
};

export type VisiteClientReportPdfInput = {
  chantierName: string;
  chantierAddress?: string | null;
  clientName?: string | null;
  reportDate: string;
  chantierReference?: string | null;
  company: CompanyBrandingPdf;
  avancementPercent: number;
  planningStatus: "Conforme" | "Retard" | "Avance" | string;
  doneSinceLastVisit: string[];
  upcomingSteps: string[];
  lots: ClientLotProgress[];
  reservePlanGroups?: ClientReservePlanGroup[];
  pointsToFollow?: ClientReserveItem[];
  photos?: File[];
};

const PAGE = {
  left: 14,
  right: 14,
  top: 20,
  bottom: 14,
};

function clean(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function textOrDash(value: string | null | undefined): string {
  const normalized = clean(value);
  return normalized || "-";
}

function truncate(value: string, max = 120): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "-";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}...`;
}

function formatDateFr(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  const normalized = String(hex ?? "")
    .trim()
    .match(/^#([0-9a-fA-F]{6})$/);
  if (!normalized) return fallback;
  const raw = normalized[1];
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function imageFormatFromDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  const raw = String(dataUrl ?? "").toLowerCase();
  if (raw.startsWith("data:image/png")) return "PNG";
  if (raw.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function resolveCompany(company: CompanyBrandingPdf) {
  return {
    name: clean(company.companyName) || "Batipro",
    logoDataUrl: company.logoDataUrl ?? null,
    phone: clean(company.phone),
    email: clean(company.email),
    siret: clean(company.siret),
    address: clean(company.address),
    insurance: clean(company.insuranceDecennale),
    primary: hexToRgb(company.primaryColor, [37, 99, 235]),
    secondary: hexToRgb(company.secondaryColor, [15, 23, 42]),
  };
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - PAGE.bottom) return y;
  pdf.addPage();
  return PAGE.top;
}

function sectionTitle(pdf: jsPDF, y: number, title: string): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const nextY = ensureSpace(pdf, y, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title, PAGE.left, nextY);
  pdf.setDrawColor(219, 234, 254);
  pdf.line(PAGE.left, nextY + 2, pageWidth - PAGE.right, nextY + 2);
  return nextY + 7;
}

function drawFooter(pdf: jsPDF, company: ReturnType<typeof resolveCompany>) {
  const totalPages = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerLine = [company.name, company.phone, company.email].filter(Boolean).join(" | ") || company.name;

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(PAGE.left, pageHeight - 10, pageWidth - PAGE.right, pageHeight - 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(truncate(footerLine, 100), PAGE.left, pageHeight - 5.5);
    pdf.text(`Page ${page} / ${totalPages}`, pageWidth - PAGE.right, pageHeight - 5.5, { align: "right" });
  }
}

function drawCoverPage(pdf: jsPDF, input: VisiteClientReportPdfInput, company: ReturnType<typeof resolveCompany>) {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(...company.primary);
  pdf.rect(0, 0, pageWidth, 58, "F");

  if (company.logoDataUrl) {
    try {
      pdf.addImage(
        company.logoDataUrl,
        imageFormatFromDataUrl(company.logoDataUrl),
        PAGE.left,
        10,
        34,
        18,
        undefined,
        "FAST",
      );
    } catch {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(company.name, PAGE.left, 22);
    }
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(company.name, PAGE.left, 22);
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("RAPPORT D'AVANCEMENT", pageWidth - PAGE.right, 24, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(company.name, pageWidth - PAGE.right, 32, { align: "right" });

  const cardY = 74;
  const cardW = pageWidth - PAGE.left - PAGE.right;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(PAGE.left, cardY, cardW, 88, 2, 2, "FD");

  const lines: Array<[string, string]> = [
    ["Chantier", textOrDash(input.chantierName)],
    ["Adresse", textOrDash(input.chantierAddress)],
    ["Client", textOrDash(input.clientName)],
    ["Date du rapport", formatDateFr(input.reportDate)],
    ["Reference chantier", textOrDash(input.chantierReference)],
  ];

  let y = cardY + 14;
  lines.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${label}:`, PAGE.left + 5, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 23, 42);
    pdf.text(truncate(value, 88), PAGE.left + 40, y);
    y += 14;
  });

  const meta = [company.address, company.phone, company.email, company.siret ? `SIRET ${company.siret}` : ""]
    .filter(Boolean)
    .join(" | ");
  if (meta) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    const metaLines = pdf.splitTextToSize(meta, cardW - 10);
    pdf.text(metaLines, PAGE.left + 5, 182);
  }
}

function statusTone(status: string): [number, number, number] {
  const normalized = clean(status).toUpperCase();
  if (normalized === "RETARD") return [185, 28, 28];
  if (normalized === "AVANCE") return [30, 64, 175];
  return [21, 128, 61];
}

function lotComment(percent: number): string {
  if (percent <= 0) return "Non demarre";
  if (percent >= 100) return "Termine";
  return "En cours";
}

function normalizeReserveStatus(status: string): string {
  const normalized = clean(status)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized === "LEVEE" || normalized === "TRAITE" || normalized === "FAIT" || normalized === "TERMINE") {
    return "Traite";
  }
  if (normalized === "EN_COURS" || normalized === "IN_PROGRESS") {
    return "En cours";
  }
  return "Planifie";
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Lecture image impossible."));
    };
    reader.onerror = () => reject(new Error("Lecture image impossible."));
    reader.readAsDataURL(file);
  });
}

function drawSyntheseCard(
  pdf: jsPDF,
  y: number,
  input: VisiteClientReportPdfInput,
  company: ReturnType<typeof resolveCompany>,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const cardW = pageWidth - PAGE.left - PAGE.right;

  let posY = ensureSpace(pdf, y, 38);
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(PAGE.left, posY, cardW, 34, 2, 2, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text("Avancement global", PAGE.left + 4, posY + 8);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...company.primary);
  const pct = Math.max(0, Math.min(100, Math.round(input.avancementPercent)));
  pdf.text(`${pct}%`, pageWidth - PAGE.right - 4, posY + 9, { align: "right" });

  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(PAGE.left + 4, posY + 12, cardW - 8, 5, 1.4, 1.4, "F");
  pdf.setFillColor(...company.primary);
  pdf.roundedRect(PAGE.left + 4, posY + 12, ((cardW - 8) * pct) / 100, 5, 1.4, 1.4, "F");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text("Statut planning", PAGE.left + 4, posY + 25);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...statusTone(input.planningStatus));
  pdf.text(textOrDash(input.planningStatus), PAGE.left + 36, posY + 25);

  return posY + 40;
}

function drawSimpleList(pdf: jsPDF, y: number, title: string, rows: string[]): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = pageWidth - PAGE.left - PAGE.right - 4;
  let posY = sectionTitle(pdf, y, title);

  const safeRows = rows.length ? rows : ["Aucun element a signaler."];
  safeRows.forEach((row) => {
    const lines = pdf.splitTextToSize(`- ${row}`, maxWidth);
    posY = ensureSpace(pdf, posY, lines.length * 4.6 + 2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(lines, PAGE.left + 2, posY);
    posY += lines.length * 4.6 + 1.5;
  });

  return posY + 2;
}

function drawLots(pdf: jsPDF, y: number, lots: ClientLotProgress[], company: ReturnType<typeof resolveCompany>): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const barWidth = pageWidth - PAGE.left - PAGE.right;
  let posY = sectionTitle(pdf, y, "Avancement par lot");

  const sortedLots = lots.length
    ? [...lots].sort((a, b) => a.lot.localeCompare(b.lot, "fr"))
    : [{ lot: "General", percent: 0 }];

  sortedLots.forEach((lot) => {
    const pct = Math.max(0, Math.min(100, Math.round(lot.percent)));
    posY = ensureSpace(pdf, posY, 16);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(truncate(lot.lot || "Lot", 54), PAGE.left, posY);
    pdf.setTextColor(...company.primary);
    pdf.text(`${pct}%`, pageWidth - PAGE.right, posY, { align: "right" });

    pdf.setFillColor(241, 245, 249);
    pdf.roundedRect(PAGE.left, posY + 2, barWidth, 4.5, 1.4, 1.4, "F");
    pdf.setFillColor(...company.primary);
    pdf.roundedRect(PAGE.left, posY + 2, (barWidth * pct) / 100, 4.5, 1.4, 1.4, "F");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(lotComment(pct), PAGE.left, posY + 11);
    posY += 14;
  });

  return posY + 2;
}

function drawPlanMarker(pdf: jsPDF, x: number, y: number, number: number, primary: [number, number, number]) {
  pdf.setFillColor(...primary);
  pdf.circle(x, y, 3.2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(String(number > 0 ? number : 1), x, y + 1, { align: "center" });
}

function drawReserves(
  pdf: jsPDF,
  y: number,
  input: VisiteClientReportPdfInput,
  company: ReturnType<typeof resolveCompany>,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const groups = input.reservePlanGroups ?? [];
  const pointsToFollow = input.pointsToFollow ?? [];

  let posY = sectionTitle(pdf, y, "Reserves");

  if (!groups.length && !pointsToFollow.length) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text("Aucune reserve en cours.", PAGE.left, posY);
    return posY + 8;
  }

  groups.forEach((group) => {
    posY = ensureSpace(pdf, posY, 92);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(truncate(`Plan: ${group.plan_title}`, 82), PAGE.left, posY);
    posY += 3;

    const frameX = PAGE.left;
    const frameY = posY;
    const frameW = pageWidth - PAGE.left - PAGE.right;
    const frameH = 66;

    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(frameX, frameY, frameW, frameH, 1.8, 1.8, "FD");

    if (group.plan_data_url) {
      try {
        const props = pdf.getImageProperties(group.plan_data_url);
        const maxW = frameW - 4;
        const maxH = frameH - 4;
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        const drawW = props.width * ratio;
        const drawH = props.height * ratio;
        const drawX = frameX + (frameW - drawW) / 2;
        const drawY = frameY + (frameH - drawH) / 2;
        pdf.addImage(
          group.plan_data_url,
          imageFormatFromDataUrl(group.plan_data_url),
          drawX,
          drawY,
          drawW,
          drawH,
          undefined,
          "FAST",
        );
        group.items.forEach((item, index) => {
          const asAny = item as any;
          const xPct = Number(asAny.marker_x_pct);
          const yPct = Number(asAny.marker_y_pct);
          if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) return;
          const markerX = drawX + (xPct / 100) * drawW;
          const markerY = drawY + (yPct / 100) * drawH;
          drawPlanMarker(pdf, markerX, markerY, item.number ?? index + 1, company.primary);
        });
      } catch {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text("Apercu plan indisponible.", frameX + 3, frameY + 8);
      }
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text("Apercu plan indisponible.", frameX + 3, frameY + 8);
    }

    posY = frameY + frameH + 5;

    group.items.forEach((item, index) => {
      const status = normalizeReserveStatus(item.statut);
      const line = `${item.number ?? index + 1}. ${item.titre} - ${truncate(item.description ?? "-", 90)} (${status})`;
      const lines = pdf.splitTextToSize(line, pageWidth - PAGE.left - PAGE.right);
      posY = ensureSpace(pdf, posY, lines.length * 4.6 + 1.5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.7);
      pdf.setTextColor(15, 23, 42);
      pdf.text(lines, PAGE.left, posY);
      posY += lines.length * 4.6 + 1.2;
    });

    posY += 2;
  });

  if (pointsToFollow.length) {
    posY = sectionTitle(pdf, posY, "Points a suivre");
    pointsToFollow.forEach((item, index) => {
      const status = normalizeReserveStatus(item.statut);
      const line = `${index + 1}. ${item.titre} - ${truncate(item.description ?? "-", 90)} (${status})`;
      const lines = pdf.splitTextToSize(line, pageWidth - PAGE.left - PAGE.right);
      posY = ensureSpace(pdf, posY, lines.length * 4.6 + 1.5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.7);
      pdf.setTextColor(15, 23, 42);
      pdf.text(lines, PAGE.left, posY);
      posY += lines.length * 4.6 + 1.2;
    });
  }

  return posY + 2;
}

async function drawPhotos(pdf: jsPDF, y: number, photos: File[]) {
  const maxPhotos = photos.slice(0, 6);
  if (!maxPhotos.length) {
    const posY = sectionTitle(pdf, y, "Photos d'avancement");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text("Aucune photo ajoutee pour cette visite.", PAGE.left, posY);
    return posY + 8;
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const gap = 4;
  const cellW = (pageWidth - PAGE.left - PAGE.right - gap) / 2;
  const cellH = 54;
  let posY = sectionTitle(pdf, y, "Photos d'avancement");
  let index = 0;

  while (index < maxPhotos.length) {
    posY = ensureSpace(pdf, posY, cellH + 2);
    for (let col = 0; col < 2 && index < maxPhotos.length; col += 1) {
      const x = PAGE.left + col * (cellW + gap);
      const yBox = posY;
      const photo = maxPhotos[index];
      const dataUrl = await fileToDataUrl(photo);
      const props = pdf.getImageProperties(dataUrl);
      const maxW = cellW - 2;
      const maxH = cellH - 8;
      const ratio = Math.min(maxW / props.width, maxH / props.height);
      const drawW = props.width * ratio;
      const drawH = props.height * ratio;
      const drawX = x + (cellW - drawW) / 2;
      const drawY = yBox + 2 + (maxH - drawH) / 2;

      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(x, yBox, cellW, cellH, 1.8, 1.8, "FD");
      pdf.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), drawX, drawY, drawW, drawH, undefined, "FAST");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.3);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Photo ${index + 1}`, x + 2, yBox + cellH - 1.5);

      index += 1;
    }
    posY += cellH + 3;
  }

  return posY;
}

export async function generateVisiteClientReportPdfBlob(input: VisiteClientReportPdfInput): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const company = resolveCompany(input.company);

  drawCoverPage(pdf, input, company);
  pdf.addPage();

  let y = PAGE.top;
  y = sectionTitle(pdf, y, "Synthese du chantier");
  y = drawSyntheseCard(pdf, y, input, company);
  y = drawSimpleList(pdf, y, "Travaux realises depuis la derniere visite", input.doneSinceLastVisit);
  y = drawSimpleList(pdf, y, "Prochaines etapes (2-3 semaines)", input.upcomingSteps);
  y = drawLots(pdf, y, input.lots, company);
  y = drawReserves(pdf, y, input, company);
  y = await drawPhotos(pdf, y, input.photos ?? []);

  void y;
  drawFooter(pdf, company);
  return pdf.output("blob");
}
