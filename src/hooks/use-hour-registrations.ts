import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardStatsKeys } from "./use-dashboard-stats";

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

// Query key factory for consistent key management
export const hourRegistrationKeys = {
  all: ["hour-registrations"] as const,
  lists: () => [...hourRegistrationKeys.all, "list"] as const,
  list: (filters: {
    page?: number;
    pageSize?: number;
    search?: string;
    all?: boolean;
  }) => [...hourRegistrationKeys.lists(), filters] as const,
  allList: (filters: { all?: boolean; startDate?: Date; endDate?: Date }) =>
    [...hourRegistrationKeys.all, "all", filters] as const,
  detail: (id: string) => [...hourRegistrationKeys.all, "detail", id] as const,
};

// Fetch hour registrations (paginated)
async function fetchHourRegistrations(
  page: number = 1,
  pageSize: number = 10,
  search?: string,
  all: boolean = false
): Promise<PaginatedResponse<HourRegistration>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: Math.min(Math.max(pageSize, 1), 100).toString(),
    ...(search && { search }),
    ...(all && { all: "true" }),
  });

  const response = await fetch(`/api/hour-registrations?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch hour registrations");
  }
  return response.json();
}

// Fetch hour registrations for stats/charts with date filtering
// This is much more efficient than fetching all records
async function fetchHourRegistrationsForStats(
  all: boolean = false,
  startDate?: Date,
  endDate?: Date
): Promise<HourRegistration[]> {
  // For stats, we only need data from the last year maximum
  // This prevents fetching thousands of records
  const defaultStartDate = new Date();
  defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 1); // Last year only

  const actualStartDate = startDate || defaultStartDate;
  const actualEndDate = endDate || new Date();

  const params = new URLSearchParams({
    page: "1",
    pageSize: "100", // Use reasonable page size
    ...(all && { all: "true" }),
    startDate: actualStartDate.toISOString().split("T")[0], // YYYY-MM-DD format
    endDate: actualEndDate.toISOString().split("T")[0],
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
  pageSize: number = 10,
  search?: string,
  all: boolean = false
) {
  const queryKey = hourRegistrationKeys.list({
    page,
    pageSize,
    search,
    all,
  });

  return useQuery({
    queryKey,
    queryFn: () => fetchHourRegistrations(page, pageSize, search, all),
    staleTime: 0, // No stale time - always refetch when invalidated
  });
}

// Hook to fetch hour registrations for stats/charts (with date filtering)
export function useAllHourRegistrations(
  all: boolean = false,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: hourRegistrationKeys.allList({ all, startDate, endDate }),
    queryFn: () => fetchHourRegistrationsForStats(all, startDate, endDate),
    staleTime: 0, // No stale time - always refetch when invalidated
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
    onSuccess: async () => {
      // Invalidate all hour registration queries (marks them as stale)
      await queryClient.invalidateQueries({
        queryKey: hourRegistrationKeys.all,
      });
      // Force immediate refetch of all active queries (bypasses staleTime)
      await queryClient.refetchQueries({
        queryKey: hourRegistrationKeys.all,
        type: "active",
      });
      // Also invalidate and refetch dashboard stats since they include hour data
      await queryClient.invalidateQueries({
        queryKey: dashboardStatsKeys.all,
      });
      await queryClient.refetchQueries({
        queryKey: dashboardStatsKeys.all,
        type: "active",
      });
      // Also trigger the custom event for components not using React Query
      window.dispatchEvent(new Event("hour-registration-saved"));
    },
    onError: (error) => {
      console.error("Failed to create hour registration:", error);
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
      // Invalidate all hour registration queries (marks them as stale)
      queryClient.invalidateQueries({
        queryKey: hourRegistrationKeys.all,
      });
      // Force immediate refetch of all active queries (bypasses staleTime)
      queryClient.refetchQueries({
        queryKey: hourRegistrationKeys.all,
        type: "active",
      });
      // Also invalidate and refetch dashboard stats since they include hour data
      queryClient.invalidateQueries({
        queryKey: dashboardStatsKeys.all,
      });
      queryClient.refetchQueries({
        queryKey: dashboardStatsKeys.all,
        type: "active",
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
      // Invalidate all hour registration queries (marks them as stale)
      queryClient.invalidateQueries({
        queryKey: hourRegistrationKeys.all,
      });
      // Force immediate refetch of all active queries (bypasses staleTime)
      queryClient.refetchQueries({
        queryKey: hourRegistrationKeys.all,
        type: "active",
      });
      // Also invalidate and refetch dashboard stats since they include hour data
      queryClient.invalidateQueries({
        queryKey: dashboardStatsKeys.all,
      });
      queryClient.refetchQueries({
        queryKey: dashboardStatsKeys.all,
        type: "active",
      });
    },
  });
}
