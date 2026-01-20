import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ProjectData {
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    stage: string;
    startDate: string | null;
    deadline: string | null;
    subtotal: string | null;
    currency: string;
    type: "client" | "labs";
    organizationId: string;
    createdAt: string;
    updatedAt: string;
  };
  organization: {
    id: string;
    name: string;
  };
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
  page: number = 1
): Promise<PaginatedResponse<ProjectData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: "100",
    paginate: "true",
  });
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

export function useProjects(page: number = 1) {
  return useQuery({
    queryKey: projectKeys.list({ page, pageSize: 100 }),
    queryFn: () => fetchProjects(page),
    staleTime: 60 * 1000, // 60 seconds - matches API cache
  });
}

// For dropdowns and stats that need all projects
export function useAllProjects() {
  return useQuery({
    queryKey: [...projectKeys.all, "all"],
    queryFn: fetchAllProjects,
    staleTime: 60 * 1000, // 60 seconds
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
