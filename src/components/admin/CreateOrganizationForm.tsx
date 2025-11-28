"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function CreateOrganizationForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImageBase64(base64String);
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name: name.trim(),
          image: imageBase64 || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create organization");
      }

      toast.success("Organization created successfully");
      setName("");
      setImagePreview(null);
      setImageBase64(null);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create organization"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization Name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corporation"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Logo Image (Optional)</Label>
        <div className="flex items-center gap-4">
          {imagePreview && (
            <Avatar className="h-16 w-16">
              <AvatarImage src={imagePreview} alt="Logo" />
              <AvatarFallback>
                {name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "O"}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1">
            <Input
              id="org-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Max 5MB. Image will be converted to base64.
            </p>
          </div>
          {imagePreview && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setImagePreview(null);
                setImageBase64(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {isSubmitting ? "Creating..." : "Create Organization"}
      </Button>
    </form>
  );
}

