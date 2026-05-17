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
          <div className="mt-2 text-sm font-semibold text-slate-900">{value || "Non renseigne"}</div>
        </div>
      ))}
    </div>
  );
}

function recentActivity(project: ProjectRecord) {
  const quote = getPrimaryQuote(project);
  return [
    project.prospect ? ["Prospect cree", project.prospect.created_at] : null,
    project.opportunity ? ["Projet cree", project.opportunity.created_at] : null,
    quote ? [`Devis ${quote.quote_number}`, quote.created_at] : null,
    project.chantiers[0] ? ["Chantier cree", project.chantiers[0].created_at] : null,
    ...project.communications.slice(0, 5).map((communication) => [communication.subject || communication.type, communication.occurred_at] as [string, string]),
  ].filter(Boolean) as Array<[string, string | null | undefined]>;
}

export function ProjectSummaryTab({ project }: { project: ProjectRecord }) {
  const quote = getPrimaryQuote(project);
  const chantier = project.chantiers[0] ?? null;
  const latestActivity = recentActivity(project)[0] ?? null;
  const openFollowUps = project.tasks.filter((task) => task.statut !== "termine" && task.statut !== "terminee").length;

  return (
    <div className="space-y-5">
      <Panel title="Resume projet" description="Accueil commercial du dossier, sans melanger la preparation chantier.">
        <div className="space-y-5">
          <InfoGrid
            rows={[
              ["Client", project.clientName],
              ["Adresse", project.address],
              ["Commercial", project.salesperson || "A assigner"],
              ["Source", project.sourceLabel],
              ["Budget estimatif", formatCurrency(project.budgetEstimate)],
              ["Echeance", formatDate(project.desiredDeadline)],
              ["Type projet", project.projectType],
              ["Derniere activite", latestActivity ? `${latestActivity[0]} - ${formatDate(latestActivity[1])}` : "Aucune"],
            ]}
          />

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["RDV", project.appointments.length],
              ["Devis", project.quotes.length],
              ["Montant devis", formatCurrency(project.quoteAmount)],
              ["Documents", project.documents.length],
              ["Taches commerciales", openFollowUps],
              ["SAV", project.sav.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xl font-bold text-slate-950">{value}</div>
                <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Resume client">
          <InfoGrid
            rows={[
              ["Telephone", project.contactPhone],
              ["Email", project.contactEmail],
              ["Contact principal", project.clientName],
              ["Source lead", project.sourceLabel],
            ]}
          />
        </Panel>

        <Panel title="Situation commerciale">
          <InfoGrid
            rows={[
              ["Statut projet", project.status],
              ["Budget connu", formatCurrency(project.budgetEstimate)],
              ["Prochaine relance", formatDate(project.nextActionDate)],
              ["Commercial", project.salesperson || "A assigner"],
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Derniere activite">
          {latestActivity ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{latestActivity[0]}</div>
              <div className="mt-1 text-sm text-slate-500">{formatDate(latestActivity[1])}</div>
            </div>
          ) : (
            <EmptyProjectBlock title="Aucune activite" description="Les appels, mails, notes, visites et devis apparaissent ici." />
          )}
        </Panel>

        <Panel title="Devis recent">
          {quote ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{quote.quote_number}</div>
              <div className="mt-1 text-sm text-slate-500">{quote.statut} - {formatCurrency(quote.montant_ht)}</div>
              <Link to={`/crm/devis/${quote.id}/edit`} className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
                Ouvrir le devis
              </Link>
            </div>
          ) : (
            <EmptyProjectBlock title="Aucun devis" description="Creez un devis depuis le dossier projet." />
          )}
        </Panel>

        <Panel title="Chantier lie">
          {chantier ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{chantier.nom}</div>
              <div className="mt-1 text-sm text-slate-500">{chantier.adresse || "Adresse non renseignee"} - Avancement {chantier.avancement ?? 0}%</div>
              <Link to={`/chantiers/${chantier.id}`} className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
                Ouvrir chantier
              </Link>
            </div>
          ) : (
            <EmptyProjectBlock title="Aucun chantier lie" description="Le chantier apparait ici uniquement apres creation depuis un devis accepte." />
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ProjectVisitsTab({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="Visites de chiffrage" description="Mini pre-devis terrain lie au dossier affaire." actions={<Link to={`/projets/${project.id}/visites/nouveau`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Nouvelle visite de chiffrage</Link>}>
      <div className="space-y-5">
        {project.appointments.length ? (
          <div className="grid gap-3">
            {project.appointments.map((appointment) => (
              <div key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{appointment.titre}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {formatDate(appointment.starts_at)} - {appointment.statut} - {appointment.type}
                    </div>
                  </div>
                  <Link to={`/projets/${project.id}/visites/${appointment.id}`} className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                    Ouvrir
                  </Link>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{appointment.compte_rendu || appointment.notes || "Compte-rendu a completer."}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyProjectBlock title="Aucune visite de chiffrage" description="Creez une visite pour relever les sections, prestations, quantites, photos et notes qui alimenteront le pre-devis." />
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["Sections", "Prestations", "Metrees", "Bibliotheque", "Photos", "Documents", "Notes techniques", "Pre-devis"].map((item) => (
            <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-800">{item}</div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function ProjectQuotesTab({ project }: { project: ProjectRecord }) {
  const acceptedQuote = project.quotes.find((quote) => quote.statut === "accepte");
  return (
    <Panel title="Devis" description="Pre-devis, devis final, variantes, signatures et relances." actions={<Link to="/crm/devis" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Creer devis</Link>}>
      <div className="space-y-4">
        {acceptedQuote ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Devis accepte : l'action Creer chantier est disponible depuis le header projet.
          </div>
        ) : null}
        {project.quotes.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Numero</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Signature</th>
                  <th className="px-4 py-3">Validite</th>
                  <th className="px-4 py-3 text-right">HT</th>
                  <th className="px-4 py-3 text-right">TTC</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{quote.quote_number}</td>
                    <td className="px-4 py-3 text-slate-500">{quote.statut}</td>
                    <td className="px-4 py-3 text-slate-500">{quote.signature_status}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(quote.valid_until)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(quote.montant_ht)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(quote.montant_ttc)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/crm/devis/${quote.id}/edit`} className="font-semibold text-blue-700 hover:text-blue-800">Ouvrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyProjectBlock title="Aucun devis lie" description="Creez un pre-devis ou un devis final depuis le projet." />
        )}
      </div>
    </Panel>
  );
}

export function ProjectDocumentsTab({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="Documents" description="Centraliser les pieces commerciales et projet.">
      <div className="mb-4 flex flex-wrap gap-2">
        {["Photos", "Plans", "Documents client", "Emails", "Pieces devis", "Annexes"].map((category) => (
          <span key={category} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{category}</span>
        ))}
      </div>
      {project.documents.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {project.documents.map((document) => (
            <div key={document.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{document.nom}</div>
              <div className="mt-1 text-xs text-slate-500">{document.type} - {formatDate(document.created_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun document centralise" description="Importez ou rattachez les documents commerciaux depuis les visites et devis." />
      )}
    </Panel>
  );
}

export function ProjectActivityTab({ project }: { project: ProjectRecord }) {
  const events = recentActivity(project);
  return (
    <Panel title="Activite" description="Timeline commerciale du projet.">
      {events.length ? (
        <div className="space-y-4">
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
        <EmptyProjectBlock title="Aucune activite" description="Les appels, emails, RDV, devis et relances apparaitront ici." />
      )}
    </Panel>
  );
}

export function ProjectSavTab({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="SAV" description="Vue legere des tickets lies au projet ou au client.">
      {project.sav.length ? (
        <div className="space-y-3">
          {project.sav.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{ticket.titre}</div>
              <div className="mt-1 text-sm text-slate-500">{ticket.statut} - {ticket.urgence} - {formatDate(ticket.created_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun ticket SAV" description="Les demandes apres chantier liees au client apparaitront ici sans remplacer le module production SAV." />
      )}
    </Panel>
  );
}
