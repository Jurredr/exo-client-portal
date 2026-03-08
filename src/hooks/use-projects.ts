import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardStatsKeys } from "./use-dashboard-stats";

interface ProjectData {
  project: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    stage: string;
    startDate: string | null;
    deadline: string | null;
    subtotal: string | null;
    currency: string;
    type: "client" | "labs";
    organizationId?: string;
    companyId?: string;
    createdAt: string;
    updatedAt: string;
  };
  organization?: { id: string; name: string };
  company?: { id: string; name: string };
  totalHours?: number;
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

interface CreateProjectData {
  title: string;
  description?: string | null;
  organizationId: string;
  type: "client" | "labs";
  subtotal?: string | null;
  currency?: string;
  status?: string;
  stage?: string;
  startDate?: Date | string | null;
  deadline?: Date | string | null;
}

interface UpdateProjectData {
  id: string;
  title?: string;
  description?: string | null;
  organizationId?: string;
  type?: "client" | "labs";
  subtotal?: string | null;
  currency?: string;
  status?: string;
  stage?: string;
  startDate?: Date | string | null;
  deadline?: Date | string | null;
}

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: { page?: number; pageSize?: number }) =>
    [...projectKeys.lists(), filters] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

async function fetchProjects(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    status?: string;
    type?: string;
    search?: string;
  }
): Promise<PaginatedResponse<ProjectData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    paginate: "true",
  });
  if (filters?.status) {
    params.append("status", filters.status);
  }
  if (filters?.type) {
    params.append("type", filters.type);
  }
  if (filters?.search) {
    params.append("search", filters.search);
  }
  const response = await fetch(`/api/projects?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  return response.json();
}

// Non-paginated version for dropdowns and stats
async function fetchAllProjects(): Promise<ProjectData[]> {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  return response.json();
}

export function useProjects(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    status?: string;
    type?: string;
    search?: string;
  }
) {
  return useQuery({
    queryKey: projectKeys.list({ page, pageSize, ...filters }),
    queryFn: () => fetchProjects(page, pageSize, filters),
    staleTime: 0, // No stale time - always refetch when invalidated
  });
}

// For dropdowns and stats that need all projects
export function useAllProjects() {
  return useQuery({
    queryKey: [...projectKeys.all, "all"],
    queryFn: fetchAllProjects,
    staleTime: 0, // No stale time - always refetch when invalidated
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProjectData) => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create project" }));
        throw new Error(error.error || "Failed to create project");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.refetchQueries({
        queryKey: projectKeys.all,
        type: "active",
      });
      // Also invalidate dashboard stats since projects affect stats
      await queryClient.invalidateQueries({
        queryKey: dashboardStatsKeys.all,
      });
      await queryClient.refetchQueries({
        queryKey: dashboardStatsKeys.all,
        type: "active",
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProjectData) => {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update project" }));
        throw new Error(error.error || "Failed to update project");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.refetchQueries({
        queryKey: projectKeys.all,
        type: "active",
      });
      // Also invalidate dashboard stats since projects affect stats
      await queryClient.invalidateQueries({
        queryKey: dashboardStatsKeys.all,
      });
      await queryClient.refetchQueries({
        queryKey: dashboardStatsKeys.all,
        type: "active",
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/projects?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete project");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.refetchQueries({
        queryKey: projectKeys.all,
        type: "active",
      });
      // Also invalidate dashboard stats since projects affect stats
      await queryClient.invalidateQueries({
        queryKey: dashboardStatsKeys.all,
      });
      await queryClient.refetchQueries({
        queryKey: dashboardStatsKeys.all,
        type: "active",
      });
    },
  });
}
