"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create organization");
      }

      toast.success("Organization created successfully");
      setName("");
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
      <Button type="submit" disabled={isSubmitting} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {isSubmitting ? "Creating..." : "Create Organization"}
      </Button>
    </form>
  );
}

