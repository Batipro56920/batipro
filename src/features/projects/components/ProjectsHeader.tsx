import { Link } from "react-router-dom";
import { Plus, Receipt, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/layout/PageHeader";

export function ProjectsHeader({ billingMode = false, onRefresh }: { billingMode?: boolean; onRefresh: () => void }) {
  return (
    <PageHeader
      eyebrow={billingMode ? "Facturation" : "Commerce"}
      title={billingMode ? "Projets à facturer" : "Projets"}
      description={
        billingMode
          ? "Choisissez un projet commercial avec devis accepté pour créer une facture d'acompte, de situation ou finale depuis l'onglet Devis."
          : "Centralisez vos dossiers avant-production : qualification, visites, devis, préparation chantier, facturation et continuité SAV."
      }
      actions={
        billingMode ? (
          <>
            <Link
              to="/factures"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              <Receipt className="h-4 w-4" />
              Retour factures
            </Link>
            <Button type="button" variant="secondary" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              Rafraîchir
            </Button>
          </>
        ) : (
          <>
            <Link
              to="/crm/prospects?action=nouveau-prospect"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Depuis prospect
            </Link>
            <Link
              to="/crm/devis"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nouveau devis
            </Link>
            <Link
              to="/projets?facturation=1"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-800 shadow-sm transition hover:bg-blue-100"
            >
              <Receipt className="h-4 w-4" />
              À facturer
            </Link>
            <Button type="button" variant="secondary" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              Rafraîchir
            </Button>
          </>
        )
      }
    />
  );
}
