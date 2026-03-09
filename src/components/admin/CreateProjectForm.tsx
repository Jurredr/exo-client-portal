"use client";

import { useState, useMemo } from "react";
import { useOrganizations } from "@/hooks/use-organizations";
import { useCreateProject } from "@/hooks/use-projects";
import { useOffers } from "@/hooks/use-offers";
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
import { FolderPlus, DollarSign, Calendar, Sparkles } from "lucide-react";
import { GenerateProjectDescriptionModal } from "./GenerateProjectDescriptionModal";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";
import { getProjectStages, getDefaultStage } from "@/lib/constants/stages";

const PROJECT_STATUSES: StatusOption[] = [
  { value: "lead", label: "Discussing", state: "bg-purple-500" },
  { value: "active", label: "Active", state: "bg-green-500" },
  { value: "completed", label: "Completed", state: "bg-blue-500" },
  { value: "on_hold", label: "On Hold", state: "bg-yellow-500" },
  { value: "cancelled", label: "Cancelled", state: "bg-red-500" },
];

export function CreateProjectForm({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: () => void;
}) {
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
  const [isGenerateDescriptionOpen, setIsGenerateDescriptionOpen] =
    useState(false);
  // TanStack Query hooks
  const { data: organizationsData, isLoading: isLoadingOrgs } =
    useOrganizations();
  const { data: allOffersData } = useOffers(1, 100);
  const allOffers =
    allOffersData?.data?.map((d) => d.offer).filter((o) => o) || [];
  const organizations = useMemo(
    () => organizationsData || [],
    [organizationsData]
  );

  const exoOrgId = useMemo(
    () => organizations.find((o) => o.name === "EXO")?.id ?? null,
    [organizations]
  );
  const createProjectMutation = useCreateProject();
  const isSubmitting = createProjectMutation.isPending;

  const handleProjectTypeChange = (value: string) => {
    const newType = value as "client" | "labs";
    setProjectType(newType);
    if (newType === "labs" && exoOrgId) {
      setOrganizationId(exoOrgId);
      setStage(getDefaultStage("labs"));
    } else if (newType === "client" && organizationId === exoOrgId) {
      setOrganizationId("");
      setStage(getDefaultStage("client"));
    }
  };

  const handleOrganizationChange = (value: string) => {
    if (projectType === "client" && value === exoOrgId) {
      setOrganizationId("");
    } else {
      setOrganizationId(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    // Subtotal is optional for all project types

    if (!organizationId) {
      toast.error("Organization is required");
      return;
    }

    // Optimistic close: close modal immediately for faster workflow
    onSuccess?.();

    createProjectMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        organizationId,
        type: projectType,
        subtotal: subtotal && subtotal.trim() ? subtotal.trim() : null,
        currency: currency || "EUR",
        status,
        stage,
        startDate: startDate || null,
        deadline: projectType === "labs" ? null : deadline || null,
      },
      {
        onSuccess: () => {
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
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to create project");
          onError?.(); // Reopen modal on failure so user can retry
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-type">Project Type *</Label>
        <Select value={projectType} onValueChange={handleProjectTypeChange}>
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="project-description">Description</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsGenerateDescriptionOpen(true)}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Generate description
          </Button>
        </div>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Project description..."
          rows={3}
        />
      </div>
      <GenerateProjectDescriptionModal
        open={isGenerateDescriptionOpen}
        onOpenChange={setIsGenerateDescriptionOpen}
        projectTitle={title || "New project"}
        offers={allOffers
          .filter((o) => (o as { content?: string | null }).content)
          .map((o) => ({
            id: o.id,
            note: o.note,
            fileName: o.fileName,
            status: o.status,
          }))}
        onGenerated={(desc) => setDescription(desc)}
      />
      <div className="space-y-2">
        <Label htmlFor="project-org">Organization *</Label>
        <Select
          value={organizationId}
          onValueChange={handleOrganizationChange}
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
            <Label
              htmlFor="project-subtotal"
              className="flex items-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Subtotal
            </Label>
            <Input
              id="project-subtotal"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
              placeholder="5000.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-currency">Currency</Label>
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
