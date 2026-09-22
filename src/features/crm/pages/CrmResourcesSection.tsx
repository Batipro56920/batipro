import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CrmDataset } from "../../../services/crm.service";
import { loadTaskTemplateUnitCosts } from "../../../services/taskTemplateComputedCost";
import { eur } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmResourcesSection({ templates }: { templates: CrmDataset["taskTemplates"] }) {
  const navigate = useNavigate();
  // Le prix de revient vient du calcul (materiaux, main d'oeuvre, frais), pas
  // d'une colonne saisie a la main qui ne bougeait plus.
  const [unitCosts, setUnitCosts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    let alive = true;
    void loadTaskTemplateUnitCosts(templates)
      .then((costs) => { if (alive) setUnitCosts(costs); })
      .catch(() => { if (alive) setUnitCosts(new Map()); });
    return () => { alive = false; };
  }, [templates]);
  // Stable tant que la carte ne change pas : sinon le calcul des statistiques
  // ne peut plus etre memorise et se refait a chaque rendu.
  const unitCostOf = useCallback((id: string) => unitCosts.get(id) ?? 0, [unitCosts]);
  const libraryStats = useMemo(() => {
    const lots = new Set(templates.map((row) => (row.lot ?? "").trim()).filter(Boolean));
    const hasTechnicalBase = (row: CrmDataset["taskTemplates"][number]) =>
      Boolean(row.description_technique) || row.caracteristiques.length > 0 || Boolean(row.remarques);
    const readyForQuote = templates.filter(
      (row) => row.quote_visible && row.temps_prevu_par_unite_h !== null && unitCostOf(row.id) > 0,
    ).length;
    const readyForChantier = templates.filter(
      (row) => row.chantier_visible && row.temps_prevu_par_unite_h !== null && hasTechnicalBase(row),
    ).length;
    const hiddenFromQuote = templates.filter((row) => !row.quote_visible).length;
    const hiddenFromChantier = templates.filter((row) => !row.chantier_visible).length;
    const missingQuoteTime = templates.filter((row) => row.quote_visible && row.temps_prevu_par_unite_h === null).length;
    const missingQuoteCost = templates.filter((row) => row.quote_visible && unitCostOf(row.id) <= 0).length;
    const missingChantierTime = templates.filter((row) => row.chantier_visible && row.temps_prevu_par_unite_h === null).length;
    const missingChantierTechnical = templates.filter((row) => row.chantier_visible && !hasTechnicalBase(row)).length;
    return {
      total: templates.length,
      lots: lots.size,
      readyForQuote,
      readyForChantier,
      hiddenFromQuote,
      hiddenFromChantier,
      missingQuoteTime,
      missingQuoteCost,
      missingChantierTime,
      missingChantierTechnical,
    };
  }, [templates, unitCostOf]);

  function openLibrary(templateId?: string) {
    if (templateId) {
      navigate(`/bibliotheque?templateId=${encodeURIComponent(templateId)}`);
      return;
    }
    navigate("/bibliotheque");
  }

  function openLibraryLot(lot?: string | null) {
    const normalizedLot = (lot ?? "").trim();
    if (!normalizedLot) {
      openLibrary();
      return;
    }
    navigate(`/bibliotheque?lot=${encodeURIComponent(normalizedLot)}`);
  }

  function openLibraryReadiness(readiness: string) {
    navigate(`/bibliotheque?readiness=${encodeURIComponent(readiness)}`);
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => openLibrary()}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Modèles</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.total}</div>
          <div className="text-xs text-slate-500">base de tâches pour devis et chantiers</div>
        </button>
        <button
          type="button"
          onClick={() => openLibrary()}
          className="rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="text-xs font-medium uppercase text-slate-500">Lots</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.lots}</div>
          <div className="text-xs text-slate-500">familles métier structurées</div>
        </button>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">Prêts devis</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.readyForQuote}</div>
          <div className="text-xs text-slate-500">
            visibles au devis, avec temps et coût · {libraryStats.hiddenFromQuote} masqués
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {libraryStats.missingQuoteCost > 0 ? (
              <button
                type="button"
                onClick={() => openLibraryReadiness("missing_cost")}
                className="rounded-lg border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
              >
                {libraryStats.missingQuoteCost} coûts à compléter
              </button>
            ) : null}
            {libraryStats.missingQuoteTime > 0 ? (
              <button
                type="button"
                onClick={() => openLibraryReadiness("missing_time")}
                className="rounded-lg border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
              >
                {libraryStats.missingQuoteTime} temps à compléter
              </button>
            ) : null}
            {libraryStats.hiddenFromQuote > 0 ? (
              <button
                type="button"
                onClick={() => openLibraryReadiness("quote_hidden")}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                {libraryStats.hiddenFromQuote} masqués devis
              </button>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">Prêts chantier</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{libraryStats.readyForChantier}</div>
          <div className="text-xs text-slate-500">
            visibles chantier, avec temps et base technique · {libraryStats.hiddenFromChantier} masqués
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {libraryStats.missingChantierTime > 0 ? (
              <button
                type="button"
                onClick={() => openLibraryReadiness("missing_time")}
                className="rounded-lg border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
              >
                {libraryStats.missingChantierTime} temps chantier
              </button>
            ) : null}
            {libraryStats.missingChantierTechnical > 0 ? (
              <button
                type="button"
                onClick={() => openLibraryReadiness("missing_technical")}
                className="rounded-lg border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
              >
                {libraryStats.missingChantierTechnical} détails terrain
              </button>
            ) : null}
            {libraryStats.hiddenFromChantier > 0 ? (
              <button
                type="button"
                onClick={() => openLibraryReadiness("chantier_hidden")}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                {libraryStats.hiddenFromChantier} masqués chantier
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
          Aucun modèle de tâche n'est encore disponible. Ouvrez la bibliothèque pour créer les premières lignes types qui alimenteront les devis et les chantiers.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((row) => {
            const hasTechnicalBase =
              Boolean(row.description_technique) || row.caracteristiques.length > 0 || Boolean(row.remarques);
            const missingQuoteReadiness =
              !row.quote_visible || row.temps_prevu_par_unite_h === null || unitCostOf(row.id) <= 0;
            const missingChantierReadiness =
              !row.chantier_visible || row.temps_prevu_par_unite_h === null || !hasTechnicalBase;

            return (
              <div key={row.id} className="rounded-2xl border bg-white p-5">
                <button
                  type="button"
                  onClick={() => openLibraryLot(row.lot)}
                  className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 hover:text-slate-700"
                  title="Voir ce lot dans la bibliothèque"
                >
                  {row.lot ?? "Sans famille"}
                </button>
                <div className="mt-1 font-semibold text-slate-900">{row.titre}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2">Unité<br /><b>{row.unite ?? "u"}</b></div>
                  <div className="rounded-xl bg-slate-50 p-2">Temps<br /><b>{row.temps_prevu_par_unite_h ?? 0}h</b></div>
                  <div className="rounded-xl bg-slate-50 p-2">Prix de revient<br /><b>{eur(unitCostOf(row.id))}</b></div>
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
                  {row.lot ? (
                    <button
                      type="button"
                      onClick={() => openLibraryLot(row.lot)}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Voir le lot
                    </button>
                  ) : null}
                  {!row.quote_visible ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                      Masqué au devis
                    </span>
                  ) : null}
                  {!row.chantier_visible ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                      Masqué au chantier
                    </span>
                  ) : null}
                  {missingQuoteReadiness ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                      À compléter avant devis
                    </span>
                  ) : null}
                  {missingChantierReadiness ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                      À préparer avant chantier
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ListShell>
  );
}
