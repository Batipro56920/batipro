import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { QuoteDocument } from "../document/QuoteDocument";
import { QuoteHeader } from "./QuoteHeader";
import { QuoteLibrarySidebar } from "../sidebar/QuoteLibrarySidebar";
import { QuoteTotalsPanel } from "../totals/QuoteTotalsPanel";
import { QuoteOptionsDialog } from "../dialogs/QuoteOptionsDialog";
import { QuotePreview } from "../document/QuotePreview";
import type { QuoteAccountOption, QuoteProjectOption } from "../../domain/Quote";
import type { TaskTemplateRow } from "../../../../services/taskLibrary.service";

type Props = {
  templates: TaskTemplateRow[];
  clients: QuoteAccountOption[];
  prospects: QuoteAccountOption[];
  projects: QuoteProjectOption[];
  saving: boolean;
  onSave: () => void;
  onSend: () => void;
  onClose: () => void;
};

export function QuoteWorkspace({ templates, clients, prospects, projects, saving, onSave, onSend, onClose }: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <div className="-m-4 min-h-[calc(100vh-2rem)] bg-slate-100 lg:-m-6">
      <QuoteHeader mode={mode} onModeChange={setMode} onSave={onSave} onSend={onSend} onClose={onClose} onOptions={() => setOptionsOpen((value) => !value)} saving={saving} />
      {optionsOpen ? <div className="absolute right-4 top-24 z-40"><QuoteOptionsDialog onClose={() => setOptionsOpen(false)} /></div> : null}
      <Group orientation="horizontal" className="min-h-[calc(100vh-5rem)]">
        <Panel defaultSize={20} minSize={14}>
          <QuoteLibrarySidebar templates={templates} />
        </Panel>
        <Separator className="w-1 bg-slate-200 hover:bg-blue-300" />
        <Panel defaultSize={58} minSize={35}>
          {mode === "edit" ? <QuoteDocument clients={clients} prospects={prospects} projects={projects} /> : <QuotePreview />}
        </Panel>
        <Separator className="w-1 bg-slate-200 hover:bg-blue-300" />
        <Panel defaultSize={22} minSize={16}>
          <QuoteTotalsPanel />
        </Panel>
      </Group>
    </div>
  );
}
