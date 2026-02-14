import jsPDF from "jspdf";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

type VisiteActionInput = {
  action_text: string;
  responsable?: string | null;
  due_date?: string | null;
};

type VisitePdfInput = {
  chantierName: string;
  chantierAddress?: string | null;
  visitDateTime: string;
  redactorEmail?: string | null;
  participants: string[];
  meteo?: string | null;
  avancementText?: string | null;
  avancementPercent?: number | null;
  observations?: string | null;
  safetyPoints?: string | null;
  decisions?: string | null;
  actions: VisiteActionInput[];
  photos: File[];
};

type DoeSourceDocument = {
  title: string;
  mimeType: string | null;
  signedUrl: string;
};

type DoePdfInput = {
  chantierName: string;
  chantierAddress?: string | null;
  clientName?: string | null;
  companyName?: string | null;
  generatedAt: string;
  documents: DoeSourceDocument[];
};

function formatDateFr(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function addFooter(pdf: jsPDF, label: string) {
  const totalPages = pdf.getNumberOfPages();
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  pdf.setFontSize(9);
  pdf.setTextColor(90, 98, 112);
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.text(`Batipro - ${label} - page ${page}/${totalPages}`, width / 2, height - 8, {
      align: "center",
    });
  }
}

function addSection(pdf: jsPDF, title: string, content: string, yStart: number) {
  const width = pdf.internal.pageSize.getWidth();
  const margin = 16;
  const maxWidth = width - margin * 2;
  let y = yStart;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title, margin, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(51, 65, 85);
  const lines = pdf.splitTextToSize(content || "Non renseigné.", maxWidth);
  pdf.text(lines, margin, y);
  return y + lines.length * 5 + 4;
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Lecture image impossible."));
    };
    reader.onerror = () => reject(new Error("Lecture image impossible."));
    reader.readAsDataURL(file);
  });
}

function addImageFittedPage(pdf: jsPDF, imgData: string, label?: string) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const captionSpace = label ? 10 : 0;
  const props = pdf.getImageProperties(imgData);
  const maxW = width - margin * 2;
  const maxH = height - margin * 2 - captionSpace;
  const ratio = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * ratio;
  const h = props.height * ratio;
  const x = (width - w) / 2;
  const y = margin + captionSpace;
  pdf.addPage();
  if (label) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(label, margin, margin);
  }
  pdf.addImage(imgData, "JPEG", x, y, w, h, undefined, "FAST");
}

export async function generateVisiteReportPdfBlob(input: VisitePdfInput): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, width, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Rapport de visite chantier", 16, 18);

  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(input.chantierName || "Chantier", 16, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(input.chantierAddress || "-", 16, 46);
  pdf.text(`Date/heure: ${formatDateFr(input.visitDateTime)}`, 16, 52);
  pdf.text(`Rédacteur: ${input.redactorEmail || "-"}`, 16, 58);

  let y = 68;
  y = addSection(pdf, "Participants", (input.participants ?? []).join(", "), y);
  y = addSection(pdf, "Météo", input.meteo || "", y);
  y = addSection(
    pdf,
    "Avancement",
    `${input.avancementText || ""}${input.avancementPercent != null ? ` (${input.avancementPercent}%)` : ""}`,
    y,
  );
  y = addSection(pdf, "Observations générales", input.observations || "", y);

  if (y > 215) {
    pdf.addPage();
    y = 20;
  }
  y = addSection(pdf, "Points sécurité", input.safetyPoints || "", y);
  y = addSection(pdf, "Décisions prises", input.decisions || "", y);

  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Actions à faire", 16, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  let actionY = 28;
  const actions = input.actions.filter((action) => (action.action_text ?? "").trim().length > 0);
  if (!actions.length) {
    pdf.text("Aucune action.", 16, actionY);
  } else {
    actions.forEach((action, index) => {
      const line = `${index + 1}. ${action.action_text} | Responsable: ${action.responsable || "-"} | Échéance: ${
        action.due_date || "-"
      }`;
      const lines = pdf.splitTextToSize(line, 178);
      if (actionY + lines.length * 5 > 280) {
        pdf.addPage();
        actionY = 18;
      }
      pdf.text(lines, 16, actionY);
      actionY += lines.length * 5 + 2;
    });
  }

  for (let i = 0; i < input.photos.length; i += 1) {
    const photo = input.photos[i];
    const dataUrl = await fileToDataUrl(photo);
    addImageFittedPage(pdf, dataUrl, `Annexe photo ${i + 1}`);
  }

  addFooter(pdf, "Rapport de visite");
  const blob = pdf.output("blob");
  return blob;
}

async function appendPdfSource(pdf: jsPDF, doc: DoeSourceDocument) {
  const response = await fetch(doc.signedUrl);
  if (!response.ok) {
    throw new Error(`Impossible de charger le document: ${doc.title}`);
  }
  const bytes = await response.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const source = await loadingTask.promise;
  try {
    for (let pageNum = 1; pageNum <= source.numPages; pageNum += 1) {
      const page = await source.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas non disponible.");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const img = canvas.toDataURL("image/jpeg", 0.92);
      addImageFittedPage(pdf, img, `${doc.title} - page ${pageNum}`);
    }
  } finally {
    await loadingTask.destroy();
  }
}

async function appendImageSource(pdf: jsPDF, doc: DoeSourceDocument) {
  const response = await fetch(doc.signedUrl);
  if (!response.ok) throw new Error(`Impossible de charger l'image: ${doc.title}`);
  const blob = await response.blob();
  const dataUrl = await fileToDataUrl(blob);
  addImageFittedPage(pdf, dataUrl, doc.title);
}

export async function generateDoeFinalPdfBlob(input: DoePdfInput): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, width, 48, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text("DOE FINAL", 16, 22);
  pdf.setFontSize(11);
  pdf.text(input.companyName || "CB Renovation", 16, 30);
  pdf.text(`Genere le ${formatDateFr(input.generatedAt)}`, 16, 36);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(13);
  pdf.text(input.chantierName || "Chantier", 16, 62);
  pdf.setFontSize(10);
  pdf.text(input.chantierAddress || "-", 16, 68);
  pdf.text(`Client: ${input.clientName || "-"}`, 16, 74);

  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Sommaire", 16, 20);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  let y = 30;
  input.documents.forEach((doc, index) => {
    const lines = pdf.splitTextToSize(`${index + 1}. ${doc.title}`, 178);
    if (y + lines.length * 5 > 280) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(lines, 16, y);
    y += lines.length * 5 + 1;
  });

  for (const doc of input.documents) {
    const mime = (doc.mimeType ?? "").toLowerCase();
    if (mime === "application/pdf") {
      await appendPdfSource(pdf, doc);
      continue;
    }
    if (mime.startsWith("image/")) {
      await appendImageSource(pdf, doc);
      continue;
    }
    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(doc.title, 16, 24);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Ce type de document ne peut pas être fusionné en aperçu.", 16, 34);
  }

  addFooter(pdf, "DOE final");
  return pdf.output("blob");
}
