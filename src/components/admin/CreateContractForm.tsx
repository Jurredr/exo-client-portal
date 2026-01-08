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
import { Checkbox } from "@/components/ui/checkbox";
import { ProjectCombobox } from "@/components/project-combobox";
import { EXO_ORGANIZATION_NAME } from "@/lib/constants";

interface Project {
  id: string;
  title: string;
}

interface Organization {
  id: string;
  name: string;
}

interface Contract {
  id: string;
  name: string;
  organizationId: string;
  fileUrl: string | null;
  requiresPortalSignature: boolean;
  projects?: Array<{ id: string; title: string }>;
}

export function CreateContractForm({ 
  onSuccess, 
  contract 
}: { 
  onSuccess?: () => void;
  contract?: Contract;
}) {
  const [organizationId, setOrganizationId] = useState<string>(
    contract?.organizationId || ""
  );
  const [projectIds, setProjectIds] = useState<string[]>(
    contract?.projects?.map((p) => p.id) || []
  );
  const [name, setName] = useState(contract?.name || "");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [requiresPortalSignature, setRequiresPortalSignature] = useState<boolean>(
    contract?.requiresPortalSignature !== undefined ? contract.requiresPortalSignature : true
  );
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
        // If editing and contract has projects from other orgs, still show them
        if (contract?.projects && contract.projects.length > 0) {
          setProjects(contract.projects);
          setIsLoadingProjects(false);
        } else {
          setProjects([]);
          setIsLoadingProjects(false);
        }
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
            }));
          
          // If editing, also include projects from other organizations that are already associated
          if (contract?.projects) {
            const existingProjectIds = new Set(filteredProjects.map((p: Project) => p.id));
            contract.projects.forEach((p) => {
              if (!existingProjectIds.has(p.id)) {
                filteredProjects.push(p);
              }
            });
          }
          
          setProjects(filteredProjects);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [organizationId, contract]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast.error("Organization is required");
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

      const url = "/api/contracts";
      const method = contract ? "PATCH" : "POST";
      const body = contract
        ? {
            id: contract.id,
            organizationId,
            projectIds,
            name: name.trim(),
            fileUrl: contractFile ? fileUrl : undefined, // Only send fileUrl if a new file was uploaded
            requiresPortalSignature,
          }
        : {
            organizationId,
            projectIds,
            name: name.trim(),
            fileUrl,
            requiresPortalSignature,
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
        throw new Error(error.error || `Failed to ${contract ? "update" : "create"} contract`);
      }

      toast.success(`Contract ${contract ? "updated" : "created"} successfully`);
      if (!contract) {
        setOrganizationId("");
        setProjectIds([]);
        setName("");
        setContractFile(null);
        setRequiresPortalSignature(true);
      }
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
        <Label htmlFor="contract-org">Organization *</Label>
        <Select
          value={organizationId}
          onValueChange={(value) => {
            setOrganizationId(value);
            setProjectIds([]);
          }}
          disabled={isLoadingOrgs}
          required
        >
          <SelectTrigger id="contract-org" className="w-full">
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
        <Label htmlFor="contract-projects">Projects (Optional)</Label>
        <ProjectCombobox
          projects={projects}
          selectedIds={projectIds}
          onSelectionChange={setProjectIds}
          placeholder={organizationId ? "Select projects (optional)..." : "Select an organization first"}
          disabled={isLoadingProjects || !organizationId}
        />
        <p className="text-xs text-muted-foreground">
          Select one or more projects for this contract (e.g., for NDAs shared across multiple projects). Leave empty if the project is not in the portal.
        </p>
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
      <div className="space-y-4">
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
        <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50">
          <Checkbox
            id="requires-portal-signature"
            checked={requiresPortalSignature}
            onCheckedChange={(checked) => setRequiresPortalSignature(checked === true)}
          />
          <Label
            htmlFor="requires-portal-signature"
            className="text-sm font-normal cursor-pointer"
          >
            Requires client signature through portal
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {requiresPortalSignature
            ? "Client will need to sign this contract through the portal."
            : "This contract is already signed or doesn't require portal signing. It will be marked as signed automatically."}
        </p>
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        <FileText className="h-4 w-4 mr-2" />
        {isSubmitting 
          ? (contract ? "Updating..." : "Creating...") 
          : (contract ? "Update Contract" : "Create Contract")}
      </Button>
    </form>
  );
}
