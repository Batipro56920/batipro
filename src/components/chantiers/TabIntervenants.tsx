import React from "react";
import type { IntervenantRow } from "../../services/intervenants.service";

type Props = {
  intervenants: IntervenantRow[];
  intervenantsLoading: boolean;
  intervenantsError: string | null;

  refreshIntervenants: () => Promise<void>;

  creatingIntervenant: boolean;
  newIntervenantNom: string;
  newIntervenantEmail: string;
  newIntervenantTel: string;
  setNewIntervenantNom: (v: string) => void;
  setNewIntervenantEmail: (v: string) => void;
  setNewIntervenantTel: (v: string) => void;
  onCreateIntervenantFromTab: (e: React.FormEvent) => Promise<void>;

  sendingAccessId: string | null;
  onSendAccess: (i: IntervenantRow) => Promise<void>;

  accessUrlByIntervenant: Record<string, string>;
  copyToClipboard: (text: string) => Promise<void>;

  startEditIntervenant: (i: IntervenantRow) => void;
  onDeleteIntervenant: (i: IntervenantRow) => Promise<void>;
};

export default function TabIntervenants(props: Props) {
  const {
    intervenants,
    intervenantsLoading,
    intervenantsError,
    refreshIntervenants,

    creatingIntervenant,
    newIntervenantNom,
    newIntervenantEmail,
    newIntervenantTel,
    setNewIntervenantNom,
    setNewIntervenantEmail,
    setNewIntervenantTel,
    onCreateIntervenantFromTab,

    sendingAccessId,
    onSendAccess,
    accessUrlByIntervenant,
    copyToClipboard,

    startEditIntervenant,
    onDeleteIntervenant,
  } = props;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Intervenants</div>
          <div className="text-sm text-slate-500">
            Créer, modifier et gérer l’accès au portail chantier
          </div>
        </div>
        <button
          type="button"
          onClick={refreshIntervenants}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
          disabled={intervenantsLoading}
        >
          {intervenantsLoading ? "Chargement…" : "Rafraîchir"}
        </button>
      </div>

      {intervenantsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {intervenantsError}
        </div>
      )}

      <form onSubmit={onCreateIntervenantFromTab} className="rounded-xl border bg-slate-50 p-4 space-y-3">
        <div className="font-semibold text-sm">Ajouter un intervenant</div>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="Nom (ex: Pierre — Plombier)"
            value={newIntervenantNom}
            onChange={(e) => setNewIntervenantNom(e.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="Email (optionnel)"
            value={newIntervenantEmail}
            onChange={(e) => setNewIntervenantEmail(e.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="Téléphone (optionnel)"
            value={newIntervenantTel}
            onChange={(e) => setNewIntervenantTel(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creatingIntervenant}
            className={[
              "rounded-xl px-4 py-2 text-sm",
              creatingIntervenant ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
            ].join(" ")}
          >
            {creatingIntervenant ? "Création…" : "+ Ajouter"}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {intervenantsLoading ? (
          <div className="text-sm text-slate-500">Chargement…</div>
        ) : intervenants.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun intervenant pour le moment.</div>
        ) : (
          intervenants.map((i) => {
            const accessUrl = accessUrlByIntervenant[i.id] ?? "";
            return (
              <div key={i.id} className="rounded-xl border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{i.nom}</div>
                    <div className="text-xs text-slate-500">
                      {(i.email ?? "—")} • {(i.telephone ?? "—")}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSendAccess(i)}
                      disabled={sendingAccessId === i.id}
                      className={[
                        "text-sm rounded-xl border px-3 py-2",
                        sendingAccessId === i.id ? "bg-slate-100 text-slate-500" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {sendingAccessId === i.id ? "Envoi…" : "Envoyer accès"}
                    </button>

                    <button
                      type="button"
                      onClick={() => startEditIntervenant(i)}
                      className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                    >
                      Modifier
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteIntervenant(i)}
                      className="text-sm rounded-xl border border-red-200 text-red-700 px-3 py-2 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {accessUrl ? (
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <div className="text-xs text-slate-600 mb-2">Lien d’accès</div>
                    <div className="text-xs font-mono break-all">{accessUrl}</div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="text-sm rounded-xl border px-3 py-2 hover:bg-white"
                        onClick={() => copyToClipboard(accessUrl)}
                      >
                        Copier le lien
                      </button>
                      <a href={accessUrl} target="_blank" rel="noreferrer">
                        <button type="button" className="text-sm rounded-xl border px-3 py-2 hover:bg-white">
                          Ouvrir
                        </button>
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
