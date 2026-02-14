import { useEffect, useMemo, useState } from "react";
import type { TaskTemplateInput, TaskTemplateRow } from "../services/taskTemplates.service";

type Props = {
  open: boolean;
  template: TaskTemplateRow | null;
  initialValues?: TaskTemplateInput | null;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: TaskTemplateInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function toField(value: number | null): string {
  if (value === null || value === undefined) return "";
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

export default function TaskTemplateDrawer({
  open,
  template,
  initialValues = null,
  saving,
  deleting,
  error,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [titre, setTitre] = useState("");
  const [lot, setLot] = useState("");
  const [unite, setUnite] = useState("");
  const [quantiteDefaut, setQuantiteDefaut] = useState("");
  const [tempsParUnite, setTempsParUnite] = useState("");
  const [remarques, setRemarques] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setTitre(template.titre ?? "");
      setLot(template.lot ?? "");
      setUnite(template.unite ?? "");
      setQuantiteDefaut(toField(template.quantite_defaut ?? null));
      setTempsParUnite(toField(template.temps_prevu_par_unite_h ?? null));
      setRemarques(template.remarques ?? "");
    } else {
      setTitre(initialValues?.titre ?? "");
      setLot(initialValues?.lot ?? "");
      setUnite(initialValues?.unite ?? "");
      setQuantiteDefaut(toField(initialValues?.quantite_defaut ?? null));
      setTempsParUnite(toField(initialValues?.temps_prevu_par_unite_h ?? null));
      setRemarques(initialValues?.remarques ?? "");
    }
    setLocalError(null);
  }, [
    open,
    template?.id,
    initialValues?.titre,
    initialValues?.lot,
    initialValues?.unite,
    initialValues?.quantite_defaut,
    initialValues?.temps_prevu_par_unite_h,
    initialValues?.remarques,
  ]);

  const busy = saving || deleting;
  const title = useMemo(() => (template ? "Modifier template" : "Nouveau template"), [template]);

  if (!open) return null;

  async function handleSave() {
    setLocalError(null);
    if (!titre.trim()) {
      setLocalError("Le titre est obligatoire.");
      return;
    }
    const payload: TaskTemplateInput = {
      titre: titre.trim(),
      lot: lot.trim() || null,
      unite: unite.trim() || null,
      quantite_defaut: quantiteDefaut.trim() === "" ? null : Number(quantiteDefaut),
      temps_prevu_par_unite_h: tempsParUnite.trim() === "" ? null : Number(tempsParUnite),
      remarques: remarques.trim() || null,
    };
    if (
      payload.quantite_defaut !== null &&
      payload.quantite_defaut !== undefined &&
      Number.isNaN(payload.quantite_defaut)
    ) {
      setLocalError("Quantité défaut invalide.");
      return;
    }
    if (
      payload.temps_prevu_par_unite_h !== null &&
      payload.temps_prevu_par_unite_h !== undefined &&
      Number.isNaN(payload.temps_prevu_par_unite_h)
    ) {
      setLocalError("Temps/unité invalide.");
      return;
    }
    await onSave(payload);
  }

  async function handleDelete() {
    if (!template?.id) return;
    const ok = window.confirm(`Supprimer le template "${template.titre}" ?`);
    if (!ok) return;
    await onDelete(template.id);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-screen w-[46vw] max-w-[860px] min-w-[360px] bg-white border-l shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold truncate">{title}</div>
          <button
            type="button"
            className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
            onClick={onClose}
            disabled={busy}
          >
            X
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <label className="block space-y-1">
            <div className="text-xs text-slate-600">Titre *</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Pose plinthes MDF"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">Lot</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                placeholder="Ex: Peinture"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">Unité</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                placeholder="Ex: m2"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">Qté défaut</div>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={quantiteDefaut}
                onChange={(e) => setQuantiteDefaut(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">Temps/unité (h)</div>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={tempsParUnite}
                onChange={(e) => setTempsParUnite(e.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <div className="text-xs text-slate-600">Remarques</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-28"
              value={remarques}
              onChange={(e) => setRemarques(e.target.value)}
            />
          </label>

          {(localError || error) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {localError ?? error}
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-between gap-2">
          <button
            type="button"
            className="rounded-xl border border-red-200 text-red-700 px-3 py-2 text-sm hover:bg-red-50"
            onClick={handleDelete}
            disabled={busy || !template}
          >
            {deleting ? "Suppression..." : "Supprimer"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={onClose}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              type="button"
              className={[
                "rounded-xl px-4 py-2 text-sm",
                busy ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
              ].join(" ")}
              onClick={handleSave}
              disabled={busy}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
