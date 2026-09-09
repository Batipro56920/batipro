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

function multiline(value: unknown): string {
  return String(value ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean).slice(0, 40);
}

const UNITS = new Set(["u", "ml", "m2", "m3", "h"]);

function unit(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase().replace("²", "2").replace("³", "3");
  return UNITS.has(raw) ? raw : "u";
}

/**
 * La regle qui compte : ce qui concerne un ouvrage reste sur l'ouvrage. Un
 * compte rendu de rendez-vous melange tout, et deverser ces phrases dans
 * l'onglet Contraintes du chantier le rend illisible sans rien apporter a
 * l'ouvrier qui executera la tache.
 */
function buildPrompt(): string {
  return [
    "Tu es Coco, l'assistant metier de Batipro, un ERP de batiment.",
    "Tu recois le compte rendu d'un rendez-vous client (dicte puis transcrit) et tu remplis une fiche de visite terrain comme le ferait un conducteur de travaux experimente.",
    "Tu reponds uniquement en JSON valide, sans texte autour, sans balises de code.",
    "",
    "REGLE PRINCIPALE, LA PLUS IMPORTANTE :",
    "Une information qui porte sur UN ouvrage precis appartient a cet ouvrage, jamais aux champs generaux du chantier.",
    "- \"le mur du fond est en pierre, il faudra du scellement chimique\" -> constraints DE LA TACHE de ce mur.",
    "- \"la dalle doit secher trois semaines avant le carrelage\" -> constraints DE LA TACHE carrelage.",
    "- \"plafond a 2m10 dans le couloir\" -> constraints de la tache concernee si elle existe, sinon zones.",
    "En revanche, ce qui vaut pour TOUT le chantier va dans l'objet constraints :",
    "acces, stationnement, etage, copropriete, horaires autorises, nuisances, securite du site,",
    "evacuation des gravats, point d'eau, alimentation electrique, autorisations administratives.",
    "Si tu hesites : demande-toi si l'information resterait vraie en supprimant la tache. Si non, elle appartient a la tache.",
    "Ne repete jamais la meme information a deux endroits.",
    "",
    "SECTIONS ET TACHES :",
    "Regroupe les ouvrages en sections qui suivent le deroule du chantier ou les pieces (exemple : Demolition, Salle de bain, Exterieur).",
    "Une tache est un ouvrage chiffrable. Titre court et technique, pas une phrase du client.",
    "Quantites : ne les invente pas. Si le compte rendu donne des dimensions, remplis length, width, height et laisse quantity a null.",
    "Si aucune dimension n'est donnee, laisse tout a null : le metreur completera sur place.",
    "estimatedHours et priceHintHt seulement si le compte rendu les mentionne, sinon null.",
    "technicalNotes : le geste technique, le materiau, la mise en oeuvre decrite pendant le rendez-vous.",
    "constraints : ce qui complique CETTE tache (acces a l'ouvrage, ordre d'intervention, sechage, existant a deposer, reprise).",
    "",
    "RATTACHEMENT A LA BIBLIOTHEQUE :",
    "taskLibrary contient les modeles de taches de l'entreprise. Si une tache correspond clairement a un modele,",
    "mets son id dans taskTemplateId et son titre exact dans taskTemplateLabel.",
    "En cas de doute, laisse taskTemplateId a null : un mauvais rattachement coute plus cher qu'un rattachement manquant.",
    "",
    "CE QUI EXISTE DEJA :",
    "currentDraft contient ce que l'utilisateur a deja saisi. Ne le reecris pas et ne le contredis pas.",
    "Ne propose une valeur que si le compte rendu apporte une information nouvelle ou plus precise.",
    "Pour completer un champ deja rempli, renvoie le texte complet fusionne, pas seulement l'ajout.",
    "",
    "BUDGET ET DECISION : budgetKnown est un montant ou une phrase courte, budgetRange une fourchette,",
    "priceSensitivity la sensibilite au prix, decisionMaker qui decide, decisionOnSite si la decision se prend sur place,",
    "objections les freins exprimes par le client.",
    "",
    "Ce que tu ne sais pas placer va dans unassigned, en clair, pour que l'utilisateur tranche.",
    "N'invente aucune information absente du compte rendu.",
    "",
    "Format attendu :",
    "{",
    '  "project": {"clientObjective": "", "needDescription": "", "zones": "", "urgency": "", "desiredDeadline": ""},',
    '  "sections": [{"title": "", "tasks": [{"title": "", "unit": "u|ml|m2|m3|h", "quantity": null, "length": null, "width": null, "height": null, "estimatedHours": null, "priceHintHt": null, "technicalNotes": "", "constraints": "", "taskTemplateId": null, "taskTemplateLabel": null}]}],',
    '  "constraints": {"access": "", "parking": "", "floor": "", "condominium": "", "schedule": "", "nuisance": "", "safety": "", "waste": "", "water": "", "electricity": "", "authorizations": "", "notes": ""},',
    '  "budget": {"budgetKnown": "", "budgetRange": "", "priceSensitivity": "", "decisionMaker": "", "decisionOnSite": "", "objections": ""},',
    '  "followUp": {"nextAction": "", "followUpDate": ""},',
    '  "unassigned": [],',
    '  "confidence": "high|medium|low"',
    "}",
    "Les dates sont au format AAAA-MM-JJ ou vides.",
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

function normalize(parsed: Record<string, unknown>, allowedTemplateIds: Set<string>) {
  const project = (parsed.project ?? {}) as Record<string, unknown>;
  const constraints = (parsed.constraints ?? {}) as Record<string, unknown>;
  const budget = (parsed.budget ?? {}) as Record<string, unknown>;
  const followUp = (parsed.followUp ?? {}) as Record<string, unknown>;
  const sections = Array.isArray(parsed.sections) ? parsed.sections : [];

  return {
    project: {
      clientObjective: multiline(project.clientObjective),
      needDescription: multiline(project.needDescription),
      zones: text(project.zones),
      urgency: text(project.urgency),
      desiredDeadline: text(project.desiredDeadline),
    },
    sections: sections.slice(0, 30).map((section: any) => ({
      title: text(section?.title) || "Section",
      tasks: (Array.isArray(section?.tasks) ? section.tasks : []).slice(0, 40).map((task: any) => ({
        title: text(task?.title) || "Prestation",
        unit: unit(task?.unit),
        quantity: numberOrNull(task?.quantity),
        length: numberOrNull(task?.length),
        width: numberOrNull(task?.width),
        height: numberOrNull(task?.height),
        estimatedHours: numberOrNull(task?.estimatedHours),
        priceHintHt: numberOrNull(task?.priceHintHt),
        technicalNotes: multiline(task?.technicalNotes),
        constraints: multiline(task?.constraints),
        // Un id absent de la bibliotheque casserait la cle etrangere a l'enregistrement.
        taskTemplateId: allowedTemplateIds.has(text(task?.taskTemplateId)) ? text(task?.taskTemplateId) : null,
        taskTemplateLabel: allowedTemplateIds.has(text(task?.taskTemplateId)) ? (text(task?.taskTemplateLabel) || null) : null,
      })),
    })),
    constraints: {
      access: multiline(constraints.access),
      parking: multiline(constraints.parking),
      floor: multiline(constraints.floor),
      condominium: multiline(constraints.condominium),
      schedule: multiline(constraints.schedule),
      nuisance: multiline(constraints.nuisance),
      safety: multiline(constraints.safety),
      waste: multiline(constraints.waste),
      water: multiline(constraints.water),
      electricity: multiline(constraints.electricity),
      authorizations: multiline(constraints.authorizations),
      notes: multiline(constraints.notes),
    },
    budget: {
      budgetKnown: text(budget.budgetKnown),
      budgetRange: text(budget.budgetRange),
      priceSensitivity: text(budget.priceSensitivity),
      decisionMaker: text(budget.decisionMaker),
      decisionOnSite: text(budget.decisionOnSite),
      objections: multiline(budget.objections),
    },
    followUp: {
      nextAction: multiline(followUp.nextAction),
      followUpDate: text(followUp.followUpDate),
    },
    unassigned: stringArray(parsed.unassigned),
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

  const transcript = String(body?.transcript ?? "").trim();
  if (transcript.length < 40) return json({ error: "Compte rendu trop court pour etre exploite." }, 400);

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) return json({ error: "OPENAI_API_KEY manquante." }, 500);

  const payload = {
    transcript: transcript.slice(0, 120000),
    project: body?.project ?? null,
    currentDraft: body?.currentDraft ?? null,
    taskLibrary: Array.isArray(body?.taskLibrary) ? body.taskLibrary.slice(0, 400) : [],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_VISIT_IMPORT_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: buildPrompt(),
      input: [{ role: "user", content: JSON.stringify(payload).slice(0, 160000) }],
      temperature: 0.1,
      max_output_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return json({ error: "OpenAI request failed", detail: detail.slice(0, 400) }, 502);
  }

  const parsed = parseJsonPayload(extractOutputText(await response.json()));
  if (!parsed) return json({ error: "Reponse IA non structuree." }, 502);

  const allowedTemplateIds = new Set<string>(
    (payload.taskLibrary as Array<{ id?: unknown }>).map((row) => String(row?.id ?? "")).filter(Boolean),
  );
  return json({ result: normalize(parsed, allowedTemplateIds) });
});
