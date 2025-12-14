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
import {
  Download,
  Trash2,
  Plus,
  ArrowUpDown,
  MoreVertical,
  FileText,
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
    invoiceUrl: string | null;
    invoiceFileName: string | null;
    invoiceFileType: string | null;
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

export function ExpensesTable() {
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
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
          <div className="font-medium">{row.original.expense.description}</div>
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
          const hasInvoice = !!row.original.expense.invoiceUrl;
          return hasInvoice ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const url = row.original.expense.invoiceUrl!;
                if (url.startsWith("data:")) {
                  // Base64 data URL
                  const link = document.createElement("a");
                  link.href = url;
                  link.download =
                    row.original.expense.invoiceFileName || "invoice";
                  link.click();
                } else {
                  window.open(url, "_blank");
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
    []
  );

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await fetch("/api/expenses");
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Error fetching expenses:", errorData);
        toast.error(errorData.error || "Failed to load expenses");
      }
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    fetchExpenses();
  };

  const handleDelete = async () => {
    if (!deleteExpense) return;

    try {
      const response = await fetch(
        `/api/expenses?id=${deleteExpense.expense.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }

      toast.success("Expense deleted successfully");
      fetchExpenses();
      setDeleteExpense(null);
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  };

  return (
    <div className="space-y-4">
      <EnhancedDataTable
        columns={columns}
        data={expenses}
        searchPlaceholder="Search expenses by description, category, or vendor..."
        searchFn={(row, query) => {
          const description = row.expense.description.toLowerCase();
          const category = (row.expense.category || "").toLowerCase();
          const vendor = (row.expense.vendor || "").toLowerCase();
          return (
            description.includes(query) ||
            category.includes(query) ||
            vendor.includes(query)
          );
        }}
        initialSorting={[{ id: "date", desc: true }]}
        emptyMessage="No expenses found."
        isLoading={loading}
        toolbar={
          isMobile ? (
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
                  <CreateExpenseForm onSuccess={handleCreateSuccess} />
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
          )
        }
      />

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
                  expense={selectedExpense.expense}
                  onSuccess={() => {
                    setIsEditOpen(false);
                    setSelectedExpense(null);
                    fetchExpenses();
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
                  fetchExpenses();
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
    </div>
  );
}
