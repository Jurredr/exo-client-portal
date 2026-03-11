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
import {
  useInvoices,
  useDeleteInvoice,
  useUpdateInvoice,
  invoiceKeys,
} from "@/hooks/use-invoices";
import { useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Mail,
} from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusCombobox } from "@/components/status-combobox";
import { CreateInvoiceForm } from "./CreateInvoiceForm";
import { SendEmailModal } from "./SendEmailModal";

function getDefaultInvoiceEmailBody(invoiceData: {
  invoice: { invoiceNumber: string; amount: string; currency: string };
  company?: { name: string } | null;
}) {
  const companyName = invoiceData.company?.name || "de klant";
  return `
<p>Beste ${companyName},</p>
<p>Hierbij ontvangt u factuur <strong>${invoiceData.invoice.invoiceNumber}</strong> ter waarde van <strong>${invoiceData.invoice.amount} ${invoiceData.invoice.currency}</strong>.</p>
<p>De factuur is als PDF bijgevoegd.</p>
<p>Met vriendelijke groet,<br>EXO</p>
  `.trim();
}

interface InvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    expenseId: string | null;
    amount: string;
    currency: string;
    status: string;
    type: string;
    transactionType: string;
    vatIncluded: boolean | null;
    isKOR: boolean;
    description: string | null;
    invoiceDate: string;
    dueDate: string | null;
    paidAt: string | null;
    pdfStoragePath: string | null; // Path in Supabase Storage
    pdfFileName: string | null;
    pdfSizeBytes: number | null;
    createdAt: string;
    updatedAt: string;
    companyId?: string; // Fallback when company/org not loaded
  };
  project: {
    id: string;
    title: string;
  } | null;
  organization?: { id: string; name: string };
  company?: { id: string; name: string; email?: string | null };
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    taxPercentage: string;
    order: number;
  }>;
}

const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", state: "bg-gray-500" },
  { value: "sent", label: "Sent", state: "bg-blue-500" },
  { value: "paid", label: "Paid", state: "bg-green-500" },
  { value: "overdue", label: "Overdue", state: "bg-red-500" },
  { value: "cancelled", label: "Cancelled", state: "bg-gray-400" },
];

const calculateTotalFromLineItems = (
  lineItems: Array<{
    quantity: string;
    unitPrice: string;
    taxPercentage: string;
  }>
): number => {
  return lineItems.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const taxPercentage = parseFloat(item.taxPercentage) || 0;
    const subtotal = quantity * unitPrice;
    const tax = subtotal * (taxPercentage / 100);
    return sum + subtotal + tax;
  }, 0);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export function InvoicesTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
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
  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices(
    page,
    pageSize,
    {
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { type: typeFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    }
  );
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteInvoice();
  const updateMutation = useUpdateInvoice();

  const invoices = invoicesData?.data || [];
  const pagination = invoicesData?.pagination;
  const loading = isLoadingInvoices;

  const [deleteInvoice, setDeleteInvoice] = useState<InvoiceData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(
    null
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [sendEmailInvoice, setSendEmailInvoice] = useState<InvoiceData | null>(
    null
  );
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const isMobile = useIsMobile();

  const columns: ColumnDef<InvoiceData>[] = useMemo(
    () => [
      {
        accessorKey: "invoice.invoiceNumber",
        id: "invoiceNumber",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Invoice #
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.invoice.invoiceNumber}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.invoice.invoiceNumber.localeCompare(
            rowB.original.invoice.invoiceNumber
          );
        },
      },
      {
        accessorKey: "company.name",
        id: "organization",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Organization
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const org = row.original.company ?? row.original.organization;
          return (
            <div className="text-muted-foreground">{org?.name ?? "—"}</div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const nameA =
            (rowA.original.company ?? rowA.original.organization)?.name ?? "";
          const nameB =
            (rowB.original.company ?? rowB.original.organization)?.name ?? "";
          return nameA.localeCompare(nameB);
        },
      },
      {
        accessorKey: "project.title",
        id: "project",
        header: "Project",
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.project?.title || "—"}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "invoice.amount",
        id: "revenue",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Revenue
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const { amount, currency, transactionType, expenseId } =
            row.original.invoice;
          const symbol = currency === "USD" ? "$" : "€";
          const isReimbursement = expenseId !== null;

          // Revenue: €0 for reimbursements (no revenue generated)
          let numericAmount: number;
          if (isReimbursement) {
            numericAmount = 0;
          } else {
            numericAmount = parseFloat(amount.replace(/[€$,]/g, "")) || 0;
            if (transactionType === "credit") {
              numericAmount = -Math.abs(numericAmount);
            }
          }

          const displayAmount = `${symbol}${numericAmount.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`;

          return <div className="font-medium">{displayAmount}</div>;
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const aReimb = rowA.original.invoice.expenseId !== null;
          const bReimb = rowB.original.invoice.expenseId !== null;
          let a = aReimb
            ? 0
            : parseFloat(rowA.original.invoice.amount.replace(/[€$,]/g, "")) ||
              0;
          let b = bReimb
            ? 0
            : parseFloat(rowB.original.invoice.amount.replace(/[€$,]/g, "")) ||
              0;
          if (!aReimb && rowA.original.invoice.transactionType === "credit")
            a = -Math.abs(a);
          if (!bReimb && rowB.original.invoice.transactionType === "credit")
            b = -Math.abs(b);
          return a - b;
        },
      },
      {
        accessorKey: "invoice.amount",
        id: "total",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Total
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const { amount, currency, transactionType } = row.original.invoice;
          const lineItems = row.original.lineItems;
          const symbol = currency === "USD" ? "$" : "€";

          // Total: use line items sum when available (correct for reimbursements with amount=0)
          let numericAmount: number;
          if (lineItems && lineItems.length > 0) {
            numericAmount = calculateTotalFromLineItems(lineItems);
          } else {
            numericAmount = parseFloat(amount.replace(/[€$,]/g, "")) || 0;
          }
          if (transactionType === "credit") {
            numericAmount = -Math.abs(numericAmount);
          }

          const displayAmount = `${symbol}${numericAmount.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`;

          return (
            <div className="font-medium text-muted-foreground">
              {displayAmount}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const getTotal = (r: InvoiceData) => {
            if (r.lineItems && r.lineItems.length > 0) {
              return calculateTotalFromLineItems(r.lineItems);
            }
            return parseFloat(r.invoice.amount.replace(/[€$,]/g, "")) || 0;
          };
          let a = getTotal(rowA.original);
          let b = getTotal(rowB.original);
          if (rowA.original.invoice.transactionType === "credit")
            a = -Math.abs(a);
          if (rowB.original.invoice.transactionType === "credit")
            b = -Math.abs(b);
          return a - b;
        },
      },
      {
        accessorKey: "invoice.status",
        id: "status",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Status
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const invoice = row.original.invoice;
          return (
            <StatusCombobox
              options={INVOICE_STATUS_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                state: o.state,
              }))}
              value={invoice.status || "draft"}
              onValueChange={(value) => {
                updateMutation.mutate({
                  id: invoice.id,
                  status: value,
                });
              }}
              disabled={updateMutation.isPending}
              className="min-w-[110px]"
            />
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.invoice.status.localeCompare(
            rowB.original.invoice.status
          );
        },
      },
      {
        accessorKey: "invoice.type",
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.invoice.type === "auto" ? "Auto" : "Manual"}
          </Badge>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "invoice.transactionType",
        id: "transactionType",
        header: "Transaction Type",
        cell: ({ row }) => {
          const isReimbursement = row.original.invoice.expenseId !== null;

          if (isReimbursement) {
            return <Badge variant="secondary">Reimbursement</Badge>;
          }

          return (
            <Badge
              variant={
                row.original.invoice.transactionType === "credit"
                  ? "default"
                  : "outline"
              }
            >
              {row.original.invoice.transactionType === "credit"
                ? "Credit"
                : "Debit"}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "invoice.dueDate",
        id: "dueDate",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Due Date
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {formatDate(row.original.invoice.dueDate)}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const dateA = rowA.original.invoice.dueDate
            ? new Date(rowA.original.invoice.dueDate).getTime()
            : 0;
          const dateB = rowB.original.invoice.dueDate
            ? new Date(rowB.original.invoice.dueDate).getTime()
            : 0;
          // Sort null/undefined dates to the end
          if (!rowA.original.invoice.dueDate && !rowB.original.invoice.dueDate)
            return 0;
          if (!rowA.original.invoice.dueDate) return 1;
          if (!rowB.original.invoice.dueDate) return -1;
          return dateA - dateB;
        },
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
                  handleDownload(row.original);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {row.original.invoice.pdfFileName ? "Download" : "Generate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingInvoice(row.original);
                  setIsEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSendEmailInvoice(row.original);
                  setIsSendEmailOpen(true);
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send by email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteInvoice(row.original);
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
    [updateMutation]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "invoiceNumber", desc: true },
  ]);

  const table = useReactTable({
    data: invoices,
    columns: columns as never,
    pageCount: pagination?.totalPages ?? 1,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, // Server-side pagination
  });

  const handleDownload = async (invoice: InvoiceData) => {
    try {
      // Add cache-busting parameter to force fresh download
      const response = await fetch(
        `/api/invoices/${invoice.invoice.id}/download?v=${Date.now()}`
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to download invoice");
      }
      const blob = await response.blob();

      // Check if the blob is actually a PDF
      if (blob.type !== "application/pdf") {
        // If it's JSON, it's probably an error response
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || "Failed to download invoice");
        } catch {
          throw new Error("Invalid response from server");
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Invoice downloaded successfully");
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download invoice"
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteInvoice) return;

    deleteMutation.mutate(deleteInvoice.invoice.id, {
      onSuccess: () => {
        toast.success("Invoice deleted successfully");
        setDeleteInvoice(null);
      },
      onError: (error: Error) => {
        console.error("Error deleting invoice:", error);
        toast.error("Failed to delete invoice");
      },
    });
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    // React Query will automatically refetch invoices
  };

  const handleCreateError = () => {
    setIsCreateOpen(true); // Reopen modal on failure so user can retry
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    setEditingInvoice(null);
    // React Query will automatically refetch invoices
  };

  const handleEditCancel = () => {
    setIsEditOpen(false);
    setEditingInvoice(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Invoices</h2>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              ({pagination.totalCount} total)
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          View and manage all invoices for projects and manual invoices
        </p>
      </div>

      {/* Server-side filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices by number, organization, or project..."
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
            value={statusFilter || "all"}
            onValueChange={(value) => {
              setStatusFilter(value === "all" ? undefined : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {INVOICE_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter || "all"}
            onValueChange={(value) => {
              setTypeFilter(value === "all" ? undefined : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isMobile ? (
          <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DrawerTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Create Invoice</DrawerTitle>
                <DrawerDescription>
                  Create a new manual invoice
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <CreateInvoiceForm onSuccess={handleCreateSuccess} />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="!max-w-4xl !sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Invoice</DialogTitle>
                <DialogDescription>
                  Create a new manual invoice for any purpose
                </DialogDescription>
              </DialogHeader>
              <CreateInvoiceForm
                onSuccess={handleCreateSuccess}
                onError={handleCreateError}
              />
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
                  No invoices found.
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

      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice "${deleteInvoice?.invoice.invoiceNumber}"? This action cannot be undone.`}
        itemName="Invoice"
        confirmationText={deleteInvoice?.invoice.invoiceNumber || ""}
        warningMessage="This will permanently delete the invoice. This action cannot be undone."
      />

      {sendEmailInvoice && (
        <SendEmailModal
          open={isSendEmailOpen}
          onOpenChange={setIsSendEmailOpen}
          defaultTo={sendEmailInvoice.company?.email || ""}
          defaultSubject={`Factuur ${sendEmailInvoice.invoice.invoiceNumber} - EXO`}
          defaultBody={getDefaultInvoiceEmailBody(sendEmailInvoice)}
          title="Verstuur factuur per e-mail"
          description="De factuur wordt als PDF bijgevoegd. Pas het bericht aan indien gewenst."
          onSend={async (data) => {
            const res = await fetch(
              `/api/invoices/${sendEmailInvoice.invoice.id}/send`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              }
            );
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || "Failed to send");
            }
            setSendEmailInvoice(null);
            queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
          }}
        />
      )}

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                Edit Invoice
                {editingInvoice && ` (${editingInvoice.invoice.invoiceNumber})`}
              </DrawerTitle>
              <DrawerDescription>Update invoice details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              {editingInvoice && (
                <CreateInvoiceForm
                  key={editingInvoice.invoice.id}
                  invoice={{
                    id: editingInvoice.invoice.id,
                    invoiceNumber: editingInvoice.invoice.invoiceNumber,
                    organizationId:
                      (editingInvoice.company ?? editingInvoice.organization)
                        ?.id ??
                      editingInvoice.invoice.companyId ??
                      "",
                    projectId: editingInvoice.project?.id || null,
                    expenseId: editingInvoice.invoice.expenseId ?? null,
                    amount: editingInvoice.invoice.amount,
                    currency: editingInvoice.invoice.currency,
                    status: editingInvoice.invoice.status,
                    transactionType: editingInvoice.invoice.transactionType,
                    vatIncluded: editingInvoice.invoice.vatIncluded ?? null,
                    isKOR: editingInvoice.invoice.isKOR || false,
                    description: editingInvoice.invoice.description,
                    invoiceDate: editingInvoice.invoice.invoiceDate,
                    dueDate: editingInvoice.invoice.dueDate,
                    paidAt: editingInvoice.invoice.paidAt ?? null,
                    pdfStoragePath:
                      editingInvoice.invoice.pdfStoragePath || null,
                    pdfFileName: editingInvoice.invoice.pdfFileName || null,
                    pdfSizeBytes: editingInvoice.invoice.pdfSizeBytes || null,
                    lineItems: editingInvoice.lineItems || undefined,
                  }}
                  onSuccess={handleEditSuccess}
                  onCancel={handleEditCancel}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="!max-w-4xl !sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Edit Invoice
                {editingInvoice && ` (${editingInvoice.invoice.invoiceNumber})`}
              </DialogTitle>
              <DialogDescription>Update invoice details</DialogDescription>
            </DialogHeader>
            {editingInvoice && (
              <CreateInvoiceForm
                key={editingInvoice.invoice.id}
                invoice={{
                  id: editingInvoice.invoice.id,
                  invoiceNumber: editingInvoice.invoice.invoiceNumber,
                  organizationId:
                    (editingInvoice.company ?? editingInvoice.organization)
                      ?.id ??
                    editingInvoice.invoice.companyId ??
                    "",
                  projectId: editingInvoice.project?.id || null,
                  expenseId: editingInvoice.invoice.expenseId ?? null,
                  amount: editingInvoice.invoice.amount,
                  currency: editingInvoice.invoice.currency,
                  status: editingInvoice.invoice.status,
                  transactionType: editingInvoice.invoice.transactionType,
                  vatIncluded: editingInvoice.invoice.vatIncluded ?? null,
                  isKOR: editingInvoice.invoice.isKOR || false,
                  description: editingInvoice.invoice.description,
                  invoiceDate: editingInvoice.invoice.invoiceDate,
                  dueDate: editingInvoice.invoice.dueDate,
                  paidAt: editingInvoice.invoice.paidAt ?? null,
                  pdfStoragePath: editingInvoice.invoice.pdfStoragePath || null,
                  pdfFileName: editingInvoice.invoice.pdfFileName || null,
                  pdfSizeBytes: editingInvoice.invoice.pdfSizeBytes || null,
                  lineItems: editingInvoice.lineItems || undefined,
                }}
                onSuccess={handleEditSuccess}
                onCancel={handleEditCancel}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
