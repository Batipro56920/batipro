  // src/pages/ChantierPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { getChantierById, type ChantierRow } from "../services/chantiers.service";

import {
  getTasksByChantierId,
  createTask,
  updateTask,
  type ChantierTaskRow,
  type TaskStatus,
} from "../services/chantierTasks.service";

import {
  listDevisByChantierId,
  createDevis,
  listDevisLignes,
  createDevisLigne,
  deleteDevisLigne,
  type DevisRow,
  type DevisLigneRow,
} from "../services/devis.service";

// ✅ Import devis PDF (garde cette feature)
import { importDevisPdfToLinesAndTasks } from "../services/devisImport.service";
import { extractTextFromPdf } from "../services/pdfText.service";

import {
  listIntervenantsByChantierId,
  createIntervenant,
  updateIntervenant,
  deleteIntervenant,
  type IntervenantRow,
} from "../services/intervenants.service";

import {
  listMaterielDemandesByChantierId,
  createMaterielDemande,
  updateMaterielDemande,
  deleteMaterielDemande,
  type MaterielDemandeRow,
  type MaterielStatus,
} from "../services/materielDemandes.service";

// ✅ ENVOI ACCÈS (Edge Function via service)
import { sendIntervenantAccess } from "../services/chantierAccessAdmin.service";

/* ---------------- types ---------------- */
type TabKey =
  | "devis-taches"
  | "intervenants"
  | "planning"
  | "temps"
  | "plans-reserves"
  | "materiel"
  | "messagerie"
  | "rapports";

type ToastState = { type: "ok" | "error"; msg: string } | null;

type SendAccessResponse =
  | { ok: true; accessUrl?: string; inserted?: any; mode?: string; warning?: string }
  | { ok?: boolean; error?: string; accessUrl?: string };

/* ---------------- helpers ---------------- */
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function statusBadge(status?: string | null) {
  const s = status ?? "PREPARATION";
  if (s === "EN_COURS") {
    return { label: "En cours", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (s === "TERMINE") {
    return { label: "Terminé", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: "Préparation", className: "bg-slate-50 text-slate-700 border-slate-200" };
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl text-sm border transition whitespace-nowrap",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function taskStatusLabel(s: ChantierTaskRow["status"]) {
  if (s === "FAIT") return "Fait";
  if (s === "EN_COURS") return "En cours";
  return "À faire";
}
function taskStatusBadgeClass(s: ChantierTaskRow["status"]) {
  if (s === "FAIT") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "EN_COURS") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function stripLegacyPrefix(titre: string) {
  const idx = titre.indexOf(" — ");
  if (idx <= 0) return titre;
  return titre.slice(idx + 3).trim();
}

/** "1,5" => "1.5" */
function normalizeHoursInput(s: string) {
  return (s ?? "").trim().replace(",", ".");
}
function toInputNumberString(v: number | null | undefined) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- component ---------------- */
export default function ChantierPage() {
  const { id } = useParams<{ id: string }>();

  const [item, setItem] = useState<ChantierRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("devis-taches");

  // Toast
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Tasks
  const [tasks, setTasks] = useState<ChantierTaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // ✅ Temps tab (draft par tâche) : date début/fin + ajout (h)
  const [timeDraftByTaskId, setTimeDraftByTaskId] = useState<
    Record<string, { date_debut: string; date_fin: string; ajout_h: string }>
  >({});
  const [savingTimeTaskId, setSavingTimeTaskId] = useState<string | null>(null);

  // Intervenants
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [intervenantsLoading, setIntervenantsLoading] = useState(false);
  const [intervenantsError, setIntervenantsError] = useState<string | null>(null);

  // ✅ Envoi accès (bouton "Envoyer accès")
  const [sendingAccessId, setSendingAccessId] = useState<string | null>(null);

  // Ajout intervenant
  const [creatingIntervenant, setCreatingIntervenant] = useState(false);
  const [newIntervenantNom, setNewIntervenantNom] = useState("");
  const [newIntervenantEmail, setNewIntervenantEmail] = useState("");
  const [newIntervenantTel, setNewIntervenantTel] = useState("");

  // Edition intervenant (modal)
  const [editingIntervenant, setEditingIntervenant] = useState<IntervenantRow | null>(null);
  const [savingIntervenant, setSavingIntervenant] = useState(false);
  const [editIntervenantNom, setEditIntervenantNom] = useState("");
  const [editIntervenantEmail, setEditIntervenantEmail] = useState("");
  const [editIntervenantTel, setEditIntervenantTel] = useState("");

  // Ajout tâche
  const [newTitre, setNewTitre] = useState("");
  const [newCorpsEtat, setNewCorpsEtat] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newIntervenantId, setNewIntervenantId] = useState<string>("__NONE__");
  const [addingTask, setAddingTask] = useState(false);

  // Edition tâche
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editTitre, setEditTitre] = useState("");
  const [editCorpsEtat, setEditCorpsEtat] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("A_FAIRE");
  const [editIntervenantId, setEditIntervenantId] = useState<string>("__NONE__");

  // Devis
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [devisLoading, setDevisLoading] = useState(false);
  const [devisError, setDevisError] = useState<string | null>(null);
  const [newDevisNom, setNewDevisNom] = useState("");
  const [creatingDevis, setCreatingDevis] = useState(false);

  // Lignes devis
  const [activeDevisId, setActiveDevisId] = useState<string | null>(null);
  const [lignes, setLignes] = useState<DevisLigneRow[]>([]);
  const [lignesLoading, setLignesLoading] = useState(false);
  const [lignesError, setLignesError] = useState<string | null>(null);

  // Form ligne devis
  const [lCorpsEtat, setLCorpsEtat] = useState("");
  const [lEntreprise, setLEntreprise] = useState("");
  const [lDesignation, setLDesignation] = useState("");
  const [lUnite, setLUnite] = useState("U");
  const [lQty, setLQty] = useState("1");
  const [lGen, setLGen] = useState(true);
  const [addingLigne, setAddingLigne] = useState(false);

  // Filtres tâches
  const [filterLot, setFilterLot] = useState<string>("__ALL__");
  const [filterIntervenant, setFilterIntervenant] = useState<string>("__ALL__");

  // ✅ Import devis PDF
  const [importPdfFile, setImportPdfFile] = useState<File | null>(null);
  const [importPdfBusy, setImportPdfBusy] = useState(false);
  const [importPdfError, setImportPdfError] = useState<string | null>(null);

  // ✅ Matériel
  const [materiel, setMateriel] = useState<MaterielDemandeRow[]>([]);
  const [materielLoading, setMaterielLoading] = useState(false);
  const [materielError, setMaterielError] = useState<string | null>(null);

  // Form matériel
  const [mIntervenantId, setMIntervenantId] = useState<string>("__NONE__");
  const [mDesignation, setMDesignation] = useState("");
  const [mQuantite, setMQuantite] = useState("1");
  const [mUnite, setMUnite] = useState("");
  const [mDate, setMDate] = useState("");
  const [mStatus, setMStatus] = useState<MaterielStatus>("A_COMMANDER");
  const [mRemarques, setMRemarques] = useState("");
  const [addingMateriel, setAddingMateriel] = useState(false);

  /* ---------------- loaders ---------------- */
  async function refreshIntervenants() {
    if (!id) return;
    setIntervenantsLoading(true);
    setIntervenantsError(null);
    try {
      const data = await listIntervenantsByChantierId(id);
      setIntervenants(data);
    } catch (e: any) {
      setIntervenants([]);
      setIntervenantsError(e?.message ?? "Erreur chargement intervenants.");
    } finally {
      setIntervenantsLoading(false);
    }
  }

  async function refreshTasksOnly() {
    if (!id) return;
    const tasksData = await getTasksByChantierId(id);
    setTasks(tasksData);
  }

  async function refreshMateriel() {
    if (!id) return;
    setMaterielLoading(true);
    setMaterielError(null);
    try {
      const data = await listMaterielDemandesByChantierId(id);
      setMateriel(data);
    } catch (e: any) {
      setMateriel([]);
      setMaterielError(e?.message ?? "Erreur chargement matériel.");
    } finally {
      setMaterielLoading(false);
    }
  }
  /* ---------------- initial load ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadAll() {
      if (!id) return;
      setLoading(true);
      setErrorMsg(null);

      try {
        const chantier = await getChantierById(id);
        if (!alive) return;
        setItem(chantier);

        // tasks
        setTasksLoading(true);
        setTasksError(null);
        try {
          const tasksData = await getTasksByChantierId(id);
          if (!alive) return;
          setTasks(tasksData);
        } catch (e: any) {
          if (!alive) return;
          setTasksError(e?.message ?? "Erreur lors du chargement des tâches.");
          setTasks([]);
        } finally {
          if (alive) setTasksLoading(false);
        }

        // devis
        setDevisLoading(true);
        setDevisError(null);
        try {
          const devisData = await listDevisByChantierId(id);
          if (!alive) return;
          setDevis(devisData);
        } catch (e: any) {
          if (!alive) return;
          setDevisError(e?.message ?? "Erreur lors du chargement des devis.");
          setDevis([]);
        } finally {
          if (alive) setDevisLoading(false);
        }

        // intervenants
        setIntervenantsLoading(true);
        setIntervenantsError(null);
        try {
          const iData = await listIntervenantsByChantierId(id);
          if (!alive) return;
          setIntervenants(iData);
        } catch (e: any) {
          if (!alive) return;
          setIntervenants([]);
          setIntervenantsError(e?.message ?? "Erreur chargement intervenants.");
        } finally {
          if (alive) setIntervenantsLoading(false);
        }

        // matériel
        setMaterielLoading(true);
        setMaterielError(null);
        try {
          const mData = await listMaterielDemandesByChantierId(id);
          if (!alive) return;
          setMateriel(mData);
        } catch (e: any) {
          if (!alive) return;
          setMateriel([]);
          setMaterielError(e?.message ?? "Erreur chargement matériel.");
        } finally {
          if (alive) setMaterielLoading(false);
        }
      } catch (e: any) {
        if (!alive) return;
        setErrorMsg(e?.message ?? "Erreur lors du chargement du chantier.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ---------------- load lignes devis ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadLignes() {
      if (!activeDevisId) {
        setLignes([]);
        return;
      }
      setLignesLoading(true);
      setLignesError(null);
      try {
        const data = await listDevisLignes(activeDevisId);
        if (!alive) return;
        setLignes(data);
      } catch (e: any) {
        if (!alive) return;
        setLignesError(e?.message ?? "Erreur lors du chargement des lignes.");
        setLignes([]);
      } finally {
        if (alive) setLignesLoading(false);
      }
    }

    loadLignes();
    return () => {
      alive = false;
    };
  }, [activeDevisId]);

  // ✅ initialise le draft temps quand tasks changent
  useEffect(() => {
    const next: Record<string, { date_debut: string; date_fin: string; ajout_h: string }> = {};
    for (const t of tasks as any[]) {
      next[t.id] = {
        date_debut: t.date_debut ?? "",
        date_fin: t.date_fin ?? "",
        ajout_h: "",
      };
    }
    setTimeDraftByTaskId(next);
  }, [tasks]);

  /* ---------------- computed ---------------- */
  const badge = useMemo(() => statusBadge(item?.status), [item?.status]);

  const avancement = useMemo(() => {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.status === "FAIT").length;
    return clamp(Math.round((done / tasks.length) * 100), 0, 100);
  }, [tasks]);

  const intervenantById = useMemo(() => {
    const m = new Map<string, IntervenantRow>();
    for (const i of intervenants) m.set(i.id, i);
    return m;
  }, [intervenants]);

  const taskLots = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      const ce = (t.corps_etat ?? "").trim();
      if (ce) set.add(ce);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterLot !== "__ALL__") {
        if ((t.corps_etat ?? "") !== filterLot) return false;
      }
      if (filterIntervenant === "__NONE__") {
        if (t.intervenant_id) return false;
      } else if (filterIntervenant !== "__ALL__") {
        if ((t.intervenant_id ?? "") !== filterIntervenant) return false;
      }
      return true;
    });
  }, [tasks, filterLot, filterIntervenant]);

  const totalTempsReel = useMemo(() => {
    return (tasks as any[]).reduce((sum, t) => sum + (Number(t.temps_reel_h ?? 0) || 0), 0);
  }, [tasks]);

  const tempsPrevues = Number((item as any)?.heures_prevues ?? 0) || 0;

  /* ---------------- actions ---------------- */

  // ----- tâches -----
  async function toggleTaskDone(t: ChantierTaskRow) {
    const nextStatus = t.status === "FAIT" ? "A_FAIRE" : "FAIT";
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: nextStatus } : x)));
    try {
      await updateTask(t.id, { status: nextStatus });
    } catch (e: any) {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: t.status } : x)));
      setTasksError(e?.message ?? "Erreur lors de la mise à jour de la tâche.");
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour tâche." });
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const titre = newTitre.trim();
    if (!titre) {
      setTasksError("Le titre est obligatoire.");
      return;
    }

    setAddingTask(true);
    setTasksError(null);

    const intervenant_id = newIntervenantId === "__NONE__" ? null : newIntervenantId;

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: any = {
      id: tempId,
      chantier_id: id,
      titre,
      corps_etat: newCorpsEtat.trim() || null,
      date: newDate || null,
      status: "A_FAIRE",
      intervenant_id,
      date_debut: null,
      date_fin: null,
      temps_reel_h: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTasks((prev) => [optimistic, ...prev]);

    try {
      const saved = await createTask({
        chantier_id: id,
        titre,
        corps_etat: newCorpsEtat.trim() || null,
        date: newDate || null,
        status: "A_FAIRE",
        intervenant_id,
      });

      setTasks((prev) => prev.map((t) => (t.id === tempId ? (saved as any) : t)));

      setNewTitre("");
      setNewCorpsEtat("");
      setNewDate("");
      setNewIntervenantId("__NONE__");

      setToast({ type: "ok", msg: "Tâche ajoutée." });
    } catch (e: any) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setTasksError(e?.message ?? "Erreur lors de l’ajout de la tâche.");
      setToast({ type: "error", msg: e?.message ?? "Erreur ajout tâche." });
    } finally {
      setAddingTask(false);
    }
  }

  function startEditTask(t: ChantierTaskRow) {
    setEditingTaskId(t.id);
    setEditTitre(stripLegacyPrefix(t.titre ?? ""));
    setEditCorpsEtat(t.corps_etat ?? "");
    setEditDate(t.date ?? "");
    setEditStatus((t.status ?? "A_FAIRE") as any);
    setEditIntervenantId(t.intervenant_id ?? "__NONE__");
  }
  function cancelEditTask() {
    setEditingTaskId(null);
    setSavingTask(false);
  }

  async function saveEditTask(t: ChantierTaskRow) {
    const titre = editTitre.trim();
    if (!titre) {
      setToast({ type: "error", msg: "Le titre est obligatoire." });
      return;
    }

    const patch = {
      titre,
      corps_etat: editCorpsEtat.trim() || null,
      date: editDate || null,
      status: editStatus ?? "A_FAIRE",
      intervenant_id: editIntervenantId === "__NONE__" ? null : editIntervenantId,
    };

    setSavingTask(true);
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));

    try {
      await updateTask(t.id, patch as any);
      setToast({ type: "ok", msg: "Tâche mise à jour." });
      setEditingTaskId(null);
    } catch (e: any) {
      await refreshTasksOnly();
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour tâche." });
    } finally {
      setSavingTask(false);
    }
  }

  // ----- intervenants -----
  function startEditIntervenant(i: IntervenantRow) {
    setEditingIntervenant(i);
    setEditIntervenantNom(i.nom ?? "");
    setEditIntervenantEmail(i.email ?? "");
    setEditIntervenantTel(i.telephone ?? "");
  }
  function cancelEditIntervenant() {
    setEditingIntervenant(null);
    setSavingIntervenant(false);
  }

  async function saveEditIntervenant() {
    if (!editingIntervenant) return;

    const nom = (editIntervenantNom ?? "").trim();
    if (!nom) {
      setToast({ type: "error", msg: "Le nom de l’intervenant est obligatoire." });
      return;
    }

    setSavingIntervenant(true);
    try {
      const updated = await updateIntervenant(editingIntervenant.id, {
        nom,
        email: editIntervenantEmail.trim() || null,
        telephone: editIntervenantTel.trim() || null,
      });

      setIntervenants((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.nom.localeCompare(b.nom)),
      );

      setToast({ type: "ok", msg: "Intervenant mis à jour." });
      setEditingIntervenant(null);
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour intervenant." });
    } finally {
      setSavingIntervenant(false);
    }
  }

  async function onDeleteIntervenant(i: IntervenantRow) {
    const ok = confirm(`Supprimer l’intervenant "${i.nom}" ?`);
    if (!ok) return;

    try {
      await deleteIntervenant(i.id);
      setIntervenants((prev) => prev.filter((x) => x.id !== i.id));
      setToast({ type: "ok", msg: "Intervenant supprimé." });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur suppression intervenant." });
    }
  }

  async function onCreateIntervenantFromTab(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const nom = newIntervenantNom.trim();
    if (!nom) {
      setToast({ type: "error", msg: "Nom intervenant obligatoire." });
      return;
    }

    setCreatingIntervenant(true);
    setIntervenantsError(null);

    try {
      const created = await createIntervenant({
        chantier_id: id,
        nom,
        email: newIntervenantEmail.trim() || null,
        telephone: newIntervenantTel.trim() || null,
      });

      setIntervenants((prev) => [...prev, created].sort((a, b) => a.nom.localeCompare(b.nom)));

      setNewIntervenantNom("");
      setNewIntervenantEmail("");
      setNewIntervenantTel("");

      setToast({ type: "ok", msg: "Intervenant ajouté." });
    } catch (e: any) {
      setIntervenantsError(e?.message ?? "Erreur création intervenant.");
      setToast({ type: "error", msg: e?.message ?? "Erreur création intervenant." });
    } finally {
      setCreatingIntervenant(false);
    }
  }
  // ----- ✅ ENVOI ACCÈS -----
  // ✅ même si le mail ne part pas : on récupère accessUrl et on te le donne pour le partager manuellement
  async function onSendAccess(i: IntervenantRow) {
    if (!id) return;

    const email = (i.email ?? "").trim();
    if (!email || !email.includes("@")) {
      setToast({ type: "error", msg: "Email intervenant manquant ou invalide." });
      return;
    }

    try {
      setSendingAccessId(i.id);

      const resp = (await sendIntervenantAccess({
        chantierId: id,
        intervenantId: i.id,
        // l'edge function va relire l'email en base si besoin, mais on peut aussi le passer
        email,
      })) as SendAccessResponse;

      const accessUrl = (resp as any)?.accessUrl;

      if (accessUrl) {
        const copied = await copyToClipboard(accessUrl);
        if (copied) {
          setToast({ type: "ok", msg: `Lien d’accès copié. Tu peux l’envoyer à ${i.nom}.` });
        } else {
          // fallback simple (fonctionne partout)
          window.prompt("Copie ce lien et envoie-le à l’intervenant :", accessUrl);
          setToast({ type: "ok", msg: `Lien d’accès généré. Envoie-le à ${i.nom}.` });
        }
      } else {
        // si pas d'URL retournée, on indique quand même que c'est “tenté”
        setToast({ type: "ok", msg: `Accès généré / envoyé à ${i.nom}.` });
      }
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur lors de l’envoi de l’accès." });
    } finally {
      setSendingAccessId(null);
    }
  }

  // ----- devis -----
  async function onCreateDevis(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const nom = newDevisNom.trim();
    if (!nom) {
      setDevisError("Le nom du devis est obligatoire.");
      return;
    }

    setCreatingDevis(true);
    setDevisError(null);
    try {
      const d = await createDevis({ chantier_id: id, nom });
      setDevis((prev) => [d, ...prev]);
      setNewDevisNom("");
      setToast({ type: "ok", msg: "Devis créé." });
    } catch (err: any) {
      setDevisError(err?.message ?? "Erreur création devis.");
      setToast({ type: "error", msg: err?.message ?? "Erreur création devis." });
    } finally {
      setCreatingDevis(false);
    }
  }

  async function onAddLigne(e: FormEvent) {
    e.preventDefault();
    if (!activeDevisId) return;

    const designation = lDesignation.trim();
    if (!designation) {
      setLignesError("La désignation est obligatoire.");
      return;
    }

    setAddingLigne(true);
    setLignesError(null);

    const qty = Number(String(lQty ?? "1").replace(",", "."));
    const q = Number.isFinite(qty) ? qty : 1;

    try {
      const created = await createDevisLigne({
        devis_id: activeDevisId,
        ordre: (lignes?.length ?? 0) + 1,
        corps_etat: lCorpsEtat.trim() || null,
        entreprise: lEntreprise.trim() || null,
        designation,
        unite: lUnite.trim() || null,
        quantite: q,
        prix_unitaire_ht: null,
        tva_rate: null,
        generer_tache: lGen,
        titre_tache: null,
        date_prevue: null,
      } as any);

      setLignes((prev) => [...prev, created]);

      setLCorpsEtat("");
      setLEntreprise("");
      setLDesignation("");
      setLUnite("U");
      setLQty("1");
      setLGen(true);

      setToast({ type: "ok", msg: "Ligne ajoutée." });

      if (lGen && id) {
        await refreshTasksOnly();
      }
    } catch (err: any) {
      setLignesError(err?.message ?? "Erreur lors de l’ajout de la ligne.");
      setToast({ type: "error", msg: err?.message ?? "Erreur ajout ligne." });
    } finally {
      setAddingLigne(false);
    }
  }

  async function onDeleteLigne(ligneId: string) {
    try {
      await deleteDevisLigne(ligneId);
      setLignes((prev) => prev.filter((x) => x.id !== ligneId));
      setToast({ type: "ok", msg: "Ligne supprimée." });
    } catch (e: any) {
      setLignesError(e?.message ?? "Erreur suppression ligne.");
      setToast({ type: "error", msg: e?.message ?? "Erreur suppression ligne." });
    }
  }

  // ----- ✅ Import PDF -----
  async function onImportDevisPdf() {
    if (!id) return;
    if (!importPdfFile) {
      setImportPdfError("Sélectionne un PDF.");
      return;
    }
    if (!activeDevisId) {
      setImportPdfError("Ouvre un devis (bouton “Voir lignes”) pour importer dedans.");
      return;
    }

    setImportPdfBusy(true);
    setImportPdfError(null);

    try {
      const extractedText = await extractTextFromPdf(importPdfFile);
      await importDevisPdfToLinesAndTasks({
        chantierId: id,
        devisId: activeDevisId,
        extractedText,
      });

      await refreshTasksOnly();
      const data = await listDevisLignes(activeDevisId);
      setLignes(data);

      setImportPdfFile(null);
      setToast({ type: "ok", msg: "Devis importé : lignes + tâches générées." });
    } catch (e: any) {
      setImportPdfError(e?.message ?? "Erreur import PDF.");
      setToast({ type: "error", msg: e?.message ?? "Erreur import PDF." });
    } finally {
      setImportPdfBusy(false);
    }
  }

  // ----- matériel -----
  function materielStatusLabel(s: MaterielStatus) {
    if (s === "COMMANDE") return "Commandé";
    if (s === "LIVRE") return "Livré";
    return "À commander";
  }

  function materielStatusBadgeClass(s: MaterielStatus) {
    if (s === "LIVRE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "COMMANDE") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }

  async function onAddMateriel(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const intervenant_id = mIntervenantId === "__NONE__" ? "" : mIntervenantId;
    const designation = mDesignation.trim();
    const rawQty = String(mQuantite ?? "1").trim().replace(",", ".");
    const qty = Number(rawQty);

    if (!intervenant_id) {
      setMaterielError("Intervenant obligatoire.");
      return;
    }
    if (!designation) {
      setMaterielError("Désignation obligatoire.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setMaterielError("Quantité invalide.");
      return;
    }

    setAddingMateriel(true);
    setMaterielError(null);

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: any = {
      id: tempId,
      chantier_id: id,
      intervenant_id,
      designation,
      quantite: qty,
      unite: mUnite.trim() || null,
      date_souhaitee: mDate || null,
      status: mStatus,
      remarques: mRemarques.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMateriel((prev) => [optimistic, ...prev]);

    try {
      const saved = await createMaterielDemande({
        chantier_id: id,
        intervenant_id,
        designation,
        quantite: qty,
        unite: mUnite.trim() || null,
        date_souhaitee: mDate || null,
        status: mStatus,
        remarques: mRemarques.trim() || null,
      } as any);

      setMateriel((prev) => prev.map((x) => (x.id === tempId ? (saved as any) : x)));

      setMIntervenantId("__NONE__");
      setMDesignation("");
      setMQuantite("1");
      setMUnite("");
      setMDate("");
      setMStatus("A_COMMANDER");
      setMRemarques("");

      setToast({ type: "ok", msg: "Demande matériel ajoutée." });
    } catch (e: any) {
      setMateriel((prev) => prev.filter((x) => x.id !== tempId));
      setMaterielError(e?.message ?? "Erreur ajout matériel.");
      setToast({ type: "error", msg: e?.message ?? "Erreur ajout matériel." });
    } finally {
      setAddingMateriel(false);
    }
  }

  async function onUpdateMaterielStatus(row: MaterielDemandeRow, status: MaterielStatus) {
    setMateriel((prev) => prev.map((x) => (x.id === row.id ? { ...x, status } : x)));
    try {
      await updateMaterielDemande(row.id, { status } as any);
    } catch (e: any) {
      await refreshMateriel();
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour matériel." });
    }
  }

  async function onDeleteMateriel(row: MaterielDemandeRow) {
    const ok = confirm(`Supprimer la demande "${row.designation}" ?`);
    if (!ok) return;

    const before = materiel;
    setMateriel((prev) => prev.filter((x) => x.id !== row.id));

    try {
      await deleteMaterielDemande(row.id);
      setToast({ type: "ok", msg: "Demande supprimée." });
    } catch (e: any) {
      setMateriel(before);
      setToast({ type: "error", msg: e?.message ?? "Erreur suppression matériel." });
    }
  }

  /* ---------------- guards ---------------- */
  if (!id) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">Chantier introuvable</div>
        <div className="text-slate-500 text-sm mt-1">ID manquant.</div>
        <div className="mt-4">
          <Link to="/chantiers" className="rounded-xl border px-3 py-2 hover:bg-slate-50">
            Retour aux chantiers
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">Chargement…</div>
        <div className="text-slate-500 text-sm mt-1">Ouverture du dossier chantier.</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        {errorMsg}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">Chantier introuvable</div>
        <div className="text-slate-500 text-sm mt-1">Aucun chantier ne correspond à cet ID.</div>
      </div>
    );
  }

  // KPIs placeholders
  const reservesOuvertes = 0;
  const documentsCount = 0;
  const tempsHeures = totalTempsReel;

  /* ---------------- render ---------------- */
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={[
            "fixed right-6 bottom-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg",
            toast.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="text-sm text-slate-500">
            <Link to="/chantiers" className="hover:underline">
              Chantiers
            </Link>{" "}
            / <span className="text-slate-700">{item.nom}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold truncate">{item.nom}</h1>
            <span className={["text-xs px-2 py-1 rounded-full border", badge.className].join(" ")}>
              {badge.label}
            </span>
          </div>

          <div className="text-slate-500 text-sm">
            {item.client ?? "—"} • {item.adresse ?? "—"}
          </div>
        </div>

        <Link to="/chantiers" className="rounded-xl border px-4 py-2 hover:bg-slate-50">
          Retour
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-slate-500">Réserves ouvertes</div>
          <div className="text-2xl font-bold mt-1">{reservesOuvertes}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-slate-500">Documents</div>
          <div className="text-2xl font-bold mt-1">{documentsCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-slate-500">Temps saisi</div>
          <div className="text-2xl font-bold mt-1">{tempsHeures} h</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-slate-500">Temps prévu</div>
          <div className="text-2xl font-bold mt-1">{tempsPrevues} h</div>
        </div>
      </div>

      {/* Avancement */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex justify-between text-sm">
          <div className="text-slate-600">Avancement</div>
          <div className="font-semibold">{avancement}%</div>
        </div>
        <div className="h-3 mt-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-slate-900" style={{ width: `${avancement}%` }} />
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 flex-wrap">
        <TabButton active={tab === "devis-taches"} onClick={() => setTab("devis-taches")}>
          Devis & tâches
        </TabButton>
        <TabButton active={tab === "intervenants"} onClick={() => setTab("intervenants")}>
          Intervenants
        </TabButton>
        <TabButton active={tab === "temps"} onClick={() => setTab("temps")}>
          Temps
        </TabButton>
        <TabButton active={tab === "planning"} onClick={() => setTab("planning")}>
          Planning
        </TabButton>
        <TabButton active={tab === "plans-reserves"} onClick={() => setTab("plans-reserves")}>
          Plans & réserves
        </TabButton>
        <TabButton active={tab === "materiel"} onClick={() => setTab("materiel")}>
          Matériel
        </TabButton>
        <TabButton active={tab === "messagerie"} onClick={() => setTab("messagerie")}>
          Messagerie
        </TabButton>
        <TabButton active={tab === "rapports"} onClick={() => setTab("rapports")}>
          Rapports
        </TabButton>
      </div>

      {/* Contenu */}
      <div className="rounded-2xl border bg-white p-6">
        {/* ---------------- ONGLET TEMPS ---------------- */}
        {tab === "temps" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Temps (par tâche)</div>
                <div className="text-sm text-slate-500">
                  Renseigne date début / fin et ajoute des heures. Le total s’additionne automatiquement.
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Total saisi : <span className="font-semibold">{totalTempsReel} h</span>
              </div>
            </div>

            <div className="space-y-2">
              {tasks.map((t: any) => {
                const d = timeDraftByTaskId[t.id] ?? { date_debut: "", date_fin: "", ajout_h: "" };
                const it = t.intervenant_id ? intervenantById.get(t.intervenant_id) : null;

                return (
                  <div key={t.id} className="rounded-xl border p-3 space-y-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{stripLegacyPrefix(t.titre ?? "")}</div>
                      <div className="text-xs text-slate-500">
                        {(t.corps_etat ?? "—")} • Intervenant : {it?.nom ?? "—"}
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-5">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">Date début</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          type="date"
                          value={d.date_debut}
                          onChange={(e) =>
                            setTimeDraftByTaskId((prev) => ({
                              ...prev,
                              [t.id]: { ...d, date_debut: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">Date fin</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          type="date"
                          value={d.date_fin}
                          onChange={(e) =>
                            setTimeDraftByTaskId((prev) => ({
                              ...prev,
                              [t.id]: { ...d, date_fin: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">Total actuel (h)</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm bg-slate-50"
                          value={toInputNumberString((t as any).temps_reel_h)}
                          disabled
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">Ajouter (h)</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          inputMode="decimal"
                          placeholder="ex: 1.5"
                          value={d.ajout_h}
                          onChange={(e) =>
                            setTimeDraftByTaskId((prev) => ({
                              ...prev,
                              [t.id]: { ...d, ajout_h: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          disabled={savingTimeTaskId === t.id}
                          className={[
                            "rounded-xl px-4 py-2 text-sm",
                            savingTimeTaskId === t.id
                              ? "bg-slate-300 text-slate-700"
                              : "bg-slate-900 text-white hover:bg-slate-800",
                          ].join(" ")}
                          onClick={async () => {
                            setSavingTimeTaskId(t.id);

                            const date_debut = d.date_debut ? d.date_debut : null;
                            const date_fin = d.date_fin ? d.date_fin : null;

                            const addStr = normalizeHoursInput(d.ajout_h);
                            const add = addStr === "" ? 0 : Number(addStr);

                            if (!Number.isFinite(add) || add < 0) {
                              setToast({ type: "error", msg: "Ajout (h) invalide (ex: 1.5 ou 1,5)." });
                              setSavingTimeTaskId(null);
                              return;
                            }

                            const hadAny =
                              (t as any).temps_reel_h !== null && (t as any).temps_reel_h !== undefined;
                            const current = Number((t as any).temps_reel_h ?? 0);

                            const nextTotal =
                              !hadAny && add === 0 ? null : Math.round((current + add) * 100) / 100;

                            // optimistic
                            setTasks((prev: any[]) =>
                              prev.map((x) =>
                                x.id === t.id ? { ...x, date_debut, date_fin, temps_reel_h: nextTotal } : x,
                              ),
                            );

                            try {
                              await updateTask(t.id, { date_debut, date_fin, temps_reel_h: nextTotal } as any);

                              // reset ajout
                              setTimeDraftByTaskId((prev) => ({
                                ...prev,
                                [t.id]: { ...d, ajout_h: "" },
                              }));

                              setToast({ type: "ok", msg: "Temps enregistré." });
                            } catch (e: any) {
                              await refreshTasksOnly();
                              setToast({ type: "error", msg: e?.message ?? "Erreur enregistrement temps." });
                            } finally {
                              setSavingTimeTaskId(null);
                            }
                          }}
                        >
                          {savingTimeTaskId === t.id ? "Enregistrement…" : "Enregistrer"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-500">
              Note : “Ajouter (h)” s’additionne au total. Laisse vide si tu ne veux rien ajouter.
            </div>
          </div>
        )}

        {/* ---------------- ONGLET INTERVENANTS ---------------- */}
        {tab === "intervenants" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Intervenants</div>
                <div className="text-sm text-slate-500">
                  Créer, modifier et supprimer les intervenants du chantier
                </div>
              </div>
              <button
                type="button"
                onClick={refreshIntervenants}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                disabled={intervenantsLoading}
              >
                {intervenantsLoading ? "Chargement…" : "Rafraîchir"}
              </button>
            </div>

            {intervenantsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {intervenantsError}
              </div>
            )}

            <form onSubmit={onCreateIntervenantFromTab} className="rounded-xl border bg-slate-50 p-4 space-y-3">
              <div className="font-semibold text-sm">Ajouter un intervenant</div>
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="Nom (ex: Pierre — Plombier)"
                  value={newIntervenantNom}
                  onChange={(e) => setNewIntervenantNom(e.target.value)}
                />
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="Email (optionnel)"
                  value={newIntervenantEmail}
                  onChange={(e) => setNewIntervenantEmail(e.target.value)}
                />
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="Téléphone (optionnel)"
                  value={newIntervenantTel}
                  onChange={(e) => setNewIntervenantTel(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creatingIntervenant}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    creatingIntervenant ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {creatingIntervenant ? "Création…" : "+ Ajouter"}
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {intervenantsLoading ? (
                <div className="text-sm text-slate-500">Chargement…</div>
              ) : intervenants.length === 0 ? (
                <div className="text-sm text-slate-500">Aucun intervenant pour le moment.</div>
              ) : (
                intervenants.map((i) => (
                  <div key={i.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{i.nom}</div>
                      <div className="text-xs text-slate-500">
                        {(i.email ?? "—")} • {(i.telephone ?? "—")}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSendAccess(i)}
                        disabled={sendingAccessId === i.id}
                        className={[
                          "text-sm rounded-xl border px-3 py-2",
                          sendingAccessId === i.id ? "bg-slate-100 text-slate-500" : "hover:bg-slate-50",
                        ].join(" ")}
                        title={i.email ? `Générer / envoyer accès à ${i.email}` : "Email manquant"}
                      >
                        {sendingAccessId === i.id ? "Envoi…" : "Envoyer accès"}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditIntervenant(i)}
                        className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                      >
                        Modifier
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteIntervenant(i)}
                        className="text-sm rounded-xl border border-red-200 text-red-700 px-3 py-2 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------------- ONGLET DEVIS & TÂCHES ---------------- */}
        {tab === "devis-taches" && (
          <div className="space-y-8">
            {/* DEVIS */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Devis</div>
                  <div className="text-sm text-slate-500">Mode manuel + import PDF</div>
                </div>
                <div className="text-xs text-slate-500">
                  {devisLoading ? "Chargement…" : `${devis.length} devis`}
                </div>
              </div>

              {devisError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {devisError}
                </div>
              )}

              <form className="grid gap-2 md:grid-cols-3" onSubmit={onCreateDevis}>
                <input
                  className="rounded-xl border px-3 py-2 text-sm md:col-span-2"
                  placeholder="Nom du devis"
                  value={newDevisNom}
                  onChange={(e) => setNewDevisNom(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={creatingDevis}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    creatingDevis ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {creatingDevis ? "Création…" : "+ Nouveau devis"}
                </button>
              </form>

              {/* ✅ IMPORT PDF : NE PAS SUPPRIMER */}
              <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
                <div className="font-semibold text-sm">Importer un devis PDF</div>

                {importPdfError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {importPdfError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setImportPdfFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={onImportDevisPdf}
                    disabled={importPdfBusy}
                    className={[
                      "rounded-xl px-4 py-2 text-sm",
                      importPdfBusy ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                    ].join(" ")}
                  >
                    {importPdfBusy ? "Import…" : "Importer"}
                  </button>
                  <div className="text-xs text-slate-500">
                    Devis ouvert : <span className="font-semibold">{activeDevisId ? "Oui" : "Non"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {devis.map((d: any) => {
                  const isOpen = activeDevisId === d.id;
                  return (
                    <div key={d.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{d.nom ?? "Devis"}</div>
                          <div className="text-xs text-slate-500">ID : {d.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                            onClick={() => setActiveDevisId(isOpen ? null : d.id)}
                          >
                            {isOpen ? "Fermer" : "Voir lignes"}
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
                          {lignesError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                              {lignesError}
                            </div>
                          )}

                          {lignesLoading ? (
                            <div className="text-sm text-slate-500">Chargement…</div>
                          ) : lignes.length === 0 ? (
                            <div className="text-sm text-slate-500">Aucune ligne.</div>
                          ) : (
                            <div className="space-y-2">
                              {lignes.map((l: any) => (
                                <div key={l.id} className="flex justify-between items-start border-b py-2 text-sm gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium">{l.designation}</div>
                                    <div className="text-xs text-slate-500">
                                      {(l.corps_etat ?? "—")} {" • "}
                                      {l.entreprise ?? "—"} {" • "}
                                      {(l.quantite ?? "—")} {(l.unite ?? "")}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteLigne(l.id)}
                                    className="text-red-600 text-xs hover:underline"
                                  >
                                    Suppr
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Ajouter une ligne */}
                          <div className="pt-2">
                            <div className="font-semibold text-sm">Ajouter une ligne</div>
                            <form onSubmit={onAddLigne} className="mt-2 grid gap-2">
                              <div className="grid gap-2 md:grid-cols-2">
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder="Corps d’état (lot)"
                                  value={lCorpsEtat}
                                  onChange={(e) => setLCorpsEtat(e.target.value)}
                                />
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder="Entreprise"
                                  value={lEntreprise}
                                  onChange={(e) => setLEntreprise(e.target.value)}
                                />
                              </div>

                              <input
                                className="rounded-xl border px-3 py-2 text-sm"
                                placeholder="Désignation"
                                value={lDesignation}
                                onChange={(e) => setLDesignation(e.target.value)}
                              />

                              <div className="grid gap-2 md:grid-cols-3">
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder="Unité"
                                  value={lUnite}
                                  onChange={(e) => setLUnite(e.target.value)}
                                />
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder="Qté"
                                  value={lQty}
                                  onChange={(e) => setLQty(e.target.value)}
                                />
                                <label className="text-sm text-slate-700 flex items-center gap-2 justify-between">
                                  <span className="flex items-center gap-2">
                                    <input type="checkbox" checked={lGen} onChange={(e) => setLGen(e.target.checked)} />
                                    Générer une tâche
                                  </span>
                                </label>
                              </div>

                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  disabled={addingLigne}
                                  className={[
                                    "rounded-xl px-4 py-2 text-sm",
                                    addingLigne ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                                  ].join(" ")}
                                >
                                  {addingLigne ? "Ajout…" : "+ Ajouter ligne"}
                                </button>
                              </div>

                              <div className="text-xs text-slate-500">
                                Simple : lot + entreprise + désignation + unité + quantité.
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* TÂCHES */}
            <section className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">Tâches</div>
                  <div className="text-sm text-slate-500">Attribution par intervenant + modification</div>
                </div>
                <div className="text-xs text-slate-500">
                  {tasksLoading ? "Chargement…" : `${filteredTasks.length} / ${tasks.length} tâche(s)`}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={filterLot}
                  onChange={(e) => setFilterLot(e.target.value)}
                >
                  <option value="__ALL__">Tous les lots</option>
                  {taskLots.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={filterIntervenant}
                  onChange={(e) => setFilterIntervenant(e.target.value)}
                  disabled={intervenantsLoading}
                >
                  <option value="__ALL__">Tous les intervenants</option>
                  <option value="__NONE__">Non attribué</option>
                  {intervenants.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ AJOUT TÂCHE */}
              <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
                <form onSubmit={addTask} className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      className="rounded-xl border px-3 py-2 text-sm md:col-span-2"
                      placeholder="Titre"
                      value={newTitre}
                      onChange={(e) => setNewTitre(e.target.value)}
                    />
                    <input
                      className="rounded-xl border px-3 py-2 text-sm"
                      placeholder="Corps d’état (lot)"
                      value={newCorpsEtat}
                      onChange={(e) => setNewCorpsEtat(e.target.value)}
                    />
                    <input
                      className="rounded-xl border px-3 py-2 text-sm"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <select
                      className="rounded-xl border px-3 py-2 text-sm"
                      value={newIntervenantId}
                      onChange={(e) => setNewIntervenantId(e.target.value)}
                      disabled={intervenantsLoading}
                    >
                      <option value="__NONE__">Intervenant : non attribué</option>
                      {intervenants.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nom}
                        </option>
                      ))}
                    </select>

                    <div className="md:col-span-2 text-xs text-slate-500 flex items-center">
                      Astuce : crée tes intervenants dans l’onglet “Intervenants”, puis attribue-les ici.
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={addingTask}
                      className={[
                        "rounded-xl px-4 py-2 text-sm",
                        addingTask ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {addingTask ? "Ajout…" : "+ Ajouter tâche"}
                    </button>
                  </div>
                </form>
              </div>

              {tasksError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {tasksError}
                </div>
              )}

              <div className="space-y-2">
                {filteredTasks.map((t: any) => {
                  const isEditing = editingTaskId === t.id;
                  const displayTitre = stripLegacyPrefix(t.titre ?? "");
                  const it = t.intervenant_id ? intervenantById.get(t.intervenant_id) : null;

                  return (
                    <div key={t.id} className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={t.status === "FAIT"} onChange={() => toggleTaskDone(t)} />

                        <div className="flex-1 min-w-0">
                          {!isEditing ? (
                            <>
                              <div className="font-medium truncate">{displayTitre}</div>
                              <div className="text-xs text-slate-500">
                                {(t.corps_etat ?? "—")} • Intervenant : {it?.nom ?? "—"}
                                {t.date ? ` • ${t.date}` : ""}
                              </div>
                            </>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-6">
                              <input
                                className="rounded-xl border px-3 py-2 text-sm md:col-span-2"
                                value={editTitre}
                                onChange={(e) => setEditTitre(e.target.value)}
                                placeholder="Titre"
                              />
                              <input
                                className="rounded-xl border px-3 py-2 text-sm"
                                value={editCorpsEtat}
                                onChange={(e) => setEditCorpsEtat(e.target.value)}
                                placeholder="Lot"
                              />
                              <select
                                className="rounded-xl border px-3 py-2 text-sm"
                                value={editStatus as any}
                                onChange={(e) => setEditStatus(e.target.value as any)}
                              >
                                <option value="A_FAIRE">À faire</option>
                                <option value="EN_COURS">En cours</option>
                                <option value="FAIT">Fait</option>
                              </select>
                              <input
                                className="rounded-xl border px-3 py-2 text-sm"
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                              <select
                                className="rounded-xl border px-3 py-2 text-sm"
                                value={editIntervenantId}
                                onChange={(e) => setEditIntervenantId(e.target.value)}
                              >
                                <option value="__NONE__">Non attribué</option>
                                {intervenants.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.nom}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <span className={["text-xs px-2 py-1 rounded-full border", taskStatusBadgeClass(t.status)].join(" ")}>
                          {taskStatusLabel(t.status)}
                        </span>
                      </div>

                      {!isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditTask(t)}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                          >
                            Modifier
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditTask}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                            disabled={savingTask}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditTask(t)}
                            className={[
                              "text-sm rounded-xl px-3 py-2",
                              savingTask ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                            ].join(" ")}
                            disabled={savingTask}
                          >
                            {savingTask ? "Enregistrement…" : "Enregistrer"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ---------------- ONGLET MATÉRIEL ---------------- */}
        {tab === "materiel" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Matériel</div>
                <div className="text-sm text-slate-500">
                  Demandes matériel avec statut : À commander / Commandé / Livré.
                </div>
              </div>
              <button
                type="button"
                onClick={refreshMateriel}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                disabled={materielLoading}
              >
                {materielLoading ? "Chargement…" : "Rafraîchir"}
              </button>
            </div>

            {materielError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {materielError}
              </div>
            )}

            <form onSubmit={onAddMateriel} className="rounded-xl border bg-slate-50 p-4 space-y-3">
              <div className="font-semibold text-sm">Créer une demande de matériel</div>

              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={mIntervenantId}
                  onChange={(e) => setMIntervenantId(e.target.value)}
                >
                  <option value="__NONE__">Intervenant (obligatoire)</option>
                  {intervenants.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nom}
                    </option>
                  ))}
                </select>

                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="Désignation (obligatoire)"
                  value={mDesignation}
                  onChange={(e) => setMDesignation(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    placeholder="Qté"
                    value={mQuantite}
                    onChange={(e) => setMQuantite(e.target.value)}
                  />
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    placeholder="Unité (ex: U, m², ml...)"
                    value={mUnite}
                    onChange={(e) => setMUnite(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  type="date"
                  value={mDate}
                  onChange={(e) => setMDate(e.target.value)}
                />

                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={mStatus}
                  onChange={(e) => setMStatus(e.target.value as any)}
                >
                  <option value="A_COMMANDER">À commander</option>
                  <option value="COMMANDE">Commandé</option>
                  <option value="LIVRE">Livré</option>
                </select>

                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="Remarques (optionnel)"
                  value={mRemarques}
                  onChange={(e) => setMRemarques(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingMateriel}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    addingMateriel ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {addingMateriel ? "Ajout…" : "+ Ajouter"}
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {materielLoading ? (
                <div className="text-sm text-slate-500">Chargement…</div>
              ) : materiel.length === 0 ? (
                <div className="text-sm text-slate-500">Aucune demande matériel.</div>
              ) : (
                materiel.map((m: any) => {
                  const it = intervenantById.get(m.intervenant_id);
                  return (
                    <div key={m.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {m.designation} • Qté {m.quantite}
                            {m.unite ? ` ${m.unite}` : ""}
                          </div>
                          <div className="text-xs text-slate-500">Intervenant : {it?.nom ?? "—"}</div>
                        </div>

                        <span className={["text-xs px-2 py-1 rounded-full border", materielStatusBadgeClass(m.status)].join(" ")}>
                          {materielStatusLabel(m.status)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <select
                          className="rounded-xl border px-3 py-2 text-sm"
                          value={m.status}
                          onChange={(e) => onUpdateMaterielStatus(m, e.target.value as any)}
                        >
                          <option value="A_COMMANDER">À commander</option>
                          <option value="COMMANDE">Commandé</option>
                          <option value="LIVRE">Livré</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => onDeleteMateriel(m)}
                          className="text-sm rounded-xl border border-red-200 text-red-700 px-3 py-2 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>

                      {m.remarques ? <div className="text-sm text-slate-600">{m.remarques}</div> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* autres onglets placeholders */}
        {tab !== "devis-taches" && tab !== "intervenants" && tab !== "temps" && tab !== "materiel" && (
          <div className="space-y-3">
            <div className="font-semibold">
              {tab === "planning" && "Planning"}
              {tab === "plans-reserves" && "Plans & réserves"}
              {tab === "messagerie" && "Messagerie"}
              {tab === "rapports" && "Rapports"}
            </div>
            <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
              Onglet en cours d’implémentation.
            </div>
          </div>
        )}

        {/* MODAL EDIT INTERVENANT */}
        {editingIntervenant && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => {
              if (!savingIntervenant) cancelEditIntervenant();
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white border p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">Modifier intervenant</div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={cancelEditIntervenant}
                  disabled={savingIntervenant}
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Nom</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={editIntervenantNom}
                    onChange={(e) => setEditIntervenantNom(e.target.value)}
                    placeholder="Nom"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Email</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={editIntervenantEmail}
                    onChange={(e) => setEditIntervenantEmail(e.target.value)}
                    placeholder="Email (optionnel)"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Téléphone</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={editIntervenantTel}
                    onChange={(e) => setEditIntervenantTel(e.target.value)}
                    placeholder="Téléphone (optionnel)"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={cancelEditIntervenant}
                  disabled={savingIntervenant}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    savingIntervenant ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                  onClick={saveEditIntervenant}
                  disabled={savingIntervenant}
                >
                  {savingIntervenant ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
