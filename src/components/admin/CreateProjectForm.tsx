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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { FolderPlus, DollarSign, Calendar } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const PROJECT_STAGES = [
  { value: "kick_off", label: "Kick Off" },
  { value: "pay_first", label: "Pay First" },
  { value: "deliver", label: "Deliver" },
  { value: "revise", label: "Revise" },
  { value: "pay_final", label: "Pay Final" },
  { value: "completed", label: "Completed" },
];

const PROJECT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
];

export function CreateProjectForm({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [subtotal, setSubtotal] = useState("");
  const [status, setStatus] = useState("active");
  const [stage, setStage] = useState("kick_off");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    if (!subtotal.trim()) {
      toast.error("Subtotal is required");
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
          subtotal: subtotal.trim(),
          status,
          stage,
          startDate: startDate || null,
          deadline: deadline || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create project");
      }

      toast.success("Project created successfully");
      setTitle("");
      setDescription("");
      setOrganizationId("");
      setSubtotal("");
      setStatus("active");
      setStage("kick_off");
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderPlus className="h-5 w-5" />
          Create Project
        </CardTitle>
        <CardDescription>
          Create and configure a new project for a client organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">Project Title *</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website Redesign"
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
              disabled={isLoadingOrgs}
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="project-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-stage">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger id="project-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-start-date" className="flex items-center gap-2">
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
            <div className="space-y-2">
              <Label htmlFor="project-deadline" className="flex items-center gap-2">
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
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            <FolderPlus className="h-4 w-4 mr-2" />
            {isSubmitting ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

