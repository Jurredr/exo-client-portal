import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { financialsKeys } from "./use-financials";

interface ExpenseData {
  expense: {
    id: string;
    userId: string;
    description: string;
    amount: string;
    currency: string;
    date: string;
    category: string | null;
    vendor: string | null;
    companyId: string | null;
    contactId: string | null;
    invoiceStoragePath: string | null; // Path in Supabase Storage
    invoiceSizeBytes: number | null;
    invoiceFileName: string | null;
    btwStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    imageStoragePath: string | null;
  };
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

export interface CreateExpenseData {
  userId: string;
  description: string;
  amount: string;
  currency: string;
  date: Date | string;
  category?: string | null;
  vendor?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  invoiceStoragePath?: string | null; // Path in Supabase Storage
  invoiceSizeBytes?: number | null;
  invoiceFileName?: string | null;
  eurEquivalent?: number | null;
  exchangeRate?: number | null;
  exchangeRateDate?: string | null;
  btwStatus?: string;
}

export interface UpdateExpenseData {
  id: string;
  userId?: string;
  description?: string;
  amount?: string;
  currency?: string;
  date?: Date | string;
  category?: string | null;
  vendor?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  invoiceStoragePath?: string | null; // Path in Supabase Storage
  invoiceSizeBytes?: number | null;
  invoiceFileName?: string | null;
  eurEquivalent?: number | null;
  exchangeRate?: number | null;
  exchangeRateDate?: string | null;
  btwStatus?: string;
}

export const expenseKeys = {
  all: ["expenses"] as const,
  lists: () => [...expenseKeys.all, "list"] as const,
  list: (filters: { page?: number; pageSize?: number; search?: string }) =>
    [...expenseKeys.lists(), filters] as const,
  detail: (id: string) => [...expenseKeys.all, "detail", id] as const,
};

async function fetchExpenses(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    category?: string;
    search?: string;
  }
): Promise<PaginatedResponse<ExpenseData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    ...(filters?.category && { category: filters.category }),
    ...(filters?.search && { search: filters.search }),
  });
  const response = await fetch(`/api/expenses?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch expenses");
  }
  return response.json();
}

export function useExpenses(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    category?: string;
    search?: string;
  }
) {
  return useQuery({
    queryKey: expenseKeys.list({ page, pageSize, ...filters }),
    queryFn: () => fetchExpenses(page, pageSize, filters),
    staleTime: 0, // No stale time - always refetch when invalidated
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseData) => {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create expense" }));
        throw new Error(error.error || "Failed to create expense");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      await queryClient.invalidateQueries({
        queryKey: financialsKeys.all,
      });
      await queryClient.refetchQueries({
        queryKey: expenseKeys.all,
        type: "active",
      });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateExpenseData) => {
      const response = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update expense" }));
        throw new Error(error.error || "Failed to update expense");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      await queryClient.invalidateQueries({
        queryKey: financialsKeys.all,
      });
      await queryClient.refetchQueries({
        queryKey: expenseKeys.all,
        type: "active",
      });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/expenses?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      await queryClient.invalidateQueries({
        queryKey: financialsKeys.all,
      });
      await queryClient.refetchQueries({
        queryKey: expenseKeys.all,
        type: "active",
      });
    },
  });
}
