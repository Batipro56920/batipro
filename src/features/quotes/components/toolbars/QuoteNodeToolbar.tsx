import { Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import type { QuoteLineKind, QuoteNodeType } from "../../domain/QuoteEnums";

const actions: Array<{ label: string; type: QuoteNodeType; kind?: QuoteLineKind }> = [
  { label: "Section", type: "section" },
  { label: "Sous-section", type: "subsection" },
  { label: "Fourniture", type: "line", kind: "fourniture" },
  { label: "Main-d'oeuvre", type: "line", kind: "main_oeuvre" },
  { label: "Ouvrage", type: "composite" },
  { label: "Texte", type: "text" },
  { label: "Saut de page", type: "pagebreak" },
];

export function QuoteNodeToolbar() {
  const { addNode } = useQuoteActions();
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={`${action.type}-${action.kind ?? "default"}`} variant="secondary" onClick={() => addNode(action.type, null, action.kind)}>
          <Plus className="mr-1 h-4 w-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
