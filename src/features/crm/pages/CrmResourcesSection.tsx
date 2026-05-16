import type { CrmDataset } from "../../../services/crm.service";
import { eur } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmResourcesSection({ templates }: { templates: CrmDataset["taskTemplates"] }) {
  return (
    <ListShell title="Ressources / bibliotheque devis" actionLabel="Ouvrir bibliotheque" query="" setQuery={() => undefined} onCreate={() => { window.location.href = "/bibliotheque"; }} hideSearch>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{row.lot ?? "Sans famille"}</div>
            <div className="mt-1 font-semibold">{row.titre}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2">Unite<br /><b>{row.unite ?? "u"}</b></div>
              <div className="rounded-xl bg-slate-50 p-2">Temps<br /><b>{row.temps_prevu_par_unite_h ?? 0}h</b></div>
              <div className="rounded-xl bg-slate-50 p-2">Cout ref.<br /><b>{eur(row.cout_reference_unitaire_ht ?? 0)}</b></div>
            </div>
            {row.description_technique ? <p className="mt-3 text-sm text-slate-600">{row.description_technique}</p> : null}
          </div>
        ))}
      </div>
    </ListShell>
  );
}
