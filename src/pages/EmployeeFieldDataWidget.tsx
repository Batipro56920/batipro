import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Brush, CheckCircle2, Clock3, Loader2, RefreshCw, Send } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import {
  intervenantGetChantiers,
  intervenantGetTasks,
  intervenantTerrainFeedbackCreate,
  intervenantTimeCreate,
  type IntervenantChantier,
  type IntervenantTask,
} from "../services/intervenantPortal.service";
import {
  AUTH_SESSION_PORTAL_TOKEN,
  INTERVENANT_CHANTIER_STORAGE_EVENT,
  extractIntervenantToken,
  persistIntervenantChantierId,
  readStoredIntervenantChantierId,
  readStoredIntervenantToken,
} from "../utils/intervenantSession";

type CleanlinessLevel = "propre" | "attention" | "a_nettoyer";

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parsePositiveNumber(value: string) {
  const text = value.trim();
  if (!text || /[,.]$/.test(text) || /^-/.test(text)) return null;
  const normalized = text.includes(",")
    ? text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    : text.replace(/\s/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseProgress(value: string) {
  const text = value.trim();
  if (!text) return null;
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function errorMessage(error: unknown, fallback: string) {
  return String((error as { message?: string } | null)?.message ?? fallback).trim() || fallback;
}

function cleanlinessLabel(value: CleanlinessLevel) {
  if (value === "propre") return "Chantier propre";
  if (value === "attention") return "A surveiller";
  return "A nettoyer";
}

function cleanlinessUrgency(value: CleanlinessLevel) {
  if (value === "a_nettoyer") return "urgente";
  return "normale";
}

function currentStoredChantierId() {
  return readStoredIntervenantChantierId() || null;
}

export default function EmployeeFieldDataWidget() {
  const { search } = useLocation();
  const [token, setToken] = useState("");
  const [chantiers, setChantiers] = useState<IntervenantChantier[]>([]);
  const [chantierId, setChantierId] = useState<string | null>(() => currentStoredChantierId());
  const [tasks, setTasks] = useState<IntervenantTask[]>([]);
  const [taskId, setTaskId] = useState("");
  const [hours, setHours] = useState("");
  const [progress, setProgress] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [cleanliness, setCleanliness] = useState<CleanlinessLevel>("propre");
  const [cleanlinessNote, setCleanlinessNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"time" | "cleanliness" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedChantier = useMemo(() => chantiers.find((row) => row.id === chantierId) ?? null, [chantierId, chantiers]);
  const openTasks = useMemo(() => tasks.filter((task) => !["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(String(task.status ?? "").toUpperCase()) && !["termine_intervenant", "valide_admin"].includes(task.quality_status)), [tasks]);

  useEffect(() => {
    function syncChantierId() {
      setChantierId(currentStoredChantierId());
    }

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
      if (alive) setToken(sessionResult.data.session?.user ? AUTH_SESSION_PORTAL_TOKEN : "");
    }

    void resolveToken();
    return () => {
      alive = false;
    };
  }, [search]);

  useEffect(() => {
    if (!token) return;
    let alive = true;

    async function loadChantiers() {
      setLoading(true);
      setError(null);
      try {
        const rows = await intervenantGetChantiers(token);
        if (!alive) return;
        setChantiers(rows);
        const stored = currentStoredChantierId();
        const next = (stored && rows.some((row) => row.id === stored) ? stored : null) ?? rows[0]?.id ?? null;
        setChantierId(next);
        if (next) persistIntervenantChantierId(next);
      } catch (loadError) {
        if (alive) setError(errorMessage(loadError, "Chargement chantiers impossible."));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadChantiers();
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !chantierId) {
      setTasks([]);
      return;
    }
    let alive = true;

    async function loadTasks() {
      setLoading(true);
      setError(null);
      try {
        const rows = await intervenantGetTasks(token, chantierId);
        if (!alive) return;
        setTasks(rows);
        setTaskId((current) => (current && rows.some((task) => task.id === current) ? current : rows[0]?.id ?? ""));
      } catch (loadError) {
        if (alive) setError(errorMessage(loadError, "Chargement taches impossible."));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadTasks();
    return () => {
      alive = false;
    };
  }, [chantierId, token]);

  function changeChantier(next: string) {
    setChantierId(next || null);
    setTaskId("");
    if (next) persistIntervenantChantierId(next);
  }

  async function submitTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!token || !chantierId || !taskId) {
      setError("Selectionne un chantier et une tache.");
      return;
    }

    const durationHours = parsePositiveNumber(hours);
    if (durationHours === null) {
      setError("Saisis un temps valide, par exemple 1,5.");
      return;
    }

    const progressPercent = parseProgress(progress);
    if (progress.trim() && progressPercent === null) {
      setError("Saisis un avancement entre 0 et 100.");
      return;
    }

    setSaving("time");
    try {
      await intervenantTimeCreate(token, {
        chantier_id: chantierId,
        task_id: taskId,
        work_date: todayIso(),
        duration_hours: durationHours,
        progress_percent: progressPercent,
        note: timeNote.trim() || null,
      });
      setHours("");
      setProgress("");
      setTimeNote("");
      setMessage("Temps et avancement enregistres.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Enregistrement temps impossible."));
    } finally {
      setSaving(null);
    }
  }

  async function submitCleanliness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!token || !chantierId) {
      setError("Selectionne un chantier.");
      return;
    }

    const label = cleanlinessLabel(cleanliness);
    const details = cleanlinessNote.trim() || label;
    setSaving("cleanliness");
    try {
      await intervenantTerrainFeedbackCreate(token, {
        chantier_id: chantierId,
        category: "organisation",
        urgency: cleanlinessUrgency(cleanliness),
        title: `Proprete chantier - ${label}`,
        description: details,
      });
      setCleanliness("propre");
      setCleanlinessNote("");
      setMessage("Proprete chantier remontee a l'admin.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Enregistrement proprete impossible."));
    } finally {
      setSaving(null);
    }
  }

  if (!token) return null;

  return (
    <section className="mx-auto my-4 max-w-5xl space-y-3 px-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.04)] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase text-blue-700">Donnees terrain</div>
            <h2 className="mt-1 text-base font-semibold text-slate-950">Temps, avancement et proprete</h2>
          </div>
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-700" /> : <RefreshCw className="h-5 w-5 text-slate-400" />}
        </div>

        {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <form className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={submitTime}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Clock3 className="h-4 w-4 text-blue-700" />
              Saisie temps et avancement
            </div>
            <select className={inputClass} value={chantierId ?? ""} onChange={(event) => changeChantier(event.target.value)}>
              {chantiers.map((chantier) => <option key={chantier.id} value={chantier.id}>{chantier.nom}</option>)}
            </select>
            <select className={inputClass} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              {openTasks.length ? openTasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>) : tasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="Temps ex : 1,5" />
              <input className={inputClass} inputMode="numeric" value={progress} onChange={(event) => setProgress(event.target.value)} placeholder="Avancement %" />
            </div>
            <textarea className={inputClass} value={timeNote} onChange={(event) => setTimeNote(event.target.value)} rows={2} placeholder="Note optionnelle" />
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={saving !== null || !taskId}>
              {saving === "time" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enregistrer
            </button>
          </form>

          <form className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={submitCleanliness}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Brush className="h-4 w-4 text-blue-700" />
              Proprete chantier
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600">{selectedChantier?.nom ?? "Chantier non selectionne"}</div>
            <select className={inputClass} value={cleanliness} onChange={(event) => setCleanliness(event.target.value as CleanlinessLevel)}>
              <option value="propre">Chantier propre</option>
              <option value="attention">A surveiller</option>
              <option value="a_nettoyer">A nettoyer</option>
            </select>
            <textarea className={inputClass} value={cleanlinessNote} onChange={(event) => setCleanlinessNote(event.target.value)} rows={4} placeholder="Zone concernee, remarque ou action attendue" />
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={saving !== null || !chantierId}>
              {saving === "cleanliness" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Remonter a l'admin
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
