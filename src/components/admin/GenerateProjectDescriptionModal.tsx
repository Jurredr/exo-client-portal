"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

interface OfferOption {
  id: string;
  note: string | null;
  fileName: string | null;
  status: string;
}

interface GenerateProjectDescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  offers: OfferOption[];
  onGenerated: (description: string) => void;
}

export function GenerateProjectDescriptionModal({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  offers,
  onGenerated,
}: GenerateProjectDescriptionModalProps) {
  const [source, setSource] = useState<"offer" | "custom">("offer");
  const [offerId, setOfferId] = useState<string>("");
  const [customInput, setCustomInput] = useState("");
  const [language, setLanguage] = useState<"NL" | "EN">("NL");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (source === "offer" && !offerId) {
      toast.error("Select an offer");
      return;
    }
    if (source === "custom" && !customInput.trim()) {
      toast.error("Enter some input to summarize");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/generate-description`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source,
            offerId: source === "offer" ? offerId : undefined,
            customInput: source === "custom" ? customInput.trim() : undefined,
            language,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate description");
      }
      const { description } = await res.json();
      setGeneratedDescription(description || "");
      toast.success("Description generated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate description"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (generatedDescription) {
      onGenerated(generatedDescription);
      onOpenChange(false);
      setGeneratedDescription("");
      setOfferId("");
      setCustomInput("");
    }
  };

  const handleClose = () => {
    setGeneratedDescription("");
    setOfferId("");
    setCustomInput("");
    onOpenChange(false);
  };

  const offersWithContent = offers.filter(Boolean);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setGeneratedDescription("");
      setOfferId("");
      setCustomInput("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Genereer beschrijving</DialogTitle>
          <DialogDescription>
            Genereer een projectbeschrijving op basis van een offerte of eigen
            input voor {projectTitle}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={source}
          onValueChange={(v) => setSource(v as "offer" | "custom")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="offer" className="gap-2">
              <FileText className="h-4 w-4" />
              Obv offerte
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Custom input
            </TabsTrigger>
          </TabsList>

          {source === "offer" && (
            <div className="space-y-2 pt-4">
              <Label>Selecteer offerte</Label>
              <Select
                value={offerId || "none"}
                onValueChange={(v) => setOfferId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kies een offerte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen geselecteerd</SelectItem>
                  {offersWithContent.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.note || o.fileName || `Offer ${o.id.slice(0, 8)}`} (
                      {o.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {offersWithContent.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Geen offertes gevonden voor dit project. Gebruik &quot;Custom
                  input&quot;.
                </p>
              )}
            </div>
          )}

          {source === "custom" && (
            <div className="space-y-2 pt-4">
              <Label>Input</Label>
              <Textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Beschrijf het project of plak tekst om samen te vatten..."
                rows={5}
                className="resize-none"
              />
            </div>
          )}
        </Tabs>

        <div className="space-y-2">
          <Label>Taal</Label>
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as "NL" | "EN")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NL">Nederlands</SelectItem>
              <SelectItem value="EN">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGenerate}
          disabled={
            isGenerating ||
            (source === "offer" && !offerId) ||
            (source === "custom" && !customInput.trim())
          }
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Genereren...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Genereer beschrijving
            </>
          )}
        </Button>

        {generatedDescription && (
          <div className="space-y-2">
            <Label>Gegenereerde beschrijving (bewerk indien nodig)</Label>
            <Textarea
              value={generatedDescription}
              onChange={(e) => setGeneratedDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {generatedDescription ? "Annuleren" : "Sluiten"}
          </Button>
          {generatedDescription && (
            <Button onClick={handleApply}>Toepassen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
