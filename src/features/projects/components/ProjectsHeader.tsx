import { Link } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/layout/PageHeader";

export function ProjectsHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <PageHeader
      eyebrow="Commerce"
      title="Projets"
      description="Centralisez vos dossiers avant-production : qualification, visites, devis, préparation chantier et continuité SAV."
      actions={
        <>
          <Link
            to="/crm/prospects"
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
          <Button type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Rafraîchir
          </Button>
        </>
      }
    />
  );
}
