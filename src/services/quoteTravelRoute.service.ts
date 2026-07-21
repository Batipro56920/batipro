import { supabase } from "../lib/supabaseClient";

export type QuoteTravelRouteRequest = {
  originAddress: string;
  destinationAddress: string;
  includeTolls?: boolean;
};

export type QuoteTravelRouteResult = {
  provider: "google_routes";
  oneWayDistanceKm: number;
  oneWayDurationMinutes: number;
  tollsPerRoundTripHt: number;
  tollsCurrency: string | null;
  rawTollsEstimate: number | null;
};

export async function calculateQuoteTravelRoute(input: QuoteTravelRouteRequest): Promise<QuoteTravelRouteResult> {
  const { data, error } = await supabase.functions.invoke("quote-travel-route", {
    body: input,
  });

  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") throw new Error("Calcul trajet impossible.");
  const payload = data as Partial<QuoteTravelRouteResult> & { error?: string };
  if (payload.error) throw new Error(payload.error);

  return {
    provider: "google_routes",
    oneWayDistanceKm: Number(payload.oneWayDistanceKm ?? 0) || 0,
    oneWayDurationMinutes: Number(payload.oneWayDurationMinutes ?? 0) || 0,
    tollsPerRoundTripHt: Number(payload.tollsPerRoundTripHt ?? 0) || 0,
    tollsCurrency: payload.tollsCurrency ?? null,
    rawTollsEstimate: payload.rawTollsEstimate ?? null,
  };
}
