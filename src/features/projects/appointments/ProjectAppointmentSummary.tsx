import type { ProjectAppointmentDraft } from "./ProjectAppointmentWizard";

export function buildAppointmentSummary(draft: ProjectAppointmentDraft) {
  return [
    `Objectif client : ${draft.clientGoal || "non renseigné"}`,
    `Zones concernées : ${draft.zones || "non renseignées"}`,
    `Contraintes : ${draft.constraints || "non renseignées"}`,
    `Budget : ${draft.budgetKnown ? `${draft.budgetRange || "fourchette non précisée"}` : "non connu"}`,
    `Décision sur place : ${draft.decision || "à compléter"}`,
    `Prochaines actions : ${draft.nextActions || "à définir"}`,
    `Relance prévue : ${draft.followUpDate || "non planifiée"}`,
  ].join("\n");
}

export function ProjectAppointmentSummary({ draft }: { draft: ProjectAppointmentDraft }) {
  const blockers = [
    draft.access ? null : "Accès à confirmer",
    draft.parking ? null : "Stationnement à confirmer",
    draft.budgetKnown ? null : "Budget client à valider",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-950">Résumé automatique</div>
        <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{buildAppointmentSummary(draft)}</pre>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm font-semibold text-amber-900">Points bloquants</div>
        <ul className="mt-2 space-y-1 text-sm text-amber-800">
          {blockers.length ? blockers.map((blocker) => <li key={blocker}>{blocker}</li>) : <li>Aucun point bloquant identifié.</li>}
        </ul>
      </div>
    </div>
  );
}
