import { Send, Settings, X } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { useQuoteStore } from "../../store/quoteStore";

type Props = {
  mode: "edit" | "preview";
  onModeChange: (mode: "edit" | "preview") => void;
  onSave: () => void;
  onSend: () => void;
  onClose: () => void;
  onOptions: () => void;
  saving: boolean;
};

export function QuoteHeader({ mode, onModeChange, onSave, onSend, onClose, onOptions, saving }: Props) {
  const number = useQuoteStore((state) => state.quote.number);
  const status = useQuoteStore((state) => state.quote.status);
  const saveState = useQuoteStore((state) => state.saveState);

  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Devis BTP</div>
          <h1 className="text-lg font-semibold text-slate-950">Devis n° {number}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border px-3 py-1 text-xs text-slate-600">{statusLabel(status)} - {saveStateLabel(saveState)}</span>
          <Button variant={mode === "edit" ? "default" : "secondary"} onClick={() => onModeChange("edit")}>Edition</Button>
          <Button variant={mode === "preview" ? "default" : "secondary"} onClick={() => onModeChange("preview")}>Previsualisation</Button>
          <Button variant="secondary" onClick={onOptions}><Settings className="mr-2 h-4 w-4" />Options</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          <Button variant="secondary" onClick={onSend}><Send className="mr-2 h-4 w-4" />Envoyer</Button>
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" />Fermer</Button>
        </div>
      </div>
    </header>
  );
}

function statusLabel(status: string) {
  return status === "sent" ? "Envoye" : status === "signed" ? "Signe" : status === "refused" ? "Refuse" : "Brouillon";
}

function saveStateLabel(state: string) {
  return state === "dirty" ? "non sauvegarde" : state === "saving" ? "sauvegarde..." : state === "error" ? "erreur" : "sauvegarde";
}
