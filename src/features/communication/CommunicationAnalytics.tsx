import { useEffect, useState } from "react";
import { BarChart3, Link2, MousePointerClick, Share2, Target, Users } from "lucide-react";
import { loadMetrics } from "./communicationRepository";
import { channelLabel } from "./networks";
import type { PublicationMetrics, SocialMetricsSummary } from "./types";

const EMPTY: SocialMetricsSummary = { impressions: 0, reach: 0, engagements: 0, clicks: 0, comments: 0, shares: 0, leads: 0 };

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(Number(value) || 0);
}

export function CommunicationAnalytics() {
  const [summary, setSummary] = useState<SocialMetricsSummary>(EMPTY);
  const [publications, setPublications] = useState<PublicationMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadMetrics()
      .then((result) => { setSummary(result.summary); setPublications(result.publications); setError(""); })
      .catch((err) => setError(err instanceof Error ? err.message : "Lecture des statistiques impossible."))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    ["Portée", summary.reach, Users],
    ["Impressions", summary.impressions, BarChart3],
    ["Engagements", summary.engagements, Target],
    ["Clics", summary.clicks, MousePointerClick],
    ["Partages", summary.shares, Share2],
    ["Commentaires", summary.comments, Target],
  ] as const;

  // Un tableau de zéros ressemble à une mesure. Tant que rien n'a été mesuré,
  // mieux vaut le dire que d'afficher des compteurs vides.
  if (!loading && !publications.length) {
    return (
      <section className="rounded-2xl border border-subtle bg-surface p-8 text-center shadow-sm">
        <BarChart3 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-semibold text-ink">Aucune mesure pour l'instant</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
          Les chiffres viennent des réseaux eux-mêmes, publication par publication. Ils apparaîtront une fois qu'un
          compte sera connecté et qu'une publication sera diffusée depuis Batipro.
        </p>
        {error ? <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-on">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl bg-danger-soft p-3 text-sm text-danger-on">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, Icon]) => (
          <article key={label} className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{label}</p>
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <strong className="mt-3 block text-3xl text-ink">{formatNumber(value)}</strong>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm">
        <header className="border-b border-subtle p-4">
          <h2 className="font-semibold text-ink">Par publication</h2>
          <p className="text-sm text-muted">Chiffres relevés chez le réseau, réseau par réseau.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-interactive text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Publication</th>
                <th className="px-4 py-2 font-semibold">Réseau</th>
                <th className="px-4 py-2 text-right font-semibold">Portée</th>
                <th className="px-4 py-2 text-right font-semibold">Engagements</th>
                <th className="px-4 py-2 text-right font-semibold">Clics</th>
                <th className="px-4 py-2 font-semibold">Relevé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {publications.map((row) => (
                <tr key={row.variantId}>
                  <td className="px-4 py-3 text-ink">{row.itemTitle}</td>
                  <td className="px-4 py-3 text-muted">{channelLabel(row.network)}</td>
                  {row.syncError ? (
                    <td colSpan={4} className="px-4 py-3 text-xs text-amber-700">{row.syncError}</td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right text-ink">{formatNumber(row.reach)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatNumber(row.engagements)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatNumber(row.clicks)}</td>
                      <td className="px-4 py-3 text-muted">{row.measuredAt ? new Date(row.measuredAt).toLocaleString("fr-FR") : "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-subtle bg-surface p-6">
          <h2 className="font-semibold text-ink">Du réseau social au devis</h2>
          <p className="mt-2 text-sm text-muted">
            Les réseaux mesurent ce qui se passe chez eux. Ce qui se passe ensuite sur le site, formulaire envoyé puis
            projet créé dans Batipro, se mesure avec les liens de campagne du compositeur.
          </p>
        </article>
        <article className="rounded-2xl border border-primary/30 bg-primary-soft p-6">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold text-ink">Attribution par campagne</h2>
          <p className="mt-2 text-sm text-muted">
            Chaque lien créé dans le compositeur porte la campagne, le contenu et le réseau d'origine.
          </p>
        </article>
      </section>
    </div>
  );
}
