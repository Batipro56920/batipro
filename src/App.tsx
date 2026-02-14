// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import LayoutShell from "./components/LayoutShell";
import RequireAuth from "./components/RequireAuth";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ChantiersPage from "./pages/ChantiersPage";
import ChantierNewPage from "./pages/ChantierNewPage";
import ChantierPage from "./pages/ChantierPage";
import IntervenantAccessPage from "./pages/IntervenantAccessPage";
import IntervenantsPage from "./pages/IntervenantsPage";
import BibliothequeTasksPage from "./pages/BibliothequeTasksPage";
import StatistiquesPage from "./pages/StatistiquesPage";
import FournisseursPage from "./pages/FournisseursPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<AuthPage />} />

      {/* Public - portail intervenant */}
      <Route path="/acces/:token" element={<IntervenantAccessPage />} />

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

        <Route path="/intervenants" element={<IntervenantsPage />} />
        <Route path="/bibliotheque" element={<BibliothequeTasksPage />} />
        <Route path="/statistiques" element={<StatistiquesPage />} />
        <Route path="/fournisseurs" element={<FournisseursPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

