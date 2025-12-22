"use client";

import { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
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
import { cn } from "@/lib/utils";
import {
  FileText,
  Download,
  Trash2,
  Plus,
  ArrowUpDown,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateInvoiceForm } from "./CreateInvoiceForm";

interface InvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: string;
    currency: string;
    status: string;
    type: string;
    transactionType: string;
    vatIncluded: boolean;
    description: string | null;
    dueDate: string | null;
    paidAt: string | null;
    pdfUrl: string | null;
    pdfFileName: string | null;
    pdfFileType: string | null;
    createdAt: string;
    updatedAt: string;
  };
  project: {
    id: string;
    title: string;
  } | null;
  organization: {
    id: string;
    name: string;
  };
}

const INVOICE_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-500" },
  { value: "sent", label: "Sent", color: "bg-blue-500" },
  { value: "paid", label: "Paid", color: "bg-green-500" },
  { value: "overdue", label: "Overdue", color: "bg-red-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-400" },
];

const formatStatus = (status: string) => {
  const statusConfig = INVOICE_STATUSES.find((s) => s.value === status);
  return statusConfig
    ? statusConfig.label
    : status.charAt(0).toUpperCase() + status.slice(1);
};

const getStatusColor = (status: string) => {
  const statusConfig = INVOICE_STATUSES.find((s) => s.value === status);
  return statusConfig ? statusConfig.color : "bg-gray-500";
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
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteInvoice, setDeleteInvoice] = useState<InvoiceData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(
    null
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
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
        accessorKey: "organization.name",
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
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.organization.name}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.organization.name.localeCompare(
            rowB.original.organization.name
          );
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
        cell: ({ row }) => {
          const { amount, currency } = row.original.invoice;
          const symbol = currency === "USD" ? "$" : "€";
          // If amount already has a symbol, use it as is, otherwise prepend the currency symbol
          const displayAmount =
            amount.startsWith("$") || amount.startsWith("€")
              ? amount
              : `${symbol}${amount}`;
          return <div className="font-medium">{displayAmount}</div>;
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a =
            parseFloat(rowA.original.invoice.amount.replace(/[€,]/g, "")) || 0;
          const b =
            parseFloat(rowB.original.invoice.amount.replace(/[€,]/g, "")) || 0;
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
          const status = row.original.invoice.status;
          return (
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 w-fit"
            >
              <span
                className={cn("size-1.5 rounded-full", getStatusColor(status))}
              />
              {formatStatus(status)}
            </Badge>
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
        cell: ({ row }) => (
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
        ),
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
                {row.original.invoice.pdfUrl ? "Download" : "Generate"}
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
    []
  );

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/invoices");
      if (response.ok) {
        const data = await response.json();
        setInvoices(data);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Error fetching invoices:", errorData);
        toast.error(errorData.error || "Failed to load invoices");
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoice: InvoiceData) => {
    try {
      const response = await fetch(
        `/api/invoices/${invoice.invoice.id}/download`
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
      a.download = `invoice-${invoice.invoice.invoiceNumber}.pdf`;
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

    try {
      const response = await fetch(
        `/api/invoices?id=${deleteInvoice.invoice.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete invoice");
      }

      toast.success("Invoice deleted successfully");
      fetchInvoices();
      setDeleteInvoice(null);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice");
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    fetchInvoices();
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    setEditingInvoice(null);
    fetchInvoices();
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
          <span className="text-sm text-muted-foreground">
            ({invoices.length})
          </span>
        </div>
        <p className="text-muted-foreground">
          View and manage all invoices for projects and manual invoices
        </p>
      </div>

      <EnhancedDataTable
        columns={columns}
        data={invoices}
        searchPlaceholder="Search invoices by number, organization, or project..."
        searchFn={(row, query) => {
          const invoiceNumber = row.invoice.invoiceNumber.toLowerCase();
          const org = row.organization.name.toLowerCase();
          const project = row.project?.title?.toLowerCase() || "";
          const description = row.invoice.description?.toLowerCase() || "";
          return (
            invoiceNumber.includes(query) ||
            org.includes(query) ||
            project.includes(query) ||
            description.includes(query)
          );
        }}
        filterConfig={{
          status: {
            label: "Status",
            options: INVOICE_STATUSES.map((s) => ({
              label: s.label,
              value: s.value,
            })),
            getValue: (row) => row.invoice.status,
          },
          type: {
            label: "Type",
            options: [
              { label: "Auto", value: "auto" },
              { label: "Manual", value: "manual" },
            ],
            getValue: (row) => row.invoice.type,
          },
        }}
        initialSorting={[{ id: "invoiceNumber", desc: true }]}
        emptyMessage="No invoices found."
        isLoading={loading}
        toolbar={
          isMobile ? (
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
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Invoice</DialogTitle>
                  <DialogDescription>
                    Create a new manual invoice for any purpose
                  </DialogDescription>
                </DialogHeader>
                <CreateInvoiceForm onSuccess={handleCreateSuccess} />
              </DialogContent>
            </Dialog>
          )
        }
      />

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

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Edit Invoice</DrawerTitle>
              <DrawerDescription>Update invoice details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              {editingInvoice && (
                <CreateInvoiceForm
                  invoice={{
                    id: editingInvoice.invoice.id,
                    invoiceNumber: editingInvoice.invoice.invoiceNumber,
                    organizationId: editingInvoice.organization.id,
                    projectId: editingInvoice.project?.id || null,
                    amount: editingInvoice.invoice.amount,
                    currency: editingInvoice.invoice.currency,
                    status: editingInvoice.invoice.status,
                    transactionType: editingInvoice.invoice.transactionType,
                    vatIncluded: editingInvoice.invoice.vatIncluded ?? true,
                    description: editingInvoice.invoice.description,
                    dueDate: editingInvoice.invoice.dueDate,
                    pdfUrl: editingInvoice.invoice.pdfUrl || null,
                    pdfFileName: editingInvoice.invoice.pdfFileName || null,
                    pdfFileType: editingInvoice.invoice.pdfFileType || null,
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Invoice</DialogTitle>
              <DialogDescription>Update invoice details</DialogDescription>
            </DialogHeader>
            {editingInvoice && (
              <CreateInvoiceForm
                invoice={{
                  id: editingInvoice.invoice.id,
                  invoiceNumber: editingInvoice.invoice.invoiceNumber,
                  organizationId: editingInvoice.organization.id,
                  projectId: editingInvoice.project?.id || null,
                  amount: editingInvoice.invoice.amount,
                  currency: editingInvoice.invoice.currency,
                  status: editingInvoice.invoice.status,
                  transactionType: editingInvoice.invoice.transactionType,
                  vatIncluded: editingInvoice.invoice.vatIncluded ?? true,
                  description: editingInvoice.invoice.description,
                  dueDate: editingInvoice.invoice.dueDate,
                  pdfUrl: editingInvoice.invoice.pdfUrl || null,
                  pdfFileName: editingInvoice.invoice.pdfFileName || null,
                  pdfFileType: editingInvoice.invoice.pdfFileType || null,
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
