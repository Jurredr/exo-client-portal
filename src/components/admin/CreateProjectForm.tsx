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
import { FolderPlus, DollarSign, Calendar } from "lucide-react";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";
import { getProjectStages, getDefaultStage } from "@/lib/constants/stages";

interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const PROJECT_STATUSES: StatusOption[] = [
  { value: "active", label: "Active", state: "bg-green-500" },
  { value: "completed", label: "Completed", state: "bg-blue-500" },
  { value: "on_hold", label: "On Hold", state: "bg-yellow-500" },
  { value: "cancelled", label: "Cancelled", state: "bg-red-500" },
];

export function CreateProjectForm({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<"client" | "labs">("client");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [subtotal, setSubtotal] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EUR">("EUR");
  const [status, setStatus] = useState("active");
  const [stage, setStage] = useState(getDefaultStage("client"));
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [exoOrgId, setExoOrgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations");
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data);
          // Find EXO organization
          const exoOrg = data.find((org: Organization) => org.name === "EXO");
          if (exoOrg) {
            setExoOrgId(exoOrg.id);
          }
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setIsLoadingOrgs(false);
      }
    };

    fetchOrganizations();
  }, []);

  // Auto-select EXO organization when EXO Labs is selected
  useEffect(() => {
    if (projectType === "labs" && exoOrgId) {
      setOrganizationId(exoOrgId);
      setStage(getDefaultStage("labs"));
    } else if (projectType === "client" && organizationId === exoOrgId) {
      setOrganizationId("");
      setStage(getDefaultStage("client"));
    }
  }, [projectType, exoOrgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    // Subtotal is required for client projects, optional for EXO Labs
    if (projectType === "client" && !subtotal.trim()) {
      toast.error("Subtotal is required for client projects");
      return;
    }

    if (!organizationId) {
      toast.error("Organization is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          organizationId,
          type: projectType,
          subtotal: projectType === "labs" ? null : subtotal.trim(),
          currency,
          status,
          stage,
          startDate: startDate || null,
          deadline: projectType === "labs" ? null : deadline || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create project");
      }

      toast.success("Project created successfully");
      setTitle("");
      setDescription("");
      setProjectType("client");
      setOrganizationId("");
      setSubtotal("");
      setCurrency("EUR");
      setStatus("active");
      setStage(getDefaultStage("client"));
      setStartDate("");
      setDeadline("");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-type">Project Type *</Label>
        <Select
          value={projectType}
          onValueChange={(value) => setProjectType(value as "client" | "labs")}
        >
          <SelectTrigger id="project-type" className="w-full">
            <SelectValue placeholder="Select project type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">Client Project</SelectItem>
            <SelectItem value="labs">EXO Labs</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-title">Project Title *</Label>
        <Input
          id="project-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            projectType === "labs" ? "EXO Website" : "Website Redesign"
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Project description..."
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-org">Organization *</Label>
        <Select
          value={organizationId}
          onValueChange={setOrganizationId}
          disabled={isLoadingOrgs || projectType === "labs"}
          required
        >
          <SelectTrigger id="project-org" className="w-full">
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
        {projectType === "labs" && (
          <p className="text-xs text-muted-foreground">
            EXO Labs projects are automatically assigned to EXO organization
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="project-status">Status</Label>
          <StatusCombobox
            options={PROJECT_STATUSES}
            value={status}
            onValueChange={setStatus}
            placeholder="Select status..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-stage">Stage</Label>
          <StatusCombobox
            options={getProjectStages(projectType)}
            value={stage}
            onValueChange={setStage}
            placeholder="Select stage..."
          />
        </div>
      </div>
      {projectType === "client" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="project-subtotal" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Subtotal *
            </Label>
            <Input
              id="project-subtotal"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
              placeholder="5000.00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-currency">Currency *</Label>
            <Select
              value={currency}
              onValueChange={(value) => setCurrency(value as "USD" | "EUR")}
            >
              <SelectTrigger id="project-currency" className="w-full">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label
            htmlFor="project-start-date"
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Start Date
          </Label>
          <Input
            id="project-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        {projectType === "client" && (
          <div className="space-y-2">
            <Label
              htmlFor="project-deadline"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Deadline
            </Label>
            <Input
              id="project-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        <FolderPlus className="h-4 w-4 mr-2" />
        {isSubmitting ? "Creating..." : "Create Project"}
      </Button>
    </form>
  );
}
