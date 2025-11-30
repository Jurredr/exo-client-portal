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
import { FileText } from "lucide-react";

interface Project {
  id: string;
  title: string;
}

export function CreateContractForm({ onSuccess }: { onSuccess?: () => void }) {
  const [projectId, setProjectId] = useState<string>("");
  const [name, setName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

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

    if (!projectId) {
      toast.error("Project is required");
      return;
    }

    if (!name.trim()) {
      toast.error("Contract name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          fileUrl: fileUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create contract");
      }

      toast.success("Contract created successfully");
      setProjectId("");
      setName("");
      setFileUrl("");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create contract"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contract-project">Project *</Label>
        <Select
          value={projectId}
          onValueChange={setProjectId}
          disabled={isLoadingProjects}
          required
        >
          <SelectTrigger id="contract-project" className="w-full">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contract-name">Contract Name *</Label>
        <Input
          id="contract-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Service Agreement"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contract-file-url">File URL (Optional)</Label>
        <Input
          id="contract-file-url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://example.com/contract.pdf"
          type="url"
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        <FileText className="h-4 w-4 mr-2" />
        {isSubmitting ? "Creating..." : "Create Contract"}
      </Button>
    </form>
  );
}


