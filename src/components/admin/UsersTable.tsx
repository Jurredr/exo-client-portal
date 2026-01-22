"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ColumnDef,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  UserPlus,
  X,
  Trash2,
  Pencil,
  MoreVertical,
  ArrowUpDown,
  Phone,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const prevSelectedUserIdRef = useRef<string | null>(null);

  const columns = useMemo(
    () => [
      {
        id: "avatar",
        header: "",
        accessorFn: (row: UserData) => row.user.id, // Avatar column doesn't need sorting
        cell: ({ row }: { row: { original: UserData } }) => {
          const user = row.original.user;
          const getInitials = (name: string | null) => {
            if (!name) return user.email?.charAt(0).toUpperCase() || "U";
            return name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
          };
          return (
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={
                  user.imageStoragePath
                    ? `/api/users/${user.id}/image`
                    : undefined
                }
                alt={user.name || user.email}
              />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          );
        },
        enableSorting: false,
        size: 50,
      },
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
          <div className="font-medium">{row.original.user.email}</div>
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
        accessorFn: (row: UserData) => row.user.name,
        id: "name",
        header: ({ column }: { column: Column<UserData, unknown> }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }: { row: { original: UserData } }) => (
          <div className="text-muted-foreground">
            {row.original.user.name || "—"}
          </div>
        ),
        enableSorting: true,
        sortingFn: (
          rowA: { original: UserData },
          rowB: { original: UserData }
        ) => {
          const nameA = rowA.original.user.name || "";
          const nameB = rowB.original.user.name || "";
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

  const table = useReactTable({
    data: users,
    columns: columns as ColumnDef<UserData>[],
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
      // Only update image preview if no user-uploaded image exists
      if (!imageFile) {
        setTimeout(() => {
          // For Storage images, we'll fetch them via the API endpoint
          if (selectedUser.user.imageStoragePath) {
            setImagePreview(`/api/users/${selectedUser.user.id}/image`);
          } else {
            setImagePreview(null);
          }
        }, 0);
      }
    }

    // Set selected organization IDs when editing
    setTimeout(() => {
      if (selectedUser) {
        const orgs =
          selectedUser.organizations ||
          (selectedUser.organization ? [selectedUser.organization] : []);
        setSelectedOrganizationIds(orgs.map((org) => org.id));
      } else {
        setSelectedOrganizationIds([]);
      }
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setImageFile(file);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const note = formData.get("note") as string;

    // Upload image to Storage if a new file is provided
    let imageStoragePath: string | null = null;
    let imageSizeBytes: number | null = null;

    if (imageFile) {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", imageFile);
        uploadFormData.append("userId", selectedUser.user.id);

        const uploadResponse = await fetch("/api/users/upload-image", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || "Failed to upload image");
        }

        const uploadResult = await uploadResponse.json();
        imageStoragePath = uploadResult.storagePath;
        imageSizeBytes = uploadResult.sizeBytes;
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error("Failed to upload image. Please try again.");
        return;
      }
    }

    updateMutation.mutate(
      {
        id: selectedUser.user.id,
        name: name.trim() || null,
        phone: phone.trim() || null,
        note: note.trim() || null,
        organizationIds:
          selectedOrganizationIds.length > 0
            ? selectedOrganizationIds
            : undefined,
        // Only include image fields if a new file was uploaded
        ...(imageFile
          ? {
              imageStoragePath: imageStoragePath ?? null,
              imageSizeBytes: imageSizeBytes ?? null,
            }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success("User updated successfully");
          setIsEditOpen(false);
          setImagePreview(null);
          setImageFile(null);
          // Refresh sidebar user data
          window.dispatchEvent(new Event("user-updated"));
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to update user");
        },
      }
    );
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    // React Query will automatically refetch users
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
        <p className="text-muted-foreground">Manage user accounts</p>
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
                <CreateUserForm onSuccess={handleCreateSuccess} />
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
              <CreateUserForm onSuccess={handleCreateSuccess} />
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
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      name="name"
                      defaultValue={selectedUser.user.name || ""}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label
                      htmlFor="edit-phone"
                      className="flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      Phone
                    </Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      type="tel"
                      defaultValue={selectedUser.user.phone || ""}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label
                      htmlFor="edit-note"
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Note
                    </Label>
                    <Textarea
                      id="edit-note"
                      name="note"
                      defaultValue={selectedUser.user.note || ""}
                      placeholder="Add any notes about this user..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="edit-org">Organizations</Label>
                    <OrganizationCombobox
                      organizations={organizations}
                      selectedIds={selectedOrganizationIds}
                      onSelectionChange={setSelectedOrganizationIds}
                      placeholder="Select organizations..."
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label>Profile Image</Label>
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={imagePreview} alt="Profile" />
                          <AvatarFallback>
                            {selectedUser.user.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "U"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1">
                        <Input
                          id="edit-image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Max 5MB. Image will be converted to base64.
                        </p>
                      </div>
                      {imagePreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setImagePreview(null);
                            setImageFile(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
                <DrawerFooter>
                  <Button type="submit" form="edit-form">
                    Save Changes
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
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      name="name"
                      defaultValue={selectedUser.user.name || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-phone"
                      className="flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      Phone
                    </Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      type="tel"
                      defaultValue={selectedUser.user.phone || ""}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-note"
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Note
                    </Label>
                    <Textarea
                      id="edit-note"
                      name="note"
                      defaultValue={selectedUser.user.note || ""}
                      placeholder="Add any notes about this user..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-org">Organizations</Label>
                    <OrganizationCombobox
                      organizations={organizations}
                      selectedIds={selectedOrganizationIds}
                      onSelectionChange={setSelectedOrganizationIds}
                      placeholder="Select organizations..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Profile Image</Label>
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={imagePreview} alt="Profile" />
                          <AvatarFallback>
                            {selectedUser.user.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "U"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1">
                        <Input
                          id="edit-image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Max 5MB. Image will be converted to base64.
                        </p>
                      </div>
                      {imagePreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setImagePreview(null);
                            setImageFile(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditOpen(false);
                        setImagePreview(null);
                        setImageFile(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
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
