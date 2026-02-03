import type { IntervenantRow } from "../../services/intervenants.service";

type Props = {
  editingIntervenant: IntervenantRow | null;
  savingIntervenant: boolean;

  editIntervenantNom: string;
  editIntervenantEmail: string;
  editIntervenantTel: string;

  setEditIntervenantNom: (v: string) => void;
  setEditIntervenantEmail: (v: string) => void;
  setEditIntervenantTel: (v: string) => void;

  onCancel: () => void;
  onSave: () => Promise<void> | void;
};

export default function EditIntervenantModal(props: Props) {
  const {
    editingIntervenant,
    savingIntervenant,
    editIntervenantNom,
    editIntervenantEmail,
    editIntervenantTel,
    setEditIntervenantNom,
    setEditIntervenantEmail,
    setEditIntervenantTel,
    onCancel,
    onSave,
  } = props;

  if (!editingIntervenant) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={() => {
        if (!savingIntervenant) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white border p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold">Modifier intervenant</div>
          <button
            type="button"
            className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
            onClick={onCancel}
            disabled={savingIntervenant}
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Nom</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={editIntervenantNom}
              onChange={(e) => setEditIntervenantNom(e.target.value)}
              placeholder="Nom"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-600">Email</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={editIntervenantEmail}
              onChange={(e) => setEditIntervenantEmail(e.target.value)}
              placeholder="Email (optionnel)"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-600">Téléphone</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={editIntervenantTel}
              onChange={(e) => setEditIntervenantTel(e.target.value)}
              placeholder="Téléphone (optionnel)"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
            onClick={onCancel}
            disabled={savingIntervenant}
          >
            Annuler
          </button>
          <button
            type="button"
            className={[
              "rounded-xl px-4 py-2 text-sm",
              savingIntervenant ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
            ].join(" ")}
            onClick={onSave}
            disabled={savingIntervenant}
          >
            {savingIntervenant ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
