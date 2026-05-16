import { Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import type { QuoteLineKind, QuoteNodeType } from "../../domain/QuoteEnums";
import { CompositeQuoteDialog } from "../dialogs/CompositeQuoteDialog";
import { useState } from "react";
import type { QuoteCompositeNode } from "../../domain/QuoteLine";
import { useQuoteStore } from "../../store/quoteStore";

const actions: Array<{ label: string; type: QuoteNodeType; kind?: QuoteLineKind }> = [
  { label: "Section", type: "section" },
  { label: "Sous-section", type: "subsection" },
  { label: "Fourniture", type: "line", kind: "fourniture" },
  { label: "Main-d'oeuvre", type: "line", kind: "main_oeuvre" },
  { label: "Texte", type: "text" },
  { label: "Saut de page", type: "pagebreak" },
];

export function QuoteNodeToolbar() {
  const { addNode, updateComposite } = useQuoteActions();
  const quote = useQuoteStore((state) => state.quote);
  const [draftCompositeId, setDraftCompositeId] = useState<string | null>(null);
  const draftComposite = draftCompositeId ? findComposite(quote.nodes, draftCompositeId) : null;

  function createComposite() {
    const beforeIds = new Set(quote.nodes.map((node) => node.id));
    addNode("composite");
    window.setTimeout(() => {
      const next = useQuoteStore.getState().quote.nodes.find((node) => !beforeIds.has(node.id) && node.type === "composite");
      if (next?.type === "composite") setDraftCompositeId(next.id);
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={`${action.type}-${action.kind ?? "default"}`} variant="secondary" onClick={() => addNode(action.type, null, action.kind)}>
            <Plus className="mr-1 h-4 w-4" />
            {action.label}
          </Button>
        ))}
        <Button variant="secondary" onClick={createComposite}>
          <Plus className="mr-1 h-4 w-4" />
          Ouvrage
        </Button>
      </div>
      {draftComposite ? (
        <CompositeQuoteDialog
          node={draftComposite}
          onClose={() => setDraftCompositeId(null)}
          onSave={(node) => {
            updateComposite(node.id, () => node);
            setDraftCompositeId(null);
          }}
        />
      ) : null}
    </>
  );
}

function findComposite(nodes: any[], id: string): QuoteCompositeNode | null {
  for (const node of nodes) {
    if (node.id === id && node.type === "composite") return node;
    if ((node.type === "section" || node.type === "subsection") && Array.isArray(node.children)) {
      const found = findComposite(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
