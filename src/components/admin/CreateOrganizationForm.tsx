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
  image?: string | null;
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
  organization,
}: {
  onSuccess?: () => void;
  organization?: Organization;
}) {
  const [name, setName] = useState(organization?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(organization?.image || null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
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
      const url = "/api/organizations";
      const method = organization ? "PATCH" : "POST";
      const body = organization
        ? {
            id: organization.id,
            name: name.trim(),
            image: imageBase64 || organization.image || null,
            address: address.trim() || null,
            kvkNumber: kvkNumber.trim() || null,
            btwNumber: btwNumber.trim() || null,
            email: email.trim() || null,
            telephone: telephone.trim() || null,
          }
        : {
            name: name.trim(),
            image: imageBase64 || null,
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

      toast.success(`Organization ${organization ? "updated" : "created"} successfully`);
      if (!organization) {
        setName("");
        setImagePreview(null);
        setImageBase64(null);
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
      {/* Contact Information Section */}
      <div className="space-y-4 border rounded-lg p-4">
        <Label className="text-base font-semibold">Contact Information (Optional)</Label>
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
        <Plus className="h-4 w-4 mr-2" />
        {isSubmitting
          ? organization
            ? "Updating..."
            : "Creating..."
          : organization
            ? "Update Organization"
            : "Create Organization"}
      </Button>
    </form>
  );
}
