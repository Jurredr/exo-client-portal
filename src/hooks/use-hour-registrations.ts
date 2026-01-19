import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface HourRegistration {
  id: string;
  userId: string;
  projectId: string | null;
  description: string;
  hours: string;
  category: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    title: string;
  } | null;
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

// Query key factory for consistent key management
export const hourRegistrationKeys = {
  all: ["hour-registrations"] as const,
  lists: () => [...hourRegistrationKeys.all, "list"] as const,
  list: (filters: { page?: number; pageSize?: number; search?: string; all?: boolean }) =>
    [...hourRegistrationKeys.lists(), filters] as const,
  allList: (filters: { all?: boolean }) =>
    [...hourRegistrationKeys.all, "all", filters] as const,
  detail: (id: string) => [...hourRegistrationKeys.all, "detail", id] as const,
};

// Fetch hour registrations (paginated)
async function fetchHourRegistrations(
  page: number = 1,
  search?: string,
  all: boolean = false
): Promise<PaginatedResponse<HourRegistration>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: "100",
    ...(search && { search }),
    ...(all && { all: "true" }),
  });

  const response = await fetch(`/api/hour-registrations?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch hour registrations");
  }
  return response.json();
}

// Fetch all hour registrations (non-paginated, for stats)
async function fetchAllHourRegistrations(all: boolean = false): Promise<HourRegistration[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "10000", // Large page size to get all records
    ...(all && { all: "true" }),
  });

  const response = await fetch(`/api/hour-registrations?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch hour registrations");
  }
  const result = await response.json();
  // API returns paginated response, extract the data array
  return result.data || [];
}

// Hook to fetch hour registrations (paginated)
export function useHourRegistrations(
  page: number = 1,
  search?: string,
  all: boolean = false
) {
  return useQuery({
    queryKey: hourRegistrationKeys.list({ page, pageSize: 100, search, all }),
    queryFn: () => fetchHourRegistrations(page, search, all),
    staleTime: 30 * 1000, // 30 seconds - matches API cache
  });
}

// Hook to fetch all hour registrations (for stats/charts)
export function useAllHourRegistrations(all: boolean = false) {
  return useQuery({
    queryKey: hourRegistrationKeys.allList({ all }),
    queryFn: () => fetchAllHourRegistrations(all),
    staleTime: 30 * 1000, // 30 seconds - matches API cache
  });
}

// Hook to create hour registration
export function useCreateHourRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      description: string;
      hours: number;
      projectId?: string | null;
      date?: string;
      category?: string;
    }) => {
      const response = await fetch("/api/hour-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to create hour registration");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch hour registrations
      queryClient.invalidateQueries({
        queryKey: hourRegistrationKeys.lists(),
      });
      // Also trigger the custom event for components not using React Query
      window.dispatchEvent(new Event("hour-registration-saved"));
    },
  });
}

// Hook to update hour registration
export function useUpdateHourRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      description?: string;
      hours?: number;
      projectId?: string | null;
      date?: string;
      category?: string;
    }) => {
      const response = await fetch("/api/hour-registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to update hour registration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hourRegistrationKeys.lists(),
      });
      window.dispatchEvent(new Event("hour-registration-saved"));
    },
  });
}

// Hook to delete hour registration
export function useDeleteHourRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hour-registrations?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete hour registration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hourRegistrationKeys.lists(),
      });
    },
  });
}
