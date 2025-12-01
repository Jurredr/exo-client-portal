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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowUpDown,
  MoreVertical,
} from "lucide-react";
import { CreateOrganizationForm } from "./CreateOrganizationForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EnhancedDataTable } from "@/components/enhanced-data-table";

interface Organization {
  id: string;
  name: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
}

export function OrganizationsTable() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const columns: ColumnDef<Organization>[] = useMemo(
    () => [
      {
        id: "avatar",
        header: "",
        cell: ({ row }) => {
          const org = row.original;
          const getInitials = (name: string) => {
            return name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
          };
          return (
            <Avatar className="h-8 w-8">
              <AvatarImage src={org.image || undefined} alt={org.name} />
              <AvatarFallback>{getInitials(org.name)}</AvatarFallback>
            </Avatar>
          );
        },
        enableSorting: false,
        size: 50,
      },
      {
        accessorKey: "name",
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
          <div className="font-medium">{row.original.name}</div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "userCount",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Users
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const count = row.original.userCount || 0;
          return <div className="font-medium">{count}</div>;
        },
        enableSorting: true,
      },
      {
        accessorKey: "createdAt",
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
          const date = new Date(row.original.createdAt);
          return (
            <div className="text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const dateA = new Date(rowA.original.createdAt).getTime();
          const dateB = new Date(rowB.original.createdAt).getTime();
          return dateA - dateB;
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
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
                  setSelectedOrg(row.original);
                  setIsEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOrg(row.original);
                  setIsDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    []
  );

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch("/api/organizations");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (org: Organization) => {
    setSelectedOrg(org);
    setIsEditOpen(true);
  };

  useEffect(() => {
    if (selectedOrg?.image) {
      setImagePreview(selectedOrg.image);
      setImageBase64(null);
    } else {
      setImagePreview(null);
      setImageBase64(null);
    }
  }, [selectedOrg]);

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
    if (!selectedOrg) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get("name") as string;

    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    try {
      const response = await fetch("/api/organizations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedOrg.id,
          name: name.trim(),
          image: imageBase64 || selectedOrg.image || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update organization");
      }

      toast.success("Organization updated successfully");
      setIsEditOpen(false);
      setImagePreview(null);
      setImageBase64(null);
      fetchOrganizations();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update organization"
      );
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    fetchOrganizations();
  };

  const handleDelete = async () => {
    if (!deleteOrg) return;

    try {
      const response = await fetch(`/api/organizations?id=${deleteOrg.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete organization");
      }

      toast.success("Organization deleted successfully");
      fetchOrganizations();
      setDeleteOrg(null);
    } catch (error) {
      console.error("Error deleting organization:", error);
      toast.error("Failed to delete organization");
    }
  };

  const EditContent = () => (
    <>
      <DrawerHeader className="gap-1">
        <DrawerTitle>Edit Organization</DrawerTitle>
        <DrawerDescription>Update organization details</DrawerDescription>
      </DrawerHeader>
      <form
        id="edit-form"
        onSubmit={handleUpdate}
        className="flex flex-col gap-4 overflow-y-auto px-4 text-sm"
      >
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            name="name"
            defaultValue={selectedOrg?.name}
            required
          />
        </div>
        <div className="flex flex-col gap-3">
          <Label>Logo Image</Label>
          <div className="flex items-center gap-4">
            {imagePreview && (
              <Avatar className="h-16 w-16">
                <AvatarImage src={imagePreview} alt="Logo" />
                <AvatarFallback>
                  {selectedOrg?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "O"}
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
        <h2 className="text-2xl font-semibold">Organizations</h2>
        <p className="text-muted-foreground">Manage client organizations</p>
      </div>

      <EnhancedDataTable
        columns={columns}
        data={organizations}
        searchPlaceholder="Search organizations..."
        searchableFields={["name"]}
        initialSorting={[{ id: "name", desc: false }]}
        onRowClick={handleRowClick}
        emptyMessage="No organizations found."
        isLoading={loading}
        toolbar={
          isMobile ? (
            <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DrawerTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Organization
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Create Organization</DrawerTitle>
                  <DrawerDescription>
                    Create a new organization
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4">
                  <CreateOrganizationForm onSuccess={handleCreateSuccess} />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Organization</DialogTitle>
                  <DialogDescription>
                    Create a new organization for client accounts
                  </DialogDescription>
                </DialogHeader>
                <CreateOrganizationForm onSuccess={handleCreateSuccess} />
              </DialogContent>
            </Dialog>
          )
        }
      />

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>{selectedOrg && <EditContent />}</DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            {selectedOrg && (
              <>
                <DialogHeader>
                  <DialogTitle>Edit Organization</DialogTitle>
                  <DialogDescription>
                    Update organization details
                  </DialogDescription>
                </DialogHeader>
                <form
                  id="edit-form"
                  onSubmit={handleUpdate}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      name="name"
                      defaultValue={selectedOrg.name}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo Image</Label>
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={imagePreview} alt="Logo" />
                          <AvatarFallback>
                            {selectedOrg.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "O"}
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
        title="Delete Organization"
        description={`Are you sure you want to delete "${deleteOrg?.name}"? This action cannot be undone.`}
        itemName="Organization"
        confirmationText={deleteOrg?.name || ""}
        warningMessage="This will permanently delete the organization and all associated data. Users associated with this organization will lose their organization assignment."
      />
    </div>
  );
}
