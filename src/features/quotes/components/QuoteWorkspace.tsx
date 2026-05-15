import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { QuoteDocumentEditor } from "./QuoteDocumentEditor";
import { QuoteHeader } from "./QuoteHeader";
import { QuoteLibraryPanel } from "./QuoteLibraryPanel";
import { QuoteOptionsMenu } from "./QuoteOptionsMenu";
import { QuotePdfPreview } from "./QuotePdfPreview";
import { QuoteTotalsPanel } from "./QuoteTotalsPanel";

export function QuoteWorkspace() {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <QuoteHeader onToggleOptions={() => setOptionsOpen((value) => !value)} />
      <div className="flex gap-2 border-b bg-white px-4 py-2">
        <button className={mode === "edit" ? "rounded-xl bg-slate-900 px-3 py-2 text-sm text-white" : "rounded-xl border px-3 py-2 text-sm"} onClick={() => setMode("edit")}>
          Edition
        </button>
        <button className={mode === "preview" ? "rounded-xl bg-slate-900 px-3 py-2 text-sm text-white" : "rounded-xl border px-3 py-2 text-sm"} onClick={() => setMode("preview")}>
          Previsualisation
        </button>
      </div>
      {optionsOpen ? <div className="absolute right-4 top-24 z-20 w-80"><QuoteOptionsMenu /></div> : null}
      <Group orientation="horizontal" className="min-h-[calc(100vh-7rem)]">
        <Panel defaultSize={20} minSize={14}>
          <QuoteLibraryPanel />
        </Panel>
        <Separator className="w-1 bg-slate-200 hover:bg-blue-300" />
        <Panel defaultSize={58} minSize={35}>
          {mode === "edit" ? <QuoteDocumentEditor /> : <QuotePdfPreview />}
        </Panel>
        <Separator className="w-1 bg-slate-200 hover:bg-blue-300" />
        <Panel defaultSize={22} minSize={16}>
          <QuoteTotalsPanel />
        </Panel>
      </Group>
    </div>
  );
}
