import { useEffect, useMemo, useState } from "react";
import { createTask, updateTask, type ChantierTaskRow } from "../../../services/chantierTasks.service";
import { listDevisLignes, type DevisLigneRow, type DevisRow } from "../../../services/devis.service";
import { getCompanyHourlyRates, type CompanyHourlyRates } from "../../../services/indirectCosts.service";
import { list as listTaskTemplates, type TaskTemplateRow } from "../../../services/taskLibrary.service";
import {
  listTaskTemplatePreparationByTemplateIds,
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
};

const eur = (value: number | null) => value === null ? "Non calculé" :
  value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function DesignationsPreparationPanel({ chantierId, devis, tasks, onRefresh, onTaskOpen }: Props) {
  const [lines, setLines] = useState<DevisLigneRow[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateRow[]>([]);
  const [preparation, setPreparation] = useState<TaskTemplatePreparationCollection | null>(null);
  const [rates, setRates] = useState<CompanyHourlyRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

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

  async function createFromTemplate(line: DevisLigneRow) {
    const template = templateMap.get(selection[line.id] ?? "");
    if (!template) return;
    setWorkingId(line.id);
    setError(null);
    try {
      const taskQuantity = template.unite && line.unite &&
        template.unite.trim().toLowerCase().replace("²", "2") === line.unite.trim().toLowerCase().replace("²", "2")
        ? line.quantite ?? 1 : template.quantite_defaut ?? 1;
      const created = await createTask({
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
      onTaskOpen(created.id);
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
        <h2 className="text-lg font-semibold text-slate-950">Désignations vendues</h2>
        <p className="mt-1 text-sm text-slate-500">
          Une désignation est une ligne de devis. Associez une ou plusieurs tâches techniques
          de la bibliothèque pour calculer les besoins et le coût de revient. Aucun coût importé n'est utilisé.
        </p>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Chargement des désignations et des coûts...</p> : (
        <div className="space-y-4">
          {lines.length === 0 && <p className="text-sm text-slate-500">Aucune désignation importée. Importez un devis pour commencer.</p>}
          {lines.map((line) => {
            const linked = tasks.filter((task) => task.devis_ligne_id === line.id);
            const summary = computeDesignationCost(line, tasks, taskCosts);
            return (
              <article key={line.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-500">Désignation · {line.corps_etat ?? "Sans lot"}</div>
                    <h3 className="mt-1 font-semibold text-slate-950">{line.designation}</h3>
                    <p className="mt-1 text-xs text-slate-500">{line.quantite ?? "—"} {line.unite ?? ""} · Prix de vente : {eur(summary.saleHt)}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p><span className="text-slate-500">Coût technique : </span><strong>{eur(summary.costHt)}</strong></p>
                    <p><span className="text-slate-500">Marge : </span><strong>{eur(summary.marginHt)}</strong></p>
                    {!summary.complete && <p className="mt-1 text-xs text-amber-700">{summary.linkedTasks === 0 ? "Aucune tâche technique associée" : "Chiffrage incomplet"}</p>}
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {linked.map((task) => {
                    const cost = taskCosts.get(task.id);
                    return <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                      <div>
                        <button type="button" onClick={() => onTaskOpen(task.id)} className="font-semibold text-blue-700 hover:underline">{task.titre_terrain || task.titre}</button>
                        <p className="mt-1 text-xs text-slate-500">
                          {task.quantite ?? "—"} {task.unite ?? ""} · {cost?.status === "calculated" ?
                            `Main-d'œuvre ${eur(cost.laborHt)} · Matériaux/frais ${eur(cost.materialsHt)} · Consommables ${eur(cost.consumablesHt)} · Matériel ${eur(cost.equipmentHt)}` :
                            cost?.reason ?? "Calcul non disponible"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <strong>{eur(cost?.totalHt ?? null)}</strong>
                        <button type="button" disabled={workingId !== null} onClick={() => void reassign(task, null)}
                          className="text-xs text-slate-500 hover:underline">Détacher</button>
                      </div>
                    </div>;
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
