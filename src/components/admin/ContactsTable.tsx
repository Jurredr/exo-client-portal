"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useContacts, useDeleteContact } from "@/hooks/use-contacts";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { CreateContactForm } from "./CreateContactForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import type { ContactData } from "@/hooks/use-contacts";

export function ContactsTable() {
  const { data: contactsData = [], isLoading } = useContacts();
  const deleteMutation = useDeleteContact();
  const isMobile = useIsMobile();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(
    null
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteContact, setDeleteContact] = useState<ContactData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const columns: ColumnDef<ContactData>[] = [
    {
      accessorKey: "firstName",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email || "—",
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone || "—",
    },
    {
      accessorKey: "companyName",
      header: "Company",
      cell: ({ row }) => row.original.companyName || "—",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.type}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingContact(row.original);
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setDeleteContact(row.original);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const addContactButton = (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus className="h-4 w-4" />
      Add contact
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contacts</h2>
          <p className="text-sm text-muted-foreground">
            People you have business relationships with — clients, suppliers, or
            both
          </p>
        </div>
        {isMobile ? (
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
        )}
      </div>

      <EnhancedDataTable
        columns={columns}
        data={contactsData}
        isLoading={isLoading}
        searchPlaceholder="Search contacts..."
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
