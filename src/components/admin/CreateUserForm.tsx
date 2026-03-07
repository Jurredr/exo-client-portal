"use client";

import { useState, useEffect } from "react";
import { useOrganizations } from "@/hooks/use-organizations";
import { useContacts } from "@/hooks/use-contacts";
import { useCreateUser } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  UserPlus,
  Mail,
  User,
  X,
  Phone,
  FileText,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrganizationCombobox } from "@/components/organization-combobox";

export function CreateUserForm({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: () => void;
}) {
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<
    string[]
  >([]);
  const { data: organizationsData, isLoading: isLoadingOrgs } =
    useOrganizations();
  const { data: contactsData = [] } = useContacts();
  const createUserMutation = useCreateUser();
  const organizations = organizationsData || [];
  const contacts = contactsData.filter((c) => c.email); // Only contacts with email can get access

  // Pre-fill from contact when selected
  useEffect(() => {
    if (selectedContactId) {
      const contact = contacts.find((c) => c.id === selectedContactId);
      if (contact) {
        setEmail(contact.email || "");
        setName(`${contact.firstName} ${contact.lastName}`.trim());
        setPhone(contact.phone || "");
        setSelectedOrganizationIds(
          contact.companyId ? [contact.companyId] : []
        );
      }
    } else {
      setEmail("");
      setName("");
      setPhone("");
    }
  }, [selectedContactId, contacts]);

  const isSubmitting = createUserMutation.isPending;
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

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

  // Organizations are now fetched via TanStack Query

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes("@")) {
      toast.error("Valid email is required");
      return;
    }

    try {
      let imageStoragePath: string | null = null;
      let imageSizeBytes: number | null = null;

      // Upload image to Storage if provided (using temp ID, will be updated after user creation)
      if (imageFile) {
        try {
          // Generate a temporary ID for the upload
          const tempUserId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("userId", tempUserId);

          const uploadResponse = await fetch("/api/users/upload-image", {
            method: "POST",
            body: formData,
          });

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
          return;
        }
      }

      // Optimistic close: close modal immediately for faster workflow
      onSuccess?.();

      // Create the user with image storage path using the hook
      createUserMutation.mutate(
        {
          email: email.trim(),
          name: name.trim() || null,
          phone: phone.trim() || null,
          note: note.trim() || null,
          organizationIds:
            selectedOrganizationIds.length > 0
              ? selectedOrganizationIds
              : undefined,
          contactId: selectedContactId || undefined,
          imageStoragePath,
          imageSizeBytes,
        },
        {
          onSuccess: () => {
            toast.success("User created successfully");
            setEmail("");
            setName("");
            setPhone("");
            setNote("");
            setSelectedContactId("");
            setSelectedOrganizationIds([]);
            setImagePreview(null);
            setImageFile(null);
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to create user");
            onError?.(); // Reopen modal on failure so user can retry
          },
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create user"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Grant access to contact (optional)</Label>
        <Select
          value={selectedContactId || "none"}
          onValueChange={(v) => setSelectedContactId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select contact or create standalone user" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Create standalone user</SelectItem>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
                {c.email ? ` (${c.email})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select a contact to grant portal access — fields will pre-fill from
          the contact.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-email" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email
        </Label>
        <Input
          id="user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-name" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Name (Optional)
        </Label>
        <Input
          id="user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Phone (Optional)
        </Label>
        <Input
          id="user-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 234 567 8900"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-note" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Note (Optional)
        </Label>
        <Textarea
          id="user-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add any notes about this user..."
          rows={3}
          className="resize-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-org">Organizations (Optional)</Label>
        <OrganizationCombobox
          organizations={organizations}
          selectedIds={selectedOrganizationIds}
          onSelectionChange={setSelectedOrganizationIds}
          placeholder="Select organizations..."
          disabled={isLoadingOrgs}
        />
      </div>
      <div className="space-y-2">
        <Label>Profile Image (Optional)</Label>
        <div className="flex items-center gap-4">
          {imagePreview && (
            <Avatar className="h-16 w-16">
              <AvatarImage src={imagePreview} alt="Profile" />
              <AvatarFallback>
                {name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "U"}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1">
            <Input
              id="user-image"
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
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </>
        )}
      </Button>
    </form>
  );
}
