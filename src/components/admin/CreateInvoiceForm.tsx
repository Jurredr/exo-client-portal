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
import { FileText, DollarSign, Calendar } from "lucide-react";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";

interface Organization {
  id: string;
  name: string;
}

interface Project {
  id: string;
  title: string;
}

const INVOICE_STATUSES: StatusOption[] = [
  { value: "draft", label: "Draft", state: "bg-gray-500" },
  { value: "sent", label: "Sent", state: "bg-blue-500" },
  { value: "paid", label: "Paid", state: "bg-green-500" },
  { value: "overdue", label: "Overdue", state: "bg-red-500" },
  { value: "cancelled", label: "Cancelled", state: "bg-gray-400" },
];

export function CreateInvoiceForm({ onSuccess }: { onSuccess?: () => void }) {
  const [organizationId, setOrganizationId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EUR">("EUR");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [dueDate, setDueDate] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations");
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data);
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
      try {
        const response = await fetch("/api/projects");
        if (response.ok) {
          const data = await response.json();
          setProjects(data.map((p: any) => ({ id: p.project.id, title: p.project.title })));
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

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
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId,
          projectId: projectId || null,
          amount: amount.trim(),
          currency,
          description: description.trim() || null,
          status,
          type: "manual",
          dueDate: dueDate || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create invoice");
      }

      toast.success("Invoice created successfully");
      setOrganizationId("");
      setProjectId("");
      setAmount("");
      setCurrency("EUR");
      setDescription("");
      setStatus("draft");
      setDueDate("");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create invoice"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invoice-org">Organization *</Label>
        <Select
          value={organizationId}
          onValueChange={setOrganizationId}
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
          disabled={isLoadingProjects}
        >
          <SelectTrigger id="invoice-project" className="w-full">
            <SelectValue placeholder="Select a project (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
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
          <Select value={currency} onValueChange={(value) => setCurrency(value as "USD" | "EUR")}>
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
      <Button type="submit" disabled={isSubmitting} className="w-full">
        <FileText className="h-4 w-4 mr-2" />
        {isSubmitting ? "Creating..." : "Create Invoice"}
      </Button>
    </form>
  );
}

