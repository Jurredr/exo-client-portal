import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ContractData {
  contract: {
    id: string;
    organizationId: string;
    name: string;
    type: string;
    fileStoragePath: string | null; // Path in Supabase Storage
    fileName: string | null;
    fileSizeBytes: number | null;
    requiresPortalSignature: boolean;
    signed: boolean;
    signedAt: string | null;
    signature: string | null;
    signedBy: string | null;
    createdAt: string;
  };
  project?: {
    id: string;
    title: string;
  };
  projects?: Array<{
    id: string;
    title: string;
  }>;
  organization?: {
    id: string;
    name: string;
  };
  organizations?: Array<{
    id: string;
    name: string;
  }>;
  signedByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface CreateContractData {
  organizationId: string;
  projectIds?: string[];
  name: string;
  fileStoragePath?: string | null; // Path in Supabase Storage
  fileName?: string | null;
  fileSizeBytes?: number | null;
  requiresPortalSignature?: boolean;
}

export interface UpdateContractData {
  id: string;
  organizationId?: string;
  projectIds?: string[];
  name?: string;
  fileStoragePath?: string | null; // Path in Supabase Storage
  fileName?: string | null;
  fileSizeBytes?: number | null;
  requiresPortalSignature?: boolean;
}

export const contractKeys = {
  all: ["contracts"] as const,
  lists: () => [...contractKeys.all, "list"] as const,
  detail: (id: string) => [...contractKeys.all, "detail", id] as const,
};

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

async function fetchContracts(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    signed?: string;
    search?: string;
  }
): Promise<PaginatedResponse<ContractData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    ...(filters?.signed && { signed: filters.signed }),
    ...(filters?.search && { search: filters.search }),
  });
  const response = await fetch(`/api/contracts?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch contracts");
  }
  const data = await response.json();
  // Normalize null values to undefined for optional fields
  return {
    ...data,
    data: data.data.map((contract: ContractData) => ({
      ...contract,
      project: contract.project ?? undefined,
      organization: contract.organization ?? undefined,
    })),
  };
}

async function fetchContractById(id: string): Promise<ContractData> {
  const response = await fetch(`/api/contracts/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch contract");
  }
  const data = await response.json();
  // Normalize null values to undefined for optional fields
  return {
    ...data,
    project: data.project ?? undefined,
    organization: data.organization ?? undefined,
  };
}

export function useContracts(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    signed?: string;
    search?: string;
  }
) {
  return useQuery({
    queryKey: [...contractKeys.lists(), page, pageSize, filters],
    queryFn: () => fetchContracts(page, pageSize, filters),
    staleTime: 0, // No stale time - always refetch when invalidated
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => fetchContractById(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContractData) => {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create contract" }));
        throw new Error(error.error || "Failed to create contract");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateContractData) => {
      const response = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update contract" }));
        throw new Error(error.error || "Failed to update contract");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      await queryClient.refetchQueries({
        queryKey: contractKeys.all,
        type: "active",
      });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/contracts?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete contract");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      await queryClient.refetchQueries({
        queryKey: contractKeys.all,
        type: "active",
      });
    },
  });
}
