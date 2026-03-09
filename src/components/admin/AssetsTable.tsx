"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useAssets, useDeleteAsset } from "@/hooks/use-assets";
import { useExpenses } from "@/hooks/use-expenses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ArrowUpDown,
  MoreVertical,
  Pencil,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddAssetFromExpenseModal } from "./AddAssetFromExpenseModal";
import { EditAssetModal } from "./EditAssetModal";
import type { AssetData } from "@/hooks/use-assets";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expense-categories";

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return d.toLocaleDateString();
};

const formatAmount = (amount: string) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
  }).format(num);
};

export function AssetsTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteAsset, setDeleteAsset] = useState<AssetData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: assets = [], isLoading } = useAssets();
  const { data: expensesData } = useExpenses(1, 200);
  const deleteMutation = useDeleteAsset();

  const expenses = useMemo(
    () => expensesData?.data ?? [],
    [expensesData?.data]
  );
  const linkedExpenseIds = useMemo(
    () =>
      new Set(
        assets
          .map((a) => a.linkedExpenseId)
          .filter((id): id is string => id != null)
      ),
    [assets]
  );

  const filteredAssets = useMemo(() => {
    let result = assets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q) ?? false) ||
          (a.category?.toLowerCase().includes(q) ?? false)
      );
    }
    if (categoryFilter) {
      result = result.filter((a) => a.category === categoryFilter);
    }
    return result;
  }, [assets, searchQuery, categoryFilter]);

  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));

  const columns: ColumnDef<AssetData>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.original.name}</div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "description",
        id: "description",
        header: "Description",
        cell: ({ row }) => (
          <div className="text-muted-foreground max-w-[200px] truncate">
            {row.original.description || "—"}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "purchaseDate",
        id: "purchaseDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Purchase Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {formatDate(row.original.purchaseDate)}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "purchasePrice",
        id: "purchasePrice",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Purchase Price
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">
            {formatAmount(row.original.purchasePrice)}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.purchasePrice) || 0;
          const b = parseFloat(rowB.original.purchasePrice) || 0;
          return a - b;
        },
      },
      {
        accessorKey: "residualValue",
        id: "residualValue",
        header: "Residual",
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {formatAmount(row.original.residualValue || "0")}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "usefulLifeYears",
        id: "usefulLifeYears",
        header: "Life (yr)",
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.usefulLifeYears}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "category",
        id: "category",
        header: "Category",
        cell: ({ row }) => {
          const category = row.original.category;
          return category ? (
            <Badge variant="secondary">{category}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        enableSorting: false,
      },
      {
        id: "linkedExpense",
        header: "Expense",
        cell: ({ row }) => {
          const linkedId = row.original.linkedExpenseId;
          if (!linkedId)
            return <span className="text-muted-foreground">—</span>;
          const expense = expenses.find((e) => e.expense.id === linkedId);
          const desc = expense?.expense.description;
          return (
            <Link
              href="/dashboard/expenses"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              {desc
                ? desc.length > 25
                  ? `${desc.slice(0, 25)}…`
                  : desc
                : "View"}
            </Link>
          );
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAsset(row.original);
                  setIsEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteAsset(row.original);
                  setIsDeleteOpen(true);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    [expenses]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "purchaseDate", desc: true },
  ]);

  const table = useReactTable({
    data: paginatedAssets,
    columns,
    pageCount: totalPages,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleDelete = async () => {
    if (!deleteAsset) return;
    deleteMutation.mutate(deleteAsset.id, {
      onSuccess: () => {
        toast.success("Asset deleted");
        setDeleteAsset(null);
        setIsDeleteOpen(false);
      },
      onError: (error: Error) => {
        toast.error(error.message || "Failed to delete asset");
      },
    });
  };

  const expenseOptions = expenses.map((e) => ({
    id: e.expense.id,
    description: e.expense.description,
    amount: e.expense.amount,
    currency: e.expense.currency,
    date: e.expense.date,
    category: e.expense.category,
  }));

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Assets</h2>
          <span className="text-sm text-muted-foreground">
            ({filteredAssets.length} total)
          </span>
        </div>
        <p className="text-muted-foreground">
          View and manage assets. Add assets from expenses to track
          depreciation.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, description, or category..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
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
          <Select
            value={categoryFilter || "all"}
            onValueChange={(value) => {
              setCategoryFilter(value === "all" ? undefined : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Asset from Expense
        </Button>
      </div>

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
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  No assets found. Add an asset from an expense on the Expenses
                  page (Mark as asset) or here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredAssets.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Rows per page</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50, 100].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <EditAssetModal
        key={selectedAsset?.id ?? "closed"}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        asset={selectedAsset}
        onSuccess={() => {
          setSelectedAsset(null);
        }}
      />

      <AddAssetFromExpenseModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        expenses={expenseOptions}
        linkedExpenseIds={linkedExpenseIds}
        onSuccess={() => setIsAddOpen(false)}
      />

      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Asset"
        description={`Are you sure you want to delete "${deleteAsset?.name}"? This will not delete the linked expense.`}
        itemName="Asset"
        confirmationText={deleteAsset?.name || ""}
        warningMessage="This will remove the asset and its depreciation from financial reports. The linked expense (if any) will remain."
      />
    </div>
  );
}
