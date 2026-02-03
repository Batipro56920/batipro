// supabase/functions/process-devis-text/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  chantierId: string;
  devisId: string;
  extractedText: string;
};

type DevisStructureSection = {
  code: string;
  title: string;
  level: number;
  parentCode: string | null;
};

type ParsedLine = {
  code: string | null;
  designation: string; // ✅ UNIQUEMENT la désignation (sans qty/unit/€/%)
  quantite: number;
  unite: string;
  lot: string | null; // ✅ Lot (niveau 1)
  sous_lot: string | null; // ✅ Sous-lot (niveau 2+)
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toNumber(fr: string) {
  const n = Number(String(fr ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normSpaces(s: string) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** ✅ Nettoyage très agressif : on ne veut PAS de PU/TVA affichés */
function cleanDesignation(raw: string) {
  let s = normSpaces(raw);

  // Enlève code type "1.2.3 " au début si resté
  s = s.replace(/^\d+(?:\.\d+)*\s+/, "").trim();

  // Enlève traînes "€", "%", "HT", "TTC" si elles se collent
  // (normalement pas capturées, mais on sécurise)
  s = s.replace(/\s+\d+(?:[.,]\d+)?\s*€.*$/i, "").trim();
  s = s.replace(/\s+\d+(?:[.,]\d+)?\s*%.*$/i, "").trim();
  s = s.replace(/\b(TOTAL|HT|TTC|TVA)\b.*$/i, "").trim();

  // Si c'est encore vide, on rejette plus tard
  return s;
}

function isBoilerplate(line: string) {
  const l = line.toLowerCase();
  const bad = [
    "siren",
    "siret",
    "tva",
    "email",
    "e-mail",
    "tél",
    "tel",
    "adresse",
    "france",
    "devis",
    "date",
    "valid",
    "conditions",
    "référence",
    "reference",
    "total ht",
    "total ttc",
    "total",
    "désignation qt",
    "designation qt",
    "prix u",
    "prix unitaire",
    "page",
    "client",
    "chantier",
  ];
  if (bad.some((t) => l.includes(t))) return true;

  // ex: "56890 Plescop"
  if (/^\d{5}\s+[a-zàâäéèêëîïôöùûüç'\- ]+$/i.test(line)) return true;
  // ex: "1 All. Broerec"
  if (/^\d+\s+(all\.|avenue|av\.|rue|impasse|bd|boulevard|chemin|route)\b/i.test(line)) return true;

  return false;
}

function parseHeader(line: string): { code: string; title: string; level: number } | null {
  const m = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
  if (!m) return null;
  const code = m[1];
  const title = normSpaces(m[2] ?? "");
  if (!title || title.length < 3) return null;
  const level = code.split(".").length;
  return { code, title, level };
}

/**
 * ✅ PDFJS sort souvent un texte "collé".
 * Objectif : reconstruire des "lignes logiques" AVANT parsing.
 */
function toLogicalLines(extractedText: string): string[] {
  let t = normSpaces(extractedText).replace(/\r/g, "\n");

  // Si quasi pas de retours à la ligne, on force un découpage sur codes "x.y.z "
  t = t.replace(/(\s)(\d+(?:\.\d+)+\s)/g, "\n$2");

  // Découpage sur gros titres " 1 Dépose..." (niveau 1)
  t = t.replace(/(\s)(\d{1,2}\s+[A-Za-zÀ-ÿ])/g, "\n$2");

  // Aide : découpe avant "qty + unité"
  t = t.replace(
    /(\s)(\d+(?:[.,]\d+)?\s*(?:m²|m2|ml|m|u|U|forfait|ens|lot)\b)/gi,
    "\n$2",
  );

  const raw = t
    .split("\n")
    .map((x) => normSpaces(x))
    .filter(Boolean);

  // Re-split si une "ligne" est une page entière
  const out: string[] = [];
  for (const l of raw) {
    if (l.length < 220) {
      out.push(l);
      continue;
    }
    const parts = l
      .split(/(?=\b\d+(?:\.\d+)+\s)/g)
      .map((p) => normSpaces(p))
      .filter(Boolean);

    if (parts.length > 1) out.push(...parts);
    else out.push(l);
  }

  return out;
}

/**
 * ✅ Ligne "valide chantier" = désignation + quantité + unité.
 * On ignore PU / TVA.
 *
 * Exemples acceptés :
 * - "1.2.1 Désignation ... 69,50 m² 10,50 € 10,00 %"
 * - "1.3.1 Dépose ... 1,00 u 157,50 € 10,00 %"
 */
function parseQtyUnitLine(line: string): ParsedLine | null {
  const unitRx = "(m²|m2|ml|m|u|U|forfait|ens|lot)";

  // ⚠️ IMPORTANT :
  // - on accepte du texte APRÈS l’unité (prix, €, %)
  // - mais on ne le capture PAS
  const rx = new RegExp(
    `^(?:(\\d+(?:\\.\\d+)*)\\s+)?(.+?)\\s+(\\d+(?:[\\.,]\\d+)?)\\s*${unitRx}\\b`,
    "i",
  );

  const m = line.match(rx);
  if (!m) return null;

  const code = (m[1] ?? "").trim() || null;
  const rawDesignation = (m[2] ?? "").trim();
  const qty = toNumber(m[3]);
  const unit = (m[4] ?? "").trim();

  if (!qty || qty <= 0) return null;
  if (!unit) return null;

  const designation = cleanDesignation(rawDesignation);
  if (!designation || designation.length < 4) return null;

  // évite les villes / entêtes
  if (/^[A-ZÀ-ÿ\s\-']+$/.test(designation) && designation.length < 30) {
    return null;
  }

  return {
    code,
    designation,
    quantite: qty,
    unite: unit,
    lot: null,
    sous_lot: null,
  };
}

function parseDevis(extractedText: string): { lines: ParsedLine[]; structure: DevisStructureSection[] } {
  const logicalLines = toLogicalLines(extractedText);

  const structure: DevisStructureSection[] = [];
  const lines: ParsedLine[] = [];

  // ✅ dédoublonnage robuste (évite répétition multi-pages)
  const seenLineKey = new Set<string>();
  const seenSectionKey = new Set<string>();

  let currentLotTitle: string | null = null;
  let currentSousLotTitle: string | null = null;
  let currentLotCode: string | null = null;

  for (const line0 of logicalLines) {
    if (!line0) continue;
    if (isBoilerplate(line0)) continue;

    // 1) ✅ LIGNE CHANTIER : qty + unité => on la garde
    const ql = parseQtyUnitLine(line0);
    if (ql) {
      ql.lot = currentLotTitle;
      ql.sous_lot = currentSousLotTitle;

      // clé normalisée
      const key = [
        (ql.designation || "").toLowerCase(),
        String(ql.quantite).replace(",", "."),
        (ql.unite || "").toLowerCase(),
        (ql.lot || "").toLowerCase(),
        (ql.sous_lot || "").toLowerCase(),
      ].join("|");

      if (!seenLineKey.has(key)) {
        seenLineKey.add(key);
        lines.push(ql);
      }
      continue;
    }

    // 2) ✅ Sinon : uniquement structure (lot/sous-lot) -> JAMAIS inséré en devis_lignes
    const h = parseHeader(line0);
    if (!h) continue;

    const title = cleanDesignation(h.title);
    if (!title) continue;
    if (isBoilerplate(title)) continue;

    if (h.level === 1) {
      currentLotTitle = title;
      currentLotCode = h.code;
      currentSousLotTitle = null;

      const secKey = `L1|${h.code}|${title}`.toLowerCase();
      if (!seenSectionKey.has(secKey)) {
        seenSectionKey.add(secKey);
        structure.push({ code: h.code, title, level: 1, parentCode: null });
      }
      continue;
    }

    if (h.level >= 2) {
      if (!currentLotCode) continue;
      currentSousLotTitle = title;

      const secKey = `L${h.level}|${h.code}|${title}|${currentLotCode}`.toLowerCase();
      if (!seenSectionKey.has(secKey)) {
        seenSectionKey.add(secKey);
        structure.push({ code: h.code, title, level: h.level, parentCode: currentLotCode });
      }
      continue;
    }
  }

  return { lines, structure };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(
        {
          ok: false,
          error: "Missing env vars",
          details: { hasUrl: !!SUPABASE_URL, hasServiceRole: !!SERVICE_ROLE_KEY },
        },
        500,
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const chantierId = (body?.chantierId ?? "").trim();
    const devisId = (body?.devisId ?? "").trim();
    const extractedText = (body?.extractedText ?? "").trim();

    if (!chantierId) return json({ ok: false, error: "chantierId manquant" }, 400);
    if (!devisId) return json({ ok: false, error: "devisId manquant" }, 400);
    if (!extractedText || extractedText.length < 20) {
      return json({ ok: false, error: "extractedText vide/trop court" }, 400);
    }

    const { lines, structure } = parseDevis(extractedText);

    // ✅ IMPORTANT : évite doublons quand tu ré-importes le même devis
    // (on remplace les lignes du devis)
    const { error: wipeErr } = await admin.from("devis_lignes").delete().eq("devis_id", devisId);
    if (wipeErr) {
      return json({ ok: false, error: "Impossible de vider les anciennes lignes du devis", details: wipeErr }, 500);
    }

    if (lines.length === 0) {
      return json({
        ok: true,
        linesInserted: 0,
        tasksCreated: 0,
        structure,
        note: "Aucune ligne avec quantité + unité détectée.",
      });
    }

    // ✅ Insert : seulement designation + unité + quantité
    // ✅ PAS de PU / TVA
    // ✅ lot/sous-lot stockés pour tri (sans créer de "lignes lot")
    const rows = lines.map((l, idx) => ({
      devis_id: devisId,
      ordre: idx + 1,

      // ✅ usage chantier : corps_etat = lot (niveau 1)
      corps_etat: l.lot ?? null,

      // ✅ champ futur (UI) : entreprise (si ta table a la colonne, sinon ça plantera)
      // -> si ta table devis_lignes N'A PAS "entreprise", supprime cette ligne.
      entreprise: null,

      designation: l.designation,
      unite: l.unite,
      quantite: l.quantite,

      prix_unitaire_ht: null,
      tva_rate: null,

      generer_tache: true,

      // ✅ "caché" pour ranger ensuite : sous-lot (niveau 2+)
      // (ne sert pas au financier)
      titre_tache: l.sous_lot ? String(l.sous_lot) : null,

      date_prevue: null,
    }));

    // ⚠️ select minimal pour éviter d'exposer des colonnes non existantes
    const { data: inserted, error: insertErr } = await admin
      .from("devis_lignes")
      .insert(rows)
      .select("id, designation, corps_etat, titre_tache, unite, quantite");

    if (insertErr) {
      return json({ ok: false, error: "Insert devis_lignes failed", details: insertErr }, 500);
    }

    const linesInserted = inserted?.length ?? 0;

    // ✅ Tâches : UNIQUEMENT pour lignes chiffrées (qty+unit)
    // ✅ on préfixe le titre par le sous-lot pour pouvoir filtrer/chercher ensuite
    // ⚠️ on ne peut pas supprimer automatiquement les anciennes tâches (pas de lien devis->tâche)
    const tasksToInsert = (inserted ?? []).map((l: any) => {
      const sousLot = String(l?.titre_tache ?? "").trim();
      const prefix = sousLot ? `${sousLot} — ` : "";
      const titreBase = String(l?.designation ?? "Ligne devis").trim();

      // Optionnel : ajoute "qty + unit" au titre (si tu veux)
      // const qty = l?.quantite != null ? String(l.quantite) : "";
      // const unit = l?.unite ? String(l.unite) : "";
      // const suffix = qty && unit ? ` (${qty} ${unit})` : "";
      // return { ... , titre: `${prefix}${titreBase}${suffix}` };

      return {
        chantier_id: chantierId,
        titre: `${prefix}${titreBase}`,
        corps_etat: l?.corps_etat ?? null,
        date: null,
        status: "A_FAIRE",
        ordre: 999999,
      };
    });

    let tasksCreated = 0;
    if (tasksToInsert.length > 0) {
      const { data: taskData, error: taskErr } = await admin
        .from("chantier_tasks")
        .insert(tasksToInsert)
        .select("id");

      if (taskErr) {
        return json({
          ok: true,
          linesInserted,
          tasksCreated: 0,
          structure,
          warning: "Lignes OK mais création tâches KO",
          taskError: taskErr,
        });
      }
      tasksCreated = taskData?.length ?? tasksToInsert.length;
    }

    return json({
      ok: true,
      linesInserted,
      tasksCreated,
      structure,
      note: "Lots/sous-lots => structure uniquement (pas de lignes lot). PU/TVA ignorés.",
    });
  } catch (e) {
    return json({ ok: false, error: e?.message ?? String(e), stack: e?.stack ?? null }, 500);
  }
});
