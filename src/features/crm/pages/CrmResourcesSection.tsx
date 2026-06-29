import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { CrmDataset } from "../../../services/crm.service";
import { eur } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmResourcesSection({ templates }: { templates: CrmDataset["taskTemplates"] }) {
  const navigate = useNavigate();
  const libraryStats = useMemo(() => {
    const lots = new Set(templates.map((row) => (row.lot ?? "").trim()).filter(Boolean));
    const readyForQuote = templates.filter((row) => row.temps_prevu_par_unite_h !== null && row.cout_reference_unitaire_ht !== null).length;
    return {
      total: templates.length,
      lots: lots.size,
      readyForQuote,
    };
  }, [templates]);

  function openLibrary(templateId?: string) {
    if (templateId) {
      navigate(`/bibliotheque?templateId=${encodeURIComponent(templateId)}`);
      return;
    }
    navigate("/bibliotheque");
  }

  return (
    <ListShell
      title="Ressources / bibliothèque devis"
      actionLabel="Ouvrir la bibliothèque"
      query=""
      setQuery={() => undefined}
      onCreate={() => openLibrary()}
      hideSearch
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">Modèles</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.total}</div>
          <div className="text-xs text-slate-500">base de tâches pour devis et chantiers</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">Lots</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.lots}</div>
          <div className="text-xs text-slate-500">familles métier structurées</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">Prêts devis</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.readyForQuote}</div>
          <div className="text-xs text-slate-500">avec temps et coût de référence</div>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
          Aucun modèle de tâche n'est encore disponible. Ouvrez la bibliothèque pour créer les premières lignes types qui alimenteront les devis et les chantiers.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((row) => (
            <div key={row.id} className="rounded-2xl border bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{row.lot ?? "Sans famille"}</div>
              <div className="mt-1 font-semibold text-slate-900">{row.titre}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-2">Unité<br /><b>{row.unite ?? "u"}</b></div>
                <div className="rounded-xl bg-slate-50 p-2">Temps<br /><b>{row.temps_prevu_par_unite_h ?? 0}h</b></div>
                <div className="rounded-xl bg-slate-50 p-2">Coût ref.<br /><b>{eur(row.cout_reference_unitaire_ht ?? 0)}</b></div>
              </div>
              {row.description_technique ? <p className="mt-3 line-clamp-3 text-sm text-slate-600">{row.description_technique}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openLibrary(row.id)}
                  className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ouvrir la fiche
                </button>
                {row.temps_prevu_par_unite_h === null || row.cout_reference_unitaire_ht === null ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    À compléter avant devis
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </ListShell>
  );
}
