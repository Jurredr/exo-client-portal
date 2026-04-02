"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useAssets } from "@/hooks/use-assets";
import { MarkAsAssetModal } from "./MarkAsAssetModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Download,
  Trash2,
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
  Package,
} from "lucide-react";
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
import { CreateExpenseForm } from "./CreateExpenseForm";

interface ExpenseData {
  expense: {
    id: string;
    description: string;
    amount: string;
    currency: string;
    date: string;
    category: string | null;
    vendor: string | null;
    companyId: string | null;
    invoiceStoragePath: string | null; // Path in Supabase Storage
    invoiceFileName: string | null;
    invoiceSizeBytes: number | null;
    btwStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatAmount = (amount: string, currency: string = "EUR") => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
  }).format(num);
};

const BTW_STATUS_LABELS: Record<string, string> = {
  te_vorderen: "Te vorderen",
  verrekend: "Verrekend",
  n_v_t: "N.v.t.",
};

const BTW_STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> =
  {
    te_vorderen: "default",
    verrekend: "secondary",
    n_v_t: "outline",
  };

const EXPENSE_CATEGORIES = [
  "Office",
  "Software",
  "Travel",
  "Equipment",
  "Marketing",
  "Utilities",
  "Professional Services",
  "Other",
];

export function ExpensesTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // TanStack Query hooks - server-side pagination and filtering
  const { data: expensesData, isLoading: isLoadingExpenses } = useExpenses(
    page,
    pageSize,
    {
      ...(categoryFilter && { category: categoryFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    }
  );
  const deleteMutation = useDeleteExpense();
  const { data: assets = [] } = useAssets();

  const expenses = expensesData?.data || [];
  const linkedExpenseIds = useMemo(
    () =>
      new Set(
        assets
          .map((a) => a.linkedExpenseId)
          .filter((id): id is string => id != null)
      ),
    [assets]
  );

  const [markAsAssetExpense, setMarkAsAssetExpense] =
    useState<ExpenseData | null>(null);
  const [isMarkAsAssetOpen, setIsMarkAsAssetOpen] = useState(false);
  const pagination = expensesData?.pagination;
  const loading = isLoadingExpenses;

  const [deleteExpense, setDeleteExpense] = useState<ExpenseData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseData | null>(
    null
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const isMobile = useIsMobile();

  const columns: ColumnDef<ExpenseData>[] = useMemo(
    () => [
      {
        accessorKey: "expense.description",
        id: "description",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Description
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div
            className="font-medium max-w-[200px] truncate"
            title={row.original.expense.description}
          >
            {row.original.expense.description}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.expense.description.localeCompare(
            rowB.original.expense.description
          );
        },
      },
      {
        accessorKey: "expense.amount",
        id: "amount",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Amount
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="font-medium">
            {formatAmount(
              row.original.expense.amount,
              row.original.expense.currency
            )}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.expense.amount) || 0;
          const b = parseFloat(rowB.original.expense.amount) || 0;
          return a - b;
        },
      },
      {
        accessorKey: "expense.date",
        id: "date",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Date
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {formatDate(row.original.expense.date)}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = new Date(rowA.original.expense.date).getTime();
          const b = new Date(rowB.original.expense.date).getTime();
          return a - b;
        },
      },
      {
        accessorKey: "expense.category",
        id: "category",
        header: "Category",
        cell: ({ row }) => {
          const category = row.original.expense.category;
          return category ? (
            <Badge variant="secondary">{category}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "expense.btwStatus",
        id: "btwStatus",
        header: "BTW",
        cell: ({ row }) => {
          const status = row.original.expense.btwStatus;
          return (
            <Badge variant={BTW_STATUS_VARIANTS[status] || "outline"}>
              {BTW_STATUS_LABELS[status] || status}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "expense.vendor",
        id: "vendor",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Vendor
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const vendor = row.original.expense.vendor;
          return vendor ? (
            <div className="text-muted-foreground">{vendor}</div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.expense.vendor || "";
          const b = rowB.original.expense.vendor || "";
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "user.name",
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.user.name || row.original.user.email}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "invoice",
        header: "Invoice",
        cell: ({ row }) => {
          const hasInvoice =
            !!row.original.expense.invoiceStoragePath ||
            !!row.original.expense.invoiceFileName;
          return hasInvoice ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Download from Storage via API
                if (row.original.expense.invoiceStoragePath) {
                  window.open(
                    `/api/expenses/${row.original.expense.id}/download`,
                    "_blank"
                  );
                } else {
                  // Legacy: shouldn't happen after migration
                  toast.error("File not available");
                }
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
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
                  setSelectedExpense(row.original);
                  setIsEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setMarkAsAssetExpense(row.original);
                  setIsMarkAsAssetOpen(true);
                }}
                disabled={linkedExpenseIds.has(row.original.expense.id)}
              >
                <Package className="mr-2 h-4 w-4" />
                {linkedExpenseIds.has(row.original.expense.id)
                  ? "Already an asset"
                  : "Mark as asset"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteExpense(row.original);
                  setIsDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    [linkedExpenseIds]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  const table = useReactTable({
    data: expenses,
    columns,
    pageCount: pagination?.totalPages ?? 1,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, // Server-side pagination
  });

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    // React Query will automatically refetch expenses
  };

  const handleCreateError = () => {
    setIsCreateOpen(true); // Reopen modal on failure so user can retry
  };

  const handleDelete = async () => {
    if (!deleteExpense) return;

    deleteMutation.mutate(deleteExpense.expense.id, {
      onSuccess: () => {
        toast.success("Expense deleted successfully");
        setDeleteExpense(null);
      },
      onError: (error: Error) => {
        console.error("Error deleting expense:", error);
        toast.error("Failed to delete expense");
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Expenses</h2>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              ({pagination.totalCount} total)
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          View and manage all business expenses
        </p>
      </div>

      {/* Server-side filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses by description, category, or vendor..."
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
        {isMobile ? (
          <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DrawerTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Create Expense</DrawerTitle>
                <DrawerDescription>
                  Add a new business expense
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <CreateExpenseForm
                  onSuccess={handleCreateSuccess}
                  onError={handleCreateError}
                />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Expense</DialogTitle>
                <DialogDescription>
                  Add a new business expense
                </DialogDescription>
              </DialogHeader>
              <CreateExpenseForm onSuccess={handleCreateSuccess} />
            </DialogContent>
          </Dialog>
        )}
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
            {loading ? (
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
                  No expenses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Server-side Pagination */}
      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Rows per page</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                const newPageSize = Number(value);
                setPageSize(newPageSize);
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
            <div className="flex items-center justify-center text-sm font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(pagination.totalPages)}
                disabled={page >= pagination.totalPages}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Edit Expense</DrawerTitle>
              <DrawerDescription>Update expense details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              {selectedExpense && (
                <CreateExpenseForm
                  key={selectedExpense.expense.id}
                  expense={selectedExpense.expense}
                  onSuccess={() => {
                    setIsEditOpen(false);
                    setSelectedExpense(null);
                    // React Query will automatically refetch
                  }}
                  onCancel={() => {
                    setIsEditOpen(false);
                    setSelectedExpense(null);
                  }}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription>Update expense details</DialogDescription>
            </DialogHeader>
            {selectedExpense && (
              <CreateExpenseForm
                expense={selectedExpense.expense}
                onSuccess={() => {
                  setIsEditOpen(false);
                  setSelectedExpense(null);
                  // React Query will automatically refetch
                }}
                onCancel={() => {
                  setIsEditOpen(false);
                  setSelectedExpense(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Expense"
        description={`Are you sure you want to delete "${deleteExpense?.expense.description}"? This action cannot be undone.`}
        itemName="Expense"
        confirmationText={deleteExpense?.expense.description || ""}
        warningMessage="This will permanently delete the expense and any associated invoice. This action cannot be undone."
      />

      <MarkAsAssetModal
        key={markAsAssetExpense?.expense?.id ?? "closed"}
        open={isMarkAsAssetOpen}
        onOpenChange={setIsMarkAsAssetOpen}
        expense={markAsAssetExpense?.expense ?? null}
        onSuccess={() => {
          setMarkAsAssetExpense(null);
        }}
        alreadyLinked={
          !!markAsAssetExpense &&
          linkedExpenseIds.has(markAsAssetExpense.expense.id)
        }
      />
    </div>
  );
}
