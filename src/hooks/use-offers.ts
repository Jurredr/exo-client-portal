import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const OFFER_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", state: "bg-slate-500" },
  { value: "sent", label: "Sent", state: "bg-blue-500" },
  { value: "signed", label: "Signed", state: "bg-green-500" },
  { value: "discarded", label: "Discarded", state: "bg-red-500" },
] as const;

interface OfferData {
  offer: {
    id: string;
    projectId: string | null;
    note: string | null;
    fileStoragePath: string | null;
    fileName: string | null;
    fileSizeBytes: number | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  project: {
    id: string;
    title: string;
  } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface CreateOfferData {
  projectId?: string | null;
  note?: string | null;
  fileStoragePath?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  status?: string;
}

export const offerKeys = {
  all: ["offers"] as const,
  lists: () => [...offerKeys.all, "list"] as const,
  list: (filters: {
    page?: number;
    pageSize?: number;
    projectId?: string;
    search?: string;
  }) => [...offerKeys.lists(), filters] as const,
  detail: (id: string) => [...offerKeys.all, "detail", id] as const,
};

async function fetchOffers(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    projectId?: string;
    search?: string;
  }
): Promise<PaginatedResponse<OfferData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    ...(filters?.projectId && { projectId: filters.projectId }),
    ...(filters?.search && { search: filters.search }),
  });
  const response = await fetch(`/api/offers?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch offers");
  }
  return response.json();
}

export function useOffers(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    projectId?: string;
    search?: string;
  }
) {
  return useQuery({
    queryKey: offerKeys.list({ page, pageSize, ...filters }),
    queryFn: () => fetchOffers(page, pageSize, filters),
    staleTime: 0,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOfferData) => {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create offer" }));
        throw new Error(error.error || "Failed to create offer");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: offerKeys.all });
      await queryClient.refetchQueries({
        queryKey: offerKeys.all,
        type: "active",
      });
    },
  });
}

export function useUpdateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Failed to update offer");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: offerKeys.all });
      await queryClient.refetchQueries({
        queryKey: offerKeys.all,
        type: "active",
      });
    },
  });
}

export function useDeleteOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/offers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete offer");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: offerKeys.all });
      await queryClient.refetchQueries({
        queryKey: offerKeys.all,
        type: "active",
      });
    },
  });
}
