const fs = require('fs');
const path = 'src/services/chantierTasks.service.ts';
let text = fs.readFileSync(path, 'utf8');

if (!text.includes('quantite: number | null;')) {
  text = text.replace(
    '  intervenant_id: string | null;\n\n  //',
    '  intervenant_id: string | null;\n\n  quantite: number | null;\n  unite: string | null;\n  temps_prevu_h: number | null;\n\n  //'
  );
}

if (!text.includes('quantite?: number | string | null;')) {
  text = text.replace(
    '  intervenant_id?: string | null;\n\n  //',
    '  intervenant_id?: string | null;\n\n  quantite?: number | string | null;\n  unite?: string | null;\n  temps_prevu_h?: number | string | null;\n\n  //'
  );
}

if (!text.includes('| "quantite"')) {
  text = text.replace(
    '    | "intervenant_id"\n    | "date_debut"',
    '    | "intervenant_id"\n    | "quantite"\n    | "unite"\n    | "temps_prevu_h"\n    | "date_debut"'
  );
}

if (!text.includes('function normalizeNumber(value: unknown): number | null')) {
  text = text.replace(
    '/* =========================================================\n   HELPERS\n   ========================================================= */\n\n',
    '/* =========================================================\n   HELPERS\n   ========================================================= */\n\nfunction normalizeNumber(value: unknown): number | null {\n  if (value === null || value === undefined || value === "") return null;\n  if (typeof value === "string") {\n    const raw = value.trim().replace(",", ".");\n    if (!raw) return null;\n    const n = Number(raw);\n    return Number.isFinite(n) ? n : null;\n  }\n  if (typeof value === "number") return Number.isFinite(value) ? value : null;\n  return null;\n}\n\n'
  );
}

if (!text.includes('typeof cleaned.unite')) {
  text = text.replace(
    '  if (typeof cleaned.titre === "string") cleaned.titre = cleaned.titre.trim();\n  if (typeof cleaned.corps_etat === "string") cleaned.corps_etat = cleaned.corps_etat.trim();\n',
    '  if (typeof cleaned.titre === "string") cleaned.titre = cleaned.titre.trim();\n  if (typeof cleaned.corps_etat === "string") cleaned.corps_etat = cleaned.corps_etat.trim();\n  if (typeof cleaned.unite === "string") cleaned.unite = cleaned.unite.trim();\n'
  );
}

if (!text.includes('cleaned.unite === ""')) {
  text = text.replace(
    '  if (cleaned.date_fin === "") cleaned.date_fin = null;\n  if (cleaned.intervenant_id === "") cleaned.intervenant_id = null;\n',
    '  if (cleaned.date_fin === "") cleaned.date_fin = null;\n  if (cleaned.intervenant_id === "") cleaned.intervenant_id = null;\n  if (cleaned.unite === "") cleaned.unite = null;\n'
  );
}

text = text.replace(
  /if \(cleaned\.temps_reel_h !== undefined\) \{[\s\S]*?\n  \}/,
  'if (cleaned.temps_reel_h !== undefined) {\n    cleaned.temps_reel_h = normalizeNumber(cleaned.temps_reel_h);\n  }'
);

if (!text.includes('cleaned.quantite')) {
  text = text.replace(
    '  if (cleaned.temps_reel_h !== undefined) {\n    cleaned.temps_reel_h = normalizeNumber(cleaned.temps_reel_h);\n  }\n',
    '  if (cleaned.temps_reel_h !== undefined) {\n    cleaned.temps_reel_h = normalizeNumber(cleaned.temps_reel_h);\n  }\n\n  if (cleaned.quantite !== undefined) {\n    cleaned.quantite = normalizeNumber(cleaned.quantite);\n  }\n  if (cleaned.temps_prevu_h !== undefined) {\n    cleaned.temps_prevu_h = normalizeNumber(cleaned.temps_prevu_h);\n  }\n'
  );
}

if (!text.includes('const quantiteValue')) {
  text = text.replace(
    '  if (!chantier_id) throw new Error("chantier_id manquant.");\n  if (!titre) throw new Error("titre manquant.");\n\n  const insertRow: any = {',
    '  if (!chantier_id) throw new Error("chantier_id manquant.");\n  if (!titre) throw new Error("titre manquant.");\n\n  const quantiteValue = normalizeNumber(payload.quantite);\n  const tempsPrevuValue = normalizeNumber(payload.temps_prevu_h);\n\n  const insertRow: any = {'
  );
}

if (!text.includes('quantite: quantiteValue')) {
  text = text.replace(
    '    status: payload.status ?? "A_FAIRE",\n    intervenant_id: payload.intervenant_id ?? null,\n\n    //',
    '    status: payload.status ?? "A_FAIRE",\n    intervenant_id: payload.intervenant_id ?? null,\n    quantite: quantiteValue === null ? 1 : quantiteValue,\n    unite: (payload.unite ?? "").trim() || null,\n    temps_prevu_h: tempsPrevuValue ?? null,\n\n    //'
  );
}

text = text.replace(
  /intervenant_id",\n\s+"date_debut"/g,
  'intervenant_id",\n        "quantite",\n        "unite",\n        "temps_prevu_h",\n        "date_debut"'
);

fs.writeFileSync(path, text, 'utf8');
