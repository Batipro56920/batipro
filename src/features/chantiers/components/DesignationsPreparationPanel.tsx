import { useEffect, useMemo, useState } from "react";
import { createTask, updateTask, type ChantierTaskRow } from "../../../services/chantierTasks.service";
import { listChantierZones, buildChantierZonePathMap, type ChantierZoneRow } from "../../../services/chantierZones.service";
import { listTaskZoneIdsByTaskIds, replaceTaskZoneIds } from "../../../services/chantierTaskZones.service";
import { listTaskAssigneeIdsByTaskIds, replaceTaskAssignees } from "../../../services/chantierTaskAssignees.service";
import { listIntervenantsByChantierId, type IntervenantRow } from "../../../services/intervenants.service";
import { listChantierPurchaseRequests, type ChantierPurchaseRequestRow } from "../../../services/chantierPurchaseRequests.service";
import { createChantierTimeEntry, listChantierTimeEntriesByChantierId, type ChantierTimeEntryRow } from "../../../services/chantierTimeEntries.service";
import { createTaskMaterialConsumption, listTaskMaterialConsumptions, type TaskMaterialConsumption } from "../../../services/chantierTaskMaterialConsumptions.service";
import { listDevisLignes, type DevisLigneRow, type DevisRow } from "../../../services/devis.service";
import { getCompanyHourlyRates, type CompanyHourlyRates } from "../../../services/indirectCosts.service";
import { list as listTaskTemplates, type TaskTemplateRow } from "../../../services/taskLibrary.service";
import {
  listTaskTemplatePreparationByTemplateIds,
  estimateTaskTemplatePreparation,
  type TaskTemplatePreparationCollection,
} from "../../../services/taskTemplatePreparation.service";
import {
  computeTechnicalTaskCost,
  computeDesignationCost,
  type TechnicalTaskCost,
} from "../../../services/designationTechnicalCosts.service";

type Props = {
  chantierId: string;
  devis: DevisRow[];
  tasks: ChantierTaskRow[];
  onRefresh: () => Promise<void>;
  onTaskOpen: (id: string) => void;
  defaultView?: "preparer" | "produire";
};

const eur = (value: number | null) => value === null ? "Non calculé" :
  value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function DesignationsPreparationPanel({ chantierId, devis, tasks, onRefresh, onTaskOpen, defaultView = "preparer" }: Props) {
  const [lines, setLines] = useState<DevisLigneRow[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateRow[]>([]);
  const [preparation, setPreparation] = useState<TaskTemplatePreparationCollection | null>(null);
  const [rates, setRates] = useState<CompanyHourlyRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [viewByLine, setViewByLine] = useState<Record<string, "preparer" | "produire">>({});
  const [zones, setZones] = useState<ChantierZoneRow[]>([]);
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [zonesByTask, setZonesByTask] = useState<Record<string, string[]>>({});
  const [assigneesByTask, setAssigneesByTask] = useState<Record<string, string[]>>({});
  const [requests, setRequests] = useState<ChantierPurchaseRequestRow[]>([]);
  const [timeEntries, setTimeEntries] = useState<ChantierTimeEntryRow[]>([]);
  const [consumptions, setConsumptions] = useState<TaskMaterialConsumption[]>([]);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, { intervenantId: string; workDate: string; hours: string; doneQuantity: string; materialId: string; materialQuantity: string }>>({});
  const getDraft = (taskId: string) => drafts[taskId] ?? {
    intervenantId: "", workDate: new Date().toISOString().slice(0, 10),
    hours: "", doneQuantity: "", materialId: "", materialQuantity: "",
  };
  function patchDraft(taskId: string, patch: Partial<ReturnType<typeof getDraft>>) {
    setDrafts((previous) => ({ ...previous, [taskId]: { ...getDraft(taskId), ...patch } }));
  }
  const [readinessLoaded, setReadinessLoaded] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const taskIdsKey = useMemo(() => tasks.map((task) => task.id).sort().join(","), [tasks]);
  const zonePaths = useMemo(() => buildChantierZonePathMap(zones), [zones]);

  useEffect(() => {
    let current = true;
    setReadinessLoaded(false);
    setResourceError(null);
    const ids = taskIdsKey ? taskIdsKey.split(",") : [];
    void Promise.all([
      listChantierZones(chantierId),
      listIntervenantsByChantierId(chantierId),
      listTaskZoneIdsByTaskIds(ids),
      listTaskAssigneeIdsByTaskIds(ids),
      listChantierPurchaseRequests(chantierId),
      listChantierTimeEntriesByChantierId(chantierId),
    ]).then(async ([locations, people, zoneLinks, assigneeLinks, purchases, entries]) => {
      if (!current) return;
      setZones(locations.zones);
      setIntervenants(people);
      setZonesByTask(zoneLinks);
      setAssigneesByTask(assigneeLinks);
      setRequests(purchases.requests);
      setTimeEntries(entries);
      try {
        const consumed = await listTaskMaterialConsumptions(ids);
        if (current) setConsumptions(consumed);
      } catch (err) {
        if (current) setResourceError(err instanceof Error ? err.message : "Consommations non disponibles.");
      }
      if (!locations.schemaReady || !purchases.schemaReady) {
        setResourceError("Certaines données d'architecture ou d'approvisionnement ne sont pas disponibles.");
      }
    }).catch((err: unknown) => {
      if (current) setResourceError(err instanceof Error ? err.message : "Impossible de lire les moyens du chantier.");
    }).finally(() => { if (current) setReadinessLoaded(true); });
    return () => { current = false; };
  }, [chantierId, taskIdsKey, reloadVersion]);

  function toggleDesignation(id: string) {
    setExpandedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [allLines, allTemplates, companyRates] = await Promise.all([
          Promise.all(devis.map((row) => listDevisLignes(row.id))).then((groups) => groups.flat()),
          listTaskTemplates(),
          getCompanyHourlyRates().catch(() => null),
        ]);
        const bundle = await listTaskTemplatePreparationByTemplateIds(allTemplates.map((row) => row.id));
        if (!active) return;
        setLines(allLines);
        setExpandedIds((existing) => existing.length > 0 ? existing : allLines.length > 0 ? [allLines[0].id] : []);
        setTemplates(allTemplates);
        setRates(companyRates);
        setPreparation(bundle.schemaReady ? bundle : null);
        if (!bundle.schemaReady) setError("Ratios techniques indisponibles : désignations visibles, coûts non calculés.");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Impossible de charger les désignations.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [chantierId, devis]);

  const templateMap = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates]);

  const taskCosts = useMemo(() => {
    const result = new Map<string, TechnicalTaskCost>();
    if (!preparation) return result;
    for (const task of tasks) {
      result.set(task.id, computeTechnicalTaskCost(
        task, templateMap, preparation.materialsByTemplateId, preparation.equipmentByTemplateId, rates,
      ));
    }
    return result;
  }, [tasks, templateMap, preparation, rates]);

  const unlinked = tasks.filter((task) => !task.devis_ligne_id);

  async function saveTaskField(task: ChantierTaskRow, patch: Parameters<typeof updateTask>[1]) {
    setWorkingId(task.id);
    setError(null);
    try {
      await updateTask(task.id, patch);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setWorkingId(null);
    }
  }

  async function setAssignees(task: ChantierTaskRow, ids: string[]) {
    const previous = assigneesByTask[task.id] ?? (task.intervenant_id ? [task.intervenant_id] : []);
    setAssigneesByTask((before) => ({ ...before, [task.id]: ids }));
    setWorkingId(task.id);
    try {
      await replaceTaskAssignees(task.id, ids);
      await updateTask(task.id, { intervenant_id: ids[0] ?? null });
      await onRefresh();
    } catch (err) {
      setAssigneesByTask((before) => ({ ...before, [task.id]: previous }));
      setError(err instanceof Error ? err.message : "Affectation impossible.");
    } finally { setWorkingId(null); }
  }

  async function setTaskZones(task: ChantierTaskRow, ids: string[]) {
    const previous = zonesByTask[task.id] ?? (task.zone_id ? [task.zone_id] : []);
    setZonesByTask((before) => ({ ...before, [task.id]: ids }));
    setWorkingId(task.id);
    try {
      await replaceTaskZoneIds(task.id, ids);
      await updateTask(task.id, { zone_id: ids.length === 1 ? ids[0] : null });
      await onRefresh();
    } catch (err) {
      setZonesByTask((before) => ({ ...before, [task.id]: previous }));
      setError(err instanceof Error ? err.message : "Localisation impossible.");
    } finally { setWorkingId(null); }
  }

  async function saveRealTime(task: ChantierTaskRow) {
    const draft = getDraft(task.id);
    const hours = Number(draft.hours.replace(",", "."));
    const quantity = draft.doneQuantity.trim() ? Number(draft.doneQuantity.replace(",", ".")) : null;
    const assigned = assigneesByTask[task.id] ?? (task.intervenant_id ? [task.intervenant_id] : []);
    if (!assigned.includes(draft.intervenantId) || !Number.isFinite(hours) || hours <= 0 ||
        (quantity !== null && (!Number.isFinite(quantity) || quantity < 0))) {
      setError("Choisissez un intervenant affecté et une durée valide.");
      return;
    }
    setWorkingId(task.id);
    setError(null);
    try {
      await createChantierTimeEntry({
        chantier_id: chantierId, task_id: task.id, intervenant_id: draft.intervenantId,
        work_date: draft.workDate, duration_hours: hours, quantite_realisee: quantity,
      });
      patchDraft(task.id, { hours: "", doneQuantity: "" });
      setReloadVersion((old) => old + 1);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pointage non enregistré.");
    } finally { setWorkingId(null); }
  }

  async function saveActualMaterial(task: ChantierTaskRow, allowedMaterialIds: string[]) {
    const draft = getDraft(task.id);
    const quantity = Number(draft.materialQuantity.replace(",", "."));
    const assigned = assigneesByTask[task.id] ?? (task.intervenant_id ? [task.intervenant_id] : []);
    setWorkingId(task.id);
    setError(null);
    try {
      await createTaskMaterialConsumption({
        chantier_task_id: task.id, material_ratio_id: draft.materialId,
        intervenant_id: draft.intervenantId, quantite_consommee: quantity,
        work_date: draft.workDate,
      }, allowedMaterialIds, assigned);
      patchDraft(task.id, { materialQuantity: "" });
      setReloadVersion((old) => old + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consommation non enregistrée.");
    } finally { setWorkingId(null); }
  }

  async function createFromTemplate(line: DevisLigneRow) {
    const template = templateMap.get(selection[line.id] ?? "");
    if (!template) return;
    setWorkingId(line.id);
    setError(null);
    try {
      const taskQuantity = template.unite && line.unite &&
        template.unite.trim().toLowerCase().replace("²", "2") === line.unite.trim().toLowerCase().replace("²", "2")
        ? line.quantite ?? 1 : template.quantite_defaut ?? 1;
      await createTask({
        chantier_id: chantierId,
        devis_ligne_id: line.id,
        task_template_id: template.id,
        task_template_label: template.titre,
        titre: template.titre,
        titre_terrain: template.titre,
        lot: template.lot ?? line.corps_etat,
        corps_etat: template.lot ?? line.corps_etat,
        quantite: taskQuantity,
        unite: template.unite,
        temps_prevu_h: (template.temps_prevu_par_unite_h ?? 0) * taskQuantity,
        status: "A_FAIRE",
        quality_status: "a_faire",
        order_index: tasks.length,
      });
      await onRefresh();
      setExpandedIds((old) => old.includes(line.id) ? old : [...old, line.id]);
      setSelection((old) => ({ ...old, [line.id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création de la tâche technique impossible.");
    } finally {
      setWorkingId(null);
    }
  }

  async function reassign(task: ChantierTaskRow, lineId: string | null) {
    setWorkingId(task.id);
    setError(null);
    try {
      await updateTask(task.id, { devis_ligne_id: lineId });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rattachement impossible.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">Prestations du chantier</h2>
        <p className="mt-1 text-sm text-slate-500">
          Une seule liste issue du devis. Ouvrez une prestation pour gérer les opérations techniques et leurs coûts.
        </p>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Chargement des désignations et des coûts...</p> : (
        <div className="space-y-2">
          {lines.length === 0 && <p className="text-sm text-slate-500">Aucune désignation importée. Importez un devis pour commencer.</p>}
          {lines.map((line) => {
            const linked = tasks.filter((task) => task.devis_ligne_id === line.id);
            const summary = computeDesignationCost(line, tasks, taskCosts);
            return (
              <article key={line.id} className="rounded-xl border border-slate-200 bg-white">
                <button type="button" onClick={() => toggleDesignation(line.id)}
                  aria-expanded={expandedIds.includes(line.id)}
                  aria-controls={`designation-details-${line.id}`}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-left hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-slate-500">{line.corps_etat ?? "Sans lot"}</span>
                    <span className="block font-semibold text-slate-950">{line.designation}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {line.quantite ?? "—"} {line.unite ?? ""} · Vente {eur(summary.saleHt)} · {linked.length} tâche{linked.length > 1 ? "s" : ""} technique{linked.length > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-right text-sm">
                    <span>
                      <span className="block text-xs text-slate-500">Coût de revient</span>
                      <strong>{eur(summary.costHt)}</strong>
                      {summary.complete && <span className="block text-xs text-slate-500">Marge {eur(summary.marginHt)}</span>}
                    </span>
                    <span aria-hidden="true" className="text-lg text-slate-500">{expandedIds.includes(line.id) ? "−" : "+"}</span>
                  </span>
                </button>
                {expandedIds.includes(line.id) && (
                <div id={`designation-details-${line.id}`} className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-500">Fiche de la prestation</div>
                    <div className="inline-flex rounded-xl border border-slate-200 p-1">
                      <button type="button" onClick={() => setViewByLine((old) => ({...old, [line.id]: "preparer"}))}
                        className={`rounded-lg px-3 py-1.5 text-sm ${(viewByLine[line.id] ?? defaultView) !== "produire" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Préparer</button>
                      <button type="button" onClick={() => setViewByLine((old) => ({...old, [line.id]: "produire"}))}
                        className={`rounded-lg px-3 py-1.5 text-sm ${(viewByLine[line.id] ?? defaultView) === "produire" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Produire</button>
                    </div>
                  </div>
                  {resourceError && <p className="text-xs text-slate-600">{resourceError}</p>}
                  {!readinessLoaded && <p className="text-xs text-slate-500">Lecture des moyens du chantier…</p>}
                  {linked.map((task) => {
                    const cost = taskCosts.get(task.id);
                    const assigned = assigneesByTask[task.id] ?? (task.intervenant_id ? [task.intervenant_id] : []);
                    const selectedZones = zonesByTask[task.id] ?? (task.zone_id ? [task.zone_id] : []);
                    const estimate = task.task_template_id && preparation
                      ? estimateTaskTemplatePreparation(task,
                          preparation.materialsByTemplateId[task.task_template_id] ?? [],
                          preparation.equipmentByTemplateId[task.task_template_id] ?? []) : null;
                    const taskRequests = requests.filter((request) => request.task_id === task.id && request.statut_commande !== "annule");
                    const timePlanned = cost?.status === "calculated" ? cost.hours : task.temps_prevu_h;
                    const taskEntries = timeEntries.filter((row) => row.task_id === task.id);
                    const actualHours = taskEntries.reduce((sum, row) => sum + Number(row.duration_hours ?? 0), 0);
                    const executedQuantity = taskEntries.reduce((sum, row) => sum + Number(row.quantite_realisee ?? 0), 0);
                    const materialRows = consumptions.filter((row) => row.chantier_task_id === task.id);
                    const trackedRatios = task.task_template_id && preparation
                      ? preparation.materialsByTemplateId[task.task_template_id] ?? [] : [];
                    const draft = getDraft(task.id);
                    const laborCostKnown = taskEntries.every((entry) => entry.hourly_cost_snapshot_ht !== null);
                    const laborActualHt = laborCostKnown ? taskEntries.reduce((sum, entry) =>
                      sum + Number(entry.duration_hours ?? 0) * Number(entry.hourly_cost_snapshot_ht ?? 0), 0) : null;
                    const materialCostKnown = materialRows.every((used) => {
                      const ratio = trackedRatios.find((row) => row.id === used.material_ratio_id);
                      return ratio?.purchase_price_ht !== null && ratio?.purchase_price_ht !== undefined;
                    });
                    const materialActualHt = materialCostKnown ? materialRows.reduce((sum, used) =>
                      sum + used.quantite_consommee * Number(trackedRatios.find((ratio) => ratio.id === used.material_ratio_id)?.purchase_price_ht ?? 0), 0) : null;
                    return <section key={task.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onClick={() => onTaskOpen(task.id)} className="font-semibold text-blue-700 hover:underline">
                          {task.titre_terrain || task.titre}
                        </button>
                        <span className="font-semibold">{eur(cost?.totalHt ?? null)} prévu</span>
                      </div>
                      {(viewByLine[line.id] ?? defaultView) !== "produire" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-xs text-slate-600">Tâche bibliothèque
                            <select disabled={workingId !== null} value={task.task_template_id ?? ""}
                              onChange={(e) => {
                                const template = templateMap.get(e.target.value);
                                void saveTaskField(task, { task_template_id: template?.id ?? null,
                                  task_template_label: template?.titre ?? null });
                              }} className="w-full rounded-lg border bg-white px-2 py-2 text-sm text-slate-900">
                              <option value="">Choisir la référence technique</option>
                              {templates.map((template) => <option key={template.id} value={template.id}>{template.titre}</option>)}
                            </select>
                          </label>
                          <div className="space-y-1">
                            <div className="text-xs text-slate-600">Quantité et temps prévus</div>
                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                              {task.quantite ?? "—"} {task.unite ?? ""} · {timePlanned ?? "—"} h
                              <button type="button" onClick={() => onTaskOpen(task.id)}
                                className="ml-3 text-xs font-semibold text-blue-700 hover:underline">Adapter</button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-slate-700">Architecture — facultative</div>
                            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-white p-2">
                              {zones.filter((zone) => zone.zone_type === "piece").map((zone) =>
                                <label key={zone.id} className="flex items-center gap-2 text-xs text-slate-700">
                                  <input type="checkbox" disabled={workingId !== null} checked={selectedZones.includes(zone.id)}
                                    onChange={(e) => void setTaskZones(task, e.target.checked
                                      ? [...selectedZones, zone.id] : selectedZones.filter((id) => id !== zone.id))} />
                                  {zonePaths.get(zone.id) ?? zone.nom}
                                </label>)}
                              {zones.filter((zone) => zone.zone_type === "piece").length === 0 && <span className="text-xs text-slate-400">Aucune pièce configurée ; localisation facultative</span>}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-slate-700">Intervenants — accès et affectation</div>
                            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-white p-2">
                              {intervenants.map((person) => <label key={person.id} className="flex items-center gap-2 text-xs text-slate-700">
                                <input type="checkbox" disabled={workingId !== null} checked={assigned.includes(person.id)}
                                  onChange={(e) => void setAssignees(task, e.target.checked
                                    ? [...assigned, person.id] : assigned.filter((id) => id !== person.id))} />
                                {person.nom}
                              </label>)}
                              {intervenants.length === 0 && <span className="text-xs text-slate-400">Aucun intervenant affectable au chantier</span>}
                            </div>
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <div className="text-xs font-semibold text-slate-700">Dates de préparation / planning</div>
                            <div className="flex flex-wrap gap-2">
                              <label className="text-xs text-slate-500">Début
                                <input key={task.id + "-start-" + (task.date_debut ?? "")} type="date" defaultValue={task.date_debut ?? ""}
                                  onBlur={(e) => { if (e.target.value !== (task.date_debut ?? "")) void saveTaskField(task, { date_debut: e.target.value || null }); }}
                                  className="mt-1 block rounded-lg border bg-white px-2 py-2 text-sm"/>
                              </label>
                              <label className="text-xs text-slate-500">Fin
                                <input key={task.id + "-end-" + (task.date_fin ?? "")} type="date" defaultValue={task.date_fin ?? ""}
                                  onBlur={(e) => { if (e.target.value !== (task.date_fin ?? "")) void saveTaskField(task, { date_fin: e.target.value || null }); }}
                                  className="mt-1 block rounded-lg border bg-white px-2 py-2 text-sm"/>
                              </label>
                              <span className="self-end pb-2 text-xs text-slate-500">Affectations et dates partagées avec la tâche chantier</span>
                            </div>
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <div className="text-xs font-semibold text-slate-700">Besoins théoriques du modèle</div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-lg border bg-white p-2">
                                <div className="mb-1 font-semibold">Matériaux / consommables</div>
                                {estimate?.materials.map((material) => <div key={material.id} className="text-xs">
                                  {material.material_name} : {material.estimated_quantity} {material.ratio_unit}
                                </div>)}
                                {!estimate?.materials.length && <span className="text-xs text-slate-500">Aucun ratio renseigné</span>}
                              </div>
                              <div className="rounded-lg border bg-white p-2">
                                <div className="mb-1 font-semibold">Matériel à mobiliser</div>
                                {estimate?.equipment.filter((equipment) => equipment.is_required).map((equipment) => <div key={equipment.id} className="text-xs">
                                  {equipment.equipment_name} {equipment.default_quantity ? `× ${equipment.default_quantity}` : ""}
                                </div>)}
                                {!estimate?.equipment.some((equipment) => equipment.is_required) && <span className="text-xs text-slate-500">Aucun matériel défini</span>}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <div className="font-semibold text-slate-700">Approvisionnements de cette tâche</div>
                            {taskRequests.length ? taskRequests.map((request) =>
                              <div key={request.id} className="text-xs text-slate-600">{request.titre} · {request.statut_commande === "a_commander" ? "À commander" : request.statut_commande === "commande" ? "Commandé" : "Livré"}</div>)
                              : <p className="text-xs text-slate-500">Aucune commande liée : besoins théoriques seulement.</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-white p-3">
                              <div className="font-semibold">Main-d'œuvre prévue / pointée</div>
                              <p className="mt-1">{timePlanned ?? "—"} h / {actualHours.toLocaleString("fr-FR")} h</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {executedQuantity > 0
                                  ? `Ratio terrain : ${(actualHours / executedQuantity).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} h / ${task.unite ?? "unité"} réalisée`
                                  : "Saisissez la quantité exécutée pour obtenir le ratio réel."}
                              </p>
                            </div>
                            <div className="rounded-lg bg-white p-3">
                              <div className="font-semibold">Matériaux et consommables utilisés</div>
                              {trackedRatios.map((ratio) => {
                                const used = materialRows.filter((row) => row.material_ratio_id === ratio.id)
                                  .reduce((sum, row) => sum + row.quantite_consommee, 0);
                                const planned = estimate?.materials.find((row) => row.id === ratio.id)?.estimated_quantity;
                                return <p key={ratio.id} className="mt-1 text-xs text-slate-600">
                                  {ratio.material_name} : {used.toLocaleString("fr-FR")} / {planned ?? "—"} {ratio.ratio_unit} (réel / prévu)
                                  {executedQuantity > 0 && <span> · {(used / executedQuantity).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} par unité réalisée</span>}
                                </p>;
                              })}
                              {!trackedRatios.length && <p className="mt-1 text-xs text-slate-500">Aucune ressource à consommation renseignée dans le modèle.</p>}
                              <p className="mt-2 text-xs text-slate-500">Les achats et les commandes ne sont pas comptés comme consommations.</p>
                            </div>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <div className="font-semibold">Coûts réellement mesurés (hors amortissement non imputé)</div>
                            <div className="mt-1 text-xs text-slate-600">
                              Main-d'œuvre : {laborActualHt === null ? "Tarifs de certains pointages inconnus" : eur(laborActualHt)} ·
                              Matières consommées : {materialActualHt === null ? "Prix d'achat incomplets" : eur(materialActualHt)}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Les dépenses non pointées, les frais indirects et le matériel non imputé ne sont pas inclus : ceci n'est pas encore un coût réel complet.
                            </p>
                          </div>
                          <form onSubmit={(event) => { event.preventDefault(); void saveRealTime(task); }}
                            className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                            <div className="font-semibold">Ajouter un pointage et la quantité réalisée</div>
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="text-xs text-slate-600">Intervenant
                                <select required value={draft.intervenantId} onChange={(event) => patchDraft(task.id, { intervenantId: event.target.value })}
                                  className="mt-1 block rounded-lg border px-2 py-2 text-sm">
                                  <option value="">Choisir</option>
                                  {intervenants.filter((person) => assigned.includes(person.id)).map((person) =>
                                    <option key={person.id} value={person.id}>{person.nom}</option>)}
                                </select>
                              </label>
                              <label className="text-xs text-slate-600">Date
                                <input type="date" required value={draft.workDate} onChange={(event) => patchDraft(task.id, { workDate: event.target.value })}
                                  className="mt-1 block rounded-lg border px-2 py-2 text-sm"/>
                              </label>
                              <label className="text-xs text-slate-600">Heures
                                <input required inputMode="decimal" value={draft.hours} onChange={(event) => patchDraft(task.id, { hours: event.target.value })}
                                  className="mt-1 block w-20 rounded-lg border px-2 py-2 text-sm" placeholder="7,5"/>
                              </label>
                              <label className="text-xs text-slate-600">Quantité réalisée
                                <input inputMode="decimal" value={draft.doneQuantity} onChange={(event) => patchDraft(task.id, { doneQuantity: event.target.value })}
                                  className="mt-1 block w-24 rounded-lg border px-2 py-2 text-sm" placeholder={task.unite ?? "u"}/>
                              </label>
                              <button type="submit" disabled={workingId !== null}
                                className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">Enregistrer</button>
                            </div>
                          </form>
                          {trackedRatios.length > 0 && (
                            <form onSubmit={(event) => { event.preventDefault(); void saveActualMaterial(task, trackedRatios.map((ratio) => ratio.id)); }}
                              className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                              <div className="font-semibold">Enregistrer une consommation réelle</div>
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="text-xs text-slate-600">Matériau
                                  <select required value={draft.materialId} onChange={(event) => patchDraft(task.id, { materialId: event.target.value })}
                                    className="mt-1 block rounded-lg border px-2 py-2 text-sm">
                                    <option value="">Choisir</option>
                                    {trackedRatios.map((ratio) => <option key={ratio.id} value={ratio.id}>{ratio.material_name} ({ratio.ratio_unit})</option>)}
                                  </select>
                                </label>
                                <label className="text-xs text-slate-600">Quantité consommée
                                  <input required inputMode="decimal" value={draft.materialQuantity}
                                    onChange={(event) => patchDraft(task.id, { materialQuantity: event.target.value })}
                                    className="mt-1 block w-28 rounded-lg border px-2 py-2 text-sm"/>
                                </label>
                                <button type="submit" disabled={workingId !== null || !draft.intervenantId}
                                  className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">Enregistrer</button>
                              </div>
                              <p className="text-xs text-slate-500">L'intervenant et la date sont ceux du pointage ci-dessus.</p>
                            </form>
                          )}
                          <div className="rounded-lg bg-white p-3 text-xs text-slate-600">
                            Ces résultats alimentent l'analyse de la bibliothèque. Les ratios de référence ne changent qu'après validation.
                            {task.task_template_id && <a href={`/bibliotheque?templateId=${encodeURIComponent(task.task_template_id)}`}
                              className="ml-2 font-semibold text-blue-700 hover:underline">Analyser le modèle</a>}
                          </div>
                          <button type="button" onClick={() => onTaskOpen(task.id)}
                            className="rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700">
                            Documents, remarques et suivi terrain détaillé
                          </button>
                        </div>
                      )}
                    </section>;
                  })}
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label={`Choisir une tâche technique pour ${line.designation}`} value={selection[line.id] ?? ""}
                      onChange={(event) => setSelection((before) => ({ ...before, [line.id]: event.target.value }))}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="">Choisir une tâche bibliothèque…</option>
                      {templates.map((template) => <option key={template.id} value={template.id}>{template.titre}</option>)}
                    </select>
                    <button type="button" disabled={!selection[line.id] || workingId !== null}
                      onClick={() => void createFromTemplate(line)}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      Ajouter la tâche technique
                    </button>
                  </div>
                  {unlinked.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500">Ou rattacher une tâche existante :</span>
                    {unlinked.map((task) => <button key={task.id} type="button" disabled={workingId !== null}
                      className="rounded-full border border-slate-200 px-2 py-1 hover:bg-slate-50"
                      onClick={() => void reassign(task, line.id)}>{task.titre_terrain || task.titre}</button>)}
                  </div>}
                </div>
                )}
              </article>
            );
          })}
          {unlinked.length > 0 && (
            <section className="rounded-xl border border-dashed border-slate-200">
              <button type="button" onClick={() => setShowUnlinked((old) => !old)}
                aria-expanded={showUnlinked}
                className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                <span>{unlinked.length} tâche{unlinked.length > 1 ? "s" : ""} technique{unlinked.length > 1 ? "s" : ""} sans prestation liée</span>
                <span aria-hidden="true">{showUnlinked ? "−" : "+"}</span>
              </button>
              {showUnlinked && (
                <div className="space-y-2 border-t border-slate-100 p-3">
                  {unlinked.map((task) => <button type="button" key={task.id}
                    onClick={() => onTaskOpen(task.id)}
                    className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:underline">
                    {task.titre_terrain || task.titre}
                  </button>)}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
