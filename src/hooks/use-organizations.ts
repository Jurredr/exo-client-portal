import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface OrganizationData {
  id: string;
  name: string;
  imageStoragePath: string | null; // Path in Supabase Storage
  imageSizeBytes: number | null;
  address: string | null;
  kvkNumber: string | null;
  btwNumber: string | null;
  email: string | null;
  telephone: string | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
}

interface CreateOrganizationData {
  name: string;
  imageStoragePath?: string | null; // Path in Supabase Storage
  imageSizeBytes?: number | null;
  address?: string | null;
  kvkNumber?: string | null;
  btwNumber?: string | null;
  email?: string | null;
  telephone?: string | null;
}

interface UpdateOrganizationData {
  id: string;
  name?: string;
  imageStoragePath?: string | null; // Path in Supabase Storage
  imageSizeBytes?: number | null;
  address?: string | null;
  kvkNumber?: string | null;
  btwNumber?: string | null;
  email?: string | null;
  telephone?: string | null;
}

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  detail: (id: string) => [...organizationKeys.all, "detail", id] as const,
};

async function fetchOrganizations(): Promise<OrganizationData[]> {
  const response = await fetch("/api/organizations");
  if (!response.ok) {
    throw new Error("Failed to fetch organizations");
  }
  return response.json();
}

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: fetchOrganizations,
    staleTime: 0, // No stale time - always refetch when invalidated
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrganizationData) => {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create organization" }));
        throw new Error(error.error || "Failed to create organization");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      await queryClient.refetchQueries({
        queryKey: organizationKeys.all,
        type: "active",
      });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateOrganizationData) => {
      const response = await fetch("/api/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update organization" }));
        throw new Error(error.error || "Failed to update organization");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      await queryClient.refetchQueries({
        queryKey: organizationKeys.all,
        type: "active",
      });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/organizations?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete organization");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      await queryClient.refetchQueries({
        queryKey: organizationKeys.all,
        type: "active",
      });
    },
  });
}
