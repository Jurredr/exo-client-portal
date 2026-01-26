"use client";

import { useState } from "react";
import {
  useCreateExpense,
  useUpdateExpense,
  type CreateExpenseData,
  type UpdateExpenseData,
} from "@/hooks/use-expenses";
import { useCurrentUser } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DollarSign,
  Calendar,
  Upload,
  X,
  FileText,
  Copy,
  Loader2,
} from "lucide-react";

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

interface Expense {
  id: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: string | null;
  vendor: string | null;
  invoiceStoragePath: string | null; // Path in Supabase Storage
  invoiceFileName: string | null;
  invoiceSizeBytes: number | null;
}

export function CreateExpenseForm({
  onSuccess,
  expense,
  onCancel,
}: {
  onSuccess?: () => void;
  expense?: Expense;
  onCancel?: () => void;
}) {
  const [description, setDescription] = useState(expense?.description || "");
  const [amount, setAmount] = useState(expense?.amount || "");
  const [currency, setCurrency] = useState<"USD" | "EUR">(
    (expense?.currency as "USD" | "EUR") || "EUR"
  );
  const [date, setDate] = useState(
    expense?.date ? new Date(expense.date).toISOString().split("T")[0] : ""
  );
  const [category, setCategory] = useState<string>(expense?.category || "");
  const [vendor, setVendor] = useState<string>(expense?.vendor || "");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  // Preview is only for newly selected image files
  // For existing files in Storage, we just show the filename
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [removeInvoice, setRemoveInvoice] = useState(false);
  const { data: currentUser } = useCurrentUser();
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();
  const isSubmitting =
    createExpenseMutation.isPending || updateExpenseMutation.isPending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setInvoiceFile(file);
      setRemoveInvoice(false); // Reset remove flag when new file is selected

      // Validate file type - only PDFs allowed
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        setInvoiceFile(null);
        return;
      }

      // No preview for PDFs, just show filename
      setInvoicePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!amount.trim()) {
      toast.error("Amount is required");
      return;
    }

    if (!date) {
      toast.error("Date is required");
      return;
    }

    try {
      let invoiceStoragePath: string | null = null;
      let invoiceFileName: string | null = null;
      let invoiceSizeBytes: number | null = null;

      // Upload file to Storage if a new file is provided
      if (invoiceFile) {
        try {
          const formData = new FormData();
          formData.append("file", invoiceFile);
          if (expense?.id) {
            formData.append("expenseId", expense.id);
          }

          const uploadResponse = await fetch("/api/expenses/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.error || "Failed to upload file");
          }

          const uploadResult = await uploadResponse.json();
          invoiceStoragePath = uploadResult.storagePath;
          invoiceFileName = uploadResult.fileName;
          invoiceSizeBytes = uploadResult.sizeBytes;
        } catch (error) {
          console.error("Error uploading file:", error);
          toast.error("Failed to upload file. Please try again.");
          return;
        }
      } else if (removeInvoice) {
        // File is being removed
        invoiceStoragePath = null;
        invoiceFileName = null;
        invoiceSizeBytes = null;
      }
      // If neither invoiceFile nor removeInvoice, we don't set file fields
      // This means the API will preserve the existing file (if any)

      if (expense) {
        const updateData: UpdateExpenseData = {
          id: expense.id,
          description: description.trim(),
          amount: amount.trim(),
          currency,
          ...(date ? { date } : {}),
          category: category || null,
          vendor: vendor.trim() || null,
          // Only include file fields if they're explicitly set (new file or removal)
          ...(invoiceFile || removeInvoice
            ? {
                invoiceStoragePath: invoiceStoragePath ?? null,
                invoiceFileName: invoiceFileName ?? null,
                invoiceSizeBytes: invoiceSizeBytes ?? null,
              }
            : {}),
        };
        updateExpenseMutation.mutate(updateData, {
          onSuccess: () => {
            toast.success("Expense updated successfully");
            onSuccess?.();
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to update expense");
          },
        });
      } else {
        const createData: CreateExpenseData = {
          userId: currentUser?.user.id || "", // Required by interface, but API gets it from session
          description: description.trim(),
          amount: amount.trim(),
          currency,
          date: date, // date is validated above, so it's guaranteed to be a string
          category: category || null,
          vendor: vendor.trim() || null,
          invoiceStoragePath,
          invoiceFileName,
          invoiceSizeBytes,
        };
        createExpenseMutation.mutate(createData, {
          onSuccess: () => {
            toast.success("Expense created successfully");
            setDescription("");
            setAmount("");
            setCurrency("EUR");
            setDate("");
            setCategory("");
            setVendor("");
            setInvoiceFile(null);
            setInvoicePreview(null);
            onSuccess?.();
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to create expense");
          },
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${expense ? "update" : "create"} expense`
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {expense?.id && (
        <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
          <Label htmlFor="expense-id">Expense ID</Label>
          <div className="flex items-center gap-2">
            <Input
              id="expense-id"
              value={expense.id}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(expense.id);
                  toast.success("Expense ID copied");
                } catch {
                  toast.error("Failed to copy expense ID");
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="expense-description">Description *</Label>
        <Textarea
          id="expense-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Office supplies, Software subscription, etc."
          rows={3}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expense-amount" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Amount *
          </Label>
          <Input
            id="expense-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-currency">Currency *</Label>
          <Select
            value={currency}
            onValueChange={(value) => setCurrency(value as "USD" | "EUR")}
          >
            <SelectTrigger id="expense-currency" className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-date" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Date
        </Label>
        <Input
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expense-category">Category</Label>
          <Select
            value={category || undefined}
            onValueChange={(value) => setCategory(value || "")}
          >
            <SelectTrigger id="expense-category" className="w-full">
              <SelectValue placeholder="Select a category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-vendor">Vendor / Where</Label>
          <Input
            id="expense-vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Amazon, Office Depot, etc."
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-invoice" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Invoice (Optional)
        </Label>
        <div className="space-y-2">
          <Input
            id="expense-invoice"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          {(expense?.invoiceStoragePath || expense?.invoiceFileName) &&
            !invoiceFile &&
            !removeInvoice && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <FileText className="h-4 w-4" />
                <span className="text-sm flex-1">
                  {expense.invoiceFileName || "Existing invoice"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setRemoveInvoice(true);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          {invoiceFile && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <FileText className="h-4 w-4" />
              <span className="text-sm flex-1">{invoiceFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setInvoiceFile(null);
                  setInvoicePreview(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {invoicePreview && invoiceFile && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invoicePreview}
                alt="Invoice preview"
                className="max-w-full h-auto max-h-48 rounded-md border"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Max 10MB. Supports images and PDFs.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {expense && onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className={expense && onCancel ? "flex-1" : "w-full"}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {expense ? "Updating..." : "Creating..."}
            </>
          ) : expense ? (
            "Update Expense"
          ) : (
            "Create Expense"
          )}
        </Button>
      </div>
    </form>
  );
}
