/**
 * Lecture des fichiers deposes pour alimenter l'analyse produit de Coco.
 * Partage entre l'import d'une fiche unique et l'import en lot.
 */

export const ACCEPTED_PRODUCT_FILES =
  "application/pdf,.pdf,.xlsx,.xls,.csv,.txt,text/plain,text/csv,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export const SUPPORTED_PRODUCT_FILE_LABEL = "PDF, Excel, CSV, texte ou photo";

export function isSupportedProductFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return [".pdf", ".xlsx", ".xls", ".csv", ".txt", ".jpg", ".jpeg", ".png", ".webp"].some((extension) => name.endsWith(extension))
    || ["application/pdf", "text/plain", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type)
    || isImageFile(file);
}

export function isImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp"].some((extension) => name.endsWith(extension));
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(file);
  });
}

export async function extractProductFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(file);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls") || file.type.includes("spreadsheet") || file.type === "application/vnd.ms-excel") {
    return extractSpreadsheetText(file);
  }

  return file.text();
}

async function extractPdfText(file: File): Promise<string> {
  const [{ default: pdfWorkerUrl }, pdfjsLib] = await Promise.all([
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
    import("pdfjs-dist"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => String(item?.str ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (pageText) pages.push(pageText);
  }

  await pdf.destroy();
  return pages.join("\n");
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = workbook.SheetNames
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return "";
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ";" }).trim();
      return csv ? `Feuille ${sheetName}\n${csv}` : "";
    })
    .filter(Boolean);

  return sheets.join("\n\n");
}

/**
 * Prepare le couple texte + images attendu par `analyzeProductTextWithCoco`
 * pour un lot de fichiers decrivant un meme produit.
 */
export async function readProductFilesForAnalysis(files: File[]): Promise<{
  text: string;
  images: { name: string; dataUrl: string }[];
}> {
  const imageFiles = files.filter((file) => isImageFile(file));
  const textFiles = files.filter((file) => !isImageFile(file));

  const textBlocks = await Promise.all(textFiles.map(async (file) => {
    const text = await extractProductFileText(file);
    return `Fichier: ${file.name}\n${text}`;
  }));

  const images = await Promise.all(imageFiles.map(async (file) => ({
    name: file.name,
    dataUrl: await readFileAsDataUrl(file),
  })));

  return { text: textBlocks.join("\n\n---\n\n").trim(), images };
}
