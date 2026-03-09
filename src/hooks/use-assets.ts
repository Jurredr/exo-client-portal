import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { financialsKeys } from "./use-financials";

export interface AssetData {
  id: string;
  name: string;
  description: string | null;
  purchaseDate: string;
  purchasePrice: string;
  residualValue: string;
  usefulLifeYears: number;
  category: string | null;
  linkedExpenseId: string | null;
  createdAt: string;
}

export interface CreateAssetData {
  name: string;
  description?: string | null;
  purchaseDate: Date | string;
  purchasePrice: string | number;
  residualValue?: string | number;
  usefulLifeYears?: number;
  category?: string | null;
  linkedExpenseId?: string | null;
}

export interface UpdateAssetData {
  id: string;
  name?: string;
  description?: string | null;
  purchaseDate?: Date | string;
  purchasePrice?: string | number;
  residualValue?: string | number;
  usefulLifeYears?: number;
  category?: string | null;
  linkedExpenseId?: string | null;
}

export const assetKeys = {
  all: ["assets"] as const,
  lists: () => [...assetKeys.all, "list"] as const,
  list: () => [...assetKeys.lists()] as const,
  detail: (id: string) => [...assetKeys.all, "detail", id] as const,
};

async function fetchAssets(): Promise<AssetData[]> {
  const response = await fetch("/api/assets");
  if (!response.ok) {
    throw new Error("Failed to fetch assets");
  }
  return response.json();
}

export function useAssets() {
  return useQuery({
    queryKey: assetKeys.list(),
    queryFn: fetchAssets,
    staleTime: 60 * 1000,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAssetData) => {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          purchaseDate:
            data.purchaseDate instanceof Date
              ? data.purchaseDate.toISOString()
              : data.purchaseDate,
        }),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create asset" }));
        throw new Error(error.error || "Failed to create asset");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      queryClient.invalidateQueries({ queryKey: financialsKeys.all });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAssetData) => {
      const { id, ...rest } = data;
      const body: Record<string, unknown> = { ...rest };
      if (body.purchaseDate instanceof Date) {
        body.purchaseDate = body.purchaseDate.toISOString();
      }
      const response = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update asset" }));
        throw new Error(error.error || "Failed to update asset");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      queryClient.invalidateQueries({ queryKey: financialsKeys.all });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete asset");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      queryClient.invalidateQueries({ queryKey: financialsKeys.all });
    },
  });
}
