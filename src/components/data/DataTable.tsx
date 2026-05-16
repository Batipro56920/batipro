import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { EmptyState, TableSkeleton } from "../feedback";
import { cn } from "../../lib/cn";

export type DataTableDensity = "crm" | "chantiers" | "devis";

const rowHeights: Record<DataTableDensity, string> = {
  crm: "h-11",
  chantiers: "h-[52px]",
  devis: "h-10",
};

export function DataTable<TData>({
  data,
  columns,
  density = "crm",
  loading = false,
  emptyLabel = "Aucune donnée",
  search,
}: {
  data: TData[];
  columns: Array<ColumnDef<TData>>;
  density?: DataTableDensity;
  loading?: boolean;
  emptyLabel?: string;
  search?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) return <TableSkeleton rows={6} />;
  if (!data.length) return <EmptyState title={emptyLabel} />;

  return (
    <div className="overflow-hidden rounded-card border border-bt-border bg-white shadow-subtle">
      <div className="max-w-full overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 bg-bt-surface-secondary text-bt-muted">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="border-b border-bt-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em]">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={cn("border-b border-bt-border transition-colors hover:bg-bt-surface-secondary", rowHeights[density])}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
