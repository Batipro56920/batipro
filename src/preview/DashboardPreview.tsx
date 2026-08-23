/**
 * Rendu du Dashboard avec des donnees fictives, hors authentification.
 * Sert a valider Light / Dark / mobile sans base de donnees.
 * Entree servie par `vite dev` uniquement (`/preview.html`).
 */
import { useState } from "react";
import { DashboardBusinessPanel } from "../features/dashboard/components/DashboardBusinessPanel";
import { DashboardChantiersPanel } from "../features/dashboard/components/DashboardChantiersPanel";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { DashboardPriorityFeed } from "../features/dashboard/components/DashboardPriorityFeed";
import { DashboardVerdict } from "../features/dashboard/components/DashboardVerdict";
import { useDashboardMetrics } from "../features/dashboard/hooks/useDashboardMetrics";
import type { DashboardQueueFilter } from "../features/dashboard/types";
import type { DashboardAlertRow } from "../services/dashboardAlerts.service";


const LABELS: Record<string, string> = {
  "dashboard.materialRequest": "Demande matériel",
  "sidebar.chantiers": "Chantiers",
  "dashboard.missingClient": "Client non renseigné",
  "dashboard.finishNotPlanned": "Fin non planifiée",
  "common.materielStatus.validee": "Validée",
  "common.materielStatus.refusee": "Refusée",
  "common.materielStatus.livree": "Livrée",
  "common.materielStatus.en_attente": "En attente",
};

function t(key: string, values?: Record<string, string | number>): string {
  if (key === "dashboard.finishPlanned") return `Fin prévue ${values?.date ?? ""}`;
  return LABELS[key] ?? key;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function dateInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const chantiers = [
  { id: "c1", nom: "Réhabilitation Villa Kermarrec", client: "SCI Kermarrec", status: "en_cours", avancement: 62, heures_prevues: 480, heures_passees: 512, date_fin_prevue: dateInDays(-6), created_at: isoDaysAgo(120) },
  { id: "c2", nom: "Extension ossature bois — Plouhinec", client: "M. et Mme Le Guen", status: "en_cours", avancement: 28, heures_prevues: 310, heures_passees: 96, date_fin_prevue: dateInDays(9), created_at: isoDaysAgo(60) },
  { id: "c3", nom: "Rénovation énergétique 12 logements", client: "Bretagne Habitat", status: "en_cours", avancement: 74, heures_prevues: 1200, heures_passees: 890, date_fin_prevue: dateInDays(41), created_at: isoDaysAgo(200) },
  { id: "c4", nom: "Aménagement combles — Quéven", client: "Mme Tanguy", status: "preparation", avancement: 5, heures_prevues: 120, heures_passees: 0, date_fin_prevue: dateInDays(25), created_at: isoDaysAgo(14) },
  { id: "c5", nom: "Local commercial Rue Jules Legrand", client: "SARL Morvan", status: "en_pause", avancement: 40, heures_prevues: 260, heures_passees: 130, date_fin_prevue: dateInDays(75), created_at: isoDaysAgo(90) },
  { id: "c6", nom: "Maison individuelle — Ploemeur", client: "M. Riou", status: "en_cours", avancement: 91, heures_prevues: 640, heures_passees: 600, date_fin_prevue: dateInDays(12), created_at: isoDaysAgo(240) },
] as any[];

const alerts: DashboardAlertRow[] = [
  { id: "task-reprise:1", chantier_id: "c1", chantier_nom: "Réhabilitation Villa Kermarrec", category: "task", kind: "task_reprise", tone: "danger", title: "Tâche à reprendre", detail: "Pose cloisons R+1 - planéité hors tolérance", href: "#", sort_at: isoDaysAgo(11) },
  { id: "reserve:1", chantier_id: "c1", chantier_nom: "Réhabilitation Villa Kermarrec", category: "reserve", kind: "reserve_urgente", tone: "danger", title: "Réserve urgente", detail: "Infiltration en toiture côté nord", href: "#", sort_at: isoDaysAgo(4) },
  { id: "purchase:1", chantier_id: "c2", chantier_nom: "Extension ossature bois — Plouhinec", category: "purchase", kind: "achat_retard", tone: "danger", title: "Approvisionnement en retard", detail: "Charpente lamellé-collé - livraison prévue " + dateInDays(-3), href: "#", sort_at: isoDaysAgo(19) },
  { id: "task-late:1", chantier_id: "c3", chantier_nom: "Rénovation énergétique 12 logements", category: "task", kind: "task_retard", tone: "warning", title: "Tâche en retard", detail: "Calorifugeage réseaux - échéance " + dateInDays(-2), href: "#", sort_at: isoDaysAgo(6) },
  { id: "reserve:2", chantier_id: "c3", chantier_nom: "Rénovation énergétique 12 logements", category: "reserve", kind: "reserve_ouverte", tone: "warning", title: "Réserve ouverte", detail: "Finitions peinture cage d'escalier B", href: "#", sort_at: isoDaysAgo(23) },
  { id: "preparation:c4", chantier_id: "c4", chantier_nom: "Aménagement combles — Quéven", category: "preparation", kind: "preparation_incomplete", tone: "warning", title: "Préparation incomplète", detail: "Checklist préparation chantier à finaliser", href: "#", sort_at: isoDaysAgo(2) },
  { id: "purchase:2", chantier_id: "c6", chantier_nom: "Maison individuelle — Ploemeur", category: "purchase", kind: "achat_a_commander", tone: "warning", title: "Approvisionnement à commander", detail: "Menuiseries extérieures alu", href: "#", sort_at: isoDaysAgo(1) },
  { id: "purchase:3", chantier_id: "c3", chantier_nom: "Rénovation énergétique 12 logements", category: "purchase", kind: "achat_non_livre", tone: "warning", title: "Approvisionnement non livré", detail: "Isolant biosourcé - livraison prévue " + dateInDays(5), href: "#", sort_at: isoDaysAgo(3) },
];

const materiel = [
  { id: "m1", chantier_id: "c1", titre: "Échafaudage roulant 6 m", designation: null, statut: "en_attente", status: null, quantite: 2, unite: "u", created_at: isoDaysAgo(8) },
  { id: "m2", chantier_id: "c3", titre: "Plaques de plâtre BA13", designation: null, statut: "validee", status: null, quantite: 120, unite: "m²", created_at: isoDaysAgo(2) },
] as any[];

export function DashboardPreview() {
  const [filter, setFilter] = useState<DashboardQueueFilter>("all");
  const metrics = useDashboardMetrics({ chantiers, materiel, alerts, filter, locale: "fr-FR", t });

  return (
    <div className="min-h-screen bg-app">
      <div className="flex">
        <aside className="hidden w-[248px] shrink-0 bg-sidebar p-4 text-white lg:block">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-sm font-black text-sidebar">B</div>
            <div>
              <div className="text-sm font-bold">Batipro</div>
              <div className="text-[11px] text-blue-100/70">ERP chantier</div>
            </div>
          </div>
          <nav className="mt-6 space-y-1">
            {["Dashboard", "Chantiers", "Projets", "CRM", "Factures", "Intervenants"].map((label, index) => (
              <div
                key={label}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium ${index === 0 ? "bg-white text-sidebar" : "text-blue-50/75"}`}
              >
                {label}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex h-14 items-center border-b border-subtle bg-surface/95 px-4 text-sm text-muted">
            Batipro · Aperçu design system
          </header>
          <div className="bg-app p-4 md:p-6">
            <div className="mx-auto w-full max-w-[1440px] space-y-5 lg:space-y-6">
              <DashboardHeader userName="Corentin" locale="fr-FR" />
              <DashboardVerdict verdict={metrics.verdict} segments={metrics.severitySegments} />
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
                <DashboardPriorityFeed
                  items={metrics.filteredQueue}
                  chips={metrics.filterChips}
                  activeFilter={filter}
                  onSelectFilter={setFilter}
                  totalCount={metrics.queue.length}
                />
                <DashboardBusinessPanel metrics={metrics.businessMetrics} defaultOpen />
              </div>
              <DashboardChantiersPanel chantiers={metrics.chantierCards} portfolio={metrics.portfolio} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
