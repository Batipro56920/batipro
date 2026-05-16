import type { ChantierActivityLogRow } from "../../../services/chantierActivityLog.service";

export default function ChantierJournalSection({
  logs,
  loading,
  error,
  schemaReady,
  onRefresh,
  entityLabel,
  actionLabel,
  tone,
}: {
  logs: ChantierActivityLogRow[];
  loading: boolean;
  error: string | null;
  schemaReady: boolean;
  onRefresh: () => void | Promise<void>;
  entityLabel: (entityType: string) => string;
  actionLabel: (actionType: string) => string;
  tone: (entityType: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold section-title">Journal chantier</div>
          <div className="text-sm text-slate-500">
            Historique des actions, validations, consignes, réserves et temps saisis.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Chargement..." : "Rafraîchir"}
        </button>
      </div>

      {!schemaReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Migration journal non appliquée : le tableau reste vide tant que
          `20260402100000_batipro_v2_foundation_prepare_control_pilot.sql` n’est pas poussée sur Supabase.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Chargement du journal...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Aucun événement journalisé pour ce chantier.
          </div>
        ) : (
          logs.map((log) => (
            <article key={log.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className={["rounded-full border px-3 py-1 text-xs font-semibold", tone(log.entity_type)].join(" ")}>
                      {entityLabel(log.entity_type)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {actionLabel(log.action_type)}
                    </span>
                  </div>
                  <div className="mt-3 text-base font-semibold text-slate-900">
                    {log.reason || "Action chantier"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span>{log.actor_name || "Utilisateur"}</span>
                    {log.actor_role ? <span>{log.actor_role}</span> : null}
                    <span>{new Date(log.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                </div>
              </div>

              {Object.keys(log.changes || {}).length > 0 ? (
                <pre className="mt-4 max-h-64 overflow-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs leading-relaxed text-slate-100">
                  {JSON.stringify(log.changes, null, 2)}
                </pre>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

