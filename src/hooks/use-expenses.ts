import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    invoiceUrl: string | null;
    invoiceFileName: string | null;
    invoiceFileType: string | null;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
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

interface CreateExpenseData {
  userId: string;
  description: string;
  amount: string;
  currency: string;
  date: Date | string;
  category?: string | null;
  vendor?: string | null;
  invoiceUrl?: string | null;
  invoiceFileName?: string | null;
  invoiceFileType?: string | null;
}

interface UpdateExpenseData {
  id: string;
  userId?: string;
  description?: string;
  amount?: string;
  currency?: string;
  date?: Date | string;
  category?: string | null;
  vendor?: string | null;
  invoiceUrl?: string | null;
  invoiceFileName?: string | null;
  invoiceFileType?: string | null;
}

export const expenseKeys = {
  all: ["expenses"] as const,
  lists: () => [...expenseKeys.all, "list"] as const,
  list: (filters: { page?: number; pageSize?: number }) =>
    [...expenseKeys.lists(), filters] as const,
  detail: (id: string) => [...expenseKeys.all, "detail", id] as const,
};

async function fetchExpenses(
  page: number = 1
): Promise<PaginatedResponse<ExpenseData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: "100",
    paginate: "true",
  });
  const response = await fetch(`/api/expenses?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch expenses");
  }
  return response.json();
}

export function useExpenses(page: number = 1) {
  return useQuery({
    queryKey: expenseKeys.list({ page, pageSize: 100 }),
    queryFn: () => fetchExpenses(page),
    staleTime: 60 * 1000, // 60 seconds - matches API cache
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
}
