import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import {
  intervenantGetChantiers,
  intervenantGetTasks,
  intervenantTerrainFeedbackCreate,
  intervenantTimeCreate,
} from "../services/intervenantPortal.service";
import {
  AUTH_SESSION_PORTAL_TOKEN,
  extractIntervenantToken,
  persistIntervenantChantierId,
  readStoredIntervenantChantierId,
  readStoredIntervenantToken,
} from "../utils/intervenantSession";

type CleanlinessLevel = "propre" | "attention" | "a_nettoyer";
type SimpleChantier = { id: string; nom: string };
type SimpleTask = { id: string; titre: string; status?: string | null; quality_status?: string | null };

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

function isTaskOpen(task: SimpleTask) {
  const status = String(task.status ?? "").toUpperCase();
  return !["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(status) && !["termine_intervenant", "valide_admin"].includes(String(task.quality_status ?? ""));
}

function cleanlinessLabel(value: CleanlinessLevel) {
  if (value === "propre") return "Chantier propre";
  if (value === "attention") return "A surveiller";
  return "A nettoyer";
}

export default function EmployeeFieldDataWidget() {
  const { search } = useLocation();
  const [token, setToken] = useState("");
  const [chantiers, setChantiers] = useState<SimpleChantier[]>([]);
  const [tasks, setTasks] = useState<SimpleTask[]>([]);
  const [chantierId, setChantierId] = useState(readStoredIntervenantChantierId());
  const [taskId, setTaskId] = useState("");
  const [hours, setHours] = useState("");
  const [progress, setProgress] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [cleanliness, setCleanliness] = useState<CleanlinessLevel>("propre");
  const [cleanlinessNote, setCleanlinessNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const nextRows = rows.map((row) => ({ id: row.id, nom: row.nom }));
        const stored = readStoredIntervenantChantierId();
        const nextChantierId = (stored && nextRows.some((row) => row.id === stored) ? stored : "") || nextRows[0]?.id || "";
        setChantiers(nextRows);
        setChantierId(nextChantierId);
        if (nextChantierId) persistIntervenantChantierId(nextChantierId);
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
    if (!token || !chantierId) return;
    let alive = true;

    async function loadTasks() {
      setLoading(true);
      setError(null);
      try {
        const rows = await intervenantGetTasks(token, chantierId);
        if (!alive) return;
        const nextRows = rows.map((row) => ({ id: row.id, titre: row.titre, status: row.status, quality_status: row.quality_status }));
        const preferredRows = nextRows.filter(isTaskOpen);
        const selectableRows = preferredRows.length ? preferredRows : nextRows;
        setTasks(selectableRows);
        setTaskId((current) => (current && selectableRows.some((task) => task.id === current) ? current : selectableRows[0]?.id || ""));
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

  function changeChantier(nextChantierId: string) {
    setChantierId(nextChantierId);
    setTaskId("");
    if (nextChantierId) persistIntervenantChantierId(nextChantierId);
  }

  async function submitTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const durationHours = parsePositiveNumber(hours);
    const progressPercent = parseProgress(progress);
    if (!token || !chantierId || !taskId) {
      setError("Selectionne un chantier et une tache.");
      return;
    }
    if (durationHours === null) {
      setError("Saisis un temps valide, par exemple 1,5.");
      return;
    }
    if (progress.trim() && progressPercent === null) {
      setError("Saisis un avancement entre 0 et 100.");
      return;
    }

    setSaving(true);
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
      setSaving(false);
    }
  }

  async function submitCleanliness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!token || !chantierId) {
      setError("Selectionne un chantier.");
      return;
    }

    const label = cleanlinessLabel(cleanliness);
    setSaving(true);
    try {
      await intervenantTerrainFeedbackCreate(token, {
        chantier_id: chantierId,
        category: "organisation",
        urgency: cleanliness === "a_nettoyer" ? "urgente" : "normale",
        title: `Proprete chantier - ${label}`,
        description: cleanlinessNote.trim() || label,
      });
      setCleanliness("propre");
      setCleanlinessNote("");
      setMessage("Proprete chantier remontee a l'admin.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Enregistrement proprete impossible."));
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <section className="mx-auto my-4 max-w-5xl px-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.04)] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase text-blue-700">Donnees terrain</div>
            <h2 className="mt-1 text-base font-semibold text-slate-950">Temps, avancement et proprete</h2>
          </div>
          {loading ? <span className="text-xs font-semibold text-blue-700">Chargement...</span> : null}
        </div>

        {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <form className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={submitTime}>
            <div className="text-sm font-semibold text-slate-950">Saisie temps et avancement</div>
            <select className={inputClass} value={chantierId} onChange={(event) => changeChantier(event.target.value)}>
              {chantiers.map((chantier) => <option key={chantier.id} value={chantier.id}>{chantier.nom}</option>)}
            </select>
            <select className={inputClass} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="Temps ex : 1,5" />
              <input className={inputClass} inputMode="numeric" value={progress} onChange={(event) => setProgress(event.target.value)} placeholder="Avancement %" />
            </div>
            <textarea className={inputClass} value={timeNote} onChange={(event) => setTimeNote(event.target.value)} rows={2} placeholder="Note optionnelle" />
            <button className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={saving || !taskId}>
              Enregistrer
            </button>
          </form>

          <form className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={submitCleanliness}>
            <div className="text-sm font-semibold text-slate-950">Proprete chantier</div>
            <select className={inputClass} value={cleanliness} onChange={(event) => setCleanliness(event.target.value as CleanlinessLevel)}>
              <option value="propre">Chantier propre</option>
              <option value="attention">A surveiller</option>
              <option value="a_nettoyer">A nettoyer</option>
            </select>
            <textarea className={inputClass} value={cleanlinessNote} onChange={(event) => setCleanlinessNote(event.target.value)} rows={4} placeholder="Zone concernee, remarque ou action attendue" />
            <button className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={saving || !chantierId}>
              Remonter a l'admin
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
