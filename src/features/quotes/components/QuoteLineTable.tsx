import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import type { QuoteLine } from "../types";
import { useQuoteStore } from "../store/quoteStore";
import { applyQuoteNumbering } from "../utils/quoteNumbering";
import { getQuoteLineTotalHt } from "../utils/quoteCalculations";

const columns: Array<ColumnDef<QuoteLine & { number: string }>> = [
  { accessorKey: "number", header: "N°" },
  { accessorKey: "designation", header: "Designation" },
  { accessorKey: "quantity", header: "Quantite" },
  { accessorKey: "unit", header: "Unite" },
  { accessorKey: "unitPriceHt", header: "PU HT" },
  { accessorKey: "vatRate", header: "TVA" },
  {
    id: "total",
    header: "Total HT",
    cell: ({ row }) => getQuoteLineTotalHt(row.original).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),
  },
];

export function QuoteLineTable() {
  const lines = useQuoteStore((state) => state.draft.lines);
  const reorderLines = useQuoteStore((state) => state.reorderLines);
  const numberedLines = applyQuoteNumbering(lines);
  const table = useReactTable({ data: numberedLines, columns, getCoreRowModel: getCoreRowModel() });

  function onDragEnd(event: DragEndEvent) {
    if (event.over && event.active.id !== event.over.id) {
      reorderLines(String(event.active.id), String(event.over.id));
    }
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <SortableContext items={numberedLines.map((line) => line.id)} strategy={verticalListSortingStrategy}>
        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left font-medium">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.original.id} style={{ transform: CSS.Translate.toString({ x: 0, y: 0, scaleX: 1, scaleY: 1 }) }} className="border-t">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SortableContext>
    </DndContext>
  );
}
