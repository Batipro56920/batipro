import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import type { QuoteLine } from "../types";
import { useQuoteStore } from "../store/quoteStore";
import { applyQuoteNumbering } from "../utils/quoteNumbering";
import { getQuoteLineTotalHt } from "../utils/quoteCalculations";

type Row = QuoteLine & { number: string };

export function QuoteLineTable() {
  const lines = useQuoteStore((state) => state.draft.lines);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const deleteLine = useQuoteStore((state) => state.deleteLine);
  const reorderLines = useQuoteStore((state) => state.reorderLines);
  const numberedLines = applyQuoteNumbering(lines);

  const columns: Array<ColumnDef<Row>> = [
    { accessorKey: "number", header: "N°" },
    {
      accessorKey: "designation",
      header: "Designation",
      cell: ({ row }) => (
        <input className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300" value={row.original.designation} onChange={(event) => updateLine(row.original.id, { designation: event.target.value })} />
      ),
    },
    {
      accessorKey: "quantity",
      header: "Quantite",
      cell: ({ row }) => <NumberInput value={row.original.quantity} onChange={(quantity) => updateLine(row.original.id, { quantity })} />,
    },
    {
      accessorKey: "unit",
      header: "Unite",
      cell: ({ row }) => (
        <input className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300" value={row.original.unit} onChange={(event) => updateLine(row.original.id, { unit: event.target.value })} />
      ),
    },
    {
      accessorKey: "unitPriceHt",
      header: "PU HT",
      cell: ({ row }) => <NumberInput value={row.original.unitPriceHt} onChange={(unitPriceHt) => updateLine(row.original.id, { unitPriceHt })} />,
    },
    {
      accessorKey: "vatRate",
      header: "TVA",
      cell: ({ row }) => <NumberInput value={row.original.vatRate} onChange={(vatRate) => updateLine(row.original.id, { vatRate: vatRate as Row["vatRate"] })} />,
    },
    {
      id: "total",
      header: "Total HT",
      cell: ({ row }) => getQuoteLineTotalHt(row.original).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => deleteLine(row.original.id)} title="Supprimer">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];
  const table = useReactTable({ data: numberedLines, columns, getCoreRowModel: getCoreRowModel() });

  function onDragEnd(event: DragEndEvent) {
    if (event.over && event.active.id !== event.over.id) {
      reorderLines(String(event.active.id), String(event.over.id));
    }
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <SortableContext items={numberedLines.map((line) => line.id)} strategy={verticalListSortingStrategy}>
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
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
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.original.id} className="border-t border-slate-100 align-middle">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!numberedLines.length ? <div className="p-6 text-center text-sm text-slate-500">Ajoutez une ligne depuis la bibliotheque ou le bouton + Ligne.</div> : null}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300"
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
