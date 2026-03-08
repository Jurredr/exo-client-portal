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
import { Upload, X, FileText, Loader2, Sparkles, Euro } from "lucide-react";
import { StatusCombobox } from "@/components/status-combobox";
import { ProjectCombobox } from "@/components/project-combobox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type CreateMode = "upload" | "ai";

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
  const [createMode, setCreateMode] = useState<CreateMode>("upload");
  const [projectId, setProjectId] = useState<string>(offer?.projectId || "");
  const [note, setNote] = useState(offer?.note || "");
  const [status, setStatus] = useState<string>(offer?.status || "draft");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // AI flow state
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<"NL" | "EN">("NL");
  const [prijssuggestie, setPrijssuggestie] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: projectsData } = useAllProjects();
  const createOfferMutation = useCreateOffer();
  const updateOfferMutation = useUpdateOffer();
  const isSubmitting =
    createOfferMutation.isPending ||
    updateOfferMutation.isPending ||
    isUploading;

  const projects: Project[] =
    projectsData?.map((item: { project: Project }) => item.project) || [];

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
      setDescription("");
      setLanguage("NL");
      setPrijssuggestie("");
      setGeneratedContent("");
    }
  }, [offer]);

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

  const handleGenerateWithAI = async () => {
    if (!description.trim()) {
      toast.error("Please provide a description");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/offers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          companyId: null,
          contactId: null,
          language,
          prijssuggestie: prijssuggestie.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate offer");
      }
      const { content } = await res.json();
      setGeneratedContent(content || "");
      toast.success("Offer generated. Edit it below.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate offer"
      );
    } finally {
      setIsGenerating(false);
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

    // Create mode
    if (createMode === "ai") {
      if (!generatedContent.trim()) {
        toast.error("Generate an offer first, or switch to upload mode");
        return;
      }
      setIsUploading(true);
      try {
        const pdfRes = await fetch("/api/offers/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: generatedContent.trim() }),
        });
        if (!pdfRes.ok) {
          const err = await pdfRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to generate PDF");
        }
        const { storagePath, fileName, sizeBytes } = await pdfRes.json();

        onSuccess?.();

        createOfferMutation.mutate(
          {
            projectId: projectId || null,
            companyId: null,
            contactId: null,
            note: note.trim() || null,
            content: generatedContent.trim(),
            fileStoragePath: storagePath,
            fileName,
            fileSizeBytes: sizeBytes,
            status,
          },
          {
            onSuccess: () => {
              toast.success("Offer saved as draft");
              setProjectId("");
              setNote("");
              setDescription("");
              setPrijssuggestie("");
              setGeneratedContent("");
              onSuccess?.();
            },
            onError: (error: Error) => {
              toast.error(error.message || "Failed to save offer");
              onError?.();
            },
          }
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save offer"
        );
        onError?.();
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Upload mode
    if (!file) {
      toast.error("Please upload a file");
      return;
    }

    setIsUploading(true);
    try {
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

      onSuccess?.();

      createOfferMutation.mutate(
        {
          projectId: projectId || null,
          note: note.trim() || null,
          fileStoragePath: uploadResult.storagePath,
          fileName: uploadResult.fileName,
          fileSizeBytes: uploadResult.sizeBytes,
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
      {!isEdit && (
        <Tabs
          value={createMode}
          onValueChange={(v) => setCreateMode(v as CreateMode)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload file
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {!isEdit && createMode === "ai" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="offer-description">Description *</Label>
            <Textarea
              id="offer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the project or service to quote..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-project-ai">Project *</Label>
            <ProjectCombobox
              projects={projects}
              selectedIds={projectId ? [projectId] : []}
              onSelectionChange={(ids) =>
                setProjectId(ids.length > 0 ? ids[ids.length - 1] : "")
              }
              placeholder="Search projects..."
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="offer-language">Language *</Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as "NL" | "EN")}
              >
                <SelectTrigger id="offer-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NL">Nederlands</SelectItem>
                  <SelectItem value="EN">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-prijs" className="flex items-center gap-1">
                <Euro className="h-4 w-4" />
                Prijssuggestie (optional)
              </Label>
              <Input
                id="offer-prijs"
                value={prijssuggestie}
                onChange={(e) => setPrijssuggestie(e.target.value)}
                placeholder="e.g. € 2.500"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateWithAI}
            disabled={isGenerating || !description.trim() || !projectId}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>

          {generatedContent && (
            <div className="space-y-2">
              <Label htmlFor="offer-content">
                Offer content (edit before saving)
              </Label>
              <Textarea
                id="offer-content"
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                placeholder="Generated offer will appear here..."
                rows={16}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Markdown format. Edit as needed before saving.
              </p>
            </div>
          )}
        </>
      )}

      {(!isEdit && createMode === "upload") || isEdit ? (
        <>
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
                <span className="text-sm flex-1 min-w-0 truncate">
                  {file.name}
                </span>
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
        </>
      ) : null}

      {((!isEdit && createMode === "upload") || isEdit) && (
        <>
          <div className="space-y-2">
            <Label htmlFor="offer-project">Project</Label>
            <Select
              value={projectId || "none"}
              onValueChange={(value) =>
                setProjectId(value === "none" ? "" : value)
              }
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
        </>
      )}

      <Button
        type="submit"
        disabled={
          (isEdit
            ? false
            : createMode === "upload"
              ? !file
              : !generatedContent.trim()) || isSubmitting
        }
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isEdit ? "Saving..." : "Saving..."}
          </>
        ) : (
          <>
            {isEdit ? (
              "Save changes"
            ) : createMode === "ai" ? (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Save as draft
              </>
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
