import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import TaskTemplateDrawer from "../components/TaskTemplateDrawer";
import Toast, { type ToastState } from "../components/chantiers/Toast";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
} from "../services/profileFeaturePermissions.service";
import {
  create,
  duplicate,
  list,
  remove,
  update,
  type TaskTemplateInput,
  type TaskTemplateRow,
} from "../services/taskLibrary.service";
import {
  listTaskTemplatePreparationByTemplateIds,
  replaceTaskTemplatePreparation,
} from "../services/taskTemplatePreparation.service";
import { useI18n } from "../i18n";

type PreparationSummary = {
  materials: number;
  equipment: number;
};

type ReadinessFilter =
  | ""
  | "missing_time"
  | "missing_cost"
  | "missing_technical"
  | "missing_preparation"
  | "quote_hidden"
  | "chantier_hidden";

type UsageField = "quote_visible" | "chantier_visible";

type PriorityAction = {
  key: ReadinessFilter;
  title: string;
  count: number;
  description: string;
  actionLabel: string;
  template: TaskTemplateRow | null;
  disabled?: boolean;
};

type EmptyStateCopy = {
  label: string;
  title: string;
  description: string;
};

const READINESS_FILTERS: ReadinessFilter[] = [
  "missing_time",
  "missing_cost",
  "missing_technical",
  "missing_preparation",
  "quote_hidden",
  "chantier_hidden",
];

const READINESS_EMPTY_COPY: Record<Exclude<ReadinessFilter, "">, EmptyStateCopy> = {
  missing_time: {
    label: "Temps à compléter",
    title: "Aucun modèle sans temps prévu",
    description: "Les modèles visibles avec ces filtres ont déjà une charge chantier renseignée.",
  },
  missing_cost: {
    label: "Coût à compléter",
    title: "Aucun modèle sans coût de référence",
    description: "Les modèles visibles avec ces filtres sont déjà exploitables pour le chiffrage.",
  },
  missing_technical: {
    label: "Technique à compléter",
    title: "Aucun modèle sans détail technique",
    description: "Les modèles visibles avec ces filtres ont déjà une base d'exécution terrain.",
  },
  missing_preparation: {
    label: "Préparation à compléter",
    title: "Aucun modèle sans préparation",
    description: "Les modèles visibles avec ces filtres ont déjà des besoins préparatoires associés.",
  },
  quote_hidden: {
    label: "Masqués au devis",
    title: "Aucun modèle masqué au devis",
    description: "Tous les modèles visibles avec ces filtres restent disponibles pour le chiffrage.",
  },
  chantier_hidden: {
    label: "Masqués au chantier",
    title: "Aucun modèle masqué en production",
    description: "Tous les modèles visibles avec ces filtres restent disponibles pour les chantiers.",
  },
};

function isReadinessFilter(value: string): value is ReadinessFilter {
  return value === "" || READINESS_FILTERS.includes(value as ReadinessFilter);
}

function getPreparationSummary(
  preparationByTemplateId: Record<string, PreparationSummary>,
  templateId: string,
): PreparationSummary {
  return preparationByTemplateId[templateId] ?? { materials: 0, equipment: 0 };
}

function hasTechnicalDetail(row: TaskTemplateRow) {
  return Boolean(row.description_technique) || row.caracteristiques.length > 0 || Boolean(row.remarques);
}

function hasPreparation(
  row: TaskTemplateRow,
  preparationByTemplateId: Record<string, PreparationSummary>,
) {
  const preparation = getPreparationSummary(preparationByTemplateId, row.id);
  return preparation.materials + preparation.equipment > 0;
}

function buildTemplateUsagePayload(row: TaskTemplateRow, field: UsageField): TaskTemplateInput {
  return {
    titre: row.titre,
    lot: row.lot,
    unite: row.unite,
    quantite_defaut: row.quantite_defaut,
    temps_prevu_par_unite_h: row.temps_prevu_par_unite_h,
    remarques: row.remarques,
    description_technique: row.description_technique,
    caracteristiques: row.caracteristiques,
    cout_reference_unitaire_ht: row.cout_reference_unitaire_ht,
    quote_visible: field === "quote_visible" ? !row.quote_visible : row.quote_visible,
    chantier_visible: field === "chantier_visible" ? !row.chantier_visible : row.chantier_visible,
    labor_items: row.labor_items,
    fee_items: row.fee_items,
  };
}

export default function BibliothequeTasksPage() {
  const { locale, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const templateQueryParam = searchParams.get("q") ?? "";
  const templateIdQueryParam = searchParams.get("templateId") ?? "";
  const lotQueryParam = (searchParams.get("lot") ?? "").trim();
  const readinessQueryParam = searchParams.get("readiness") ?? "";
  const initialReadinessFilter = isReadinessFilter(readinessQueryParam) ? readinessQueryParam : "";
  const openedTemplateFromUrlRef = useRef("");
  const [rows, setRows] = useState<TaskTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(templateQueryParam);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<TaskTemplateRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibilityUpdateId, setVisibilityUpdateId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [advancedPreparationEnabled, setAdvancedPreparationEnabled] = useState(false);
  const [selectedLot, setSelectedLot] = useState(lotQueryParam);
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>(initialReadinessFilter);
  const [preparationSchemaReady, setPreparationSchemaReady] = useState(true);
  const [preparationByTemplateId, setPreparationByTemplateId] = useState<Record<string, PreparationSummary>>({});

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setQuery((current) => current === templateQueryParam ? current : templateQueryParam);
  }, [templateQueryParam]);

  useEffect(() => {
    const nextReadiness = isReadinessFilter(readinessQueryParam) ? readinessQueryParam : "";
    setReadinessFilter((current) => current === nextReadiness ? current : nextReadiness);

    if (readinessQueryParam && !isReadinessFilter(readinessQueryParam)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("readiness");
      setSearchParams(nextParams, { replace: true });
    }
  }, [readinessQueryParam, searchParams, setSearchParams]);

  const lotOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => (row.lot ?? "").trim()).filter((lot) => lot.length > 0)),
    ).sort((a, b) => a.localeCompare(b, locale));
  }, [locale, rows]);

  useEffect(() => {
    if (loading) return;

    const nextLot = lotQueryParam && lotOptions.includes(lotQueryParam) ? lotQueryParam : "";
    setSelectedLot((current) => current === nextLot ? current : nextLot);

    if (lotQueryParam && !lotOptions.includes(lotQueryParam)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("lot");
      setSearchParams(nextParams, { replace: true });
    }
  }, [loading, lotOptions, lotQueryParam, searchParams, setSearchParams]);

  const libraryStats = useMemo(() => {
    const withTime = rows.filter((row) => row.temps_prevu_par_unite_h !== null).length;
    const withCost = rows.filter((row) => row.cout_reference_unitaire_ht !== null).length;
    const withTechnicalDetail = rows.filter(hasTechnicalDetail).length;
    const withPreparation = rows.filter((row) => hasPreparation(row, preparationByTemplateId)).length;
    const quoteVisible = rows.filter((row) => row.quote_visible).length;
    const chantierVisible = rows.filter((row) => row.chantier_visible).length;
    const totalReferenceCost = rows.reduce((sum, row) => {
      const unitCost = Number(row.cout_reference_unitaire_ht ?? 0);
      const quantity = Number(row.quantite_defaut ?? 1);
      return sum + unitCost * quantity;
    }, 0);

    return {
      total: rows.length,
      lots: lotOptions.length,
      withTime,
      withCost,
      withTechnicalDetail,
      withPreparation,
      quoteVisible,
      chantierVisible,
      missingTime: rows.length - withTime,
      missingCost: rows.length - withCost,
      missingTechnicalDetail: rows.length - withTechnicalDetail,
      missingPreparation: advancedPreparationEnabled && preparationSchemaReady ? rows.length - withPreparation : 0,
      hiddenFromQuote: rows.length - quoteVisible,
      hiddenFromChantier: rows.length - chantierVisible,
      totalReferenceCost,
    };
  }, [advancedPreparationEnabled, lotOptions.length, preparationByTemplateId, preparationSchemaReady, rows]);

  const priorityActions = useMemo<PriorityAction[]>(() => {
    const firstMissingCost = rows.find((row) => row.cout_reference_unitaire_ht === null) ?? null;
    const firstMissingTime = rows.find((row) => row.temps_prevu_par_unite_h === null) ?? null;
    const firstMissingTechnical = rows.find((row) => !hasTechnicalDetail(row)) ?? null;
    const firstMissingPreparation = rows.find((row) => !hasPreparation(row, preparationByTemplateId)) ?? null;

    const actions: PriorityAction[] = [
      {
        key: "missing_cost",
        title: "Fiabiliser le chiffrage",
        count: libraryStats.missingCost,
        description: "Modèles sans coût de référence, donc moins exploitables dans les devis.",
        actionLabel: "Traiter le premier coût",
        template: firstMissingCost,
      },
      {
        key: "missing_time",
        title: "Préparer la charge chantier",
        count: libraryStats.missingTime,
        description: "Modèles sans temps prévu par unité, donc difficiles à piloter en exécution.",
        actionLabel: "Traiter le premier temps",
        template: firstMissingTime,
      },
      {
        key: "missing_technical",
        title: "Compléter l'exécution terrain",
        count: libraryStats.missingTechnicalDetail,
        description: "Modèles sans détail technique, caractéristique ou remarque chantier.",
        actionLabel: "Traiter le premier détail",
        template: firstMissingTechnical,
      },
    ];

    if (advancedPreparationEnabled) {
      actions.push({
        key: "missing_preparation",
        title: "Préparer les besoins chantier",
        count: preparationSchemaReady ? libraryStats.missingPreparation : 0,
        description: preparationSchemaReady
          ? "Modèles sans matière ou matériel préparatoire relié à la bibliothèque produits."
          : "La préparation avancée est active, mais le schéma Supabase n'est pas disponible.",
        actionLabel: "Traiter la première préparation",
        template: preparationSchemaReady ? firstMissingPreparation : null,
        disabled: !preparationSchemaReady,
      });
    }

    return actions.filter((action) => action.count > 0 || action.disabled);
  }, [advancedPreparationEnabled, libraryStats, preparationByTemplateId, preparationSchemaReady, rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (selectedLot && (row.lot ?? "").trim() !== selectedLot) return false;
      if (readinessFilter === "missing_time" && row.temps_prevu_par_unite_h !== null) return false;
      if (readinessFilter === "missing_cost" && row.cout_reference_unitaire_ht !== null) return false;
      if (readinessFilter === "missing_technical" && hasTechnicalDetail(row)) return false;
      if (readinessFilter === "missing_preparation" && hasPreparation(row, preparationByTemplateId)) return false;
      if (readinessFilter === "quote_hidden" && row.quote_visible) return false;
      if (readinessFilter === "chantier_hidden" && row.chantier_visible) return false;
      if (!q) return true;
      const searchable = [
        row.titre,
        row.lot,
        row.unite,
        row.description_technique,
        row.remarques,
        row.quote_visible ? "devis chiffrage" : "masque devis",
        row.chantier_visible ? "chantier production" : "masque chantier",
        ...row.caracteristiques,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [preparationByTemplateId, query, readinessFilter, rows, selectedLot]);

  const hasActiveFilters = Boolean(query.trim() || selectedLot || readinessFilter);

  const emptyState = useMemo(() => {
    if (rows.length === 0) {
      return {
        title: "Aucun modèle de tâche enregistré",
        description:
          "Créez les premiers modèles pour fiabiliser les devis, préparer les chantiers et accélérer la production terrain.",
        activeFilters: [] as string[],
      };
    }

    const activeFilters: string[] = [];
    const trimmedQuery = query.trim();
    if (trimmedQuery) activeFilters.push(`Recherche : ${trimmedQuery}`);
    if (selectedLot) activeFilters.push(`Lot : ${selectedLot}`);
    if (readinessFilter) activeFilters.push(READINESS_EMPTY_COPY[readinessFilter].label);

    const readinessCopy = readinessFilter ? READINESS_EMPTY_COPY[readinessFilter] : null;
    const title = readinessCopy?.title ?? "Aucun modèle ne correspond aux filtres";
    const description = selectedLot
      ? `${readinessCopy?.description ?? "Aucun modèle ne correspond à la combinaison active."} Le lot ${selectedLot} peut être déjà complet ou ne pas contenir ce type de modèle.`
      : readinessCopy?.description ?? "Ajustez la recherche ou retirez les filtres pour retrouver les modèles de la bibliothèque.";

    return { title, description, activeFilters };
  }, [query, readinessFilter, rows.length, selectedLot]);

  function resetFilters() {
    setQuery("");
    setSelectedLot("");
    setReadinessFilter("");
    openedTemplateFromUrlRef.current = "";
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("q");
    nextParams.delete("lot");
    nextParams.delete("readiness");
    nextParams.delete("templateId");
    setSearchParams(nextParams, { replace: true });
  }

  function formatCurrency(value: number | null) {
    if (value === null) return "-";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  }

  function formatHours(value: number | null) {
    if (value === null) return "-";
    return `${value.toLocaleString(locale)} h`;
  }

  function renderUsageBadges(row: TaskTemplateRow) {
    return (
      <>
        {row.quote_visible ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            Devis
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
            Masqué devis
          </span>
        )}
        {row.chantier_visible ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Chantier
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
            Masqué chantier
          </span>
        )}
      </>
    );
  }

  function renderPreparationBadge(templateId: string) {
    if (!advancedPreparationEnabled) return null;
    if (!preparationSchemaReady) {
      return (
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          Préparation indisponible
        </span>
      );
    }

    const preparation = getPreparationSummary(preparationByTemplateId, templateId);
    const total = preparation.materials + preparation.equipment;
    if (total === 0) {
      return (
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          Préparation à compléter
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        Prépa : {preparation.materials} mat. / {preparation.equipment} matériel
      </span>
    );
  }

  function renderUsageActions(row: TaskTemplateRow, className = "rounded-lg border px-2 py-1 text-xs hover:bg-slate-50") {
    const quoteBusy = visibilityUpdateId === `${row.id}:quote_visible`;
    const chantierBusy = visibilityUpdateId === `${row.id}:chantier_visible`;

    return (
      <>
        <button
          type="button"
          disabled={quoteBusy}
          onClick={() => onToggleUsage(row, "quote_visible")}
          className={`${className} border-sky-200 text-sky-700 disabled:opacity-50`}
        >
          {quoteBusy ? "Mise à jour..." : row.quote_visible ? "Masquer devis" : "Afficher devis"}
        </button>
        <button
          type="button"
          disabled={chantierBusy}
          onClick={() => onToggleUsage(row, "chantier_visible")}
          className={`${className} border-emerald-200 text-emerald-700 disabled:opacity-50`}
        >
          {chantierBusy ? "Mise à jour..." : row.chantier_visible ? "Masquer chantier" : "Afficher chantier"}
        </button>
      </>
    );
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await list();
      setRows(data);
    } catch (err: any) {
      setError(err?.message ?? t("bibliothequeTasks.loadError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (loading || rows.length === 0) return;

    const urlKey = templateIdQueryParam ? `id:${templateIdQueryParam}` : templateQueryParam ? `q:${templateQueryParam}` : "";
    if (!urlKey) {
      openedTemplateFromUrlRef.current = "";
      return;
    }
    if (openedTemplateFromUrlRef.current === urlKey) return;

    const normalizedQuery = templateQueryParam.trim().toLocaleLowerCase(locale);
    const template = templateIdQueryParam
      ? rows.find((row) => row.id === templateIdQueryParam)
      : rows.find((row) => row.titre.trim().toLocaleLowerCase(locale) === normalizedQuery);

    if (!template) return;

    setActiveTemplate(template);
    setDrawerError(null);
    setDrawerOpen(true);
    openedTemplateFromUrlRef.current = urlKey;
  }, [loading, locale, rows, templateIdQueryParam, templateQueryParam]);

  useEffect(() => {
    let alive = true;

    async function loadPermissions() {
      try {
        const result = await getCurrentProfileFeaturePermissions();
        if (!alive) return;
        setAdvancedPreparationEnabled(
          hasProfileFeaturePermission(
            result.permissions,
            "task_library_preparation",
            result.role,
          ),
        );
      } catch {
        if (!alive) return;
        setAdvancedPreparationEnabled(false);
      }
    }

    void loadPermissions();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadPreparationCoverage() {
      if (!advancedPreparationEnabled || rows.length === 0) {
        setPreparationSchemaReady(true);
        setPreparationByTemplateId({});
        return;
      }

      try {
        const result = await listTaskTemplatePreparationByTemplateIds(rows.map((row) => row.id));
        if (!alive) return;
        setPreparationSchemaReady(result.schemaReady);

        const next: Record<string, PreparationSummary> = {};
        for (const row of rows) {
          next[row.id] = {
            materials: result.materialsByTemplateId[row.id]?.length ?? 0,
            equipment: result.equipmentByTemplateId[row.id]?.length ?? 0,
          };
        }
        setPreparationByTemplateId(next);
      } catch {
        if (!alive) return;
        setPreparationSchemaReady(false);
        setPreparationByTemplateId({});
      }
    }

    void loadPreparationCoverage();

    return () => {
      alive = false;
    };
  }, [advancedPreparationEnabled, rows]);

  function updateQueryFromInput(nextQuery: string) {
    setQuery(nextQuery);
    openedTemplateFromUrlRef.current = "";
    const nextParams = new URLSearchParams(searchParams);
    const trimmed = nextQuery.trim();
    if (trimmed) {
      nextParams.set("q", trimmed);
    } else {
      nextParams.delete("q");
    }
    nextParams.delete("templateId");
    setSearchParams(nextParams, { replace: true });
  }

  function updateReadinessFilter(nextFilter: ReadinessFilter) {
    setReadinessFilter(nextFilter);
    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter) {
      nextParams.set("readiness", nextFilter);
    } else {
      nextParams.delete("readiness");
    }
    nextParams.delete("templateId");
    setSearchParams(nextParams, { replace: true });
  }

  function updateSelectedLot(nextLot: string) {
    setSelectedLot(nextLot);
    const nextParams = new URLSearchParams(searchParams);
    if (nextLot) {
      nextParams.set("lot", nextLot);
    } else {
      nextParams.delete("lot");
    }
    nextParams.delete("templateId");
    setSearchParams(nextParams, { replace: true });
  }

  function openCreateDrawer() {
    setActiveTemplate(null);
    setDrawerError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(template: TaskTemplateRow) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("templateId", template.id);
    setSearchParams(nextParams, { replace: true });
    openedTemplateFromUrlRef.current = `id:${template.id}`;
    setActiveTemplate(template);
    setDrawerError(null);
    setDrawerOpen(true);
  }

  function applyPriorityAction(action: PriorityAction) {
    if (action.disabled) return;
    setReadinessFilter(action.key);
    setSelectedLot("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("readiness", action.key);
    nextParams.delete("lot");
    if (action.template) {
      nextParams.set("templateId", action.template.id);
      openedTemplateFromUrlRef.current = `id:${action.template.id}`;
      setActiveTemplate(action.template);
      setDrawerError(null);
      setDrawerOpen(true);
    } else {
      nextParams.delete("templateId");
    }
    setSearchParams(nextParams, { replace: true });
  }

  function buildTemplateLink(templateId: string) {
    const url = new URL(window.location.href);
    url.pathname = "/bibliotheque";
    url.search = "";
    url.searchParams.set("templateId", templateId);
    return url.toString();
  }

  async function copyTemplateLink(template: TaskTemplateRow) {
    const link = buildTemplateLink(template.id);
    try {
      await navigator.clipboard.writeText(link);
      setToast({ type: "ok", msg: `Lien copié : ${template.titre}` });
    } catch {
      window.prompt("Copier le lien de la fiche modèle", link);
    }
  }

  function closeDrawer() {
    if (saving || deleting) return;
    setDrawerOpen(false);
    setActiveTemplate(null);
    setDrawerError(null);
    if (!templateIdQueryParam) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("templateId");
    setSearchParams(nextParams, { replace: true });
  }

  async function onSaveDrawer(payload: TaskTemplateInput) {
    setSaving(true);
    setDrawerError(null);
    try {
      const { preparation_materials = [], preparation_equipment = [], ...basePayload } = payload;

      if (!activeTemplate) {
        const created = await create(basePayload);
        if (advancedPreparationEnabled) {
          await replaceTaskTemplatePreparation(created.id, {
            materials: preparation_materials,
            equipment: preparation_equipment,
          });
        }
        setRows((prev) => [created, ...prev]);
        setToast({ type: "ok", msg: t("bibliothequeTasks.created") });
      } else {
        const updated = await update(activeTemplate.id, basePayload);
        if (advancedPreparationEnabled) {
          await replaceTaskTemplatePreparation(updated.id, {
            materials: preparation_materials,
            equipment: preparation_equipment,
          });
        }
        setRows((prev) => prev.map((row) => (row.id === activeTemplate.id ? updated : row)));
        setToast({ type: "ok", msg: t("bibliothequeTasks.updated") });
      }
      closeDrawer();
    } catch (err: any) {
      setDrawerError(err?.message ?? t("bibliothequeTasks.saveError"));
      setToast({ type: "error", msg: err?.message ?? t("bibliothequeTasks.saveError") });
    } finally {
      setSaving(false);
    }
  }

  async function onToggleUsage(row: TaskTemplateRow, field: UsageField) {
    const updateId = `${row.id}:${field}`;
    setVisibilityUpdateId(updateId);
    try {
      const updated = await update(row.id, buildTemplateUsagePayload(row, field));
      setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      setToast({
        type: "ok",
        msg:
          field === "quote_visible"
            ? updated.quote_visible
              ? "Modèle visible au devis."
              : "Modèle masqué au devis."
            : updated.chantier_visible
              ? "Modèle visible au chantier."
              : "Modèle masqué au chantier.",
      });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? "Impossible de mettre à jour l'usage du modèle." });
    } finally {
      setVisibilityUpdateId(null);
    }
  }

  async function onDeleteDrawer(id: string) {
    setDeleting(true);
    setDrawerError(null);
    try {
      await remove(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setToast({ type: "ok", msg: t("bibliothequeTasks.deleted") });
      closeDrawer();
    } catch (err: any) {
      setDrawerError(err?.message ?? t("bibliothequeTasks.deleteError"));
      setToast({ type: "error", msg: err?.message ?? t("bibliothequeTasks.deleteError") });
    } finally {
      setDeleting(false);
    }
  }

  async function onDuplicate(templateId: string) {
    setDuplicateId(templateId);
    try {
      const duplicated = await duplicate(templateId);
      setRows((prev) => [duplicated, ...prev]);
      setToast({ type: "ok", msg: t("bibliothequeTasks.duplicated") });
    } catch (err: any) {
      setToast({ type: "error", msg: t("bibliothequeTasks.duplicateError") });
    } finally {
      setDuplicateId(null);
    }
  }

  async function onDeleteRow(template: TaskTemplateRow) {
    const ok = window.confirm(t("bibliothequeTasks.deleteConfirm", { name: template.titre }));
    if (!ok) return;
    setDeleteId(template.id);
    try {
      await remove(template.id);
      setRows((prev) => prev.filter((row) => row.id !== template.id));
      setToast({ type: "ok", msg: t("bibliothequeTasks.deleted") });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? t("bibliothequeTasks.deleteError") });
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("bibliothequeTasks.title")}</h1>
          <p className="text-slate-500">{t("bibliothequeTasks.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openCreateDrawer}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 sm:shrink-0"
        >
          + {t("bibliothequeTasks.new")}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <button
          type="button"
          onClick={() => updateReadinessFilter("")}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Modèles</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.total}</div>
          <div className="text-xs text-slate-500">{libraryStats.lots} lots structurés</div>
        </button>
        <button
          type="button"
          onClick={() => updateReadinessFilter("quote_hidden")}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Devis</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.quoteVisible}</div>
          <div className="text-xs text-slate-500">{libraryStats.hiddenFromQuote} masqués au chiffrage</div>
        </button>
        <button
          type="button"
          onClick={() => updateReadinessFilter("chantier_hidden")}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Chantier</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.chantierVisible}</div>
          <div className="text-xs text-slate-500">{libraryStats.hiddenFromChantier} masqués en production</div>
        </button>
        <button
          type="button"
          onClick={() => updateReadinessFilter("missing_time")}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Temps</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.withTime}</div>
          <div className="text-xs text-slate-500">{libraryStats.missingTime} à compléter</div>
        </button>
        <button
          type="button"
          onClick={() => updateReadinessFilter("missing_cost")}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Prix</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.withCost}</div>
          <div className="text-xs text-slate-500">{libraryStats.missingCost} sans coût de référence</div>
        </button>
        <button
          type="button"
          onClick={() => updateReadinessFilter("missing_technical")}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Technique</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.withTechnicalDetail}</div>
          <div className="text-xs text-slate-500">{libraryStats.missingTechnicalDetail} sans détail chantier</div>
        </button>
      </div>

      {!loading && rows.length > 0 ? (
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">Priorités bibliothèque</div>
              <h2 className="text-lg font-semibold text-slate-900">Mise en production des modèles</h2>
              <p className="text-sm text-slate-500">
                Les modèles incomplets sont regroupés par impact métier : devis, charge chantier, exécution terrain et préparation.
              </p>
            </div>
            {priorityActions.length === 0 ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Bibliothèque prête devis / chantier
              </span>
            ) : null}
          </div>

          {priorityActions.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {priorityActions.map((action) => (
                <div
                  key={action.key}
                  className={`rounded-xl border p-3 ${action.disabled ? "bg-slate-50 text-slate-500" : "bg-slate-50/60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{action.title}</div>
                      <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                    </div>
                    <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      {action.disabled ? "Indispo." : action.count}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={action.disabled || !action.template}
                    onClick={() => applyPriorityAction(action)}
                    className="mt-3 rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {action.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Aucun trou bloquant détecté sur les modèles chargés : les coûts, temps et détails techniques sont renseignés.
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_240px]">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder={t("bibliothequeTasks.searchPlaceholder")}
          value={query}
          onChange={(e) => updateQueryFromInput(e.target.value)}
        />
        <select
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          value={readinessFilter}
          onChange={(e) => updateReadinessFilter(e.target.value as ReadinessFilter)}
        >
          <option value="">Tous les états</option>
          <option value="quote_hidden">Masqués au devis</option>
          <option value="chantier_hidden">Masqués au chantier</option>
          <option value="missing_time">Temps à compléter</option>
          <option value="missing_cost">Coût à compléter</option>
          <option value="missing_technical">Technique à compléter</option>
          <option value="missing_preparation" disabled={!advancedPreparationEnabled || !preparationSchemaReady}>
            Préparation à compléter
          </option>
        </select>
        <select
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          value={selectedLot}
          onChange={(e) => updateSelectedLot(e.target.value)}
        >
          <option value="">Tous les lots</option>
          {lotOptions.map((lot) => (
            <option key={lot} value={lot}>
              {lot}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("common.states.loading")}</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-600">
          <div className="text-xs font-medium uppercase text-slate-500">Vue bibliothèque</div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">{emptyState.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{emptyState.description}</p>

          {emptyState.activeFilters.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {emptyState.activeFilters.map((filter) => (
                <span
                  key={filter}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                >
                  {filter}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Réinitialiser les filtres
              </button>
            ) : null}
            {rows.length === 0 ? (
              <button
                type="button"
                onClick={openCreateDrawer}
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Créer un modèle
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.title")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.lot")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.unit")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.defaultQuantity")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.timePerUnit")}</th>
                  <th className="px-4 py-3 text-left font-medium">Coût ref.</th>
                  <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.updatedAt")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("common.actions.edit")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.titre}</div>
                      {row.description_technique ? (
                        <div className="line-clamp-2 text-xs text-slate-500">{row.description_technique}</div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {renderUsageBadges(row)}
                        {row.caracteristiques.slice(0, 3).map((item) => (
                          <span
                            key={`${row.id}-${item}`}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                        {row.temps_prevu_par_unite_h === null ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                            Temps manquant
                          </span>
                        ) : null}
                        {row.cout_reference_unitaire_ht === null ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                            Coût manquant
                          </span>
                        ) : null}
                        {!hasTechnicalDetail(row) ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                            Technique à compléter
                          </span>
                        ) : null}
                        {renderPreparationBadge(row.id)}
                      </div>
                      {row.remarques ? <div className="truncate text-xs text-slate-500">{row.remarques}</div> : null}
                    </td>
                    <td className="px-4 py-3">{row.lot ?? "-"}</td>
                    <td className="px-4 py-3">{row.unite ?? "-"}</td>
                    <td className="px-4 py-3">{row.quantite_defaut ?? "-"}</td>
                    <td className="px-4 py-3">{formatHours(row.temps_prevu_par_unite_h)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.cout_reference_unitaire_ht)}</td>
                    <td className="px-4 py-3">
                      {row.updated_at ? new Date(row.updated_at).toLocaleDateString(locale) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditDrawer(row)}
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          {t("common.actions.edit")}
                        </button>
                        {renderUsageActions(row)}
                        <button
                          type="button"
                          disabled={duplicateId === row.id}
                          onClick={() => onDuplicate(row.id)}
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                        >
                          {duplicateId === row.id ? "Duplication..." : t("common.actions.duplicate")}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyTemplateLink(row)}
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Lien fiche
                        </button>
                        <button
                          type="button"
                          disabled={deleteId === row.id}
                          onClick={() => onDeleteRow(row)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deleteId === row.id ? t("common.states.deleting") : t("common.actions.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {filteredRows.map((row) => (
              <div key={row.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{row.titre}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.lot ?? "Lot non renseigné"}</div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {row.unite ?? "Unité ?"}
                  </div>
                </div>

                {row.description_technique ? (
                  <div className="mt-3 text-sm text-slate-600">{row.description_technique}</div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1">
                  {renderUsageBadges(row)}
                  {row.caracteristiques.slice(0, 4).map((item) => (
                    <span
                      key={`${row.id}-mobile-${item}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                  {row.temps_prevu_par_unite_h === null ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                      Temps manquant
                    </span>
                  ) : null}
                  {row.cout_reference_unitaire_ht === null ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                      Coût manquant
                    </span>
                  ) : null}
                  {!hasTechnicalDetail(row) ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                      Technique à compléter
                    </span>
                  ) : null}
                  {renderPreparationBadge(row.id)}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <div className="text-slate-500">Quantité</div>
                    <div className="font-semibold text-slate-900">{row.quantite_defaut ?? "-"}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <div className="text-slate-500">Temps</div>
                    <div className="font-semibold text-slate-900">{formatHours(row.temps_prevu_par_unite_h)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <div className="text-slate-500">Coût ref.</div>
                    <div className="font-semibold text-slate-900">{formatCurrency(row.cout_reference_unitaire_ht)}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditDrawer(row)}
                    className="rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    {t("common.actions.edit")}
                  </button>
                  {renderUsageActions(row, "rounded-lg border px-3 py-2 text-xs hover:bg-slate-50")}
                  <button
                    type="button"
                    disabled={duplicateId === row.id}
                    onClick={() => onDuplicate(row.id)}
                    className="rounded-lg border px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50"
                  >
                    {duplicateId === row.id ? "Duplication..." : t("common.actions.duplicate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyTemplateLink(row)}
                    className="rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    Lien fiche
                  </button>
                  <button
                    type="button"
                    disabled={deleteId === row.id}
                    onClick={() => onDeleteRow(row)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleteId === row.id ? t("common.states.deleting") : t("common.actions.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <TaskTemplateDrawer
        open={drawerOpen}
        template={activeTemplate}
        saving={saving}
        deleting={deleting}
        error={drawerError}
        advancedPreparationEnabled={advancedPreparationEnabled}
        onClose={closeDrawer}
        onSave={onSaveDrawer}
        onDelete={onDeleteDrawer}
      />

      <Toast toast={toast} />
    </div>
  );
}
