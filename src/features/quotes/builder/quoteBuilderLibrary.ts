import type { QuoteLibraryItem } from "./types";

export const DEFAULT_QUOTE_LIBRARY: QuoteLibraryItem[] = [
  { id: "lib-demolition-faience", title: "Depose faience existante", family: "Demolition", kind: "fourniture", unit: "m2", unitPriceHt: 45, vatRate: 10, description: "Depose, evacuation et nettoyage support." },
  { id: "lib-prepa-support", title: "Preparation support mural", family: "Preparation", kind: "fourniture", unit: "m2", unitPriceHt: 28, vatRate: 10 },
  { id: "lib-pose-placo", title: "Pose cloison placo", family: "Platrerie", kind: "ouvrage", unit: "m2", unitPriceHt: 72, vatRate: 10 },
  { id: "lib-peinture-murs", title: "Peinture murs deux couches", family: "Peinture", kind: "fourniture", unit: "m2", unitPriceHt: 32, vatRate: 10 },
  { id: "lib-main-oeuvre", title: "Main d'oeuvre qualifiee", family: "Main d'oeuvre", kind: "main_oeuvre", unit: "h", unitPriceHt: 48, vatRate: 20 },
  { id: "lib-carrelage", title: "Pose carrelage sol", family: "Carrelage", kind: "ouvrage", unit: "m2", unitPriceHt: 85, vatRate: 10 },
];
