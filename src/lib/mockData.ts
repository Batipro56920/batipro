import type { Chantier } from "../types/chantier";

export const seedChantiers: Chantier[] = [
  {
    id: "c1",
    nom: "Bisson",
    adresse: "18 Place Bisson",
    client: "SCI LOJO IMMO",
    status: "EN_COURS",
    avancement: 24,
    dateDebut: "2025-12-29",
    heuresPrevues: 55,
    heuresPassees: 0,
  },
  {
    id: "c2",
    nom: "Duplex Centre",
    adresse: "Pontivy",
    client: "Client privé",
    status: "EN_ATTENTE",
    avancement: 0,
    dateDebut: "2026-01-10",
    heuresPrevues: 120,
    heuresPassees: 12,
  },
];