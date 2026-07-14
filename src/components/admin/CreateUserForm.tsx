"use client";

import { useState } from "react";
import { useOrganizations } from "@/hooks/use-organizations";
import { useContacts } from "@/hooks/use-contacts";
import { useCreateUser } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Mail, Loader2, ShieldCheck } from "lucide-react";
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
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<
    string[]
  >([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { data: organizationsData } = useOrganizations();
  const { data: contactsData = [] } = useContacts();
  const createUserMutation = useCreateUser();
  const organizations = organizationsData || [];
  const contacts = contactsData.filter((c) => c.email); // Only contacts with email can get access

  const handleContactChange = (v: string) => {
    const contactId = v === "none" ? "" : v;
    setSelectedContactId(contactId);
    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        setEmail(contact.email || "");
        setSelectedOrganizationIds(
          contact.companyIds?.length
            ? contact.companyIds
            : contact.companyId
              ? [contact.companyId]
              : []
        );
      }
    } else {
      setEmail("");
      setSelectedOrganizationIds([]);
    }
  };

  const isSubmitting = createUserMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes("@")) {
      toast.error("Valid email is required");
      return;
    }

    if (!selectedContactId?.trim()) {
      toast.error("A contact is required. Users must be linked to a contact.");
      return;
    }

    try {
      onSuccess?.();

      createUserMutation.mutate(
        {
          email: email.trim(),
          organizationIds:
            selectedOrganizationIds.length > 0
              ? selectedOrganizationIds
              : undefined,
          contactId: selectedContactId,
          isAdmin,
        },
        {
          onSuccess: () => {
            toast.success("User created successfully");
            setEmail("");
            setSelectedContactId("");
            setSelectedOrganizationIds([]);
            setIsAdmin(false);
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
        <Label>Contact *</Label>
        <Select
          value={selectedContactId || "none"}
          onValueChange={handleContactChange}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select contact (required)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select a contact...</SelectItem>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
                {c.email ? ` (${c.email})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Users must be linked to a contact. Create the contact first in the
          Contacts page if needed.
        </p>
        {contacts.length === 0 && (
          <p className="text-xs text-amber-600">
            No contacts with email found. Add a contact first.
          </p>
        )}
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
          placeholder="client@example.com"
          required
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Pre-filled from contact. Edit the contact to change.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-org">Organizations</Label>
        <OrganizationCombobox
          organizations={organizations}
          selectedIds={selectedOrganizationIds}
          onSelectionChange={() => {}}
          placeholder="Select organizations..."
          disabled
        />
        <p className="text-xs text-muted-foreground">
          Pre-filled from contact. Edit the contact to change.
        </p>
      </div>
      <div className="rounded-md border p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="user-admin"
            checked={isAdmin}
            onCheckedChange={(checked) => setIsAdmin(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label
              htmlFor="user-admin"
              className="flex items-center gap-2 font-medium"
            >
              <ShieldCheck className="h-4 w-4" />
              Admin access
            </Label>
            <p className="text-xs text-muted-foreground">
              Grants full access to the admin dashboard (financials, invoices,
              projects, users). Leave off for regular client accounts.
            </p>
          </div>
        </div>
      </div>
      <Button
        type="submit"
        disabled={isSubmitting || contacts.length === 0}
        className="w-full"
      >
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
