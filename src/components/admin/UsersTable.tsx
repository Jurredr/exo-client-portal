"use client";

import { useState, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { UserPlus, Mail, User, Upload, X, Trash2, Pencil } from "lucide-react";
import { CreateUserForm } from "./CreateUserForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { createClient } from "@/lib/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserData {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    organizationId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  organization: {
    id: string;
    name: string;
  } | null;
}

export function UsersTable() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const columns: ColumnDef<UserData>[] = [
    {
      id: "avatar",
      header: "",
      cell: ({ row }) => {
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
            <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        );
      },
      size: 50,
    },
    {
      accessorKey: "user.email",
      header: "Email",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.user.email}</div>
      ),
    },
    {
      accessorKey: "user.name",
      header: "Name",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.original.user.name || "—"}
        </div>
      ),
    },
    {
      accessorKey: "organization.name",
      header: "Organization",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.original.organization?.name || "—"}
        </div>
      ),
    },
    {
      accessorKey: "user.createdAt",
      header: "Created",
      cell: ({ row }) => {
        const date = new Date(row.original.user.createdAt);
        return <div className="text-muted-foreground">{date.toLocaleDateString()}</div>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const isCurrentUser = currentUserEmail === row.original.user.email;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedUser(row.original);
                setIsEditOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isCurrentUser}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCurrentUser) {
                          setDeleteUser(row.original);
                          setIsDeleteOpen(true);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {isCurrentUser && (
                  <TooltipContent>
                    <p>You cannot delete your own account</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
    },
  ];

  useEffect(() => {
    fetchUsers();
    fetchOrganizations();
    fetchCurrentUser();
  }, []);

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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch("/api/organizations");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    }
  };

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const handleRowClick = (user: UserData) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  useEffect(() => {
    if (selectedUser?.user.image) {
      setImagePreview(selectedUser.user.image);
      setImageBase64(null); // Reset base64 when loading existing image
    } else {
      setImagePreview(null);
      setImageBase64(null);
    }
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

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImageBase64(base64String);
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get("name") as string;
    const organizationId = formData.get("organizationId") as string;

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedUser.user.id,
          name: name.trim() || null,
          organizationId: organizationId && organizationId !== "none" ? organizationId : null,
          image: imageBase64 || selectedUser.user.image || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }

      toast.success("User updated successfully");
      setIsEditOpen(false);
      setImagePreview(null);
      setImageBase64(null);
      fetchUsers();
      
      // Refresh sidebar user data
      window.dispatchEvent(new Event("user-updated"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update user"
      );
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;

    try {
      const response = await fetch(`/api/users?id=${deleteUser.user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      toast.success("User deleted successfully");
      fetchUsers();
      setDeleteUser(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const EditContent = () => (
    <>
      <DrawerHeader className="gap-1">
        <DrawerTitle>Edit User</DrawerTitle>
        <DrawerDescription>
          Update user details
        </DrawerDescription>
      </DrawerHeader>
      <form id="edit-form" onSubmit={handleUpdate} className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            defaultValue={selectedUser?.user.email}
            disabled
            className="bg-muted"
          />
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            name="name"
            defaultValue={selectedUser?.user.name || ""}
          />
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-org">Organization</Label>
          <Select
            name="organizationId"
            defaultValue={selectedUser?.user.organizationId || "none"}
          >
            <SelectTrigger id="edit-org" className="w-full">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3">
          <Label>Profile Image</Label>
          <div className="flex items-center gap-4">
            {imagePreview && (
              <Avatar className="h-16 w-16">
                <AvatarImage src={imagePreview} alt="Profile" />
                <AvatarFallback>
                  {selectedUser?.user.name
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
                  setImageBase64(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
      <DrawerFooter>
        <Button type="submit" form="edit-form">Save Changes</Button>
        <DrawerClose asChild>
          <Button variant="outline">Cancel</Button>
        </DrawerClose>
      </DrawerFooter>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Client Accounts</h2>
          <p className="text-muted-foreground">
            Manage client user accounts
          </p>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(row.original)}
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

      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>
            {selectedUser && <EditContent />}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            {selectedUser && (
              <>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user details
                  </DialogDescription>
                </DialogHeader>
                <form id="edit-form" onSubmit={handleUpdate} className="space-y-4">
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
                    <Label htmlFor="edit-org">Organization</Label>
                    <Select
                      name="organizationId"
                      defaultValue={selectedUser.user.organizationId || "none"}
                    >
                      <SelectTrigger id="edit-org" className="w-full">
                        <SelectValue placeholder="Select an organization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                            setImageBase64(null);
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
                        setImageBase64(null);
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

