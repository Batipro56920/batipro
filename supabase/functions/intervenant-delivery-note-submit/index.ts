import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPEN_PO_STATUSES = new Set(["sent", "confirmed", "partially_delivered"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name) ?? "";
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

type SubmittedLine = { designation: string; quantity: number; unit: string; product_id: string | null };

function normalizeLines(raw: unknown): SubmittedLine[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item: any) => ({
      designation: normalizeString(item?.designation).slice(0, 200),
      quantity: Number(item?.quantity),
      unit: normalizeString(item?.unit).slice(0, 20) || "u",
      product_id: normalizeString(item?.product_id) || null,
    }))
    .filter((line) => line.designation && Number.isFinite(line.quantity) && line.quantity > 0)
    .slice(0, 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const token = normalizeString(body.token);
    const chantierId = normalizeString(body.chantier_id);
    const storagePath = normalizeString(body.storage_path) || null;
    const storageBucket = normalizeString(body.storage_bucket) || null;
    const lines = normalizeLines(body.lines);

    if (!token) return json({ error: "auth required" }, 400);
    if (!chantierId) return json({ error: "chantier_id required" }, 400);

    const { data: intervenantIdRaw, error: accessError } = await admin.rpc("_intervenant_assert_chantier_access", {
      p_token: token,
      p_chantier_id: chantierId,
    });
    if (accessError) return json({ error: accessError.message || "forbidden" }, 403);
    const intervenantId = normalizeString(intervenantIdRaw);
    if (!intervenantId) return json({ error: "intervenant_required" }, 403);

    const resolvedLines = lines.filter((line) => line.product_id);

    for (const line of resolvedLines) {
      const { error: movementError } = await admin.from("product_stock_movements").insert({
        product_id: line.product_id,
        movement_type: "entree",
        quantity: line.quantity,
        source: "declaration_terrain",
        chantier_id: chantierId,
        intervenant_id: intervenantId,
        note: "Bon de livraison (portail ouvrier)",
      });
      if (movementError) return json({ error: movementError.message }, 400);
    }

    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "ADMIN")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const organizationId = adminProfile?.id ? String(adminProfile.id) : null;

    const { data: openOrders } = await admin
      .from("purchase_orders")
      .select("id, document, status")
      .eq("chantier_id", chantierId)
      .in("status", Array.from(OPEN_PO_STATUSES))
      .order("created_at", { ascending: false });

    let matchedOrderId: string | null = null;
    const candidates = openOrders ?? [];
    if (candidates.length === 1) {
      matchedOrderId = String(candidates[0].id);
    } else if (candidates.length > 1) {
      const designations = resolvedLines.map((line) => normalizeName(line.designation)).filter(Boolean);
      let bestId: string | null = null;
      let bestScore = 0;
      for (const order of candidates) {
        const documentText = normalizeName(JSON.stringify(order.document ?? {}));
        const score = designations.filter((designation) => designation && documentText.includes(designation)).length;
        if (score > bestScore) {
          bestScore = score;
          bestId = String(order.id);
        }
      }
      matchedOrderId = bestScore > 0 ? bestId : null;
    }

    const status = matchedOrderId ? "matched" : "unmatched";
    if (matchedOrderId) {
      const { error: statusError } = await admin
        .from("purchase_orders")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("id", matchedOrderId);
      if (statusError) return json({ error: statusError.message }, 400);
    }

    let deliveryNoteId: string | null = null;
    if (organizationId) {
      const { data: inserted, error: insertError } = await admin
        .from("delivery_notes")
        .insert({
          organization_id: organizationId,
          supplier_id: null,
          supplier_name: null,
          document_reference: null,
          purchase_order_id: matchedOrderId,
          chantier_id: chantierId,
          status,
          lines: resolvedLines,
          storage_path: storagePath,
          storage_bucket: storageBucket,
        })
        .select("id")
        .single();
      if (insertError) return json({ error: insertError.message }, 400);
      deliveryNoteId = inserted?.id ? String(inserted.id) : null;
    }

    return json({ delivery_note_id: deliveryNoteId, purchase_order_id: matchedOrderId, status, lines_posted: resolvedLines.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
