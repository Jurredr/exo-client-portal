import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ContactData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  companyId: string | null;
  type: string;
  createdAt: string;
  companyName?: string | null;
}

interface CreateContactData {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  photo?: string | null;
  companyId?: string | null;
  type?: string | null;
}

interface UpdateContactData {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  photo?: string | null;
  companyId?: string | null;
  type?: string | null;
}

export const contactKeys = {
  all: ["contacts"] as const,
  lists: () => [...contactKeys.all, "list"] as const,
  detail: (id: string) => [...contactKeys.all, "detail", id] as const,
};

async function fetchContacts(): Promise<ContactData[]> {
  const response = await fetch("/api/contacts");
  if (!response.ok) {
    throw new Error("Failed to fetch contacts");
  }
  return response.json();
}

export function useContacts() {
  return useQuery({
    queryKey: contactKeys.lists(),
    queryFn: fetchContacts,
    staleTime: 0,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContactData) => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create contact" }));
        throw new Error(error.error || "Failed to create contact");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateContactData) => {
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update contact" }));
        throw new Error(error.error || "Failed to update contact");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/contacts?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete contact");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}
