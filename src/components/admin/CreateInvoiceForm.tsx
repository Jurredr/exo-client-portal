"use client";

import { useState, useEffect } from "react";
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
import { FileText, DollarSign, Calendar, Upload, X } from "lucide-react";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";
import { EXO_ORGANIZATION_NAME } from "@/lib/constants";
import { calculatePaymentAmount } from "@/lib/utils/currency";
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
  vatIncluded: boolean;
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
  const [amount, setAmount] = useState(invoice?.amount || "");
  const [currency, setCurrency] = useState<"USD" | "EUR">(
    (invoice?.currency as "USD" | "EUR") || "EUR"
  );
  const [description, setDescription] = useState(invoice?.description || "");
  const [status, setStatus] = useState(invoice?.status || "draft");
  const [transactionType, setTransactionType] = useState<"debit" | "credit">(
    (invoice?.transactionType as "debit" | "credit") || "debit"
  );
  const [vatIncluded, setVatIncluded] = useState<boolean>(
    invoice?.vatIncluded !== undefined ? invoice.vatIncluded : true
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
  const [paymentStage, setPaymentStage] = useState<
    "first" | "final" | "custom"
  >("custom");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations");
        if (response.ok) {
          const data = await response.json();
          // Filter out EXO organization
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
          // Filter projects by selected organization
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

  // Auto-calculate amount when project and payment stage change
  useEffect(() => {
    if (
      selectedProject &&
      paymentStage !== "custom" &&
      selectedProject.subtotal
    ) {
      const calculatedAmount = calculatePaymentAmount(
        selectedProject.subtotal,
        paymentStage === "first" ? "pay_first" : "pay_final",
        selectedProject.currency
      );
      if (calculatedAmount) {
        // Remove currency symbol and formatting for storage
        // formatCurrency returns something like "€1,000" or "$1,000"
        const amountValue = calculatedAmount
          .replace(/[€$,\s]/g, "")
          .replace(/\s/g, "");
        setAmount(amountValue);
        setCurrency(selectedProject.currency as "USD" | "EUR");

        // Auto-update description only if it's empty or matches the pattern
        // (to avoid overwriting user-entered descriptions)
        if (!description || description.includes("Payment for")) {
          const stageText = paymentStage === "first" ? "First" : "Final";
          setDescription(
            `Payment for ${selectedProject.title} - ${stageText} payment`
          );
        }
      }
    }
  }, [selectedProject, paymentStage]);

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
      setRemovePdf(false); // Reset remove flag when new file is selected
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast.error("Organization is required");
      return;
    }

    if (!amount.trim()) {
      toast.error("Amount is required");
      return;
    }

    setIsSubmitting(true);
    try {
      let pdfUrl: string | null = null;
      let pdfFileName: string | null = null;
      let pdfFileType: string | null = null;

      // If a new PDF file is provided, use it
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
        // Keep existing PDF if no new file and user didn't remove it
        pdfUrl = invoice.pdfUrl;
        pdfFileName = invoice.pdfFileName;
        pdfFileType = invoice.pdfFileType;
      }
      // If removePdf is true, pdfUrl will be null (removed)

      const url = "/api/invoices";
      const method = invoice ? "PATCH" : "POST";
      const body = invoice
        ? {
            id: invoice.id,
            organizationId,
            projectId: projectId || null,
            amount: amount.trim(),
            currency,
            description: description.trim() || null,
            status,
            transactionType,
            vatIncluded,
            dueDate: dueDate || null,
            pdfUrl,
            pdfFileName,
            pdfFileType,
          }
        : {
            organizationId,
            projectId: projectId || null,
            amount: amount.trim(),
            currency,
            description: description.trim() || null,
            status,
            type: "manual",
            transactionType,
            vatIncluded,
            dueDate: dueDate || null,
            pdfUrl,
            pdfFileName,
            pdfFileType,
            invoiceNumber: invoiceNumberOverride.trim() || null,
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
        setAmount("");
        setCurrency("EUR");
        setDescription("");
        setStatus("draft");
        setTransactionType("debit");
        setVatIncluded(true);
        setDueDate("");
        setPdfFile(null);
        setInvoiceNumberOverride("");
        setPaymentStage("custom");
        setSelectedProject(null);
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
            // Clear project selection when organization changes
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
            if (value === "none") {
              setProjectId("");
              setSelectedProject(null);
              setPaymentStage("custom");
            } else {
              setProjectId(value);
              const project = projects.find((p) => p.id === value);
              setSelectedProject(project || null);
              // Reset to custom if project doesn't have subtotal
              if (project && project.subtotal) {
                setPaymentStage("first"); // Default to first payment
              } else {
                setPaymentStage("custom");
              }
            }
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
      {selectedProject && selectedProject.subtotal && (
        <div className="space-y-2">
          <Label htmlFor="invoice-payment-stage">Payment Stage</Label>
          <Select
            value={paymentStage}
            onValueChange={(value) =>
              setPaymentStage(value as "first" | "final" | "custom")
            }
          >
            <SelectTrigger id="invoice-payment-stage" className="w-full">
              <SelectValue placeholder="Select payment stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">First Payment (50%)</SelectItem>
              <SelectItem value="final">Final Payment (50%)</SelectItem>
              <SelectItem value="custom">Custom Amount</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Auto-calculates 50% of total (including VAT) based on project
            subtotal
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-amount" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Amount *
          </Label>
          <Input
            id="invoice-amount"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              // If user manually edits amount, switch to custom mode
              if (paymentStage !== "custom" && selectedProject) {
                setPaymentStage("custom");
              }
            }}
            placeholder="5000.00"
            required
          />
          {selectedProject && paymentStage !== "custom" && (
            <p className="text-xs text-muted-foreground">
              Auto-calculated from project subtotal. Edit manually to override.
            </p>
          )}
        </div>
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="invoice-description">Description</Label>
        <Textarea
          id="invoice-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Invoice description..."
          rows={3}
        />
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
      <div className="flex items-center space-x-2">
        <Checkbox
          id="vat-included"
          checked={vatIncluded}
          onCheckedChange={(checked) => setVatIncluded(checked === true)}
        />
        <Label
          htmlFor="vat-included"
          className="text-sm font-normal cursor-pointer"
        >
          21% VAT is included in the total amount
        </Label>
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
