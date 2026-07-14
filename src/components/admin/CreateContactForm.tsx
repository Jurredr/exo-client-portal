"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganizations } from "@/hooks/use-organizations";
import { OrganizationCombobox } from "@/components/organization-combobox";
import type { ContactData } from "@/hooks/use-contacts";

interface CreateContactFormProps {
  onSuccess?: () => void;
  onError?: () => void;
  contact?: ContactData | null;
}

export function CreateContactForm({
  onSuccess,
  onError,
  contact,
}: CreateContactFormProps) {
  const [firstName, setFirstName] = useState(contact?.firstName || "");
  const [lastName, setLastName] = useState(contact?.lastName || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(
    contact?.companyIds?.length
      ? contact.companyIds
      : contact?.companyId
        ? [contact.companyId]
        : []
  );
  const [type, setType] = useState(contact?.type || "client");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const { data: companies = [] } = useOrganizations();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setImageFile(file);
      setRemoveImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!firstName.trim()) {
      toast.error("First name is required");
      setIsSubmitting(false);
      return;
    }
    if (!lastName.trim()) {
      toast.error("Last name is required");
      setIsSubmitting(false);
      return;
    }

    try {
      let contactId = contact?.id;
      let photoPath: string | null = null;

      // For new contacts: create first to get ID, then upload image
      if (!contact) {
        const createBody = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          companyIds:
            selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
          type,
        };
        const createRes = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        });
        if (!createRes.ok) {
          const error = await createRes.json().catch(() => ({}));
          throw new Error(error.error || "Failed to create contact");
        }
        const created = await createRes.json();
        contactId = created.id;
      }

      // Upload image if a new file was selected
      if (imageFile && contactId) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("contactId", contactId);
        const uploadRes = await fetch("/api/contacts/upload-image", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const error = await uploadRes.json().catch(() => ({}));
          throw new Error(error.error || "Failed to upload image");
        }
        const uploadResult = await uploadRes.json();
        photoPath = uploadResult.storagePath;
      }

      // For edit: patch with all fields including photo
      if (contact) {
        const patchBody = {
          id: contact.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          companyIds:
            selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
          type,
          ...(imageFile
            ? { photo: photoPath }
            : removeImage
              ? { photo: null }
              : {}),
        };
        const patchRes = await fetch("/api/contacts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        if (!patchRes.ok) {
          const error = await patchRes.json().catch(() => ({}));
          throw new Error(error.error || "Failed to update contact");
        }
      } else if (photoPath && contactId) {
        // New contact: patch to add photo
        const patchRes = await fetch("/api/contacts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: contactId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            companyIds:
              selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
            type,
            photo: photoPath,
          }),
        });
        if (!patchRes.ok) {
          const error = await patchRes.json().catch(() => ({}));
          throw new Error(error.error || "Failed to save contact photo");
        }
      }

      toast.success(contact ? "Contact updated" : "Contact created");
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save contact"
      );
      onError?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = () =>
    `${firstName} ${lastName}`
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Profile Image (Optional)</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage
              src={
                imageFile
                  ? (imagePreview ?? undefined)
                  : contact?.hasImage && contact?.id && !removeImage
                    ? `/api/contacts/${contact.id}/image`
                    : undefined
              }
              alt={`${firstName} ${lastName}`}
            />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Input
              id="contact-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Max 5MB. Image will be compressed and stored.
            </p>
          </div>
          {(imagePreview ||
            (contact?.hasImage && contact?.id && !removeImage)) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setImagePreview(null);
                setImageFile(null);
                setRemoveImage(true);
                const fileInput = document.getElementById(
                  "contact-image"
                ) as HTMLInputElement;
                if (fileInput) fileInput.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="John"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="john@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+31 6 12345678"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companies">Companies</Label>
        <OrganizationCombobox
          organizations={companies}
          selectedIds={selectedCompanyIds}
          onSelectionChange={setSelectedCompanyIds}
          placeholder="Select companies..."
        />
        <p className="text-xs text-muted-foreground">
          A contact can belong to multiple companies
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="both">Both</SelectItem>
            <SelectItem value="accountant">Accountant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {!contact && <Plus className="h-4 w-4" />}
              {contact ? "Update" : "Create"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
