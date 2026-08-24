import { X } from "lucide-react";
import type { CrmProspectRow } from "../../../../services/crm.service";
import { CrmWorkflowSteps } from "../../components/CrmWorkflowSteps";
import { buildCrmWorkflowSteps, type CrmWorkflowStepKey } from "../../components/crmWorkflowModel";
import { dateOnly, entityLabel, eur } from "../../components/crmFormat";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import type { ProspectActionHandlers } from "../types";

function workflowForProspect(prospect: CrmProspectRow) {
  const done: CrmWorkflowStepKey[] = ["prospect"];
  const qualified = ["qualifie", "devis_en_cours", "negociation", "gagne"].includes(prospect.statut);
  const quoteStarted = ["devis_en_cours", "negociation", "gagne"].includes(prospect.statut);
  const quoteSent = ["negociation", "gagne"].includes(prospect.statut);
  const won = prospect.statut === "gagne";

  if (qualified) done.push("opportunity");
  if (quoteStarted) done.push("visit", "prequote");
  if (quoteSent) done.push("quote");
  if (won) done.push("chantier");

  const current: CrmWorkflowStepKey = !qualified ? "opportunity" : !quoteStarted ? "visit" : !quoteSent ? "quote" : !won ? "chantier" : "invoice";
  return buildCrmWorkflowSteps(current, done);
}

function nextAction(prospect: CrmProspectRow) {
  if (prospect.statut === "nouveau" || prospect.statut === "a_qualifier") return "Qualifier le besoin et planifier la visite terrain.";
  if (prospect.statut === "qualifie") return "Realiser la visite terrain puis preparer le pre-devis.";
  if (prospect.statut === "devis_en_cours") return "Finaliser le devis et l'envoyer au client.";
  if (prospect.statut === "negociation") return "Relancer le client et traiter les objections.";
  if (prospect.statut === "gagne") return "Preparer le chantier et la facturation.";
  if (prospect.statut === "perdu") return "Archiver ou noter la raison de perte.";
  return "Continuer le suivi commercial.";
}

export function ProspectQuickDrawer({
  prospect,
  onClose,
  actions,
}: {
  prospect: CrmProspectRow | null;
  onClose: () => void;
  actions: ProspectActionHandlers;
}) {
  if (!prospect) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-subtle bg-surface shadow-elevated">
        <div className="sticky top-0 z-10 border-b border-subtle bg-surface/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="bt-caption text-primary-on">Fiche rapide</div>
              <h3 className="bt-card-title mt-1 text-ink">{entityLabel(prospect)}</h3>
              <div className="mt-2">
                <ProspectStatusBadge status={prospect.statut} />
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-field p-2 text-muted hover:bg-interactive" aria-label="Fermer">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <CrmWorkflowSteps steps={workflowForProspect(prospect)} />

          <section className="rounded-card border border-primary/20 bg-primary-soft p-4">
            <div className="bt-caption text-primary-on">Prochaine action</div>
            <p className="mt-2 text-sm font-medium leading-6 text-primary-on">{nextAction(prospect)}</p>
          </section>

          <section className="rounded-card border border-subtle bg-surface p-4">
            <h4 className="text-sm font-semibold text-ink">Coordonnées</h4>
            <div className="mt-3 grid gap-2 text-sm text-ink-secondary">
              <div>Email : {prospect.email ?? "—"}</div>
              <div>Téléphone : {prospect.mobile ?? prospect.telephone ?? "—"}</div>
              <div>Adresse : {[prospect.adresse, prospect.code_postal, prospect.ville].filter(Boolean).join(" ") || "—"}</div>
              <div>Source : {prospect.source_acquisition ?? "—"}</div>
            </div>
          </section>

          <section className="rounded-card border border-subtle bg-surface p-4">
            <h4 className="text-sm font-semibold text-ink">Projet</h4>
            <div className="mt-3 grid gap-2 text-sm text-ink-secondary">
              <div>Type : {prospect.type_projet ?? "—"}</div>
              <div>Budget : {prospect.budget_estime ? eur(prospect.budget_estime) : "—"}</div>
              <div>Urgence : {prospect.urgence ?? "—"}</div>
              <p className="leading-6">{prospect.description_besoin ?? prospect.notes ?? "Aucune note projet renseignée."}</p>
            </div>
          </section>

          <section className="rounded-card border border-subtle bg-surface p-4">
            <h4 className="text-sm font-semibold text-ink">Historique</h4>
            <div className="mt-3 text-sm text-ink-secondary">Créé le {dateOnly(prospect.created_at)} · Mis à jour le {dateOnly(prospect.updated_at)}</div>
            <div className="mt-3 rounded-field border border-dashed border-subtle bg-interactive p-3 text-sm text-muted">Les visites, devis et chantiers reliés seront affichés ici dans la fiche complète.</div>
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => actions.onTask(prospect)} className="bt-control rounded-field border border-subtle px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Créer tâche</button>
            <button type="button" onClick={() => actions.onCreateOpportunity(prospect)} className="bt-control rounded-field border border-subtle px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Créer affaire</button>
            <button type="button" onClick={() => actions.onCreateAppointment(prospect)} className="bt-control rounded-field border border-subtle px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Prise de RDV</button>
            <button type="button" onClick={() => actions.onCreateQuote(prospect)} className="bt-control rounded-field border border-subtle px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Créer devis</button>
            <button type="button" onClick={() => actions.onConvert(prospect)} className="bt-control rounded-field border border-success/20 bg-success-soft px-3 py-2 text-sm font-semibold text-success-on hover:bg-interactive">Convertir client</button>
            <button type="button" disabled className="bt-control rounded-field border border-subtle px-3 py-2 text-sm font-semibold text-muted" title="Modification dédiée à finaliser">Modifier</button>
            <button type="button" onClick={() => actions.onStatus(prospect, "archive")} className="bt-control rounded-field border border-danger/20 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-on hover:bg-interactive">Archiver</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
