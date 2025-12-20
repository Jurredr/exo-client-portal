"use client";

import { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  UserPlus,
  Mail,
  User,
  Upload,
  X,
  Trash2,
  Pencil,
  MoreVertical,
  ArrowUpDown,
  Phone,
  FileText,
} from "lucide-react";
import { CreateUserForm } from "./CreateUserForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { createClient } from "@/lib/supabase/client";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { OrganizationCombobox } from "@/components/organization-combobox";
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
    image: string | null;
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
    image?: string | null;
  }[];
}

export function UsersTable() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [organizations, setOrganizations] = useState<
    { id: string; name: string; image?: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<
    string[]
  >([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const columns: ColumnDef<UserData>[] = useMemo(
    () => [
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
              <AvatarImage
                src={user.image || undefined}
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
        accessorKey: "user.email",
        id: "email",
        header: ({ column }) => {
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
        cell: ({ row }) => (
          <div className="font-medium">{row.original.user.email}</div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.user.email.localeCompare(
            rowB.original.user.email
          );
        },
      },
      {
        accessorKey: "user.name",
        id: "name",
        header: ({ column }) => {
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
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.user.name || "—"}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const nameA = rowA.original.user.name || "";
          const nameB = rowB.original.user.name || "";
          return nameA.localeCompare(nameB);
        },
      },
      {
        accessorKey: "organization.name",
        id: "organization",
        header: ({ column }) => {
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
        cell: ({ row }) => {
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
        sortingFn: (rowA, rowB) => {
          const orgA = rowA.original.organization?.name || "";
          const orgB = rowB.original.organization?.name || "";
          return orgA.localeCompare(orgB);
        },
      },
      {
        accessorKey: "user.createdAt",
        id: "createdAt",
        header: ({ column }) => {
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
        cell: ({ row }) => {
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
        sortingFn: (rowA, rowB) => {
          const dateA = new Date(rowA.original.user.createdAt).getTime();
          const dateB = new Date(rowB.original.user.createdAt).getTime();
          return dateA - dateB;
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
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

  const handleRowClick = (user: UserData) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const organizationFilterOptions = useMemo(() => {
    return organizations.map((org) => ({ label: org.name, value: org.id }));
  }, [organizations]);

  useEffect(() => {
    if (selectedUser?.user.image) {
      setImagePreview(selectedUser.user.image);
      setImageBase64(null); // Reset base64 when loading existing image
    } else {
      setImagePreview(null);
      setImageBase64(null);
    }

    // Set selected organization IDs when editing
    if (selectedUser) {
      const orgs =
        selectedUser.organizations ||
        (selectedUser.organization ? [selectedUser.organization] : []);
      setSelectedOrganizationIds(orgs.map((org) => org.id));
    } else {
      setSelectedOrganizationIds([]);
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
    const phone = formData.get("phone") as string;
    const note = formData.get("note") as string;

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedUser.user.id,
          name: name.trim() || null,
          phone: phone.trim() || null,
          note: note.trim() || null,
          organizationIds:
            selectedOrganizationIds.length > 0 ? selectedOrganizationIds : null,
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

  const EditContent = () => (
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
          <Label htmlFor="edit-phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone
          </Label>
          <Input
            id="edit-phone"
            name="phone"
            type="tel"
            defaultValue={selectedUser?.user.phone || ""}
            placeholder="+1 234 567 8900"
          />
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-note" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Note
          </Label>
          <Textarea
            id="edit-note"
            name="note"
            defaultValue={selectedUser?.user.note || ""}
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
        <Button type="submit" form="edit-form">
          Save Changes
        </Button>
        <DrawerClose asChild>
          <Button variant="outline">Cancel</Button>
        </DrawerClose>
      </DrawerFooter>
    </>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Users</h2>
        <p className="text-muted-foreground">Manage user accounts</p>
      </div>

      <EnhancedDataTable
        columns={columns}
        data={users}
        searchPlaceholder="Search users by email or name..."
        searchFn={(row, query) => {
          const email = row.user.email.toLowerCase();
          const name = (row.user.name || "").toLowerCase();
          return email.includes(query) || name.includes(query);
        }}
        filterConfig={
          organizationFilterOptions.length > 0
            ? {
                organization: {
                  label: "Organization",
                  options: [
                    { label: "None", value: "none" },
                    ...organizationFilterOptions,
                  ],
                  getValue: (row) => {
                    const orgs =
                      row.organizations ||
                      (row.organization ? [row.organization] : []);
                    if (orgs.length === 0) return "none";
                    // Return all organization IDs for filtering
                    return orgs.map((org) => org.id).join(",");
                  },
                },
              }
            : undefined
        }
        initialSorting={[{ id: "email", desc: false }]}
        onRowClick={handleRowClick}
        emptyMessage="No users found."
        isLoading={loading}
        toolbar={
          isMobile ? (
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
          )
        }
      />

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>{selectedUser && <EditContent />}</DrawerContent>
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
                    <Label htmlFor="edit-phone" className="flex items-center gap-2">
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
                    <Label htmlFor="edit-note" className="flex items-center gap-2">
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
