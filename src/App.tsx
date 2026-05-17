// src/App.tsx
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LayoutShell from "./components/LayoutShell";
import LazyRouteErrorBoundary from "./components/LazyRouteErrorBoundary";
import RequireAuth from "./components/RequireAuth";
import RequireCompanyFeature from "./components/RequireCompanyFeature";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import CrmPage from "./pages/CrmPage";
import ChantierNewPage from "./pages/ChantierNewPage";
import ChantierPage from "./pages/ChantierPage";
import ChantierVisitesPage from "./pages/ChantierVisitesPage";
import IntervenantAccessPage from "./pages/IntervenantAccessPage";
import IntervenantInvitationPage from "./pages/IntervenantInvitationPage";
import IntervenantPortalPage from "./pages/IntervenantPortalPage";
import IntervenantDetailPage from "./pages/IntervenantDetailPage";
import IntervenantsPage from "./pages/IntervenantsPage";
import BibliothequeTasksPage from "./pages/BibliothequeTasksPage";
import StatistiquesPage from "./pages/StatistiquesPage";
import MonEntreprisePage from "./pages/MonEntreprisePage";
import FournisseursPage from "./pages/FournisseursPage";
import TerrainFeedbacksPage from "./pages/TerrainFeedbacksPage";
import AppEntryPage from "./pages/AppEntryPage";

const CrmQuoteWorkspacePage = lazy(() => import("./pages/CrmQuoteWorkspacePage"));
const ChantiersPage = lazy(() => import("./pages/ChantiersPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const ProjectAppointmentPage = lazy(() => import("./pages/ProjectAppointmentPage"));
const ProjectQuoteBuilderV1Page = lazy(() => import("./pages/ProjectQuoteBuilderV1Page"));

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<AppEntryPage />} />
      <Route path="/login" element={<AuthPage />} />

      {/* Public - portail intervenant */}
      <Route path="/acces/:token" element={<IntervenantAccessPage />} />
      <Route path="/intervenant/invitation" element={<IntervenantInvitationPage />} />
      <Route path="/intervenant" element={<IntervenantPortalPage />} />

      {/* Protégé */}
      <Route
        element={
          <RequireAuth>
            <LayoutShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/crm"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="dashboard" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/prospects"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="prospects" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/clients"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="clients" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/opportunites"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="opportunities" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/devis"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="quotes" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/devis/:id/edit"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du workspace devis...</div>}>
                  <CrmQuoteWorkspacePage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/factures"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="invoices" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/achats"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="purchases" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/contacts"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="contacts" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/ressources"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="resources" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/bibliotheque"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="library" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/agenda"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="agenda" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/sav"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="sav" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/statistiques"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="stats" />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/crm/parametres"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <CrmPage section="settings" />
            </RequireCompanyFeature>
          }
        />

        <Route
          path="/projets"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement des projets...</div>}>
                  <ProjectsPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/projets/:id"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du projet...</div>}>
                  <ProjectDetailPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/projets/:id/rdv/nouveau"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du RDV projet...</div>}>
                  <ProjectAppointmentPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/projets/:id/visites/nouveau"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement de la visite de chiffrage...</div>}>
                  <ProjectAppointmentPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/projets/:id/rdv/:rdvId"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du RDV projet...</div>}>
                  <ProjectAppointmentPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/projets/:projectId/devis/nouveau"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du Quote Builder...</div>}>
                  <ProjectQuoteBuilderV1Page />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/projets/:projectId/devis/:quoteId/edit"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement de l'editeur devis...</div>}>
                  <ProjectQuoteBuilderV1Page />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/projets/:id/visites/:visitId"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement de la visite de chiffrage...</div>}>
                  <ProjectAppointmentPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />

        <Route
          path="/chantiers"
          element={
            <LazyRouteErrorBoundary>
              <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement des chantiers...</div>}>
                <ChantiersPage />
              </Suspense>
            </LazyRouteErrorBoundary>
          }
        />
        <Route path="/chantiers/nouveau" element={<ChantierNewPage />} />
        <Route path="/chantiers/:id" element={<ChantierPage />} />
        <Route path="/chantiers/:id/preparation" element={<ChantierPage />} />
        <Route path="/chantiers/:id/execution" element={<ChantierPage />} />
        <Route path="/chantiers/:id/financier" element={<ChantierPage />} />
        <Route path="/chantiers/:id/qualite" element={<ChantierPage />} />
        <Route path="/chantiers/:id/documents" element={<ChantierPage />} />
        <Route path="/chantiers/:id/equipe" element={<ChantierPage />} />
        <Route path="/chantiers/:id/sav" element={<ChantierPage />} />
        <Route path="/chantiers/:id/historique" element={<ChantierPage />} />
        <Route path="/chantiers/:id/production" element={<Navigate to="../execution" replace />} />
        <Route path="/chantiers/:id/qualite-cloture" element={<Navigate to="../qualite" replace />} />
        <Route path="/chantiers/:id/qualite-sav" element={<Navigate to="../qualite" replace />} />
        <Route path="/chantiers/:id/crm" element={<Navigate to=".." replace />} />
        <Route
          path="/chantiers/:id/visites"
          element={
            <RequireCompanyFeature moduleId="validation_qualite">
              <ChantierVisitesPage />
            </RequireCompanyFeature>
          }
        />

        <Route
          path="/intervenants"
          element={
            <RequireCompanyFeature profilePermissionKey="intervenants">
              <IntervenantsPage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/intervenants/:id"
          element={
            <RequireCompanyFeature profilePermissionKey="intervenants">
              <IntervenantDetailPage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/retours-terrain"
          element={
            <RequireCompanyFeature moduleId="journal_chantier">
              <TerrainFeedbacksPage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/bibliotheque"
          element={
            <RequireCompanyFeature moduleId="documents" profilePermissionKey="bibliotheque">
              <BibliothequeTasksPage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/statistiques"
          element={
            <RequireCompanyFeature moduleId="rapports" profilePermissionKey="statistiques">
              <StatistiquesPage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/entreprise"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <MonEntreprisePage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/entreprise/fonctionnalites"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <MonEntreprisePage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/entreprise/profils"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <MonEntreprisePage />
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/fournisseurs"
          element={
            <RequireCompanyFeature moduleId="approvisionnement" profilePermissionKey="fournisseurs">
              <FournisseursPage />
            </RequireCompanyFeature>
          }
        />
        <Route path="/entreprise/fournisseurs" element={<Navigate to="/fournisseurs" replace />} />
      </Route>

      <Route path="*" element={<AppEntryPage />} />
    </Routes>
  );
}

