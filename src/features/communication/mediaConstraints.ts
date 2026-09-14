/**
 * Ce que le stockage des medias de communication accepte reellement.
 *
 * Le champ de selection proposait "image/*,video/*,application/pdf", bien plus
 * large que ce que le bucket autorise : un GIF, un AVIF, un WebM passaient la
 * selection puis se faisaient refuser a l'enregistrement, avec un message de
 * stockage que personne ne peut interpreter. La contrainte est donc dite au
 * moment ou le fichier est choisi, dans les termes de l'utilisateur.
 *
 * Cette liste doit rester alignee sur allowed_mime_types du bucket
 * communication-assets (migration communication_workspace_v1).
 */
export const COMMUNICATION_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
] as const;

/** Attribut accept du champ fichier, aligne sur le stockage. */
export const COMMUNICATION_MEDIA_ACCEPT = COMMUNICATION_MEDIA_MIME_TYPES.join(",");

/** Limite du bucket : 50 Mo par fichier. */
export const COMMUNICATION_MEDIA_MAX_BYTES = 52428800;

export const COMMUNICATION_MEDIA_LABEL = "JPEG, PNG, WebP, HEIC, MP4, MOV ou PDF, 50 Mo maximum par fichier";

function formatSize(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} Mo`;
}

/**
 * Dit ce qui bloque, fichier par fichier, ou null si tout passe. Un type vide
 * arrive avec certaines extensions que le navigateur ne reconnait pas : le
 * stockage les refuse aussi, autant le dire tout de suite.
 */
export function describeRejectedMedia(files: File[]): string | null {
  const problems: string[] = [];

  for (const file of files) {
    if (!COMMUNICATION_MEDIA_MIME_TYPES.includes(file.type as typeof COMMUNICATION_MEDIA_MIME_TYPES[number])) {
      problems.push(`${file.name} : format non accepté (${file.type || "type inconnu"}).`);
      continue;
    }
    if (file.size > COMMUNICATION_MEDIA_MAX_BYTES) {
      problems.push(`${file.name} : ${formatSize(file.size)}, au-delà des ${formatSize(COMMUNICATION_MEDIA_MAX_BYTES)} autorisés.`);
    }
  }

  if (!problems.length) return null;
  return `${problems.join(" ")} Formats acceptés : ${COMMUNICATION_MEDIA_LABEL}.`;
}
