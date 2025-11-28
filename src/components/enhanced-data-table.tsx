"use client";

import { useMemo, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EnhancedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchableFields?: (keyof TData)[];
  searchFn?: (row: TData, query: string) => boolean;
  filterConfig?: {
    [key: string]: {
      label: string;
      options: { label: string; value: string }[];
      getValue: (row: TData) => string;
    };
  };
  initialSorting?: SortingState;
  initialPageSize?: number;
  onRowClick?: (row: TData) => void;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
}

export function EnhancedDataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  searchableFields,
  searchFn,
  filterConfig,
  initialSorting = [],
  initialPageSize = 10,
  onRowClick,
  emptyMessage = "No results found.",
  toolbar,
}: EnhancedDataTableProps<TData, TValue>) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [searchQuery, setSearchQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );

  // Apply search and filters
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (searchFn) {
        result = result.filter((item) => searchFn(item, searchLower));
      } else if (searchableFields) {
        result = result.filter((item) => {
          return searchableFields.some((field) => {
            const value = item[field];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(searchLower);
          });
        });
      }
    }

    // Apply column filters
    if (filterConfig && Object.keys(activeFilters).length > 0) {
      result = result.filter((item) => {
        return Object.entries(activeFilters).every(([key, values]) => {
          if (!values || values.length === 0) return true;
          const config = filterConfig[key];
          if (!config) return true;
          const itemValue = config.getValue(item);
          // Handle comma-separated values (for multiple organizations)
          if (typeof itemValue === "string" && itemValue.includes(",")) {
            const itemValues = itemValue.split(",");
            return values.some((v) => itemValues.includes(v));
          }
          return values.includes(itemValue);
        });
      });
    }

    return result;
  }, [data, searchQuery, searchableFields, activeFilters, filterConfig]);

  const table = useReactTable({
    data: filteredData,
    columns,
    pageCount: Math.ceil((filteredData?.length || 0) / pagination.pageSize),
    state: {
      pagination,
      sorting,
      columnFilters,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: false,
  });

  const handleFilterChange = (
    filterKey: string,
    value: string,
    checked: boolean
  ) => {
    setActiveFilters((prev) => {
      const current = prev[filterKey] || [];
      if (checked) {
        return { ...prev, [filterKey]: [...current, value] };
      } else {
        return { ...prev, [filterKey]: current.filter((v) => v !== value) };
      }
    });
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearchQuery("");
  };

  const hasActiveFilters =
    searchQuery || Object.values(activeFilters).some((v) => v.length > 0);

  // Calculate all filter option counts in a single useMemo hook
  const allFilterCounts = useMemo(() => {
    if (!filterConfig || Object.keys(filterConfig).length === 0) {
      return {};
    }

    // Apply only search, not filters, to get accurate counts
    let dataForCounts = [...data];
    if (searchQuery && searchFn) {
      dataForCounts = dataForCounts.filter((item) =>
        searchFn(item, searchQuery.toLowerCase())
      );
    } else if (searchQuery && searchableFields) {
      const searchLower = searchQuery.toLowerCase();
      dataForCounts = dataForCounts.filter((item) => {
        return searchableFields.some((field) => {
          const value = item[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Calculate counts for all filter configs
    const counts: Record<string, Record<string, number>> = {};
    Object.entries(filterConfig).forEach(([key, config]) => {
      const filterCounts: Record<string, number> = {};
      dataForCounts.forEach((item) => {
        const value = config.getValue(item);
        // Handle comma-separated values (for multiple organizations)
        if (typeof value === "string" && value.includes(",")) {
          const values = value.split(",");
          values.forEach((v) => {
            filterCounts[v] = (filterCounts[v] || 0) + 1;
          });
        } else {
          filterCounts[value] = (filterCounts[value] || 0) + 1;
        }
      });
      counts[key] = filterCounts;
    });

    return counts;
  }, [data, searchQuery, searchFn, searchableFields, filterConfig]);

  return (
    <div className="space-y-4">
      {/* Toolbar with search and filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {filterConfig && Object.keys(filterConfig).length > 0 && (
            <div className="flex items-center gap-2">
              {Object.entries(filterConfig).map(([key, config]) => {
                const activeCount = activeFilters[key]?.length || 0;
                const allOptions = config.options;
                const optionCounts = allFilterCounts[key] || {};

                return (
                  <DropdownMenu key={key}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        {config.label}
                        {activeCount > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {activeCount}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="start">
                      <DropdownMenuLabel>Filters</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allOptions.map((option) => {
                        const isChecked =
                          activeFilters[key]?.includes(option.value) || false;
                        const count = optionCounts[option.value] || 0;
                        return (
                          <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              handleFilterChange(
                                key,
                                option.value,
                                checked === true
                              )
                            }
                            className="flex items-center justify-between"
                          >
                            <span>{option.label}</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              {count}
                            </span>
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          )}
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
        {toolbar}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-10">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : ""}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
