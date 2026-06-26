import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, Loader2, X } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import {
  intervenantDailyChecklistGet,
  intervenantDailyChecklistUpsert,
  type IntervenantDailyChecklist,
} from "../services/intervenantPortal.service";
import {
  AUTH_SESSION_PORTAL_TOKEN,
  extractIntervenantToken,
  INTERVENANT_CHANTIER_STORAGE_EVENT,
  readStoredIntervenantChantierId,
  readStoredIntervenantToken,
} from "../utils/intervenantSession";

type ChecklistKey =
  | "photos_taken"
  | "tasks_reported"
  | "time_logged"
  | "has_equipment"
  | "has_materials"
  | "has_information";

type ChecklistItem = {
  key: ChecklistKey;
  label: string;
  detail: string;
};

type ChecklistPayload = {
  chantier_id?: string | null;
  checklist_date: string;
  photos_taken?: boolean | null;
  tasks_reported?: boolean | null;
  time_logged?: boolean | null;
  has_equipment?: boolean | null;
  has_materials?: boolean | null;
  has_information?: boolean | null;
  validate?: boolean;
};

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: "photos_taken", label: "Photos prises", detail: "Photos utiles ajoutees au chantier ou a la tache." },
  { key: "tasks_reported", label: "Taches remontees", detail: "Avancement, blocage ou remarque signales si necessaire." },
  { key: "time_logged", label: "Temps saisi", detail: "Heures du jour enregistrees sur les taches concernees." },
  { key: "has_equipment", label: "Materiel OK", detail: "Outillage disponible pour avancer sans blocage." },
  { key: "has_materials", label: "Materiaux OK", detail: "Materiaux presents ou manque signale a l'admin." },
  { key: "has_information", label: "Infos OK", detail: "Plans, consignes et reponses utiles consultes." },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function checkedValue(checklist: IntervenantDailyChecklist | null, key: ChecklistKey) {
  return checklist?.[key] === true;
}

function errorMessage(error: unknown, fallback: string) {
  return String((error as { message?: string } | null)?.message ?? fallback).trim() || fallback;
}

function currentStoredChantierId() {
  return readStoredIntervenantChantierId() || null;
}

export default function EmployeeDailyChecklistWidget() {
  const { search } = useLocation();
  const checklistDate = useMemo(() => todayIso(), []);
  const [token, setToken] = useState("");
  const [chantierId, setChantierId] = useState<string | null>(() => currentStoredChantierId());
  const [checklist, setChecklist] = useState<IntervenantDailyChecklist | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<ChecklistKey | "validate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function syncChantierId() {
      setChantierId(currentStoredChantierId());
    }

    syncChantierId();
    window.addEventListener(INTERVENANT_CHANTIER_STORAGE_EVENT, syncChantierId);
    window.addEventListener("storage", syncChantierId);
    return () => {
      window.removeEventListener(INTERVENANT_CHANTIER_STORAGE_EVENT, syncChantierId);
      window.removeEventListener("storage", syncChantierId);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function resolveToken() {
      const queryToken = new URLSearchParams(search).get("token")?.trim() ?? "";
      const legacyToken = extractIntervenantToken(queryToken || readStoredIntervenantToken());
      if (legacyToken) {
        if (alive) setToken(legacyToken);
        return;
      }

      const sessionResult = await supabase.auth.getSession();
      if (!alive) return;
      setToken(sessionResult.data.session?.user ? AUTH_SESSION_PORTAL_TOKEN : "");
    }

    void resolveToken();
    return () => {
      alive = false;
    };
  }, [search]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    async function loadChecklist() {
      setLoading(true);
      setError(null);
      try {
        const data = await intervenantDailyChecklistGet(token, checklistDate);
        if (alive) {
          setChecklist({
            ...data,
            chantier_id: data.chantier_id ?? chantierId,
          });
        }
      } catch (loadError) {
        if (alive) setError(errorMessage(loadError, "Checklist jour indisponible."));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadChecklist();
    return () => {
      alive = false;
    };
  }, [checklistDate, chantierId, token]);

  if (!token) return null;

  const completed = CHECKLIST_ITEMS.filter((item) => checkedValue(checklist, item.key)).length;
  const total = CHECKLIST_ITEMS.length;
  const validated = Boolean(checklist?.validated_at);
  const payloadChantierId = chantierId ?? checklist?.chantier_id ?? null;

  async function saveValue(key: ChecklistKey, value: boolean) {
    if (!token) return;
    const activeChantierId = currentStoredChantierId() ?? payloadChantierId;
    setChantierId(activeChantierId);
    const previous = checklist;
    const optimistic = {
      ...(checklist ?? { checklist_date: checklistDate }),
      chantier_id: activeChantierId,
      [key]: value,
    } as IntervenantDailyChecklist;
    setChecklist(optimistic);
    setSavingKey(key);
    setError(null);
    try {
      const next = await intervenantDailyChecklistUpsert(token, {
        chantier_id: activeChantierId,
        checklist_date: checklistDate,
        [key]: value,
      });
      setChecklist(next);
    } catch (saveError) {
      setChecklist(previous);
      setError(errorMessage(saveError, "Enregistrement checklist impossible."));
    } finally {
      setSavingKey(null);
    }
  }

  async function validateDay() {
    if (!token) return;
    const activeChantierId = currentStoredChantierId() ?? payloadChantierId;
    setChantierId(activeChantierId);
    setSavingKey("validate");
    setError(null);
    try {
      const payload: ChecklistPayload = {
        chantier_id: activeChantierId,
        checklist_date: checklistDate,
        validate: true,
      };
      CHECKLIST_ITEMS.forEach((item) => {
        payload[item.key] = checkedValue(checklist, item.key);
      });
      const next = await intervenantDailyChecklistUpsert(token, payload);
      setChecklist(next);
    } catch (saveError) {
      setError(errorMessage(saveError, "Validation journee impossible."));
    } finally {
      setSavingKey(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-[45] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_12px_40px_rgba(15,23,42,0.18)]"
        aria-label="Ouvrir la checklist jour"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-blue-700" /> : <ClipboardCheck className="h-4 w-4 text-blue-700" />}
        <span>Checklist jour</span>
        <span className={validated ? "text-emerald-700" : "text-slate-500"}>{completed}/{total}</span>
      </button>
    );
  }

  return (
    <section className="fixed inset-x-4 bottom-24 z-[45] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-[0_20px_70px_rgba(15,23,42,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-blue-700">
            <ClipboardCheck className="h-4 w-4" /> Journee terrain
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Checklist du jour</h2>
          <p className="mt-1 text-sm text-slate-500">{validated ? "Journee validee." : `${completed}/${total} points controles.`}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500"
          aria-label="Fermer la checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div> : null}

      <div className="mt-4 space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const checked = checkedValue(checklist, item.key);
          const saving = savingKey === item.key;
          return (
            <label key={item.key} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                type="checkbox"
                checked={checked}
                disabled={Boolean(savingKey)}
                onChange={(event) => void saveValue(item.key, event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-200"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  {item.label}
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" /> : null}
                </span>
                <span className="mt-1 block text-xs text-slate-500">{item.detail}</span>
              </span>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void validateDay()}
        disabled={savingKey !== null || loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {savingKey === "validate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Valider la journee
      </button>
    </section>
  );
}