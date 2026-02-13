  // src/pages/ChantierPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent, MouseEvent, ReactNode } from "react";
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
import { importDevisPdfToLinesAndTasks, decodeQtyUnit } from "../services/devisImport.service";
import { extractTextFromPdf } from "../services/pdfText.service";
import PlanningPage from "../features/planning/PlanningPage";

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
import {
  listByChantier as listDocumentsByChantier,
  getSignedUrl,
  linkDocumentToTask,
  uploadDocument,
  listDocumentAccess,
  updateDocument,
  deleteDocument,
  updateDocumentAccess,
  type ChantierDocumentRow,
  type DocumentVisibilityOption,
  type DocumentVisibilityMode,
} from "../services/chantierDocuments.service";
import {
  listReservesByChantierId,
  createReserve,
  updateReserve,
  setReserveStatus,
  getTaskAssignee,
  type ChantierReserveRow,
  type ReservePriority,
  type ReserveStatus,
} from "../services/reserves.service";
import {
  listReserveDocuments,
  addReserveDocument,
} from "../services/reserveDocuments.service";
import {
  listReserveMarkers,
  addReserveMarker,
  type ReservePlanMarkerRow,
} from "../services/reserveMarkers.service";
import {
  listTaskDocuments,
  listTaskDocumentsByTaskIds,
  setTaskDocuments,
  type TaskDocumentLinkRow,
} from "../services/taskDocuments.service";
import TaskDocumentsDrawer from "../components/chantiers/TaskDocumentsDrawer";
import DocumentEditDrawer from "../components/chantiers/DocumentEditDrawer";

// ✅ ENVOI ACCÈS (Edge Function via service)
import { sendIntervenantAccess } from "../services/chantierAccessAdmin.service";

/* ---------------- types ---------------- */
type TabKey =
  | "devis-taches"
  | "documents"
  | "intervenants"
  | "planning"
  | "temps"
  | "reserves"
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

function reserveStatusBadge(status?: string | null) {
  const s = status ?? "OUVERTE";
  if (s === "LEVEE") {
    return { label: "Levée", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (s === "EN_COURS") {
    return { label: "En cours", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { label: "Ouverte", className: "bg-slate-50 text-slate-700 border-slate-200" };
}

function reservePriorityBadge(priority?: string | null) {
  const p = priority ?? "NORMALE";
  if (p === "URGENTE") {
    return { label: "Urgente", className: "bg-red-50 text-red-700 border-red-200" };
  }
  if (p === "BASSE") {
    return { label: "Basse", className: "bg-slate-50 text-slate-700 border-slate-200" };
  }
  return { label: "Normale", className: "bg-slate-50 text-slate-700 border-slate-200" };
}

function stripLegacyPrefix(titre: string) {
  const idx = titre.indexOf(" — ");
  if (idx <= 0) return titre;
  return titre.slice(idx + 3).trim();
}

function stripExtension(name: string) {
  return (name ?? "").replace(/\.[^/.]+$/, "");
}

const DOCUMENT_CATEGORIES = ["Administratif", "Plans", "Fiches techniques", "Photos", "PV", "DOE", "Divers"] as const;
const DOCUMENT_TYPES = [
  "PLAN",
  "FICHE_TECHNIQUE",
  "PHOTO",
  "MAIL",
  "PV",
  "DOE",
  "AUTRE",
] as const;
const DOCUMENT_VISIBILITY_OPTIONS = [
  { value: "GLOBAL", label: "Global" },
  { value: "RESTRICTED", label: "Restreint" },
  { value: "ADMIN_ONLY", label: "Admin uniquement" },
] as const;

function resolveVisibilityMode(option: DocumentVisibilityOption): DocumentVisibilityMode {
  return option === "GLOBAL" ? "GLOBAL" : "RESTRICTED";
}

function deriveLegacyVisibility(option: DocumentVisibilityOption, accessIds: string[]): string {
  if (option === "GLOBAL") return "INTERVENANT";
  if (option === "RESTRICTED") return accessIds.length ? "CUSTOM" : "ADMIN";
  return "ADMIN";
}

function formatDocumentVisibility(doc: ChantierDocumentRow): string {
  const mode = (doc.visibility_mode ?? "").toString().toUpperCase();
  const legacy = (doc.visibility ?? "").toString().toUpperCase();
  if (mode === "RESTRICTED" && legacy === "ADMIN") return "ADMIN";
  if (mode === "GLOBAL") return "GLOBAL";
  if (mode === "RESTRICTED") return "RESTRICTED";
  if (legacy === "ADMIN") return "ADMIN";
  if (legacy === "CUSTOM") return "RESTRICTED";
  if (legacy === "INTERVENANT" || legacy === "INTERVENANTS" || legacy === "CLIENT") return "GLOBAL";
  return legacy || "—";
}
function isAdminOnlyError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("not authorized") ||
    msg.includes("not allowed") ||
    msg.includes("rls")
  );
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
function toNumberOrNull(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const raw = v.trim().replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return null;
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

  // Documents
  const [documents, setDocuments] = useState<ChantierDocumentRow[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentCategory, setDocumentCategory] = useState("Divers");
  const [documentType, setDocumentType] = useState("AUTRE");
  const [documentVisibilityMode, setDocumentVisibilityMode] = useState<DocumentVisibilityOption>("GLOBAL");
  const [documentAccessIds, setDocumentAccessIds] = useState<string[]>([]);
  const [documentTaskId, setDocumentTaskId] = useState("");
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentModalError, setDocumentModalError] = useState<string | null>(null);
  const [documentDragActive, setDocumentDragActive] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState("");
  const [documentPreviewMime, setDocumentPreviewMime] = useState<string | null>(null);
  const [documentPreviewTitle, setDocumentPreviewTitle] = useState("");
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
  const [documentEditOpen, setDocumentEditOpen] = useState(false);
  const [documentEditDoc, setDocumentEditDoc] = useState<ChantierDocumentRow | null>(null);
  const [documentEditTitle, setDocumentEditTitle] = useState("");
  const [documentEditCategory, setDocumentEditCategory] = useState("Divers");
  const [documentEditType, setDocumentEditType] = useState("AUTRE");
  const [documentEditVisibilityMode, setDocumentEditVisibilityMode] = useState<DocumentVisibilityOption>("GLOBAL");
  const [documentEditAccessIds, setDocumentEditAccessIds] = useState<string[]>([]);
  const [documentEditSaving, setDocumentEditSaving] = useState(false);
  const [documentEditDeleting, setDocumentEditDeleting] = useState(false);
  const [documentEditError, setDocumentEditError] = useState<string | null>(null);
  const [documentEditLoadingAccess, setDocumentEditLoadingAccess] = useState(false);
  // Réserves
  const [reserves, setReserves] = useState<ChantierReserveRow[]>([]);
  const [reservesLoading, setReservesLoading] = useState(false);
  const [reservesError, setReservesError] = useState<string | null>(null);
  const [reservesFilter, setReservesFilter] = useState<"ALL" | "OUVERTES" | "LEVEES">("ALL");
  const [reserveDrawerOpen, setReserveDrawerOpen] = useState(false);
  const [activeReserve, setActiveReserve] = useState<ChantierReserveRow | null>(null);
  const [reserveDrawerTab, setReserveDrawerTab] = useState<"details" | "photos" | "plan">("details");
  const [reserveDrawerError, setReserveDrawerError] = useState<string | null>(null);
  const [reserveSaving, setReserveSaving] = useState(false);
  const [reserveDraftTitle, setReserveDraftTitle] = useState("");
  const [reserveDraftDescription, setReserveDraftDescription] = useState("");
  const [reserveDraftStatus, setReserveDraftStatus] = useState<ReserveStatus>("OUVERTE");
  const [reserveDraftPriority, setReserveDraftPriority] = useState<ReservePriority>("NORMALE");
  const [reserveDraftTaskId, setReserveDraftTaskId] = useState<string>("");
  const [reserveDraftIntervenantId, setReserveDraftIntervenantId] = useState<string>("__NONE__");
  const [reservePhotoUploading, setReservePhotoUploading] = useState(false);
  const [reservePhotoFile, setReservePhotoFile] = useState<File | null>(null);
  const [reservePhotos, setReservePhotos] = useState<ChantierDocumentRow[]>([]);
  const [reservePhotosLoading, setReservePhotosLoading] = useState(false);
  const [reservePhotoUrlCache, setReservePhotoUrlCache] = useState<Record<string, string>>({});
  const reservePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [reservePlanDocumentId, setReservePlanDocumentId] = useState("");
  const [reservePlanUrl, setReservePlanUrl] = useState("");
  const [reservePlanLoading, setReservePlanLoading] = useState(false);
  const [reservePlanError, setReservePlanError] = useState<string | null>(null);
  const [reserveMarkers, setReserveMarkers] = useState<ReservePlanMarkerRow[]>([]);
  const [reserveMarkersLoading, setReserveMarkersLoading] = useState(false);
  const [reserveSelectedMarkerId, setReserveSelectedMarkerId] = useState<string | null>(null);
  const [chantierDocuments, setChantierDocuments] = useState<ChantierDocumentRow[]>([]);
  const [taskDocumentLinks, setTaskDocumentLinks] = useState<TaskDocumentLinkRow[]>([]);
  const [taskDocumentsLoading, setTaskDocumentsLoading] = useState(false);
  const [taskDocumentsModalOpen, setTaskDocumentsModalOpen] = useState(false);
  const [taskDocumentsModalTask, setTaskDocumentsModalTask] = useState<ChantierTaskRow | null>(null);
  const [taskDocumentsSelection, setTaskDocumentsSelection] = useState<string[]>([]);
  const [taskDocumentsQuery, setTaskDocumentsQuery] = useState("");
  const [taskDocumentsModalSaving, setTaskDocumentsModalSaving] = useState(false);
  const [taskDocumentsModalError, setTaskDocumentsModalError] = useState<string | null>(null);

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
  const [newQuantite, setNewQuantite] = useState("1");
  const [newUnite, setNewUnite] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Edition tâche
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editTitre, setEditTitre] = useState("");
  const [editCorpsEtat, setEditCorpsEtat] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("A_FAIRE");
  const [editIntervenantId, setEditIntervenantId] = useState<string>("__NONE__");
  const [editQuantite, setEditQuantite] = useState("1");
  const [editUnite, setEditUnite] = useState("");

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

  function openDocumentModal() {
    setDocumentModalError(null);
    setDocumentModalOpen(true);
  }

  function closeDocumentModal() {
    if (documentUploading) return;
    setDocumentModalOpen(false);
    setDocumentModalError(null);
    setDocumentDragActive(false);
    setDocumentFile(null);
    setDocumentName("");
    setDocumentCategory("Divers");
    setDocumentType("AUTRE");
    setDocumentVisibilityMode("GLOBAL");
    setDocumentAccessIds([]);
    setDocumentTaskId("");
    if (documentInputRef.current) {
      documentInputRef.current.value = "";
    }
  }

  function setDocumentFileState(file: File | null) {
    setDocumentFile(file);
    setDocumentModalError(null);
    if (file) {
      setDocumentName(stripExtension(file.name));
    }
  }

  function onSelectDocumentFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setDocumentFileState(file);
  }

  function onDocumentDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDocumentDragActive(true);
  }

  function onDocumentDragLeave() {
    setDocumentDragActive(false);
  }

  function onDocumentDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDocumentDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    setDocumentFileState(file);
  }

  async function onImportDocument() {
    if (!id) {
      setDocumentModalError("Chantier manquant.");
      setToast({ type: "error", msg: "Chantier manquant." });
      return;
    }
    if (!documentFile) {
      setDocumentModalError("Fichier requis.");
      return;
    }
    if (!documentName.trim()) {
      setDocumentModalError("Nom du document requis.");
      return;
    }
    if (documentVisibilityMode === "RESTRICTED" && documentAccessIds.length === 0) {
      setDocumentModalError("Sélectionnez au moins un intervenant ou choisissez Admin uniquement.");
      return;
    }

    setDocumentUploading(true);
    setDocumentModalError(null);
    try {
      const accessIds = documentVisibilityMode === "RESTRICTED" ? documentAccessIds : [];
      const visibilityMode = resolveVisibilityMode(documentVisibilityMode);

      const created = await uploadDocument({
        chantierId: id,
        file: documentFile,
        title: documentName.trim(),
        category: documentCategory,
        documentType,
        visibility_mode: visibilityMode,
        accessIntervenantIds: accessIds,
      });

      if (documentTaskId) {
        await linkDocumentToTask(documentTaskId, created.id);
      }

      setDocumentsLoading(true);
      setDocumentsError(null);
      const data = await listDocumentsByChantier(id);
      setDocuments(data);
      setChantierDocuments(data);
      setToast({ type: "ok", msg: "Document importé." });
      closeDocumentModal();
    } catch (err: any) {
      console.error("[documents] upload error", err?.message ?? err);
      const message = err?.message ?? "Erreur upload document.";
      setDocumentModalError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setDocumentsLoading(false);
      setDocumentUploading(false);
    }
  }

  async function openDocumentPreview(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    setDocumentPreviewOpen(true);
    setDocumentPreviewLoading(true);
    setDocumentPreviewError(null);
    setDocumentPreviewUrl("");
    setDocumentPreviewTitle(doc.title || doc.file_name || "Document");
    setDocumentPreviewMime(doc.mime_type ?? null);
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      setDocumentPreviewUrl(url);
    } catch (err: any) {
      setDocumentPreviewError(err?.message ?? "Impossible d'ouvrir le document.");
    } finally {
      setDocumentPreviewLoading(false);
    }
  }

  function closeDocumentPreview() {
    if (documentPreviewLoading) return;
    setDocumentPreviewOpen(false);
    setDocumentPreviewUrl("");
    setDocumentPreviewError(null);
    setDocumentPreviewMime(null);
    setDocumentPreviewTitle("");
  }

  async function downloadDocument(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      setToast({ type: "error", msg: message });
    }
  }

  async function copyDocumentLink(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      await navigator.clipboard.writeText(url);
      setToast({ type: "ok", msg: "Lien copié (valable 60s)" });
    } catch (err: any) {
      setToast({ type: "error", msg: message });
    }
  }

  async function openDocumentEdit(doc: ChantierDocumentRow) {
    setDocumentEditDoc(doc);
    setDocumentEditTitle(doc.title ?? "");
    setDocumentEditCategory(doc.category ?? "Divers");
    setDocumentEditType(doc.document_type ?? "AUTRE");
    setDocumentEditError(null);
    setDocumentEditLoadingAccess(false);

    const mode = (doc.visibility_mode ?? "").toString().toUpperCase();
    const legacy = (doc.visibility ?? "").toString().toUpperCase();
    let nextMode: DocumentVisibilityOption = "GLOBAL";
    if (mode === "RESTRICTED") nextMode = "RESTRICTED";
    else if (mode === "GLOBAL") nextMode = "GLOBAL";
    else if (legacy === "ADMIN") nextMode = "ADMIN_ONLY";
    else if (legacy === "CUSTOM") nextMode = "RESTRICTED";

    setDocumentEditVisibilityMode(nextMode);
    setDocumentEditAccessIds([]);
    setDocumentEditOpen(true);

    if (nextMode === "RESTRICTED") {
      setDocumentEditLoadingAccess(true);
      try {
        const accessIds = await listDocumentAccess(doc.id);
        setDocumentEditAccessIds(accessIds ?? []);
      } catch (err: any) {
        setDocumentEditAccessIds([]);
      const message = isAdminOnlyError(err)
        ? "Action reservee a l'admin."
        : err?.message ?? "Erreur mise a jour document.";
      setDocumentEditError(message);
      } finally {
        setDocumentEditLoadingAccess(false);
      }
    }
  }

  function closeDocumentEdit() {
    if (documentEditSaving || documentEditDeleting) return;
    setDocumentEditOpen(false);
    setDocumentEditDoc(null);
    setDocumentEditTitle("");
    setDocumentEditCategory("Divers");
    setDocumentEditType("AUTRE");
    setDocumentEditVisibilityMode("GLOBAL");
    setDocumentEditAccessIds([]);
    setDocumentEditError(null);
    setDocumentEditLoadingAccess(false);
  }

  async function saveDocumentEdit() {
    if (!documentEditDoc) {
      return;
    }
    if (documentEditVisibilityMode === "RESTRICTED" && documentEditAccessIds.length === 0) {
      setDocumentEditError("Sélectionnez au moins un intervenant ou choisissez Admin uniquement.");
      return;
    }

    setDocumentEditSaving(true);
    setDocumentEditError(null);
    try {
      const accessIds = documentEditVisibilityMode === "RESTRICTED" ? documentEditAccessIds : [];
      const visibilityMode = resolveVisibilityMode(documentEditVisibilityMode);
      const legacyVisibility = deriveLegacyVisibility(documentEditVisibilityMode, accessIds);

      const updated = await updateDocument(documentEditDoc.id, {
        title: documentEditTitle,
        category: documentEditCategory,
        document_type: documentEditType,
        visibility_mode: visibilityMode,
        legacy_visibility: legacyVisibility,
      });

      await updateDocumentAccess(documentEditDoc.id, accessIds);

      const data = await listDocumentsByChantier(updated.chantier_id);
      setDocuments(data);
      setChantierDocuments(data);
      setToast({ type: "ok", msg: "Document mis à jour." });
      closeDocumentEdit();
    } catch (err: any) {
      const message = isAdminOnlyError(err)
        ? "Action reservee a l'admin."
        : err?.message ?? "Erreur mise a jour document.";
      setDocumentEditError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setDocumentEditSaving(false);
    }
  }

  async function deleteDocumentEdit() {
    if (!documentEditDoc) {
      return;
    }
    const ok = confirm(`Supprimer le document "${documentEditDoc.title || documentEditDoc.file_name}" ?`);
    if (!ok) return;

    setDocumentEditDeleting(true);
    setDocumentEditError(null);
    try {
      await deleteDocument(documentEditDoc.id, documentEditDoc.storage_path);
      if (id) {
        const data = await listDocumentsByChantier(id);
        setDocuments(data);
        setChantierDocuments(data);
      }
      setToast({ type: "ok", msg: "Document supprimé." });
      closeDocumentEdit();
    } catch (err: any) {
      const message = isAdminOnlyError(err)
        ? "Action reservee a l'admin."
        : err?.message ?? "Erreur suppression document.";
      setDocumentEditError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setDocumentEditDeleting(false);
    }
  }

  function openReserveDrawer(reserve?: ChantierReserveRow | null) {
    setReserveDrawerError(null);
    setReserveDrawerTab("details");
    setReserveSelectedMarkerId(null);
    setReservePlanUrl("");
    setReservePlanError(null);
    setReservePlanDocumentId("");
    setReservePhotos([]);
    setReservePhotoFile(null);
    setReservePhotoUrlCache({});
    setReserveMarkers([]);

    if (reserve) {
      setActiveReserve(reserve);
      setReserveDraftTitle(reserve.title ?? "");
      setReserveDraftDescription(reserve.description ?? "");
      setReserveDraftStatus((reserve.status ?? "OUVERTE") as ReserveStatus);
      setReserveDraftPriority((reserve.priority ?? "NORMALE") as ReservePriority);
      setReserveDraftTaskId(reserve.task_id ?? "");
      setReserveDraftIntervenantId(reserve.intervenant_id ?? "__NONE__");
    } else {
      setActiveReserve(null);
      setReserveDraftTitle("");
      setReserveDraftDescription("");
      setReserveDraftStatus("OUVERTE");
      setReserveDraftPriority("NORMALE");
      setReserveDraftTaskId("");
      setReserveDraftIntervenantId("__NONE__");
    }
    setReserveDrawerOpen(true);
  }

  function closeReserveDrawer() {
    if (reserveSaving || reservePhotoUploading) return;
    setReserveDrawerOpen(false);
    setReserveDrawerError(null);
    setActiveReserve(null);
    setReservePlanDocumentId("");
    setReservePlanUrl("");
    setReservePlanError(null);
    setReserveMarkers([]);
    setReserveSelectedMarkerId(null);
    setReservePhotos([]);
    setReservePhotoFile(null);
    setReservePhotoUrlCache({});
  }

  async function refreshReserves() {
    if (!id) return;
    setReservesLoading(true);
    setReservesError(null);
    try {
      const data = await listReservesByChantierId(id);
      setReserves(data);
    } catch (err: any) {
      setReserves([]);
      setReservesError(err?.message ?? "Erreur chargement rÃ©serves.");
    } finally {
      setReservesLoading(false);
    }
  }

  async function refreshChantierDocuments() {
    if (!id) return [] as ChantierDocumentRow[];
    const data = await listDocumentsByChantier(id);
    setChantierDocuments(data);
    return data;
  }

  async function saveReserve() {
    if (!id) {
      setReserveDrawerError("Chantier manquant.");
      return;
    }
    if (!reserveDraftTitle.trim()) {
      setReserveDrawerError("Titre requis.");
      return;
    }
    if (!reserveDraftTaskId) {
      setReserveDrawerError("TÃ¢che requise.");
      return;
    }

    setReserveSaving(true);
    setReserveDrawerError(null);
    try {
      const taskId = reserveDraftTaskId || null;
      const derivedIntervenantId =
        taskId && selectedReserveTask?.intervenant_id
          ? selectedReserveTask.intervenant_id
          : reserveDraftIntervenantId !== "__NONE__"
            ? reserveDraftIntervenantId
            : null;

      if (activeReserve) {
        const updated = await updateReserve(activeReserve.id, {
          task_id: taskId,
          title: reserveDraftTitle.trim(),
          description: reserveDraftDescription.trim() || null,
          status: reserveDraftStatus,
          priority: reserveDraftPriority,
          intervenant_id: derivedIntervenantId,
        });
        setReserves((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setActiveReserve(updated);
        setToast({ type: "ok", msg: "RÃ©serve mise Ã  jour." });
      } else {
        const created = await createReserve({
          chantier_id: id,
          task_id: taskId,
          title: reserveDraftTitle.trim(),
          description: reserveDraftDescription.trim() || null,
          status: reserveDraftStatus,
          priority: reserveDraftPriority,
          intervenant_id: derivedIntervenantId,
        });
        setReserves((prev) => [created, ...prev]);
        setToast({ type: "ok", msg: "RÃ©serve crÃ©Ã©e." });
        closeReserveDrawer();
      }
    } catch (err: any) {
      setReserveDrawerError(err?.message ?? "Erreur sauvegarde rÃ©serve.");
      setToast({ type: "error", msg: message });
    } finally {
      setReserveSaving(false);
    }
  }

  async function markReserveLevee() {
    if (!activeReserve) return;
    setReserveSaving(true);
    setReserveDrawerError(null);
    try {
      const updated = await setReserveStatus(activeReserve.id, "LEVEE");
      setReserves((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setActiveReserve(updated);
      setReserveDraftStatus(updated.status as ReserveStatus);
      setToast({ type: "ok", msg: "RÃ©serve marquÃ©e levÃ©e." });
    } catch (err: any) {
      setReserveDrawerError(err?.message ?? "Erreur mise Ã  jour rÃ©serve.");
      setToast({ type: "error", msg: message });
    } finally {
      setReserveSaving(false);
    }
  }

  async function loadReservePhotos(reserveId: string) {
    if (!id) return;
    setReservePhotosLoading(true);
    try {
      const [links, docs] = await Promise.all([
        listReserveDocuments(reserveId, "PHOTO"),
        chantierDocuments.length ? Promise.resolve(chantierDocuments) : listDocumentsByChantier(id),
      ]);
      if (!chantierDocuments.length) {
        setChantierDocuments(docs);
      }
      const map = new Map<string, ChantierDocumentRow>();
      for (const doc of docs) map.set(doc.id, doc);
      const photos = (links ?? [])
        .map((link) => map.get(link.document_id))
        .filter(Boolean) as ChantierDocumentRow[];
      setReservePhotos(photos);
    } catch (err: any) {
      console.error("[reserves] load photos error", err?.message ?? err);
    } finally {
      setReservePhotosLoading(false);
    }
  }

  async function loadReserveMarkers(reserveId: string) {
    setReserveMarkersLoading(true);
    try {
      const data = await listReserveMarkers(reserveId);
      setReserveMarkers(data);
    } catch (err: any) {
      console.error("[reserves] load markers error", err?.message ?? err);
    } finally {
      setReserveMarkersLoading(false);
    }
  }

  async function onSelectReservePhoto(e: ChangeEvent<HTMLInputElement>) {
    if (!id || !activeReserve) return;
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setReservePhotoFile(file);
    setReservePhotoUploading(true);
    try {
      const created = await uploadDocument({
        chantierId: id,
        file,
        title: stripExtension(file.name),
        category: "Photos",
        documentType: "PHOTO",
        visibility_mode: "RESTRICTED",
        accessIntervenantIds: [],
      });
      await addReserveDocument({ reserve_id: activeReserve.id, document_id: created.id, role: "PHOTO" });
      await refreshChantierDocuments();
      await loadReservePhotos(activeReserve.id);
      setToast({ type: "ok", msg: "Photo ajoutÃ©e." });
    } catch (err: any) {
      setToast({ type: "error", msg: message });
    } finally {
      setReservePhotoUploading(false);
      setReservePhotoFile(null);
      if (reservePhotoInputRef.current) reservePhotoInputRef.current.value = "";
    }
  }

  async function onSelectReservePlan(documentId: string) {
    setReservePlanDocumentId(documentId);
    setReservePlanUrl("");
    setReservePlanError(null);
    setReserveSelectedMarkerId(null);
    if (!documentId) return;
    const doc = documentsById.get(documentId);
    if (!doc?.storage_path) {
      setReservePlanError("Chemin de stockage manquant.");
      return;
    }
    setReservePlanLoading(true);
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      setReservePlanUrl(url);
    } catch (err: any) {
      setReservePlanError(err?.message ?? "Impossible de charger le plan.");
    } finally {
      setReservePlanLoading(false);
    }
  }

  async function onClickPlanPreview(e: MouseEvent<HTMLDivElement>) {
    if (!activeReserve || !reservePlanDocumentId) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    try {
      const created = await addReserveMarker({
        reserve_id: activeReserve.id,
        plan_document_id: reservePlanDocumentId,
        x,
        y,
      });
      setReserveMarkers((prev) => [...prev, created]);
      setReserveSelectedMarkerId(created.id);
    } catch (err: any) {
      setToast({ type: "error", msg: message });
    }
  }

  async function openReserveDocument(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      setToast({ type: "error", msg: message });
    }
  }

  async function openTaskDocumentsModal(task: ChantierTaskRow) {
    if (!id) return;
    setTaskDocumentsModalError(null);
    setTaskDocumentsModalTask(task);
    setTaskDocumentsModalOpen(true);
    setTaskDocumentsQuery("");
    try {
      const [docs, linkedIds] = await Promise.all([
        chantierDocuments.length ? Promise.resolve(chantierDocuments) : listDocumentsByChantier(id),
        listTaskDocuments(task.id),
      ]);
      setChantierDocuments(docs);
      setTaskDocumentsSelection(linkedIds);
    } catch (err: any) {
      setTaskDocumentsModalError(err?.message ?? "Erreur chargement documents.");
    }
  }

  function closeTaskDocumentsModal() {
    if (taskDocumentsModalSaving) return;
    setTaskDocumentsModalOpen(false);
    setTaskDocumentsModalTask(null);
    setTaskDocumentsSelection([]);
    setTaskDocumentsQuery("");
    setTaskDocumentsModalError(null);
  }

  async function saveTaskDocuments() {
    if (!taskDocumentsModalTask) return;
    setTaskDocumentsModalSaving(true);
    setTaskDocumentsModalError(null);
    try {
      await setTaskDocuments(taskDocumentsModalTask.id, taskDocumentsSelection);
      const links = await listTaskDocumentsByTaskIds(tasks.map((t) => t.id));
      setTaskDocumentLinks(links);
      setToast({ type: "ok", msg: "Documents liés mis à jour." });
      closeTaskDocumentsModal();
    } catch (err: any) {
      setTaskDocumentsModalError(err?.message ?? "Erreur mise à jour des documents.");
      setToast({ type: "error", msg: message });
    } finally {
      setTaskDocumentsModalSaving(false);
    }
  }

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

  /* ---------------- load documents ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadDocuments() {
      if (!id || tab !== "documents") return;
      setDocumentsLoading(true);
      setDocumentsError(null);
      try {
        const data = await listDocumentsByChantier(id);
        if (!alive) return;
        setDocuments(data);
        setChantierDocuments(data);
      } catch (e: any) {
        if (!alive) return;
        setDocuments([]);
        setDocumentsError(e?.message ?? "Erreur chargement documents.");
      } finally {
        if (alive) setDocumentsLoading(false);
      }
    }

    loadDocuments();
    return () => {
      alive = false;
    };
  }, [id, tab]);

  /* ---------------- load reserves ---------------- */
  useEffect(() => {
    if (!id) return;
    void refreshReserves();
  }, [id]);

  const documentEditInfoMessage =
    documentEditOpen && !documentEditDoc ? "Document introuvable ou non accessible." : null;

  /* ---------------- reserve drawer side effects ---------------- */
  useEffect(() => {
    if (!reserveDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [reserveDrawerOpen]);

  useEffect(() => {
    if (!reserveDrawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeReserveDrawer();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reserveDrawerOpen]);

  useEffect(() => {
    if (!reserveDrawerOpen || !activeReserve) return;
    void loadReservePhotos(activeReserve.id);
    void loadReserveMarkers(activeReserve.id);
  }, [reserveDrawerOpen, activeReserve?.id]);

  useEffect(() => {
    if (!reserveDrawerOpen || reservePhotos.length === 0) return;
    let alive = true;

    async function loadPhotoUrls() {
      const missing = reservePhotos.filter(
        (doc) => doc.storage_path && !reservePhotoUrlCache[doc.id],
      );
      if (missing.length === 0) return;

      for (const doc of missing) {
        try {
          const url = await getSignedUrl(doc.storage_path, 60);
          if (!alive) return;
          setReservePhotoUrlCache((prev) => ({ ...prev, [doc.id]: url }));
        } catch (err) {
          if (!alive) return;
          console.warn("[reserves] photo url error", doc.id, err);
        }
      }
    }

    void loadPhotoUrls();
    return () => {
      alive = false;
    };
  }, [reserveDrawerOpen, reservePhotos, reservePhotoUrlCache]);

  /* ---------------- load task documents links ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadTaskDocuments() {
      if (!id) return;
      if (!tasks.length) {
        setTaskDocumentLinks([]);
        return;
      }
      setTaskDocumentsLoading(true);
      try {
        const [docs, links] = await Promise.all([
          listDocumentsByChantier(id),
          listTaskDocumentsByTaskIds(tasks.map((t) => t.id)),
        ]);
        if (!alive) return;
        setChantierDocuments(docs);
        setTaskDocumentLinks(links);
      } catch (e: any) {
        if (!alive) return;
        console.error("[documents] load task documents error", e?.message ?? e);
      } finally {
        if (alive) setTaskDocumentsLoading(false);
      }
    }

    loadTaskDocuments();
    return () => {
      alive = false;
    };
  }, [id, tasks]);

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

  const taskById = useMemo(() => {
    const m = new Map<string, ChantierTaskRow>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const selectedReserveTask = useMemo(() => {
    if (!reserveDraftTaskId) return null;
    return taskById.get(reserveDraftTaskId) ?? null;
  }, [taskById, reserveDraftTaskId]);

  useEffect(() => {
    let alive = true;
    if (!reserveDraftTaskId) return () => {};

    if (selectedReserveTask?.intervenant_id) {
      setReserveDraftIntervenantId(selectedReserveTask.intervenant_id);
      return () => {};
    }

    (async () => {
      try {
        const assigneeId = await getTaskAssignee(reserveDraftTaskId);
        if (!alive) return;
        setReserveDraftIntervenantId(assigneeId ?? "__NONE__");
      } catch (err) {
        if (!alive) return;
        console.warn("[reserves] assignee lookup error", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [reserveDraftTaskId, selectedReserveTask?.intervenant_id]);

  const selectedReserveIntervenant = useMemo(() => {
    if (selectedReserveTask?.intervenant_id) {
      return intervenantById.get(selectedReserveTask.intervenant_id) ?? null;
    }
    if (reserveDraftIntervenantId && reserveDraftIntervenantId !== "__NONE__") {
      return intervenantById.get(reserveDraftIntervenantId) ?? null;
    }
    return null;
  }, [selectedReserveTask, reserveDraftIntervenantId, intervenantById]);

  const taskLots = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      const ce = (t.corps_etat ?? "").trim();
      if (ce) set.add(ce);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const documentsById = useMemo(() => {
    const map = new Map<string, ChantierDocumentRow>();
    for (const doc of chantierDocuments) {
      map.set(doc.id, doc);
    }
    return map;
  }, [chantierDocuments]);

  const planDocuments = useMemo(() => {
    return chantierDocuments.filter((doc) => {
      return doc.document_type === "PLAN" || (doc.category ?? "") === "Plans";
    });
  }, [chantierDocuments]);

  const taskDocumentsByTaskId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of taskDocumentLinks) {
      if (!map.has(link.task_id)) map.set(link.task_id, []);
      map.get(link.task_id)?.push(link.document_id);
    }
    return map;
  }, [taskDocumentLinks]);

  const filteredReserves = useMemo(() => {
    if (reservesFilter === "ALL") return reserves;
    if (reservesFilter === "LEVEES") {
      return reserves.filter((r) => (r.status ?? "") === "LEVEE");
    }
    return reserves.filter((r) => (r.status ?? "") !== "LEVEE");
  }, [reserves, reservesFilter]);

  const reserveMarkersForPlan = useMemo(() => {
    if (!reservePlanDocumentId) return [];
    return reserveMarkers.filter((m) => m.plan_document_id === reservePlanDocumentId);
  }, [reserveMarkers, reservePlanDocumentId]);

  const selectedPlanDoc = useMemo(() => {
    if (!reservePlanDocumentId) return null;
    return documentsById.get(reservePlanDocumentId) ?? null;
  }, [documentsById, reservePlanDocumentId]);

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
  const reservesOuvertes = useMemo(() => {
    return reserves.filter((r) => (r.status ?? "") !== "LEVEE").length;
  }, [reserves]);
  const documentsCount = useMemo(() => {
    return Math.max(documents.length, chantierDocuments.length);
  }, [documents.length, chantierDocuments.length]);

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

    const qtyRaw = newQuantite.trim();
    const quantite = qtyRaw === "" ? 1 : toNumberOrNull(qtyRaw);
    if (quantite === null || quantite <= 0) {
      setTasksError("Quantite invalide.");
      return;
    }

    const unite = newUnite.trim() || null;

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
      quantite,
      unite,
      temps_prevu_h: null,
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
        quantite,
        unite,
      });

      setTasks((prev) => prev.map((t) => (t.id === tempId ? (saved as any) : t)));

      setNewTitre("");
      setNewCorpsEtat("");
      setNewDate("");
      setNewIntervenantId("__NONE__");
      setNewQuantite("1");
      setNewUnite("");

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
    const baseTitre = stripLegacyPrefix(t.titre ?? "");
    const decoded = decodeQtyUnit(baseTitre);
    const q = toNumberOrNull((t as any).quantite);
    const rawUnite = (t as any).unite;
    const unite = (typeof rawUnite === "string" ? rawUnite.trim() : "") || decoded.unite || "";
    setEditTitre(baseTitre);
    setEditCorpsEtat(t.corps_etat ?? "");
    setEditDate(t.date ?? "");
    setEditStatus((t.status ?? "A_FAIRE") as any);
    setEditIntervenantId(t.intervenant_id ?? "__NONE__");
    setEditQuantite(String(q ?? decoded.quantite ?? 1));
    setEditUnite(unite);
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

    const qtyRaw = editQuantite.trim();
    const quantite = qtyRaw === "" ? 1 : toNumberOrNull(qtyRaw);
    if (quantite === null || quantite <= 0) {
      setToast({ type: "error", msg: "Quantite invalide." });
      return;
    }

    const unite = editUnite.trim() || null;

    const patch = {
      titre,
      corps_etat: editCorpsEtat.trim() || null,
      date: editDate || null,
      status: editStatus ?? "A_FAIRE",
      intervenant_id: editIntervenantId === "__NONE__" ? null : editIntervenantId,
      quantite,
      unite,
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
      setToast({ type: "error", msg: message });
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
      setToast({ type: "error", msg: message });
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
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Pilotage chantier</div>
        <div className="flex gap-2 flex-wrap">
          <TabButton active={tab === "devis-taches"} onClick={() => setTab("devis-taches")}>
            Devis & tâches
          </TabButton>
          <TabButton active={tab === "temps"} onClick={() => setTab("temps")}>
            Temps
          </TabButton>
          <TabButton active={tab === "planning"} onClick={() => setTab("planning")}>
            Planning
          </TabButton>
          <TabButton active={tab === "reserves"} onClick={() => setTab("reserves")}>
            Réserves
          </TabButton>
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Gestion chantier</div>
        <div className="flex gap-2 flex-wrap">
          <TabButton active={tab === "intervenants"} onClick={() => setTab("intervenants")}>
            Intervenants
          </TabButton>
          <TabButton active={tab === "documents"} onClick={() => setTab("documents")}>
            Documents
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

        {/* ---------------- ONGLET DOCUMENTS ---------------- */}
        {tab === "documents" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="font-semibold">Documents</div>
              <button
                type="button"
                onClick={openDocumentModal}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
              >
                Importer document
              </button>
            </div>

            {documentsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {documentsError}
              </div>
            )}

            {documentsLoading ? (
              <div className="text-sm text-slate-500">Chargement...</div>
            ) : documents.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                Aucun document pour ce chantier.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nom</th>
                      <th className="px-3 py-2 text-left font-medium">Catégorie</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Visibilité</th>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium truncate">{doc.title}</div>
                          <div className="text-xs text-slate-500 truncate">{doc.file_name}</div>
                        </td>
                        <td className="px-3 py-2">{doc.category}</td>
                        <td className="px-3 py-2">{doc.document_type}</td>
                        <td className="px-3 py-2">{formatDocumentVisibility(doc)}</td>
                        <td className="px-3 py-2">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString("fr-FR") : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openDocumentEdit(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => openDocumentPreview(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              Ouvrir
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadDocument(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              Télécharger
                            </button>
                            <button
                              type="button"
                              onClick={() => copyDocumentLink(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              Copier lien
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---------------- ONGLET RÉSERVES ---------------- */}
        {tab === "reserves" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Réserves</div>
                <div className="text-sm text-slate-500">Suivi des réserves chantier.</div>
              </div>
              <button
                type="button"
                onClick={() => openReserveDrawer(null)}
                className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
              >
                Nouvelle réserve
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "ALL", label: "Toutes" },
                  { key: "OUVERTES", label: "Ouvertes" },
                  { key: "LEVEES", label: "Levées" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setReservesFilter(f.key)}
                  className={[
                    "px-3 py-1.5 rounded-xl text-xs border",
                    reservesFilter === f.key
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {reservesError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {reservesError}
              </div>
            )}

            {reservesLoading ? (
              <div className="text-sm text-slate-500">Chargement…</div>
            ) : filteredReserves.length === 0 ? (
              <div className="text-sm text-slate-500">Aucune réserve pour ce chantier.</div>
            ) : (
              <div className="space-y-3">
                {filteredReserves.map((reserve) => {
                  const status = reserveStatusBadge(reserve.status);
                  const priority = reservePriorityBadge(reserve.priority);
                  const task = reserve.task_id ? taskById.get(reserve.task_id) : null;
                  const it = task?.intervenant_id ? intervenantById.get(task.intervenant_id) : null;

                  return (
                    <div
                      key={reserve.id}
                      className="rounded-xl border p-4 hover:bg-slate-50 cursor-pointer"
                      onClick={() => openReserveDrawer(reserve)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{reserve.title}</div>
                          {reserve.description ? (
                            <div className="text-xs text-slate-500 line-clamp-2">
                              {reserve.description}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">Aucune description.</div>
                          )}
                        </div>
                        <span
                          className={[
                            "text-xs px-2 py-1 rounded-full border shrink-0",
                            status.className,
                          ].join(" ")}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={["px-2 py-1 rounded-full border", priority.className].join(" ")}>
                          {priority.label}
                        </span>
                        <span>Tâche : {task ? stripLegacyPrefix(task.titre ?? "") : "—"}</span>
                        <span>Intervenant : {it?.nom ?? "—"}</span>
                        <span>
                          Créée : {new Date(reserve.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  <div className="grid gap-2 md:grid-cols-6">
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
                    <input
                      className="rounded-xl border px-3 py-2 text-sm"
                      inputMode="decimal"
                      placeholder="Quantite"
                      value={newQuantite}
                      onChange={(e) => setNewQuantite(e.target.value)}
                    />
                    <input
                      className="rounded-xl border px-3 py-2 text-sm"
                      placeholder="Unite"
                      value={newUnite}
                      onChange={(e) => setNewUnite(e.target.value)}
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
                  const decoded = decodeQtyUnit(displayTitre);
                  const displayTitreClean = decoded.cleanTitle || displayTitre;
                  const quantiteRaw = toNumberOrNull((t as any).quantite);
                  const uniteRaw = (t as any).unite;
                  const quantiteValue = quantiteRaw ?? decoded.quantite;
                  const uniteValue =
                    (typeof uniteRaw === "string" ? uniteRaw.trim() : "") || decoded.unite || null;

                  const tempsPasse = Number((t as any).temps_reel_h ?? 0);
                  const tempsPasseDisplay = Math.round(tempsPasse * 100) / 100;
                  const tempsPrevu = toNumberOrNull((t as any).temps_prevu_h);

                  let avancementPct: number | null = null;
                  if (tempsPrevu !== null && tempsPrevu > 0) {
                    avancementPct = Math.min(100, Math.round((tempsPasse / tempsPrevu) * 100));
                  } else {
                    const uniteNorm = (uniteValue ?? "").toString().trim().toLowerCase();
                    if (
                      (uniteNorm === "h" || uniteNorm === "heure" || uniteNorm === "heures") &&
                      quantiteValue !== null &&
                      quantiteValue > 0
                    ) {
                      avancementPct = Math.min(100, Math.round((tempsPasse / quantiteValue) * 100));
                    }
                  }

                  const qtyLabel =
                    quantiteValue === null ? "Qte: --" : `Qte: ${quantiteValue}${uniteValue ? ` ${uniteValue}` : ""}`;
                  const tempsPasseLabel = `Temps passe: ${tempsPasseDisplay} h`;
                  const avancementLabel =
                    avancementPct === null ? "Avancement (temps): --" : `Avancement (temps): ${avancementPct}%`;
                  const it = t.intervenant_id ? intervenantById.get(t.intervenant_id) : null;

                  return (
                    <div key={t.id} className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={t.status === "FAIT"} onChange={() => toggleTaskDone(t)} />

                        <div className="flex-1 min-w-0">
                          {!isEditing ? (
                            <>
                              <div className="font-medium truncate">{displayTitreClean}</div>
                              <div className="text-xs text-slate-500">
                                {(t.corps_etat ?? "—")} • Intervenant : {it?.nom ?? "—"}
                                {t.date ? ` • ${t.date}` : ""}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {qtyLabel} / {tempsPasseLabel} / {avancementLabel}
                              </div>
                            </>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-8">
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
                              <input
                                className="rounded-xl border px-3 py-2 text-sm"
                                inputMode="decimal"
                                value={editQuantite}
                                onChange={(e) => setEditQuantite(e.target.value)}
                                placeholder="Quantite"
                              />
                              <input
                                className="rounded-xl border px-3 py-2 text-sm"
                                value={editUnite}
                                onChange={(e) => setEditUnite(e.target.value)}
                                placeholder="Unite"
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

                      {(() => {
                        const linkedIds = taskDocumentsByTaskId.get(t.id) ?? [];
                        const linkedDocs = linkedIds
                          .map((docId) => documentsById.get(docId))
                          .filter((doc): doc is ChantierDocumentRow => Boolean(doc));
                        const visibleDocs = linkedDocs.slice(0, 3);
                        const extraCount = Math.max(0, linkedDocs.length - visibleDocs.length);

                        return (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-500 font-medium">Documents liés</div>
                              <button
                                type="button"
                                onClick={() => openTaskDocumentsModal(t)}
                                className="text-xs rounded-lg border px-2 py-1 hover:bg-slate-50"
                              >
                                Lier documents
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {linkedDocs.length === 0 ? (
                                <span className="text-xs text-slate-500">Aucun</span>
                              ) : (
                                <>
                                  {visibleDocs.map((doc) => (
                                    <span
                                      key={doc.id}
                                      className="text-xs rounded-full border bg-slate-50 px-2 py-1 text-slate-700"
                                    >
                                      {doc.title}
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <span className="text-xs rounded-full border bg-slate-50 px-2 py-1 text-slate-700">
                                      +{extraCount}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

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

        {tab === "planning" && id && (
          <PlanningPage chantierId={id} chantierName={item?.nom ?? null} intervenants={intervenants} />
        )}

        {/* autres onglets placeholders */}
        {tab !== "devis-taches" &&
          tab !== "intervenants" &&
          tab !== "documents" &&
          tab !== "reserves" &&
          tab !== "temps" &&
          tab !== "materiel" &&
          tab !== "planning" && (
            <div className="space-y-3">
              <div className="font-semibold">
                {tab === "messagerie" && "Messagerie"}
                {tab === "rapports" && "Rapports"}
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                Onglet en cours d’implémentation.
              </div>
            </div>
          )}

        {/* DRAWER RESERVES */}
        {reserveDrawerOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={closeReserveDrawer} />
            <div className="absolute right-0 top-0 h-screen w-[50vw] max-w-[900px] min-w-[360px] bg-white border-l shadow-xl flex flex-col">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold truncate">
                  Réserve — {activeReserve?.title ?? "Nouvelle réserve"}
                </div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={closeReserveDrawer}
                  disabled={reserveSaving}
                >
                  ✕
                </button>
              </div>

              <div className="px-4 py-2 border-b flex gap-2">
                {(
                  [
                    { key: "details", label: "Détails" },
                    { key: "photos", label: "Photos" },
                    { key: "plan", label: "Plan" },
                  ] as const
                ).map((t) => {
                  const disabled = !activeReserve && t.key !== "details";
                  return (
                    <button
                      key={t.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => setReserveDrawerTab(t.key)}
                      className={[
                        "px-3 py-1.5 rounded-xl text-xs border",
                        reserveDrawerTab === t.key
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                        disabled ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                {reserveDrawerTab === "details" && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">Titre</div>
                      <input
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={reserveDraftTitle}
                        onChange={(e) => setReserveDraftTitle(e.target.value)}
                        placeholder="Titre de la réserve"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">Description</div>
                      <textarea
                        className="w-full rounded-xl border px-3 py-2 text-sm min-h-[120px]"
                        value={reserveDraftDescription}
                        onChange={(e) => setReserveDraftDescription(e.target.value)}
                        placeholder="Décrivez la réserve..."
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">Statut</div>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={reserveDraftStatus}
                          onChange={(e) => setReserveDraftStatus(e.target.value as ReserveStatus)}
                        >
                          <option value="OUVERTE">OUVERTE</option>
                          <option value="EN_COURS">EN_COURS</option>
                          <option value="LEVEE">LEVEE</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">Priorité</div>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={reserveDraftPriority}
                          onChange={(e) => setReserveDraftPriority(e.target.value as ReservePriority)}
                        >
                          <option value="BASSE">BASSE</option>
                          <option value="NORMALE">NORMALE</option>
                          <option value="URGENTE">URGENTE</option>
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <div className="text-xs text-slate-600">Tâche</div>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={reserveDraftTaskId}
                          onChange={(e) => setReserveDraftTaskId(e.target.value)}
                        >
                          <option value="">Sélectionner une tâche</option>
                          {tasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {stripLegacyPrefix(t.titre ?? "Tâche")}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <div className="text-xs text-slate-600">Intervenant</div>
                        <select
                          className={[
                            "w-full rounded-xl border px-3 py-2 text-sm",
                            reserveDraftTaskId ? "bg-slate-50 text-slate-600" : "bg-white",
                          ].join(" ")}
                          value={
                            reserveDraftTaskId
                              ? selectedReserveTask?.intervenant_id ?? "__NONE__"
                              : reserveDraftIntervenantId
                          }
                          onChange={(e) => setReserveDraftIntervenantId(e.target.value)}
                          disabled={!!reserveDraftTaskId}
                        >
                          <option value="__NONE__">Aucun intervenant</option>
                          {intervenants.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {activeReserve && (
                      <div>
                        <button
                          type="button"
                          onClick={markReserveLevee}
                          disabled={reserveSaving || reserveDraftStatus === "LEVEE"}
                          className={[
                            "rounded-xl border px-3 py-2 text-sm",
                            reserveDraftStatus === "LEVEE"
                              ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                          ].join(" ")}
                        >
                          Marquer levée
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {reserveDrawerTab === "photos" && (
                  <div className="space-y-4">
                    {!activeReserve ? (
                      <div className="text-sm text-slate-500">
                        Créez la réserve pour ajouter des photos.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">Photos</div>
                          <div className="flex items-center gap-2">
                            <input
                              ref={reservePhotoInputRef}
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={onSelectReservePhoto}
                            />
                            <button
                              type="button"
                              onClick={() => reservePhotoInputRef.current?.click()}
                              disabled={reservePhotoUploading}
                              className={[
                                "rounded-xl px-3 py-2 text-sm",
                                reservePhotoUploading
                                  ? "bg-slate-300 text-slate-700"
                                  : "bg-slate-900 text-white hover:bg-slate-800",
                              ].join(" ")}
                            >
                              {reservePhotoUploading ? "Upload..." : "Ajouter photo"}
                            </button>
                          </div>
                        </div>

                        {reservePhotoFile && (
                          <div className="text-xs text-slate-500">
                            Fichier sÃ©lectionnÃ© : {reservePhotoFile.name}
                          </div>
                        )}

                        {reservePhotosLoading ? (
                          <div className="text-sm text-slate-500">Chargement...</div>
                        ) : reservePhotos.length === 0 ? (
                          <div className="text-sm text-slate-500">Aucune photo liée.</div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {reservePhotos.map((doc) => {
                              const url = reservePhotoUrlCache[doc.id];
                              const isImage = (doc.mime_type ?? "").startsWith("image/");
                              return (
                                <div key={doc.id} className="rounded-xl border p-2 space-y-2">
                                  <div className="aspect-[4/3] rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden">
                                    {isImage && url ? (
                                      <img
                                        src={url}
                                        alt={doc.title}
                                        className="w-full h-full object-contain"
                                      />
                                    ) : (
                                      <div className="text-xs text-slate-500">Aperçu indisponible</div>
                                    )}
                                  </div>
                                  <div className="text-xs font-medium truncate">{doc.title}</div>
                                  <button
                                    type="button"
                                    onClick={() => openReserveDocument(doc)}
                                    className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                                  >
                                    Ouvrir
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {reserveDrawerTab === "plan" && (
                  <div className="space-y-4">
                    {!activeReserve ? (
                      <div className="text-sm text-slate-500">
                        Créez la réserve pour lier un plan.
                      </div>
                    ) : planDocuments.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        Aucun plan disponible. Ajoutez un document de type PLAN dans l’onglet Documents.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div className="space-y-1 min-w-[220px]">
                            <div className="text-xs text-slate-600">Choisir un plan</div>
                            <select
                              className="w-full rounded-xl border px-3 py-2 text-sm"
                              value={reservePlanDocumentId}
                              onChange={(e) => onSelectReservePlan(e.target.value)}
                            >
                              <option value="">Sélectionner un plan</option>
                              {planDocuments.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.title || doc.file_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            disabled={!selectedPlanDoc}
                            onClick={() => selectedPlanDoc && openReserveDocument(selectedPlanDoc)}
                            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            Ouvrir
                          </button>
                        </div>

                        {reservePlanError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {reservePlanError}
                          </div>
                        )}

                        {!reservePlanDocumentId ? (
                          <div className="text-sm text-slate-500">Choisissez un plan pour l’afficher.</div>
                        ) : reservePlanLoading ? (
                          <div className="text-sm text-slate-500">Chargement du plan…</div>
                        ) : !reservePlanUrl ? (
                          <div className="text-sm text-slate-500">Aperçu indisponible.</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-500">
                              Cliquez sur le plan pour placer un repère.
                            </div>
                            <div className="relative w-full h-[60vh] rounded-xl border overflow-hidden bg-slate-50">
                              {(selectedPlanDoc?.mime_type ?? "").startsWith("image/") ? (
                                <img
                                  src={reservePlanUrl}
                                  alt={selectedPlanDoc?.title ?? "Plan"}
                                  className="w-full h-full object-contain"
                                />
                              ) : selectedPlanDoc?.mime_type === "application/pdf" ? (
                                <iframe
                                  src={reservePlanUrl}
                                  title={selectedPlanDoc?.title ?? "Plan"}
                                  className="w-full h-full pointer-events-none"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                                  Aperçu non disponible.
                                </div>
                              )}

                              <div className="absolute inset-0" onClick={onClickPlanPreview}>
                                {reserveMarkersForPlan.map((marker) => {
                                  const selected = reserveSelectedMarkerId === marker.id;
                                  return (
                                    <div
                                      key={marker.id}
                                      className="absolute"
                                      style={{
                                        left: `${marker.x * 100}%`,
                                        top: `${marker.y * 100}%`,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReserveSelectedMarkerId(marker.id);
                                          if (marker.label) {
                                            setToast({ type: "ok", msg: marker.label });
                                          }
                                        }}
                                        className={[
                                          "w-3 h-3 rounded-full border",
                                          selected ? "bg-amber-500 border-amber-600" : "bg-red-500 border-red-600",
                                        ].join(" ")}
                                        style={{ transform: "translate(-50%, -50%)" }}
                                      />
                                      {selected && marker.label && (
                                        <div className="absolute left-3 top-0 text-xs bg-white border rounded px-2 py-1 shadow">
                                          {marker.label}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {reserveMarkersLoading && (
                              <div className="text-xs text-slate-500">Chargement des repères…</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {reserveDrawerError && (
                <div className="mx-4 my-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {reserveDrawerError}
                </div>
              )}

              <div className="border-t p-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={closeReserveDrawer}
                  disabled={reserveSaving}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveReserve}
                  disabled={reserveSaving}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    reserveSaving ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {reserveSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}

        <TaskDocumentsDrawer
          open={taskDocumentsModalOpen}
          taskTitle={taskDocumentsModalTask?.titre ?? "Tâche"}
          documents={chantierDocuments}
          selectedIds={taskDocumentsSelection}
          onSelectionChange={setTaskDocumentsSelection}
          query={taskDocumentsQuery}
          onQueryChange={setTaskDocumentsQuery}
          onClose={closeTaskDocumentsModal}
          onSave={saveTaskDocuments}
          saving={taskDocumentsModalSaving}
          error={taskDocumentsModalError}
          loading={taskDocumentsLoading}
        />

        <DocumentEditDrawer
          open={documentEditOpen}
          documentTitle={documentEditDoc?.title ?? documentEditDoc?.file_name ?? "Document"}
          title={documentEditTitle}
          category={documentEditCategory}
          documentType={documentEditType}
          visibilityMode={documentEditVisibilityMode}
          accessIds={documentEditAccessIds}
          intervenants={intervenants}
          onTitleChange={setDocumentEditTitle}
          onCategoryChange={setDocumentEditCategory}
          onDocumentTypeChange={setDocumentEditType}
          onVisibilityModeChange={setDocumentEditVisibilityMode}
          onAccessIdsChange={setDocumentEditAccessIds}
          onClose={closeDocumentEdit}
          onSave={saveDocumentEdit}
          onDelete={deleteDocumentEdit}
          saving={documentEditSaving}
          deleting={documentEditDeleting}
          loadingAccess={documentEditLoadingAccess}
          error={documentEditError}
          infoMessage={documentEditInfoMessage}
          canSave={documentEditOpen && !!documentEditDoc}
        />

        {/* MODAL IMPORT DOCUMENT */}
        {documentModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={closeDocumentModal}
          >
            <div
              className="w-full max-w-2xl rounded-2xl bg-white border p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">Importer un document</div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={closeDocumentModal}
                  disabled={documentUploading}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-600">Fichier</div>
                  <div
                    className={[
                      "rounded-xl border border-dashed px-4 py-6 text-sm text-slate-600 text-center cursor-pointer",
                      documentDragActive ? "bg-slate-50 border-slate-400" : "bg-white border-slate-200",
                    ].join(" ")}
                    onClick={() => documentInputRef.current?.click()}
                    onDragOver={onDocumentDragOver}
                    onDragLeave={onDocumentDragLeave}
                    onDrop={onDocumentDrop}
                  >
                    {documentFile ? (
                      <div className="space-y-2">
                        <div className="font-medium text-slate-900 truncate">{documentFile.name}</div>
                        <div className="text-xs">
                          Taille : {(documentFile.size / (1024 * 1024)).toFixed(2)} Mo • Type :{" "}
                          {documentFile.type || "—"}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocumentFileState(null);
                          }}
                          className="rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                          disabled={documentUploading}
                        >
                          Retirer
                        </button>
                      </div>
                    ) : (
                      <div>
                        Glissez-déposez un fichier ici ou cliquez pour sélectionner.
                        <div className="text-xs text-slate-500 mt-1">
                          PDF, images, Word, Excel
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={documentInputRef}
                    type="file"
                    hidden
                    onChange={onSelectDocumentFile}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Nom du document</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder="Nom du document"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Catégorie</div>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentCategory}
                      onChange={(e) => setDocumentCategory(e.target.value)}
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Type</div>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                    >
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Mode visibilité</div>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentVisibilityMode}
                      onChange={(e) => setDocumentVisibilityMode(e.target.value as DocumentVisibilityOption)}
                    >
                      {DOCUMENT_VISIBILITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Intervenants autorisés</div>
                  <div
                    className={[
                      "rounded-xl border p-3 space-y-2 max-h-40 overflow-auto",
                      documentVisibilityMode === "RESTRICTED" ? "bg-white" : "bg-slate-50 text-slate-400",
                    ].join(" ")}
                  >
                    {intervenantsLoading ? (
                      <div className="text-xs text-slate-500">Chargement...</div>
                    ) : intervenants.length === 0 ? (
                      <div className="text-xs text-slate-500">Aucun intervenant disponible.</div>
                    ) : (
                      intervenants.map((i) => {
                        const checked = documentAccessIds.includes(i.id);
                        return (
                          <label key={i.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={documentVisibilityMode !== "RESTRICTED"}
                              onChange={() =>
                                setDocumentAccessIds((prev) =>
                                  checked ? prev.filter((id) => id !== i.id) : [...prev, i.id],
                                )
                              }
                            />
                            <span>{i.nom}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {documentVisibilityMode !== "RESTRICTED" && (
                    <div className="text-xs text-slate-500">Sélection désactivée pour ce mode.</div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Lier à une tâche (optionnel)</div>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={documentTaskId}
                    onChange={(e) => setDocumentTaskId(e.target.value)}
                    disabled={tasksLoading}
                  >
                    <option value="">Aucune</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titre}
                      </option>
                    ))}
                  </select>
                </div>

                {documentModalError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {documentModalError}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={closeDocumentModal}
                    disabled={documentUploading}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={onImportDocument}
                    disabled={documentUploading}
                    className={[
                      "rounded-xl px-4 py-2 text-sm",
                      documentUploading
                        ? "bg-slate-300 text-slate-700"
                        : "bg-slate-900 text-white hover:bg-slate-800",
                    ].join(" ")}
                  >
                    {documentUploading ? "Import..." : "Importer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PREVIEW DOCUMENT */}
        {documentPreviewOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={closeDocumentPreview}
          >
            <div
              className="w-full max-w-4xl rounded-2xl bg-white border p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold truncate">{documentPreviewTitle}</div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={closeDocumentPreview}
                  disabled={documentPreviewLoading}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4">
                {documentPreviewLoading ? (
                  <div className="text-sm text-slate-500">Chargement...</div>
                ) : documentPreviewError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {documentPreviewError}
                  </div>
                ) : documentPreviewMime?.startsWith("image/") ? (
                  <img src={documentPreviewUrl} alt={documentPreviewTitle} className="max-h-[70vh] w-auto mx-auto" />
                ) : documentPreviewMime === "application/pdf" ? (
                  <iframe
                    src={documentPreviewUrl}
                    title={documentPreviewTitle}
                    className="w-full h-[70vh] rounded-xl border"
                  />
                ) : (
                  <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                    Aperçu non disponible.
                  </div>
                )}
              </div>
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









