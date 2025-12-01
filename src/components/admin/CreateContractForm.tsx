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
import { FileText, Upload, X } from "lucide-react";

interface Project {
  id: string;
  title: string;
}

export function CreateContractForm({ onSuccess }: { onSuccess?: () => void }) {
  const [projectId, setProjectId] = useState<string>("");
  const [name, setName] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        if (response.ok) {
          const data = await response.json();
          setProjects(
            data.map((p: any) => ({ id: p.project.id, title: p.project.title }))
          );
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
      let fileUrl: string | null = null;

      // Convert PDF file to base64 if provided
      if (contractFile) {
        const reader = new FileReader();
        fileUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(contractFile);
        });
      }

      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          fileUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create contract");
      }

      toast.success("Contract created successfully");
      setProjectId("");
      setName("");
      setContractFile(null);
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
        <Label htmlFor="contract-file" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Contract PDF (Optional)
        </Label>
        <div className="space-y-2">
          <Input
            id="contract-file"
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.type !== "application/pdf") {
                  toast.error("Please upload a PDF file");
                  return;
                }
                if (file.size > 10 * 1024 * 1024) {
                  toast.error("File size must be less than 10MB");
                  return;
                }
                setContractFile(file);
              }
            }}
            className="cursor-pointer"
          />
          {contractFile && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <FileText className="h-4 w-4" />
              <span className="text-sm flex-1">{contractFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setContractFile(null)}
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
      <Button type="submit" disabled={isSubmitting} className="w-full">
        <FileText className="h-4 w-4 mr-2" />
        {isSubmitting ? "Creating..." : "Create Contract"}
      </Button>
    </form>
  );
}
