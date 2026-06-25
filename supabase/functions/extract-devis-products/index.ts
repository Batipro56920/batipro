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
  if (["kg", "kilo", "kilogramme"].includes(value)) return "kg";
  if (["l", "litre", "litres"].includes(value)) return "l";
  if (["forfait", "ens", "ensemble", "lot"].includes(value)) return "forfait";
  return "u";
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
    "Tu lis le texte extrait d'un devis fournisseur BTP ou d'une grille de prix matériaux.",
    "Tu dois retourner uniquement les lignes produits exploitables pour créer des fiches catalogue fournisseur.",
    "Ignore strictement: main d'oeuvre, prestations seules, titres de sections, totaux, sous-totaux, TVA globale, conditions, adresses, client, mentions légales, règlements, acomptes, frais généraux et lignes sans produit identifiable.",
    "designation doit être le nom lisible du produit uniquement. Retire le conditionnement de la désignation quand il existe, par exemple 'colis de 8 panneaux soit 6,48m2'.",
    "packaging contient le conditionnement complet lisible, par exemple 'Colis de 8 panneaux'.",
    "coverage_m2 contient la surface couverte par un colis ou paquet quand elle est indiquée, par exemple 6.48 pour 'soit 6,48m2'.",
    "Pour les isolants, plaques, membranes, revêtements et produits vendus ensuite en m², mets unit = m2 et purchase_price_ht = prix unitaire HT au m². Ne mets pas le prix total du colis dans purchase_price_ht.",
    "package_price_ht contient le prix HT du colis ou le total de ligne si disponible et différent du prix au m².",
    "Pour chaque produit, extrais seulement les informations nécessaires: supplier_name, designation, quantity, unit, coverage_m2, purchase_price_ht, package_price_ht, vat_rate, supplier_reference, brand, category, packaging, minimum_quantity, confidence, source_line.",
    "quantity correspond à la quantité de la ligne du devis. purchase_price_ht correspond au prix unitaire HT fournisseur dans l'unité de vente future, notamment m² si coverage_m2 existe.",
    "Si le document est un devis client avec prix de vente et pas un devis fournisseur, mets le prix unitaire dans sale_price_ht et laisse purchase_price_ht à null si le prix d'achat est incertain.",
    "unit doit être parmi: u, h, ml, m2, m3, forfait, kg, l.",
    "confidence entre 0 et 1.",
    "Réponds en JSON strict uniquement avec ce format: {\"products\": ProductLine[]}.",
    "ProductLine = {supplier_name, designation, supplier_reference, brand, category, unit, quantity, coverage_m2, purchase_price_ht, sale_price_ht, package_price_ht, vat_rate, packaging, minimum_quantity, confidence, source_line}.",
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
