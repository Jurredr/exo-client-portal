import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface InvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    projectId: string | null;
    organizationId: string;
    amount: string;
    currency: string;
    status: string;
    type: string;
    transactionType: string;
    vatIncluded: boolean | null;
    isKOR: boolean;
    description: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    paidAt: string | null;
    pdfStoragePath: string | null; // Path in Supabase Storage
    pdfFileName: string | null;
    pdfFileType: string | null;
    pdfSizeBytes: number | null;
    createdAt: string;
    updatedAt: string;
  };
  project: {
    id: string;
    title: string;
  } | null;
  organization: {
    id: string;
    name: string;
  };
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    taxPercentage: string;
    order: number;
  }>;
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

interface CreateInvoiceData {
  projectId?: string | null;
  organizationId: string;
  amount: string;
  currency: string;
  status?: string;
  type?: string;
  transactionType?: string;
  vatIncluded?: boolean | null;
  isKOR?: boolean;
  description?: string | null;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
  lineItems?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxPercentage: string;
    order: number;
  }>;
}

interface UpdateInvoiceData {
  id: string;
  projectId?: string | null;
  organizationId?: string;
  amount?: string;
  currency?: string;
  status?: string;
  type?: string;
  transactionType?: string;
  vatIncluded?: boolean | null;
  isKOR?: boolean;
  description?: string | null;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
  lineItems?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxPercentage: string;
    order: number;
  }>;
}

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (filters: {
    page?: number;
    pageSize?: number;
    search?: string;
    all?: boolean;
  }) => [...invoiceKeys.lists(), filters] as const,
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
  nextNumber: () => [...invoiceKeys.all, "nextNumber"] as const,
};

async function fetchInvoices(
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResponse<InvoiceData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    paginate: "true",
  });
  const response = await fetch(`/api/invoices?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch invoices");
  }
  return response.json();
}

async function fetchNextInvoiceNumber(): Promise<{ invoiceNumber: string }> {
  const response = await fetch("/api/invoices?nextNumber=true");
  if (!response.ok) {
    throw new Error("Failed to fetch next invoice number");
  }
  return response.json();
}

export function useInvoices(page: number = 1, pageSize: number = 50) {
  return useQuery({
    queryKey: invoiceKeys.list({ page, pageSize }),
    queryFn: () => fetchInvoices(page, pageSize),
    staleTime: 60 * 1000, // 60 seconds - matches API cache
  });
}

export function useNextInvoiceNumber() {
  return useQuery({
    queryKey: invoiceKeys.nextNumber(),
    queryFn: fetchNextInvoiceNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes - invoice numbers don't change often
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceData) => {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create invoice" }));
        throw new Error(error.error || "Failed to create invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.nextNumber() });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateInvoiceData) => {
      const response = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update invoice" }));
        throw new Error(error.error || "Failed to update invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/invoices?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}
