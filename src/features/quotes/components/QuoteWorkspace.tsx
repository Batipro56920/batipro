import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";
import { QuoteDocumentEditor } from "./QuoteDocumentEditor";
import { QuoteHeader } from "./QuoteHeader";
import { QuoteLibraryPanel } from "./QuoteLibraryPanel";
import { QuoteOptionsMenu } from "./QuoteOptionsMenu";
import { QuotePdfPreview } from "./QuotePdfPreview";
import { QuoteTotalsPanel } from "./QuoteTotalsPanel";
import type { QuoteAccountOption, QuoteChantierOption } from "../types";

type Props = {
  templates: TaskTemplateRow[];
  clients: QuoteAccountOption[];
  prospects: QuoteAccountOption[];
  chantiers: QuoteChantierOption[];
  saving?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  onSend?: () => void;
  onInsertTemplate: (template: TaskTemplateRow) => void;
};

export function QuoteWorkspace({ templates, clients, prospects, chantiers, saving = false, onClose, onCancel, onSave, onSend, onInsertTemplate }: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <div className="-m-4 min-h-[calc(100vh-2rem)] bg-slate-100 lg:-m-6">
      <QuoteHeader
        mode={mode}
        saving={saving}
        onClose={onClose}
        onCancel={onCancel}
        onModeChange={setMode}
        onSave={onSave}
        onSend={onSend}
        onToggleOptions={() => setOptionsOpen((value) => !value)}
      />
      {optionsOpen ? <div className="absolute right-4 top-24 z-40 w-80"><QuoteOptionsMenu /></div> : null}
      <Group orientation="horizontal" className="min-h-[calc(100vh-5rem)]">
        <Panel defaultSize={20} minSize={14}>
          <QuoteLibraryPanel templates={templates} onInsertTemplate={onInsertTemplate} />
        </Panel>
        <Separator className="w-1 bg-slate-200 hover:bg-blue-300" />
        <Panel defaultSize={58} minSize={35}>
          {mode === "edit" ? <QuoteDocumentEditor clients={clients} prospects={prospects} chantiers={chantiers} /> : <QuotePdfPreview />}
        </Panel>
        <Separator className="w-1 bg-slate-200 hover:bg-blue-300" />
        <Panel defaultSize={22} minSize={16}>
          <QuoteTotalsPanel />
        </Panel>
      </Group>
    </div>
  );
}
