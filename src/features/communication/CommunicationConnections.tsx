import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, BarChart3, Check, CheckCircle2, Copy, ExternalLink, Image, Link2, RefreshCw, ShieldCheck, Video } from "lucide-react";
import { Button } from "../../components/ui/button";
import { disconnectSocialAccount, loadConnections, startSocialConnection, type ConnectionsState, type ProviderReadiness } from "./communicationRepository";
import type { SocialAccount, SocialNetwork } from "./types";

type ProviderCard = {
  id: SocialNetwork;
  label: string;
  use: string;
  priority: string;
  /** Ce qu'il faut créer chez le réseau, et où. */
  console: { url: string; name: string; create: string } | null;
};

const PROVIDERS: ProviderCard[] = [
  { id: "facebook", label: "Facebook Pages", use: "Publier, programmer et traiter commentaires/messages.", priority: "Prioritaire", console: { url: "https://developers.facebook.com/apps", name: "Meta for Developers", create: "une application de type Business, avec le produit « Facebook Login »" } },
  { id: "instagram", label: "Instagram professionnel", use: "Publications, médias, commentaires et statistiques.", priority: "Prioritaire", console: { url: "https://developers.facebook.com/apps", name: "Meta for Developers", create: "la même application que Facebook : un seul couple d'identifiants sert aux deux" } },
  { id: "linkedin", label: "LinkedIn", use: "Publie sur le compte connecté. Ni commentaires ni statistiques : LinkedIn les réserve aux pages entreprise.", priority: "Publication", console: { url: "https://www.linkedin.com/developers/apps", name: "LinkedIn Developers", create: "une application, puis demande le produit « Share on LinkedIn »" } },
  { id: "google_business", label: "Google Business Profile", use: "Actualités locales et avis clients.", priority: "Prioritaire", console: { url: "https://console.cloud.google.com/apis/credentials", name: "Google Cloud", create: "un identifiant OAuth, API « Business Profile » activée" } },
  { id: "tiktok", label: "TikTok", use: "Vidéos courtes et vues. Pas de commentaires : TikTok ne les ouvre qu'à ses partenaires.", priority: "Publication et vues", console: { url: "https://developers.tiktok.com/apps", name: "TikTok for Developers", create: "une application avec « Login Kit » et « Content Posting API »" } },
  { id: "youtube", label: "YouTube", use: "Vidéos chantier, commentaires et vues.", priority: "Complet", console: { url: "https://console.cloud.google.com/apis/credentials", name: "Google Cloud", create: "un identifiant OAuth distinct, API « YouTube Data API v3 » activée" } },
];

const EMPTY: ConnectionsState = { providers: [], accounts: [], redirectUri: null };

/** Adresse de la page des secrets du projet, déduite de l'adresse Supabase. */
function secretsPageUrl() {
  const host = String(import.meta.env.VITE_SUPABASE_URL ?? "");
  const ref = host.match(/https?:\/\/([a-z0-9]+)\.supabase\./i)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/settings/functions` : "https://supabase.com/dashboard";
}

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="mt-1 flex items-center gap-2 rounded-lg border border-subtle bg-surface px-2 py-1">
      <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-ink">{value}</code>
      <button
        type="button"
        onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }}
        className="shrink-0 rounded p-1 text-primary hover:bg-primary-soft"
        aria-label="Copier"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

/**
 * Ce qu'il reste à faire pour ce réseau, en clair.
 *
 * La carte n'affichait que deux noms de variables et un bouton inactif : rien
 * ne disait que l'étape suivante se passe chez le réseau, ni laquelle.
 */
function SetupGuide({ card, readiness, redirectUri }: { card: ProviderCard; readiness: ProviderReadiness; redirectUri: string | null }) {
  const secrets = readiness.missingSecrets.filter((secret) => secret !== "COMMUNICATION_OAUTH_REDIRECT_URI");
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-ink">
      <p className="flex items-center gap-2 font-semibold text-amber-800">
        <AlertCircle className="h-4 w-4" />Connexion impossible tant que l&apos;application n&apos;existe pas chez le réseau
      </p>

      {card.console ? (
        <p>
          <span className="font-semibold">1.</span> Crée {card.console.create} sur{" "}
          <a href={card.console.url} target="_blank" rel="noreferrer" className="font-medium text-primary">
            {card.console.name} <ExternalLink className="inline h-3 w-3" />
          </a>.
        </p>
      ) : null}

      {redirectUri ? (
        <div>
          <p><span className="font-semibold">2.</span> Déclare cette adresse de retour, au caractère près :</p>
          <CopyLine value={redirectUri} />
        </div>
      ) : null}

      {readiness.scopes?.length ? (
        <p>
          <span className="font-semibold">3.</span> Demande ces autorisations : <span className="break-all font-mono text-[11px]">{readiness.scopes.join(", ")}</span>
        </p>
      ) : null}

      {secrets.length ? (
        <div>
          <p>
            <span className="font-semibold">4.</span> Colle les identifiants obtenus dans{" "}
            <a href={secretsPageUrl()} target="_blank" rel="noreferrer" className="font-medium text-primary">
              les secrets Supabase <ExternalLink className="inline h-3 w-3" />
            </a>, sous ces noms :
          </p>
          {secrets.map((secret) => <CopyLine key={secret} value={secret} />)}
        </div>
      ) : null}

      <p className="text-amber-800">Le bouton Connecter s&apos;active tout seul dès que ces identifiants sont enregistrés.</p>
    </div>
  );
}

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
                    <span className="text-sm font-medium text-amber-800">Configuration à faire</span>
                  )}
                  <Button
                    variant="secondary"
                    disabled={!configured || busy || loading}
                    onClick={() => void connect(provider.id)}
                    title={configured ? undefined : "Disponible une fois l'application développeur créée et ses identifiants renseignés"}
                  >
                    {accounts.length ? <><RefreshCw className="h-4 w-4" />Reconnecter</> : <>Connecter <ExternalLink className="h-4 w-4" /></>}
                  </Button>
                </div>

                {supported && !configured && readiness ? (
                  <SetupGuide card={provider} readiness={readiness} redirectUri={state.redirectUri} />
                ) : null}
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
