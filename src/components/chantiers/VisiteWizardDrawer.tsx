import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  buildVisiteSnapshot,
  type VisiteSnapshot,
  type VisiteSnapshotLot,
  type VisiteSnapshotReserveFocus,
  type VisiteSnapshotTaskFocus,
} from "../../lib/buildVisiteSnapshot";
import type { IntervenantRow } from "../../services/intervenants.service";
import type { ChantierDocumentRow } from "../../services/chantierDocuments.service";
import { getSignedUrl, uploadDocument } from "../../services/chantierDocuments.service";
import { listReserveMarkers, type ReservePlanMarkerRow } from "../../services/reserveMarkers.service";
import { listReserveDocuments } from "../../services/reserveDocuments.service";
import {
  createVisite,
  listVisites,
  setActions,
  setParticipants,
  setVisiteDocuments,
  setVisitePdfDocument,
  updateVisite,
  upsertSnapshot,
  type ChantierVisiteActionResponsableType,
  type ChantierVisiteActionStatus,
  type ChantierVisiteParticipantType,
  type ChantierVisiteRow,
} from "../../services/chantierVisites.service";
import { listDoeItemsByChantierId, upsertDoeItem } from "../../services/chantierDoe.service";
import { generateVisiteCompteRenduPdfBlob } from "../../services/chantierVisitesPdf.service";
import { generateVisiteSynthese } from "../../services/visiteSynthese.service";
import { getCompanyBrandingForPdf } from "../../services/companySettings.service";
import { getTasksByChantierId } from "../../services/chantierTasks.service";
import { generateVisiteClientReportPdfBlob } from "../../services/chantierClientReportPdf.service";

type MainTab = "details" | "preview" | "export";
type TasksTab = "done" | "todo";

type ActionDraft = {
  id: string;
  description: string;
  responsable_type: ChantierVisiteActionResponsableType;
  intervenant_id: string | null;
  responsable_nom: string;
  echeance: string;
  statut: ChantierVisiteActionStatus;
  commentaire: string;
};

type PlanningRow = {
  id: string;
  label: string;
  date_debut: string | null;
  date_fin: string | null;
  retard: boolean;
  include: boolean;
  comment: string;
};

type ItemState = {
  include: boolean;
  comment: string;
};

type ReservePlanPreparedItem = {
  reserve_id: string;
  number: number;
  titre: string;
  description?: string | null;
  statut: string;
  priority?: string | null;
  marker_x_pct?: number | null;
  marker_y_pct?: number | null;
  photo_label?: string | null;
};

type ReservePlanPreparedGroup = {
  plan_document_id: string;
  plan_title: string;
  plan_data_url?: string | null;
  plan_mime_type?: string | null;
  items: ReservePlanPreparedItem[];
};

type ReportDocumentPrepared = {
  id?: string;
  nom: string;
  type?: string | null;
  date?: string | null;
  accessible: boolean;
  fallback_message?: string | null;
};

type Props = {
  open: boolean;
  chantierId: string;
  chantierName: string;
  chantierReference?: string | null;
  chantierAddress?: string | null;
  clientName?: string | null;
  intervenants: IntervenantRow[];
  documents: ChantierDocumentRow[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

function defaultVisitDateTime() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const local = new Date(now.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

function createActionDraft(): ActionDraft {
  return {
    id: crypto.randomUUID(),
    description: "",
    responsable_type: "AUTRE",
    intervenant_id: null,
    responsable_nom: "",
    echeance: "",
    statut: "A_FAIRE",
    commentaire: "",
  };
}

function parseOtherParticipants(value: string): string[] {
  return value
    .split(/\n|,|;/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeDateFr(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

function asTaskLabel(task: VisiteSnapshotTaskFocus): string {
  return `${task.lot ?? "Divers"} | ${task.titre} | ${task.intervenant ?? "-"}`;
}

function isDoneTaskStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized === "FAIT" || normalized === "TERMINE" || normalized === "DONE";
}

function toTimestamp(value: string | null | undefined): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

function asTaskClientLabel(input: {
  lot?: string | null;
  titre: string;
  date?: string | null;
}): string {
  const lot = String(input.lot ?? "").trim();
  const title = String(input.titre ?? "").trim() || "Tache";
  const date = normalizeDateFr(input.date ?? null);
  if (lot) return `${lot} - ${title} (${date})`;
  return `${title} (${date})`;
}

function normalizeMarkerPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value * 100;
  if (value >= 0 && value <= 100) return value;
  return null;
}

function pickMarkerCoords(marker: ReservePlanMarkerRow | null): { x: number | null; y: number | null } {
  if (!marker) return { x: null, y: null };
  return {
    x: normalizeMarkerPercent(marker.x1 ?? marker.x ?? null),
    y: normalizeMarkerPercent(marker.y1 ?? marker.y ?? null),
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Conversion image impossible."));
      }
    };
    reader.onerror = () => reject(new Error("Conversion image impossible."));
    reader.readAsDataURL(blob);
  });
}

export default function VisiteWizardDrawer({
  open,
  chantierId,
  chantierName,
  chantierReference,
  chantierAddress,
  clientName,
  intervenants,
  documents,
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<MainTab>("details");
  const [tasksTab, setTasksTab] = useState<TasksTab>("todo");
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [loadingInit, setLoadingInit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iaInfo, setIaInfo] = useState<string | null>(null);

  const [visite, setVisite] = useState<ChantierVisiteRow | null>(null);
  const [snapshot, setSnapshot] = useState<VisiteSnapshot | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [visitDateTime, setVisitDateTime] = useState(defaultVisitDateTime());
  const [numero, setNumero] = useState<number | null>(null);
  const [titre, setTitre] = useState("");
  const [phase, setPhase] = useState("");
  const [objectif, setObjectif] = useState("");
  const [meteo, setMeteo] = useState("");
  const [includeInDoe, setIncludeInDoe] = useState(false);

  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [otherParticipants, setOtherParticipants] = useState("");

  const [notesTerrain, setNotesTerrain] = useState("");
  const [pointsPositifs, setPointsPositifs] = useState("");
  const [pointsBloquants, setPointsBloquants] = useState("");
  const [synthese, setSynthese] = useState("");
  const [synthesePoints, setSynthesePoints] = useState<string[]>([]);
  const [remarquesPlanning, setRemarquesPlanning] = useState("");

  const [lotsDraft, setLotsDraft] = useState<VisiteSnapshotLot[]>([]);
  const [actions, setActionsDraft] = useState<ActionDraft[]>([createActionDraft()]);
  const [planningDraft, setPlanningDraft] = useState<PlanningRow[]>([]);

  const [taskStateById, setTaskStateById] = useState<Record<string, ItemState>>({});
  const [reserveStateById, setReserveStateById] = useState<Record<string, ItemState>>({});
  const [intervenantNotes, setIntervenantNotes] = useState<Record<string, string>>({});

  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploadedPhotoDocIds, setUploadedPhotoDocIds] = useState<string[]>([]);

  const [previewIntervenantId, setPreviewIntervenantId] = useState<string>("");
  const [exportIntervenantId, setExportIntervenantId] = useState<string>("");

  const autoSaveTimer = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");

  const intervenantById = useMemo(() => {
    const map = new Map<string, IntervenantRow>();
    intervenants.forEach((it) => map.set(it.id, it));
    return map;
  }, [intervenants]);

  const participants = useMemo(() => {
    const fromIntervenants = selectedParticipantIds
      .map((id) => intervenantById.get(id))
      .filter((row): row is IntervenantRow => Boolean(row))
      .map((row) => ({
        type: "INTERVENANT" as ChantierVisiteParticipantType,
        nom: row.nom,
        intervenant_id: row.id,
        email: row.email ?? null,
        present: true,
      }));

    const fromOthers = parseOtherParticipants(otherParticipants).map((nom) => ({
      type: "AUTRE" as ChantierVisiteParticipantType,
      nom,
      intervenant_id: null,
      email: null,
      present: true,
    }));

    return [...fromIntervenants, ...fromOthers];
  }, [selectedParticipantIds, intervenantById, otherParticipants]);

  const tasksDone = useMemo(() => snapshot?.tasks_realisees ?? [], [snapshot]);
  const tasksTodo = useMemo(() => snapshot?.tasks_a_faire ?? [], [snapshot]);
  const reserves = useMemo(() => snapshot?.reserves_focus ?? [], [snapshot]);

  const selectedIntervenant = previewIntervenantId ? intervenantById.get(previewIntervenantId) ?? null : null;

  const filteredForIntervenant = useMemo(() => {
    if (!selectedIntervenant) {
      return {
        done: tasksDone,
        todo: tasksTodo,
        reserves,
        planning: planningDraft,
        actions,
      };
    }

    const name = selectedIntervenant.nom;
    return {
      done: tasksDone.filter((task) => (task.intervenant ?? "") === name),
      todo: tasksTodo.filter((task) => (task.intervenant ?? "") === name),
      reserves: reserves.filter((reserve) => (reserve.intervenant ?? "") === name),
      planning: planningDraft.filter((row) => row.label.toLowerCase().includes(name.toLowerCase())),
      actions: actions.filter((row) => (row.intervenant_id ? row.intervenant_id === selectedIntervenant.id : row.responsable_nom === name)),
    };
  }, [selectedIntervenant, tasksDone, tasksTodo, reserves, planningDraft, actions]);

  function getTaskState(taskId: string): ItemState {
    return taskStateById[taskId] ?? { include: true, comment: "" };
  }

  function setTaskState(taskId: string, patch: Partial<ItemState>) {
    setTaskStateById((prev) => ({
      ...prev,
      [taskId]: { ...getTaskState(taskId), ...patch },
    }));
  }

  function getReserveState(reserveId: string): ItemState {
    return reserveStateById[reserveId] ?? { include: true, comment: "" };
  }

  function setReserveState(reserveId: string, patch: Partial<ItemState>) {
    setReserveStateById((prev) => ({
      ...prev,
      [reserveId]: { ...getReserveState(reserveId), ...patch },
    }));
  }

  function resetState() {
    setTab("details");
    setTasksTab("todo");
    setSaving(false);
    setAutosaving(false);
    setLoadingInit(false);
    setError(null);
    setIaInfo(null);
    setVisite(null);
    setSnapshot(null);
    setDownloadUrl(null);
    setVisitDateTime(defaultVisitDateTime());
    setNumero(null);
    setTitre("");
    setPhase("");
    setObjectif("");
    setMeteo("");
    setIncludeInDoe(false);
    setSelectedParticipantIds([]);
    setOtherParticipants("");
    setNotesTerrain("");
    setPointsPositifs("");
    setPointsBloquants("");
    setSynthese("");
    setSynthesePoints([]);
    setRemarquesPlanning("");
    setLotsDraft([]);
    setActionsDraft([createActionDraft()]);
    setPlanningDraft([]);
    setTaskStateById({});
    setReserveStateById({});
    setIntervenantNotes({});
    setSelectedDocumentIds([]);
    setPhotoFiles([]);
    setUploadedPhotoDocIds([]);
    setPreviewIntervenantId("");
    setExportIntervenantId("");
    lastPayloadRef.current = "";
  }

  useEffect(() => {
    if (!open) return;
    resetState();
  }, [open]);

  useEffect(() => {
    if (!open || !chantierId || visite) return;
    let active = true;

    (async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const redactorEmail = authData.user?.email ?? null;

        const created = await createVisite({
          chantier_id: chantierId,
          titre: "Visite de chantier",
          visit_datetime: new Date(defaultVisitDateTime()).toISOString(),
          redactor_email: redactorEmail,
        });
        if (!active) return;

        const builtSnapshot = await buildVisiteSnapshot({
          chantierId,
          chantier: { id: chantierId, nom: chantierName ?? null, adresse: chantierAddress ?? null },
        });
        await upsertSnapshot(created.id, builtSnapshot);

        if (!active) return;
        setVisite(created);
        setSnapshot(builtSnapshot);
        setNumero(created.numero ?? null);
        setTitre(created.titre || `Visite #${created.numero ?? 1}`);
        setVisitDateTime(new Date(created.visit_datetime).toISOString().slice(0, 16));
        setLotsDraft(builtSnapshot.lots.map((lot) => ({ ...lot })));
        setPlanningDraft(
          (builtSnapshot.planning ?? []).map((row) => ({
            ...row,
            include: true,
            comment: "",
          })),
        );

        const nextTaskState: Record<string, ItemState> = {};
        [...(builtSnapshot.tasks_realisees ?? []), ...(builtSnapshot.tasks_a_faire ?? [])].forEach((task) => {
          nextTaskState[task.id] = { include: true, comment: "" };
        });
        setTaskStateById(nextTaskState);

        const nextReserveState: Record<string, ItemState> = {};
        (builtSnapshot.reserves_focus ?? []).forEach((reserve) => {
          nextReserveState[reserve.id] = { include: true, comment: "" };
        });
        setReserveStateById(nextReserveState);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Erreur initialisation visite.");
      } finally {
        if (active) setLoadingInit(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, chantierId, chantierName, chantierAddress, visite]);

  const selectedDocs = useMemo(
    () => documents.filter((doc) => selectedDocumentIds.includes(doc.id)),
    [documents, selectedDocumentIds],
  );

  const documentsById = useMemo(() => {
    const map = new Map<string, ChantierDocumentRow>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

  async function saveNow() {
    if (!visite || !snapshot) return;

    const snapshotPayload: VisiteSnapshot = {
      ...snapshot,
      lots: lotsDraft.map((lot) => ({ ...lot })),
      planning: planningDraft
        .filter((row) => row.include)
        .map((row) => ({ id: row.id, label: row.label, date_debut: row.date_debut, date_fin: row.date_fin, retard: row.retard })),
      tasks_realisees: (snapshot.tasks_realisees ?? []).filter((task) => getTaskState(task.id).include),
      tasks_a_faire: (snapshot.tasks_a_faire ?? []).filter((task) => getTaskState(task.id).include),
      tasks_focus: (snapshot.tasks_a_faire ?? []).filter((task) => getTaskState(task.id).include),
      reserves_focus: (snapshot.reserves_focus ?? []).filter((reserve) => getReserveState(reserve.id).include),
      documents: snapshot.documents.filter((doc) => selectedDocumentIds.length === 0 || selectedDocumentIds.includes(doc.id)),
    };

    const payloadKey = JSON.stringify({
      visitDateTime,
      numero,
      titre,
      phase,
      objectif,
      meteo,
      includeInDoe,
      notesTerrain,
      pointsPositifs,
      pointsBloquants,
      synthese,
      synthesePoints,
      remarquesPlanning,
      participants,
      actions,
      selectedDocumentIds,
      lotsDraft,
      planningDraft,
      taskStateById,
      reserveStateById,
      intervenantNotes,
      snapshotPayload,
    });

    if (payloadKey === lastPayloadRef.current) return;

    setAutosaving(true);
    try {
      await updateVisite(visite.id, {
        numero,
        titre: titre.trim() || "Visite de chantier",
        phase: phase || null,
        objectif: objectif || null,
        visit_datetime: new Date(visitDateTime).toISOString(),
        meteo: meteo || null,
        include_in_doe: includeInDoe,
        points_positifs: pointsPositifs || null,
        points_bloquants: pointsBloquants || null,
        notes_terrain: notesTerrain || null,
        remarques_planning: remarquesPlanning || null,
        synthese: synthese || null,
        synthese_points_cles: synthesePoints,
      });

      await setParticipants(visite.id, participants);
      await setActions(
        visite.id,
        actions.map((row, index) => ({
          description: row.description,
          responsable_type: row.responsable_type,
          intervenant_id: row.intervenant_id,
          responsable_nom: row.intervenant_id
            ? intervenantById.get(row.intervenant_id)?.nom ?? row.responsable_nom
            : row.responsable_nom || null,
          echeance: row.echeance || null,
          statut: row.statut,
          commentaire: row.commentaire || null,
          ordre: index + 1,
        })),
      );

      await upsertSnapshot(visite.id, {
        ...snapshotPayload,
        ui: {
          task_state: taskStateById,
          reserve_state: reserveStateById,
          planning_state: planningDraft.map((row) => ({ id: row.id, include: row.include, comment: row.comment })),
          intervenant_notes: intervenantNotes,
        },
      } as any);

      lastPayloadRef.current = payloadKey;
    } catch (err: any) {
      setError(err?.message ?? "Erreur autosave visite.");
    } finally {
      setAutosaving(false);
    }
  }

  useEffect(() => {
    if (!open || !visite || !snapshot || loadingInit) return;

    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = window.setTimeout(() => {
      void saveNow();
    }, 700);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [
    open,
    visite?.id,
    snapshot?.generated_at,
    loadingInit,
    visitDateTime,
    numero,
    titre,
    phase,
    objectif,
    meteo,
    includeInDoe,
    selectedParticipantIds,
    otherParticipants,
    notesTerrain,
    pointsPositifs,
    pointsBloquants,
    synthese,
    synthesePoints,
    remarquesPlanning,
    lotsDraft,
    actions,
    planningDraft,
    taskStateById,
    reserveStateById,
    intervenantNotes,
    selectedDocumentIds,
  ]);

  if (!open) return null;

  function toggleParticipant(intervenantId: string, checked: boolean) {
    if (checked) {
      setSelectedParticipantIds((prev) => (prev.includes(intervenantId) ? prev : [...prev, intervenantId]));
    } else {
      setSelectedParticipantIds((prev) => prev.filter((id) => id !== intervenantId));
    }
  }

  function toggleDocument(docId: string, checked: boolean) {
    if (checked) {
      setSelectedDocumentIds((prev) => (prev.includes(docId) ? prev : [...prev, docId]));
    } else {
      setSelectedDocumentIds((prev) => prev.filter((id) => id !== docId));
    }
  }

  async function onGenerateSyntheseIA() {
    if (!snapshot) return;
    setIaInfo(null);
    try {
      const ai = await generateVisiteSynthese({
        visite_id: visite?.id,
        notes_terrain: notesTerrain,
        points_bloquants: pointsBloquants,
        snapshot,
        actions: actions.map((a) => ({ description: a.description, statut: a.statut })),
      });
      setSynthese(ai.synthese);
      setSynthesePoints(ai.points_cles);
      if (ai.points_positifs && ai.points_positifs.length) {
        setPointsPositifs(ai.points_positifs.join("\n"));
      }
      if (ai.points_bloquants && ai.points_bloquants.length) {
        setPointsBloquants(ai.points_bloquants.join("\n"));
      }
      if (ai.decisions && ai.decisions.length) {
        setActionsDraft((prev) => {
          const existingFilled = prev.some((row) => row.description.trim().length > 0);
          if (existingFilled) return prev;
          return ai.decisions!.map((decision, index) => ({
            id: crypto.randomUUID(),
            description: decision.action,
            responsable_type: "AUTRE",
            intervenant_id: null,
            responsable_nom: decision.responsable ?? "",
            echeance: decision.echeance ?? "",
            statut: "A_FAIRE",
            commentaire: index === 0 ? "Proposé par synthèse IA" : "",
          }));
        });
      }
      setIaInfo("Synthese IA generee.");
    } catch (err: any) {
      setIaInfo(err?.message ?? "Synthese IA indisponible.");
    }
  }

  async function ensureUploadedPhotos(): Promise<string[]> {
    if (uploadedPhotoDocIds.length > 0) return uploadedPhotoDocIds;
    const createdIds: string[] = [];
    for (let i = 0; i < photoFiles.length; i += 1) {
      const dateTag = new Date(visitDateTime).toISOString().slice(0, 10);
      const file = photoFiles[i];
      const photoDoc = await uploadDocument({
        chantierId,
        file,
        title: `Photo visite ${dateTag} #${i + 1}`,
        category: "PHOTO_VISITE",
        documentType: "PHOTO",
        visibility_mode: "GLOBAL",
      });
      createdIds.push(photoDoc.id);
    }
    setUploadedPhotoDocIds(createdIds);
    return createdIds;
  }

  function buildExportData(filterIntervenantId?: string | null) {
    if (!snapshot) {
      return {
        lots: [] as VisiteSnapshotLot[],
        tasksDoneExport: [] as VisiteSnapshotTaskFocus[],
        tasksTodoExport: [] as VisiteSnapshotTaskFocus[],
        reservesExport: [] as VisiteSnapshotReserveFocus[],
        planningExport: [] as PlanningRow[],
        actionsExport: [] as ActionDraft[],
        snapshotExport: null as VisiteSnapshot | null,
      };
    }

    const selectedName = filterIntervenantId ? intervenantById.get(filterIntervenantId)?.nom ?? null : null;

    const tasksDoneExport = (snapshot.tasks_realisees ?? []).filter((task) => {
      const state = getTaskState(task.id);
      if (!state.include) return false;
      if (!selectedName) return true;
      return (task.intervenant ?? "") === selectedName;
    });

    const tasksTodoExport = (snapshot.tasks_a_faire ?? []).filter((task) => {
      const state = getTaskState(task.id);
      if (!state.include) return false;
      if (!selectedName) return true;
      return (task.intervenant ?? "") === selectedName;
    });

    const reservesExport = (snapshot.reserves_focus ?? []).filter((reserve) => {
      const state = getReserveState(reserve.id);
      if (!state.include) return false;
      if (!selectedName) return true;
      return (reserve.intervenant ?? "") === selectedName;
    });

    const planningExport = planningDraft.filter((row) => {
      if (!row.include) return false;
      if (!selectedName) return true;
      return row.label.toLowerCase().includes(selectedName.toLowerCase());
    });

    const actionsExport = actions.filter((row) => {
      if (!row.description.trim()) return false;
      if (!filterIntervenantId) return true;
      if (row.intervenant_id) return row.intervenant_id === filterIntervenantId;
      if (!selectedName) return false;
      return row.responsable_nom.trim().toLowerCase() === selectedName.toLowerCase();
    });

    const lotComments = new Map(lotsDraft.map((lot) => [lot.lot || "Divers", lot.comment ?? ""]));

    const deriveLots = (items: VisiteSnapshotTaskFocus[]): VisiteSnapshotLot[] => {
      const map = new Map<string, { total: number; retard: number; faites: number }>();
      for (const task of items) {
        const lotKey = (task.lot ?? "Divers").trim() || "Divers";
        const current = map.get(lotKey) ?? { total: 0, retard: 0, faites: 0 };
        current.total += 1;
        if (task.retard) current.retard += 1;
        if (isDoneTaskStatus(task.statut)) current.faites += 1;
        map.set(lotKey, current);
      }
      return Array.from(map.entries())
        .map(([lot, values]) => ({
          lot,
          tasks_total: values.total,
          tasks_faites: values.faites,
          tasks_retard: values.retard,
          comment: lotComments.get(lot) ?? "",
        }))
        .sort((a, b) => a.lot.localeCompare(b.lot, "fr"));
    };

    const lots = selectedName
      ? deriveLots([...tasksDoneExport, ...tasksTodoExport])
      : lotsDraft.map((lot) => ({ ...lot }));

    const filteredStats = selectedName
      ? {
          ...snapshot.stats,
          tasks_total: tasksDoneExport.length + tasksTodoExport.length,
          tasks_en_cours: tasksTodoExport.filter((task) => String(task.statut).toUpperCase() === "EN_COURS").length,
          tasks_retard: tasksTodoExport.filter((task) => task.retard).length,
          reserves_ouvertes: reservesExport.filter((reserve) => String(reserve.statut).toUpperCase() !== "LEVEE").length,
          reserves_levees: reservesExport.filter((reserve) => String(reserve.statut).toUpperCase() === "LEVEE").length,
          avancement_pct:
            tasksDoneExport.length + tasksTodoExport.length > 0
              ? Math.round((tasksDoneExport.length / (tasksDoneExport.length + tasksTodoExport.length)) * 100)
              : 0,
        }
      : snapshot.stats;

    const snapshotExport: VisiteSnapshot = {
      ...snapshot,
      stats: filteredStats,
      lots,
      intervenants: selectedName
        ? (snapshot.intervenants ?? []).filter((row) => row.nom === selectedName)
        : snapshot.intervenants,
      tasks_realisees: tasksDoneExport,
      tasks_a_faire: tasksTodoExport,
      tasks_focus: tasksTodoExport,
      reserves_focus: reservesExport,
      planning: planningExport.map((row) => ({ id: row.id, label: row.label, date_debut: row.date_debut, date_fin: row.date_fin, retard: row.retard })),
    };

    return { lots, tasksDoneExport, tasksTodoExport, reservesExport, planningExport, actionsExport, snapshotExport };
  }

  async function prepareReservePlanGroups(
    reservesExport: VisiteSnapshotReserveFocus[],
  ): Promise<{ groups: ReservePlanPreparedGroup[]; withoutPlan: ReservePlanPreparedItem[] }> {
    const groupsMap = new Map<string, ReservePlanPreparedGroup>();
    const withoutPlan: ReservePlanPreparedItem[] = [];

    for (const reserve of reservesExport) {
      let markers: ReservePlanMarkerRow[] = [];
      let reserveDocsCount = 0;
      try {
        markers = await listReserveMarkers(reserve.id);
      } catch {
        markers = [];
      }
      try {
        const reserveDocs = await listReserveDocuments(reserve.id);
        reserveDocsCount = reserveDocs.length;
      } catch {
        reserveDocsCount = typeof reserve.photos_count === "number" ? reserve.photos_count : 0;
      }
      const markerWithCoords =
        markers.find((m) => normalizeMarkerPercent(m.x1 ?? m.x ?? null) !== null && normalizeMarkerPercent(m.y1 ?? m.y ?? null) !== null) ??
        null;

      const fallbackMarker = markers[0] ?? null;
      const planDocumentId =
        reserve.plan_document_id ??
        markerWithCoords?.document_id ??
        markerWithCoords?.plan_document_id ??
        fallbackMarker?.document_id ??
        fallbackMarker?.plan_document_id ??
        null;

      const { x, y } = pickMarkerCoords(markerWithCoords);
      const item: ReservePlanPreparedItem = {
        reserve_id: reserve.id,
        number: 0,
        titre: reserve.titre,
        description: (() => {
          const base = reserve.description ?? null;
          const note = getReserveState(reserve.id).comment?.trim();
          if (!note) return base;
          return base ? `${base} (${note})` : note;
        })(),
        statut: reserve.statut,
        priority: reserve.priority ?? null,
        marker_x_pct: x,
        marker_y_pct: y,
        photo_label: reserveDocsCount > 0 ? `${reserveDocsCount} photo(s)` : null,
      };

      if (!planDocumentId || x === null || y === null) {
        withoutPlan.push(item);
        continue;
      }

      const existing = groupsMap.get(planDocumentId);
      if (!existing) {
        const planDoc = documentsById.get(planDocumentId);
        groupsMap.set(planDocumentId, {
          plan_document_id: planDocumentId,
          plan_title: planDoc?.title ?? `Plan ${planDocumentId.slice(0, 8)}`,
          plan_mime_type: planDoc?.mime_type ?? null,
          plan_data_url: null,
          items: [item],
        });
      } else {
        existing.items.push(item);
      }
    }

    const groups = Array.from(groupsMap.values());

    for (const group of groups) {
      group.items.forEach((item, index) => {
        item.number = index + 1;
      });

      const planDoc = documentsById.get(group.plan_document_id);
      if (!planDoc?.storage_path) continue;
      const mime = String(planDoc.mime_type ?? "").toLowerCase();
      if (!mime.startsWith("image/")) continue;

      try {
        const signedUrl = await getSignedUrl(planDoc.storage_path, 180);
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        group.plan_data_url = await blobToDataUrl(blob);
      } catch {
        group.plan_data_url = null;
      }
    }

    if (import.meta.env.DEV) {
      console.debug("[visite-pdf] reserve plans", {
        groups: groups.map((g) => ({ plan: g.plan_title, items: g.items.length, hasImage: Boolean(g.plan_data_url) })),
        withoutPlan: withoutPlan.length,
      });
    }

    return { groups, withoutPlan };
  }

  async function prepareDocumentsForReport(docs: ChantierDocumentRow[]): Promise<ReportDocumentPrepared[]> {
    const prepared: ReportDocumentPrepared[] = [];
    for (const doc of docs) {
      if (!doc.storage_path) {
        prepared.push({
          id: doc.id,
          nom: doc.title || doc.file_name || "Document",
          type: doc.document_type || doc.mime_type || null,
          date: doc.created_at ?? null,
          accessible: false,
          fallback_message: "Chemin storage manquant.",
        });
        continue;
      }

      try {
        await getSignedUrl(doc.storage_path, 60);
        prepared.push({
          id: doc.id,
          nom: doc.title || doc.file_name || "Document",
          type: doc.document_type || doc.mime_type || null,
          date: doc.created_at ?? null,
          accessible: true,
          fallback_message: null,
        });
      } catch (err: any) {
        prepared.push({
          id: doc.id,
          nom: doc.title || doc.file_name || "Document",
          type: doc.document_type || doc.mime_type || null,
          date: doc.created_at ?? null,
          accessible: false,
          fallback_message: err?.message ?? "URL signee indisponible.",
        });
      }
    }

    if (import.meta.env.DEV) {
      console.debug("[visite-pdf] documents check", {
        total: prepared.length,
        accessible: prepared.filter((d) => d.accessible).length,
        failed: prepared.filter((d) => !d.accessible).map((d) => ({ nom: d.nom, reason: d.fallback_message })),
      });
    }

    return prepared;
  }

  async function onExportGlobal() {
    if (!visite || !snapshot) return;
    setSaving(true);
    setError(null);
    try {
      await saveNow();
      const photoDocIds = await ensureUploadedPhotos();
      const docIds = Array.from(new Set([...selectedDocumentIds, ...photoDocIds]));
      await setVisiteDocuments(visite.id, docIds);

      const { lots, tasksDoneExport, tasksTodoExport, reservesExport, planningExport, actionsExport, snapshotExport } =
        buildExportData();
      const documentsReport = await prepareDocumentsForReport(selectedDocs);
      const reservePlans = await prepareReservePlanGroups(reservesExport);
      const company = await getCompanyBrandingForPdf();

      const pdfBlob = await generateVisiteCompteRenduPdfBlob({
        chantierName,
        chantierAddress,
        clientName,
        visiteNumero: numero,
        visiteTitle: titre,
        visiteDate: visitDateTime,
        phase,
        objectif,
        resume: synthese,
        pointsPositifs,
        pointsBloquants,
        notesTerrain,
        remarquesPlanning,
        participants: participants.map((p) => ({ nom: p.nom, type: p.type, present: p.present })),
        snapshot: snapshotExport!,
        lots,
        tasksDone: tasksDoneExport,
        tasksTodo: tasksTodoExport,
        reserves: reservesExport,
        actions: actionsExport.map((a) => ({
          description: a.description,
          responsable: a.intervenant_id ? intervenantById.get(a.intervenant_id)?.nom ?? a.responsable_nom : a.responsable_nom,
          echeance: a.echeance || null,
          statut: a.statut,
          commentaire: a.commentaire,
        })),
        annexTitles: selectedDocs.map((doc) => doc.title),
        photos: photoFiles,
        synthesePoints,
        planningRemarques: remarquesPlanning,
        planningRows: planningExport,
        taskComments: taskStateById,
        reserveComments: reserveStateById,
        documentsList: documentsReport,
        reservePlanGroups: reservePlans.groups,
        reservesWithoutPlan: reservePlans.withoutPlan,
        company,
      });

      const dateTag = new Date(visitDateTime).toISOString().slice(0, 10);
      const timeTag = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
      const pdfFile = new File([pdfBlob], `compte-rendu-visite-${dateTag}-${timeTag}.pdf`, { type: "application/pdf" });
      const pdfDoc = await uploadDocument({
        chantierId,
        file: pdfFile,
        title: `Visite chantier - ${dateTag} ${timeTag}`,
        category: "VISITE",
        documentType: "PDF",
        visibility_mode: "GLOBAL",
      });

      await setVisitePdfDocument(visite.id, pdfDoc.id);

      if (includeInDoe) {
        const doeRows = await listDoeItemsByChantierId(chantierId);
        await upsertDoeItem({ chantier_id: chantierId, document_id: pdfDoc.id, sort_order: doeRows.length + 1 });
      }

      const signed = await getSignedUrl(pdfDoc.storage_path, 1200);
      setDownloadUrl(signed);
      await onSaved();
      setTab("export");
    } catch (err: any) {
      setError(err?.message ?? "Erreur export global.");
    } finally {
      setSaving(false);
    }
  }

  async function onExportIntervenant() {
    if (!snapshot) return;
    if (!exportIntervenantId) {
      setError("Selectionne un intervenant pour l'export filtre.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveNow();
      const selectedName = intervenantById.get(exportIntervenantId)?.nom ?? "Intervenant";
      const { lots, tasksDoneExport, tasksTodoExport, reservesExport, planningExport, actionsExport, snapshotExport } =
        buildExportData(exportIntervenantId);
      const documentsReport = await prepareDocumentsForReport(selectedDocs);
      const reservePlans = await prepareReservePlanGroups(reservesExport);
      const company = await getCompanyBrandingForPdf();

      const pdfBlob = await generateVisiteCompteRenduPdfBlob({
        chantierName,
        chantierAddress,
        clientName,
        visiteNumero: numero,
        visiteTitle: `${titre} - ${selectedName}`,
        visiteDate: visitDateTime,
        phase,
        objectif,
        resume: synthese,
        pointsPositifs,
        pointsBloquants,
        notesTerrain,
        remarquesPlanning,
        participants: participants.map((p) => ({ nom: p.nom, type: p.type, present: p.present })),
        snapshot: snapshotExport!,
        lots,
        tasksDone: tasksDoneExport,
        tasksTodo: tasksTodoExport,
        reserves: reservesExport,
        actions: actionsExport.map((a) => ({
          description: a.description,
          responsable: a.intervenant_id ? intervenantById.get(a.intervenant_id)?.nom ?? a.responsable_nom : a.responsable_nom,
          echeance: a.echeance || null,
          statut: a.statut,
          commentaire: a.commentaire,
        })),
        annexTitles: selectedDocs.map((doc) => doc.title),
        photos: [],
        filterIntervenantName: selectedName,
        intervenantComment: intervenantNotes[exportIntervenantId] ?? "",
        synthesePoints,
        planningRemarques: remarquesPlanning,
        planningRows: planningExport,
        taskComments: taskStateById,
        reserveComments: reserveStateById,
        documentsList: documentsReport,
        reservePlanGroups: reservePlans.groups,
        reservesWithoutPlan: reservePlans.withoutPlan,
        company,
      });

      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 20_000);
    } catch (err: any) {
      setError(err?.message ?? "Erreur export intervenant.");
    } finally {
      setSaving(false);
    }
  }

  async function onExportClientReport() {
    if (!visite || !snapshot) return;
    setSaving(true);
    setError(null);
    try {
      await saveNow();
      const photoDocIds = await ensureUploadedPhotos();
      const docIds = Array.from(new Set([...selectedDocumentIds, ...photoDocIds]));
      await setVisiteDocuments(visite.id, docIds);

      const { lots, tasksDoneExport, tasksTodoExport, reservesExport, planningExport } = buildExportData();
      const reservePlans = await prepareReservePlanGroups(reservesExport);

      const [company, tasksRows, visitesRows] = await Promise.all([
        getCompanyBrandingForPdf(),
        getTasksByChantierId(chantierId),
        listVisites(chantierId),
      ]);

      const currentVisitTs = toTimestamp(visite.visit_datetime) ?? toTimestamp(visitDateTime) ?? Date.now();
      const previousVisit = visitesRows
        .filter((row) => row.id !== visite.id)
        .map((row) => ({ row, ts: toTimestamp(row.visit_datetime) }))
        .filter((item): item is { row: (typeof visitesRows)[number]; ts: number } => item.ts !== null && item.ts < currentVisitTs)
        .sort((a, b) => b.ts - a.ts)[0]?.row;
      const previousVisitTs = previousVisit ? toTimestamp(previousVisit.visit_datetime) : null;

      const tasksDoneSet = new Set(tasksDoneExport.map((task) => task.id));
      const completedSinceLastVisitFromTasks = tasksRows
        .filter((task) => tasksDoneSet.has(task.id))
        .map((task) => {
          const completedTs = toTimestamp(task.date_fin) ?? toTimestamp(task.updated_at) ?? toTimestamp(task.date);
          return {
            label: asTaskClientLabel({
              lot: task.corps_etat,
              titre: task.titre,
              date: task.date_fin ?? task.updated_at ?? task.date,
            }),
            completedTs,
          };
        })
        .filter((row) => (previousVisitTs === null ? true : row.completedTs === null || row.completedTs >= previousVisitTs))
        .sort((a, b) => (b.completedTs ?? 0) - (a.completedTs ?? 0))
        .map((row) => row.label);

      const completedSinceLastVisit =
        completedSinceLastVisitFromTasks.length > 0
          ? completedSinceLastVisitFromTasks.slice(0, 12)
          : tasksDoneExport.slice(0, 12).map((task) =>
              asTaskClientLabel({ lot: task.lot, titre: task.titre, date: task.date_prevue }),
            );

      const horizonTs = currentVisitTs + 21 * 24 * 60 * 60 * 1000;
      const tasksTodoSet = new Set(tasksTodoExport.map((task) => task.id));
      const upcomingFromTasks = tasksRows
        .filter((task) => tasksTodoSet.has(task.id) && !isDoneTaskStatus(task.status))
        .map((task) => {
          const dueTs = toTimestamp(task.date) ?? toTimestamp(task.date_debut) ?? toTimestamp(task.date_fin);
          return {
            label: asTaskClientLabel({ lot: task.corps_etat, titre: task.titre, date: task.date ?? task.date_debut ?? task.date_fin }),
            dueTs,
          };
        })
        .filter((row) => row.dueTs !== null && row.dueTs >= currentVisitTs - 24 * 60 * 60 * 1000 && row.dueTs <= horizonTs)
        .sort((a, b) => (a.dueTs ?? 0) - (b.dueTs ?? 0))
        .map((row) => row.label);

      const upcomingSteps =
        upcomingFromTasks.length > 0
          ? upcomingFromTasks.slice(0, 12)
          : tasksTodoExport
              .filter((task) => {
                const dueTs = toTimestamp(task.date_prevue);
                return dueTs !== null && dueTs >= currentVisitTs - 24 * 60 * 60 * 1000 && dueTs <= horizonTs;
              })
              .slice(0, 12)
              .map((task) => asTaskClientLabel({ lot: task.lot, titre: task.titre, date: task.date_prevue }));

      const planningStatus = planningExport.some((row) => row.retard) || tasksTodoExport.some((task) => task.retard)
        ? "Retard"
        : tasksTodoExport.length === 0
          ? "Avance"
          : "Conforme";

      const lotProgress = lots.map((lot) => {
        const total = Math.max(0, Number(lot.tasks_total ?? 0));
        const doneRaw = lot.tasks_faites != null ? Number(lot.tasks_faites) : Math.max(0, total - Number(lot.tasks_retard ?? 0));
        const done = Math.max(0, Math.min(total, doneRaw));
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        return { lot: lot.lot || "Divers", percent };
      });

      const photoFilesForClient: File[] = [];
      photoFiles.slice(0, 6).forEach((file) => photoFilesForClient.push(file));
      if (photoFilesForClient.length < 6) {
        const imageDocIds = docIds.filter((docId) => {
          const doc = documentsById.get(docId);
          return Boolean(doc?.storage_path && String(doc.mime_type ?? "").toLowerCase().startsWith("image/"));
        });
        for (const docId of imageDocIds) {
          if (photoFilesForClient.length >= 6) break;
          const doc = documentsById.get(docId);
          if (!doc?.storage_path) continue;
          try {
            const signed = await getSignedUrl(doc.storage_path, 120);
            const response = await fetch(signed);
            if (!response.ok) continue;
            const blob = await response.blob();
            const file = new File([blob], doc.file_name || `photo-${photoFilesForClient.length + 1}.jpg`, {
              type: blob.type || doc.mime_type || "image/jpeg",
            });
            photoFilesForClient.push(file);
          } catch {
            // ignore photo download errors for optional section
          }
        }
      }

      const pdfBlob = await generateVisiteClientReportPdfBlob({
        chantierName,
        chantierAddress,
        clientName,
        reportDate: visitDateTime,
        chantierReference: chantierReference || chantierId,
        company,
        avancementPercent: Number(snapshot.stats.avancement_pct ?? 0),
        planningStatus,
        doneSinceLastVisit: completedSinceLastVisit,
        upcomingSteps,
        lots: lotProgress,
        reservePlanGroups: reservePlans.groups,
        pointsToFollow: reservePlans.withoutPlan,
        photos: photoFilesForClient.slice(0, 6),
      });

      const dateTag = new Date(visitDateTime).toISOString().slice(0, 10);
      const timeTag = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
      const pdfFile = new File([pdfBlob], `rapport-client-${dateTag}-${timeTag}.pdf`, { type: "application/pdf" });
      const pdfDoc = await uploadDocument({
        chantierId,
        file: pdfFile,
        title: `Rapport client - ${dateTag} ${timeTag}`,
        category: "VISITE",
        documentType: "RAPPORT_CLIENT",
        visibility_mode: "GLOBAL",
      });

      const signed = await getSignedUrl(pdfDoc.storage_path, 1200);
      setDownloadUrl(signed);
      await onSaved();
      setTab("export");
    } catch (err: any) {
      setError(err?.message ?? "Erreur generation rapport client.");
    } finally {
      setSaving(false);
    }
  }

  const doneIncluded = tasksDone.filter((task) => getTaskState(task.id).include).length;
  const todoIncluded = tasksTodo.filter((task) => getTaskState(task.id).include).length;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-screen w-full sm:w-[92vw] lg:w-[84vw] lg:min-w-[1080px] 2xl:w-[70vw] bg-white border-l shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">Visite de chantier</div>
            <div className="text-xs text-slate-500">Autosave {autosaving ? "..." : "actif"}</div>
          </div>
          <button type="button" className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50" onClick={onClose}>x</button>
        </div>

        <div className="px-4 py-2 border-b flex flex-wrap gap-2">
          <button type="button" className={tab === "details" ? "tab-btn tab-btn--active" : "tab-btn tab-btn--inactive"} onClick={() => setTab("details")}>Détails</button>
          <button type="button" className={tab === "preview" ? "tab-btn tab-btn--active" : "tab-btn tab-btn--inactive"} onClick={() => setTab("preview")}>Aperçu</button>
          <button type="button" className={tab === "export" ? "tab-btn tab-btn--active" : "tab-btn tab-btn--inactive"} onClick={() => setTab("export")}>Export</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50/40 space-y-4">
          {loadingInit && <div className="text-sm text-slate-500">Initialisation de la visite...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {tab === "details" && (
            <div className="rounded-2xl border bg-white p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1 text-sm md:col-span-2">
                  <div className="text-xs text-slate-600">Date / heure</div>
                  <input type="datetime-local" className="w-full rounded-xl border px-3 py-2 text-sm" value={visitDateTime} onChange={(e) => setVisitDateTime(e.target.value)} />
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-xs text-slate-600">Numero</div>
                  <input className="w-full rounded-xl border px-3 py-2 text-sm bg-slate-50" value={numero ?? "-"} onChange={(e) => setNumero(Number(e.target.value))} />
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-xs text-slate-600">Phase</div>
                  <select className="w-full rounded-xl border px-3 py-2 text-sm" value={phase} onChange={(e) => setPhase(e.target.value)}>
                    <option value="">Selectionner</option>
                    <option value="Demarrage">Demarrage</option>
                    <option value="En cours">En cours</option>
                    <option value="Finitions">Finitions</option>
                    <option value="Reception">Reception</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <div className="text-xs text-slate-600">Titre</div>
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={titre} onChange={(e) => setTitre(e.target.value)} />
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-xs text-slate-600">Meteo</div>
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={meteo} onChange={(e) => setMeteo(e.target.value)} />
                </label>
              </div>

              <label className="space-y-1 text-sm block">
                <div className="text-xs text-slate-600">Objectif</div>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-20" value={objectif} onChange={(e) => setObjectif(e.target.value)} />
              </label>

              <details open className="rounded-xl border p-3">
                <summary className="font-medium text-sm cursor-pointer">Participants</summary>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {intervenants.map((it) => (
                    <label key={it.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedParticipantIds.includes(it.id)} onChange={(e) => toggleParticipant(it.id, e.target.checked)} />
                      <span>{it.nom}</span>
                    </label>
                  ))}
                </div>
                <label className="space-y-1 text-sm block mt-3">
                  <div className="text-xs text-slate-600">Autres participants (1 par ligne)</div>
                  <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-16" value={otherParticipants} onChange={(e) => setOtherParticipants(e.target.value)} />
                </label>
              </details>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeInDoe} onChange={(e) => setIncludeInDoe(e.target.checked)} />
                Ajouter automatiquement le rapport global au DOE
              </label>
            </div>
          )}

          {tab === "preview" && snapshot && (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-white p-4">
                <div className="font-semibold mb-3">Indicateurs automatiques</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="rounded-xl border p-2"><div className="text-xs text-slate-500">Avancement global</div><div className="text-lg font-semibold">{snapshot.stats.avancement_pct}%</div></div>
                  <div className="rounded-xl border p-2"><div className="text-xs text-slate-500">Tâches total</div><div className="text-lg font-semibold">{snapshot.stats.tasks_total}</div></div>
                  <div className="rounded-xl border p-2"><div className="text-xs text-slate-500">En cours</div><div className="text-lg font-semibold">{snapshot.stats.tasks_en_cours}</div></div>
                  <div className="rounded-xl border p-2"><div className="text-xs text-slate-500">Retard</div><div className="text-lg font-semibold">{snapshot.stats.tasks_retard}</div></div>
                  <div className="rounded-xl border p-2"><div className="text-xs text-slate-500">Réserves ouvertes</div><div className="text-lg font-semibold">{snapshot.stats.reserves_ouvertes}</div></div>
                  <div className="rounded-xl border p-2"><div className="text-xs text-slate-500">Docs</div><div className="text-lg font-semibold">{snapshot.stats.docs_total}</div></div>
                </div>
              </div>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Avancement par lot</summary>
                <div className="mt-3 space-y-3">
                  {lotsDraft.length === 0 ? (
                    <div className="text-sm text-slate-500">Aucun lot.</div>
                  ) : (
                    lotsDraft.map((lot, idx) => {
                      const done = Number(lot.tasks_faites ?? Math.max(0, lot.tasks_total - lot.tasks_retard));
                      const pct = lot.tasks_total > 0 ? Math.max(0, Math.min(100, Math.round((done / lot.tasks_total) * 100))) : 0;
                      return (
                        <div key={`${lot.lot}-${idx}`} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium">{lot.lot || "Divers"}</div>
                            <div className="font-semibold text-blue-700">{pct}%</div>
                          </div>
                          <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-[#2563EB]" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-2 text-xs text-slate-600">
                            {done} terminées / {lot.tasks_total} - {lot.tasks_retard} en retard
                          </div>
                          <input className="mt-2 w-full rounded-lg border px-2 py-1 text-sm" placeholder="Commentaire lot" value={lot.comment} onChange={(e) => setLotsDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, comment: e.target.value } : row)))} />
                        </div>
                      );
                    })
                  )}
                </div>
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Tâches</summary>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={tasksTab === "done" ? "tab-btn tab-btn--active" : "tab-btn tab-btn--inactive"} onClick={() => setTasksTab("done")}>Tâches réalisées ({doneIncluded})</button>
                  <button type="button" className={tasksTab === "todo" ? "tab-btn tab-btn--active" : "tab-btn tab-btn--inactive"} onClick={() => setTasksTab("todo")}>Tâches à faire ({todoIncluded})</button>
                </div>
                <div className="mt-2 max-h-64 overflow-auto space-y-2">
                  {(tasksTab === "done" ? tasksDone : tasksTodo).map((task) => {
                    const state = getTaskState(task.id);
                    return (
                      <div key={`${tasksTab}-${task.id}`} className="rounded-xl border p-2">
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={state.include} onChange={(e) => setTaskState(task.id, { include: e.target.checked })} className="mt-1" />
                          <div>
                            <div className="font-medium">{task.titre}</div>
                            <div className="text-xs text-slate-500">{asTaskLabel(task)} | {task.statut} {task.retard ? "| retard" : ""}</div>
                          </div>
                        </label>
                        <input className="mt-2 w-full rounded-lg border px-2 py-1 text-sm" placeholder="Commentaire ligne (optionnel)" value={state.comment} onChange={(e) => setTaskState(task.id, { comment: e.target.value })} />
                      </div>
                    );
                  })}
                </div>
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Réserves</summary>
                <div className="mt-2 max-h-52 overflow-auto space-y-2">
                  {reserves.map((reserve) => {
                    const state = getReserveState(reserve.id);
                    return (
                      <div key={reserve.id} className="rounded-xl border p-2">
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={state.include} onChange={(e) => setReserveState(reserve.id, { include: e.target.checked })} className="mt-1" />
                          <div>
                            <div className="font-medium">{reserve.titre}</div>
                            <div className="text-xs text-slate-500">{reserve.intervenant ?? "-"} | {reserve.statut}</div>
                          </div>
                        </label>
                        <input className="mt-2 w-full rounded-lg border px-2 py-1 text-sm" placeholder="Commentaire réserve (optionnel)" value={state.comment} onChange={(e) => setReserveState(reserve.id, { comment: e.target.value })} />
                      </div>
                    );
                  })}
                </div>
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Planning / Jalons</summary>
                <div className="mt-2 max-h-52 overflow-auto space-y-2">
                  {planningDraft.length === 0 ? (
                    <div className="text-sm text-slate-500">Aucun jalon planning.</div>
                  ) : (
                    planningDraft.map((row, idx) => (
                      <div key={row.id} className="rounded-xl border p-2">
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={row.include} onChange={(e) => setPlanningDraft((prev) => prev.map((item, i) => (i === idx ? { ...item, include: e.target.checked } : item)))} className="mt-1" />
                          <div>
                            <div className="font-medium">{row.label}</div>
                            <div className="text-xs text-slate-500">{normalizeDateFr(row.date_debut)} - {normalizeDateFr(row.date_fin)} {row.retard ? "(retard)" : ""}</div>
                          </div>
                        </label>
                        <input className="mt-2 w-full rounded-lg border px-2 py-1 text-sm" placeholder="Commentaire planning (optionnel)" value={row.comment} onChange={(e) => setPlanningDraft((prev) => prev.map((item, i) => (i === idx ? { ...item, comment: e.target.value } : item)))} />
                      </div>
                    ))
                  )}
                </div>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-16" placeholder="Remarques planning" value={remarquesPlanning} onChange={(e) => setRemarquesPlanning(e.target.value)} />
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Intervenants</summary>
                <div className="mt-2 grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div>
                    <label className="text-xs text-slate-600">Intervenant</label>
                    <select className="w-full rounded-xl border px-3 py-2 text-sm" value={previewIntervenantId} onChange={(e) => setPreviewIntervenantId(e.target.value)}>
                      <option value="">Tous</option>
                      {intervenants.map((it) => (<option key={it.id} value={it.id}>{it.nom}</option>))}
                    </select>
                    {previewIntervenantId && (
                      <textarea className="mt-2 w-full rounded-xl border px-3 py-2 text-sm min-h-20" placeholder="Commentaire intervenant" value={intervenantNotes[previewIntervenantId] ?? ""} onChange={(e) => setIntervenantNotes((prev) => ({ ...prev, [previewIntervenantId]: e.target.value }))} />
                    )}
                  </div>
                  <div className="rounded-xl border p-3 text-sm space-y-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Vue ciblée</div>
                    <div><span className="font-medium">Tâches réalisées:</span> {filteredForIntervenant.done.length}</div>
                    <div><span className="font-medium">Tâches à faire:</span> {filteredForIntervenant.todo.length}</div>
                    <div><span className="font-medium">Réserves:</span> {filteredForIntervenant.reserves.length}</div>
                    <div><span className="font-medium">Planning:</span> {filteredForIntervenant.planning.length}</div>
                    <div><span className="font-medium">Actions:</span> {filteredForIntervenant.actions.length}</div>
                  </div>
                </div>
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Annexes</summary>
                <div className="space-y-2 max-h-44 overflow-auto rounded-xl border p-2">
                  {documents.map((doc) => (
                    <label key={doc.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedDocumentIds.includes(doc.id)} onChange={(e) => toggleDocument(doc.id, e.target.checked)} />
                      <span className="truncate">{doc.title}</span>
                      <span className="text-xs text-slate-500">({doc.category})</span>
                    </label>
                  ))}
                </div>
                <label className="block text-sm">
                  <span className="text-xs text-slate-600">Photos terrain</span>
                  <input type="file" accept="image/*" capture="environment" multiple className="mt-1 block w-full text-sm" onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))} />
                </label>
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Notes terrain</summary>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-24" placeholder="Saisie libre terrain" value={notesTerrain} onChange={(e) => setNotesTerrain(e.target.value)} />
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Synthèse</summary>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={onGenerateSyntheseIA}>Générer la synthèse (IA)</button>
                  {iaInfo && <div className="text-xs text-slate-500">{iaInfo}</div>}
                </div>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-24" placeholder="Synthèse finale" value={synthese} onChange={(e) => setSynthese(e.target.value)} />
                <div className="space-y-2">
                  {synthesePoints.map((point, idx) => (
                    <input key={`sp-${idx}`} className="w-full rounded-lg border px-2 py-1 text-sm" value={point} onChange={(e) => setSynthesePoints((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))} />
                  ))}
                  <button type="button" className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setSynthesePoints((prev) => [...prev, ""])}>+ Point clé</button>
                </div>
              </details>

              <details open className="rounded-2xl border bg-white p-4 space-y-3">
                <summary className="font-semibold cursor-pointer">Décisions & actions</summary>
                <div className="flex justify-end">
                  <button type="button" className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setActionsDraft((prev) => [...prev, createActionDraft()])}>+ Action</button>
                </div>
                <div className="space-y-2">
                  {actions.map((row, index) => (
                    <div key={row.id} className="grid gap-2 lg:grid-cols-12 rounded-xl border p-2">
                      <input className="rounded-lg border px-2 py-1 text-sm lg:col-span-4" placeholder="Action" value={row.description} onChange={(e) => setActionsDraft((prev) => prev.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)))} />
                      <select className="rounded-lg border px-2 py-1 text-sm lg:col-span-2" value={row.intervenant_id ?? ""} onChange={(e) => {
                        const intervenantId = e.target.value || null;
                        setActionsDraft((prev) => prev.map((item, i) => i === index ? {
                          ...item,
                          intervenant_id: intervenantId,
                          responsable_type: intervenantId ? "INTERVENANT" : "AUTRE",
                          responsable_nom: intervenantId ? intervenantById.get(intervenantId)?.nom ?? "" : item.responsable_nom,
                        } : item));
                      }}>
                        <option value="">Responsable libre</option>
                        {intervenants.map((it) => (<option key={it.id} value={it.id}>{it.nom}</option>))}
                      </select>
                      <input className="rounded-lg border px-2 py-1 text-sm lg:col-span-2" placeholder="Nom responsable" value={row.responsable_nom} onChange={(e) => setActionsDraft((prev) => prev.map((item, i) => (i === index ? { ...item, responsable_nom: e.target.value } : item)))} />
                      <input type="date" className="rounded-lg border px-2 py-1 text-sm lg:col-span-2" value={row.echeance} onChange={(e) => setActionsDraft((prev) => prev.map((item, i) => (i === index ? { ...item, echeance: e.target.value } : item)))} />
                      <select className="rounded-lg border px-2 py-1 text-sm lg:col-span-1" value={row.statut} onChange={(e) => setActionsDraft((prev) => prev.map((item, i) => (i === index ? { ...item, statut: e.target.value as ChantierVisiteActionStatus } : item)))}>
                        <option value="A_FAIRE">A faire</option>
                        <option value="EN_COURS">En cours</option>
                        <option value="FAIT">Fait</option>
                      </select>
                      <button type="button" className="rounded-lg border px-2 py-1 text-xs text-red-600 hover:bg-red-50 lg:col-span-1" onClick={() => setActionsDraft((prev) => prev.length <= 1 ? [createActionDraft()] : prev.filter((_, i) => i !== index))}>Suppr</button>
                      <input className="rounded-lg border px-2 py-1 text-sm lg:col-span-12" placeholder="Commentaire" value={row.commentaire} onChange={(e) => setActionsDraft((prev) => prev.map((item, i) => (i === index ? { ...item, commentaire: e.target.value } : item)))} />
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {tab === "export" && (
            <div className="rounded-2xl border bg-white p-4 space-y-4">
              <div className="font-semibold">Export</div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border p-3 space-y-2">
                  <div className="text-sm font-medium">Rapport interne</div>
                  <button
                    type="button"
                    className="w-full rounded-xl px-4 py-2 text-sm bg-[#2563EB] text-white hover:bg-blue-600"
                    onClick={() => void onExportGlobal()}
                    disabled={saving || loadingInit || !visite}
                  >
                    {saving ? "Export..." : "Exporter compte-rendu global (PDF)"}
                  </button>
                </div>

                <div className="rounded-xl border p-3 space-y-2">
                  <div className="text-sm font-medium">Rapport client</div>
                  <button
                    type="button"
                    className="w-full rounded-xl px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
                    onClick={() => void onExportClientReport()}
                    disabled={saving || loadingInit || !visite}
                  >
                    {saving ? "Generation..." : "Générer rapport client"}
                  </button>
                </div>

                <div className="rounded-xl border p-3 space-y-2">
                  <div className="text-sm font-medium">Exporter par intervenant</div>
                  <select className="w-full rounded-xl border px-3 py-2 text-sm" value={exportIntervenantId} onChange={(e) => setExportIntervenantId(e.target.value)}>
                    <option value="">Selectionner</option>
                    {intervenants.map((it) => (<option key={it.id} value={it.id}>{it.nom}</option>))}
                  </select>
                  <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => void onExportIntervenant()} disabled={saving || !exportIntervenantId}>
                    Exporter PDF intervenant
                  </button>
                </div>
              </div>

              {downloadUrl && (
                <div className="rounded-xl border p-3 flex flex-wrap items-center gap-2">
                  <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => window.open(downloadUrl, "_blank", "noopener,noreferrer")}>Ouvrir dernier PDF genere</button>
                  <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={async () => navigator.clipboard.writeText(downloadUrl)}>Copier lien</button>
                </div>
              )}

              <div className="text-xs text-slate-500">L'export utilise le snapshot figé + inclusions/exclusions + commentaires.</div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t bg-white flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {visite ? `Visite #${visite.numero ?? "-"} - autosave ${autosaving ? "en cours" : "ok"}` : "Préparation..."}
          </div>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

