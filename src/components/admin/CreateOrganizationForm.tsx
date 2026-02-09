"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, X, Loader2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  imageStoragePath?: string | null;
  address?: string | null;
  kvkNumber?: string | null;
  btwNumber?: string | null;
  email?: string | null;
  telephone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function CreateOrganizationForm({
  onSuccess,
  onError,
  organization,
}: {
  onSuccess?: () => void;
  onError?: () => void;
  organization?: Organization;
}) {
  const [name, setName] = useState(organization?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [address, setAddress] = useState(organization?.address || "");
  const [kvkNumber, setKvkNumber] = useState(organization?.kvkNumber || "");
  const [btwNumber, setBtwNumber] = useState(organization?.btwNumber || "");
  const [email, setEmail] = useState(organization?.email || "");
  const [telephone, setTelephone] = useState(organization?.telephone || "");

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

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Set submitting state immediately for instant UI feedback
    setIsSubmitting(true);

    if (!name.trim()) {
      toast.error("Organization name is required");
      setIsSubmitting(false);
      return;
    }
    try {
      let imageStoragePath: string | null = null;
      let imageSizeBytes: number | null = null;

      // Upload image to Storage if a new file is provided
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append("file", imageFile);
          if (organization?.id) {
            formData.append("organizationId", organization.id);
          }

          const uploadResponse = await fetch(
            "/api/organizations/upload-image",
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.error || "Failed to upload image");
          }

          const uploadResult = await uploadResponse.json();
          imageStoragePath = uploadResult.storagePath;
          imageSizeBytes = uploadResult.sizeBytes;
        } catch (error) {
          console.error("Error uploading image:", error);
          toast.error("Failed to upload image. Please try again.");
          setIsSubmitting(false);
          return;
        }
      }

      const url = "/api/organizations";
      const method = organization ? "PATCH" : "POST";
      // Optimistic close: close modal immediately for faster workflow (create only)
      if (!organization) {
        onSuccess?.();
      }

      const body = organization
        ? {
            id: organization.id,
            name: name.trim(),
            // Only include image fields if they're explicitly set (new file or removal)
            ...(imageFile || (!imageFile && !organization.imageStoragePath)
              ? {
                  imageStoragePath: imageStoragePath ?? null,
                  imageSizeBytes: imageSizeBytes ?? null,
                }
              : {}),
            address: address.trim() || null,
            kvkNumber: kvkNumber.trim() || null,
            btwNumber: btwNumber.trim() || null,
            email: email.trim() || null,
            telephone: telephone.trim() || null,
          }
        : {
            name: name.trim(),
            imageStoragePath,
            imageSizeBytes,
            address: address.trim() || null,
            kvkNumber: kvkNumber.trim() || null,
            btwNumber: btwNumber.trim() || null,
            email: email.trim() || null,
            telephone: telephone.trim() || null,
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
        throw new Error(error.error || "Failed to create organization");
      }

      toast.success(
        `Organization ${organization ? "updated" : "created"} successfully`
      );
      if (!organization) {
        setName("");
        setImagePreview(null);
        setImageFile(null);
        setAddress("");
        setKvkNumber("");
        setBtwNumber("");
        setEmail("");
        setTelephone("");
      }
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create organization"
      );
      if (!organization) {
        onError?.(); // Reopen modal on failure so user can retry
      }
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
              Max 5MB. Image will be compressed and stored.
            </p>
          </div>
          {imagePreview && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setImagePreview(null);
                setImageFile(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {/* Contact Information Section */}
      <div className="space-y-4 border rounded-lg p-4">
        <Label className="text-base font-semibold">
          Contact Information (Optional)
        </Label>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-address">Address</Label>
            <Input
              id="org-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, city, postal code, country"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-kvk">KVK Number</Label>
              <Input
                id="org-kvk"
                value={kvkNumber}
                onChange={(e) => setKvkNumber(e.target.value)}
                placeholder="e.g., 90251695"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-btw">BTW Number</Label>
              <Input
                id="org-btw"
                value={btwNumber}
                onChange={(e) => setBtwNumber(e.target.value)}
                placeholder="e.g., NL004799795B92"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <Input
                id="org-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-telephone">Telephone</Label>
              <Input
                id="org-telephone"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="e.g., +31 6 13458011"
              />
            </div>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {organization ? "Updating..." : "Creating..."}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            {organization ? "Update Organization" : "Create Organization"}
          </>
        )}
      </Button>
    </form>
  );
}
