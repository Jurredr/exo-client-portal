"use client";

import { useState, useEffect } from "react";
import {
  useCreateOffer,
  useUpdateOffer,
  OFFER_STATUS_OPTIONS,
} from "@/hooks/use-offers";
import { useAllProjects } from "@/hooks/use-projects";
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
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { StatusCombobox } from "@/components/status-combobox";

interface Project {
  id: string;
  title: string;
}

interface OfferForEdit {
  id: string;
  projectId: string | null;
  note: string | null;
  status: string;
  fileName: string | null;
}

export function CreateOfferForm({
  offer,
  onSuccess,
  onError,
}: {
  offer?: OfferForEdit;
  onSuccess?: () => void;
  onError?: () => void;
}) {
  const isEdit = !!offer;
  const [projectId, setProjectId] = useState<string>(offer?.projectId || "");
  const [note, setNote] = useState(offer?.note || "");
  const [status, setStatus] = useState<string>(offer?.status || "draft");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { data: projectsData } = useAllProjects();
  const createOfferMutation = useCreateOffer();
  const updateOfferMutation = useUpdateOffer();
  const isSubmitting =
    createOfferMutation.isPending ||
    updateOfferMutation.isPending ||
    isUploading;

  useEffect(() => {
    if (offer) {
      setProjectId(offer.projectId || "");
      setNote(offer.note || "");
      setStatus(offer.status || "draft");
    } else {
      setProjectId("");
      setNote("");
      setStatus("draft");
      setFile(null);
    }
  }, [offer?.id]);

  const projects: Project[] =
    projectsData?.map((item: { project: Project }) => item.project) || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEdit) {
      setIsUploading(true);
      try {
        let fileStoragePath: string | null | undefined;
        let fileName: string | null | undefined;
        let fileSizeBytes: number | null | undefined;

        // If a new file is selected in edit mode, upload it first
        if (file) {
          const formData = new FormData();
          formData.append("file", file);

          const uploadResponse = await fetch("/api/offers/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json().catch(() => null);
            throw new Error(error?.error || "Failed to upload file");
          }

          const uploadResult = await uploadResponse.json();
          fileStoragePath = uploadResult.storagePath;
          fileName = uploadResult.fileName;
          fileSizeBytes = uploadResult.sizeBytes;
        }

        updateOfferMutation.mutate(
          {
            id: offer.id,
            projectId: projectId || null,
            note: note.trim() || null,
            status,
            ...(file && {
              fileStoragePath,
              fileName,
              fileSizeBytes,
            }),
          },
          {
            onSuccess: () => {
              toast.success("Offer updated successfully");
              onSuccess?.();
            },
            onError: (error: Error) => {
              toast.error(error.message || "Failed to update offer");
              onError?.();
            },
          }
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update offer"
        );
        onError?.();
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (!file) {
      toast.error("Please upload a file");
      return;
    }

    setIsUploading(true);
    try {
      let fileStoragePath: string | null = null;
      let fileName: string | null = null;
      let fileSizeBytes: number | null = null;

      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/offers/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Failed to upload file");
      }

      const uploadResult = await uploadResponse.json();
      fileStoragePath = uploadResult.storagePath;
      fileName = uploadResult.fileName;
      fileSizeBytes = uploadResult.sizeBytes;

      onSuccess?.();

      createOfferMutation.mutate(
        {
          projectId: projectId || null,
          note: note.trim() || null,
          fileStoragePath,
          fileName,
          fileSizeBytes,
          status,
        },
        {
          onSuccess: () => {
            toast.success("Offer uploaded successfully");
            setProjectId("");
            setNote("");
            setStatus("draft");
            setFile(null);
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to create offer");
            onError?.();
          },
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload offer"
      );
      onError?.();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
      <div className="space-y-2">
        <Label htmlFor="offer-file" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {isEdit ? "File (optional)" : "File *"}
        </Label>
        <Input
          id="offer-file"
          type="file"
          accept=".pdf,.doc,.docx,image/*"
          onChange={handleFileChange}
          className="cursor-pointer"
        />
        {file && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md min-w-0">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="text-sm flex-1 min-w-0 truncate">{file.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {isEdit && offer?.fileName && !file && (
          <div className="rounded-md bg-muted p-2 text-sm text-muted-foreground min-w-0">
            <span className="truncate block">
              Current file: {offer.fileName}
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          PDF, Word, or images. Max 10MB.
          {isEdit ? " Leave empty to keep the current file." : ""}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="offer-project">Project</Label>
        <Select
          value={projectId || "none"}
          onValueChange={(value) => setProjectId(value === "none" ? "" : value)}
        >
          <SelectTrigger id="offer-project" className="w-full">
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

      <div className="space-y-2">
        <Label htmlFor="offer-status">Status</Label>
        <StatusCombobox
          options={OFFER_STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            state: o.state,
          }))}
          value={status}
          onValueChange={setStatus}
          placeholder="Select status..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="offer-note">Note</Label>
        <Textarea
          id="offer-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this offer..."
          rows={3}
          className="resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={(isEdit ? false : !file) || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isEdit ? "Saving..." : "Uploading..."}
          </>
        ) : (
          <>
            {isEdit ? (
              "Save changes"
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Offer
              </>
            )}
          </>
        )}
      </Button>
    </form>
  );
}
