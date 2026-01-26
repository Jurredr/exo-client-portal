"use client";

import { useState, useEffect, useMemo } from "react";
import { useOrganizations } from "@/hooks/use-organizations";
import { useAllProjects } from "@/hooks/use-projects";
import {
  useCreateContract,
  useUpdateContract,
  type CreateContractData,
  type UpdateContractData,
} from "@/hooks/use-contracts";
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
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ProjectCombobox } from "@/components/project-combobox";
import { EXO_ORGANIZATION_NAME } from "@/lib/constants";

interface Project {
  id: string;
  title: string;
}

// interface Organization {
//   id: string;
//   name: string;
// }

interface Contract {
  id: string;
  name: string;
  organizationId: string;
  fileStoragePath: string | null; // Path in Supabase Storage
  fileName: string | null;
  fileSizeBytes: number | null;
  requiresPortalSignature: boolean;
  projects?: Array<{ id: string; title: string }>;
}

export function CreateContractForm({
  onSuccess,
  contract,
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
  const [requiresPortalSignature, setRequiresPortalSignature] =
    useState<boolean>(
      contract?.requiresPortalSignature !== undefined
        ? contract.requiresPortalSignature
        : true
    );
  // TanStack Query hooks
  const { data: organizationsData, isLoading: isLoadingOrgs } =
    useOrganizations();
  const { data: projectsData, isLoading: isLoadingProjects } = useAllProjects();

  const organizations =
    organizationsData?.filter((org) => org.name !== EXO_ORGANIZATION_NAME) ||
    [];

  const [projects, setProjects] = useState<Project[]>([]);
  const createContractMutation = useCreateContract();
  const updateContractMutation = useUpdateContract();
  const isSubmitting =
    createContractMutation.isPending || updateContractMutation.isPending;
  const [originalOrganizationId, setOriginalOrganizationId] =
    useState<string>("");
  const [originalProjectIds, setOriginalProjectIds] = useState<string[]>([]);
  const [originalName, setOriginalName] = useState<string>("");
  const [originalRequiresPortalSignature, setOriginalRequiresPortalSignature] =
    useState<boolean>(true);
  const [originalFileStoragePath, setOriginalFileStoragePath] = useState<
    string | null
  >(null);

  // Store original values when editing
  useEffect(() => {
    if (contract) {
      const orgId = contract.organizationId || "";
      const projIds = contract.projects?.map((p) => p.id) || [];
      const contractName = contract.name || "";
      const reqSig =
        contract.requiresPortalSignature !== undefined
          ? contract.requiresPortalSignature
          : true;
      const filePath = contract.fileStoragePath;

      setOriginalOrganizationId(orgId);
      setOriginalProjectIds(projIds);
      setOriginalName(contractName);
      setOriginalRequiresPortalSignature(reqSig);
      setOriginalFileStoragePath(filePath);
    } else {
      // Reset original values when not editing
      setOriginalOrganizationId("");
      setOriginalProjectIds([]);
      setOriginalName("");
      setOriginalRequiresPortalSignature(true);
      setOriginalFileStoragePath(null);
    }
  }, [contract]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!contract) return true; // Always allow creating

    // Compare project IDs (order doesn't matter)
    const currentProjectIds = [...projectIds].sort().join(",");
    const originalProjectIdsStr = [...originalProjectIds].sort().join(",");

    return (
      organizationId !== originalOrganizationId ||
      currentProjectIds !== originalProjectIdsStr ||
      name.trim() !== originalName ||
      requiresPortalSignature !== originalRequiresPortalSignature ||
      contractFile !== null
    );
  }, [
    contract,
    organizationId,
    originalOrganizationId,
    projectIds,
    originalProjectIds,
    name,
    originalName,
    requiresPortalSignature,
    originalRequiresPortalSignature,
    contractFile,
  ]);

  // Filter projects by organization
  useEffect(() => {
    if (!organizationId) {
      // If editing and contract has projects from other orgs, still show them
      if (contract?.projects && contract.projects.length > 0) {
        setProjects(contract.projects);
      } else {
        setProjects([]);
      }
      return;
    }

    const filteredProjects =
      projectsData
        ?.filter((p) => p.project.organizationId === organizationId)
        .map((p) => ({
          id: p.project.id,
          title: p.project.title,
        })) || [];

    // If editing, also include projects from other organizations that are already associated
    if (contract?.projects) {
      const existingProjectIds = new Set(
        filteredProjects.map((p: Project) => p.id)
      );
      contract.projects.forEach((p) => {
        if (!existingProjectIds.has(p.id)) {
          filteredProjects.push(p);
        }
      });
    }

    setProjects(filteredProjects);
  }, [organizationId, contract, projectsData]);

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

    try {
      let fileStoragePath: string | null = null;
      let fileName: string | null = null;
      let fileSizeBytes: number | null = null;

      // Upload PDF to Storage if a new file is provided
      if (contractFile) {
        try {
          const formData = new FormData();
          formData.append("file", contractFile);
          if (contract?.id) {
            formData.append("contractId", contract.id);
          }

          const uploadResponse = await fetch("/api/contracts/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.error || "Failed to upload PDF");
          }

          const uploadResult = await uploadResponse.json();
          fileStoragePath = uploadResult.storagePath;
          fileName = uploadResult.fileName;
          fileSizeBytes = uploadResult.sizeBytes;
        } catch (error) {
          console.error("Error uploading PDF:", error);
          toast.error("Failed to upload PDF file. Please try again.");
          return;
        }
      }

      if (contract) {
        const updateData: UpdateContractData = {
          id: contract.id,
          organizationId,
          projectIds,
          name: name.trim(),
          requiresPortalSignature,
          // Only send file fields if a new file was uploaded
          ...(contractFile
            ? {
                fileStoragePath: fileStoragePath ?? null,
                fileName: fileName ?? null,
                fileSizeBytes: fileSizeBytes ?? null,
              }
            : {}),
        };
        updateContractMutation.mutate(updateData, {
          onSuccess: () => {
            toast.success("Contract updated successfully");
            onSuccess?.();
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to update contract");
          },
        });
      } else {
        const createData: CreateContractData = {
          organizationId,
          projectIds,
          name: name.trim(),
          fileStoragePath,
          fileName,
          fileSizeBytes,
          requiresPortalSignature,
        };
        createContractMutation.mutate(createData, {
          onSuccess: () => {
            toast.success("Contract created successfully");
            setOrganizationId("");
            setProjectIds([]);
            setName("");
            setContractFile(null);
            setRequiresPortalSignature(true);
            onSuccess?.();
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to create contract");
          },
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create contract"
      );
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
          placeholder={
            organizationId
              ? "Select projects (optional)..."
              : "Select an organization first"
          }
          disabled={isLoadingProjects || !organizationId}
        />
        <p className="text-xs text-muted-foreground">
          Select one or more projects for this contract (e.g., for NDAs shared
          across multiple projects). Leave empty if the project is not in the
          portal.
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
            onCheckedChange={(checked) =>
              setRequiresPortalSignature(checked === true)
            }
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
      <Button
        type="submit"
        disabled={!hasChanges || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {contract ? "Updating..." : "Creating..."}
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            {contract ? "Update Contract" : "Create Contract"}
          </>
        )}
      </Button>
    </form>
  );
}
