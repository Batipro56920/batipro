// src/App.tsx
import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LayoutShell from "./components/LayoutShell";
import LazyRouteErrorBoundary from "./components/LazyRouteErrorBoundary";
import RequireAuth from "./components/RequireAuth";
import RequireCompanyFeature from "./components/RequireCompanyFeature";

import AuthPage from "./pages/AuthPage";
import IntervenantAccessPage from "./pages/IntervenantAccessPage";
import IntervenantInvitationPage from "./pages/IntervenantInvitationPage";
import AppEntryPage from "./pages/AppEntryPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AssistantDirectionPage = lazy(() => import("./pages/AssistantDirectionPage"));
const RentabilitePage = lazy(() => import("./pages/RentabilitePage"));
const CrmPage = lazy(() => import("./pages/CrmPage"));
const ChantiersPage = lazy(() => import("./pages/ChantiersPage"));
const ChantierNewPage = lazy(() => import("./pages/ChantierNewPage"));
const ChantierPage = lazy(() => import("./pages/ChantierPage"));
const ChantierVisitesPage = lazy(() => import("./pages/ChantierVisitesPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const ProjectAppointmentPage = lazy(() => import("./pages/ProjectAppointmentPage"));
const ProjectQuoteBuilderV1Page = lazy(() => import("./pages/ProjectQuoteBuilderV1Page"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const FinancialPage = lazy(() => import("./pages/FinancialPage"));
const FixedChargesPage = lazy(() => import("./pages/FixedChargesPage"));
const FournisseursPage = lazy(() => import("./pages/FournisseursPage"));
const SupplierOutstandingPage = lazy(() => import("./pages/SupplierOutstandingPage"));
const ProductCatalogPage = lazy(() => import("./features/product-catalog/pages/ProductCatalogPage"));
const IntervenantPortalPage = lazy(() => import("./pages/IntervenantPortalPage"));
const IntervenantDetailPage = lazy(() => import("./pages/IntervenantDetailPage"));
const IntervenantsPage = lazy(() => import("./pages/IntervenantsPage"));
const ProfileAccessPresetsPage = lazy(() => import("./pages/ProfileAccessPresetsPage"));
const BibliothequeTasksPage = lazy(() => import("./pages/BibliothequeTasksPage"));
const StatistiquesPage = lazy(() => import("./pages/StatistiquesPage"));
const MonEntreprisePage = lazy(() => import("./pages/MonEntreprisePage"));
const TerrainFeedbacksPage = lazy(() => import("./pages/TerrainFeedbacksPage"));
const ClientDocumentPage = lazy(() => import("./pages/ClientDocumentPage"));
const ApporteursAffairesPage = lazy(() => import("./pages/ApporteursAffairesPage"));
const ApporteurPortalPage = lazy(() => import("./pages/ApporteurPortalPage"));

function RouteSuspense({ label, children }: { label: string; children: ReactNode }) {
  return (
    <LazyRouteErrorBoundary>
      <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">{label}</div>}>
        {children}
      </Suspense>
    </LazyRouteErrorBoundary>
  );
}

type CrmSection =
  | "dashboard"
  | "prospects"
  | "clients"
  | "opportunities"
  | "quotes"
  | "invoices"
  | "purchases"
  | "contacts"
  | "resources"
  | "library"
  | "agenda"
  | "sav"
  | "stats"
  | "settings";

function CrmRoute({ section }: { section: CrmSection }) {
  return (
    <RequireCompanyFeature profilePermissionKey="crm">
      <RouteSuspense label="Chargement du CRM...">
        <CrmPage section={section} />
      </RouteSuspense>
    </RequireCompanyFeature>
  );
}

function ChantierBackofficeRoute({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RequireCompanyFeature moduleId="preparation_chantier" profilePermissionKey="preparation_chantier">
      <RouteSuspense label={label}>{children}</RouteSuspense>
    </RequireCompanyFeature>
  );
}

function StatistiquesRoute() {
  return (
    <RequireCompanyFeature moduleId="rapports" profilePermissionKey="statistiques">
      <RouteSuspense label="Chargement des statistiques..."><StatistiquesPage /></RouteSuspense>
    </RequireCompanyFeature>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<AppEntryPage />} />
      <Route path="/login" element={<AuthPage />} />

      {/* Public - portail intervenant */}
      <Route path="/acces/:token" element={<IntervenantAccessPage />} />
      <Route path="/intervenant/invitation" element={<IntervenantInvitationPage />} />
      <Route path="/intervenant" element={<RouteSuspense label="Chargement du portail intervenant..."><IntervenantPortalPage /></RouteSuspense>} />
      <Route path="/documents/client/:token" element={<RouteSuspense label="Chargement du document client..."><ClientDocumentPage /></RouteSuspense>} />
      <Route path="/apporteur/:token" element={<RouteSuspense label="Chargement du portail apporteur..."><ApporteurPortalPage /></RouteSuspense>} />

      {/* Protégé */}
      <Route
        element={
          <RequireAuth>
            <LayoutShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<RouteSuspense label="Chargement du dashboard..."><DashboardPage /></RouteSuspense>} />
        <Route path="/assistant-direction" element={<RouteSuspense label="Chargement de l'assistant direction..."><AssistantDirectionPage /></RouteSuspense>} />
        <Route
          path="/rentabilite"
          element={
            <RequireCompanyFeature moduleId="rapports" profilePermissionKey="statistiques">
              <RouteSuspense label="Chargement de la rentabilité..."><RentabilitePage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route path="/crm" element={<CrmRoute section="dashboard" />} />
        <Route path="/crm/prospects" element={<CrmRoute section="prospects" />} />
        <Route path="/crm/clients" element={<CrmRoute section="clients" />} />
        <Route path="/crm/opportunites" element={<Navigate to="/projets" replace />} />
        <Route path="/crm/devis" element={<CrmRoute section="quotes" />} />
        <Route path="/crm/devis/:id/edit" element={<Navigate to="/crm/devis" replace />} />
        <Route path="/crm/factures" element={<Navigate to="/factures" replace />} />
        <Route
          path="/crm/apporteurs"
          element={
            <RequireCompanyFeature profilePermissionKey="crm">
              <RouteSuspense label="Chargement des apporteurs..."><ApporteursAffairesPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/factures"
          element={
            <RequireCompanyFeature profilePermissionKey="chantier_financier_billing">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement des factures...</div>}>
                  <InvoicesPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/financier/encaissements"
          element={
            <RequireCompanyFeature profilePermissionKey="chantier_financier_billing">
              <RouteSuspense label="Chargement des encaissements..."><FinancialPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/financier/decaissements"
          element={
            <RequireCompanyFeature moduleId="approvisionnement" profilePermissionKey="fournisseurs">
              <RouteSuspense label="Chargement des décaissements..."><FinancialPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/financier/encours-fournisseurs"
          element={
            <RequireCompanyFeature moduleId="approvisionnement" profilePermissionKey="fournisseurs">
              <RouteSuspense label="Chargement des encours fournisseurs..."><SupplierOutstandingPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/financier/tva"
          element={
            <RequireCompanyFeature moduleId="rapports" profilePermissionKey="statistiques">
              <RouteSuspense label="Chargement de la TVA..."><FinancialPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/financier/tresorerie"
          element={
            <RequireCompanyFeature moduleId="rapports" profilePermissionKey="statistiques">
              <RouteSuspense label="Chargement de la trésorerie..."><FinancialPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/financier/export-comptable"
          element={
            <RequireCompanyFeature moduleId="rapports" profilePermissionKey="statistiques">
              <RouteSuspense label="Chargement de l'export comptable..."><FinancialPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/financier/charges-fixes"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <RouteSuspense label="Chargement des charges fixes..."><FixedChargesPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route path="/crm/achats" element={<CrmRoute section="purchases" />} />
        <Route path="/crm/contacts" element={<CrmRoute section="contacts" />} />
        <Route path="/crm/ressources" element={<CrmRoute section="resources" />} />
        <Route path="/crm/bibliotheque" element={<CrmRoute section="library" />} />
        <Route path="/crm/agenda" element={<CrmRoute section="agenda" />} />
        <Route path="/crm/sav" element={<CrmRoute section="sav" />} />
        <Route path="/crm/statistiques" element={<CrmRoute section="stats" />} />
        <Route path="/crm/parametres" element={<CrmRoute section="settings" />} />

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
          element={<ChantierBackofficeRoute label="Chargement des chantiers..."><ChantiersPage /></ChantierBackofficeRoute>}
        />
        <Route path="/chantiers/nouveau" element={<ChantierBackofficeRoute label="Chargement du nouveau chantier..."><ChantierNewPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/preparation" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/execution" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/financier" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/qualite" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/documents" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/equipe" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/sav" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/historique" element={<ChantierBackofficeRoute label="Chargement du chantier..."><ChantierPage /></ChantierBackofficeRoute>} />
        <Route path="/chantiers/:id/production" element={<Navigate to="../execution" replace />} />
        <Route path="/chantiers/:id/qualite-cloture" element={<Navigate to="../qualite" replace />} />
        <Route path="/chantiers/:id/qualite-sav" element={<Navigate to="../qualite" replace />} />
        <Route path="/chantiers/:id/crm" element={<Navigate to=".." replace />} />
        <Route
          path="/chantiers/:id/visites"
          element={
            <RequireCompanyFeature moduleId="validation_qualite">
              <RouteSuspense label="Chargement des visites chantier..."><ChantierVisitesPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />

        <Route
          path="/intervenants"
          element={
            <RequireCompanyFeature profilePermissionKey="intervenants">
              <RouteSuspense label="Chargement des intervenants..."><IntervenantsPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/ressources/profils-types"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <RouteSuspense label="Chargement des profils types..."><ProfileAccessPresetsPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/intervenants/:id"
          element={
            <RequireCompanyFeature profilePermissionKey="intervenants">
              <RouteSuspense label="Chargement de l'intervenant..."><IntervenantDetailPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/retours-terrain"
          element={
            <RequireCompanyFeature moduleId="journal_chantier">
              <RouteSuspense label="Chargement des retours terrain..."><TerrainFeedbacksPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/bibliotheque"
          element={
            <RequireCompanyFeature moduleId="documents" profilePermissionKey="bibliotheque">
              <RouteSuspense label="Chargement de la bibliothèque..."><BibliothequeTasksPage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route path="/statistiques" element={<StatistiquesRoute />} />
        <Route path="/ressources/statistiques" element={<StatistiquesRoute />} />
        <Route
          path="/entreprise"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <RouteSuspense label="Chargement de Mon entreprise..."><MonEntreprisePage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/entreprise/fonctionnalites"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <RouteSuspense label="Chargement de Mon entreprise..."><MonEntreprisePage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/entreprise/profils"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <RouteSuspense label="Chargement de Mon entreprise..."><MonEntreprisePage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/entreprise/charges"
          element={
            <RequireCompanyFeature profilePermissionKey="entreprise_parametres">
              <RouteSuspense label="Chargement de Mon entreprise..."><MonEntreprisePage /></RouteSuspense>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/fournisseurs"
          element={
            <RequireCompanyFeature moduleId="approvisionnement" profilePermissionKey="fournisseurs">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement des fournisseurs...</div>}>
                  <FournisseursPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/bons-commande"
          element={
            <RequireCompanyFeature moduleId="approvisionnement" profilePermissionKey="fournisseurs">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement des bons de commande...</div>}>
                  <FournisseursPage initialTab="orders" />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route
          path="/catalogue-produits"
          element={
            <RequireCompanyFeature moduleId="approvisionnement" profilePermissionKey="fournisseurs">
              <LazyRouteErrorBoundary>
                <Suspense fallback={<div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du catalogue produits...</div>}>
                  <ProductCatalogPage />
                </Suspense>
              </LazyRouteErrorBoundary>
            </RequireCompanyFeature>
          }
        />
        <Route path="/entreprise/fournisseurs" element={<Navigate to="/fournisseurs" replace />} />
      </Route>

      <Route path="*" element={<AppEntryPage />} />
    </Routes>
  );
}