import { Upload, UserPlus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function ClientsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm shadow-slate-950/[0.03]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <UserPlus className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">Aucun client pour le moment</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Ajoutez votre premier client ou importez une liste de contacts existants.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="primary" size="md" onClick={onCreate}>
          <UserPlus className="h-4 w-4" />
          Ajouter client
        </Button>
        <Button type="button" variant="secondary" size="md" disabled title="Import clients à finaliser">
          <Upload className="h-4 w-4" />
          Importer
        </Button>
      </div>
    </section>
  );
}
