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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, X } from "lucide-react";
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const columns: ColumnDef<Organization>[] = [
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
      size: 50,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: "userCount",
      header: "Users",
      cell: ({ row }) => {
        const count = row.original.userCount || 0;
        return <div className="font-medium">{count}</div>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <div className="text-muted-foreground">
            {date.toLocaleDateString()}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrg(row.original);
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOrg(row.original);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

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

  const table = useReactTable({
    data: organizations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

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

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Organizations</h2>
          <p className="text-muted-foreground">Manage client organizations</p>
        </div>
        {isMobile ? (
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
                <DrawerDescription>Create a new organization</DrawerDescription>
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
                  No organizations found.
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
