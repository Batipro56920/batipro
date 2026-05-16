import { lazy, Suspense, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { List } from "react-window";
import { getCoreRowModel, useReactTable, type ColumnDef, flexRender } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input, Textarea } from "../../../../components/ui/input";
import { numberQuoteNodes, type NumberedQuoteNode } from "../../application/quoteNumbering";
import { flattenQuoteNodes, getNodeSellHt } from "../../application/quoteCalculations";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import { useQuoteStore } from "../../store/quoteStore";
import { QUOTE_VAT_RATES, type QuoteVatRate } from "../../domain/QuoteEnums";
import type { QuoteNode } from "../../domain/QuoteSection";
import { CompositeQuoteDialog } from "../dialogs/CompositeQuoteDialog";
import type { QuoteCompositeNode } from "../../domain/QuoteLine";
import { calculateCompositeSummary } from "../../application/quoteCompositeEngine";

const QuoteRichTextField = lazy(() => import("./QuoteRichTextField").then((module) => ({ default: module.QuoteRichTextField })));

type RowProps = {
  rows: NumberedQuoteNode[];
  collapsed: string[];
  activeNodeId: string | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
};

const columns: Array<ColumnDef<NumberedQuoteNode>> = [
  { id: "number", header: "N" },
  { id: "title", header: "Designation" },
  { id: "quantity", header: "Qte" },
  { id: "unit", header: "Unite" },
  { id: "price", header: "PU HT" },
  { id: "vat", header: "TVA" },
  { id: "total", header: "Total HT" },
  { id: "actions", header: "" },
];

export function QuoteVirtualNodeList() {
  const nodes = useQuoteStore((state) => state.quote.nodes);
  const activeNodeId = useQuoteStore((state) => state.activeNodeId);
  const setActiveNode = useQuoteStore((state) => state.setActiveNode);
  const moveNodeBefore = useQuoteStore((state) => state.moveNodeBefore);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const numberedRows = useMemo(() => numberQuoteNodes(nodes), [nodes]);
  const rows = useMemo(() => filterCollapsedRows(numberedRows, new Set(collapsed)), [numberedRows, collapsed]);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  function toggleCollapse(id: string) {
    setCollapsed((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (overId && activeId !== overId) moveNodeBefore(activeId, overId);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-blue-500 text-white">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 text-left font-medium">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        </table>
        <List
          rowComponent={QuoteNodeRow as any}
          rowCount={rows.length}
          rowHeight={(index, props) => rowHeight(props.rows[index])}
          rowProps={{ rows, collapsed, activeNodeId, onSelect: setActiveNode, onToggleCollapse: toggleCollapse }}
          overscanCount={10}
          className="h-[34rem]"
        />
        {!rows.length ? <div className="p-8 text-center text-sm text-slate-500">Ajoutez une section ou une ligne pour demarrer le devis.</div> : null}
      </div>
    </DndContext>
  );
}

function QuoteNodeRow({ index, style, rows, collapsed, activeNodeId, onSelect, onToggleCollapse }: { index: number; style: React.CSSProperties } & RowProps) {
  const row = rows[index];
  const { updateNode, removeNode, moveNode, duplicateNode } = useQuoteActions();
  const updateComposite = useQuoteStore((state) => state.updateComposite);
  const settings = useQuoteStore((state) => state.quote.settings);
  const draggable = useDraggable({ id: row?.id ?? `row-${index}` });
  const droppable = useDroppable({ id: row?.id ?? `drop-${index}` });
  const [menuOpen, setMenuOpen] = useState(false);
  const [compositeOpen, setCompositeOpen] = useState(false);
  if (!row) return null;

  const dragStyle = {
    ...style,
    transform: CSS.Translate.toString(draggable.transform),
    opacity: draggable.isDragging ? 0.55 : 1,
  };
  const isActive = activeNodeId === row.id;

  function bindRefs(element: HTMLDivElement | null) {
    draggable.setNodeRef(element);
    droppable.setNodeRef(element);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Delete") removeNode(row.id);
    if (event.altKey && event.key === "ArrowUp") moveNode(row.id, -1);
    if (event.altKey && event.key === "ArrowDown") moveNode(row.id, 1);
  }

  if (row.type === "section") {
    const isCollapsed = collapsed.includes(row.id);
    const subtotal = calculateSubtotal(row.children);
    return (
      <div ref={bindRefs} style={dragStyle} tabIndex={0} onClick={() => onSelect(row.id)} onKeyDown={handleKeyDown} onContextMenu={(event) => openMenu(event, setMenuOpen)} className={`grid grid-cols-[2.5rem_4rem_1fr_12rem_7rem] items-center border-t px-3 ${isActive ? "bg-blue-200" : "bg-blue-100"} text-slate-950`}>
        <DragHandle attributes={draggable.attributes} listeners={draggable.listeners} />
        <button className="flex items-center gap-1 font-semibold" onClick={() => onToggleCollapse(row.id)}>{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{row.number}</button>
        <Input className="border-transparent bg-transparent text-base font-semibold focus:border-blue-300" value={row.title} onChange={(event) => updateNode(row.id, { title: event.target.value } as Partial<QuoteNode>)} />
        <div className="text-right text-sm font-semibold">{settings.hideSectionTotals ? null : `Sous-total : ${money(subtotal)}`}</div>
        <Actions id={row.id} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMove={moveNode} onDelete={removeNode} onDuplicate={duplicateNode} />
      </div>
    );
  }

  if (row.type === "subsection") {
    const isCollapsed = collapsed.includes(row.id);
    const subtotal = calculateSubtotal(row.children);
    return (
      <div ref={bindRefs} style={dragStyle} tabIndex={0} onClick={() => onSelect(row.id)} onKeyDown={handleKeyDown} onContextMenu={(event) => openMenu(event, setMenuOpen)} className={`grid grid-cols-[2.5rem_4rem_1fr_12rem_7rem] items-center border-t px-3 ${isActive ? "bg-slate-200" : "bg-slate-100"}`}>
        <DragHandle attributes={draggable.attributes} listeners={draggable.listeners} />
        <button className="flex items-center gap-1 font-medium text-slate-500" onClick={() => onToggleCollapse(row.id)}>{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{row.number}</button>
        <Input className="border-transparent bg-transparent font-semibold focus:border-slate-200" value={row.title} onChange={(event) => updateNode(row.id, { title: event.target.value } as Partial<QuoteNode>)} />
        <div className="text-right text-sm font-semibold text-slate-600">{settings.hideSectionTotals ? null : `Sous-total : ${money(subtotal)}`}</div>
        <Actions id={row.id} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMove={moveNode} onDelete={removeNode} onDuplicate={duplicateNode} />
      </div>
    );
  }

  if (row.type === "text") {
    return (
      <div ref={bindRefs} style={dragStyle} tabIndex={0} onClick={() => onSelect(row.id)} onKeyDown={handleKeyDown} onContextMenu={(event) => openMenu(event, setMenuOpen)} className={`grid grid-cols-[2.5rem_4rem_1fr_7rem] items-start border-t px-3 py-2 ${isActive ? "bg-blue-50" : ""}`}>
        <DragHandle attributes={draggable.attributes} listeners={draggable.listeners} />
        <div className="pt-2 text-slate-500">{row.number}</div>
        <Suspense fallback={<Textarea className="min-h-24" value={row.content} onChange={(event) => updateNode(row.id, { content: event.target.value, title: event.target.value } as Partial<QuoteNode>)} />}>
          <QuoteRichTextField value={row.content} placeholder="Texte libre dans le devis..." onCommit={(value) => updateNode(row.id, { content: value, title: value } as Partial<QuoteNode>)} />
        </Suspense>
        <Actions id={row.id} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMove={moveNode} onDelete={removeNode} onDuplicate={duplicateNode} />
      </div>
    );
  }

  if (row.type === "pagebreak") {
    return (
      <div ref={bindRefs} style={dragStyle} tabIndex={0} onClick={() => onSelect(row.id)} onKeyDown={handleKeyDown} onContextMenu={(event) => openMenu(event, setMenuOpen)} className={`grid grid-cols-[2.5rem_4rem_1fr_7rem] items-center border-t px-3 ${isActive ? "bg-blue-50" : ""}`}>
        <DragHandle attributes={draggable.attributes} listeners={draggable.listeners} />
        <div className="text-slate-500">{row.number}</div>
        <div className="rounded-xl border border-dashed border-slate-300 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Saut de page</div>
        <Actions id={row.id} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMove={moveNode} onDelete={removeNode} onDuplicate={duplicateNode} />
      </div>
    );
  }

  const isComposite = row.type === "composite";
  const compositeSummary = isComposite ? calculateCompositeSummary(row) : null;
  const saleUnitPriceHt = isComposite ? getNodeSellHt(row) / Math.max(1, row.quantity) : row.saleUnitPriceHt;
  return (
    <>
      <div ref={bindRefs} style={dragStyle} tabIndex={0} onClick={() => onSelect(row.id)} onKeyDown={handleKeyDown} onContextMenu={(event) => openMenu(event, setMenuOpen)} className={`grid grid-cols-[2.5rem_4rem_1fr_5.5rem_4.5rem_6rem_5rem_7rem_7rem] items-center border-t px-3 hover:bg-slate-50 ${isActive ? "bg-blue-50" : ""}`}>
        <DragHandle attributes={draggable.attributes} listeners={draggable.listeners} />
        <div className="text-slate-500">{row.number}</div>
        <div>
          <Input className="border-transparent bg-transparent" value={row.title} onChange={(event) => updateNode(row.id, { title: event.target.value } as Partial<QuoteNode>)} />
          <div className="flex items-center gap-2 px-3 text-[11px] uppercase tracking-[0.12em] text-slate-400">
            <span>{isComposite ? "Ouvrage composite" : row.kind}</span>
            {isComposite ? <button className="text-blue-700 underline" onClick={() => setCompositeOpen(true)}>Configurer</button> : null}
          </div>
        </div>
        {settings.showQuantityColumns ? <NumberInput value={row.quantity} onChange={(quantity) => updateNode(row.id, { quantity } as Partial<QuoteNode>)} /> : <div />}
        {settings.showQuantityColumns ? <Input value={row.unit} onChange={(event) => updateNode(row.id, { unit: event.target.value } as Partial<QuoteNode>)} /> : <div />}
        {!isComposite ? <NumberInput value={saleUnitPriceHt} onChange={(saleUnitPriceHt) => updateNode(row.id, { saleUnitPriceHt } as Partial<QuoteNode>)} /> : <div className="px-3 text-sm text-slate-500">{money(saleUnitPriceHt)}</div>}
        {settings.showVatColumn ? <VatInput value={row.vatRate} onChange={(vatRate) => updateNode(row.id, { vatRate } as Partial<QuoteNode>)} /> : <div />}
        <div className="text-right font-medium">
          {money(getNodeSellHt(row))}
          {compositeSummary ? <span className="block text-xs text-slate-400">Marge {compositeSummary.marginRate}%</span> : null}
        </div>
        <Actions id={row.id} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMove={moveNode} onDelete={removeNode} onDuplicate={duplicateNode} />
      </div>
      {isComposite && compositeOpen ? (
        <CompositeQuoteDialog
          node={row as QuoteCompositeNode}
          onClose={() => setCompositeOpen(false)}
          onSave={(node) => {
            updateComposite(node.id, () => node);
            setCompositeOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function DragHandle({ attributes, listeners }: { attributes: any; listeners: any }) {
  return (
    <button className="cursor-grab rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing" {...attributes} {...listeners} title="Deplacer">
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function Actions({
  id,
  menuOpen,
  setMenuOpen,
  onMove,
  onDelete,
  onDuplicate,
}: {
  id: string;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  return (
    <div className="relative flex justify-end gap-1">
      <Button variant="ghost" className="px-2" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal className="h-4 w-4" /></Button>
      <Button variant="ghost" className="px-2 text-red-600" onClick={() => onDelete(id)}><Trash2 className="h-4 w-4" /></Button>
      {menuOpen ? (
        <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border bg-white p-1 text-slate-700 shadow-lg">
          <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onMove(id, -1)}>Monter</button>
          <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onMove(id, 1)}>Descendre</button>
          <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onDuplicate(id)}>Dupliquer</button>
          <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => onDelete(id)}>Supprimer</button>
        </div>
      ) : null}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <Input type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />;
}

function VatInput({ value, onChange }: { value: QuoteVatRate; onChange: (value: QuoteVatRate) => void }) {
  return (
    <select className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(Number(event.target.value) as QuoteVatRate)}>
      {QUOTE_VAT_RATES.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
    </select>
  );
}

function filterCollapsedRows(rows: NumberedQuoteNode[], collapsed: Set<string>) {
  const visible: NumberedQuoteNode[] = [];
  const ancestors: string[] = [];
  for (const row of rows) {
    ancestors[row.depth] = row.id;
    ancestors.length = row.depth + 1;
    const hidden = ancestors.slice(0, row.depth).some((id) => collapsed.has(id));
    if (!hidden) visible.push(row);
  }
  return visible;
}

function rowHeight(row: NumberedQuoteNode | undefined) {
  if (!row) return 56;
  if (row.type === "text") return 150;
  if (row.type === "section" || row.type === "subsection") return 58;
  return 66;
}

function calculateSubtotal(nodes: QuoteNode[]) {
  return flattenQuoteNodes(nodes).reduce((sum, node) => sum + getNodeSellHt(node), 0);
}

function openMenu(event: React.MouseEvent, setMenuOpen: (value: boolean) => void) {
  event.preventDefault();
  setMenuOpen(true);
}

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
