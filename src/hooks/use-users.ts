import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UserData {
  user: {
    id: string;
    email: string;
    name: string | null;
    imageStoragePath: string | null; // Path in Supabase Storage
    imageSizeBytes: number | null;
    phone: string | null;
    note: string | null;
    organizationId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  organization: {
    id: string;
    name: string;
  } | null;
  organizations: Array<{
    id: string;
    name: string;
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

interface CreateUserData {
  email: string;
  name?: string | null;
  imageStoragePath?: string | null; // Path in Supabase Storage
  imageSizeBytes?: number | null;
  phone?: string | null;
  note?: string | null;
  organizationId?: string | null;
  organizationIds?: string[];
}

interface UpdateUserData {
  id: string;
  email?: string;
  name?: string | null;
  imageStoragePath?: string | null; // Path in Supabase Storage
  imageSizeBytes?: number | null;
  phone?: string | null;
  note?: string | null;
  organizationId?: string | null;
  organizationIds?: string[];
}

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: { page?: number; pageSize?: number }) =>
    [...userKeys.lists(), filters] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
  me: () => [...userKeys.all, "me"] as const,
};

async function fetchUsers(
  page: number = 1
): Promise<PaginatedResponse<UserData>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: "100",
    paginate: "true",
  });
  const response = await fetch(`/api/users?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  return response.json();
}

async function fetchCurrentUser(): Promise<UserData> {
  const response = await fetch("/api/users/me");
  if (!response.ok) {
    throw new Error("Failed to fetch current user");
  }
  return response.json();
}

export function useUsers(page: number = 1) {
  return useQuery({
    queryKey: userKeys.list({ page, pageSize: 100 }),
    queryFn: () => fetchUsers(page),
    staleTime: 120 * 1000, // 120 seconds - matches API cache
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes - user data doesn't change often
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create user" }));
        throw new Error(error.error || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateUserData) => {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update user" }));
        throw new Error(error.error || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: userKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
