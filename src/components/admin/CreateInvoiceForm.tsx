"use client";

import { useState, useEffect } from "react";
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
import { FileText, DollarSign, Calendar, Upload, X, Plus, Trash2 } from "lucide-react";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";
import { EXO_ORGANIZATION_NAME } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";

interface Organization {
  id: string;
  name: string;
}

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
  dueDate: string | null;
  pdfUrl: string | null;
  pdfFileName: string | null;
  pdfFileType: string | null;
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
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate
      ? new Date(invoice.dueDate).toISOString().split("T")[0]
      : ""
  );
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
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

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations");
        if (response.ok) {
          const data = await response.json();
          const filteredData = data.filter(
            (org: Organization) => org.name !== EXO_ORGANIZATION_NAME
          );
          setOrganizations(filteredData);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setIsLoadingOrgs(false);
      }
    };

    fetchOrganizations();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!organizationId) {
        setProjects([]);
        setIsLoadingProjects(false);
        return;
      }

      setIsLoadingProjects(true);
      try {
        const response = await fetch("/api/projects");
        if (response.ok) {
          const data = await response.json();
          const filteredProjects = data
            .filter((p: any) => p.project.organizationId === organizationId)
            .map((p: any) => ({
              id: p.project.id,
              title: p.project.title,
              organizationId: p.project.organizationId,
              subtotal: p.project.subtotal,
              currency: p.project.currency,
            }));
          setProjects(filteredProjects);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [organizationId]);

  // When KOR is enabled, set all tax percentages to 0
  useEffect(() => {
    if (isKOR) {
      setLineItems((items) =>
        items.map((item) => ({ ...item, taxPercentage: "0" }))
      );
    }
  }, [isKOR]);

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
      let pdfUrl: string | null = null;
      let pdfFileName: string | null = null;
      let pdfFileType: string | null = null;

      if (pdfFile) {
        const reader = new FileReader();
        pdfUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfFile);
        });
        pdfFileName = pdfFile.name;
        pdfFileType = pdfFile.type;
      } else if (invoice?.pdfUrl && !removePdf) {
        pdfUrl = invoice.pdfUrl;
        pdfFileName = invoice.pdfFileName;
        pdfFileType = invoice.pdfFileType;
      }

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
            dueDate: dueDate || null,
            pdfUrl,
            pdfFileName,
            pdfFileType,
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
            pdfUrl,
            pdfFileName,
            pdfFileType,
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
          <Label htmlFor="invoice-number">Invoice Number (Optional)</Label>
          <Input
            id="invoice-number"
            value={invoiceNumberOverride}
            onChange={(e) => setInvoiceNumberOverride(e.target.value)}
            placeholder="Leave empty to auto-generate (e.g., INV-2025-0001)"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to auto-generate. Format: INV-YYYY-NNNN
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
        <Label
          htmlFor="is-kor"
          className="text-sm font-normal cursor-pointer"
        >
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
                    step="0.01"
                    min="0"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(index, "quantity", e.target.value)
                    }
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
          {invoice?.pdfUrl && !pdfFile && !removePdf && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <FileText className="h-4 w-4" />
              <span className="text-sm flex-1">
                {invoice.pdfFileName || "Existing PDF"}
              </span>
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
