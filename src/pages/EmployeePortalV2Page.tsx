import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, FileText, Home, LogOut, MapPin, MessageCircle, PackageSearch, Phone, RefreshCw, Send, ShieldAlert, Wrench } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import {
  intervenantConsigneList,
  intervenantDailyChecklistGet,
  intervenantDailyChecklistUpsert,
  intervenantGetChantiers,
  intervenantGetDocuments,
  intervenantGetTasks,
  intervenantInformationRequestList,
  intervenantMaterielCreate,
  intervenantSession,
  intervenantTerrainFeedbackCreate,
  intervenantTerrainFeedbackList,
  intervenantTimeCreate,
  intervenantUpdateTaskStatus,
  type IntervenantChantier,
  type IntervenantConsigne,
  type IntervenantDailyChecklist,
  type IntervenantDocument,
  type IntervenantInformationRequest,
  type IntervenantTask,
  type IntervenantTerrainFeedback,
} from "../services/intervenantPortal.service";
import {
  AUTH_SESSION_PORTAL_TOKEN,
  clearStoredIntervenantSession,
  extractIntervenantToken,
  persistIntervenantToken,
  readStoredIntervenantToken,
} from "../utils/intervenantSession";

/**
 * A portal link generated from "Ouvrir portail" (admin preview / terrain access)
 * carries a bare `?token=` — it is never an authenticated Supabase session.
 * Resolve that token first, remember it for subsequent loads in this browser,
 * and only fall back to the logged-in session sentinel when no token is present
 * anywhere (the "real account, logged in with email/password" case).
 */
function resolvePortalToken(search: string): string {
  const fromUrl = extractIntervenantToken(search);
  if (fromUrl) {
    persistIntervenantToken(fromUrl);
    return fromUrl;
  }
  const stored = readStoredIntervenantToken();
  if (stored) return stored;
  return AUTH_SESSION_PORTAL_TOKEN;
}

type Tab = "accueil" | "chantier" | "renseigner" | "fil";

type SiteData = {
  tasks: IntervenantTask[];
  documents: IntervenantDocument[];
  consignes: IntervenantConsigne[];
  requests: IntervenantInformationRequest[];
  feedbacks: IntervenantTerrainFeedback[];
};

const EMPTY: SiteData = { tasks: [], documents: [], consignes: [], requests: [], feedbacks: [] };

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date à définir";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
}

function taskDate(task: IntervenantTask) {
  return task.date_debut ?? task.date ?? task.date_fin;
}

function taskDone(task: IntervenantTask) {
  const status = String(task.status ?? "").toUpperCase();
  return ["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(status) || ["termine_intervenant", "valide_admin"].includes(task.quality_status);
}

function nextTask(tasks: IntervenantTask[]) {
  return [...tasks]
    .filter((task) => !taskDone(task))
    .sort((a, b) => {
      const ad = taskDate(a) ? Date.parse(`${taskDate(a)}T00:00:00`) : Number.MAX_SAFE_INTEGER;
      const bd = taskDate(b) ? Date.parse(`${taskDate(b)}T00:00:00`) : Number.MAX_SAFE_INTEGER;
      return ad - bd || a.order_index - b.order_index;
    })[0] ?? null;
}

function isToday(value: string | null | undefined) {
  return !!value && value === isoToday();
}

/** "Ma semaine" : les prochains jours avec tâche, groupés par date — pensé pour un ouvrier (où je vais, quoi faire), pas un Gantt par lot. */
function upcomingByDay(tasks: IntervenantTask[]) {
  const groups = new Map<string, IntervenantTask[]>();
  for (const task of tasks) {
    if (taskDone(task)) continue;
    const date = taskDate(task);
    if (!date) continue;
    const list = groups.get(date) ?? [];
    list.push(task);
    groups.set(date, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)
    .map(([date, items]) => ({ date, items: [...items].sort((a, b) => a.order_index - b.order_index) }));
}

function progress(data: SiteData, chantier: IntervenantChantier) {
  const explicit = Number(chantier.avancement ?? NaN);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, Math.round(explicit)));
  if (!data.tasks.length) return 0;
  return Math.round((data.tasks.filter(taskDone).length / data.tasks.length) * 100);
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "amber" | "green" | "red" }) {
  const styles = { slate: "bg-slate-100 text-slate-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

export default function EmployeePortalV2Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => resolvePortalToken(location.search), [location.search]);
  const [tab, setTab] = useState<Tab>("accueil");
  const [name, setName] = useState("Intervenant");
  const [chantiers, setChantiers] = useState<IntervenantChantier[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dataByChantier, setDataByChantier] = useState<Record<string, SiteData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [timeTaskId, setTimeTaskId] = useState("");
  const [timeHours, setTimeHours] = useState("");
  const [timeQty, setTimeQty] = useState("");
  const [timeWentWell, setTimeWentWell] = useState<boolean | null>(null);
  const [savingTime, setSavingTime] = useState(false);
  const [checklist, setChecklist] = useState<IntervenantDailyChecklist | null>(null);
  const [savingChecklistKey, setSavingChecklistKey] = useState<string | null>(null);
  const [imprevuMode, setImprevuMode] = useState<"none" | "materiel" | "blocage">("none");
  const [materielTitre, setMaterielTitre] = useState("");
  const [materielQuantite, setMaterielQuantite] = useState("");
  const [materielUnite, setMaterielUnite] = useState("");
  const [savingMateriel, setSavingMateriel] = useState(false);
  const [blocageText, setBlocageText] = useState("");
  const [sendingBlocage, setSendingBlocage] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [session, rows] = await Promise.all([intervenantSession(token), intervenantGetChantiers(token)]);
        if (!alive) return;
        const sites = rows.length ? rows : session.chantiers;
        setName(session.intervenant.nom || "Intervenant");
        setChantiers(sites);
        const first = selectedId && sites.some((site) => site.id === selectedId) ? selectedId : sites[0]?.id ?? "";
        setSelectedId(first);
        const entries = await Promise.all(sites.map(async (site) => {
          const [tasks, documents, consignes, requests, feedbacks] = await Promise.all([
            intervenantGetTasks(token, site.id).catch(() => []),
            intervenantGetDocuments(token, site.id).catch(() => []),
            intervenantConsigneList(token, site.id).catch(() => []),
            intervenantInformationRequestList(token, site.id).catch(() => []),
            intervenantTerrainFeedbackList(token, site.id).catch(() => []),
          ]);
          return [site.id, { tasks, documents, consignes, requests, feedbacks } as SiteData] as const;
        }));
        if (!alive) return;
        setDataByChantier(Object.fromEntries(entries));
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Portail terrain indisponible.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [refreshKey, token]);

  const selected = useMemo(() => chantiers.find((c) => c.id === selectedId) ?? chantiers[0] ?? null, [chantiers, selectedId]);

  useEffect(() => {
    let alive = true;
    if (!selected) { setChecklist(null); return; }
    intervenantDailyChecklistGet(token, isoToday())
      .then((row) => { if (alive) setChecklist(row); })
      .catch(() => { if (alive) setChecklist(null); });
    return () => { alive = false; };
  }, [token, selected?.id, refreshKey]);

  async function toggleChecklistItem(key: "has_equipment" | "has_materials" | "has_information") {
    if (savingChecklistKey) return;
    setSavingChecklistKey(key);
    try {
      const values = {
        has_equipment: checklist?.has_equipment ?? false,
        has_materials: checklist?.has_materials ?? false,
        has_information: checklist?.has_information ?? false,
      };
      const next = await intervenantDailyChecklistUpsert(token, {
        chantier_id: selected?.id ?? null,
        checklist_date: isoToday(),
        ...values,
        [key]: !values[key],
      });
      setChecklist(next);
    } catch {
      // silencieux : la checklist est un confort, pas un blocage
    } finally {
      setSavingChecklistKey(null);
    }
  }

  const data = selected ? dataByChantier[selected.id] ?? EMPTY : EMPTY;
  const next = useMemo(() => nextTask(data.tasks), [data.tasks]);
  const pct = selected ? progress(data, selected) : 0;
  const unread = data.consignes.filter((c) => !c.is_read).length;
  const openRequests = data.requests.filter((r) => r.status !== "traitee").length;
  const pendingTasks = data.tasks.filter((t) => !taskDone(t));

  const toFill = useMemo(() => {
    const rows: Array<{ title: string; detail: string; action: "time" | "task" | "fil" }> = [];
    const current = nextTask(data.tasks);
    if (current) rows.push({ title: "Avancement de la prochaine tâche", detail: current.titre, action: "task" });
    if (current) rows.push({ title: "Temps passé", detail: `Renseigner le temps réel sur ${current.titre}`, action: "time" });
    rows.push({ title: "Photo, remarque ou blocage", detail: "Ajouter l'information directement au fil chantier", action: "fil" });
    return rows;
  }, [data.tasks]);

  const toRead = useMemo(() => {
    const items = [
      ...data.consignes.filter((c) => !c.is_read).map((c) => ({ title: c.title, detail: c.description || "Consigne chantier", tone: c.priority === "urgente" ? "red" : "amber" as const })),
      ...data.requests.filter((r) => r.admin_reply).map((r) => ({ title: r.subject, detail: r.admin_reply || "Réponse disponible", tone: "blue" as const })),
    ];
    return items.slice(0, 6);
  }, [data.consignes, data.requests]);

  async function logout() {
    clearStoredIntervenantSession();
    await supabase.auth.signOut().catch(() => undefined);
    navigate("/login", { replace: true });
  }

  async function sendMessage(category: string = "fil_chantier") {
    if (!selected || !message.trim() || sending) return;
    setSending(true);
    try {
      await intervenantTerrainFeedbackCreate(token, {
        chantier_id: selected.id,
        category,
        urgency: category === "blocage" ? "urgente" : "normale",
        title: category === "blocage" ? "Blocage signalé" : "Message chantier",
        description: message.trim(),
      });
      setMessage("");
      setRefreshKey((v) => v + 1);
    } finally {
      setSending(false);
    }
  }

  async function saveTime() {
    if (!selected || !timeTaskId || !timeHours.trim() || savingTime) return;
    const hours = Number(timeHours.replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) return;
    const qty = timeQty.trim() ? Number(timeQty.replace(",", ".")) : null;
    setSavingTime(true);
    try {
      await intervenantTimeCreate(token, {
        chantier_id: selected.id,
        task_id: timeTaskId,
        work_date: isoToday(),
        duration_hours: hours,
        quantite_realisee: qty !== null && Number.isFinite(qty) ? qty : null,
      });
      setTimeHours("");
      setTimeQty("");
      if (timeWentWell === false) {
        setImprevuMode("blocage");
        setBlocageText(`Souci sur "${pendingTasks.find((t) => t.id === timeTaskId)?.titre ?? "la tâche"}" : `);
      }
      setTimeWentWell(null);
      setRefreshKey((v) => v + 1);
    } finally {
      setSavingTime(false);
    }
  }

  async function completeTask(task: IntervenantTask) {
    await intervenantUpdateTaskStatus(token, task.id, "FAIT");
    setRefreshKey((v) => v + 1);
  }

  async function saveMateriel() {
    if (!selected || !materielTitre.trim() || savingMateriel) return;
    setSavingMateriel(true);
    try {
      await intervenantMaterielCreate(token, {
        chantier_id: selected.id,
        task_id: timeTaskId || null,
        titre: materielTitre.trim(),
        quantite: materielQuantite.trim() ? Number(materielQuantite.replace(",", ".")) : null,
        unite: materielUnite.trim() || null,
      });
      setMaterielTitre("");
      setMaterielQuantite("");
      setMaterielUnite("");
      setImprevuMode("none");
      setRefreshKey((v) => v + 1);
    } finally {
      setSavingMateriel(false);
    }
  }

  async function sendBlocage() {
    if (!selected || !blocageText.trim() || sendingBlocage) return;
    setSendingBlocage(true);
    try {
      await intervenantTerrainFeedbackCreate(token, {
        chantier_id: selected.id,
        category: "blocage",
        urgency: "urgente",
        title: "Blocage signalé",
        description: blocageText.trim(),
      });
      setBlocageText("");
      setImprevuMode("none");
      setRefreshKey((v) => v + 1);
    } finally {
      setSendingBlocage(false);
    }
  }

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">Chargement du portail terrain...</div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-5"><Card><div className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />{error}</div></Card></div>;

  return (
    <div className="min-h-dvh bg-slate-50 pb-24 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Batipro terrain</div><div className="truncate text-lg font-bold">Bonjour {name.split(" ")[0]}</div></div>
          <button type="button" onClick={() => setRefreshKey((v) => v + 1)} className="rounded-full border border-slate-200 p-2.5 text-slate-500"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={logout} className="rounded-full border border-slate-200 p-2.5 text-slate-500"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {chantiers.length > 1 ? <select value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-semibold">{chantiers.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select> : null}

        {tab === "accueil" && selected ? <>
          <Card className="border-blue-200">
            <div className="flex items-center justify-between gap-3"><div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Prochaine intervention</div><h2 className="mt-1 text-xl font-bold">{selected.nom}</h2></div><Pill tone="blue">{formatDate(taskDate(next ?? {} as IntervenantTask))}</Pill></div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="text-xs font-semibold text-slate-500">Prochaine tâche</div><div className="mt-1 text-base font-bold">{next?.titre ?? "Aucune tâche planifiée"}</div>{next ? <div className="mt-1 text-sm text-slate-500">{[next.lot, next.zone_nom, next.corps_etat].filter(Boolean).join(" · ")}</div> : null}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTab("chantier")} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900">Voir le chantier <ChevronRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => { if (next) setTimeTaskId(next.id); setTab("renseigner"); }} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"><CheckCircle2 className="h-4 w-4" />Faire le point</button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between"><h3 className="font-bold">Ma semaine</h3><Pill tone="slate">{selected.nom}</Pill></div>
            <div className="mt-3 space-y-3">
              {upcomingByDay(data.tasks).length ? upcomingByDay(data.tasks).map(({ date, items }) => (
                <div key={date} className={`rounded-xl border p-3 ${isToday(date) ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs font-bold uppercase tracking-wide ${isToday(date) ? "text-blue-700" : "text-slate-500"}`}>{isToday(date) ? "Aujourd'hui" : formatDate(date)}</div>
                  <div className="mt-1.5 space-y-1.5">
                    {items.map((task) => <div key={task.id} className="text-sm font-semibold text-slate-900">{task.titre}<span className="ml-1.5 font-normal text-slate-500">{[task.lot, task.zone_nom].filter(Boolean).join(" · ")}</span></div>)}
                  </div>
                </div>
              )) : <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Aucune tâche planifiée pour l'instant.</div>}
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card><div className="flex items-center justify-between"><h3 className="font-bold">À renseigner</h3><Pill tone={toFill.length ? "amber" : "green"}>{toFill.length}</Pill></div><div className="mt-3 space-y-2">{toFill.map((item) => <button key={item.title} onClick={() => setTab(item.action === "fil" ? "fil" : "renseigner")} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left"><span><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>)}</div></Card>
            <Card><div className="flex items-center justify-between"><h3 className="font-bold">À consulter</h3><Pill tone={toRead.length ? "blue" : "green"}>{toRead.length}</Pill></div><div className="mt-3 space-y-2">{toRead.length ? toRead.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 p-3"><div className="text-sm font-semibold">{item.title}</div><div className="mt-1 text-xs text-slate-500">{item.detail}</div></div>) : <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Rien de nouveau à consulter.</div>}</div></Card>
          </div>
        </> : null}

        {tab === "chantier" && selected ? <>
          <Card>
            <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Accueil chantier</div><h2 className="mt-1 text-xl font-bold">{selected.nom}</h2><div className="mt-1 text-sm text-slate-500">{selected.client || "Client non renseigné"}</div></div><Pill tone="green">{pct}%</Pill></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2"><a href={selected.adresse ? `https://maps.apple.com/?q=${encodeURIComponent(selected.adresse)}` : undefined} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><MapPin className="h-5 w-5 text-blue-600" /><span className="text-sm"><span className="block font-semibold">Adresse</span><span className="text-slate-500">{selected.adresse || "Non renseignée"}</span></span></a><div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><Phone className="h-5 w-5 text-blue-600" /><span className="text-sm"><span className="block font-semibold">Téléphone client</span><span className="text-slate-500">À renseigner dans la fiche chantier</span></span></div></div>
          </Card>

          <Card><div className="flex items-center justify-between"><h3 className="font-bold">Prochaine tâche</h3><CalendarDays className="h-5 w-5 text-blue-600" /></div>{next ? <div className="mt-3 rounded-xl bg-blue-50 p-3"><div className="text-xs font-semibold text-blue-700">{formatDate(taskDate(next))}</div><div className="mt-1 font-bold">{next.titre}</div><div className="mt-1 text-sm text-slate-600">{[next.lot, next.zone_nom].filter(Boolean).join(" · ")}</div></div> : <div className="mt-3 text-sm text-slate-500">Aucune tâche à venir.</div>}</Card>

          <Card><div className="flex items-center justify-between"><h3 className="font-bold">Informations utiles</h3><FileText className="h-5 w-5 text-slate-500" /></div><div className="mt-3 grid gap-2"><div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="font-semibold">{unread}</span> consigne(s) non lue(s)</div><div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="font-semibold">{data.documents.length}</span> document(s) terrain</div><div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="font-semibold">{openRequests}</span> demande(s) en attente</div></div></Card>
        </> : null}

        {tab === "renseigner" && selected ? <>
          <Card><div className="flex items-center justify-between"><h2 className="text-lg font-bold">À renseigner</h2><ClipboardList className="h-5 w-5 text-blue-600" /></div><p className="mt-1 text-sm text-slate-500">Saisir uniquement les données terrain utiles.</p></Card>

          <Card>
            <h3 className="font-bold">Faire le point sur une tâche</h3>
            <div className="mt-3 space-y-3">
              <select value={timeTaskId} onChange={(e) => setTimeTaskId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="">Choisir une tâche</option>{pendingTasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>)}</select>
              <div className="flex gap-2">
                <input value={timeHours} onChange={(e) => setTimeHours(e.target.value)} inputMode="decimal" placeholder="Heures, ex. 3,5" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                {pendingTasks.find((t) => t.id === timeTaskId)?.unite ? (
                  <input value={timeQty} onChange={(e) => setTimeQty(e.target.value)} inputMode="decimal" placeholder={`Quantité (${pendingTasks.find((t) => t.id === timeTaskId)?.unite})`} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                ) : null}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Ça s'est bien passé ?</div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setTimeWentWell(true)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${timeWentWell === true ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>Oui, tout va bien</button>
                  <button type="button" onClick={() => setTimeWentWell(false)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${timeWentWell === false ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600"}`}>Non, un souci</button>
                </div>
              </div>
              <button type="button" onClick={saveTime} disabled={savingTime || !timeTaskId || !timeHours.trim()} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{savingTime ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </Card>

          <Card><h3 className="font-bold">Avancement des tâches</h3><div className="mt-3 space-y-2">{pendingTasks.slice(0, 10).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{task.titre}</div><div className="text-xs text-slate-500">{formatDate(taskDate(task))}</div></div><button type="button" onClick={() => completeTask(task)} className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Terminer</button></div>)}</div></Card>

          <Card>
            <h3 className="font-bold">Un imprévu ?</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setImprevuMode(imprevuMode === "materiel" ? "none" : "materiel")} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-bold ${imprevuMode === "materiel" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}><PackageSearch className="h-5 w-5" />Matériel manquant</button>
              <button type="button" onClick={() => setImprevuMode(imprevuMode === "blocage" ? "none" : "blocage")} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-bold ${imprevuMode === "blocage" ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600"}`}><ShieldAlert className="h-5 w-5" />Blocage</button>
              <button type="button" onClick={() => setTab("fil")} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 text-center text-xs font-bold text-slate-600"><MessageCircle className="h-5 w-5" />Photo / remarque</button>
            </div>

            {imprevuMode === "materiel" ? (
              <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                <input value={materielTitre} onChange={(e) => setMaterielTitre(e.target.value)} placeholder="Quoi ? Ex. Colle carrelage" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <div className="flex gap-2">
                  <input value={materielQuantite} onChange={(e) => setMaterielQuantite(e.target.value)} inputMode="decimal" placeholder="Quantité" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <input value={materielUnite} onChange={(e) => setMaterielUnite(e.target.value)} placeholder="Unité" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </div>
                <button type="button" onClick={saveMateriel} disabled={savingMateriel || !materielTitre.trim()} className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{savingMateriel ? "Envoi..." : "Envoyer la demande"}</button>
              </div>
            ) : null}

            {imprevuMode === "blocage" ? (
              <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                <textarea rows={3} value={blocageText} onChange={(e) => setBlocageText(e.target.value)} placeholder="Décris le blocage en quelques mots..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <button type="button" onClick={sendBlocage} disabled={sendingBlocage || !blocageText.trim()} className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{sendingBlocage ? "Envoi..." : "Signaler le blocage"}</button>
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 className="font-bold">Checklist du jour</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["has_equipment", "Équipement"],
                ["has_materials", "Matériel"],
                ["has_information", "Infos reçues"],
              ] as const).map(([key, label]) => {
                const checked = Boolean(checklist?.[key]);
                return (
                  <button key={key} type="button" onClick={() => toggleChecklistItem(key)} disabled={savingChecklistKey === key} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-bold ${checked ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                    <CheckCircle2 className="h-5 w-5" />{label}
                  </button>
                );
              })}
            </div>
          </Card>
        </> : null}

        {tab === "fil" && selected ? <>
          <Card><div className="flex items-center justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Fil chantier</div><h2 className="mt-1 text-lg font-bold">{selected.nom}</h2></div><MessageCircle className="h-6 w-6 text-blue-600" /></div><p className="mt-2 text-sm text-slate-500">Conversation interne chantier, pensée comme WhatsApp. Les messages restent rattachés au chantier.</p></Card>
          <div className="space-y-2">{data.feedbacks.length ? [...data.feedbacks].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((item) => <div key={item.id} className={`flex ${item.author_intervenant_id ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${item.author_intervenant_id ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800"}`}><div>{item.description || item.title}</div><div className={`mt-1 text-[10px] ${item.author_intervenant_id ? "text-blue-100" : "text-slate-400"}`}>{item.created_at ? new Date(item.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</div></div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Aucun message sur ce chantier.</div>}</div>
          <div className="sticky bottom-20 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"><div className="flex items-end gap-2"><textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Écrire un message chantier..." className="min-h-[52px] flex-1 resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none" /><button type="button" onClick={() => sendMessage()} disabled={!message.trim() || sending} className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button></div></div>
        </> : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="mx-auto grid max-w-3xl grid-cols-4 gap-1">{([
        ["accueil", "Accueil", Home],
        ["chantier", "Chantier", Wrench],
        ["renseigner", "À renseigner", CheckCircle2],
        ["fil", "Fil", MessageCircle],
      ] as const).map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${tab === key ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}><Icon className="h-5 w-5" /><span>{label}</span></button>)}</div></nav>
    </div>
  );
}
