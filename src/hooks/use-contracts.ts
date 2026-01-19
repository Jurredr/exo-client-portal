import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ContractData {
  contract: {
    id: string;
    organizationId: string;
    name: string;
    fileUrl: string | null;
    requiresPortalSignature: boolean;
    signed: boolean;
    signedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  organization: {
    id: string;
    name: string;
  };
  projects: Array<{
    id: string;
    title: string;
  }>;
}

export const contractKeys = {
  all: ["contracts"] as const,
  lists: () => [...contractKeys.all, "list"] as const,
  detail: (id: string) => [...contractKeys.all, "detail", id] as const,
};

async function fetchContracts(): Promise<ContractData[]> {
  const response = await fetch("/api/contracts");
  if (!response.ok) {
    throw new Error("Failed to fetch contracts");
  }
  return response.json();
}

async function fetchContractById(id: string): Promise<ContractData> {
  const response = await fetch(`/api/contracts/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch contract");
  }
  return response.json();
}

export function useContracts() {
  return useQuery({
    queryKey: contractKeys.lists(),
    queryFn: fetchContracts,
    staleTime: 60 * 1000, // 60 seconds - matches API cache
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
    mutationFn: async (data: any) => {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to create contract" }));
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
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      const response = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to update contract" }));
        throw new Error(error.error || "Failed to update contract");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(variables.id) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}
