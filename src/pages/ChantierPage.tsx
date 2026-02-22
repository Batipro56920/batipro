  // src/pages/ChantierPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

import { getChantierById, type ChantierRow } from "../services/chantiers.service";

import {
  getTasksByChantierIdDetailed,
  createTask,
  updateTask,
  type ChantierTaskRow,
  type TaskStatus,
} from "../services/chantierTasks.service";

import {
  listDevisByChantierId,
  listDevisLignes,
  createDevisLigne,
  deleteDevisLigne,
  type DevisRow,
  type DevisLigneRow,
} from "../services/devis.service";

import { decodeQtyUnit } from "../services/devisImport.service";
import PlanningTab from "../components/chantiers/PlanningTab";

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
  listReserveMarkersByPlan,
  addReserveMarker,
  removeReserveMarker,
  removeReserveMarkersGroup,
  renameReserveMarkersGroup,
  type ReservePlanMarkerRow,
} from "../services/reserveMarkers.service";
import {
  listTaskDocuments,
  listTaskDocumentsByTaskIds,
  setTaskDocuments,
  type TaskDocumentLinkRow,
} from "../services/taskDocuments.service";
import {
  listDoeItemsByChantierId,
  removeDoeItem,
  reorderDoeItems,
  upsertDoeItem,
} from "../services/chantierDoe.service";
import TaskDocumentsDrawer from "../components/chantiers/TaskDocumentsDrawer";
import DocumentEditDrawer from "../components/chantiers/DocumentEditDrawer";
import ReservePlanViewer from "../components/chantiers/ReservePlanViewer";
import VisiteTab from "../components/chantiers/VisiteTab";
import DoeTab from "../components/chantiers/DoeTab";
import DevisImportDrawer, { type DevisImportResult } from "../components/chantiers/DevisImportDrawer";
import TaskTemplateDrawer from "../components/TaskTemplateDrawer";
import {
  create as createTaskTemplate,
  type TaskTemplateInput,
} from "../services/taskTemplates.service";

// ENVOI ACCÈS (Edge Function via service)
import { sendIntervenantAccess } from "../services/chantierAccessAdmin.service";
import { buildIntervenantLink } from "../lib/publicUrl";

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
  | "rapports"
  | "doe"
  | "visite";

type ToastState = { type: "ok" | "error"; msg: string } | null;

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
      className={["tab-btn", active ? "tab-btn--active" : "tab-btn--inactive"].join(" ")}
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

const DEFAULT_STANDARD_LOTS = [
  "Curage / Démolition",
  "Maçonnerie / Gros œuvre",
  "Charpente / Couverture",
  "Menuiseries extérieures",
  "Cloisons / Plâtrerie",
  "Isolation",
  "Électricité",
  "Plomberie",
  "Chauffage / Ventilation",
  "Sols",
  "Faïence / Carrelage",
  "Peinture",
  "Cuisine / Sanitaires",
  "Finitions / Nettoyage",
  "Extérieurs / VRD",
  "Divers / À classer",
] as const;

function normalizeLotLabel(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isIntervenantDuplicateEmailError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "").trim();
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return code === "23505" || msg.includes("intervenants_email_unique");
}

function isPublicAppUrlConfigError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? "");
  return msg.includes("VITE_PUBLIC_APP_URL");
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

const DOCUMENT_CATEGORIES = [
  "Administratif",
  "Plans",
  "Fiches techniques",
  "Photos",
  "PV",
  "VISITE",
  "DOE",
  "Divers",
] as const;
const DOCUMENT_TYPES = [
  "PLAN",
  "FICHE_TECHNIQUE",
  "PHOTO",
  "MAIL",
  "PV",
  "VISITE",
  "RAPPORT_CLIENT",
  "DOE",
  "PDF",
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
function visibilityBadgeClass(label: string) {
  const key = String(label || "").toLowerCase();
  if (key === "global") return "badge-visibility global";
  if (key === "restricted") return "badge-visibility restricted";
  if (key === "admin") return "badge-visibility admin";
  return "badge-visibility";
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
  const [tasksPlanningWarning, setTasksPlanningWarning] = useState<string | null>(null);

  // Temps tab (draft par tâche) : date début/fin + ajout (h)
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
  const [doeDocumentIds, setDoeDocumentIds] = useState<string[]>([]);
  const [doeSyncingDocumentId, setDoeSyncingDocumentId] = useState<string | null>(null);
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
  const [reserveMarkerSaving, setReserveMarkerSaving] = useState(false);
  const [reserveSelectedMarkerId, setReserveSelectedMarkerId] = useState<string | null>(null);
  const [reserveDrawingMode, setReserveDrawingMode] = useState(false);
  const [reserveShowAllMarkers, setReserveShowAllMarkers] = useState(false);
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

  // ENVOI ACCÈS (bouton "Envoyer accès")
  const [sendingAccessId, setSendingAccessId] = useState<string | null>(null);
  const [generatingIntervenantLink, setGeneratingIntervenantLink] = useState(false);
  const [generatedIntervenantLink, setGeneratedIntervenantLink] = useState<string>("");

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
  const [, setNewCorpsEtat] = useState("");
  const [newLotSelection, setNewLotSelection] = useState("");
  const [newLotDraftName, setNewLotDraftName] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("A_FAIRE");
  const [newDurationDays, setNewDurationDays] = useState("1");
  const [newOrderIndex, setNewOrderIndex] = useState("0");
  const [newIntervenantId, setNewIntervenantId] = useState<string>("__NONE__");
  const [newQuantite, setNewQuantite] = useState("1");
  const [newUnite, setNewUnite] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Edition tâche
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editTitre, setEditTitre] = useState("");
  const [editCorpsEtat, setEditCorpsEtat] = useState("");
  const [editLotSelection, setEditLotSelection] = useState("");
  const [editLotDraftName, setEditLotDraftName] = useState("");
  const [editDurationDays, setEditDurationDays] = useState("1");
  const [editOrderIndex, setEditOrderIndex] = useState("0");
  const [editStatus, setEditStatus] = useState<TaskStatus>("A_FAIRE");
  const [editIntervenantId, setEditIntervenantId] = useState<string>("__NONE__");
  const [editQuantite, setEditQuantite] = useState("1");
  const [editUnite, setEditUnite] = useState("");
  const [taskTemplateDrawerOpen, setTaskTemplateDrawerOpen] = useState(false);
  const [taskTemplateSeed, setTaskTemplateSeed] = useState<TaskTemplateInput | null>(null);
  const [taskTemplateSaving, setTaskTemplateSaving] = useState(false);
  const [taskTemplateError, setTaskTemplateError] = useState<string | null>(null);

  // Devis
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [devisLoading, setDevisLoading] = useState(false);
  const [devisError, setDevisError] = useState<string | null>(null);
  const [devisImportDrawerOpen, setDevisImportDrawerOpen] = useState(false);

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
  const [filterIntervenant, setFilterIntervenant] = useState<string>("__ALL__");

  // Matériel
  const [materiel, setMateriel] = useState<MaterielDemandeRow[]>([]);
  const [materielLoading, setMaterielLoading] = useState(false);
  const [materielError, setMaterielError] = useState<string | null>(null);

  // Form matériel
  const [mIntervenantId, setMIntervenantId] = useState<string>("__NONE__");
  const [mDesignation, setMDesignation] = useState("");
  const [mQuantite, setMQuantite] = useState("1");
  const [mUnite, setMUnite] = useState("");
  const [mDate, setMDate] = useState("");
  const [mStatus, setMStatus] = useState<MaterielStatus>("en_attente");
  const [mRemarques, setMRemarques] = useState("");
  const [addingMateriel, setAddingMateriel] = useState(false);
  const [materielFilter, setMaterielFilter] = useState<"__ALL__" | MaterielStatus>("__ALL__");
  const [materielAdminComments, setMaterielAdminComments] = useState<Record<string, string>>({});

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
      const message = err?.message ?? "Erreur telechargement document.";
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
      setToast({ type: "ok", msg: "Lien copie (valable 60s)" });
    } catch (err: any) {
      const message = err?.message ?? "Erreur copie lien document.";
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

  function applyReserveToDrawer(reserve: ChantierReserveRow | null) {
    if (reserve) {
      setActiveReserve(reserve);
      setReserveDraftTitle(reserve.title ?? "");
      setReserveDraftDescription(reserve.description ?? "");
      setReserveDraftStatus((reserve.status ?? "OUVERTE") as ReserveStatus);
      setReserveDraftPriority((reserve.priority ?? "NORMALE") as ReservePriority);
      setReserveDraftTaskId(reserve.task_id ?? "");
      setReserveDraftIntervenantId(reserve.intervenant_id ?? "__NONE__");
      return;
    }
    setActiveReserve(null);
    setReserveDraftTitle("");
    setReserveDraftDescription("");
    setReserveDraftStatus("OUVERTE");
    setReserveDraftPriority("NORMALE");
    setReserveDraftTaskId("");
    setReserveDraftIntervenantId("__NONE__");
  }

  function openReserveDrawer(reserve?: ChantierReserveRow | null) {
    setReserveDrawerError(null);
    setReserveDrawerTab("details");
    setReserveSelectedMarkerId(null);
    setReserveDrawingMode(false);
    setReserveShowAllMarkers(false);
    setReserveMarkerSaving(false);
    setReservePhotos([]);
    setReservePhotoFile(null);
    setReservePhotoUrlCache({});
    applyReserveToDrawer(reserve ?? null);
    setReserveDrawerOpen(true);
  }

  function closeReserveDrawer() {
    if (reserveSaving || reservePhotoUploading) return;
    setReserveDrawerOpen(false);
    setReserveDrawerError(null);
    setActiveReserve(null);
    setReserveSelectedMarkerId(null);
    setReserveDrawingMode(false);
    setReserveShowAllMarkers(false);
    setReserveMarkerSaving(false);
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
      setReservesError(err?.message ?? "Erreur chargement réserves.");
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

  async function refreshDoeDocumentIds() {
    if (!id) return;
    try {
      const items = await listDoeItemsByChantierId(id);
      setDoeDocumentIds(items.map((item) => item.document_id));
    } catch (err) {
      console.warn("[doe] refresh ids error", err);
      setDoeDocumentIds([]);
    }
  }

  async function toggleDocumentDoe(doc: ChantierDocumentRow) {
    if (!id) return;
    const alreadyIncluded = doeDocumentIds.includes(doc.id);
    setDoeSyncingDocumentId(doc.id);
    try {
      if (alreadyIncluded) {
        const nextIds = doeDocumentIds.filter((x) => x !== doc.id);
        await removeDoeItem(id, doc.id);
        if (nextIds.length > 0) {
          await reorderDoeItems(id, nextIds);
        }
        setDoeDocumentIds(nextIds);
        setToast({ type: "ok", msg: "Document retiré du DOE." });
      } else {
        const sortOrder = doeDocumentIds.length + 1;
        await upsertDoeItem({
          chantier_id: id,
          document_id: doc.id,
          sort_order: sortOrder,
        });
        setDoeDocumentIds((prev) => [...prev, doc.id]);
        setToast({ type: "ok", msg: "Document inclus au DOE." });
      }
    } catch (err: any) {
      const message = err?.message ?? "Erreur mise à jour DOE.";
      setToast({ type: "error", msg: message });
    } finally {
      setDoeSyncingDocumentId(null);
    }
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
      setReserveDrawerError("Tâche requise.");
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
        setToast({ type: "ok", msg: "Réserve mise à jour." });
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
        setToast({ type: "ok", msg: "Réserve créée." });
        closeReserveDrawer();
      }
    } catch (err: any) {
      const message = err?.message ?? "Erreur sauvegarde reserve.";
      setReserveDrawerError(message);
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
      setToast({ type: "ok", msg: "Réserve marquée levée." });
    } catch (err: any) {
      const message = err?.message ?? "Erreur mise a jour reserve.";
      setReserveDrawerError(message);
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

  async function loadReserveMarkersForPlan(planDocumentId: string) {
    if (!planDocumentId) {
      setReserveMarkers([]);
      return;
    }
    setReserveMarkersLoading(true);
    try {
      const data = await listReserveMarkersByPlan(planDocumentId);
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
      setToast({ type: "ok", msg: "Photo ajoutee." });
    } catch (err: any) {
      const message = err?.message ?? "Erreur ajout photo.";
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
    setReserveDrawingMode(false);
    setReserveShowAllMarkers(false);
    setReserveMarkerSaving(false);
    setReserveMarkers([]);
    if (!documentId) return;
    const doc = documentsById.get(documentId);
    if (!doc?.storage_path) {
      setReservePlanError("Chemin de stockage manquant.");
      return;
    }
    setReservePlanLoading(true);
    try {
      const [url] = await Promise.all([
        getSignedUrl(doc.storage_path, 60),
        loadReserveMarkersForPlan(documentId),
      ]);
      setReservePlanUrl(url);
    } catch (err: any) {
      setReservePlanError(err?.message ?? "Impossible de charger le plan.");
    } finally {
      setReservePlanLoading(false);
    }
  }

  async function onCreateReserveMarker(input: {
    type: "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";
    color: string;
    stroke_width: number;
    page_number: number | null;
    x1: number;
    y1: number;
    x2?: number | null;
    y2?: number | null;
    text?: string | null;
  }) {
    if (!reservePlanDocumentId) return;
    if (!activeReserve) {
      const createNow = confirm("Aucune réserve sélectionnée. Créer une nouvelle réserve ?");
      if (createNow) {
        openReserveDrawer(null);
      }
      return;
    }
    const documentId = reservePlanDocumentId;
    const markerType = input.type;
    const markerColor = (input.color || "#ef4444").toLowerCase();
    const markerStroke = Number(input.stroke_width || 2) || 2;
    const markerLabel = (input.text ?? activeReserve.title ?? "").trim() || null;
    const payload = {
      reserve_id: activeReserve.id,
      document_id: documentId,
      plan_document_id: documentId,
      type: markerType,
      color: markerColor,
      stroke_width: markerStroke,
      page_number: input.page_number,
      x1: input.x1,
      y1: input.y1,
      x2: input.x2 ?? null,
      y2: input.y2 ?? null,
      text: input.text ?? null,
      label: markerLabel,
      legend_label: null,
      legend_key: `${markerType}:${markerColor}`,
    } as const;

    if (import.meta.env.DEV) {
      console.debug("[markers] insert payload", payload);
    }

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ReservePlanMarkerRow = {
      id: tempId,
      reserve_id: activeReserve.id,
      document_id: documentId,
      plan_document_id: documentId,
      page_number: input.page_number,
      page: input.page_number,
      type: markerType,
      color: markerColor,
      stroke_width: markerStroke,
      x1: input.x1,
      y1: input.y1,
      x2: input.x2 ?? null,
      y2: input.y2 ?? null,
      text: input.text ?? null,
      legend_label: null,
      legend_key: `${markerType}:${markerColor}`,
      x: input.x1,
      y: input.y1,
      label: markerLabel,
      created_at: new Date().toISOString(),
    };

    setReserveMarkers((prev) => [...prev, optimistic]);
    setReserveSelectedMarkerId(tempId);
    setReserveMarkerSaving(true);

    try {
      const created = await addReserveMarker(payload);
      if (import.meta.env.DEV) {
        console.debug("[markers] insert ok", created);
      }
      setReserveMarkers((prev) => prev.map((marker) => (marker.id === tempId ? created : marker)));
      setReserveSelectedMarkerId(created.id);
      await loadReserveMarkersForPlan(documentId);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error("[markers] insert err", err);
      }
      setReserveMarkers((prev) => prev.filter((marker) => marker.id !== tempId));
      setReserveSelectedMarkerId((prev) => (prev === tempId ? null : prev));
      const message = err?.message ?? "Erreur ajout repere.";
      setToast({ type: "error", msg: message });
    } finally {
      setReserveMarkerSaving(false);
    }
  }

  function onSelectReserveMarker(marker: { id: string; reserve_id: string }, openReserve: boolean) {
    setReserveSelectedMarkerId(marker.id);
    if (!openReserve) return;
    setReserveDrawingMode(false);
    const targetReserve = reserves.find((r) => r.id === marker.reserve_id) ?? null;
    if (!targetReserve) return;
    applyReserveToDrawer(targetReserve);
    setReserveDrawerTab("details");
  }

  async function deleteReserveMarkerById(markerId: string) {
    if (!markerId) return;
    try {
      await removeReserveMarker(markerId);
      if (reservePlanDocumentId) {
        await loadReserveMarkersForPlan(reservePlanDocumentId);
      } else {
        setReserveMarkers((prev) => prev.filter((marker) => marker.id !== markerId));
      }
      setReserveSelectedMarkerId((prev) => (prev === markerId ? null : prev));
      setToast({ type: "ok", msg: "Marqueur supprimé." });
    } catch (err: any) {
      const message = err?.message ?? "Erreur suppression marqueur.";
      setToast({ type: "error", msg: message });
    }
  }

  async function deleteSelectedReserveMarker() {
    if (!reserveSelectedMarkerId) return;
    await deleteReserveMarkerById(reserveSelectedMarkerId);
  }

  async function removeReserveLegendGroup(input: {
    page_number: number | null;
    type: "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";
    color: string;
  }) {
    if (!reservePlanDocumentId) return;
    const scope = !reserveShowAllMarkers && activeReserve ? "ACTIVE_ONLY" : "ALL_RESERVES";
    const reserveId = scope === "ACTIVE_ONLY" ? activeReserve?.id ?? null : null;
    try {
      const removed = await removeReserveMarkersGroup({
        document_id: reservePlanDocumentId,
        page_number: input.page_number ?? 1,
        type: input.type,
        color: input.color,
        reserve_id: reserveId,
        scope,
      });
      await loadReserveMarkersForPlan(reservePlanDocumentId);
      setReserveSelectedMarkerId(null);
      setToast({ type: "ok", msg: `${removed} marqueur(s) supprimé(s).` });
    } catch (err: any) {
      const message = err?.message ?? "Erreur suppression du groupe.";
      setToast({ type: "error", msg: message });
      throw err;
    }
  }

  async function renameReserveLegendGroup(input: {
    page_number: number | null;
    type: "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";
    color: string;
    label: string | null;
  }) {
    if (!reservePlanDocumentId) return;
    const scope = !reserveShowAllMarkers && activeReserve ? "ACTIVE_ONLY" : "ALL_RESERVES";
    const reserveId = scope === "ACTIVE_ONLY" ? activeReserve?.id ?? null : null;
    try {
      const updated = await renameReserveMarkersGroup({
        document_id: reservePlanDocumentId,
        page_number: input.page_number ?? 1,
        type: input.type,
        color: input.color,
        new_label: input.label,
        reserve_id: reserveId,
        scope,
      });
      if (updated === 0) {
        setToast({ type: "error", msg: "Aucun marqueur correspondant à renommer sur cette page." });
        return;
      }
      await loadReserveMarkersForPlan(reservePlanDocumentId);
      setToast({ type: "ok", msg: `${updated} marqueur(s) renommé(s).` });
    } catch (err: any) {
      const message = err?.message ?? "Erreur renommage du groupe.";
      setToast({ type: "error", msg: message });
      throw err;
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
      const message = err?.message ?? "Erreur ouverture document.";
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
      const message = err?.message ?? "Erreur mise a jour des documents.";
      setTaskDocumentsModalError(message);
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
    const tasksResult = await getTasksByChantierIdDetailed(id);
    setTasks(tasksResult.tasks);
    setTasksPlanningWarning(
      tasksResult.planningColumnsMissing
        ? `Migration planning manquante sur Supabase. Colonnes attendues sur public.chantier_tasks: ${tasksResult.expectedPlanningColumns.join(", ")}.`
        : null,
    );
  }

  async function refreshDevisOnly(preferredDevisId?: string | null) {
    if (!id) return;
    setDevisLoading(true);
    setDevisError(null);
    try {
      const devisData = await listDevisByChantierId(id);
      setDevis(devisData);
      if (preferredDevisId !== undefined) {
        setActiveDevisId(preferredDevisId);
      }
    } catch (e: any) {
      setDevis([]);
      setDevisError(e?.message ?? "Erreur lors du chargement des devis.");
    } finally {
      setDevisLoading(false);
    }
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
        setTasksPlanningWarning(null);
        try {
          const tasksData = await getTasksByChantierIdDetailed(id);
          if (!alive) return;
          setTasks(tasksData.tasks);
          setTasksPlanningWarning(
            tasksData.planningColumnsMissing
              ? `Migration planning manquante sur Supabase. Colonnes attendues sur public.chantier_tasks: ${tasksData.expectedPlanningColumns.join(", ")}.`
              : null,
          );
        } catch (e: any) {
          if (!alive) return;
          setTasksError(e?.message ?? "Erreur lors du chargement des tâches.");
          setTasks([]);
          setTasksPlanningWarning(null);
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

  useEffect(() => {
    if (!id) return;
    void refreshDoeDocumentIds();
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
  }, [reserveDrawerOpen, activeReserve?.id]);

  useEffect(() => {
    if (!reserveDrawerOpen || !reservePlanDocumentId) return;
    void loadReserveMarkersForPlan(reservePlanDocumentId);
  }, [reserveDrawerOpen, reservePlanDocumentId]);

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

  // initialise le draft temps quand tasks changent
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

  const lotOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    const add = (value: string | null | undefined) => {
      const normalized = normalizeLotLabel(value);
      if (!normalized) return;
      const key = normalized.toLocaleLowerCase("fr");
      if (!byKey.has(key)) byKey.set(key, normalized);
    };

    DEFAULT_STANDARD_LOTS.forEach((name) => add(name));
    for (const task of tasks) {
      add(task.lot);
      if (!normalizeLotLabel(task.lot)) add(task.corps_etat);
    }
    if (newLotSelection && newLotSelection !== "__CREATE__") add(newLotSelection);
    if (editLotSelection && editLotSelection !== "__CREATE__") add(editLotSelection);

    return [...byKey.values()];
  }, [tasks, newLotSelection, editLotSelection]);

  function resolveTaskLotName(task: Pick<ChantierTaskRow, "lot" | "corps_etat">): string {
    const fromLotText = normalizeLotLabel(task.lot);
    if (fromLotText) return fromLotText;
    const fromCorpsEtat = normalizeLotLabel(task.corps_etat);
    if (fromCorpsEtat) return fromCorpsEtat;
    return "A classer";
  }

  useEffect(() => {
    if (!lotOptions.length) return;
    if (newLotSelection === "__CREATE__") return;
    if (newLotSelection && lotOptions.includes(newLotSelection)) return;
    const firstLot = lotOptions[0];
    setNewLotSelection(firstLot);
    setNewCorpsEtat(firstLot);
  }, [lotOptions, newLotSelection]);

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
    const markersOnPlan = reserveMarkers.filter((m) => {
      return (m.document_id ?? m.plan_document_id) === reservePlanDocumentId;
    });
    if (reserveShowAllMarkers) return markersOnPlan;
    if (!activeReserve) return markersOnPlan;
    return markersOnPlan.filter((marker) => marker.reserve_id === activeReserve.id);
  }, [reserveMarkers, reservePlanDocumentId, reserveShowAllMarkers, activeReserve?.id]);

  const selectedPlanDoc = useMemo(() => {
    if (!reservePlanDocumentId) return null;
    return documentsById.get(reservePlanDocumentId) ?? null;
  }, [documentsById, reservePlanDocumentId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterIntervenant === "__NONE__") {
        if (t.intervenant_id) return false;
      } else if (filterIntervenant !== "__ALL__") {
        if ((t.intervenant_id ?? "") !== filterIntervenant) return false;
      }
      return true;
    });
  }, [tasks, filterIntervenant]);

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
  function createLotAndSelect(lotName: string, target: "add" | "edit"): string | null {
    const cleanName = normalizeLotLabel(lotName);
    if (!cleanName) {
      setTasksError("Le nom du lot est obligatoire.");
      return null;
    }

    const existing = lotOptions.find((option) => option.toLocaleLowerCase("fr") === cleanName.toLocaleLowerCase("fr"));
    if (existing) {
      if (target === "add") {
        setNewLotSelection(existing);
        setNewCorpsEtat(existing);
        setNewLotDraftName("");
      } else {
        setEditLotSelection(existing);
        setEditCorpsEtat(existing);
        setEditLotDraftName("");
      }
      return existing;
    }

    setTasksError(null);
    if (target === "add") {
      setNewLotSelection(cleanName);
      setNewCorpsEtat(cleanName);
      setNewLotDraftName("");
    } else {
      setEditLotSelection(cleanName);
      setEditCorpsEtat(cleanName);
      setEditLotDraftName("");
    }

    setToast({ type: "ok", msg: "Lot ajouté à la liste." });
    return cleanName;
  }

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
    if (newLotSelection === "__CREATE__") {
      setTasksError("Crée d'abord le nouveau lot avant d'ajouter la tâche.");
      return;
    }
    const lotName = normalizeLotLabel(newLotSelection) || normalizeLotLabel(newLotDraftName) || null;
    if (!lotName) {
      setTasksError("Choisis un lot dans la liste ou crée-en un nouveau.");
      return;
    }
    const durationRaw = newDurationDays.trim();
    const durationParsed = Number(durationRaw || "1");
    const durationDays = Number.isFinite(durationParsed) ? Math.max(1, Math.trunc(durationParsed)) : NaN;
    if (!Number.isFinite(durationDays)) {
      setTasksError("Durée invalide.");
      return;
    }

    const orderRaw = newOrderIndex.trim();
    const orderParsed = Number(orderRaw || "0");
    const orderIndex = Number.isFinite(orderParsed) ? Math.max(0, Math.trunc(orderParsed)) : NaN;
    if (!Number.isFinite(orderIndex)) {
      setTasksError("Ordre invalide.");
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
      corps_etat: lotName,
      lot: lotName,
      status: newTaskStatus,
      intervenant_id,
      quantite,
      unite,
      temps_prevu_h: null,
      date_debut: null,
      date_fin: null,
      temps_reel_h: null,
      duration_days: durationDays,
      order_index: orderIndex,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTasks((prev) => [optimistic, ...prev]);

    try {
      const saved = await createTask({
        chantier_id: id,
        titre,
        corps_etat: lotName,
        lot: lotName,
        status: newTaskStatus,
        intervenant_id,
        quantite,
        unite,
        duration_days: durationDays,
        order_index: orderIndex,
      });

      setTasks((prev) => prev.map((t) => (t.id === tempId ? (saved as any) : t)));

      setNewTitre("");
      setNewCorpsEtat(lotName);
      setNewLotSelection(lotName);
      setNewTaskStatus("A_FAIRE");
      setNewDurationDays("1");
      setNewOrderIndex("0");
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
    const resolvedLotName = resolveTaskLotName(t);
    setEditTitre(baseTitre);
    setEditCorpsEtat(resolvedLotName === "A classer" ? "" : resolvedLotName);
    setEditLotSelection(resolvedLotName === "A classer" ? "" : resolvedLotName);
    setEditLotDraftName("");
    setEditDurationDays(String(Math.max(1, Number((t as any).duration_days ?? 1))));
    setEditOrderIndex(String(Math.max(0, Number((t as any).order_index ?? 0))));
    setEditStatus((t.status ?? "A_FAIRE") as any);
    setEditIntervenantId(t.intervenant_id ?? "__NONE__");
    setEditQuantite(String(q ?? decoded.quantite ?? 1));
    setEditUnite(unite);
  }
  function cancelEditTask() {
    setEditingTaskId(null);
    setSavingTask(false);
    setEditLotSelection("");
    setEditLotDraftName("");
  }

  function openTaskTemplateDrawerFromTask(t: ChantierTaskRow) {
    const titre = editTitre.trim() || stripLegacyPrefix(t.titre ?? "");
    if (!titre) {
      setToast({ type: "error", msg: "Titre tâche manquant." });
      return;
    }

    const lot = normalizeLotLabel(editLotSelection) || editCorpsEtat.trim() || resolveTaskLotName(t);
    const uniteRaw = editUnite.trim() || ((t as any).unite ?? "");
    const quantiteFromEdit = toNumberOrNull(editQuantite.trim());
    const quantiteTask = toNumberOrNull((t as any).quantite);
    const quantite = quantiteFromEdit ?? quantiteTask ?? 0;
    const tempsPrevu = toNumberOrNull((t as any).temps_prevu_h) ?? 0;
    const tempsParUnite = quantite > 0 ? tempsPrevu / quantite : 0;

    setTaskTemplateSeed({
      titre,
      lot: lot || null,
      unite: (String(uniteRaw).trim() || null) as string | null,
      quantite_defaut: quantite > 0 ? quantite : 0,
      temps_prevu_par_unite_h: Number.isFinite(tempsParUnite) ? tempsParUnite : 0,
      remarques: ((t as any).remarques ?? null) as string | null,
    });
    setTaskTemplateError(null);
    setTaskTemplateDrawerOpen(true);
  }

  function closeTaskTemplateDrawer() {
    if (taskTemplateSaving) return;
    setTaskTemplateDrawerOpen(false);
    setTaskTemplateError(null);
    setTaskTemplateSeed(null);
  }

  async function saveTaskTemplateFromTask(payload: TaskTemplateInput) {
    setTaskTemplateSaving(true);
    setTaskTemplateError(null);
    try {
      await createTaskTemplate(payload);
      setToast({ type: "ok", msg: "Template ajouté à la bibliothèque." });
      closeTaskTemplateDrawer();
    } catch (err: any) {
      const message = err?.message ?? "Erreur ajout template.";
      setTaskTemplateError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setTaskTemplateSaving(false);
    }
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
    const durationRaw = editDurationDays.trim();
    const durationParsed = Number(durationRaw || "1");
    const durationDays = Number.isFinite(durationParsed) ? Math.max(1, Math.trunc(durationParsed)) : NaN;
    if (!Number.isFinite(durationDays)) {
      setToast({ type: "error", msg: "Durée invalide." });
      return;
    }

    const orderRaw = editOrderIndex.trim();
    const orderParsed = Number(orderRaw || "0");
    const orderIndex = Number.isFinite(orderParsed) ? Math.max(0, Math.trunc(orderParsed)) : NaN;
    if (!Number.isFinite(orderIndex)) {
      setToast({ type: "error", msg: "Ordre invalide." });
      return;
    }

    if (editLotSelection === "__CREATE__") {
      setToast({ type: "error", msg: "Crée d'abord le nouveau lot avant d'enregistrer." });
      return;
    }

    const lotName = normalizeLotLabel(editLotSelection) || normalizeLotLabel(editLotDraftName) || null;
    if (!lotName) {
      setToast({ type: "error", msg: "Choisis un lot avant d'enregistrer la tâche." });
      return;
    }

    const patch = {
      titre,
      corps_etat: lotName,
      lot: lotName,
      status: editStatus ?? "A_FAIRE",
      intervenant_id: editIntervenantId === "__NONE__" ? null : editIntervenantId,
      quantite,
      unite,
      duration_days: durationDays,
      order_index: orderIndex,
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

    const email = newIntervenantEmail.trim();
    if (email) {
      const exists = intervenants.some((row) => String(row.email ?? "").trim().toLowerCase() === email.toLowerCase());
      if (exists) {
        const friendly = "Cet email est déjà utilisé par un intervenant.";
        setIntervenantsError(friendly);
        setToast({ type: "error", msg: friendly });
        return;
      }
    }

    setCreatingIntervenant(true);
    setIntervenantsError(null);

    try {
      const created = await createIntervenant({
        chantier_id: id,
        nom,
        email: email || null,
        telephone: newIntervenantTel.trim() || null,
      });

      setIntervenants((prev) => [...prev, created].sort((a, b) => a.nom.localeCompare(b.nom)));

      setNewIntervenantNom("");
      setNewIntervenantEmail("");
      setNewIntervenantTel("");

      setToast({ type: "ok", msg: "Intervenant ajouté." });
    } catch (e: any) {
      const message = isIntervenantDuplicateEmailError(e)
        ? "Cet email est déjà utilisé par un intervenant."
        : e?.message ?? "Erreur création intervenant.";
      setIntervenantsError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setCreatingIntervenant(false);
    }
  }
  // ----- ENVOI ACCÈS -----
  // même si le mail ne part pas : on récupère le token et on construit le lien public côté front
  async function onSendAccess(i: IntervenantRow) {
    if (!id) return;

    const email = (i.email ?? "").trim();
    if (!email || !email.includes("@")) {
      setToast({ type: "error", msg: "Email intervenant manquant ou invalide." });
      return;
    }

    try {
      setSendingAccessId(i.id);

      const resp = await sendIntervenantAccess({
        chantierId: id,
        intervenantId: i.id,
        // l'edge function va relire l'email en base si besoin, mais on peut aussi le passer
        email,
      });

      const accessUrl = buildIntervenantLink(resp.token);
      if (import.meta.env.DEV) {
        console.log("Generated intervenant link:", accessUrl);
      }

      const copied = await copyToClipboard(accessUrl);
      if (copied) {
        setToast({ type: "ok", msg: `Lien d’accès copié. Tu peux l’envoyer à ${i.nom}.` });
      } else {
        // fallback simple (fonctionne partout)
        window.prompt("Copie ce lien et envoie-le à l’intervenant :", accessUrl);
        setToast({ type: "ok", msg: `Lien d’accès généré. Envoie-le à ${i.nom}.` });
      }
    } catch (e: any) {
      const message = isPublicAppUrlConfigError(e)
        ? e?.message ?? "VITE_PUBLIC_APP_URL manquant (à définir sur Vercel et en local)"
        : e?.message ?? "Erreur lors de l’envoi de l’accès.";
      setToast({ type: "error", msg: message });
    } finally {
      setSendingAccessId(null);
    }
  }

  function extractIntervenantToken(value: unknown): string | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;

    if (raw.includes("token=")) {
      try {
        const parsed = new URL(raw);
        const tokenFromQuery = parsed.searchParams.get("token")?.trim();
        if (tokenFromQuery) return tokenFromQuery;
      } catch {
        // Fallback for non-URL strings containing token=
      }
      const tokenPart = raw.split("token=")[1] ?? "";
      const sanitized = tokenPart.split("&")[0]?.trim();
      if (sanitized) return decodeURIComponent(sanitized);
    }

    const legacyMatch = raw.match(/\/acces\/([^/?#]+)/i);
    if (legacyMatch?.[1]) {
      return decodeURIComponent(legacyMatch[1]);
    }

    // If it's an URL without token query param, do not treat it as token.
    if (/^https?:\/\//i.test(raw)) return null;

    return raw;
  }

  function resolveIntervenantTokenFromRpc(data: unknown): string | null {
    if (typeof data === "string") {
      return extractIntervenantToken(data);
    }
    if (Array.isArray(data)) {
      if (!data.length) return null;
      return resolveIntervenantTokenFromRpc(data[0]);
    }
    if (data && typeof data === "object") {
      const row = data as Record<string, unknown>;
      const directToken = extractIntervenantToken(row.token);
      if (directToken) return directToken;
      const altToken = extractIntervenantToken(row.access_token);
      if (altToken) return altToken;
      const fnToken = extractIntervenantToken(row.admin_create_intervenant_link);
      if (fnToken) return fnToken;
      const linkToken = extractIntervenantToken(row.access_url ?? row.url ?? row.link);
      if (linkToken) return linkToken;
    }
    return null;
  }

  async function onGenerateIntervenantLink() {
    if (!id) return;

    try {
      setGeneratingIntervenantLink(true);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      let { data, error } = await (supabase as any).rpc("admin_create_intervenant_link", {
        p_chantier_id: id,
        p_expires_at: expiresAt,
      });

      if (error) {
        const msg = String((error as any)?.message ?? "").toLowerCase();
        const supportsLegacySignature =
          msg.includes("p_expires_at") ||
          msg.includes("does not exist") ||
          msg.includes("function") ||
          msg.includes("signature");

        if (supportsLegacySignature) {
          const fallback = await (supabase as any).rpc("admin_create_intervenant_link", {
            p_chantier_id: id,
          });
          data = fallback.data;
          error = fallback.error;
        }
      }

      if (error) throw error;

      const token = resolveIntervenantTokenFromRpc(data);
      if (!token) throw new Error("Token intervenant introuvable dans la réponse RPC.");

      const url = buildIntervenantLink(token);
      if (import.meta.env.DEV) {
        console.log("Generated intervenant link:", url);
      }
      setGeneratedIntervenantLink(url);

      const copied = await copyToClipboard(url);
      if (copied) {
        setToast({ type: "ok", msg: "Lien intervenant généré et copié." });
      } else {
        setToast({ type: "ok", msg: "Lien intervenant généré." });
      }
    } catch (e: any) {
      const message = isPublicAppUrlConfigError(e)
        ? e?.message ?? "VITE_PUBLIC_APP_URL manquant (à définir sur Vercel et en local)"
        : e?.message ?? "Erreur génération lien intervenant.";
      setToast({ type: "error", msg: message });
    } finally {
      setGeneratingIntervenantLink(false);
    }
  }

  // ----- devis -----
  async function onDevisImported(result: DevisImportResult) {
    try {
      await Promise.all([refreshTasksOnly(), refreshDevisOnly(result.devisId)]);
    } catch (err) {
      console.error("[devis-import] refresh error", err);
    }
    setToast({
      type: "ok",
      msg: `Import termine: ${result.linesInserted} ligne(s), ${result.tasksCreated} tache(s), mode ${result.mode}.`,
    });
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
      const message = err?.message ?? "Erreur lors de l'ajout de la ligne.";
      setLignesError(message);
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

  // ----- matériel -----
  function materielStatusLabel(s: MaterielStatus) {
    if (s === "validee") return "Validée";
    if (s === "refusee") return "Refusée";
    if (s === "livree") return "Livrée";
    return "En attente";
  }

  function materielStatusBadgeClass(s: MaterielStatus) {
    if (s === "livree") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "validee") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "refusee") return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
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
      titre: designation,
      designation,
      quantite: qty,
      unite: mUnite.trim() || null,
      date_souhaitee: mDate || null,
      statut: mStatus,
      remarques: mRemarques.trim() || null,
      commentaire: mRemarques.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMateriel((prev) => [optimistic, ...prev]);

    try {
      const saved = await createMaterielDemande({
        chantier_id: id,
        intervenant_id,
        titre: designation,
        quantite: qty,
        unite: mUnite.trim() || null,
        date_souhaitee: mDate || null,
        statut: mStatus,
        commentaire: mRemarques.trim() || null,
      } as any);

      setMateriel((prev) => prev.map((x) => (x.id === tempId ? (saved as any) : x)));

      setMIntervenantId("__NONE__");
      setMDesignation("");
      setMQuantite("1");
      setMUnite("");
      setMDate("");
      setMStatus("en_attente");
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
    const adminCommentaireRaw =
      materielAdminComments[row.id] ?? row.admin_commentaire ?? row.commentaire ?? row.remarques ?? "";
    const adminCommentaire = adminCommentaireRaw.trim() || null;
    setMateriel((prev) =>
      prev.map((x) =>
        x.id === row.id ? { ...x, statut: status, admin_commentaire: adminCommentaire, updated_at: new Date().toISOString() } : x,
      ),
    );
    try {
      const updated = await updateMaterielDemande(row.id, { statut: status, admin_commentaire: adminCommentaire } as any);
      setMateriel((prev) => prev.map((x) => (x.id === row.id ? updated : x)));
      setToast({ type: "ok", msg: "Statut matériel mis à jour." });
    } catch (e: any) {
      await refreshMateriel();
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour matériel." });
    }
  }

  async function onDeleteMateriel(row: MaterielDemandeRow) {
    const label = row.titre || row.designation || "demande matériel";
    const ok = confirm(`Supprimer la demande "${label}" ?`);
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
  const filteredMateriel =
    materielFilter === "__ALL__" ? materiel : materiel.filter((row) => row.statut === materielFilter);

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
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_1px_minmax(280px,auto)] lg:items-start">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pilotage chantier</div>
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
          </div>

          <div className="hidden lg:block h-full w-px bg-slate-200" />

          <div className="space-y-2 lg:pl-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Livrables</div>
            <div className="flex gap-2 flex-wrap">
              <TabButton active={tab === "visite"} onClick={() => setTab("visite")}>
                Visites de chantier
              </TabButton>
              <TabButton active={tab === "doe"} onClick={() => setTab("doe")}>
                DOE
              </TabButton>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Gestion chantier</div>
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
        </div>
      </div>

      {/* Contenu */}
      <div className="rounded-2xl border bg-white p-6">
        {/* ---------------- ONGLET TEMPS ---------------- */}
        {tab === "temps" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold section-title">Temps (par tâche)</div>
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
                <div className="font-semibold section-title">Intervenants</div>
                <div className="text-sm text-slate-500">
                  Créer, modifier et supprimer les intervenants du chantier
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onGenerateIntervenantLink()}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm",
                    generatingIntervenantLink ? "bg-slate-100 text-slate-500" : "hover:bg-slate-50",
                  ].join(" ")}
                  disabled={generatingIntervenantLink}
                >
                  {generatingIntervenantLink ? "Génération..." : "Générer lien intervenant"}
                </button>
                <button
                  type="button"
                  onClick={refreshIntervenants}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  disabled={intervenantsLoading}
                >
                  {intervenantsLoading ? "Chargement…" : "Rafraîchir"}
                </button>
              </div>
            </div>

            {intervenantsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {intervenantsError}
              </div>
            )}

            {generatedIntervenantLink && (
              <div className="rounded-xl border bg-slate-50 p-4 space-y-2">
                <div className="text-sm font-semibold text-slate-800">Lien intervenant</div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <input
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                    value={generatedIntervenantLink}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await copyToClipboard(generatedIntervenantLink);
                      if (copied) {
                        setToast({ type: "ok", msg: "Lien intervenant copié." });
                      } else {
                        window.prompt("Copie ce lien :", generatedIntervenantLink);
                      }
                    }}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-white"
                  >
                    Copier
                  </button>
                </div>
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
              <div className="font-semibold section-title">Documents</div>
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
                <table className="w-full text-sm table-soft">
                  <thead className="text-slate-600">
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
                        <td className="px-3 py-2">
                          {(() => {
                            const label = formatDocumentVisibility(doc);
                            return <span className={visibilityBadgeClass(label)}>{label}</span>;
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString("fr-FR") : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={doeSyncingDocumentId === doc.id}
                              onClick={() => toggleDocumentDoe(doc)}
                              className={[
                                "rounded-lg border px-2 py-1 text-xs",
                                doeDocumentIds.includes(doc.id)
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "hover:bg-slate-50",
                              ].join(" ")}
                            >
                              {doeSyncingDocumentId === doc.id
                                ? "Mise à jour..."
                                : doeDocumentIds.includes(doc.id)
                                  ? "Retirer DOE"
                                  : "Inclure DOE"}
                            </button>
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
                <div className="font-semibold section-title">Réserves</div>
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
                    "chip-btn",
                    reservesFilter === f.key ? "chip-btn--active" : "chip-btn--inactive",
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Devis</div>
                  <div className="text-sm text-slate-500">Import PDF avec extraction IA et aperçu obligatoire</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">{devisLoading ? "Chargement…" : `${devis.length} devis`}</div>
                  <button
                    type="button"
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                    onClick={() => setDevisImportDrawerOpen(true)}
                  >
                    Importer devis (PDF)
                  </button>
                </div>
              </div>

              {devisError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {devisError}
                </div>
              )}

              <div className="rounded-xl border bg-blue-50/50 p-4 text-sm text-slate-700">
                Utilisez <span className="font-semibold">Importer devis (PDF)</span> pour extraire les lignes de
                travaux, verifier l'apercu puis creer les taches.
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
                  <div className="font-semibold section-title">Tâches</div>
                  <div className="text-sm text-slate-500">Attribution par intervenant + modification</div>
                </div>
                <div className="text-xs text-slate-500">
                  {tasksLoading ? "Chargement…" : `${filteredTasks.length} / ${tasks.length} tâche(s)`}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-1">
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

              {/* AJOUT TÂCHE */}
              <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
                <form onSubmit={addTask} className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-10">
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-4">
                      <div>Intitulé</div>
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        value={newTitre}
                        onChange={(e) => setNewTitre(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                      <div>Lot</div>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        value={newLotSelection}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewLotSelection(value);
                          if (value === "__CREATE__") {
                            setNewCorpsEtat("");
                            return;
                          }
                          setNewCorpsEtat(value);
                        }}
                      >
                        {lotOptions.map((lot) => (
                          <option key={lot} value={lot}>
                            {lot}
                          </option>
                        ))}
                        <option value="__DIVIDER__" disabled>
                          ────────────
                        </option>
                        <option value="__CREATE__">➕ Créer un nouveau lot…</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                      <div>Quantité</div>
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        inputMode="decimal"
                        value={newQuantite}
                        onChange={(e) => setNewQuantite(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                      <div>Unité</div>
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        value={newUnite}
                        onChange={(e) => setNewUnite(e.target.value)}
                      />
                    </label>
                  </div>

                  {newLotSelection === "__CREATE__" && (
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="Nom du nouveau lot"
                        value={newLotDraftName}
                        onChange={(e) => setNewLotDraftName(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-100"
                        onClick={() => void createLotAndSelect(newLotDraftName, "add")}
                      >
                        Créer le lot
                      </button>
                    </div>
                  )}

                  <div className="grid gap-2 md:grid-cols-12">
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                      <div>Statut</div>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        value={newTaskStatus}
                        onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                      >
                        <option value="A_FAIRE">À faire</option>
                        <option value="EN_COURS">En cours</option>
                        <option value="FAIT">Fait</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                      <div>Durée (jours)</div>
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        type="number"
                        min={1}
                        step={1}
                        value={newDurationDays}
                        onChange={(e) => setNewDurationDays(e.target.value)}
                      />
                      <p className="text-[11px] text-slate-500">Durée estimée utilisée pour le planning</p>
                    </label>
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                      <div>Ordre</div>
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        type="number"
                        min={0}
                        step={1}
                        value={newOrderIndex}
                        onChange={(e) => setNewOrderIndex(e.target.value)}
                      />
                      <p className="text-[11px] text-slate-500">Ordre d'enchaînement dans le lot</p>
                    </label>
                    <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                      <div>Intervenant</div>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        value={newIntervenantId}
                        onChange={(e) => setNewIntervenantId(e.target.value)}
                        disabled={intervenantsLoading}
                      >
                        <option value="__NONE__">Non attribué</option>
                        {intervenants.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nom}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="text-xs text-slate-500">
                    Astuce : crée tes intervenants dans l'onglet "Intervenants", puis attribue-les ici.
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
              {tasksPlanningWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {tasksPlanningWarning}
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
                                {resolveTaskLotName(t)} • Intervenant : {it?.nom ?? "—"}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {qtyLabel} / {tempsPasseLabel} / {avancementLabel}
                              </div>
                            </>
                          ) : (
                            <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
                              <div className="grid gap-2 md:grid-cols-10">
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                                  <div>Intitulé</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editTitre}
                                    onChange={(e) => setEditTitre(e.target.value)}
                                  />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                                  <div>Lot</div>
                                  <select
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editLotSelection}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setEditLotSelection(value);
                                      if (value === "__CREATE__") {
                                        setEditCorpsEtat("");
                                        return;
                                      }
                                      setEditCorpsEtat(value);
                                    }}
                                  >
                                    {lotOptions.map((lot) => (
                                      <option key={lot} value={lot}>
                                        {lot}
                                      </option>
                                    ))}
                                    <option value="__DIVIDER__" disabled>
                                      ────────────
                                    </option>
                                    <option value="__CREATE__">➕ Créer un nouveau lot…</option>
                                  </select>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Quantité</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    inputMode="decimal"
                                    value={editQuantite}
                                    onChange={(e) => setEditQuantite(e.target.value)}
                                  />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Unité</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editUnite}
                                    onChange={(e) => setEditUnite(e.target.value)}
                                  />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                                  <div>Statut</div>
                                  <select
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editStatus as any}
                                    onChange={(e) => setEditStatus(e.target.value as any)}
                                  >
                                    <option value="A_FAIRE">À faire</option>
                                    <option value="EN_COURS">En cours</option>
                                    <option value="FAIT">Fait</option>
                                  </select>
                                </label>
                              </div>

                              {editLotSelection === "__CREATE__" && (
                                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    placeholder="Nom du nouveau lot"
                                    value={editLotDraftName}
                                    onChange={(e) => setEditLotDraftName(e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-100"
                                    onClick={() => void createLotAndSelect(editLotDraftName, "edit")}
                                  >
                                    Créer le lot
                                  </button>
                                </div>
                              )}

                              <div className="grid gap-2 md:grid-cols-9">
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                                  <div>Durée (jours)</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={editDurationDays}
                                    onChange={(e) => setEditDurationDays(e.target.value)}
                                  />
                                  <p className="text-[11px] text-slate-500">Durée estimée utilisée pour le planning</p>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                                  <div>Ordre</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={editOrderIndex}
                                    onChange={(e) => setEditOrderIndex(e.target.value)}
                                  />
                                  <p className="text-[11px] text-slate-500">Ordre d'enchaînement dans le lot</p>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                                  <div>Intervenant</div>
                                  <select
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
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
                                </label>
                              </div>
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
                            onClick={() => openTaskTemplateDrawerFromTask(t)}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                            disabled={savingTask || taskTemplateSaving}
                          >
                            Ajouter à la bibliothèque
                          </button>
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
                <div className="font-semibold section-title">Matériel</div>
                <div className="text-sm text-slate-500">
                  Demandes matériel avec statut : En attente / Validée / Refusée / Livrée.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={materielFilter}
                  onChange={(e) => setMaterielFilter(e.target.value as "__ALL__" | MaterielStatus)}
                >
                  <option value="__ALL__">Tous</option>
                  <option value="en_attente">En attente</option>
                  <option value="validee">Validée</option>
                  <option value="refusee">Refusée</option>
                  <option value="livree">Livrée</option>
                </select>
                <button
                  type="button"
                  onClick={refreshMateriel}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  disabled={materielLoading}
                >
                  {materielLoading ? "Chargement…" : "Rafraîchir"}
                </button>
              </div>
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
                  <option value="en_attente">En attente</option>
                  <option value="validee">Validée</option>
                  <option value="refusee">Refusée</option>
                  <option value="livree">Livrée</option>
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
              ) : filteredMateriel.length === 0 ? (
                <div className="text-sm text-slate-500">Aucune demande matériel.</div>
              ) : (
                filteredMateriel.map((m) => {
                  const it = intervenantById.get(m.intervenant_id);
                  const displayName = m.titre || m.designation || "Demande matériel";
                  const draftComment = materielAdminComments[m.id] ?? m.admin_commentaire ?? "";
                  return (
                    <div key={m.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {displayName} • Qté {m.quantite}
                            {m.unite ? ` ${m.unite}` : ""}
                          </div>
                          <div className="text-xs text-slate-500">Intervenant : {it?.nom ?? "—"}</div>
                          {m.date_souhaitee ? (
                            <div className="text-xs text-slate-500">Date souhaitée : {new Date(`${m.date_souhaitee}T00:00:00`).toLocaleDateString("fr-FR")}</div>
                          ) : null}
                        </div>

                        <span className={["text-xs px-2 py-1 rounded-full border", materielStatusBadgeClass(m.statut)].join(" ")}>
                          {materielStatusLabel(m.statut)}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                        <input
                          className="rounded-xl border px-3 py-2 text-sm"
                          placeholder="Commentaire admin (optionnel)"
                          value={draftComment}
                          onChange={(e) =>
                            setMaterielAdminComments((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateMaterielStatus(m, "validee")}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-blue-50"
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateMaterielStatus(m, "refusee")}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-red-50"
                          >
                            Refuser
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateMaterielStatus(m, "livree")}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-emerald-50"
                          >
                            Livrée
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMateriel(m)}
                            className="text-sm rounded-xl border border-red-200 text-red-700 px-3 py-2 hover:bg-red-50"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>

                      {m.commentaire ? <div className="text-sm text-slate-600">{m.commentaire}</div> : null}
                      {m.admin_commentaire ? <div className="text-sm text-slate-500">Admin: {m.admin_commentaire}</div> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === "planning" && id && (
          <PlanningTab chantierId={id} chantierName={item?.nom ?? null} intervenants={intervenants} />
        )}

        {tab === "doe" && id && (
          <DoeTab
            chantierId={id}
            chantierName={item?.nom ?? "Chantier"}
            chantierAddress={(item as any)?.adresse ?? null}
            clientName={(item as any)?.client_nom ?? (item as any)?.client ?? null}
            documents={documents}
            onDocumentsRefresh={async () => {
              const data = await refreshChantierDocuments();
              setDocuments(data);
              await refreshDoeDocumentIds();
            }}
          />
        )}

        {tab === "visite" && id && (
          <VisiteTab
            chantierId={id}
            chantierName={item?.nom ?? "Chantier"}
            chantierReference={(item as any)?.reference ?? id}
            chantierAddress={(item as any)?.adresse ?? null}
            clientName={(item as any)?.client_nom ?? (item as any)?.client ?? null}
            intervenants={intervenants}
            onDocumentsRefresh={async () => {
              const data = await refreshChantierDocuments();
              setDocuments(data);
              await refreshDoeDocumentIds();
            }}
          />
        )}

        {/* autres onglets placeholders */}
        {tab !== "devis-taches" &&
          tab !== "intervenants" &&
          tab !== "documents" &&
          tab !== "reserves" &&
          tab !== "temps" &&
          tab !== "materiel" &&
          tab !== "planning" &&
          tab !== "doe" &&
          tab !== "visite" && (
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
            <div className="absolute right-0 top-0 h-screen w-full sm:w-[90vw] lg:w-[85vw] lg:min-w-[980px] 2xl:w-[70vw] bg-white border-l shadow-xl flex flex-col">
              <div className="px-3 lg:px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold truncate">
                  Réserve — {activeReserve?.title ?? "Nouvelle réserve"}
                </div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={closeReserveDrawer}
                  disabled={reserveSaving}
                >
                  ×
                </button>
              </div>

              <div className="px-3 lg:px-4 py-2 border-b flex gap-2">
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
                        "chip-btn",
                        reserveDrawerTab === t.key ? "chip-btn--active" : "chip-btn--inactive",
                        disabled ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-3 lg:px-4 py-3 space-y-4">
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
                            Fichier sélectionné : {reservePhotoFile.name}
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
                    {planDocuments.length === 0 ? (
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
                          <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={reserveShowAllMarkers}
                              onChange={(e) => setReserveShowAllMarkers(e.target.checked)}
                            />
                            Afficher toutes les réserves
                          </label>
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
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]"
                                title="Consultation: clic marqueur = sélection. Corbeille: suppression avec annulation 5s."
                              >
                                i
                              </span>
                              {activeReserve ? (
                                <span className="font-medium text-slate-700">Réserve active : {activeReserve.title}</span>
                              ) : (
                                <span className="text-amber-700">Aucune réserve active.</span>
                              )}
                            </div>
                            <ReservePlanViewer
                              url={reservePlanUrl}
                              mimeType={selectedPlanDoc?.mime_type ?? null}
                              markers={reserveMarkersForPlan.map((marker) => ({
                                ...marker,
                                status:
                                  reserves.find((reserve) => reserve.id === marker.reserve_id)?.status ?? null,
                              }))}
                              selectedMarkerId={reserveSelectedMarkerId}
                              selectedReserveId={activeReserve?.id ?? null}
                              drawingMode={reserveDrawingMode}
                              onDrawingModeChange={setReserveDrawingMode}
                              onCreateMarker={onCreateReserveMarker}
                              onSelectMarker={onSelectReserveMarker}
                              onDeleteSelected={deleteSelectedReserveMarker}
                              onDeleteMarker={deleteReserveMarkerById}
                              onRemoveLegendGroup={removeReserveLegendGroup}
                              onRenameLegendGroup={renameReserveLegendGroup}
                              markerSaving={reserveMarkerSaving}
                              showAllReserves={reserveShowAllMarkers}
                            />
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

              <div className="sticky bottom-0 border-t bg-white/95 backdrop-blur px-3 lg:px-4 py-3 flex justify-end gap-2">
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

        <TaskTemplateDrawer
          open={taskTemplateDrawerOpen}
          template={null}
          initialValues={taskTemplateSeed}
          saving={taskTemplateSaving}
          deleting={false}
          error={taskTemplateError}
          onClose={closeTaskTemplateDrawer}
          onSave={saveTaskTemplateFromTask}
          onDelete={async () => {}}
        />

        <DevisImportDrawer
          open={devisImportDrawerOpen}
          chantierId={id ?? null}
          intervenants={intervenants}
          onClose={() => setDevisImportDrawerOpen(false)}
          onImported={onDevisImported}
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
                  ×
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
                  ×
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
                  ×
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


























