import { Link } from "react-router-dom";
import type { ProjectRecord } from "../types";
import { EmptyProjectBlock, Panel, formatCurrency, formatDate } from "./ProjectShared";
import { getPrimaryQuote } from "../hooks/useProjectsData";

function InfoGrid({ rows }: { rows: Array<[string, string | number | null | undefined]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{value || "Non renseigné"}</div>
        </div>
      ))}
    </div>
  );
}

export function ProjectOverviewSection({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="Vue d’ensemble" description="Résumé opérationnel du dossier affaire.">
      <div className="space-y-5">
        <InfoGrid
          rows={[
            ["Client", project.clientName],
            ["Téléphone", project.contactPhone],
            ["Email", project.contactEmail],
            ["Adresse", project.address],
            ["Type projet", project.projectType],
            ["Source", project.sourceLabel],
            ["Budget estimé", formatCurrency(project.budgetEstimate)],
            ["Prochaine action", project.nextAction],
          ]}
        />
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["RDV", project.appointments.length],
            ["Devis", project.quotes.length],
            ["Documents", project.documents.length],
            ["Tâches", project.tasks.length],
            ["SAV", project.sav.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 p-4">
              <div className="text-2xl font-bold text-slate-950">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        {project.needDescription ? <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{project.needDescription}</p> : null}
      </div>
    </Panel>
  );
}

export function ProjectVisitsSection({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="RDV / Visites" description="Compte-rendu structuré de qualification technique." actions={<Link to="/crm/agenda" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Planifier RDV</Link>}>
      {project.appointments.length ? (
        <div className="space-y-3">
          {project.appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-950">{appointment.titre}</div>
                <div className="text-xs text-slate-500">{formatDate(appointment.starts_at)}</div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{appointment.compte_rendu || appointment.notes || "Compte-rendu à compléter."}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucune visite planifiée" description="Le projet peut encore être qualifié depuis l’agenda commercial existant." />
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {["Qualification projet", "Contraintes techniques", "Actions post-RDV"].map((title) => (
          <div key={title} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">{title}</div>
            <p className="mt-1">Structure prête pour le formulaire métier visite.</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ProjectQuotesSection({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="Devis" description="Pré-devis, devis final, variantes et signatures." actions={<Link to="/crm/devis" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Créer devis</Link>}>
      {project.quotes.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <tbody className="divide-y divide-slate-100">
              {project.quotes.map((quote) => (
                <tr key={quote.id}>
                  <td className="px-4 py-3 font-semibold text-slate-950">{quote.quote_number}</td>
                  <td className="px-4 py-3 text-slate-500">{quote.statut}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(quote.montant_ht)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/crm/devis/${quote.id}/edit`} className="font-semibold text-blue-700 hover:text-blue-800">Ouvrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun devis lié" description="Le devis doit désormais être créé depuis le projet pour éviter la double saisie." />
      )}
    </Panel>
  );
}

export function ProjectDocumentsSection({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="Documents" description="Photos, plans, pièces client, emails, notes, devis et annexes.">
      {project.documents.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {project.documents.map((document) => (
            <div key={document.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{document.nom}</div>
              <div className="mt-1 text-xs text-slate-500">{document.type}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun document centralisé" description="Les documents CRM liés au prospect, devis ou chantier apparaîtront ici." />
      )}
    </Panel>
  );
}

export function ProjectPreparationSection({ project }: { project: ProjectRecord }) {
  const visible = ["accepte", "preparation_chantier", "en_chantier", "cloture"].includes(project.status);
  return (
    <Panel title="Préparation chantier" description="Checklist lancement, structure chantier, équipe, logistique et documents.">
      {visible ? (
        <div className="grid gap-3 md:grid-cols-3">
          {["Checklist lancement", "Équipe", "Documents chantier", "Logistique", "Approvisionnement", "Validations"].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-800">{item}</div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Visible après acceptation" description="La préparation chantier s’active lorsque le devis est accepté." />
      )}
    </Panel>
  );
}

export function ProjectChantierSection({ project }: { project: ProjectRecord }) {
  const chantier = project.chantiers[0] ?? null;
  return (
    <Panel title="Chantier" description="Continuité opérationnelle après acceptation du projet.">
      {chantier ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-slate-950">{chantier.nom}</div>
            <div className="mt-1 text-sm text-slate-500">{chantier.adresse || "Adresse non renseignée"} · Avancement {chantier.avancement ?? 0}%</div>
          </div>
          <Link to={`/chantiers/${chantier.id}`} className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
            Ouvrir chantier
          </Link>
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun chantier créé" description="Le chantier sera créé automatiquement depuis le projet accepté." />
      )}
    </Panel>
  );
}

export function ProjectSavSection({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="SAV" description="Tickets liés au projet, au client ou au chantier.">
      {project.sav.length ? (
        <div className="space-y-3">
          {project.sav.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{ticket.titre}</div>
              <div className="mt-1 text-sm text-slate-500">{ticket.statut} · {ticket.urgence}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun ticket SAV" description="Les demandes après chantier apparaîtront dans ce dossier projet." />
      )}
    </Panel>
  );
}

export function ProjectTimelineSection({ project }: { project: ProjectRecord }) {
  const quote = getPrimaryQuote(project);
  const events = [
    project.prospect ? ["Prospect créé", project.prospect.created_at] : null,
    project.opportunity ? ["Projet créé", project.opportunity.created_at] : null,
    quote ? [`Devis ${quote.quote_number}`, quote.created_at] : null,
    project.chantiers[0] ? ["Chantier créé", project.chantiers[0].created_at] : null,
    ...project.communications.slice(0, 4).map((communication) => [communication.subject || communication.type, communication.occurred_at] as [string, string]),
  ].filter(Boolean) as Array<[string, string | null | undefined]>;

  return (
    <Panel title="Historique" description="Timeline complète du dossier affaire.">
      {events.length ? (
        <div className="space-y-3">
          {events.map(([label, date], index) => (
            <div key={`${label}-${index}`} className="flex gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{label}</div>
                <div className="text-xs text-slate-500">{formatDate(date)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Historique vide" description="Les actions commerciales et chantier seront centralisées ici." />
      )}
    </Panel>
  );
}
