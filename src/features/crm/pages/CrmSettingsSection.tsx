import type { CrmDataset } from "../../../services/crm.service";

export default function CrmSettingsSection({ stages }: { stages: CrmDataset["stages"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Étapes pipeline</div>
        <div className="mt-4 space-y-2">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between rounded-2xl border bg-slate-50 p-3">
              <span>{stage.ordre}. {stage.label}</span>
              <span className="text-xs text-slate-500">{stage.probability_default}%</span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Paramètres prévus</div>
        <div className="mt-3 grid gap-2 text-sm text-slate-600">
          {["Sources prospects", "Types projets", "Tags", "Modèles email", "Modèles devis", "Priorités", "Statuts"].map((item) => (
            <div key={item} className="rounded-2xl border bg-slate-50 p-3">{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
