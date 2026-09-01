import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, CalendarDays, Camera, CheckCircle2, ChevronRight, ClipboardList, FileText, Home, LogOut, MapPin, MessageCircle, PackageSearch, Phone, Plus, RefreshCw, Send, ShieldAlert, Wrench } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import RaulPortalWidget from "../components/RaulPortalWidget";
import {
  intervenantChantierFeedCreate,
  intervenantChantierFeedList,
  intervenantChantierFeedUploadPhoto,
  intervenantConsigneList,
  intervenantDailyChecklistGet,
  intervenantDailyChecklistUpsert,
  intervenantGetChantiers,
  intervenantGetDocuments,
  intervenantGetTasks,
  intervenantInformationRequestList,
  intervenantDeliverySlipExtract,
  intervenantMaterielCreate,
  intervenantMaterialConsumptionCreate,
  intervenantProductCatalogSearch,
  intervenantSession,
  intervenantStockDeclarationCreate,
  intervenantStockReceptionCreate,
  intervenantTaskMainMaterials,
  intervenantTerrainFeedbackCreate,
  intervenantTimeCreate,
  intervenantUpdateTaskStatus,
  type IntervenantChantier,
  type IntervenantChantierFeedPost,
  type IntervenantConsigne,
  type IntervenantDailyChecklist,
  type IntervenantDocument,
  type IntervenantInformationRequest,
  type IntervenantProductCatalogItem,
  type IntervenantTask,
  type IntervenantTaskMainMaterial,
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
 * carries a bare `?token=` — it is never an authenticated Supabase session, and it is
 * scoped to a single chantier. Once opened, that token used to stay in localStorage
 * and silently override a real account's session on every later visit — an intervenant
 * with a genuine email/password login would keep seeing only that one chantier instead
 * of their full access. An explicit `?token=` in the URL always wins (that is a deliberate
 * "open this link now" action), but absent that, a real Supabase session always takes
 * priority over a leftover stored token — the stored token is only a fallback for
 * token-only access (no account at all).
 */
async function resolveEffectivePortalToken(search: string): Promise<string> {
  const fromUrl = extractIntervenantToken(search);
  if (fromUrl) {
    persistIntervenantToken(fromUrl);
    return fromUrl;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) return AUTH_SESSION_PORTAL_TOKEN;
  const stored = readStoredIntervenantToken();
  return stored || AUTH_SESSION_PORTAL_TOKEN;
}

type Tab = "accueil" | "chantier" | "renseigner" | "fil";

type SiteData = {
  tasks: IntervenantTask[];
  documents: IntervenantDocument[];
  consignes: IntervenantConsigne[];
  requests: IntervenantInformationRequest[];
  feed: IntervenantChantierFeedPost[];
};

const EMPTY: SiteData = { tasks: [], documents: [], consignes: [], requests: [], feed: [] };

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

/** Avancement courant de la tâche (quantité réalisée / quantité prévue), pour préremplir la saisie du jour. */
function taskProgressPercent(task: IntervenantTask | null | undefined): number {
  if (!task || !task.quantite || task.quantite <= 0) return 0;
  const done = Number(task.quantite_realisee ?? 0);
  return Math.max(0, Math.min(100, Math.round((done / task.quantite) * 100)));
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
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);
  const token = resolvedToken ?? AUTH_SESSION_PORTAL_TOKEN;
  const [tab, setTab] = useState<Tab>("accueil");
  const [name, setName] = useState("Intervenant");
  const [intervenantId, setIntervenantId] = useState("");
  const [chantiers, setChantiers] = useState<IntervenantChantier[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dataByChantier, setDataByChantier] = useState<Record<string, SiteData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [timeTaskId, setTimeTaskId] = useState("");
  const [timeHours, setTimeHours] = useState("");
  const [timeProgressPercent, setTimeProgressPercent] = useState("");
  const [timeWentWell, setTimeWentWell] = useState<boolean | null>(null);
  const [savingTime, setSavingTime] = useState(false);
  const [mainMaterials, setMainMaterials] = useState<IntervenantTaskMainMaterial[]>([]);
  const [materialConsumptionQty, setMaterialConsumptionQty] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<IntervenantDailyChecklist | null>(null);
  const [savingChecklistKey, setSavingChecklistKey] = useState<string | null>(null);
  const [imprevuMode, setImprevuMode] = useState<"none" | "materiel" | "blocage">("none");
  const [materielTitre, setMaterielTitre] = useState("");
  const [materielQuantite, setMaterielQuantite] = useState("");
  const [materielUnite, setMaterielUnite] = useState("");
  const [savingMateriel, setSavingMateriel] = useState(false);
  const [blocageText, setBlocageText] = useState("");
  const [sendingBlocage, setSendingBlocage] = useState(false);
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<IntervenantProductCatalogItem[]>([]);
  const [stockSearching, setStockSearching] = useState(false);
  const [stockPicked, setStockPicked] = useState<IntervenantProductCatalogItem | null>(null);
  const [stockQuantite, setStockQuantite] = useState("");
  const [savingStock, setSavingStock] = useState(false);
  const [stockAddedToday, setStockAddedToday] = useState<Array<{ id: string; designation: string; quantity: string; unit: string }>>([]);

  type SlipLine = {
    designation: string;
    quantity: string;
    unit: string;
    productId: string | null;
    productDesignation: string | null;
    productUnit: string | null;
  };
  const [slipUploading, setSlipUploading] = useState(false);
  const [slipError, setSlipError] = useState<string | null>(null);
  const [slipLines, setSlipLines] = useState<SlipLine[]>([]);
  const [slipStoragePath, setSlipStoragePath] = useState<string | null>(null);
  const [slipStorageBucket, setSlipStorageBucket] = useState<string | null>(null);
  const [slipEditingIndex, setSlipEditingIndex] = useState<number | null>(null);
  const [slipSearchQuery, setSlipSearchQuery] = useState("");
  const [slipSearchResults, setSlipSearchResults] = useState<IntervenantProductCatalogItem[]>([]);
  const [slipSearching, setSlipSearching] = useState(false);
  const [slipSubmitting, setSlipSubmitting] = useState(false);
  const [slipDoneCount, setSlipDoneCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void resolveEffectivePortalToken(location.search).then((resolved) => {
      if (alive) setResolvedToken(resolved);
    });
    return () => { alive = false; };
  }, [location.search]);

  useEffect(() => {
    if (resolvedToken === null) return;
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [session, rows] = await Promise.all([intervenantSession(token), intervenantGetChantiers(token)]);
        if (!alive) return;
        const sites = rows.length ? rows : session.chantiers;
        setName(session.intervenant.nom || "Intervenant");
        setIntervenantId(session.intervenant.id || "");
        setChantiers(sites);
        const entries = await Promise.all(sites.map(async (site) => {
          const [tasks, documents, consignes, requests, feed] = await Promise.all([
            intervenantGetTasks(token, site.id).catch(() => []),
            intervenantGetDocuments(token, site.id).catch(() => []),
            intervenantConsigneList(token, site.id).catch(() => []),
            intervenantInformationRequestList(token, site.id).catch(() => []),
            intervenantChantierFeedList(token, site.id).catch(() => []),
          ]);
          return [site.id, { tasks, documents, consignes, requests, feed } as SiteData] as const;
        }));
        if (!alive) return;
        const dataMap = Object.fromEntries(entries);
        setDataByChantier(dataMap);

        // Chantier du jour : si un seul chantier a une tâche planifiée aujourd'hui, on l'ouvre directement.
        // Sinon (plusieurs, ou aucun), l'ouvrier choisit via le sélecteur — sans écraser un choix déjà fait.
        setSelectedId((current) => {
          if (current && sites.some((site) => site.id === current)) return current;
          const todaysSiteIds = sites
            .filter((site) => (dataMap[site.id]?.tasks ?? []).some((t) => !taskDone(t) && isToday(taskDate(t))))
            .map((site) => site.id);
          return todaysSiteIds[0] ?? sites[0]?.id ?? "";
        });
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Portail terrain indisponible.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
    // token est dérivé de resolvedToken avec un repli qui peut être la même valeur (le sentinel
    // AUTH_SESSION) avant et après résolution : dépendre de resolvedToken garantit que cet effet
    // se redéclenche bien une fois le token réellement résolu, même quand la valeur ne change pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, resolvedToken]);

  const selected = useMemo(() => chantiers.find((c) => c.id === selectedId) ?? chantiers[0] ?? null, [chantiers, selectedId]);

  // Chaque chantier a son propre espace "à renseigner" / "fil" : un brouillon commencé sur un
  // chantier ne doit pas se retrouver envoyé sur un autre après un changement de sélection.
  useEffect(() => {
    setMessage("");
    setTimeTaskId("");
    setTimeHours("");
    setTimeProgressPercent("");
    setTimeWentWell(null);
    setMaterialConsumptionQty({});
    setImprevuMode("none");
    setMaterielTitre("");
    setMaterielQuantite("");
    setMaterielUnite("");
    setBlocageText("");
  }, [selected?.id]);

  const todaysChantierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const site of chantiers) {
      const siteData = dataByChantier[site.id];
      if (siteData?.tasks.some((t) => !taskDone(t) && isToday(taskDate(t)))) ids.add(site.id);
    }
    return ids;
  }, [chantiers, dataByChantier]);

  const orderedChantiers = useMemo(
    () => [...chantiers].sort((a, b) => Number(todaysChantierIds.has(b.id)) - Number(todaysChantierIds.has(a.id))),
    [chantiers, todaysChantierIds],
  );

  useEffect(() => {
    let alive = true;
    if (!selected) { setChecklist(null); return; }
    intervenantDailyChecklistGet(token, isoToday())
      .then((row) => { if (alive) setChecklist(row); })
      .catch(() => { if (alive) setChecklist(null); });
    return () => { alive = false; };
  }, [token, selected?.id, refreshKey]);

  useEffect(() => {
    let alive = true;
    if (!selected || !timeTaskId) { setMainMaterials([]); return; }
    intervenantTaskMainMaterials(token, selected.id, timeTaskId)
      .then((rows) => { if (alive) setMainMaterials(rows); })
      .catch(() => { if (alive) setMainMaterials([]); });
    return () => { alive = false; };
  }, [token, selected?.id, timeTaskId]);

  useEffect(() => {
    const task = (selected ? dataByChantier[selected.id]?.tasks ?? [] : []).find((t) => t.id === timeTaskId);
    setTimeProgressPercent(task ? String(taskProgressPercent(task)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTaskId]);

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

  async function sendMessage() {
    if (!selected || !message.trim() || sending) return;
    setSending(true);
    try {
      await intervenantChantierFeedCreate(token, { chantier_id: selected.id, body: message.trim() });
      setMessage("");
      setRefreshKey((v) => v + 1);
    } finally {
      setSending(false);
    }
  }

  async function sendPhoto(file: File | null) {
    if (!selected || !file || sendingPhoto) return;
    setSendingPhoto(true);
    setPhotoError(null);
    try {
      await intervenantChantierFeedUploadPhoto(token, { chantier_id: selected.id, body: message.trim(), file });
      setMessage("");
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Envoi photo impossible.");
    } finally {
      setSendingPhoto(false);
    }
  }

  async function saveTime() {
    if (!selected || !timeTaskId || !timeHours.trim() || savingTime) return;
    const hours = Number(timeHours.replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) return;
    const progressPercent = timeProgressPercent.trim() ? Number(timeProgressPercent.replace(",", ".")) : null;
    setSavingTime(true);
    try {
      await intervenantTimeCreate(token, {
        chantier_id: selected.id,
        task_id: timeTaskId,
        work_date: isoToday(),
        duration_hours: hours,
        progress_percent: progressPercent !== null && Number.isFinite(progressPercent) ? progressPercent : null,
      });
      await Promise.all(
        mainMaterials.map(async (material) => {
          const raw = materialConsumptionQty[material.material_ratio_id]?.trim();
          if (!raw) return;
          const consumed = Number(raw.replace(",", "."));
          if (!Number.isFinite(consumed) || consumed <= 0) return;
          await intervenantMaterialConsumptionCreate(token, {
            chantier_id: selected.id,
            task_id: timeTaskId,
            material_ratio_id: material.material_ratio_id,
            quantite_consommee: consumed,
            work_date: isoToday(),
          });
        }),
      );
      setTimeHours("");
      setTimeProgressPercent("");
      setMaterialConsumptionQty({});
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

  useEffect(() => {
    if (!selected) return;
    if (!stockQuery.trim()) {
      setStockResults([]);
      return;
    }
    let alive = true;
    setStockSearching(true);
    const timer = window.setTimeout(() => {
      void intervenantProductCatalogSearch(token, selected.id, stockQuery.trim())
        .then((rows) => { if (alive) setStockResults(rows); })
        .catch(() => { if (alive) setStockResults([]); })
        .finally(() => { if (alive) setStockSearching(false); });
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [stockQuery, selected, token]);

  useEffect(() => {
    if (slipEditingIndex === null || !selected) return;
    if (!slipSearchQuery.trim()) {
      setSlipSearchResults([]);
      return;
    }
    let alive = true;
    setSlipSearching(true);
    const timer = window.setTimeout(() => {
      void intervenantProductCatalogSearch(token, selected.id, slipSearchQuery.trim())
        .then((rows) => { if (alive) setSlipSearchResults(rows); })
        .catch(() => { if (alive) setSlipSearchResults([]); })
        .finally(() => { if (alive) setSlipSearching(false); });
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [slipSearchQuery, slipEditingIndex, selected, token]);

  async function handleSlipPhoto(file: File | null) {
    if (!file || !selected || slipUploading) return;
    setSlipUploading(true);
    setSlipError(null);
    setSlipDoneCount(null);
    try {
      const result = await intervenantDeliverySlipExtract(token, selected.id, file);
      setSlipStoragePath(result.storage_path);
      setSlipStorageBucket(result.storage_bucket);
      setSlipLines(
        result.lines.map((line) => ({
          designation: line.designation,
          quantity: String(line.quantity),
          unit: line.unit,
          productId: null,
          productDesignation: null,
          productUnit: null,
        })),
      );
      if (result.lines.length === 0) setSlipError("Aucune ligne de matériau reconnue sur cette photo.");
    } catch (err: any) {
      setSlipError(err?.message ?? "Lecture impossible.");
    } finally {
      setSlipUploading(false);
    }
  }

  function startEditingSlipLine(index: number) {
    setSlipEditingIndex(index);
    setSlipSearchQuery(slipLines[index]?.designation ?? "");
    setSlipSearchResults([]);
  }

  function pickProductForSlipLine(index: number, product: IntervenantProductCatalogItem) {
    setSlipLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, productId: product.id, productDesignation: product.designation, productUnit: product.unit } : line,
      ),
    );
    setSlipEditingIndex(null);
    setSlipSearchQuery("");
    setSlipSearchResults([]);
  }

  function removeSlipLine(index: number) {
    setSlipLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitSlipLines() {
    if (!selected || slipSubmitting) return;
    const ready = slipLines.filter((line) => line.productId && line.quantity.trim());
    if (ready.length === 0) return;
    setSlipSubmitting(true);
    setSlipError(null);
    try {
      for (const line of ready) {
        await intervenantStockReceptionCreate(token, {
          chantier_id: selected.id,
          product_id: line.productId as string,
          quantity: Number(line.quantity.replace(",", ".")),
          source_storage_bucket: slipStorageBucket,
          source_storage_path: slipStoragePath,
        });
      }
      setSlipDoneCount(ready.length);
      setSlipLines([]);
      setSlipStoragePath(null);
      setSlipStorageBucket(null);
    } catch (err: any) {
      setSlipError(err?.message ?? "Enregistrement impossible.");
    } finally {
      setSlipSubmitting(false);
    }
  }

  async function saveStockDeclaration() {
    if (!selected || !stockPicked || !stockQuantite.trim() || savingStock) return;
    setSavingStock(true);
    try {
      const quantity = Number(stockQuantite.replace(",", "."));
      await intervenantStockDeclarationCreate(token, {
        chantier_id: selected.id,
        product_id: stockPicked.id,
        quantity,
      });
      setStockAddedToday((prev) => [
        { id: stockPicked.id, designation: stockPicked.designation, quantity: stockQuantite, unit: stockPicked.unit },
        ...prev,
      ]);
      setStockPicked(null);
      setStockQuantite("");
      setStockQuery("");
      setStockResults([]);
    } finally {
      setSavingStock(false);
    }
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
        {chantiers.length > 1 ? <>
          <select value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-semibold">
            {orderedChantiers.map((c) => <option key={c.id} value={c.id}>{c.nom}{todaysChantierIds.has(c.id) ? " — aujourd'hui" : ""}</option>)}
          </select>
          {selected && !todaysChantierIds.has(selected.id) && todaysChantierIds.size > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Tu as une tâche planifiée aujourd'hui sur un autre chantier.</div>
          ) : null}
        </> : null}

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
          <Card><div className="flex items-center justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{selected.nom}</div><h2 className="mt-1 text-lg font-bold">À renseigner</h2></div><ClipboardList className="h-5 w-5 text-blue-600" /></div><p className="mt-1 text-sm text-slate-500">Saisir uniquement les données terrain utiles à ce chantier.</p></Card>

          <Card>
            <h3 className="font-bold">Faire le point sur une tâche</h3>
            <div className="mt-3 space-y-3">
              <select value={timeTaskId} onChange={(e) => setTimeTaskId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="">Choisir une tâche</option>{pendingTasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>)}</select>
              <input value={timeHours} onChange={(e) => setTimeHours(e.target.value)} inputMode="decimal" placeholder="Heures passées, ex. 3,5" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
              {timeTaskId ? (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Où en est la tâche aujourd'hui ?</span>
                    <span className="text-slate-900">{timeProgressPercent || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={timeProgressPercent || 0}
                    onChange={(e) => setTimeProgressPercent(e.target.value)}
                    className="mt-2 w-full"
                  />
                  <p className="mt-1 text-xs text-slate-400">Avancement global de la tâche, pas seulement d'aujourd'hui — utile quand une tâche se fait en plusieurs étapes (ex. structure, pose, bandes) difficiles à mesurer en m² au jour le jour.</p>
                </div>
              ) : null}
              {mainMaterials.map((material) => (
                <input
                  key={material.material_ratio_id}
                  value={materialConsumptionQty[material.material_ratio_id] ?? ""}
                  onChange={(e) => setMaterialConsumptionQty((prev) => ({ ...prev, [material.material_ratio_id]: e.target.value }))}
                  inputMode="decimal"
                  placeholder={`${material.material_name} utilisé(e) — ${material.ratio_unit}`}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                />
              ))}
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
              <button type="button" onClick={() => setTab("fil")} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 text-center text-xs font-bold text-slate-600"><Camera className="h-5 w-5" />Photo / remarque</button>
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
            <h3 className="font-bold">Bon de livraison</h3>
            <p className="mt-1 text-xs text-slate-500">Prends en photo le bon quand tu récupères du matériel — l'IA lit les lignes, tu valides ce qui part en stock.</p>
            <div className="mt-3 space-y-2">
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={slipUploading}
                  onChange={(e) => { void handleSlipPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
                {slipUploading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                {slipUploading ? "Lecture en cours..." : "Photo du bon de livraison"}
              </label>

              {slipError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{slipError}</div> : null}
              {slipDoneCount ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{slipDoneCount} matériau{slipDoneCount > 1 ? "x" : ""} ajouté{slipDoneCount > 1 ? "s" : ""} au stock.</div> : null}

              {slipLines.length > 0 ? (
                <div className="space-y-2">
                  {slipLines.map((line, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{line.designation}</div>
                          {line.productDesignation ? (
                            <div className="mt-0.5 truncate text-xs font-semibold text-emerald-700">→ {line.productDesignation}</div>
                          ) : (
                            <div className="mt-0.5 text-xs font-semibold text-amber-700">Produit à associer</div>
                          )}
                        </div>
                        <button type="button" onClick={() => removeSlipLine(index)} className="shrink-0 text-xs font-semibold text-slate-400">Retirer</button>
                      </div>

                      {slipEditingIndex === index ? (
                        <div className="relative mt-2">
                          <input
                            autoFocus
                            value={slipSearchQuery}
                            onChange={(e) => setSlipSearchQuery(e.target.value)}
                            placeholder="Chercher le produit correspondant..."
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          {slipSearchQuery.trim() && (slipSearching || slipSearchResults.length > 0) ? (
                            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                              {slipSearching ? (
                                <div className="px-3 py-2.5 text-xs text-slate-500">Recherche...</div>
                              ) : (
                                slipSearchResults.map((product) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => pickProductForSlipLine(index, product)}
                                    className="block w-full truncate px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                                  >
                                    {product.designation} <span className="text-xs text-slate-400">({product.unit})</span>
                                  </button>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEditingSlipLine(index)} className="mt-2 text-xs font-semibold text-blue-700">
                          {line.productDesignation ? "Changer le produit" : "Associer un produit"}
                        </button>
                      )}

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={line.quantity}
                          onChange={(e) => setSlipLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))}
                          inputMode="decimal"
                          className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <span className="text-xs text-slate-500">{line.productUnit ?? line.unit}</span>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={submitSlipLines}
                    disabled={slipSubmitting || !slipLines.some((l) => l.productId && l.quantity.trim())}
                    className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {slipSubmitting ? "Enregistrement..." : "Valider et mettre en stock"}
                  </button>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold">Matériaux utilisés aujourd'hui</h3>
            <p className="mt-1 text-xs text-slate-500">Ce que tu as pris ou posé aujourd'hui, pour garder le stock à jour. Ex. 10 plaques de placo, une boîte de vis 25mm...</p>
            <div className="mt-3 space-y-2">
              {stockPicked ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-blue-900">{stockPicked.designation}</div>
                    <div className="text-xs text-blue-700">{stockPicked.unit}</div>
                  </div>
                  <button type="button" onClick={() => { setStockPicked(null); setStockQuantite(""); }} className="shrink-0 text-xs font-semibold text-blue-700">Changer</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={stockQuery}
                    onChange={(e) => setStockQuery(e.target.value)}
                    placeholder="Chercher un matériau... Ex. placo, vis 25mm"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  {stockQuery.trim() && (stockSearching || stockResults.length > 0) ? (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {stockSearching ? (
                        <div className="px-3 py-2.5 text-xs text-slate-500">Recherche...</div>
                      ) : (
                        stockResults.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => { setStockPicked(product); setStockQuery(""); setStockResults([]); }}
                            className="block w-full truncate px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                          >
                            {product.designation} <span className="text-xs text-slate-400">({product.unit})</span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              {stockPicked ? (
                <div className="flex gap-2">
                  <input value={stockQuantite} onChange={(e) => setStockQuantite(e.target.value)} inputMode="decimal" placeholder={`Quantité (${stockPicked.unit})`} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <button type="button" onClick={saveStockDeclaration} disabled={savingStock || !stockQuantite.trim()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                    {savingStock ? "..." : <><Plus className="h-4 w-4" />Ajouter</>}
                  </button>
                </div>
              ) : null}
              {stockAddedToday.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  {stockAddedToday.map((entry, i) => (
                    <div key={`${entry.id}-${i}`} className="flex items-center gap-2 text-xs text-slate-600">
                      <Boxes className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{entry.quantity} {entry.unit} — {entry.designation}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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
          <Card><div className="flex items-center justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Fil chantier</div><h2 className="mt-1 text-lg font-bold">{selected.nom}</h2></div><MessageCircle className="h-6 w-6 text-blue-600" /></div><p className="mt-2 text-sm text-slate-500">Fil partagé du chantier : visible par tous les intervenants (ouvriers, sous-traitants) et par le bureau.</p></Card>
          {photoError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{photoError}</div> : null}
          <div className="space-y-2">{data.feed.length ? data.feed.map((item) => <div key={item.id} className={`flex ${item.author_intervenant_id === intervenantId ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${item.author_intervenant_id === intervenantId ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800"}`}><div className={`text-[10px] font-semibold uppercase tracking-wide ${item.author_intervenant_id === intervenantId ? "text-blue-100" : "text-slate-400"}`}>{item.author_intervenant_id === intervenantId ? "Toi" : item.author_name || "Équipe"}</div><div className="mt-0.5 whitespace-pre-wrap">{item.body}</div>{item.attachment ? (item.attachment.mime_type?.startsWith("image/") && item.attachment.signed_url ? (<a href={item.attachment.signed_url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-white/20"><img src={item.attachment.signed_url} alt={item.attachment.file_name} className="max-h-64 w-full object-cover" /></a>) : item.attachment.signed_url ? (<a href={item.attachment.signed_url} target="_blank" rel="noreferrer" className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${item.author_intervenant_id === intervenantId ? "border-white/30 text-white" : "border-slate-200 text-slate-700"}`}><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{item.attachment.file_name}</span></a>) : null) : null}<div className={`mt-1 text-[10px] ${item.author_intervenant_id === intervenantId ? "text-blue-100" : "text-slate-400"}`}>{item.created_at ? new Date(item.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</div></div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Aucun message sur ce chantier.</div>}</div>
          <div className="sticky bottom-20 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="flex items-end gap-2">
              <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Écrire un message, ou ajoute une photo..." className="min-h-[52px] flex-1 resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
              <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  disabled={sendingPhoto}
                  onChange={(e) => { void sendPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
                {sendingPhoto ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              </label>
              <button type="button" onClick={() => sendMessage()} disabled={!message.trim() || sending} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button>
            </div>
          </div>
        </> : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="mx-auto grid max-w-3xl grid-cols-4 gap-1">{([
        ["accueil", "Accueil", Home],
        ["chantier", "Chantier", Wrench],
        ["renseigner", "À renseigner", CheckCircle2],
        ["fil", "Fil", MessageCircle],
      ] as const).map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${tab === key ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}><Icon className="h-5 w-5" /><span>{label}</span></button>)}</div></nav>

      <RaulPortalWidget token={token} chantierId={selected?.id ?? null} />
    </div>
  );
}
