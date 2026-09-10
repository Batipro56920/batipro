const MAX_EDGE = 2200;
const QUALITY = 0.85;

/**
 * Ramène une photo prise au téléphone en JPEG raisonnable avant envoi.
 *
 * Deux raisons : un iPhone livre volontiers du HEIC, que le serveur refuse et que
 * l'IA ne sait pas lire ; et une photo de 8 Mo sur le réseau d'un chantier met
 * une éternité à monter. Le décodage HEIC est fait par le système sur iOS, donc
 * le dessin sur canvas suffit.
 *
 * Si la conversion échoue, on renvoie le fichier d'origine : mieux vaut tenter
 * l'envoi que bloquer l'ouvrier.
 */
export async function photoToJpeg(file: File): Promise<File> {
  if (file.type === "image/jpeg" && file.size < 1_500_000) return file;

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || !blob.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari refuse createImageBitmap sur certains HEIC : on passe par <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("decode"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
