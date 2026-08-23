/**
 * Entree de previsualisation UI — servie uniquement par `vite dev` (`/preview.html`).
 * `vite build` ne prend que `index.html` en entree : ce fichier ne part jamais en production.
 * Necessite VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY dans .env.local pour demarrer.
 */
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "./design-system/theme/ThemeProvider";
import { DashboardPreview } from "./preview/DashboardPreview";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <MemoryRouter>
      <DashboardPreview />
    </MemoryRouter>
  </ThemeProvider>,
);
