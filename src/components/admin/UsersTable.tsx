"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  Column,
} from "@tanstack/react-table";
import { useUsers, useDeleteUser, useUpdateUser } from "@/hooks/use-users";
import { useOrganizations } from "@/hooks/use-organizations";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  UserPlus,
  X,
  Trash2,
  Pencil,
  MoreVertical,
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { CreateUserForm } from "./CreateUserForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { createClient } from "@/lib/supabase/client";
import { OrganizationCombobox } from "@/components/organization-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserData {
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    note: string | null;
    imageStoragePath: string | null; // Path in Supabase Storage
    imageSizeBytes: number | null;
    organizationId: string | null;
    isAdmin?: boolean;
    createdAt: string;
    updatedAt: string;
  };
  organization: {
    id: string;
    name: string;
  } | null;
  organizations?: {
    id: string;
    name: string;
    imageStoragePath?: string | null;
  }[];
  contact?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

export function UsersTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [organizationFilter, setOrganizationFilter] = useState<
    string | undefined
  >(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // TanStack Query hooks - server-side pagination and filtering
  const { data: usersData, isLoading: isLoadingUsers } = useUsers(
    page,
    pageSize,
    {
      ...(organizationFilter && { organizationId: organizationFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    }
  );
  const { data: organizationsData, isLoading: isLoadingOrganizations } =
    useOrganizations();
  const deleteMutation = useDeleteUser();
  const updateMutation = useUpdateUser();

  const users = usersData?.data || [];
  const pagination = usersData?.pagination;
  const organizations = useMemo(
    () =>
      organizationsData?.map((org) => ({
        id: org.id,
        name: org.name,
      })) || [],
    [organizationsData]
  );
  const loading = isLoadingUsers || isLoadingOrganizations;

  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<
    string[]
  >([]);
  const [isAdminValue, setIsAdminValue] = useState(false);
  const [originalIsAdmin, setOriginalIsAdmin] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalOrganizationIds, setOriginalOrganizationIds] = useState<
    string[]
  >([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const prevSelectedUserIdRef = useRef<string | null>(null);

  const columns = useMemo(
    () => [
      {
        accessorFn: (row: UserData) => row.user.email,
        id: "email",
        header: ({ column }: { column: Column<UserData, unknown> }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Email
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }: { row: { original: UserData } }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.user.email}</span>
            {row.original.user.isAdmin && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Badge>
            )}
          </div>
        ),
        enableSorting: true,
        sortingFn: (
          rowA: { original: UserData },
          rowB: { original: UserData }
        ) => {
          return rowA.original.user.email.localeCompare(
            rowB.original.user.email
          );
        },
      },
      {
        accessorFn: (row: UserData) =>
          row.contact
            ? `${row.contact.firstName || ""} ${row.contact.lastName || ""}`.trim()
            : null,
        id: "contact",
        header: ({ column }: { column: Column<UserData, unknown> }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Contact
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }: { row: { original: UserData } }) => {
          const c = row.original.contact;
          if (!c) return <div className="text-muted-foreground">—</div>;
          const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
          return (
            <Link
              href={`/dashboard/contacts`}
              className="text-primary hover:underline font-medium"
            >
              {name || c.email || "—"}
            </Link>
          );
        },
        enableSorting: true,
        sortingFn: (
          rowA: { original: UserData },
          rowB: { original: UserData }
        ) => {
          const nameA =
            rowA.original.contact?.firstName && rowA.original.contact?.lastName
              ? `${rowA.original.contact.firstName} ${rowA.original.contact.lastName}`
              : rowA.original.contact?.email || "";
          const nameB =
            rowB.original.contact?.firstName && rowB.original.contact?.lastName
              ? `${rowB.original.contact.firstName} ${rowB.original.contact.lastName}`
              : rowB.original.contact?.email || "";
          return nameA.localeCompare(nameB);
        },
      },
      {
        accessorFn: (row: UserData) => row.organization?.name,
        id: "organization",
        header: ({ column }: { column: Column<UserData, unknown> }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Organization
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }: { row: { original: UserData } }) => {
          const orgs =
            row.original.organizations ||
            (row.original.organization ? [row.original.organization] : []);
          if (orgs.length === 0) {
            return <div className="text-muted-foreground">—</div>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {orgs.map((org) => (
                <Badge key={org.id} variant="outline" className="text-xs">
                  {org.name}
                </Badge>
              ))}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (
          rowA: { original: UserData },
          rowB: { original: UserData }
        ) => {
          const orgA = rowA.original.organization?.name || "";
          const orgB = rowB.original.organization?.name || "";
          return orgA.localeCompare(orgB);
        },
      },
      {
        accessorFn: (row: UserData) => row.user.createdAt,
        id: "createdAt",
        header: ({ column }: { column: Column<UserData, unknown> }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Created
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }: { row: { original: UserData } }) => {
          const date = new Date(row.original.user.createdAt);
          const day = date.getDate().toString().padStart(2, "0");
          const month = (date.getMonth() + 1).toString().padStart(2, "0");
          const year = date.getFullYear();
          return (
            <div className="text-muted-foreground">
              {`${day}/${month}/${year}`}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (
          rowA: { original: UserData },
          rowB: { original: UserData }
        ) => {
          const dateA = new Date(rowA.original.user.createdAt).getTime();
          const dateB = new Date(rowB.original.user.createdAt).getTime();
          return dateA - dateB;
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }: { row: { original: UserData } }) => {
          const isCurrentUser = currentUserEmail === row.original.user.email;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedUser(row.original);
                    setIsEditOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isCurrentUser}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isCurrentUser) {
                      setDeleteUser(row.original);
                      setIsDeleteOpen(true);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Cannot delete own account)
                    </span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [currentUserEmail]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "email", desc: false },
  ]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!selectedUser || !isEditOpen) return false;
    const currentOrgIds = [...selectedOrganizationIds].sort().join(",");
    const originalOrgIds = [...originalOrganizationIds].sort().join(",");
    return currentOrgIds !== originalOrgIds || isAdminValue !== originalIsAdmin;
  }, [
    selectedUser,
    isEditOpen,
    selectedOrganizationIds,
    originalOrganizationIds,
    isAdminValue,
    originalIsAdmin,
  ]);

  const table = useReactTable({
    data: users,
    columns: columns as never,
    pageCount: pagination?.totalPages ?? 1,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, // Server-side pagination
  });

  useEffect(() => {
    // Fetch current user email
    const fetchCurrentUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) {
          setCurrentUserEmail(user.email);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  // Users and organizations are now fetched via TanStack Query

  const handleRowClick = (user: UserData) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  useEffect(() => {
    if (
      selectedUser &&
      prevSelectedUserIdRef.current !== selectedUser.user.id
    ) {
      prevSelectedUserIdRef.current = selectedUser.user.id;
    }
    // Reset and set image preview when modal opens or user changes
    if (selectedUser && isEditOpen) {
      const orgs =
        selectedUser.organizations ||
        (selectedUser.organization ? [selectedUser.organization] : []);
      const orgIds = orgs.map((org) => org.id);
      setOriginalOrganizationIds(orgIds);
      setSelectedOrganizationIds(orgIds);
      const admin = selectedUser.user.isAdmin === true;
      setOriginalIsAdmin(admin);
      setIsAdminValue(admin);
    } else {
      setSelectedOrganizationIds([]);
      setOriginalIsAdmin(false);
      setIsAdminValue(false);
    }
  }, [selectedUser, isEditOpen]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);

    updateMutation.mutate(
      {
        id: selectedUser.user.id,
        organizationIds:
          selectedOrganizationIds.length > 0
            ? selectedOrganizationIds
            : undefined,
        isAdmin: isAdminValue,
      },
      {
        onSuccess: () => {
          toast.success("User updated successfully");
          setIsEditOpen(false);
          setIsSubmitting(false);
          // Refresh sidebar user data
          window.dispatchEvent(new Event("user-updated"));
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to update user");
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    // React Query will automatically refetch users
  };

  const handleCreateError = () => {
    setIsCreateOpen(true); // Reopen modal on failure so user can retry
  };

  const handleDelete = async () => {
    if (!deleteUser) return;

    deleteMutation.mutate(deleteUser.user.id, {
      onSuccess: () => {
        toast.success("User deleted successfully");
        setDeleteUser(null);
      },
      onError: (error: Error) => {
        console.error("Error deleting user:", error);
        toast.error("Failed to delete user");
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Users</h2>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              ({pagination.totalCount} total)
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          People who can log into the portal. Person details live in Contacts
        </p>
      </div>

      {/* Server-side filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {organizations.length > 0 && (
            <Select
              value={organizationFilter || "all"}
              onValueChange={(value) => {
                setOrganizationFilter(value === "all" ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {isMobile ? (
          <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DrawerTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Create Client Account</DrawerTitle>
                <DrawerDescription>
                  Create a new user account for a client
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <CreateUserForm
                  onSuccess={handleCreateSuccess}
                  onError={handleCreateError}
                />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Client Account</DialogTitle>
                <DialogDescription>
                  Create a new user account for a client
                </DialogDescription>
              </DialogHeader>
              <CreateUserForm
                onSuccess={handleCreateSuccess}
                onError={handleCreateError}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-10">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => handleRowClick(row.original)}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Server-side Pagination */}
      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Rows per page</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                const newPageSize = Number(value);
                setPageSize(newPageSize);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50, 100].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center text-sm font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(pagination.totalPages)}
                disabled={page >= pagination.totalPages}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>
            {selectedUser && (
              <>
                <DrawerHeader className="gap-1">
                  <DrawerTitle>Edit User</DrawerTitle>
                  <DrawerDescription>Update user details</DrawerDescription>
                </DrawerHeader>
                <form
                  id="edit-form"
                  onSubmit={handleUpdate}
                  className="flex flex-col gap-4 overflow-y-auto px-4 text-sm"
                >
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      defaultValue={selectedUser.user.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  {selectedUser.contact && (
                    <div className="flex flex-col gap-2">
                      <Label>Contact</Label>
                      <Button
                        type="button"
                        variant="outline"
                        asChild
                        className="w-fit"
                      >
                        <Link
                          href="/dashboard/contacts"
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Edit contact (phone, notes, etc.)
                        </Link>
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="edit-org">Organizations</Label>
                    <OrganizationCombobox
                      organizations={organizations}
                      selectedIds={selectedOrganizationIds}
                      onSelectionChange={setSelectedOrganizationIds}
                      placeholder="Select organizations..."
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      id="edit-admin-mobile"
                      checked={isAdminValue}
                      onCheckedChange={(checked) =>
                        setIsAdminValue(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="edit-admin-mobile"
                        className="flex items-center gap-2 font-medium"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin access
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Grants full access to the admin dashboard.
                      </p>
                    </div>
                  </div>
                </form>
                <DrawerFooter>
                  <Button
                    type="submit"
                    form="edit-form"
                    disabled={
                      !hasChanges || isSubmitting || updateMutation.isPending
                    }
                  >
                    {isSubmitting || updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DrawerClose>
                </DrawerFooter>
              </>
            )}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            {selectedUser && (
              <>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>Update user details</DialogDescription>
                </DialogHeader>
                <form
                  id="edit-form"
                  onSubmit={handleUpdate}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      defaultValue={selectedUser.user.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  {selectedUser.contact && (
                    <div className="space-y-2">
                      <Label>Contact</Label>
                      <Button
                        type="button"
                        variant="outline"
                        asChild
                        className="w-fit"
                      >
                        <Link
                          href="/dashboard/contacts"
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Edit contact (phone, notes, etc.)
                        </Link>
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="edit-org">Organizations</Label>
                    <OrganizationCombobox
                      organizations={organizations}
                      selectedIds={selectedOrganizationIds}
                      onSelectionChange={setSelectedOrganizationIds}
                      placeholder="Select organizations..."
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      id="edit-admin"
                      checked={isAdminValue}
                      onCheckedChange={(checked) =>
                        setIsAdminValue(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="edit-admin"
                        className="flex items-center gap-2 font-medium"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin access
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Grants full access to the admin dashboard (financials,
                        invoices, projects, users).
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        !hasChanges || isSubmitting || updateMutation.isPending
                      }
                    >
                      {isSubmitting || updateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteUser?.user.email}"? This action cannot be undone.`}
        itemName="User"
        confirmationText={deleteUser?.user.email || ""}
        warningMessage="This will permanently delete the user account and all associated data. This action cannot be undone."
      />
    </div>
  );
}
