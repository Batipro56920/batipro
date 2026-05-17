import { Headphones, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function SavEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm shadow-slate-950/[0.03]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Headphones className="h-6 w-6" /></div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">Aucun ticket SAV</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Créez un ticket pour suivre une demande après chantier.</p>
      <div className="mt-5 flex justify-center"><Button type="button" variant="primary" size="md" onClick={onCreate}><Plus className="h-4 w-4" />Nouveau ticket</Button></div>
    </section>
  );
}
