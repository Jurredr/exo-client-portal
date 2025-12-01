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

interface Organization {
  id: string;
  name: string;
}

interface Project {
  id: string;
  title: string;
  organizationId: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  projectId: string | null;
  amount: string;
  currency: string;
  status: string;
  description: string | null;
  dueDate: string | null;
  pdfUrl: string | null;
  pdfFileName: string | null;
  pdfFileType: string | null;
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
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : ""
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
            .filter(
              (p: any) => p.project.organizationId === organizationId
            )
            .map((p: any) => ({
              id: p.project.id,
              title: p.project.title,
              organizationId: p.project.organizationId,
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
        setDueDate("");
        setPdfFile(null);
        setInvoiceNumberOverride("");
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
          onValueChange={(value) => setProjectId(value === "none" ? "" : value)}
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
          <Label htmlFor="invoice-amount" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Amount *
          </Label>
          <Input
            id="invoice-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000.00"
            required
          />
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
