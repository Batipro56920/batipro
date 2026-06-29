import { Link } from "react-router-dom";
import { Hammer, Plus, Receipt, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/layout/PageHeader";

export function ProjectsHeader({
  billingMode = false,
  chantierCreationMode = false,
  onRefresh,
}: {
  billingMode?: boolean;
  chantierCreationMode?: boolean;
  onRefresh: () => void;
}) {
  const title = billingMode ? "Projets à facturer" : chantierCreationMode ? "Projets à passer en chantier" : "Projets";
  const description = billingMode
    ? "Choisissez un projet commercial avec devis accepté pour créer une facture d'acompte, de situation ou finale depuis l'onglet Devis."
    : chantierCreationMode
      ? "Isolez les affaires signées qui n'ont pas encore de dossier chantier afin de lancer rapidement la préparation production."
      : "Centralisez vos dossiers avant-production : qualification, visites, devis, préparation chantier, facturation et continuité SAV.";

  return (
    <PageHeader
      eyebrow={billingMode ? "Facturation" : chantierCreationMode ? "Production" : "Commerce"}
      title={title}
      description={description}
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
        ) : chantierCreationMode ? (
          <>
            <Link
              to="/projets"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Retour projets
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
              to="/projets?chantier=a-creer"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100"
            >
              <Hammer className="h-4 w-4" />
              À passer chantier
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
