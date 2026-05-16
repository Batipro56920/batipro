import { DndContext } from "@dnd-kit/core";
import { QuoteMetaForm } from "./QuoteMetaForm";
import { QuoteVirtualNodeList } from "./QuoteVirtualNodeList";
import { QuoteNodeToolbar } from "../toolbars/QuoteNodeToolbar";
import { QuoteTextsPanel } from "./QuoteTextsPanel";
import type { QuoteAccountOption, QuoteProjectOption } from "../../domain/Quote";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import type { QuoteLibraryItem } from "../../domain/QuoteLibrary";

type Props = {
  clients: QuoteAccountOption[];
  prospects: QuoteAccountOption[];
  projects: QuoteProjectOption[];
};

export function QuoteDocument({ clients, prospects, projects }: Props) {
  const { addLibraryItem } = useQuoteActions();

  function onDrop(event: React.DragEvent<HTMLElement>) {
    const payload = event.dataTransfer.getData("application/x-batipro-quote-library-item");
    if (!payload) return;
    event.preventDefault();
    addLibraryItem(JSON.parse(payload) as QuoteLibraryItem);
  }

  return (
    <DndContext>
      <section className="mx-auto max-w-6xl space-y-4 p-4" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <QuoteMetaForm clients={clients} prospects={prospects} projects={projects} />
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <QuoteNodeToolbar />
          <div className="mt-4">
            <QuoteVirtualNodeList />
          </div>
        </div>
        <QuoteTextsPanel />
      </section>
    </DndContext>
  );
}
