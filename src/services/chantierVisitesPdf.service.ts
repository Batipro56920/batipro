import jsPDF from "jspdf";
import type {
  VisiteSnapshot,
  VisiteSnapshotLot,
  VisiteSnapshotReserveFocus,
  VisiteSnapshotTaskFocus,
} from "../lib/buildVisiteSnapshot";

type VisitePdfParticipant = {
  nom: string;
  type: string;
  present: boolean;
};

type VisitePdfAction = {
  description: string;
  responsable: string | null;
  echeance: string | null;
  statut: string;
  commentaire: string | null;
};

type CompanyBrandingInput = {
  companyName?: string | null;
  logoDataUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  siret?: string | null;
  insuranceDecennale?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

type VisiteCompteRenduPdfInput = {
  chantierName: string;
  chantierAddress?: string | null;
  clientName?: string | null;
  visiteNumero?: number | null;
  visiteTitle: string;
  visiteDate: string;
  phase?: string | null;
  objectif?: string | null;
  resume?: string | null;
  pointsPositifs?: string | null;
  pointsBloquants?: string | null;
  notesTerrain?: string | null;
  remarquesPlanning?: string | null;
  planningRemarques?: string | null;
  synthesePoints?: string[];
  participants: VisitePdfParticipant[];
  snapshot: VisiteSnapshot;
  lots: VisiteSnapshotLot[];
  tasksDone: VisiteSnapshotTaskFocus[];
  tasksTodo: VisiteSnapshotTaskFocus[];
  reserves: VisiteSnapshotReserveFocus[];
  actions: VisitePdfAction[];
  annexTitles: string[];
  photos?: File[];
  filterIntervenantName?: string | null;
  intervenantComment?: string | null;
  taskComments?: Record<string, { include: boolean; comment: string }>;
  reserveComments?: Record<string, { include: boolean; comment: string }>;
  planningRows?: Array<{
    id: string;
    label: string;
    date_debut: string | null;
    date_fin: string | null;
    retard: boolean;
    comment?: string;
  }>;
  documentsList?: Array<{
    id?: string;
    nom: string;
    type?: string | null;
    date?: string | null;
    accessible: boolean;
    fallback_message?: string | null;
  }>;
  reservePlanGroups?: Array<{
    plan_document_id: string;
    plan_title: string;
    plan_data_url?: string | null;
    plan_mime_type?: string | null;
    items: Array<{
      reserve_id: string;
      number: number;
      titre: string;
      description?: string | null;
      statut: string;
      priority?: string | null;
      marker_x_pct?: number | null;
      marker_y_pct?: number | null;
      photo_label?: string | null;
    }>;
  }>;
  reservesWithoutPlan?: Array<{
    reserve_id: string;
    titre: string;
    description?: string | null;
    statut: string;
    priority?: string | null;
    photo_label?: string | null;
  }>;
  company?: CompanyBrandingInput;
};

type CompanyBrandingResolved = {
  name: string;
  logoDataUrl: string | null;
  primary: [number, number, number];
  secondary: [number, number, number];
  headerLine: string;
  subHeaderLine: string;
  footerLine: string;
};

type Tone = {
  bg: [number, number, number];
  fg: [number, number, number];
};

type BadgeCell = {
  label: string;
  tone: Tone;
};

type TableCell = {
  text?: string;
  badge?: BadgeCell;
  align?: "left" | "center" | "right";
};

type TableColumn = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

type TableRow = Record<string, TableCell>;

const COLORS = {
  primary: [37, 99, 235] as [number, number, number],
  primarySoft: [219, 234, 254] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  zebra: [248, 250, 252] as [number, number, number],
};

const PAGE = {
  left: 12,
  right: 12,
  top: 24,
  bottom: 14,
};

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

function resolveCompanyBranding(input?: CompanyBrandingInput): CompanyBrandingResolved {
  const name = String(input?.companyName ?? "").trim() || "Batipro";
  const address = String(input?.address ?? "").trim();
  const phone = String(input?.phone ?? "").trim();
  const email = String(input?.email ?? "").trim();
  const siret = String(input?.siret ?? "").trim();
  const insurance = String(input?.insuranceDecennale ?? "").trim();

  const headerLine = cleanList([address, phone]).join(" • ");
  const subHeaderLine = cleanList([email, siret ? `SIRET ${siret}` : ""]).join(" • ");
  const footerLine = cleanList([
    name,
    phone,
    email,
    siret ? `SIRET ${siret}` : "",
    insurance ? `Decennale ${insurance}` : "",
  ]).join(" • ");

  return {
    name,
    logoDataUrl: input?.logoDataUrl ?? null,
    primary: hexToRgb(input?.primaryColor, COLORS.primary),
    secondary: hexToRgb(input?.secondaryColor, [15, 23, 42]),
    headerLine,
    subHeaderLine,
    footerLine: footerLine || "Batipro",
  };
}

export function formatDateFR(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

export function truncate(text: string, max = 120): string {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export function badgeStatus(status: string | null | undefined, scope: "task" | "reserve" | "action" | "priority"): BadgeCell {
  const raw = String(status ?? "").trim().toUpperCase();

  if (scope === "priority") {
    if (raw === "URGENT" || raw === "HAUTE" || raw === "HIGH") {
      return { label: "Urgent", tone: { bg: [254, 226, 226], fg: [185, 28, 28] } };
    }
    if (raw === "BASSE" || raw === "LOW") {
      return { label: "Basse", tone: { bg: [241, 245, 249], fg: [51, 65, 85] } };
    }
    return { label: "Normale", tone: { bg: [239, 246, 255], fg: [30, 64, 175] } };
  }

  if (raw === "FAIT" || raw === "TERMINE" || raw === "DONE" || raw === "LEVEE") {
    return { label: scope === "reserve" ? "Levee" : "Fait", tone: { bg: [220, 252, 231], fg: [21, 128, 61] } };
  }
  if (raw === "EN_COURS" || raw === "IN_PROGRESS") {
    return { label: "En cours", tone: { bg: [254, 249, 195], fg: [161, 98, 7] } };
  }
  if (raw === "BLOQUE" || raw === "BLOQUEE" || raw === "BLOCKED") {
    return { label: "Bloque", tone: { bg: [254, 226, 226], fg: [185, 28, 28] } };
  }
  if (raw === "RETARD" || raw === "EN_RETARD") {
    return { label: "Retard", tone: { bg: [254, 226, 226], fg: [185, 28, 28] } };
  }
  return { label: "A faire", tone: { bg: [239, 246, 255], fg: [30, 64, 175] } };
}

function textOrDash(value: string | null | undefined): string {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned || "—";
}

function cleanList(values: Array<string | null | undefined>): string[] {
  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - PAGE.bottom) return y;
  pdf.addPage();
  return PAGE.top;
}

function drawHeaderFooter(pdf: jsPDF, chantierName: string, company: CompanyBrandingResolved) {
  const total = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let page = 1; page <= total; page += 1) {
    pdf.setPage(page);

    pdf.setDrawColor(...COLORS.border);
    pdf.line(PAGE.left, 14, pageWidth - PAGE.right, 14);
    pdf.line(PAGE.left, pageHeight - 10, pageWidth - PAGE.right, pageHeight - 10);

    let leftHeaderX = PAGE.left;
    if (company.logoDataUrl) {
      try {
        pdf.addImage(company.logoDataUrl, imageFormatFromDataUrl(company.logoDataUrl), PAGE.left, 4.8, 10, 7, undefined, "FAST");
        leftHeaderX = PAGE.left + 12;
      } catch {
        leftHeaderX = PAGE.left;
      }
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...company.primary);
    pdf.text(truncate(company.name, 36), leftHeaderX, 8.2);

    if (company.headerLine) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.7);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(truncate(company.headerLine, 66), leftHeaderX, 11.5);
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(truncate(chantierName || "Chantier", 54), pageWidth - PAGE.right, 8.2, { align: "right" });

    if (company.subHeaderLine) {
      pdf.setFontSize(7.7);
      pdf.text(truncate(company.subHeaderLine, 72), pageWidth - PAGE.right, 11.5, { align: "right" });
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(truncate(company.footerLine, 90), PAGE.left, pageHeight - 5.5);
    pdf.text(`page ${page}/${total}`, pageWidth - PAGE.right, pageHeight - 5.5, { align: "right" });
  }
}

function drawCoverPage(pdf: jsPDF, input: VisiteCompteRenduPdfInput, company: CompanyBrandingResolved) {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(...company.primary);
  pdf.rect(0, 0, pageWidth, 54, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Compte-rendu de visite", PAGE.left, 24);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("Document de suivi chantier", PAGE.left, 33);

  if (company.logoDataUrl) {
    try {
      pdf.addImage(
        company.logoDataUrl,
        imageFormatFromDataUrl(company.logoDataUrl),
        pageWidth - PAGE.right - 30,
        8,
        30,
        16,
        undefined,
        "FAST",
      );
    } catch {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(company.name, pageWidth - PAGE.right, 11, { align: "right" });
    }
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(company.name, pageWidth - PAGE.right, 11, { align: "right" });
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  if (company.headerLine) pdf.text(company.headerLine, pageWidth - PAGE.right, 30, { align: "right" });
  if (company.subHeaderLine) pdf.text(company.subHeaderLine, pageWidth - PAGE.right, 35, { align: "right" });

  pdf.setTextColor(...COLORS.text);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(PAGE.left, 63, pageWidth - PAGE.left - PAGE.right, 66, 2, 2, "FD");
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(PAGE.left, 63, pageWidth - PAGE.left - PAGE.right, 66, 2, 2, "S");

  const lines = [
    ["Chantier", textOrDash(input.chantierName)],
    ["Adresse", textOrDash(input.chantierAddress ?? null)],
    ["Client", textOrDash(input.clientName ?? null)],
    ["Date visite", formatDateFR(input.visiteDate)],
    ["Visite", textOrDash(`${input.visiteNumero ? `#${input.visiteNumero}` : ""} ${input.visiteTitle || ""}`.trim())],
    ["Phase", textOrDash(input.phase ?? null)],
    ["Type d'export", input.filterIntervenantName ? `Intervenant: ${input.filterIntervenantName}` : "Global"],
  ] as Array<[string, string]>;

  let y = 74;
  for (const [label, value] of lines) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`${label}:`, PAGE.left + 4, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.text);
    pdf.text(value, PAGE.left + 34, y);
    y += 8;
  }

  const participants = cleanList(input.participants.map((p) => `${p.nom} (${p.type}${p.present ? "" : ", absent"})`));
  if (participants.length) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.muted);
    pdf.text("Participants:", PAGE.left, 142);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.text);
    const participantLines = pdf.splitTextToSize(participants.join(" • "), pageWidth - PAGE.left - PAGE.right);
    pdf.text(participantLines, PAGE.left, 149);
  }

  const generatedAt = new Date().toLocaleString("fr-FR");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(`Genere le ${generatedAt}`, PAGE.left, 282);
}

function sectionTitle(pdf: jsPDF, y: number, title: string): number {
  let posY = ensureSpace(pdf, y, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...COLORS.text);
  pdf.text(title, PAGE.left, posY);
  posY += 3;
  pdf.setDrawColor(...COLORS.primarySoft);
  pdf.line(PAGE.left, posY, pdf.internal.pageSize.getWidth() - PAGE.right, posY);
  return posY + 5;
}

function paragraph(pdf: jsPDF, y: number, label: string, value: string | null | undefined): number {
  const content = String(value ?? "").trim();
  if (!content) return y;

  let posY = ensureSpace(pdf, y, 10);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(label, PAGE.left, posY);

  const lines = pdf.splitTextToSize(content, pdf.internal.pageSize.getWidth() - PAGE.left - PAGE.right);
  posY = ensureSpace(pdf, posY + 4, lines.length * 4.6 + 2);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.text);
  pdf.text(lines, PAGE.left, posY);
  return posY + lines.length * 4.6 + 2;
}

function drawBadge(pdf: jsPDF, x: number, y: number, badge: BadgeCell) {
  const text = badge.label || "—";
  const width = Math.max(14, pdf.getTextWidth(text) + 4.2);
  pdf.setFillColor(...badge.tone.bg);
  pdf.roundedRect(x, y - 3.8, width, 5.2, 1.6, 1.6, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  pdf.setTextColor(...badge.tone.fg);
  pdf.text(text, x + width / 2, y - 0.2, { align: "center" });
}

export function progressBar(pdf: jsPDF, x: number, y: number, width: number, percent: number) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(x, y, width, 4.2, 1.4, 1.4, "F");
  pdf.setFillColor(...COLORS.primary);
  pdf.roundedRect(x, y, (width * pct) / 100, 4.2, 1.4, 1.4, "F");
}

function drawTable(pdf: jsPDF, y: number, columns: TableColumn[], rows: TableRow[]): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const tableWidth = columns.reduce((acc, col) => acc + col.width, 0);
  const startX = PAGE.left;

  const drawHeader = (headerY: number) => {
    pdf.setFillColor(...COLORS.primarySoft);
    pdf.rect(startX, headerY - 4.5, tableWidth, 6, "F");
    pdf.setDrawColor(...COLORS.border);
    pdf.rect(startX, headerY - 4.5, tableWidth, 6);

    let x = startX;
    columns.forEach((col) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.4);
      pdf.setTextColor(...COLORS.primary);
      const align = col.align ?? "left";
      if (align === "right") {
        pdf.text(col.label, x + col.width - 1.3, headerY - 0.2, { align: "right" });
      } else if (align === "center") {
        pdf.text(col.label, x + col.width / 2, headerY - 0.2, { align: "center" });
      } else {
        pdf.text(col.label, x + 1.2, headerY - 0.2);
      }
      x += col.width;
    });
  };

  let posY = ensureSpace(pdf, y, 12);
  drawHeader(posY);
  posY += 4.5;

  rows.forEach((row, rowIndex) => {
    let lineHeight = 5.5;

    columns.forEach((col) => {
      const cell = row[col.key] ?? { text: "—" };
      if (cell.badge) {
        lineHeight = Math.max(lineHeight, 6.2);
        return;
      }
      const text = textOrDash(cell.text ?? "—");
      const lines = pdf.splitTextToSize(text, Math.max(10, col.width - 2));
      lineHeight = Math.max(lineHeight, lines.length * 4 + 2);
    });

    posY = ensureSpace(pdf, posY, lineHeight + 1.2);
    if (posY === PAGE.top) {
      drawHeader(posY);
      posY += 4.5;
    }

    if (rowIndex % 2 === 1) {
      pdf.setFillColor(...COLORS.zebra);
      pdf.rect(startX, posY - 3.6, tableWidth, lineHeight, "F");
    }

    pdf.setDrawColor(...COLORS.border);
    pdf.rect(startX, posY - 3.6, tableWidth, lineHeight);

    let x = startX;
    columns.forEach((col) => {
      const cell = row[col.key] ?? { text: "—" };
      const align = cell.align ?? col.align ?? "left";

      if (cell.badge) {
        drawBadge(pdf, x + 1, posY + lineHeight / 2 - 0.6, cell.badge);
        x += col.width;
        return;
      }

      const text = textOrDash(cell.text ?? "—");
      const lines = pdf.splitTextToSize(text, Math.max(10, col.width - 2));
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.6);
      pdf.setTextColor(...COLORS.text);

      if (align === "right") {
        pdf.text(lines, x + col.width - 1.2, posY, { align: "right" });
      } else if (align === "center") {
        pdf.text(lines, x + col.width / 2, posY, { align: "center" });
      } else {
        pdf.text(lines, x + 1.2, posY);
      }
      x += col.width;
    });

    posY += lineHeight;

    if (posY > pdf.internal.pageSize.getHeight() - PAGE.bottom - 4) {
      pdf.addPage();
      posY = PAGE.top;
      drawHeader(posY);
      posY += 4.5;
    }
  });

  const _unused = pageWidth; // keep lint quiet if needed by future layout updates
  void _unused;
  return posY + 2;
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

function imageFormatFromDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  const raw = String(dataUrl ?? "").toLowerCase();
  if (raw.startsWith("data:image/png")) return "PNG";
  if (raw.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function imagePage(pdf: jsPDF, imgData: string, label: string) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const props = pdf.getImageProperties(imgData);
  const maxW = width - margin * 2;
  const maxH = height - margin * 2 - 8;
  const ratio = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * ratio;
  const h = props.height * ratio;
  const x = (width - w) / 2;
  const y = margin + 8;
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.text);
  pdf.text(label, margin, margin);
  pdf.addImage(imgData, imageFormatFromDataUrl(imgData), x, y, w, h, undefined, "FAST");
}

function lotMetrics(
  input: VisiteCompteRenduPdfInput,
): Array<{ lot: string; total: number; done: number; remaining: number; late: number; percent: number; comment: string }> {
  const doneByLot = new Map<string, number>();
  const todoByLot = new Map<string, number>();
  const lateByLot = new Map<string, number>();

  input.tasksDone.forEach((task) => {
    const lot = textOrDash(task.lot ?? "Divers");
    doneByLot.set(lot, (doneByLot.get(lot) ?? 0) + 1);
  });

  input.tasksTodo.forEach((task) => {
    const lot = textOrDash(task.lot ?? "Divers");
    todoByLot.set(lot, (todoByLot.get(lot) ?? 0) + 1);
    if (task.retard) lateByLot.set(lot, (lateByLot.get(lot) ?? 0) + 1);
  });

  const lots = input.lots.length
    ? input.lots
    : Array.from(new Set([...doneByLot.keys(), ...todoByLot.keys()])).map((lot) => ({
        lot,
        tasks_total: (doneByLot.get(lot) ?? 0) + (todoByLot.get(lot) ?? 0),
        tasks_faites: doneByLot.get(lot) ?? 0,
        tasks_retard: lateByLot.get(lot) ?? 0,
        comment: "",
      }));

  return lots.map((lot) => {
    const lotName = textOrDash(lot.lot || "Divers");
    const doneFallback = doneByLot.get(lotName) ?? 0;
    const todoFallback = todoByLot.get(lotName) ?? 0;
    const totalFallback = doneFallback + todoFallback;

    const total = Number(lot.tasks_total ?? 0) > 0 ? Number(lot.tasks_total) : totalFallback;
    const done =
      Number.isFinite(Number(lot.tasks_faites)) && Number(lot.tasks_faites) >= 0
        ? Number(lot.tasks_faites)
        : doneFallback;

    const remaining = Math.max(0, total - done);
    const late = Number(lot.tasks_retard ?? 0);
    const percent = total > 0 ? (done / total) * 100 : 0;

    return {
      lot: lotName,
      total,
      done,
      remaining,
      late,
      percent,
      comment: String(lot.comment ?? "").trim(),
    };
  });
}

function normalizePercentCoordinate(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 100) return value;
  if (value >= 0 && value <= 1) return value * 100;
  return null;
}

function markerNumberLabel(number: number): string {
  return String(number > 0 ? number : 1);
}

function drawReserveMarker(pdf: jsPDF, x: number, y: number, number: number) {
  const radius = 3.2;
  pdf.setFillColor(...COLORS.primary);
  pdf.circle(x, y, radius, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(markerNumberLabel(number), x, y + 1.05, { align: "center" });
}

function drawReservePlanGroups(
  pdf: jsPDF,
  y: number,
  input: VisiteCompteRenduPdfInput,
): number {
  const groups = input.reservePlanGroups ?? [];
  const withoutPlan = input.reservesWithoutPlan ?? [];

  if (!groups.length && !withoutPlan.length) {
    return paragraph(pdf, y, "", "Aucune réserve liée à un plan.");
  }

  let posY = y;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE.left - PAGE.right;

  groups.forEach((group) => {
    posY = sectionTitle(pdf, posY, `Plan: ${group.plan_title}`);
    posY = ensureSpace(pdf, posY, 72);

    const frameX = PAGE.left;
    const frameY = posY;
    const frameW = contentWidth;
    const frameH = 68;

    pdf.setDrawColor(...COLORS.border);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(frameX, frameY, frameW, frameH, 1.8, 1.8, "FD");

    if (group.plan_data_url) {
      try {
        const imgProps = pdf.getImageProperties(group.plan_data_url);
        const maxW = frameW - 4;
        const maxH = frameH - 4;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        const drawW = imgProps.width * ratio;
        const drawH = imgProps.height * ratio;
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

        group.items.forEach((item) => {
          const xPct = normalizePercentCoordinate(item.marker_x_pct ?? null);
          const yPct = normalizePercentCoordinate(item.marker_y_pct ?? null);
          if (xPct === null || yPct === null) return;
          const markerX = drawX + (xPct / 100) * drawW;
          const markerY = drawY + (yPct / 100) * drawH;
          drawReserveMarker(pdf, markerX, markerY, item.number);
        });
      } catch {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...COLORS.muted);
        pdf.text("Aperçu plan indisponible.", frameX + 3, frameY + 8);
      }
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.muted);
      const reason = String(group.plan_mime_type ?? "").toLowerCase().includes("pdf")
        ? "Plan PDF: aperçu image non embarqué."
        : "Aperçu plan indisponible.";
      pdf.text(reason, frameX + 3, frameY + 8);
    }

    posY = frameY + frameH + 4;

    const reserveColumns: TableColumn[] = [
      { key: "numero", label: "#", width: 10, align: "center" },
      { key: "titre", label: "Réserve", width: 82 },
      { key: "description", label: "Description", width: 54 },
      { key: "statut", label: "Statut", width: 22, align: "center" },
      { key: "photo", label: "Photo", width: 20, align: "center" },
    ];
    const reserveRows: TableRow[] = group.items.map((item) => ({
      numero: { text: markerNumberLabel(item.number), align: "center" },
      titre: { text: truncate(item.titre, 120) },
      description: { text: truncate(textOrDash(item.description), 120) },
      statut: { badge: badgeStatus(item.statut, "reserve") },
      photo: { text: item.photo_label ? "Oui" : "—", align: "center" },
    }));
    posY = drawTable(pdf, posY, reserveColumns, reserveRows);
  });

  if (withoutPlan.length) {
    posY = sectionTitle(pdf, posY, "Réserves sans plan");
    const withoutColumns: TableColumn[] = [
      { key: "titre", label: "Réserve", width: 76 },
      { key: "description", label: "Description", width: 66 },
      { key: "statut", label: "Statut", width: 22, align: "center" },
      { key: "photo", label: "Photo", width: 20, align: "center" },
    ];
    const withoutRows: TableRow[] = withoutPlan.map((item) => ({
      titre: { text: truncate(item.titre, 120) },
      description: { text: truncate(textOrDash(item.description), 120) },
      statut: { badge: badgeStatus(item.statut, "reserve") },
      photo: { text: item.photo_label ? "Oui" : "—", align: "center" },
    }));
    posY = drawTable(pdf, posY, withoutColumns, withoutRows);
  }

  return posY;
}

export async function generateVisiteCompteRenduPdfBlob(input: VisiteCompteRenduPdfInput): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const annexTaskRaw: Array<{ section: string; lot: string; titre: string }> = [];
  const company = resolveCompanyBranding(input.company);

  drawCoverPage(pdf, input, company);
  pdf.addPage();

  let y = PAGE.top;

  y = sectionTitle(pdf, y, "1. Indicateurs clés");
  const cardRows: Array<[string, string]> = [
    ["Avancement global", `${Math.max(0, Math.round(Number(input.snapshot.stats.avancement_pct ?? 0)))}%`],
    ["Tâches total", String(input.snapshot.stats.tasks_total ?? 0)],
    ["Tâches en cours", String(input.snapshot.stats.tasks_en_cours ?? 0)],
    ["Tâches en retard", String(input.snapshot.stats.tasks_retard ?? 0)],
    ["Réserves ouvertes", String(input.snapshot.stats.reserves_ouvertes ?? 0)],
    ["Documents", String(input.snapshot.stats.docs_total ?? 0)],
  ];

  const cardWidth = (pdf.internal.pageSize.getWidth() - PAGE.left - PAGE.right - 10) / 3;
  for (let i = 0; i < cardRows.length; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = PAGE.left + col * (cardWidth + 5);
    const blockY = y + row * 16;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, blockY, cardWidth, 13, 1.8, 1.8, "FD");
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(x, blockY, cardWidth, 13, 1.8, 1.8, "S");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(cardRows[i][0], x + 2, blockY + 4.5);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...COLORS.text);
    pdf.text(cardRows[i][1], x + 2, blockY + 10.2);
  }
  y += 36;

  const participantsText = cleanList(input.participants.map((p) => `${p.nom} (${p.type}${p.present ? "" : ", absent"})`)).join(" • ");
  if (participantsText) {
    y = sectionTitle(pdf, y, "2. Participants");
    const participantLines = pdf.splitTextToSize(participantsText, pdf.internal.pageSize.getWidth() - PAGE.left - PAGE.right);
    y = ensureSpace(pdf, y, participantLines.length * 4.6 + 4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.text);
    pdf.text(participantLines, PAGE.left, y);
    y += participantLines.length * 4.6 + 3;
  }

  const lots = lotMetrics(input);
  if (lots.length) {
    y = sectionTitle(pdf, y, "3. Avancement par lot");
    lots.forEach((lot) => {
      y = ensureSpace(pdf, y, 14);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.8);
      pdf.setTextColor(...COLORS.text);
      pdf.text(lot.lot, PAGE.left, y);

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLORS.primary);
      pdf.text(`${Math.round(lot.percent)}%`, pdf.internal.pageSize.getWidth() - PAGE.right, y, { align: "right" });

      progressBar(pdf, PAGE.left, y + 2, pdf.internal.pageSize.getWidth() - PAGE.left - PAGE.right, lot.percent);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.8);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(`${lot.done} faites / ${lot.remaining} restantes • ${lot.late} en retard`, PAGE.left, y + 9.5);

      if (lot.comment) {
        const c = pdf.splitTextToSize(lot.comment, pdf.internal.pageSize.getWidth() - PAGE.left - PAGE.right);
        pdf.text(c, PAGE.left, y + 13.8);
        y += c.length * 3.9 + 5;
      }
      y += 11;
    });
  }

  const buildTaskRows = (tasks: VisiteSnapshotTaskFocus[], sectionLabel: string): TableRow[] => {
    return tasks.map((task) => {
      const fullTask = textOrDash(task.titre);
      const shortTask = truncate(fullTask, 120);
      if (shortTask.endsWith("…")) {
        annexTaskRaw.push({ section: sectionLabel, lot: textOrDash(task.lot ?? "Divers"), titre: fullTask });
      }

      const priorityRaw = (task as { priority?: string | null }).priority ?? (task.retard ? "URGENT" : "NORMALE");
      const comment = input.taskComments?.[task.id]?.comment?.trim();

      return {
        lot: { text: textOrDash(task.lot ?? "Divers") },
        titre: { text: comment ? `${shortTask} (${comment})` : shortTask },
        intervenant: { text: textOrDash(task.intervenant) },
        statut: { badge: badgeStatus(task.statut, "task") },
        date: { text: formatDateFR(task.date_prevue) },
        priorite: { badge: badgeStatus(priorityRaw, "priority") },
      };
    });
  };

  const taskColumns: TableColumn[] = [
    { key: "lot", label: "Lot", width: 24 },
    { key: "titre", label: "Tâche", width: 72 },
    { key: "intervenant", label: "Intervenant", width: 30 },
    { key: "statut", label: "Statut", width: 20, align: "center" },
    { key: "date", label: "Date prévue", width: 20, align: "center" },
    { key: "priorite", label: "Priorité", width: 20, align: "center" },
  ];

  y = sectionTitle(pdf, y, "4. Tâches réalisées");
  const doneRows = buildTaskRows(input.tasksDone, "Tâches réalisées");
  if (doneRows.length) {
    y = drawTable(pdf, y, taskColumns, doneRows);
  } else {
    y = paragraph(pdf, y, "", "Aucune tâche réalisée.");
  }

  y = sectionTitle(pdf, y, "5. Tâches à faire");
  const todoRows = buildTaskRows(input.tasksTodo, "Tâches à faire");
  if (todoRows.length) {
    y = drawTable(pdf, y, taskColumns, todoRows);
  } else {
    y = paragraph(pdf, y, "", "Aucune tâche à faire.");
  }

  y = sectionTitle(pdf, y, "6. Réserves (avec plan)");
  y = drawReservePlanGroups(pdf, y, input);

  y = sectionTitle(pdf, y, "7. Planning / Jalons");
  const planning = input.planningRows && input.planningRows.length ? input.planningRows : input.snapshot.planning ?? [];
  if (planning.length) {
    const planningColumns: TableColumn[] = [
      { key: "jalon", label: "Jalon", width: 88 },
      { key: "debut", label: "Début", width: 22, align: "center" },
      { key: "fin", label: "Fin", width: 22, align: "center" },
      { key: "retard", label: "Retard", width: 18, align: "center" },
      { key: "commentaire", label: "Commentaire", width: 36 },
    ];

    const planningRows: TableRow[] = planning.map((row) => {
      const planningComment = typeof (row as { comment?: unknown }).comment === "string" ? String((row as { comment?: unknown }).comment) : "";
      return {
        jalon: { text: truncate(textOrDash(row.label), 110) },
        debut: { text: formatDateFR(row.date_debut), align: "center" },
        fin: { text: formatDateFR(row.date_fin), align: "center" },
        retard: { badge: badgeStatus(row.retard ? "RETARD" : "FAIT", "action") },
        commentaire: { text: textOrDash(planningComment || "—") },
      };
    });

    y = drawTable(pdf, y, planningColumns, planningRows);
  } else {
    y = paragraph(pdf, y, "", "Aucun jalon planning.");
  }

  const planningRemarque = (input.planningRemarques ?? input.remarquesPlanning ?? "").trim();
  if (planningRemarque) {
    y = paragraph(pdf, y, "Remarques planning", planningRemarque);
  }

  if (input.documentsList && input.documentsList.length) {
    y = sectionTitle(pdf, y, "8. Documents");
    const docColumns: TableColumn[] = [
      { key: "nom", label: "Nom", width: 80 },
      { key: "type", label: "Type", width: 26 },
      { key: "date", label: "Date", width: 24, align: "center" },
      { key: "statut", label: "Accès", width: 20, align: "center" },
      { key: "fallback", label: "Fallback", width: 44 },
    ];
    const docRows: TableRow[] = input.documentsList.map((doc) => ({
      nom: { text: truncate(doc.nom, 120) },
      type: { text: textOrDash(doc.type ?? null) },
      date: { text: formatDateFR(doc.date), align: "center" },
      statut: {
        badge: doc.accessible
          ? { label: "OK", tone: { bg: [220, 252, 231], fg: [21, 128, 61] } }
          : { label: "KO", tone: { bg: [254, 226, 226], fg: [185, 28, 28] } },
      },
      fallback: { text: textOrDash(doc.fallback_message) },
    }));
    y = drawTable(pdf, y, docColumns, docRows);
  }

  y = sectionTitle(pdf, y, "9. Décisions / Actions");
  if (input.actions.length) {
    const actionColumns: TableColumn[] = [
      { key: "action", label: "Action", width: 78 },
      { key: "responsable", label: "Responsable", width: 32 },
      { key: "echeance", label: "Échéance", width: 22, align: "center" },
      { key: "statut", label: "Statut", width: 22, align: "center" },
      { key: "commentaire", label: "Commentaire", width: 32 },
    ];

    const actionRows: TableRow[] = input.actions
      .filter((a) => String(a.description ?? "").trim())
      .map((action) => ({
        action: { text: truncate(action.description, 120) },
        responsable: { text: textOrDash(action.responsable) },
        echeance: { text: formatDateFR(action.echeance), align: "center" },
        statut: { badge: badgeStatus(action.statut, "action") },
        commentaire: { text: textOrDash(action.commentaire) },
      }));

    if (actionRows.length) {
      y = drawTable(pdf, y, actionColumns, actionRows);
    } else {
      y = paragraph(pdf, y, "", "Aucune action renseignée.");
    }
  } else {
    y = paragraph(pdf, y, "", "Aucune action renseignée.");
  }

  if (input.notesTerrain?.trim()) {
    y = sectionTitle(pdf, y, "10. Notes terrain");
    y = paragraph(pdf, y, "Notes / écriture libre", input.notesTerrain);
  }

  const hasSyntheseBlock = Boolean(
    input.resume?.trim() ||
      input.pointsPositifs?.trim() ||
      input.pointsBloquants?.trim() ||
      (input.synthesePoints ?? []).filter((p) => String(p ?? "").trim()).length,
  );
  if (hasSyntheseBlock) {
    y = sectionTitle(pdf, y, "11. Synthèse");
    y = paragraph(pdf, y, "Résumé", input.resume);
    y = paragraph(pdf, y, "Points positifs", input.pointsPositifs);
    y = paragraph(pdf, y, "Points bloquants", input.pointsBloquants);

    const points = cleanList(input.synthesePoints ?? []);
    if (points.length) {
      const bulletText = points.map((p) => `• ${p}`).join("\n");
      y = paragraph(pdf, y, "Points clés", bulletText);
    }

    if (input.intervenantComment?.trim()) {
      y = paragraph(pdf, y, "Commentaire intervenant", input.intervenantComment);
    }
  }

  const annexLines: string[] = [];
  if (input.annexTitles.length) {
    annexLines.push(...input.annexTitles.map((title, idx) => `${idx + 1}. ${title}`));
  }

  if (annexTaskRaw.length) {
    annexLines.push("", "Lignes de tâches complètes (texte non tronqué):");
    annexTaskRaw.forEach((item, index) => {
      annexLines.push(`${index + 1}. [${item.section}] ${item.lot} — ${item.titre}`);
    });
  }

  if (annexLines.length) {
    y = sectionTitle(pdf, y, "12. Annexes");
    const lines = pdf.splitTextToSize(annexLines.join("\n"), pdf.internal.pageSize.getWidth() - PAGE.left - PAGE.right);
    y = ensureSpace(pdf, y, lines.length * 4.4 + 2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.4);
    pdf.setTextColor(...COLORS.text);
    pdf.text(lines, PAGE.left, y);
    y += lines.length * 4.4 + 2;
  }

  const photos = input.photos ?? [];
  for (let i = 0; i < photos.length; i += 1) {
    const dataUrl = await fileToDataUrl(photos[i]);
    imagePage(pdf, dataUrl, `Annexe photo ${i + 1}`);
  }

  drawHeaderFooter(pdf, input.chantierName || "Chantier", company);
  return pdf.output("blob");
}
