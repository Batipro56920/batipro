import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  cleaned_text?: string;
};

type ProductLine = {
  designation: string;
  supplier_name: string | null;
  supplier_reference: string | null;
  brand: string | null;
  category: string | null;
  unit: string;
  quantity: number | null;
  coverage_m2: number | null;
  purchase_price_ht: number | null;
  sale_price_ht: number | null;
  package_price_ht: number | null;
  vat_rate: number | null;
  packaging: string | null;
  minimum_quantity: number | null;
  consumption_ratio_quantity: number | null;
  consumption_ratio_unit: string | null;
  consumption_base_unit: string | null;
  loss_percent: number | null;
  work_method: string | null;
  application_scope: string | null;
  technical_notes: string | null;
  business_interpretation: string | null;
  confidence: number;
  source_line: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJsonPayload(content: string): unknown {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const stripped = trimmed.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "").trim();
    return JSON.parse(stripped);
  }
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function cleanLongText(value: unknown, maxLength: number): string | null {
  const text = normalizeText(value);
  return text ? text.slice(0, maxLength) : null;
}

function cleanDesignation(value: unknown): string | null {
  let text = normalizeText(value);
  if (!text) return null;

  text = text
    .replace(/\s*-\s*colis\s+de\s+\d+.*$/i, "")
    .replace(/\s+colis\s+de\s+\d+.*$/i, "")
    .replace(/\s+soit\s+\d+(?:[,.]\d+)?\s*m(?:²|2).*$/i, "")
    .replace(/\s+\d+(?:[,.]\d+)?\s*m(?:²|2)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const compact = String(value)
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/[€%]/g, "");

  if (!compact) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  } else if (lastDot >= 0 && looksLikeThousandsGroups(compact, ".")) {
    normalized = compact.replace(/\./g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function looksLikeThousandsGroups(value: string, separator: string): boolean {
  const parts = value.split(separator);
  if (parts.length < 2) return false;
  const [first, ...rest] = parts;
  return first.length >= 1
    && first.length <= 3
    && rest.every((part) => /^\d{3}$/.test(part));
}

function confidence(value: unknown): number {
  const n = toNumber(value);
  if (n === null) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeUnit(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return "u";
  if (["m²", "m2", "m 2", "mq"].includes(value)) return "m2";
  if (["m³", "m3", "m 3"].includes(value)) return "m3";
  if (["ml", "m", "mètre linéaire", "metre lineaire"].includes(value)) return "ml";
  if (["u", "unité", "unite", "pièce", "piece", "pcs", "pc"].includes(value)) return "u";
  if (["h", "heure", "heures"].includes(value)) return "h";
  if (["kg", "kilo", "kilogramme", "kilogrammes"].includes(value)) return "kg";
  if (["g", "gramme", "grammes"].includes(value)) return "g";
  if (["l", "litre", "litres"].includes(value)) return "l";
  if (["forfait", "ens", "ensemble", "lot"].includes(value)) return "forfait";
  return value;
}

function isNoiseDesignation(value: string): boolean {
  const text = value.toLowerCase();
  return [
    "total",
    "sous-total",
    "tva",
    "ttc",
    "conditions",
    "validité",
    "validite",
    "adresse",
    "client",
    "devis",
    "page",
    "acompte",
    "remise",
  ].some((bad) => text.includes(bad));
}

function validateLine(raw: any): ProductLine | null {
  const designation = cleanDesignation(raw?.designation ?? raw?.label ?? raw?.title);
  if (!designation || designation.length < 3) return null;
  if (isNoiseDesignation(designation)) return null;

  const purchasePrice = toNumber(raw?.purchase_price_ht ?? raw?.prix_achat_ht ?? raw?.unit_purchase_price_ht);
  const salePrice = toNumber(raw?.sale_price_ht ?? raw?.prix_vente_ht ?? raw?.unit_sale_price_ht ?? raw?.unit_price_ht);
  const coverageM2 = toNumber(raw?.coverage_m2 ?? raw?.surface_m2 ?? raw?.surface_colis_m2);
  const consumptionRatioQuantity = toNumber(raw?.consumption_ratio_quantity ?? raw?.material_ratio_quantity ?? raw?.ratio_quantity);
  const lossPercent = toNumber(raw?.loss_percent ?? raw?.perte_percent ?? raw?.perte_pourcentage);

  return {
    designation,
    supplier_name: normalizeText(raw?.supplier_name ?? raw?.fournisseur),
    supplier_reference: normalizeText(raw?.supplier_reference ?? raw?.reference_fournisseur ?? raw?.reference),
    brand: normalizeText(raw?.brand ?? raw?.marque),
    category: normalizeText(raw?.category ?? raw?.categorie ?? raw?.famille),
    unit: normalizeUnit(raw?.unit ?? raw?.unite),
    quantity: toNumber(raw?.quantity ?? raw?.quantite ?? raw?.qte),
    coverage_m2: coverageM2,
    purchase_price_ht: purchasePrice,
    sale_price_ht: salePrice,
    package_price_ht: toNumber(raw?.package_price_ht ?? raw?.prix_colis_ht ?? raw?.line_total_ht),
    vat_rate: toNumber(raw?.vat_rate ?? raw?.tva_rate ?? raw?.tva),
    packaging: normalizeText(raw?.packaging ?? raw?.conditionnement),
    minimum_quantity: toNumber(raw?.minimum_quantity ?? raw?.quantite_minimum ?? raw?.qte_min),
    consumption_ratio_quantity: consumptionRatioQuantity,
    consumption_ratio_unit: normalizeText(raw?.consumption_ratio_unit ?? raw?.material_ratio_unit ?? raw?.ratio_unit),
    consumption_base_unit: normalizeText(raw?.consumption_base_unit ?? raw?.ratio_base_unit),
    loss_percent: lossPercent !== null && lossPercent >= 0 && lossPercent <= 100 ? lossPercent : null,
    work_method: cleanLongText(raw?.work_method ?? raw?.mode_operatoire ?? raw?.mise_en_oeuvre, 1600),
    application_scope: cleanLongText(raw?.application_scope ?? raw?.domaine_application ?? raw?.destination, 1200),
    technical_notes: cleanLongText(raw?.technical_notes ?? raw?.notes_techniques, 1200),
    business_interpretation: cleanLongText(raw?.business_interpretation ?? raw?.interpretation_metier, 700),
    confidence: confidence(raw?.confidence),
    source_line: normalizeText(raw?.source_line ?? raw?.sourceLine ?? designation) ?? designation,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const cleanedText = String(body.cleaned_text ?? "").trim();
  if (!cleanedText || cleanedText.length < 20) {
    return json({ ok: false, error: "cleaned_text vide ou trop court." }, 400);
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) {
    return json({ ok: false, error: "OPENAI_API_KEY manquante." }, 500);
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const prompt = [
    "Tu es Coco, l'assistant métier intégré à Batipro pour le bâtiment.",
    "Ta mission n'est pas de copier-coller le document: tu dois comprendre le document et transformer son contenu en données métier fiables pour Batipro.",
    "Tu peux recevoir une fiche technique, une notice, un domaine d'application, un mode opératoire, un devis fournisseur, une grille tarifaire ou plusieurs documents mélangés.",
    "Retourne uniquement les produits matériaux réellement exploitables. Ignore main d'oeuvre, prestations seules, titres, totaux, TVA globale, conditions, adresses, client, mentions légales, règlements, acomptes et lignes sans produit identifiable.",
    "Règle critique: ne confonds jamais un chiffre technique avec un prix. Une consommation, un rendement, une couverture, une densité, une épaisseur, une température ou un temps de séchage ne doit jamais devenir purchase_price_ht ni sale_price_ht.",
    "Règle critique: si un prix n'est pas explicitement indiqué avec €, EUR, HT, prix, tarif, achat, vente, PA ou PV, laisse les prix à null.",
    "Règle critique: si un chiffre est une consommation type 5,7 m2/L ou 1,8 kg/m2, renseigne consumption_ratio_* ou coverage_m2 selon le sens, mais pas un prix.",
    "designation doit être le nom lisible du produit uniquement. Retire le conditionnement de la désignation quand il existe.",
    "packaging contient le conditionnement complet lisible: Pot de 15 L, Sac de 25 kg, Rouleau de 25 m, Colis de panneaux, etc.",
    "purchase_price_ht est le prix d'achat HT unitaire utile pour chiffrer le matériau dans Batipro. Si le document donne un prix au m2, au kg ou au litre, mets ce prix dans purchase_price_ht et l'unité correspondante dans unit.",
    "package_price_ht contient le prix HT du conditionnement complet seulement si le document donne un prix de pot, sac, colis ou rouleau distinct du prix unitaire métier.",
    "sale_price_ht est un prix de vente uniquement si le document le dit explicitement. Sinon laisse null: Batipro calculera achat + marge.",
    "coverage_m2 contient la surface couverte par un conditionnement quand elle est indiquée ou clairement déductible. Ne force pas coverage_m2 si le rendement est seulement indicatif et le conditionnement absent.",
    "consumption_ratio_quantity, consumption_ratio_unit et consumption_base_unit décrivent la consommation utile pour une tâche. Exemple: 1.8 kg/m2 => quantity 1.8, unit kg, base m2. Exemple rendement 5.7 m2/L => quantity 0.175, unit l, base m2.",
    "loss_percent contient uniquement une perte ou majoration chantier explicitement mentionnée.",
    "application_scope doit résumer le domaine d'application: supports, pièces, intérieur/extérieur, conditions d'emploi, limites importantes.",
    "work_method doit transformer la notice en mode opératoire actionnable pour l'intervenant: préparation support, mélange/préparation produit, application, temps d'attente/séchage, couches, contrôles et sécurité utile. Ne recopie pas tout le document: synthétise en étapes terrain.",
    "technical_notes contient les points techniques importants qui ne rentrent pas ailleurs.",
    "business_interpretation explique en une phrase pourquoi tu as classé les prix, ratios et unités ainsi. Mentionne les incertitudes si besoin.",
    "Si le document est clairement un devis client avec prix de vente et pas un devis fournisseur, mets le prix dans sale_price_ht et laisse purchase_price_ht à null si le prix d'achat est incertain.",
    "confidence entre 0 et 1. Baisse la confiance si le prix, l'unité ou le ratio sont ambigus.",
    "Réponds en JSON strict uniquement avec ce format: {\"products\": ProductLine[]}.",
    "ProductLine = {supplier_name, designation, supplier_reference, brand, category, unit, quantity, coverage_m2, purchase_price_ht, sale_price_ht, package_price_ht, vat_rate, packaging, minimum_quantity, consumption_ratio_quantity, consumption_ratio_unit, consumption_base_unit, loss_percent, work_method, application_scope, technical_notes, business_interpretation, confidence, source_line}.",
  ].join("\n");

  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: cleanedText.slice(0, 120000) },
    ],
  };

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!aiRes.ok) {
    const status = aiRes.status;
    const details = await aiRes.text().catch(() => "");
    console.error("extract-devis-products OpenAI request failed", { status, details: details.slice(0, 500) });
    return json({ ok: false, error: "Lecture IA indisponible. Vérifiez la configuration OpenAI côté Supabase Functions." }, 502);
  }

  const completion = await aiRes.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    return json({ ok: false, error: "Réponse IA vide." }, 502);
  }

  let parsed: any;
  try {
    parsed = parseJsonPayload(content);
  } catch (error) {
    return json({ ok: false, error: "Réponse IA non JSON.", details: String(error) }, 422);
  }

  const rawProducts = Array.isArray(parsed) ? parsed : parsed?.products;
  if (!Array.isArray(rawProducts)) {
    return json({ ok: false, error: "Format JSON invalide (products[] attendu)." }, 422);
  }

  const products = rawProducts.map((product: any) => validateLine(product)).filter(Boolean) as ProductLine[];
  return json({ ok: true, products });
});
