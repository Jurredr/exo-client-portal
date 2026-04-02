"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  useCreateExpense,
  useUpdateExpense,
  type CreateExpenseData,
  type UpdateExpenseData,
} from "@/hooks/use-expenses";
import { useCurrentUser } from "@/hooks/use-users";
import {
  useOrganizations,
  useCreateOrganization,
} from "@/hooks/use-organizations";
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
  Scan,
  Building2,
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

interface SuggestedCompany {
  id: string;
  name: string;
  btwNumber: string | null;
  kvkNumber: string | null;
}

interface Expense {
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
  btwStatus?: string;
}

const BTW_STATUS_OPTIONS = [
  { value: "te_vorderen", label: "Te vorderen" },
  { value: "verrekend", label: "Verrekend" },
  { value: "n_v_t", label: "N.v.t." },
] as const;

export function CreateExpenseForm({
  onSuccess,
  onError,
  expense,
  onCancel,
}: {
  onSuccess?: () => void;
  onError?: () => void;
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
  const [btwStatus, setBtwStatus] = useState<string>(
    expense?.btwStatus || "te_vorderen"
  );
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  // Preview is only for newly selected image files
  // For existing files in Storage, we just show the filename
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [removeInvoice, setRemoveInvoice] = useState(false);
  // AI extract flow (create mode only)
  const [showForm, setShowForm] = useState(!!expense);
  const [isExtracting, setIsExtracting] = useState(false);
  const [suggestedCompanies, setSuggestedCompanies] = useState<
    SuggestedCompany[]
  >([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    expense?.companyId ?? null
  );
  const [addingNewCompany, setAddingNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [newCompanyKvk, setNewCompanyKvk] = useState("");
  const [newCompanyBtw, setNewCompanyBtw] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const { data: companies = [] } = useOrganizations();
  const createOrganizationMutation = useCreateOrganization();
  const [originalDescription, setOriginalDescription] = useState<string>("");
  const [originalAmount, setOriginalAmount] = useState<string>("");
  const [originalCurrency, setOriginalCurrency] = useState<"USD" | "EUR">(
    "EUR"
  );
  const [originalDate, setOriginalDate] = useState<string>("");
  const [originalCategory, setOriginalCategory] = useState<string>("");
  const [originalBtwStatus, setOriginalBtwStatus] =
    useState<string>("te_vorderen");
  const [, setOriginalInvoiceStoragePath] = useState<string | null>(null);
  const { data: currentUser } = useCurrentUser();
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const isSubmitting =
    isSubmittingLocal ||
    createExpenseMutation.isPending ||
    updateExpenseMutation.isPending;

  // Sync selectedCompanyId when expense changes (e.g. when opening edit)
  useEffect(() => {
    if (expense?.companyId !== undefined) {
      setSelectedCompanyId(expense.companyId);
      setAddingNewCompany(false);
    }
  }, [expense?.companyId]);

  // Store original values when editing
  useEffect(() => {
    if (expense) {
      const desc = expense.description || "";
      const amt = expense.amount || "";
      const curr = (expense.currency as "USD" | "EUR") || "EUR";
      const dt = expense.date
        ? new Date(expense.date).toISOString().split("T")[0]
        : "";
      const cat = expense.category || "";
      const btw = expense.btwStatus || "te_vorderen";
      const invPath = expense.invoiceStoragePath;

      setOriginalDescription(desc);
      setOriginalAmount(amt);
      setOriginalCurrency(curr);
      setOriginalDate(dt);
      setOriginalCategory(cat);
      setOriginalBtwStatus(btw);
      setOriginalInvoiceStoragePath(invPath);
    } else {
      // Reset original values when not editing
      setOriginalDescription("");
      setOriginalAmount("");
      setOriginalCurrency("EUR");
      setOriginalDate("");
      setOriginalCategory("");
      setOriginalBtwStatus("te_vorderen");
      setOriginalInvoiceStoragePath(null);
    }
  }, [expense]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!expense) return true; // Always allow creating

    return (
      description.trim() !== originalDescription ||
      amount.trim() !== originalAmount ||
      currency !== originalCurrency ||
      date !== originalDate ||
      category !== originalCategory ||
      btwStatus !== originalBtwStatus ||
      selectedCompanyId !== (expense.companyId ?? null) ||
      invoiceFile !== null ||
      removeInvoice
    );
  }, [
    expense,
    description,
    originalDescription,
    amount,
    originalAmount,
    currency,
    originalCurrency,
    date,
    originalDate,
    category,
    originalCategory,
    btwStatus,
    originalBtwStatus,
    selectedCompanyId,
    invoiceFile,
    removeInvoice,
  ]);

  const extractAndPreFill = useCallback(async (file: File) => {
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/expenses/extract-invoice", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to extract invoice");
      }
      const data = await res.json();
      if (data.amount) setAmount(data.amount);
      if (data.currency)
        setCurrency(
          data.currency === "USD" || data.currency === "EUR"
            ? data.currency
            : "EUR"
        );
      if (data.date) setDate(data.date);
      if (data.description) setDescription(data.description);
      if (data.category) setCategory(data.category);
      setSuggestedCompanies(data.suggestedCompanies ?? []);
      setSelectedCompanyId(null);
      setAddingNewCompany(false);
      if ((data.suggestedCompanies ?? []).length > 0) {
        setSelectedCompanyId(data.suggestedCompanies[0].id);
      } else if (data.vendor) {
        setAddingNewCompany(true);
        setNewCompanyName(data.vendor);
        setNewCompanyAddress(data.vendorAddress ?? "");
        setNewCompanyKvk(data.kvkNumber ?? "");
        setNewCompanyBtw(data.btwNumber ?? "");
        setNewCompanyEmail(data.vendorEmail ?? "");
        setNewCompanyPhone(data.vendorPhone ?? "");
      }
      setShowForm(true);
      toast.success("Invoice data extracted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to extract invoice"
      );
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const processFile = useCallback(
    (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setInvoiceFile(file);
      setRemoveInvoice(false);
      setInvoicePreview(null);
      if (!expense) {
        extractAndPreFill(file);
      }
    },
    [expense, extractAndPreFill]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isExtracting) setIsDragging(true);
    },
    [isExtracting]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (isExtracting) return;
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile, isExtracting]
  );

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

    if (!expense && addingNewCompany && !newCompanyName.trim()) {
      toast.error("Company name is required when adding a new company");
      return;
    }

    setIsSubmittingLocal(true);
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
          setIsSubmittingLocal(false);
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

      // Fetch historical exchange rate for non-EUR expenses
      let eurEquivalent: number | null = null;
      let exchangeRate: number | null = null;
      let exchangeRateDate: string | null = null;
      if (currency !== "EUR" && amount && date) {
        try {
          const dateStr =
            typeof date === "string"
              ? date.slice(0, 10)
              : new Date(date).toISOString().slice(0, 10);
          const res = await fetch(
            `/api/expenses/exchange-rate?date=${dateStr}&currency=${currency}`
          );
          if (res.ok) {
            const data = await res.json();
            const rate = data.rate as number;
            const amt =
              parseFloat(amount.replace(/[^0-9.,]/g, "").replace(",", ".")) ||
              0;
            if (typeof rate === "number" && amt > 0) {
              eurEquivalent = amt * rate;
              exchangeRate = rate;
              exchangeRateDate = data.date ?? dateStr;
            }
          }
        } catch {
          // Fall back to current rate conversion in backend
        }
      }

      if (expense) {
        const updateData: UpdateExpenseData = {
          id: expense.id,
          description: description.trim(),
          amount: amount.trim(),
          currency,
          ...(date ? { date } : {}),
          category: category || null,
          btwStatus,
          vendor: expense.vendor ?? null,
          companyId: selectedCompanyId,
          // Only include file fields if they're explicitly set (new file or removal)
          ...(invoiceFile || removeInvoice
            ? {
                invoiceStoragePath: invoiceStoragePath ?? null,
                invoiceFileName: invoiceFileName ?? null,
                invoiceSizeBytes: invoiceSizeBytes ?? null,
              }
            : {}),
          ...(eurEquivalent != null && {
            eurEquivalent,
            exchangeRate,
            exchangeRateDate,
          }),
        };
        updateExpenseMutation.mutate(updateData, {
          onSuccess: () => {
            toast.success("Expense updated successfully");
            onSuccess?.();
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to update expense");
          },
          onSettled: () => setIsSubmittingLocal(false),
        });
      } else {
        let finalCompanyId = selectedCompanyId;
        if (addingNewCompany && newCompanyName.trim()) {
          const newCompany = await createOrganizationMutation.mutateAsync({
            name: newCompanyName.trim(),
            address: newCompanyAddress.trim() || null,
            kvkNumber: newCompanyKvk.trim() || null,
            btwNumber: newCompanyBtw.trim() || null,
            email: newCompanyEmail.trim() || null,
            telephone: newCompanyPhone.trim() || null,
          });
          finalCompanyId = newCompany.id;
        }
        const createData: CreateExpenseData = {
          userId: currentUser?.user.id || "", // Required by interface, but API gets it from session
          description: description.trim(),
          amount: amount.trim(),
          currency,
          date: date, // date is validated above, so it's guaranteed to be a string
          category: category || null,
          btwStatus,
          vendor: finalCompanyId
            ? addingNewCompany
              ? newCompanyName.trim()
              : (companies.find((c) => c.id === finalCompanyId)?.name ??
                suggestedCompanies.find((c) => c.id === finalCompanyId)?.name ??
                null)
            : null,
          companyId: finalCompanyId,
          invoiceStoragePath,
          invoiceFileName,
          invoiceSizeBytes,
          ...(eurEquivalent != null && {
            eurEquivalent,
            exchangeRate,
            exchangeRateDate,
          }),
        };
        // Optimistic close: close modal immediately for faster workflow
        onSuccess?.();

        createExpenseMutation.mutate(createData, {
          onSuccess: () => {
            toast.success("Expense created successfully");
            setDescription("");
            setAmount("");
            setCurrency("EUR");
            setDate("");
            setCategory("");
            setBtwStatus("te_vorderen");
            setInvoiceFile(null);
            setInvoicePreview(null);
            setSuggestedCompanies([]);
            setSelectedCompanyId(null);
            setAddingNewCompany(false);
            setNewCompanyName("");
            setNewCompanyAddress("");
            setNewCompanyKvk("");
            setNewCompanyBtw("");
            setNewCompanyEmail("");
            setNewCompanyPhone("");
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to create expense");
            onError?.(); // Reopen modal on failure so user can retry
          },
          onSettled: () => setIsSubmittingLocal(false),
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${expense ? "update" : "create"} expense`
      );
      setIsSubmittingLocal(false);
    }
  };

  // Create mode: optional upload step first
  if (!expense && !showForm) {
    return (
      <div className="space-y-4">
        <div
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Scan className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-2 font-medium">Upload invoice to auto-fill</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF invoice to extract vendor, amount, date and more. Drag
            and drop or click to browse.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Label
              htmlFor="expense-invoice-upload"
              className="cursor-pointer rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              <Upload className="mr-2 inline h-4 w-4" />
              Choose PDF
            </Label>
            <Input
              id="expense-invoice-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={isExtracting}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(true)}
              disabled={isExtracting}
            >
              Skip
            </Button>
          </div>
          {isExtracting && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting invoice data...
            </div>
          )}
        </div>
      </div>
    );
  }

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
        <Label htmlFor="expense-btw-status">BTW-status</Label>
        <Select
          value={btwStatus}
          onValueChange={(value) => setBtwStatus(value)}
        >
          <SelectTrigger id="expense-btw-status" className="w-full">
            <SelectValue placeholder="Selecteer BTW-status" />
          </SelectTrigger>
          <SelectContent>
            {BTW_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-company" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Company
        </Label>
        <Select
          value={addingNewCompany ? "__new__" : selectedCompanyId || "none"}
          onValueChange={(v) => {
            if (v === "__new__") {
              setAddingNewCompany(true);
              setSelectedCompanyId(null);
            } else {
              setAddingNewCompany(false);
              setSelectedCompanyId(v === "none" ? null : v);
            }
          }}
        >
          <SelectTrigger id="expense-company">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No company</SelectItem>
            {suggestedCompanies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.btwNumber ? ` (${c.btwNumber})` : ""}
              </SelectItem>
            ))}
            {companies
              .filter((c) => !suggestedCompanies.some((s) => s.id === c.id))
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            <SelectItem value="__new__">Add new company</SelectItem>
          </SelectContent>
        </Select>
        {addingNewCompany && (
          <div className="mt-3 space-y-3 rounded-lg border p-4 bg-muted/30">
            <Label className="text-sm font-medium">New company details</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-4 sm:col-span-2">
                <Label htmlFor="new-company-name">Name *</Label>
                <Input
                  id="new-company-name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-4 sm:col-span-2">
                <Label htmlFor="new-company-address">Address</Label>
                <Input
                  id="new-company-address"
                  value={newCompanyAddress}
                  onChange={(e) => setNewCompanyAddress(e.target.value)}
                  placeholder="Street, city, postal code"
                />
              </div>
              <div className="space-y-4">
                <Label htmlFor="new-company-kvk">KVK number</Label>
                <Input
                  id="new-company-kvk"
                  value={newCompanyKvk}
                  onChange={(e) => setNewCompanyKvk(e.target.value)}
                  placeholder="12345678"
                />
              </div>
              <div className="space-y-4">
                <Label htmlFor="new-company-btw">BTW number</Label>
                <Input
                  id="new-company-btw"
                  value={newCompanyBtw}
                  onChange={(e) => setNewCompanyBtw(e.target.value)}
                  placeholder="NL123456789B01"
                />
              </div>
              <div className="space-y-4">
                <Label htmlFor="new-company-email">Email</Label>
                <Input
                  id="new-company-email"
                  type="email"
                  value={newCompanyEmail}
                  onChange={(e) => setNewCompanyEmail(e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>
              <div className="space-y-4">
                <Label htmlFor="new-company-phone">Phone</Label>
                <Input
                  id="new-company-phone"
                  value={newCompanyPhone}
                  onChange={(e) => setNewCompanyPhone(e.target.value)}
                  placeholder="+31 20 123 4567"
                />
              </div>
            </div>
          </div>
        )}
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
          disabled={!hasChanges || isSubmitting}
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
