export type RaulAttachment = {
  name: string;
  mime_type: string;
  data_url: string;
};

export const RAUL_MAX_ATTACHMENTS = 3;
export const RAUL_MAX_FILE_SIZE = 8 * 1024 * 1024;
export const RAUL_FILE_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

export async function prepareRaulAttachments(files: FileList | File[], currentCount = 0) {
  const remaining = Math.max(0, RAUL_MAX_ATTACHMENTS - currentCount);
  const selected = Array.from(files).slice(0, remaining);
  const attachments: RaulAttachment[] = [];
  const errors: string[] = [];

  if (remaining === 0 && Array.from(files).length > 0) {
    errors.push(`Raul accepte jusqu'à ${RAUL_MAX_ATTACHMENTS} pièces jointes par message.`);
    return { attachments, errors };
  }

  if (Array.from(files).length > remaining) {
    errors.push(`Seules ${remaining} pièce${remaining > 1 ? "s" : ""} jointe${remaining > 1 ? "s" : ""} supplémentaire${remaining > 1 ? "s" : ""} peuvent être ajoutées.`);
  }

  for (const file of selected) {
    if (file.size > RAUL_MAX_FILE_SIZE) {
      errors.push(`${file.name} dépasse 8 Mo.`);
      continue;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      if (!dataUrl.startsWith("data:")) throw new Error("Format de fichier invalide.");
      attachments.push({
        name: file.name || "piece-jointe",
        mime_type: file.type || "application/octet-stream",
        data_url: dataUrl,
      });
    } catch {
      errors.push(`${file.name || "Le fichier"} n'a pas pu être lu.`);
    }
  }

  return { attachments, errors };
}
