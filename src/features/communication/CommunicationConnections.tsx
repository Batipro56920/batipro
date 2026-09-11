import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, BarChart3, CheckCircle2, ExternalLink, Image, Link2, RefreshCw, ShieldCheck, Video } from "lucide-react";
import { Button } from "../../components/ui/button";
import { disconnectSocialAccount, loadConnections, startSocialConnection, type ConnectionsState } from "./communicationRepository";
import type { SocialAccount, SocialNetwork } from "./types";

const PROVIDERS: Array<{ id: SocialNetwork; label: string; use: string; priority: string }> = [
  { id: "facebook", label: "Facebook Pages", use: "Publier, programmer et traiter commentaires/messages.", priority: "Prioritaire" },
  { id: "instagram", label: "Instagram professionnel", use: "Publications, médias, commentaires et statistiques.", priority: "Prioritaire" },
  { id: "linkedin", label: "LinkedIn Page", use: "Actualités, commentaires et statistiques d'engagement.", priority: "Prioritaire" },
  { id: "google_business", label: "Google Business Profile", use: "Actualités locales et avis clients.", priority: "Prioritaire" },
  { id: "tiktok", label: "TikTok", use: "Vidéos courtes et vues. Pas de commentaires : TikTok ne les ouvre qu'à ses partenaires.", priority: "Publication et vues" },
  { id: "youtube", label: "YouTube", use: "Vidéos chantier et statistiques.", priority: "Pas encore pris en charge" },
];

const EMPTY: ConnectionsState = { providers: [], accounts: [] };

function AccountRow({ account, onDisconnect, busy }: { account: SocialAccount; onDisconnect: () => void; busy: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-interactive px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span className="truncate">{account.display_name}</span>
      </span>
      <button type="button" disabled={busy} onClick={onDisconnect} className="shrink-0 text-xs font-medium text-danger hover:underline disabled:opacity-50">
        Déconnecter
      </button>
    </div>
  );
}

export function CommunicationConnections() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<ConnectionsState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setState(await loadConnections());
      setError("");
    } catch (err) {
      setState(EMPTY);
      setError(err instanceof Error ? err.message : "Lecture des connexions impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Le réseau renvoie l'utilisateur ici après l'autorisation : le résultat doit
  // se lire, puis disparaître de l'adresse pour ne pas rester au rechargement.
  useEffect(() => {
    const done = params.get("connexion");
    const failed = params.get("connexion_erreur");
    if (!done && !failed) return;
    if (done) {
      const [provider, count] = done.split(":");
      const label = PROVIDERS.find((entry) => entry.id === provider)?.label ?? provider;
      setMessage(`${label} connecté : ${count} compte(s) rattaché(s).`);
    }
    if (failed) setError(failed);
    const next = new URLSearchParams(params);
    next.delete("connexion");
    next.delete("connexion_erreur");
    setParams(next, { replace: true });
  }, [params, setParams]);

  async function connect(provider: SocialNetwork) {
    setBusy(true); setError(""); setMessage("");
    try {
      window.location.assign(await startSocialConnection(provider));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
      setBusy(false);
    }
  }

  async function disconnect(accountId: string, label: string) {
    if (!window.confirm(`Déconnecter ${label} ? Les publications programmées sur ce compte ne partiront plus.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      setState(await disconnectSocialAccount(accountId));
      setMessage(`${label} déconnecté.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Déconnexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/30 bg-primary-soft p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 text-primary" />
          <div>
            <h2 className="font-semibold text-ink">Connexions sécurisées par OAuth</h2>
            <p className="mt-1 text-sm text-muted">
              Batipro ne demande jamais les mots de passe des réseaux. Tu autorises l'accès chez le réseau, et les jetons
              restent côté serveur : ils ne passent jamais par le navigateur.
            </p>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-2xl bg-danger-soft p-3 text-sm text-danger-on">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-success-soft p-3 text-sm text-success">{message}</p> : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Réseaux sociaux</h2>
          <button onClick={() => void refresh()} className="rounded-lg p-2 text-muted hover:bg-interactive" aria-label="Actualiser">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {PROVIDERS.map((provider) => {
            const readiness = state.providers.find((entry) => entry.provider === provider.id);
            const accounts = state.accounts.filter((entry) => entry.provider === provider.id);
            const supported = Boolean(readiness);
            const configured = Boolean(readiness?.configured);
            return (
              <article key={provider.id} className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-interactive"><Link2 className="h-5 w-5 text-primary" /></div>
                    <div>
                      <h3 className="font-semibold text-ink">{provider.label}</h3>
                      <p className="mt-1 text-sm text-muted">{provider.use}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-interactive px-2 py-1 text-xs text-muted">{provider.priority}</span>
                </div>

                {accounts.length ? (
                  <div className="mt-4 space-y-2">
                    {accounts.map((account) => (
                      <AccountRow key={account.id} account={account} busy={busy} onDisconnect={() => void disconnect(account.id, account.display_name)} />
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-subtle pt-4">
                  {!supported ? (
                    <span className="flex items-center gap-2 text-sm text-muted"><AlertCircle className="h-4 w-4" />Pas encore pris en charge</span>
                  ) : configured ? (
                    <span className="text-sm text-muted">{accounts.length ? "Ajouter un autre compte" : "Aucun compte connecté"}</span>
                  ) : (
                    <span className="min-w-0 text-sm text-muted">
                      <AlertCircle className="mr-1 inline h-4 w-4" />
                      Secrets serveur à renseigner : <span className="break-all font-mono text-xs">{readiness?.missingSecrets.join(", ")}</span>
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    disabled={!configured || busy || loading}
                    onClick={() => void connect(provider.id)}
                    title={configured ? undefined : "Disponible une fois l'application développeur créée et ses secrets renseignés"}
                  >
                    {accounts.length ? <><RefreshCw className="h-4 w-4" />Reconnecter</> : <>Connecter <ExternalLink className="h-4 w-4" /></>}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Création et mesure</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {([
            [Image, "Canva", "Visuels, modèles de marque et export vers la médiathèque.", "Atelier externe", "https://www.canva.com/create/social-media/"],
            [Video, "CapCut", "Montage vertical gratuit, sous-titres et exports sociaux.", "Atelier externe", "https://www.capcut.com/editor"],
            [BarChart3, "Statistiques natives", "Meta, LinkedIn et Google regroupés dans Batipro.", "Après connexion", ""],
            [BarChart3, "PostHog", "Visites du site, formulaires et conversions des campagnes.", "Gratuit jusqu’à 1 M d’événements", "https://posthog.com/"],
          ] as const).map(([Icon, title, description, badge, url]) => (
            <article key={title} className="rounded-2xl border border-subtle bg-surface p-4">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold text-ink">{title}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted">{description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-success-soft px-2 py-1 text-xs text-success">{badge}</span>
                {url ? <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary">Ouvrir <ExternalLink className="inline h-3 w-3" /></a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {loading ? <p className="text-sm text-muted">Vérification des connexions…</p> : null}
    </div>
  );
}
