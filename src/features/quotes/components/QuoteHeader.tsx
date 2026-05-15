import { Send, Settings, X } from "lucide-react";
import { useQuoteStore } from "../store/quoteStore";

type Props = {
  mode: "edit" | "preview";
  saving?: boolean;
  onClose?: () => void;
  onModeChange: (mode: "edit" | "preview") => void;
  onSave?: () => void;
  onSend?: () => void;
  onToggleOptions?: () => void;
};

export function QuoteHeader({ mode, saving = false, onClose, onModeChange, onSave, onSend, onToggleOptions }: Props) {
  const { draft, dirty, markSaved } = useQuoteStore();
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Devis BTP</div>
          <h1 className="text-lg font-semibold text-slate-950">Devis n° {draft.quoteNumber}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border px-3 py-1 text-xs text-slate-600">
            {dirty ? "Modifications non sauvegardees" : "Enregistre"}
          </span>
          <button className={mode === "edit" ? activeButton : neutralButton} onClick={() => onModeChange("edit")}>
            Edition
          </button>
          <button className={mode === "preview" ? activeButton : neutralButton} onClick={() => onModeChange("preview")}>
            Previsualisation
          </button>
          <button className={neutralButton} onClick={onToggleOptions}>
            <Settings className="mr-2 inline h-4 w-4" />
            Options
          </button>
          <button className={neutralButton}>Annuler</button>
          <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60" disabled={saving} onClick={onSave ?? markSaved}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800" onClick={onSend}>
            <Send className="mr-2 inline h-4 w-4" />
            Envoyer
          </button>
          <button className={neutralButton} onClick={onClose}>
            <X className="mr-2 inline h-4 w-4" />
            Fermer
          </button>
        </div>
      </div>
    </header>
  );
}

const neutralButton = "rounded-xl border px-3 py-2 text-sm hover:bg-slate-50";
const activeButton = "rounded-xl bg-slate-900 px-3 py-2 text-sm text-white";
