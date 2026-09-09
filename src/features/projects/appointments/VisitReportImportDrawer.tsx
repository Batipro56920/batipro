import { useMemo, useState } from "react";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { importVisitReportWithCoco, type VisitImportProposal, type VisitImportSection } from "../../../services/visitReportImport.service";

/** Champs généraux proposables, avec le libellé lisible côté écran. */
const PROJECT_FIELDS: Array<[string, string]> = [
  ["clientObjective", "Objectif client"],
  ["needDescription", "Description du besoin"],
  ["zones", "Zones concernées"],
  ["urgency", "Urgence"],
  ["desiredDeadline", "Délai souhaité"],
];

const CONSTRAINT_FIELDS: Array<[string, string]> = [
  ["access", "Accès"],
  ["parking", "Stationnement"],
  ["floor", "Étage"],
  ["condominium", "Copropriété"],
  ["schedule", "Horaires"],
  ["nuisance", "Nuisances"],
  ["safety", "Sécurité"],
  ["waste", "Évacuation gravats"],
  ["water", "Eau"],
  ["electricity", "Électricité"],
  ["authorizations", "Autorisations"],
  ["notes", "Remarques contraintes"],
];

const BUDGET_FIELDS: Array<[string, string]> = [
  ["budgetKnown", "Budget client connu"],
  ["budgetRange", "Fourchette"],
  ["priceSensitivity", "Sensibilité au prix"],
  ["decisionMaker", "Décisionnaire"],
  ["decisionOnSite", "Décision sur place"],
  ["objections", "Objections"],
];

const FOLLOWUP_FIELDS: Array<[string, string]> = [
  ["nextAction", "Prochaine action"],
  ["followUpDate", "Date de relance"],
];

export type VisitImportSelection = {
  fields: Record<string, string>;
  sections: VisitImportSection[];
};

export function VisitReportImportDrawer({
  open,
  onClose,
  buildInput,
  currentValues,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  buildInput: (transcript: string) => Parameters<typeof importVisitReportWithCoco>[0];
  currentValues: Record<string, string>;
  onApply: (selection: VisitImportSelection) => void;
}) {
  const [transcript, setTranscript] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<VisitImportProposal | null>(null);
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  const proposedFields = useMemo(() => {
    if (!proposal) return [] as Array<{ key: string; label: string; value: string }>;
    const groups: Array<[Array<[string, string]>, Record<string, string>]> = [
      [PROJECT_FIELDS, proposal.project as unknown as Record<string, string>],
      [CONSTRAINT_FIELDS, proposal.constraints],
      [BUDGET_FIELDS, proposal.budget],
      [FOLLOWUP_FIELDS, proposal.followUp as unknown as Record<string, string>],
    ];
    const rows: Array<{ key: string; label: string; value: string }> = [];
    for (const [definitions, source] of groups) {
      for (const [key, label] of definitions) {
        const value = String(source?.[key] ?? "").trim();
        if (value) rows.push({ key, label, value });
      }
    }
    return rows;
  }, [proposal]);

  if (!open) return null;

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await importVisitReportWithCoco(buildInput(transcript));
      setProposal(result);
      setSkipped({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Analyse impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function readFile(file: File | null | undefined) {
    if (!file) return;
    try {
      setTranscript(await file.text());
      setError(null);
    } catch {
      setError("Fichier illisible. Colle plutôt le texte du compte rendu.");
    }
  }

  function apply() {
    if (!proposal) return;
    const fields: Record<string, string> = {};
    for (const row of proposedFields) {
      if (!skipped[`field:${row.key}`]) fields[row.key] = row.value;
    }
    const sections = proposal.sections
      .map((section, index) => ({
        ...section,
        tasks: section.tasks.filter((_task, taskIndex) => !skipped[`task:${index}:${taskIndex}`]),
      }))
      .filter((section, index) => !skipped[`section:${index}`] && section.tasks.length > 0);
    onApply({ fields, sections });
  }

  const taskCount = proposal?.sections.reduce((total, section) => total + section.tasks.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <aside className="flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Compte rendu de rendez-vous</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Coco remplit la visite</h2>
            <p className="mt-1 text-sm text-slate-600">
              Colle le compte rendu Plaud. Ce qui concerne un ouvrage part sur l&apos;ouvrage, ce qui concerne le site part dans Contraintes.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!proposal ? (
            <>
              <textarea
                className="min-h-64 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Colle ici le compte rendu genere par Plaud..."
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  Depuis un fichier
                  <input
                    className="hidden"
                    type="file"
                    accept=".txt,.md,.markdown,.vtt,.srt,.json,text/plain"
                    onChange={(event) => {
                      void readFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-slate-500">{transcript.trim().length} caractere(s)</span>
                <button
                  type="button"
                  onClick={() => void analyze()}
                  disabled={analyzing || transcript.trim().length < 40}
                  className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {analyzing ? "Coco analyse..." : "Analyser avec Coco"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900">
                {proposal.sections.length} section(s), {taskCount} tache(s) et {proposedFields.length} champ(s) proposes.
                Decoche ce que tu ne veux pas reprendre.
                {proposal.confidence === "low" ? " Coco signale un compte rendu difficile a exploiter : relis avant d'appliquer." : ""}
              </div>

              {proposal.sections.length ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-950">Pre-devis</h3>
                  {proposal.sections.map((section, index) => (
                    <article key={`${section.title}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200">
                      <label className="flex items-center gap-2 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950">
                        <input
                          type="checkbox"
                          checked={!skipped[`section:${index}`]}
                          onChange={(event) => setSkipped((current) => ({ ...current, [`section:${index}`]: !event.target.checked }))}
                        />
                        {section.title}
                      </label>
                      <div className="divide-y divide-slate-100">
                        {section.tasks.map((task, taskIndex) => (
                          <label key={`${task.title}-${taskIndex}`} className="flex gap-2 p-3 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={!skipped[`task:${index}:${taskIndex}`]}
                              onChange={(event) => setSkipped((current) => ({ ...current, [`task:${index}:${taskIndex}`]: !event.target.checked }))}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-950">{task.title}</div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {task.unit}
                                {task.quantity !== null ? ` · ${task.quantity}` : ""}
                                {task.length !== null ? ` · L ${task.length}` : ""}
                                {task.width !== null ? ` · l ${task.width}` : ""}
                                {task.height !== null ? ` · H ${task.height}` : ""}
                                {task.estimatedHours !== null ? ` · ${task.estimatedHours} h` : ""}
                                {task.taskTemplateLabel ? ` · tache liee : ${task.taskTemplateLabel}` : ""}
                              </div>
                              {task.technicalNotes ? <div className="mt-1 text-xs text-slate-600">{task.technicalNotes}</div> : null}
                              {task.constraints ? (
                                <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
                                  Contrainte de cette tache : {task.constraints}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    </article>
                  ))}
                </section>
              ) : null}

              {proposedFields.length ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-950">Champs de la fiche</h3>
                  {proposedFields.map((row) => {
                    const existing = String(currentValues[row.key] ?? "").trim();
                    return (
                      <label key={row.key} className="flex gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={!skipped[`field:${row.key}`]}
                          onChange={(event) => setSkipped((current) => ({ ...current, [`field:${row.key}`]: !event.target.checked }))}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-950">{row.label}</div>
                          <div className="mt-0.5 whitespace-pre-wrap text-slate-700">{row.value}</div>
                          {existing && existing !== row.value ? (
                            <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">Remplace : {existing}</div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </section>
              ) : null}

              {proposal.unassigned.length ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-950">Coco n&apos;a pas su ou placer ceci</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {proposal.unassigned.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </section>
              ) : null}
            </>
          )}

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
        </div>

        {proposal ? (
          <footer className="flex flex-wrap gap-2 border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reprendre le texte
            </button>
            <button
              type="button"
              onClick={apply}
              className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Appliquer a la visite
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
