"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useNextInvoiceNumber,
  useCreateInvoice,
  useUpdateInvoice,
  type CreateInvoiceData,
  type UpdateInvoiceData,
} from "@/hooks/use-invoices";
import { useAllProjects } from "@/hooks/use-projects";
import { useOrganizations } from "@/hooks/use-organizations";
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
  FileText,
  Calendar,
  Upload,
  X,
  Plus,
  Trash2,
  Download,
  Loader2,
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
  expenseId: string | null;
  amount: string;
  currency: string;
  status: string;
  transactionType: string;
  description: string | null;
  invoiceDate: string;
  dueDate: string | null;
  paidAt?: string | null;
  pdfStoragePath: string | null; // Path in Supabase Storage
  pdfFileName: string | null;
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
  onError,
  invoice,
  onCancel,
}: {
  onSuccess?: () => void;
  onError?: () => void;
  invoice?: Invoice;
  onCancel?: () => void;
}) {
  // Initialize form values from invoice prop if editing
  const getInitialFormValues = () => {
    if (!invoice) {
      // Calculate default due date (current date + 7 days) for new invoices
      const getDefaultDueDate = () => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString().split("T")[0];
      };
      return {
        organizationId: "",
        projectId: "",
        currency: "EUR" as "USD" | "EUR",
        status: "draft",
        transactionType: "debit" as "debit" | "credit",
        expenseId: "",
        isKOR: false,
        dueDate: getDefaultDueDate(),
        invoiceDate: new Date().toISOString().split("T")[0],
        paidAt: "",
      };
    }
    return {
      organizationId: invoice.organizationId || "",
      projectId: invoice.projectId || "",
      currency: (invoice.currency as "USD" | "EUR") || "EUR",
      status: invoice.status || "draft",
      transactionType:
        (invoice.transactionType as "debit" | "credit") || "debit",
      expenseId: invoice.expenseId || "",
      isKOR: invoice.isKOR !== undefined ? invoice.isKOR : false,
      dueDate: invoice.dueDate
        ? new Date(invoice.dueDate).toISOString().split("T")[0]
        : "",
      invoiceDate: formatDateForInput(invoice.invoiceDate),
      paidAt: formatDateForInput(invoice.paidAt),
    };
  };

  // Format date for HTML date input (YYYY-MM-DD). For edit mode with null, use "" not today.
  function formatDateForInput(
    value: string | Date | null | undefined,
    fallbackToToday = false
  ): string {
    if (value == null || value === "")
      return fallbackToToday ? new Date().toISOString().split("T")[0] : "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
      return fallbackToToday ? new Date().toISOString().split("T")[0] : "";
    return d.toISOString().split("T")[0];
  }

  const initialFormValues = getInitialFormValues();
  const [organizationId, setOrganizationId] = useState<string>(
    initialFormValues.organizationId
  );
  const [projectId, setProjectId] = useState<string>(
    initialFormValues.projectId
  );
  const [currency, setCurrency] = useState<"USD" | "EUR">(
    initialFormValues.currency
  );
  const [status, setStatus] = useState(initialFormValues.status);
  const [transactionType, setTransactionType] = useState<"debit" | "credit">(
    initialFormValues.transactionType
  );
  const [expenseId, setExpenseId] = useState<string>(
    initialFormValues.expenseId
  );
  const isReimbursement = expenseId.trim().length > 0;
  const [isKOR, setIsKOR] = useState<boolean>(initialFormValues.isKOR);
  const [dueDate, setDueDate] = useState(
    initialFormValues.dueDate ||
      (() => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString().split("T")[0];
      })()
  );
  const [invoiceDate, setInvoiceDate] = useState(initialFormValues.invoiceDate);
  const [paidAt, setPaidAt] = useState(initialFormValues.paidAt ?? "");
  // TanStack Query hooks
  const { data: organizationsData, isLoading: isLoadingOrgs } =
    useOrganizations();
  const { data: projectsData, isLoading: isLoadingProjects } = useAllProjects();
  const { data: nextInvoiceNumberData } = useNextInvoiceNumber();
  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();

  const organizations =
    organizationsData
      ?.filter((org) => org.name !== EXO_ORGANIZATION_NAME)
      .map((org) => ({ id: org.id, name: org.name })) || [];
  const nextInvoiceNumber = nextInvoiceNumberData?.invoiceNumber || "";

  const [projects, setProjects] = useState<Project[]>([]);
  const isSubmitting =
    createInvoiceMutation.isPending || updateInvoiceMutation.isPending;
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [invoiceNumberOverride, setInvoiceNumberOverride] = useState<string>(
    invoice?.invoiceNumber || ""
  );
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(() => {
    if (invoice?.lineItems && invoice.lineItems.length > 0) {
      // Normalize lineItems - remove id and order fields
      return invoice.lineItems.map((item) => ({
        description: item.description || "",
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice || "",
        taxPercentage: item.taxPercentage || "21",
      }));
    }
    if (invoice) {
      // When editing, use empty array if no line items
      return [];
    }
    // Only use default item when creating new invoice
    return [
      {
        description: "",
        quantity: "1",
        unitPrice: "",
        taxPercentage: isKOR ? "0" : "21",
      },
    ];
  });
  // Initialize original values from invoice prop if editing
  const getInitialOriginalValues = () => {
    if (!invoice) {
      return {
        organizationId: "",
        projectId: "",
        currency: "EUR" as "USD" | "EUR",
        status: "draft",
        transactionType: "debit" as "debit" | "credit",
        expenseId: "",
        isKOR: false,
        dueDate: "",
        invoiceDate: "",
        paidAt: "",
        lineItems: [] as InvoiceLineItem[],
        pdfStoragePath: null as string | null,
      };
    }
    return {
      organizationId: invoice.organizationId || "",
      projectId: invoice.projectId || "",
      currency: (invoice.currency as "USD" | "EUR") || "EUR",
      status: invoice.status || "draft",
      transactionType:
        (invoice.transactionType as "debit" | "credit") || "debit",
      expenseId: invoice.expenseId || "",
      isKOR: invoice.isKOR !== undefined ? invoice.isKOR : false,
      dueDate: invoice.dueDate
        ? new Date(invoice.dueDate).toISOString().split("T")[0]
        : "",
      invoiceDate: formatDateForInput(invoice.invoiceDate),
      paidAt: formatDateForInput(invoice.paidAt),
      lineItems:
        invoice.lineItems && invoice.lineItems.length > 0
          ? invoice.lineItems.map((item) => ({
              description: item.description || "",
              quantity: item.quantity || "1",
              unitPrice: item.unitPrice || "",
              taxPercentage: item.taxPercentage || "21",
            }))
          : ([] as InvoiceLineItem[]),
      pdfStoragePath: invoice.pdfStoragePath,
    };
  };

  const initialOriginalValues = getInitialOriginalValues();
  const [originalOrganizationId, setOriginalOrganizationId] = useState<string>(
    initialOriginalValues.organizationId
  );
  const [originalProjectId, setOriginalProjectId] = useState<string>(
    initialOriginalValues.projectId
  );
  const [originalCurrency, setOriginalCurrency] = useState<"USD" | "EUR">(
    initialOriginalValues.currency
  );
  const [originalStatus, setOriginalStatus] = useState<string>(
    initialOriginalValues.status
  );
  const [originalTransactionType, setOriginalTransactionType] = useState<
    "debit" | "credit"
  >(initialOriginalValues.transactionType);
  const [originalExpenseId, setOriginalExpenseId] = useState<string>(
    initialOriginalValues.expenseId
  );
  const [originalIsKOR, setOriginalIsKOR] = useState<boolean>(
    initialOriginalValues.isKOR
  );
  const [originalDueDate, setOriginalDueDate] = useState<string>(
    initialOriginalValues.dueDate
  );
  const [originalInvoiceDate, setOriginalInvoiceDate] = useState<string>(
    initialOriginalValues.invoiceDate
  );
  const [originalPaidAt, setOriginalPaidAt] = useState<string>(
    initialOriginalValues.paidAt ?? ""
  );
  const [originalLineItems, setOriginalLineItems] = useState<InvoiceLineItem[]>(
    initialOriginalValues.lineItems
  );
  const [, setOriginalPdfStoragePath] = useState<string | null>(
    initialOriginalValues.pdfStoragePath
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

  // Update original values when invoice prop changes (for key-based remounting, this ensures sync)
  useEffect(() => {
    if (invoice) {
      const orgId = invoice.organizationId || "";
      const projId = invoice.projectId || "";
      const curr = (invoice.currency as "USD" | "EUR") || "EUR";
      const stat = invoice.status || "draft";
      const transType =
        (invoice.transactionType as "debit" | "credit") || "debit";
      const expId = invoice.expenseId || "";
      const kor = invoice.isKOR !== undefined ? invoice.isKOR : false;
      const due = invoice.dueDate
        ? new Date(invoice.dueDate).toISOString().split("T")[0]
        : "";
      const invDate = formatDateForInput(invoice.invoiceDate);
      const paid = formatDateForInput(invoice.paidAt);
      // Normalize lineItems - remove id and order fields for comparison
      const items =
        invoice.lineItems && invoice.lineItems.length > 0
          ? invoice.lineItems.map((item) => ({
              description: item.description || "",
              quantity: item.quantity || "1",
              unitPrice: item.unitPrice || "",
              taxPercentage: item.taxPercentage || "21",
            }))
          : [];
      const pdfPath = invoice.pdfStoragePath;

      // Sync form values when invoice prop changes (ensures correct display when opening edit modal)
      setOrganizationId(orgId);
      setProjectId(projId);
      setCurrency(curr);
      setStatus(stat);
      setTransactionType(transType);
      setExpenseId(expId);
      setIsKOR(kor);
      setDueDate(due);
      setInvoiceDate(invDate);
      setPaidAt(paid);
      setLineItems(items);

      // Update original values for change detection
      setOriginalOrganizationId(orgId);
      setOriginalProjectId(projId);
      setOriginalCurrency(curr);
      setOriginalStatus(stat);
      setOriginalTransactionType(transType);
      setOriginalExpenseId(expId);
      setOriginalIsKOR(kor);
      setOriginalDueDate(due);
      setOriginalInvoiceDate(invDate);
      setOriginalPaidAt(paid);
      setOriginalLineItems(items);
      setOriginalPdfStoragePath(pdfPath);
    } else {
      // Reset original values when not editing
      setOriginalOrganizationId("");
      setOriginalProjectId("");
      setOriginalCurrency("EUR");
      setOriginalStatus("draft");
      setOriginalTransactionType("debit");
      setOriginalExpenseId("");
      setOriginalIsKOR(false);
      setOriginalDueDate("");
      setOriginalInvoiceDate("");
      setOriginalPaidAt("");
      setOriginalLineItems([]);
      setOriginalPdfStoragePath(null);
    }
  }, [invoice]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!invoice) return true; // Always allow creating

    // Normalize projectId for comparison (null vs empty string)
    const currentProjectId = (projectId || "").trim();
    const origProjectId = (originalProjectId || "").trim();

    // Normalize expenseId for comparison
    const currentExpenseId = (expenseId || "").trim();
    const origExpenseId = (originalExpenseId || "").trim();

    // Normalize organizationId
    const currentOrgId = (organizationId || "").trim();
    const origOrgId = (originalOrganizationId || "").trim();

    // Compare line items (deep comparison)
    // Normalize for comparison - only compare relevant fields, ignore id and order
    const normalizeLineItems = (items: InvoiceLineItem[]) => {
      if (!items || items.length === 0) return [];
      // Filter out items that are completely empty (default state)
      const filtered = items.filter(
        (item) =>
          (item.description?.trim() || "") !== "" ||
          (item.quantity?.trim() || "1") !== "1" ||
          (item.unitPrice?.trim() || "") !== "" ||
          ((item.taxPercentage?.trim() || "21") !== "21" &&
            (item.taxPercentage?.trim() || "21") !== "0")
      );
      if (filtered.length === 0) return [];
      // Normalize to only compare relevant fields (ignore id, order, etc.)
      return filtered.map((item) => ({
        description: (item.description || "").trim(),
        quantity: (item.quantity || "1").trim(),
        unitPrice: (item.unitPrice || "").trim(),
        taxPercentage: (item.taxPercentage || "21").trim(),
      }));
    };

    const normalizedLineItems = normalizeLineItems(lineItems);
    const normalizedOriginalLineItems = normalizeLineItems(originalLineItems);
    const lineItemsChanged =
      JSON.stringify(normalizedLineItems) !==
      JSON.stringify(normalizedOriginalLineItems);

    return (
      currentOrgId !== origOrgId ||
      currentProjectId !== origProjectId ||
      currency !== originalCurrency ||
      status !== originalStatus ||
      transactionType !== originalTransactionType ||
      currentExpenseId !== origExpenseId ||
      isKOR !== originalIsKOR ||
      dueDate !== originalDueDate ||
      invoiceDate !== originalInvoiceDate ||
      paidAt !== originalPaidAt ||
      lineItemsChanged ||
      pdfFile !== null ||
      removePdf
    );
  }, [
    invoice,
    organizationId,
    originalOrganizationId,
    projectId,
    originalProjectId,
    currency,
    originalCurrency,
    status,
    originalStatus,
    transactionType,
    originalTransactionType,
    expenseId,
    originalExpenseId,
    isKOR,
    originalIsKOR,
    dueDate,
    originalDueDate,
    invoiceDate,
    originalInvoiceDate,
    paidAt,
    originalPaidAt,
    lineItems,
    originalLineItems,
    pdfFile,
    removePdf,
  ]);

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
    if (isKOR || isReimbursement) {
      setLineItems((items) =>
        items.map((item) => ({ ...item, taxPercentage: "0" }))
      );
    }
  }, [isKOR, isReimbursement]);

  // Reimbursements imply 0% tax, but are not KOR
  useEffect(() => {
    if (isReimbursement && isKOR) {
      setIsKOR(false);
    }
  }, [isReimbursement, isKOR]);

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

    // Validate line items for non-reimbursement invoices only.
    // Reimbursements are derived from the linked expense server-side.
    let total = calculateTotal();
    if (!isReimbursement) {
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

      if (total <= 0) {
        toast.error("Total amount must be greater than 0");
        return;
      }
    } else {
      // For reimbursements the backend will set amount from the expense; send a placeholder.
      total = 0;
    }

    try {
      let pdfStoragePath: string | null = null;
      let pdfFileName: string | null = null;
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
          pdfSizeBytes = uploadResult.sizeBytes;
        } catch (error) {
          console.error("Error uploading PDF:", error);
          toast.error("Failed to upload PDF file. Please try again.");
          return;
        }
      } else if (removePdf) {
        // PDF is being removed
        pdfStoragePath = null;
        pdfFileName = null;
        pdfSizeBytes = null;
      }
      // If neither pdfFile nor removePdf, we don't set PDF fields
      // This means the API will preserve the existing PDF (if any)

      if (invoice) {
        const updateData: UpdateInvoiceData = {
          id: invoice.id,
          organizationId,
          projectId: projectId || null,
          expenseId: expenseId.trim() || null,
          amount: total.toFixed(2),
          currency,
          status,
          transactionType,
          isKOR,
          invoiceDate: invoiceDate || new Date().toISOString().split("T")[0],
          dueDate: dueDate || null,
          paidAt: paidAt ? new Date(paidAt) : null,
          // Only include PDF fields if they're explicitly set (new file or removal)
          // If undefined, the API will preserve the existing PDF
          ...(pdfFile || removePdf
            ? {
                pdfStoragePath: pdfStoragePath ?? null,
                pdfFileName: pdfFileName ?? null,
                pdfSizeBytes: pdfSizeBytes ?? null,
              }
            : {}),
          ...(isReimbursement
            ? {}
            : {
                lineItems: lineItems.map((item, index) => ({
                  ...item,
                  order: index,
                })),
              }),
        };
        updateInvoiceMutation.mutate(updateData, {
          onSuccess: () => {
            toast.success("Invoice updated successfully");
            onSuccess?.();
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to update invoice");
          },
        });
      } else {
        const createData: CreateInvoiceData = {
          organizationId,
          projectId: projectId || null,
          expenseId: expenseId.trim() || null,
          amount: total.toFixed(2),
          currency,
          status,
          type: "manual",
          transactionType,
          isKOR,
          invoiceDate: invoiceDate || new Date().toISOString().split("T")[0],
          dueDate: dueDate || null,
          pdfStoragePath,
          pdfFileName,
          pdfSizeBytes,
          invoiceNumber: invoiceNumberOverride.trim() || null,
          ...(isReimbursement
            ? {}
            : {
                lineItems: lineItems.map((item, index) => ({
                  ...item,
                  order: index,
                })),
              }),
        };
        // Optimistic close: close modal immediately for faster workflow
        onSuccess?.();

        createInvoiceMutation.mutate(createData, {
          onSuccess: () => {
            toast.success("Invoice created successfully");
            setOrganizationId("");
            setProjectId("");
            setExpenseId("");
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
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to create invoice");
            onError?.(); // Reopen modal on failure so user can retry
          },
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${invoice ? "update" : "create"} invoice`
      );
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
      <div className="space-y-2">
        <Label htmlFor="invoice-expense-id">Expense ID (Reimbursement)</Label>
        <Input
          id="invoice-expense-id"
          value={expenseId}
          onChange={(e) => setExpenseId(e.target.value)}
          placeholder="Paste an expense UUID to mark this invoice as a reimbursement"
        />
        <p className="text-xs text-muted-foreground">
          When set, this invoice becomes a reimbursement linked 1:1 to that
          expense and automatically uses 0% tax.
        </p>
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
        {invoice && status === "paid" && (
          <div className="space-y-2">
            <Label
              htmlFor="invoice-paid-at"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Paid at
            </Label>
            <Input
              id="invoice-paid-at"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is-kor"
          checked={isKOR}
          onCheckedChange={(checked) => setIsKOR(checked === true)}
          disabled={isReimbursement}
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
            disabled={isReimbursement}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        {isReimbursement && (
          <p className="text-sm text-muted-foreground">
            This invoice is a reimbursement. Items and amounts will be generated
            from the linked expense.
          </p>
        )}
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
                <div className="col-span-12 lg:col-span-5 space-y-1 min-w-0">
                  <Label className="text-xs">Description *</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(index, "description", e.target.value)
                    }
                    placeholder="Item description"
                    required
                    rows={2}
                    className="w-full min-h-[60px] resize-y"
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
                    type="text"
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Replace comma with dot for decimal separator
                      value = value.replace(/,/g, ".");
                      // Only allow numbers and one decimal point
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        updateLineItem(index, "unitPrice", value);
                      }
                    }}
                    placeholder="0.00"
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
                    disabled={isKOR || isReimbursement}
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
                {isReimbursement ? "—" : total.toFixed(2)}
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
                  // Download the PDF via the API endpoint with cache-busting
                  window.open(
                    `/api/invoices/${invoice.id}/download?v=${Date.now()}`,
                    "_blank"
                  );
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
          disabled={!hasChanges || isSubmitting}
          className={invoice && onCancel ? "flex-1" : "w-full"}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {invoice ? "Updating..." : "Creating..."}
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              {invoice ? "Update Invoice" : "Create Invoice"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
