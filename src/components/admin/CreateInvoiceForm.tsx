"use client";

import { useState, useEffect } from "react";
import { useNextInvoiceNumber } from "@/hooks/use-invoices";
import { useAllProjects } from "@/hooks/use-projects";
import { useOrganizations } from "@/hooks/use-organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  Upload,
  X,
  Plus,
  Trash2,
  Download,
} from "lucide-react";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";
import { EXO_ORGANIZATION_NAME } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";

// interface Organization {
//   id: string;
//   name: string;
// }

interface Project {
  id: string;
  title: string;
  organizationId: string;
  subtotal: string | null;
  currency: string;
}

interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxPercentage: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  projectId: string | null;
  amount: string;
  currency: string;
  status: string;
  transactionType: string;
  description: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  pdfStoragePath: string | null; // Path in Supabase Storage
  pdfFileName: string | null;
  pdfFileType: string | null;
  pdfSizeBytes: number | null;
  vatIncluded: boolean | null;
  isKOR: boolean;
  lineItems?: InvoiceLineItem[];
}

const INVOICE_STATUSES: StatusOption[] = [
  { value: "draft", label: "Draft", state: "bg-gray-500" },
  { value: "sent", label: "Sent", state: "bg-blue-500" },
  { value: "paid", label: "Paid", state: "bg-green-500" },
  { value: "overdue", label: "Overdue", state: "bg-red-500" },
  { value: "cancelled", label: "Cancelled", state: "bg-gray-400" },
];

export function CreateInvoiceForm({
  onSuccess,
  invoice,
  onCancel,
}: {
  onSuccess?: () => void;
  invoice?: Invoice;
  onCancel?: () => void;
}) {
  const [organizationId, setOrganizationId] = useState<string>(
    invoice?.organizationId || ""
  );
  const [projectId, setProjectId] = useState<string>(invoice?.projectId || "");
  const [currency, setCurrency] = useState<"USD" | "EUR">(
    (invoice?.currency as "USD" | "EUR") || "EUR"
  );
  const [status, setStatus] = useState(invoice?.status || "draft");
  const [transactionType, setTransactionType] = useState<"debit" | "credit">(
    (invoice?.transactionType as "debit" | "credit") || "debit"
  );
  const [isKOR, setIsKOR] = useState<boolean>(
    invoice?.isKOR !== undefined ? invoice.isKOR : false
  );

  // Calculate default due date (current date + 7 days) for new invoices
  const getDefaultDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split("T")[0];
  };

  const [dueDate, setDueDate] = useState(
    invoice?.dueDate
      ? new Date(invoice.dueDate).toISOString().split("T")[0]
      : getDefaultDueDate()
  );
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoiceDate
      ? new Date(invoice.invoiceDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  // TanStack Query hooks
  const { data: organizationsData, isLoading: isLoadingOrgs } =
    useOrganizations();
  const { data: projectsData, isLoading: isLoadingProjects } = useAllProjects();
  const { data: nextInvoiceNumberData } = useNextInvoiceNumber();

  const organizations =
    organizationsData
      ?.filter((org) => org.name !== EXO_ORGANIZATION_NAME)
      .map((org) => ({ id: org.id, name: org.name })) || [];
  const nextInvoiceNumber = nextInvoiceNumberData?.invoiceNumber || "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [invoiceNumberOverride, setInvoiceNumberOverride] = useState<string>(
    invoice?.invoiceNumber || ""
  );
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    invoice?.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems
      : [
          {
            description: "",
            quantity: "1",
            unitPrice: "",
            taxPercentage: isKOR ? "0" : "21",
          },
        ]
  );

  // Calculate total from line items
  const calculateTotal = (): number => {
    return lineItems.reduce((total, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const taxPercentage = parseFloat(item.taxPercentage) || 0;
      const subtotal = quantity * unitPrice;
      const tax = subtotal * (taxPercentage / 100);
      return total + subtotal + tax;
    }, 0);
  };

  // Set invoice number override when next invoice number is fetched
  useEffect(() => {
    if (!invoice && nextInvoiceNumber) {
      setInvoiceNumberOverride(nextInvoiceNumber);
    }
  }, [invoice, nextInvoiceNumber]);

  // Filter projects by organization
  useEffect(() => {
    if (!organizationId) {
      setProjects([]);
      return;
    }

    const filteredProjects =
      projectsData
        ?.filter((p) => p.project.organizationId === organizationId)
        .map((p) => ({
          id: p.project.id,
          title: p.project.title,
          organizationId: p.project.organizationId,
          subtotal: p.project.subtotal,
          currency: p.project.currency,
        })) || [];
    setProjects(filteredProjects);
  }, [organizationId, projectsData]);

  // When KOR is enabled, set all tax percentages to 0
  useEffect(() => {
    if (isKOR) {
      setLineItems((items) =>
        items.map((item) => ({ ...item, taxPercentage: "0" }))
      );
    }
  }, [isKOR]);

  // Reset PDF state when invoice changes (e.g., when opening edit modal)
  useEffect(() => {
    if (invoice) {
      setPdfFile(null);
      setRemovePdf(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      if (!file.type.includes("pdf")) {
        toast.error("Only PDF files are allowed");
        return;
      }
      setPdfFile(file);
      setRemovePdf(false);
    } else {
      // If file input is cleared, reset to show existing PDF if available
      setPdfFile(null);
      // Don't set removePdf to true here - we want to preserve existing PDF
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: "",
        quantity: "1",
        unitPrice: "",
        taxPercentage: isKOR ? "0" : "21",
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    } else {
      toast.error("At least one line item is required");
    }
  };

  const updateLineItem = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string
  ) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast.error("Organization is required");
      return;
    }

    // Validate line items
    const hasValidItems = lineItems.some(
      (item) =>
        item.description.trim() &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.unitPrice) > 0
    );

    if (!hasValidItems) {
      toast.error("At least one valid line item is required");
      return;
    }

    // Calculate total
    const total = calculateTotal();
    if (total <= 0) {
      toast.error("Total amount must be greater than 0");
      return;
    }

    setIsSubmitting(true);
    try {
      let pdfStoragePath: string | null = null;
      let pdfFileName: string | null = null;
      let pdfFileType: string | null = null;
      let pdfSizeBytes: number | null = null;

      // Upload PDF to Storage if a new file is provided
      if (pdfFile) {
        try {
          const formData = new FormData();
          formData.append("file", pdfFile);
          if (invoice?.id) {
            formData.append("invoiceId", invoice.id);
          }

          const uploadResponse = await fetch("/api/invoices/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.error || "Failed to upload PDF");
          }

          const uploadResult = await uploadResponse.json();
          pdfStoragePath = uploadResult.storagePath;
          pdfFileName = uploadResult.fileName;
          pdfFileType = uploadResult.fileType;
          pdfSizeBytes = uploadResult.sizeBytes;
        } catch (error) {
          console.error("Error uploading PDF:", error);
          toast.error("Failed to upload PDF file. Please try again.");
          setIsSubmitting(false);
          return;
        }
      } else if (removePdf) {
        // PDF is being removed
        pdfStoragePath = null;
        pdfFileName = null;
        pdfFileType = null;
        pdfSizeBytes = null;
      }
      // If neither pdfFile nor removePdf, we don't set PDF fields
      // This means the API will preserve the existing PDF (if any)

      const url = "/api/invoices";
      const method = invoice ? "PATCH" : "POST";
      const body = invoice
        ? {
            id: invoice.id,
            organizationId,
            projectId: projectId || null,
            amount: total.toFixed(2),
            currency,
            status,
            transactionType,
            isKOR,
            invoiceDate: invoiceDate || null,
            dueDate: dueDate || null,
            // Only include PDF fields if they're explicitly set (new file or removal)
            // If undefined, the API will preserve the existing PDF
            ...(pdfFile || removePdf
              ? {
                  pdfStoragePath: pdfStoragePath ?? null,
                  pdfFileName: pdfFileName ?? null,
                  pdfFileType: pdfFileType ?? null,
                  pdfSizeBytes: pdfSizeBytes ?? null,
                }
              : {}),
            lineItems: lineItems.map((item, index) => ({
              ...item,
              order: index,
            })),
          }
        : {
            organizationId,
            projectId: projectId || null,
            amount: total.toFixed(2),
            currency,
            status,
            type: "manual",
            transactionType,
            isKOR,
            dueDate: dueDate || null,
            pdfStoragePath,
            pdfFileName,
            pdfFileType,
            pdfSizeBytes,
            invoiceNumber: invoiceNumberOverride.trim() || null,
            lineItems: lineItems.map((item, index) => ({
              ...item,
              order: index,
            })),
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `Failed to ${invoice ? "update" : "create"} invoice`
        );
      }

      toast.success(`Invoice ${invoice ? "updated" : "created"} successfully`);
      if (!invoice) {
        setOrganizationId("");
        setProjectId("");
        setCurrency("EUR");
        setStatus("draft");
        setTransactionType("debit");
        setIsKOR(false);
        setDueDate("");
        setPdfFile(null);
        setInvoiceNumberOverride("");
        setLineItems([
          {
            description: "",
            quantity: "1",
            unitPrice: "",
            taxPercentage: "21",
          },
        ]);
      }
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${invoice ? "update" : "create"} invoice`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = calculateTotal();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!invoice && (
        <div className="space-y-2">
          <Label htmlFor="invoice-number">Invoice Number</Label>
          <Input
            id="invoice-number"
            value={invoiceNumberOverride}
            onChange={(e) => setInvoiceNumberOverride(e.target.value)}
            placeholder={nextInvoiceNumber || "Leave empty to auto-generate"}
          />
          <p className="text-xs text-muted-foreground">
            {nextInvoiceNumber
              ? `Default: ${nextInvoiceNumber}`
              : "Leave empty to auto-generate. Format: INV-YYYY-NNNN"}
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="invoice-org">Organization *</Label>
        <Select
          value={organizationId}
          onValueChange={(value) => {
            setOrganizationId(value);
            setProjectId("");
          }}
          disabled={isLoadingOrgs}
          required
        >
          <SelectTrigger id="invoice-org" className="w-full">
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invoice-project">Project (Optional)</Label>
        <Select
          value={projectId || "none"}
          onValueChange={(value) => {
            setProjectId(value === "none" ? "" : value);
          }}
          disabled={isLoadingProjects || !organizationId}
        >
          <SelectTrigger id="invoice-project" className="w-full">
            <SelectValue
              placeholder={
                organizationId
                  ? "Select a project (optional)"
                  : "Select an organization first"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {projects.length === 0 && organizationId ? (
              <SelectItem value="no-projects" disabled>
                No projects found for this organization
              </SelectItem>
            ) : (
              projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-currency">Currency *</Label>
          <Select
            value={currency}
            onValueChange={(value) => setCurrency(value as "USD" | "EUR")}
          >
            <SelectTrigger id="invoice-currency" className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice-transaction-type">Transaction Type *</Label>
          <Select
            value={transactionType}
            onValueChange={(value) =>
              setTransactionType(value as "debit" | "credit")
            }
            required
          >
            <SelectTrigger id="invoice-transaction-type" className="w-full">
              <SelectValue placeholder="Select transaction type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debit">Debit</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-status">Status</Label>
          <StatusCombobox
            options={INVOICE_STATUSES}
            value={status}
            onValueChange={setStatus}
            placeholder="Select status..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice-date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Invoice Date
          </Label>
          <Input
            id="invoice-date"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice-due-date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Due Date
          </Label>
          <Input
            id="invoice-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is-kor"
          checked={isKOR}
          onCheckedChange={(checked) => setIsKOR(checked === true)}
        />
        <Label htmlFor="is-kor" className="text-sm font-normal cursor-pointer">
          Kleine ondernemersregeling (KOR) - No tax charged
        </Label>
      </div>

      {/* Line Items Section */}
      <div className="space-y-4 border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLineItem}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        <div className="space-y-3">
          {lineItems.map((item, index) => {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unitPrice) || 0;
            const taxPercentage = parseFloat(item.taxPercentage) || 0;
            const subtotal = quantity * unitPrice;
            const tax = subtotal * (taxPercentage / 100);
            const itemTotal = subtotal + tax;

            return (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 p-3 border rounded-md bg-muted/50 items-end"
              >
                <div className="col-span-12 lg:col-span-5 space-y-1">
                  <Label className="text-xs">Description *</Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(index, "description", e.target.value)
                    }
                    placeholder="Item description"
                    required
                    className="w-full"
                  />
                </div>
                <div className="col-span-3 lg:col-span-1 space-y-1">
                  <Label className="text-xs">Qty *</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow integers (whole numbers)
                      if (value === "" || /^\d+$/.test(value)) {
                        updateLineItem(index, "quantity", value);
                      }
                    }}
                    required
                    className="w-full"
                  />
                </div>
                <div className="col-span-4 lg:col-span-2 space-y-1">
                  <Label className="text-xs">Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateLineItem(index, "unitPrice", e.target.value)
                    }
                    required
                    className="w-full"
                  />
                </div>
                <div className="col-span-3 lg:col-span-1 space-y-1">
                  <Label className="text-xs">Tax %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={item.taxPercentage}
                    onChange={(e) =>
                      updateLineItem(index, "taxPercentage", e.target.value)
                    }
                    disabled={isKOR}
                    required
                    className="w-full"
                  />
                </div>
                <div className="col-span-2 lg:col-span-2 flex items-end space-y-1">
                  <div className="w-full">
                    <Label className="text-xs block mb-1">Total</Label>
                    <div className="text-sm font-medium h-10 flex items-center justify-end px-3 border rounded-md bg-background">
                      {currency === "EUR" ? "€" : "$"}
                      {itemTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-1 flex items-end justify-center lg:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                    className="h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t pt-3 flex justify-end">
          <div className="text-right space-y-1">
            <div className="text-sm text-muted-foreground">
              Total:{" "}
              <span className="text-base font-bold">
                {currency === "EUR" ? "€" : "$"}
                {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invoice-pdf" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Invoice PDF (Optional)
        </Label>
        <div className="space-y-2">
          <Input
            id="invoice-pdf"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          {invoice?.pdfFileName && !pdfFile && !removePdf && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <FileText className="h-4 w-4" />
              <span className="text-sm flex-1">
                {invoice.pdfFileName || "Existing PDF"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Download the PDF via the API endpoint
                  window.open(`/api/invoices/${invoice.id}/download`, "_blank");
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                View
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setRemovePdf(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {invoice?.pdfFileName && removePdf && (
            <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md border border-destructive/20">
              <span className="text-sm text-destructive flex-1">
                PDF will be removed on save
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRemovePdf(false);
                }}
              >
                Undo
              </Button>
            </div>
          )}
          {pdfFile && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <FileText className="h-4 w-4" />
              <span className="text-sm flex-1">{pdfFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setPdfFile(null);
                  // Reset file input
                  const fileInput = document.getElementById(
                    "invoice-pdf"
                  ) as HTMLInputElement;
                  if (fileInput) {
                    fileInput.value = "";
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Max 10MB. PDF files only.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {invoice && onCancel && (
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
          className={invoice && onCancel ? "flex-1" : "w-full"}
        >
          <FileText className="h-4 w-4 mr-2" />
          {isSubmitting
            ? invoice
              ? "Updating..."
              : "Creating..."
            : invoice
              ? "Update Invoice"
              : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
