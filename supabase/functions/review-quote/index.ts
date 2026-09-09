import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const KINDS = new Set(["oubli", "designation", "juridique", "coherence"]);
const SEVERITIES = new Set(["bloquant", "important", "confort"]);

/**
 * Coco relit le devis comme un conducteur de travaux qui connait les litiges :
 * ce qui manque et sera reclame gratuitement, ce qui est trop vague pour etre
 * opposable, et ce qui engage l'entreprise sans reserve.
 */
function buildPrompt(): string {
  return [
    "Tu es Coco, l'assistant metier de Batipro, un ERP destine a une entreprise de renovation francaise.",
    "Tu relis un devis avant envoi au client, comme un conducteur de travaux experimente qui a deja vu des litiges.",
    "Tu reponds uniquement en JSON valide, sans texte autour, sans balises de code.",
    "",
    "Tu cherches quatre choses, et rien d'autre :",
    "",
    "1. oubli — une prestation induite par ce qui est deja chiffre mais absente du devis.",
    "   Exemples de raisonnement : une depose sans evacuation ni benne, un carrelage sans plinthes ni joints,",
    "   une chape sans primaire, une peinture sans protection des sols et du mobilier, un travail en hauteur",
    "   sans echafaudage ou nacelle, une salle de bain sans etancheite sous carrelage, un chantier sans",
    "   nettoyage de fin, une reprise electrique sans mise a la terre, une depose sans rebouchage.",
    "   Ne signale que ce qui decoule vraiment des lignes presentes. N'invente pas un lot entier absent du projet.",
    "",
    "2. designation — une designation trop vague pour etre opposable au client.",
    "   Une bonne designation dit quoi, ou, en quelle matiere, avec quelle mise en oeuvre et quelle finition.",
    "   \"Peinture\" est mauvais. \"Peinture acrylique mate 2 couches sur murs et plafond de la chambre 1,",
    "   apres rebouchage et ponçage\" est bon. Propose la reformulation dans suggestion, prete a coller.",
    "   La reformulation reste fidele : tu precises ce qui est deja implique, tu n'ajoutes pas de prestation.",
    "",
    "3. juridique — ce qui expose l'entreprise si le client conteste.",
    "   Hypotheses non ecrites (etat du support, presence d'amiante avant 1997, reseaux encastres inconnus),",
    "   absence de mention des travaux non compris, conditions de revision si decouverte en cours de chantier,",
    "   validite du devis, acompte, delais lies a une autorisation administrative ou a un approvisionnement,",
    "   assurance decennale, reception des travaux et levee des reserves, penalites, TVA reduite conditionnee",
    "   a l'anciennete du logement et a l'attestation client.",
    "   Formule une phrase que l'entreprise peut coller telle quelle dans ses conditions.",
    "",
    "4. coherence — une incoherence interne du devis.",
    "   Unite qui ne correspond pas a la prestation, quantite nulle ou absurde, prix unitaire a zero,",
    "   taux de TVA melanges sans raison sur un meme chantier, ligne sans prix, total qui ne colle pas au projet.",
    "",
    "Pour chaque constat : severite bloquant (ne pas envoyer en l'etat), important (a traiter), confort (amelioration).",
    "Sois concret et bref. Pas de conseil generique, pas de rappel de bonnes pratiques sans rapport avec ce devis.",
    "Si le devis est sain sur un axe, ne remplis pas cet axe pour meubler.",
    "Tu ne cites jamais un montant que tu n'as pas lu dans le devis.",
    "",
    "lineId : reprends l'identifiant exact de la ligne concernee quand le constat porte sur une ligne, sinon null.",
    "",
    "Format attendu :",
    "{",
    '  "findings": [{"kind": "oubli|designation|juridique|coherence", "severity": "bloquant|important|confort", "lineId": null, "title": "", "detail": "", "suggestion": ""}],',
    '  "summary": "une phrase sur l etat general du devis",',
    '  "confidence": "high|medium|low"',
    "}",
  ].join("\n");
}

function extractOutputText(payload: unknown): string {
  const data = payload as Record<string, any> | null;
  if (!data) return "";
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    for (const part of item?.content ?? []) {
      if (typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n");
}

function parseJsonPayload(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalize(parsed: Record<string, unknown>, knownLineIds: Set<string>) {
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  return {
    findings: findings.slice(0, 40).map((finding: any) => {
      const lineId = text(finding?.lineId);
      return {
        kind: KINDS.has(text(finding?.kind)) ? text(finding?.kind) : "coherence",
        severity: SEVERITIES.has(text(finding?.severity)) ? text(finding?.severity) : "important",
        // Un identifiant de ligne invente n'accrocherait rien a l'ecran.
        lineId: knownLineIds.has(lineId) ? lineId : null,
        title: text(finding?.title) || "Point a verifier",
        detail: text(finding?.detail),
        suggestion: text(finding?.suggestion),
      };
    }),
    summary: text(parsed.summary),
    confidence: ["high", "medium", "low"].includes(String(parsed.confidence)) ? String(parsed.confidence) : "medium",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const lines = Array.isArray(body?.lines) ? body.lines : [];
  if (!lines.length) return json({ error: "Devis vide : rien a relire." }, 400);

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) return json({ error: "OPENAI_API_KEY manquante." }, 500);

  const payload = {
    today: new Date().toISOString().slice(0, 10),
    project: body?.project ?? null,
    totals: body?.totals ?? null,
    settings: body?.settings ?? null,
    terms: body?.terms ?? null,
    lines: lines.slice(0, 400),
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_QUOTE_REVIEW_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: buildPrompt(),
      input: [{ role: "user", content: JSON.stringify(payload).slice(0, 160000) }],
      temperature: 0.2,
      max_output_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return json({ error: "OpenAI request failed", detail: detail.slice(0, 400) }, 502);
  }

  const parsed = parseJsonPayload(extractOutputText(await response.json()));
  if (!parsed) return json({ error: "Reponse IA non structuree." }, 502);

  const knownLineIds = new Set<string>(lines.map((line: any) => String(line?.id ?? "")).filter(Boolean));
  return json({ result: normalize(parsed, knownLineIds) });
});
