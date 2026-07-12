"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, Rows3, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
} from "@/components/ui/dropdown";

/**
 * Enterprise table: sorting, global search, column show/hide, pagination,
 * density toggle (persisted), CSV export of the filtered rows, optional
 * row-click (detail drawers) and toolbar slot (facet filters / bulk actions).
 */
export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = "Search…",
  onRowClick,
  toolbar,
  exportName,
  exportRow,
  allowExport = true,
  pageSize = 20,
  emptyState,
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  exportName?: string;
  exportRow?: (row: T) => Record<string, string | number>;
  allowExport?: boolean;
  pageSize?: number;
  emptyState?: React.ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [dense, setDense] = useState(false);

  useEffect(() => {
    setDense(typeof window !== "undefined" && localStorage.getItem("table-density") === "compact");
  }, []);
  const toggleDense = () => {
    setDense((d) => {
      localStorage.setItem("table-density", d ? "comfortable" : "compact");
      return !d;
    });
  };

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;

  const exportCsv = useMemo(
    () => () => {
      if (!exportRow) return;
      const all = table.getFilteredRowModel().rows.map((r) => exportRow(r.original));
      if (all.length === 0) return;
      const headers = Object.keys(all[0]);
      const esc = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      };
      const csv = [headers.join(","), ...all.map((r) => headers.map((h) => esc(r[h] ?? "")).join(","))].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${exportName ?? "export"}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    [table, exportRow, exportName],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            className="w-64 pl-8"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
        {toolbar}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleDense} title="Toggle density">
            <Rows3 className="h-4 w-4" />
          </Button>
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon" title="Show/hide columns">
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownLabel>Columns</DropdownLabel>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownItem
                    key={c.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      c.toggleVisibility();
                    }}
                  >
                    <input type="checkbox" readOnly checked={c.getIsVisible()} className="accent-primary" />
                    {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                  </DropdownItem>
                ))}
            </DropdownContent>
          </Dropdown>
          {allowExport && exportRow && (
            <Button variant="ghost" size="icon" onClick={exportCsv} title="Export CSV (filtered rows)">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-card border border-slate-200 bg-surface shadow-card">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-surface">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className={cn(
                        "px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-slate-500",
                        dense ? "h-8" : "h-10",
                      )}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-slate-700"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    {emptyState ?? (
                      <div className="py-10 text-center text-sm text-slate-400">No results.</div>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn("hover:bg-slate-50/70", onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={cn("px-3 align-middle", dense ? "py-1.5" : "py-2.5")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span>
            {filteredCount} row{filteredCount === 1 ? "" : "s"}
            {filteredCount !== data.length ? ` (of ${data.length})` : ""}
          </span>
          {table.getPageCount() > 1 && (
            <span className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
