"use client";

import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useContacts, useDeleteContact } from "@/hooks/use-contacts";
import { useOrganizations } from "@/hooks/use-organizations";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUpDown, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateContactForm } from "./CreateContactForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContactData } from "@/hooks/use-contacts";

export function ContactsTable() {
  const { data: contactsData = [], isLoading } = useContacts();
  const { data: organizationsData = [] } = useOrganizations();
  const deleteMutation = useDeleteContact();
  const isMobile = useIsMobile();

  const organizations = useMemo(
    () => organizationsData?.map((o) => ({ id: o.id, name: o.name })) || [],
    [organizationsData]
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(
    null
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteContact, setDeleteContact] = useState<ContactData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName} ${lastName}`
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const columns: ColumnDef<ContactData>[] = useMemo(
    () => [
      {
        id: "avatar",
        header: "",
        cell: ({ row }) => {
          const c = row.original;
          const name = `${c.firstName} ${c.lastName}`.trim();
          return (
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={c.hasImage ? `/api/contacts/${c.id}/image` : undefined}
                alt={name}
              />
              <AvatarFallback>
                {getInitials(c.firstName, c.lastName)}
              </AvatarFallback>
            </Avatar>
          );
        },
        enableSorting: false,
        size: 50,
      },
      {
        accessorFn: (row) => `${row.firstName} ${row.lastName}`.trim(),
        id: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </span>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a =
            `${rowA.original.firstName} ${rowA.original.lastName}`.trim();
          const b =
            `${rowB.original.firstName} ${rowB.original.lastName}`.trim();
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "email",
        id: "email",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.email || "—"}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.email || "";
          const b = rowB.original.email || "";
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "phone",
        id: "phone",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Phone
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.phone || "—"}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.phone || "";
          const b = rowB.original.phone || "";
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "companyName",
        id: "company",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Company
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const companiesList =
            row.original.companies ??
            (row.original.companyName && row.original.companyId
              ? [
                  {
                    id: row.original.companyId,
                    name: row.original.companyName,
                  },
                ]
              : row.original.companyName
                ? [{ id: "legacy", name: row.original.companyName }]
                : []);
          if (companiesList.length === 0) {
            return <div className="text-muted-foreground">—</div>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {companiesList.map((c) => (
                <Badge key={c.id} variant="outline" className="text-xs">
                  {c.name}
                </Badge>
              ))}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a =
            rowA.original.companies?.map((c) => c.name).join(", ") ||
            rowA.original.companyName ||
            "";
          const b =
            rowB.original.companies?.map((c) => c.name).join(", ") ||
            rowB.original.companyName ||
            "";
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "type",
        id: "type",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Type
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="capitalize">{row.original.type}</span>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.type || "";
          const b = rowB.original.type || "";
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
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
                  setEditingContact(row.original);
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
                  setDeleteContact(row.original);
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

  const filterConfig = useMemo(
    () => ({
      ...(organizations.length > 0 && {
        company: {
          label: "Company",
          options: [
            { label: "No company", value: "__none__" },
            ...organizations.map((o) => ({
              label: o.name,
              value: o.id,
            })),
          ],
          getValue: (row: ContactData) =>
            row.companyIds?.length ? row.companyIds.join(",") : "__none__",
        },
      }),
      type: {
        label: "Type",
        options: [
          { label: "Client", value: "client" },
          { label: "Supplier", value: "supplier" },
          { label: "Both", value: "both" },
        ],
        getValue: (row: ContactData) => row.type || "client",
      },
    }),
    [organizations]
  );

  const addContactButton = (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus className="h-4 w-4" />
      Add contact
    </Button>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Contacts</h2>
          <span className="text-sm text-muted-foreground">
            ({contactsData.length} total)
          </span>
        </div>
        <p className="text-muted-foreground">
          People you have business relationships with — clients, suppliers, or
          both
        </p>
      </div>
      <EnhancedDataTable
        columns={columns}
        data={contactsData}
        isLoading={isLoading}
        searchPlaceholder="Search contacts..."
        searchableFields={["firstName", "lastName", "email", "companyName"]}
        filterConfig={filterConfig}
        initialSorting={[{ id: "name", desc: false }]}
        onRowClick={(row) => {
          setEditingContact(row);
          setIsEditOpen(true);
        }}
        emptyMessage="No contacts found."
        toolbar={
          isMobile ? (
            <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DrawerTrigger asChild>{addContactButton}</DrawerTrigger>
              <DrawerContent>
                <DrawerHeader className="text-left">
                  <DrawerTitle>Add contact</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-4">
                  <CreateContactForm onSuccess={() => setIsCreateOpen(false)} />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>{addContactButton}</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add contact</DialogTitle>
                </DialogHeader>
                <CreateContactForm onSuccess={() => setIsCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <CreateContactForm
              contact={editingContact}
              onSuccess={() => {
                setIsEditOpen(false);
                setEditingContact(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete contact"
        description={`Are you sure you want to delete ${deleteContact ? `${deleteContact.firstName} ${deleteContact.lastName}` : "this contact"}?`}
        itemName="contact"
        confirmationText={
          deleteContact
            ? `${deleteContact.firstName} ${deleteContact.lastName}`
            : ""
        }
        onConfirm={async () => {
          if (deleteContact) {
            await deleteMutation.mutateAsync(deleteContact.id);
            setIsDeleteOpen(false);
            setDeleteContact(null);
          }
        }}
      />
    </div>
  );
}
