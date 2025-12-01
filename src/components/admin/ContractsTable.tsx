"use client";

import { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FileText,
  Download,
  Trash2,
  Plus,
  ArrowUpDown,
  MoreVertical,
  Pen,
} from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateContractForm } from "./CreateContractForm";
import Link from "next/link";

interface ContractData {
  contract: {
    id: string;
    name: string;
    type: string;
    fileUrl: string | null;
    signed: boolean;
    signedAt: string | null;
    signature: string | null;
    createdAt: string;
  };
  project: {
    id: string;
    title: string;
  };
  organization: {
    id: string;
    name: string;
  };
  signedByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function ContractsTable() {
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteContract, setDeleteContract] = useState<ContractData | null>(
    null
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleDownload = async (contract: ContractData) => {
    try {
      const response = await fetch(
        `/api/contracts/${contract.contract.id}/download`
      );
      if (!response.ok) {
        throw new Error("Failed to download contract");
      }

      // If it's a redirect, the browser will handle it
      if (response.redirected) {
        window.open(response.url, "_blank");
        toast.success("Contract opened");
        return;
      }

      // Otherwise try to download as file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contract.contract.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Contract downloaded successfully");
    } catch (error) {
      console.error("Error downloading contract:", error);
      toast.error("Failed to download contract");
    }
  };

  const columns: ColumnDef<ContractData>[] = useMemo(
    () => [
      {
        accessorKey: "contract.name",
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
              Contract Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="font-medium">{row.original.contract.name}</div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.contract.name.localeCompare(
            rowB.original.contract.name
          );
        },
      },
      {
        accessorKey: "project.title",
        id: "project",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Project
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.project.title}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.project.title.localeCompare(
            rowB.original.project.title
          );
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
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.organization.name}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.organization.name.localeCompare(
            rowB.original.organization.name
          );
        },
      },
      {
        accessorKey: "contract.signed",
        id: "status",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Status
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const signed = row.original.contract.signed;
          return (
            <Badge variant={signed ? "default" : "secondary"}>
              {signed ? "Signed" : "Pending"}
            </Badge>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return (
            (rowA.original.contract.signed ? 1 : 0) -
            (rowB.original.contract.signed ? 1 : 0)
          );
        },
      },
      {
        accessorKey: "contract.signedAt",
        id: "signedAt",
        header: "Signed At",
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {formatDate(row.original.contract.signedAt)}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "signedByUser.name",
        id: "signedBy",
        header: "Signed By",
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.signedByUser?.name ||
              row.original.signedByUser?.email ||
              "—"}
          </div>
        ),
        enableSorting: false,
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
              <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()}>
                <Link href={`/contract/${row.original.contract.id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  View & Sign
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(row.original);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteContract(row.original);
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
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await fetch("/api/contracts");
      if (response.ok) {
        const data = await response.json();
        setContracts(data);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Error fetching contracts:", errorData);
        toast.error(errorData.error || "Failed to load contracts");
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Failed to load contracts");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteContract) return;

    try {
      const response = await fetch(
        `/api/contracts?id=${deleteContract.contract.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete contract");
      }

      toast.success("Contract deleted successfully");
      fetchContracts();
      setDeleteContract(null);
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast.error("Failed to delete contract");
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    fetchContracts();
  };

  return (
    <div className="space-y-4">
      <EnhancedDataTable
        columns={columns}
        data={contracts}
        searchPlaceholder="Search contracts by name, project, or organization..."
        searchFn={(row, query) => {
          const name = row.contract.name.toLowerCase();
          const project = row.project.title.toLowerCase();
          const org = row.organization.name.toLowerCase();
          return (
            name.includes(query) ||
            project.includes(query) ||
            org.includes(query)
          );
        }}
        filterConfig={{
          status: {
            label: "Status",
            options: [
              { label: "Signed", value: "signed" },
              { label: "Pending", value: "pending" },
            ],
            getValue: (row) => (row.contract.signed ? "signed" : "pending"),
          },
        }}
        initialSorting={[{ id: "name", desc: false }]}
        emptyMessage="No contracts found."
        isLoading={loading}
        toolbar={
          isMobile ? (
            <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DrawerTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Contract
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Create Contract</DrawerTitle>
                  <DrawerDescription>
                    Create a new contract for a project
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4">
                  <CreateContractForm onSuccess={handleCreateSuccess} />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Contract
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Contract</DialogTitle>
                  <DialogDescription>
                    Create a new contract for a project
                  </DialogDescription>
                </DialogHeader>
                <CreateContractForm onSuccess={handleCreateSuccess} />
              </DialogContent>
            </Dialog>
          )
        }
      />

      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Contract"
        description={`Are you sure you want to delete contract "${deleteContract?.contract.name}"? This action cannot be undone.`}
        itemName="Contract"
        confirmationText={deleteContract?.contract.name || ""}
        warningMessage="This will permanently delete the contract. This action cannot be undone."
      />
    </div>
  );
}
