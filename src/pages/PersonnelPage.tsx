import { useEffect, useState, type FormEvent } from "react";
import {
  SIDEBAR_GROUPS,
  generateBackofficeAccount,
  listBackofficeAccounts,
  resetBackofficeAccountPassword,
  setBackofficeAccountAllowedGroups,
  type BackofficeAccount,
} from "../services/backofficeAccounts.service";

function GroupCheckboxes({
  value,
  onChange,
  disabled,
}: {
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
}) {
  const allSelected = value === null;

  function toggleGroup(group: string) {
    const current = value ?? [];
    const next = current.includes(group) ? current.filter((entry) => entry !== group) : [...current, group];
    onChange(next.length > 0 ? next : []);
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allSelected}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? null : [...SIDEBAR_GROUPS])}
        />
        <span className="font-medium text-slate-900">Accès complet (toutes catégories)</span>
      </label>
      <div className="grid grid-cols-2 gap-1.5 pl-6">
        {SIDEBAR_GROUPS.map((group) => (
          <label key={group} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={disabled || allSelected}
              checked={allSelected || (value ?? []).includes(group)}
              onChange={() => toggleGroup(group)}
            />
            {group}
          </label>
        ))}
      </div>
    </div>
  );
}

function AccountRow({ account, onUpdated }: { account: BackofficeAccount; onUpdated: (next: BackofficeAccount) => void }) {
  const [groups, setGroups] = useState<string[] | null>(account.allowedSidebarGroups);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  const isAdmin = account.role === "ADMIN";
  const dirty = JSON.stringify(groups) !== JSON.stringify(account.allowedSidebarGroups);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await setBackofficeAccountAllowedGroups(account.id, groups);
      onUpdated({ ...account, allowedSidebarGroups: groups });
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function onResetPassword() {
    setResetting(true);
    setError(null);
    setResetResult(null);
    try {
      const { accessUrl } = await resetBackofficeAccountPassword(account.id);
      setResetResult(accessUrl);
      if (accessUrl) await navigator.clipboard.writeText(accessUrl).catch(() => undefined);
    } catch (err: any) {
      setError(err?.message ?? "Réinitialisation impossible.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{account.displayName || account.email || account.id}</div>
          <div className="text-xs text-slate-500">{account.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{account.role}</span>
          <button
            type="button"
            onClick={() => void onResetPassword()}
            disabled={resetting}
            className="text-xs font-semibold text-slate-500 underline decoration-dotted hover:text-slate-900 disabled:opacity-50"
          >
            {resetting ? "Génération..." : "Réinitialiser le mot de passe"}
          </button>
        </div>
      </div>

      {resetResult ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Nouveau mot de passe copié dans le presse-papiers :
          <pre className="mt-1 whitespace-pre-wrap">{resetResult}</pre>
        </div>
      ) : null}

      {isAdmin ? (
        <p className="mt-3 text-xs text-slate-500">Compte administrateur : accès complet, non modifiable ici.</p>
      ) : (
        <div className="mt-3">
          <GroupCheckboxes value={groups} onChange={setGroups} disabled={saving} />
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !dirty}
            className="mt-3 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Enregistrement..." : "Enregistrer les accès"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PersonnelPage() {
  const [accounts, setAccounts] = useState<BackofficeAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteGroups, setInviteGroups] = useState<string[] | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await listBackofficeAccounts();
      setAccounts(data);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message ?? "Impossible de charger les comptes.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const result = await generateBackofficeAccount({ email, displayName, allowedSidebarGroups: inviteGroups });
      const accessUrl = String(result?.accessUrl ?? "");
      setInviteResult(accessUrl);
      if (accessUrl) await navigator.clipboard.writeText(accessUrl).catch(() => undefined);
      setEmail("");
      setDisplayName("");
      setInviteGroups(null);
      await refresh();
    } catch (err: any) {
      setInviteError(err?.message ?? "Création du compte impossible.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Personnel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Comptes bureau (même interface que l'administrateur, accès limité aux catégories cochées). Pour les ouvriers de
          chantier, utilise « Profils &amp; accès ».
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Inviter une personne</h2>
        <form onSubmit={onInvite} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">E-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Nom affiché</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <GroupCheckboxes value={inviteGroups} onChange={setInviteGroups} disabled={inviting} />
          {inviteError ? <p className="text-xs text-red-600">{inviteError}</p> : null}
          {inviteResult ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              Compte créé et identifiants copiés dans le presse-papiers :
              <pre className="mt-1 whitespace-pre-wrap">{inviteResult}</pre>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={inviting}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {inviting ? "Création..." : "Créer le compte"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Comptes existants</h2>
        {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}
        {!accounts && !loadError ? <p className="text-sm text-slate-500">Chargement...</p> : null}
        {accounts?.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onUpdated={(next) => setAccounts((prev) => (prev ? prev.map((entry) => (entry.id === next.id ? next : entry)) : prev))}
          />
        ))}
      </section>
    </div>
  );
}
