import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type PlanningLotRow = {
  chantier_id: string | null;
  lot: string;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
};

const STORAGE_KEY = "batipro_intervenant_token";
let memoryToken = "";

function getSafeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    const probeKey = "__batipro_intervenant_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function readStoredToken(): string {
  const storage = getSafeStorage();
  if (!storage) return memoryToken;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return String(raw ?? "").trim();
  } catch {
    return memoryToken;
  }
}

function persistToken(token: string) {
  memoryToken = String(token ?? "").trim();
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, memoryToken);
  } catch {
    // Ignore storage failures on restricted browsers (iOS private mode, in-app webviews).
  }
}

function clearStoredToken() {
  memoryToken = "";
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures on restricted browsers (iOS private mode, in-app webviews).
  }
}

function normalizeDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeLot(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "A classer";
}

function normalizeOrderIndex(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function extractRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object");
  }
  if (data && typeof data === "object") {
    return [data as Record<string, unknown>];
  }
  return [];
}

function mapPlanningLots(data: unknown): PlanningLotRow[] {
  const rows = extractRows(data);
  const byLot = new Map<string, PlanningLotRow>();

  for (const row of rows) {
    const lot = normalizeLot(row.lot ?? row.lot_name ?? row.corps_etat);
    const startDate = normalizeDate(row.start_date ?? row.planning_start_date ?? row.date_debut);
    const endDate = normalizeDate(row.end_date ?? row.planning_end_date ?? row.date_fin);
    const orderIndex = normalizeOrderIndex(row.order_index);
    const chantierId = String(row.chantier_id ?? "").trim() || null;

    const current = byLot.get(lot);
    if (!current) {
      byLot.set(lot, {
        chantier_id: chantierId,
        lot,
        start_date: startDate,
        end_date: endDate,
        order_index: orderIndex,
      });
      continue;
    }

    const nextStart =
      current.start_date && startDate
        ? current.start_date <= startDate
          ? current.start_date
          : startDate
        : current.start_date ?? startDate;

    const nextEnd =
      current.end_date && endDate
        ? current.end_date >= endDate
          ? current.end_date
          : endDate
        : current.end_date ?? endDate;

    byLot.set(lot, {
      chantier_id: current.chantier_id ?? chantierId,
      lot,
      start_date: nextStart,
      end_date: nextEnd,
      order_index: Math.min(current.order_index, orderIndex),
    });
  }

  return [...byLot.values()].sort((a, b) => {
    const orderDiff = a.order_index - b.order_index;
    if (orderDiff !== 0) return orderDiff;
    return a.lot.localeCompare(b.lot, "fr");
  });
}

function isInvalidTokenError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return msg.includes("invalid_or_expired_token") || msg.includes("invalid") || msg.includes("expire");
}

function formatDateFr(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR");
}

export default function IntervenantPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const queryToken = useMemo(() => new URLSearchParams(location.search).get("token")?.trim() ?? "", [location.search]);

  const [token, setToken] = useState<string>("");
  const [chantierId, setChantierId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [lots, setLots] = useState<PlanningLotRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadPlanning() {
      setLoading(true);
      setError(null);
      setInvalidToken(false);

      const candidateToken = queryToken || readStoredToken();
      if (!candidateToken) {
        if (!alive) return;
        setToken("");
        setLots([]);
        setChantierId(null);
        setInvalidToken(true);
        setLoading(false);
        return;
      }

      setToken(candidateToken);
      persistToken(candidateToken);

      const { data, error: rpcError } = await (supabase as any).rpc("intervenant_get_planning", {
        p_token: candidateToken,
      });

      if (!alive) return;

      if (rpcError) {
        if (isInvalidTokenError(rpcError)) {
          setInvalidToken(true);
          setError(null);
          setLots([]);
          setChantierId(null);
        } else {
          setInvalidToken(false);
          setError(rpcError.message ?? "Erreur de chargement du planning.");
          setLots([]);
          setChantierId(null);
        }
        setLoading(false);
        return;
      }

      const nextLots = mapPlanningLots(data);
      const nextChantierId = nextLots.find((row) => row.chantier_id)?.chantier_id ?? null;

      setLots(nextLots);
      setChantierId(nextChantierId);
      setLoading(false);
    }

    void loadPlanning();
    return () => {
      alive = false;
    };
  }, [queryToken]);

  function logoutIntervenant() {
    clearStoredToken();
    setToken("");
    setLots([]);
    setChantierId(null);
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Chargement de l acces intervenant...</div>
      </div>
    );
  }

  if (invalidToken || !token) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Lien invalide ou expire</h1>
          <p className="mt-2 text-sm text-red-700">Demande un nouveau lien a ton administrateur Batipro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Planning intervenant</h1>
          <p className="mt-1 text-sm text-slate-500">Chantier: {chantierId ?? "-"}</p>
        </div>
        <button
          type="button"
          onClick={logoutIntervenant}
          className="rounded-xl border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Deconnexion intervenant
        </button>
      </div>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-900">Lots planifies</h2>
          <p className="text-xs text-slate-500">Lecture seule depuis le lien intervenant.</p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {!error && lots.length === 0 && (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Aucun lot planifie.</div>
        )}

        {!error && lots.length > 0 && (
          <div className="space-y-2">
            {lots.map((row) => (
              <div key={row.lot} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-900">{row.lot}</div>
                  <div className="text-xs text-slate-500">Ordre: {row.order_index}</div>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Debut: {formatDateFr(row.start_date)} | Fin: {formatDateFr(row.end_date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
