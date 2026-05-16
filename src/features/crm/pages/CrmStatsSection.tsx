import type { CrmDataset } from "../../../services/crm.service";
import { eur } from "../components/crmFormat";

export default function CrmStatsSection({ data, kpis, transformationRate }: { data: CrmDataset; kpis: Record<string, number>; transformationRate: number }) {
  const avgQuote = data.quotes.length ? data.quotes.reduce((sum, row) => sum + row.montant_ht, 0) / data.quotes.length : 0;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        ["CA signé", eur(kpis.signedRevenue)],
        ["CA transformé chantier", eur(kpis.chantierRevenue)],
        ["CA pipeline", eur(kpis.pipelineRevenue)],
        ["Taux transformation", `${transformationRate}%`],
        ["Taux devis → chantier", `${data.quotes.length ? Math.round((data.chantiers.filter((row) => row.crm_quote_id).length / data.quotes.length) * 100) : 0}%`],
        ["Chantiers actifs CRM", kpis.crmActiveChantiers],
        ["Chantiers terminés CRM", kpis.crmFinishedChantiers],
        ["Délai signature", "à mesurer"],
        ["Nombre devis", data.quotes.length],
        ["Devis gagnés", kpis.quotesSigned],
        ["Devis perdus", kpis.quotesRefused],
        ["Panier moyen", eur(avgQuote)],
        ["Performance commerciale", `${data.opportunities.filter((row) => row.status === "gagnee").length} gagnées`],
        ["SAV ouverts", kpis.openSav],
      ].map(([label, value]) => (
        <div key={String(label)} className="rounded-3xl border bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
      ))}
    </div>
  );
}
