// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import LayoutShell from "./components/LayoutShell";
import RequireAuth from "./components/RequireAuth";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ChantiersPage from "./pages/ChantiersPage";
import ChantierNewPage from "./pages/ChantierNewPage";
import ChantierPage from "./pages/ChantierPage";
import ChantierVisitesPage from "./pages/ChantierVisitesPage";
import IntervenantAccessPage from "./pages/IntervenantAccessPage";
import IntervenantPortalPage from "./pages/IntervenantPortalPage";
import IntervenantsPage from "./pages/IntervenantsPage";
import BibliothequeTasksPage from "./pages/BibliothequeTasksPage";
import StatistiquesPage from "./pages/StatistiquesPage";
import MonEntreprisePage from "./pages/MonEntreprisePage";
import FournisseursPage from "./pages/FournisseursPage";
import TerrainFeedbacksPage from "./pages/TerrainFeedbacksPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<AuthPage />} />

      {/* Public - portail intervenant */}
      <Route path="/acces/:token" element={<IntervenantAccessPage />} />
      <Route path="/intervenant" element={<IntervenantPortalPage />} />

      {/* Protégé */}
      <Route
        element={
          <RequireAuth>
            <LayoutShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/chantiers" element={<ChantiersPage />} />
        <Route path="/chantiers/nouveau" element={<ChantierNewPage />} />
        <Route path="/chantiers/:id" element={<ChantierPage />} />
        <Route path="/chantiers/:id/visites" element={<ChantierVisitesPage />} />

        <Route path="/intervenants" element={<IntervenantsPage />} />
        <Route path="/retours-terrain" element={<TerrainFeedbacksPage />} />
        <Route path="/bibliotheque" element={<BibliothequeTasksPage />} />
        <Route path="/statistiques" element={<StatistiquesPage />} />
        <Route path="/entreprise" element={<MonEntreprisePage />} />
        <Route path="/fournisseurs" element={<FournisseursPage />} />
        <Route path="/entreprise/fournisseurs" element={<Navigate to="/fournisseurs" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

