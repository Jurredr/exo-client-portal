"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
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

  const { data: companies = [] } = useOrganizations();

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
      const url = "/api/contacts";
      const method = contact ? "PATCH" : "POST";
      const body = contact
        ? {
            id: contact.id,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            companyIds:
              selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
            type,
          }
        : {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            companyIds:
              selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
            type,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save contact");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
