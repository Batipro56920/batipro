import { Link } from "react-router-dom";
import { FileText, Plus, Receipt } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";

export function ProjectsHeader({
  billingMode = false,
  quoteCreationMode = false,
  chantierCreationMode = false,
  // Conservé pour les appelants : le bouton "Rafraîchir" a été retiré, les données
  // se rechargent à la navigation et après chaque action.
}: {
  billingMode?: boolean;
  quoteCreationMode?: boolean;
  chantierCreationMode?: boolean;
  onRefresh?: () => void;
}) {
  const title = billingMode
    ? "Projets à facturer"
    : quoteCreationMode
      ? "Projets à chiffrer"
      : chantierCreationMode
        ? "Projets à passer en chantier"
        : "Projets";
  const description = billingMode
    ? "Choisissez un projet commercial avec devis accepté pour créer une facture d'acompte, de situation ou finale depuis l'onglet Devis."
    : quoteCreationMode
      ? "Isolez les dossiers commerciaux encore ouverts pour démarrer un nouveau devis depuis le bon projet, sans créer de devis hors contexte."
      : chantierCreationMode
        ? "Isolez les affaires signées qui n'ont pas encore de dossier chantier afin de lancer rapidement la préparation production."
        : "Centralisez vos dossiers avant-production : qualification, visites, devis, préparation chantier, facturation et continuité SAV.";

  return (
    <PageHeader
      eyebrow={billingMode ? "Facturation" : quoteCreationMode ? "Chiffrage" : chantierCreationMode ? "Production" : "Commerce"}
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
          </>
        ) : quoteCreationMode ? (
          <>
            <Link
              to="/crm/devis"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              Retour devis
            </Link>
          </>
        ) : chantierCreationMode ? (
          <>
            <Link
              to="/projets"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Retour projets
            </Link>
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
            {/*
              Les autres raccourcis sont partis : "Apporteurs" doublait l'entrée
              du menu, et les vues filtrées se lancent depuis le module concerné
              (les factures pour "à facturer", les chantiers pour "à passer en
              chantier", le menu Nouveau pour un devis). Les modes eux-mêmes
              restent en place, seuls ces boutons d'accès disparaissent.
            */}
          </>
        )
      }
    />
  );
}
