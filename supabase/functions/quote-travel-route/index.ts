import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RouteBody = {
  originAddress?: string;
  destinationAddress?: string;
  includeTolls?: boolean;
};

type GoogleMoney = {
  currencyCode?: string;
  units?: string | number;
  nanos?: number;
};

type GoogleRouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    travelAdvisory?: {
      tollInfo?: {
        estimatedPrice?: GoogleMoney[];
      };
    };
  }>;
  error?: { message?: string };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function requireEnv(name: string) {
  const value = normalizeString(Deno.env.get(name));
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optionalEnv(name: string) {
  return normalizeString(Deno.env.get(name));
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function assertAuthenticated(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Authentification requise.");

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) throw new Error("Session invalide.");
  return data.user;
}

function parseGoogleDurationSeconds(value: unknown) {
  const raw = normalizeString(value);
  const match = raw.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) || 0 : 0;
}

function moneyToNumber(value: GoogleMoney) {
  const units = Number(value.units ?? 0) || 0;
  const nanos = Number(value.nanos ?? 0) || 0;
  return units + nanos / 1_000_000_000;
}

function readTollsEstimate(route: NonNullable<GoogleRouteResponse["routes"]>[number]) {
  const prices = route.travelAdvisory?.tollInfo?.estimatedPrice ?? [];
  if (!prices.length) return { amount: 0, currency: null as string | null };
  const currency = prices[0]?.currencyCode ?? null;
  const amount = prices.reduce((sum, item) => sum + moneyToNumber(item), 0);
  return { amount, currency };
}

async function calculateWithGoogleRoutes(body: RouteBody) {
  const apiKey = requireEnv("GOOGLE_MAPS_API_KEY");
  const originAddress = normalizeString(body.originAddress);
  const destinationAddress = normalizeString(body.destinationAddress);
  if (!originAddress) throw new Error("Adresse siège manquante.");
  if (!destinationAddress) throw new Error("Adresse chantier manquante.");

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo",
    },
    body: JSON.stringify({
      origin: { address: originAddress },
      destination: { address: destinationAddress },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
      extraComputations: body.includeTolls === false ? [] : ["TOLLS"],
      routeModifiers: {
        avoidTolls: false,
        vehicleInfo: { emissionType: "GASOLINE" },
      },
      languageCode: "fr-FR",
      units: "METRIC",
    }),
  });

  const payload = await response.json().catch(() => ({})) as GoogleRouteResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Google Routes API erreur ${response.status}`);
  }

  const route = payload.routes?.[0];
  if (!route) throw new Error("Aucun trajet trouvé.");

  const distanceMeters = Number(route.distanceMeters ?? 0) || 0;
  const durationSeconds = parseGoogleDurationSeconds(route.duration);
  const tolls = readTollsEstimate(route);

  return {
    provider: "google_routes" as const,
    oneWayDistanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
    oneWayDurationMinutes: Math.round((durationSeconds / 60) * 10) / 10,
    tollsPerRoundTripHt: Math.round(tolls.amount * 2 * 100) / 100,
    tollsCurrency: tolls.currency,
    rawTollsEstimate: tolls.amount ? Math.round(tolls.amount * 100) / 100 : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non supportée." }, 405);

  try {
    await assertAuthenticated(req);
    const provider = optionalEnv("BATIPRO_MAPS_PROVIDER") || "google_routes";
    if (provider !== "google_routes") {
      return json({ error: "Fournisseur cartographie non supporté." }, 400);
    }
    const body = await req.json().catch(() => ({})) as RouteBody;
    return json(await calculateWithGoogleRoutes(body));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calcul trajet impossible.";
    console.error("quote-travel-route failed", { message });
    return json({ error: message }, 400);
  }
});
