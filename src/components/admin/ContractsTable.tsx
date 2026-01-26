"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useContracts, useDeleteContract } from "@/hooks/use-contracts";
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
import {
  FileText,
  Download,
  Trash2,
  Plus,
  ArrowUpDown,
  MoreVertical,
  Pen,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    fileStoragePath: string | null; // Path in Supabase Storage
    fileName: string | null;
    fileSizeBytes: number | null;
    requiresPortalSignature: boolean;
    signed: boolean;
    signedAt: string | null;
    signature: string | null;
    createdAt: string;
  };
  project?: {
    id: string;
    title: string;
  };
  projects?: Array<{
    id: string;
    title: string;
  }>;
  organization?: {
    id: string;
    name: string;
  };
  organizations?: Array<{
    id: string;
    name: string;
  }>;
  signedByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export function ContractsTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [signedFilter, setSignedFilter] = useState<string | undefined>(
    undefined
  );
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
  const { data: contractsData, isLoading: loading } = useContracts(
    page,
    pageSize,
    {
      ...(signedFilter && { signed: signedFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    }
  );
  const deleteMutation = useDeleteContract();

  const contracts = contractsData?.data || [];
  const pagination = contractsData?.pagination;

  const [deleteContract, setDeleteContract] = useState<ContractData | null>(
    null
  );
  const [editContract, setEditContract] = useState<ContractData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
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
        cell: ({ row }) => {
          const projects =
            row.original.projects ||
            (row.original.project ? [row.original.project] : []);
          if (projects.length === 0)
            return <div className="text-muted-foreground">—</div>;
          if (projects.length === 1) {
            return (
              <div className="text-muted-foreground">{projects[0].title}</div>
            );
          }
          return (
            <div className="text-muted-foreground">
              {projects.map((p) => p.title).join(", ")}
              <span className="ml-1 text-xs">({projects.length})</span>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const projectsA =
            rowA.original.projects ||
            (rowA.original.project ? [rowA.original.project] : []);
          const projectsB =
            rowB.original.projects ||
            (rowB.original.project ? [rowB.original.project] : []);
          const titleA = projectsA.length > 0 ? projectsA[0].title : "";
          const titleB = projectsB.length > 0 ? projectsB[0].title : "";
          return titleA.localeCompare(titleB);
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
          const organizations =
            row.original.organizations ||
            (row.original.organization ? [row.original.organization] : []);
          if (organizations.length === 0)
            return <div className="text-muted-foreground">—</div>;
          // If all projects are from the same organization, show it once
          const uniqueOrgs = Array.from(
            new Set(organizations.map((o) => o.name))
          );
          return (
            <div className="text-muted-foreground">{uniqueOrgs.join(", ")}</div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const orgA =
            rowA.original.organizations?.[0] || rowA.original.organization;
          const orgB =
            rowB.original.organizations?.[0] || rowB.original.organization;
          const nameA = orgA?.name || "";
          const nameB = orgB?.name || "";
          return nameA.localeCompare(nameB);
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
          const requiresPortalSignature =
            row.original.contract.requiresPortalSignature;

          if (signed) {
            return <Badge variant="default">Signed</Badge>;
          } else if (!requiresPortalSignature) {
            return <Badge variant="outline">Archived</Badge>;
          } else {
            return <Badge variant="secondary">Pending Signature</Badge>;
          }
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
              {row.original.contract.requiresPortalSignature && (
                <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()}>
                  <Link href={`/contract/${row.original.contract.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View & Sign
                  </Link>
                </DropdownMenuItem>
              )}
              {!row.original.contract.requiresPortalSignature && (
                <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()}>
                  <Link href={`/contract/${row.original.contract.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View
                  </Link>
                </DropdownMenuItem>
              )}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setEditContract(row.original);
                  setIsEditOpen(true);
                }}
              >
                <Pen className="mr-2 h-4 w-4" />
                Edit
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

  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const table = useReactTable({
    data: contracts,
    columns,
    pageCount: pagination?.totalPages ?? 1,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, // Server-side pagination
  });

  // Contracts are now fetched via TanStack Query

  const handleDelete = async () => {
    if (!deleteContract) return;

    deleteMutation.mutate(deleteContract.contract.id, {
      onSuccess: () => {
        toast.success("Contract deleted successfully");
        setDeleteContract(null);
      },
      onError: (error: Error) => {
        console.error("Error deleting contract:", error);
        toast.error("Failed to delete contract");
      },
    });
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    // React Query will automatically refetch contracts
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    setEditContract(null);
    // React Query will automatically refetch contracts
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Contracts</h2>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              ({pagination.totalCount} total)
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          View and manage all contracts for projects
        </p>
      </div>

      {/* Server-side filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contracts by name, project, or organization..."
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
          <Select
            value={signedFilter || "all"}
            onValueChange={(value) => {
              setSignedFilter(value === "all" ? undefined : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="signed">Signed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isMobile ? (
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
                <TableRow key={row.id}>
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
                  No contracts found.
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
            <DrawerHeader>
              <DrawerTitle>Edit Contract</DrawerTitle>
              <DrawerDescription>
                Update contract details and projects
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              {editContract && (
                <CreateContractForm
                  key={editContract.contract.id}
                  contract={{
                    id: editContract.contract.id,
                    name: editContract.contract.name,
                    organizationId:
                      editContract.organizations?.[0]?.id ||
                      editContract.organization?.id ||
                      "",
                    fileStoragePath: editContract.contract.fileStoragePath,
                    fileName: editContract.contract.fileName,
                    fileSizeBytes: editContract.contract.fileSizeBytes,
                    requiresPortalSignature:
                      editContract.contract.requiresPortalSignature,
                    projects:
                      editContract.projects ||
                      (editContract.project ? [editContract.project] : []),
                  }}
                  onSuccess={handleEditSuccess}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Contract</DialogTitle>
              <DialogDescription>
                Update contract details and projects
              </DialogDescription>
            </DialogHeader>
            {editContract && (
              <CreateContractForm
                contract={{
                  id: editContract.contract.id,
                  name: editContract.contract.name,
                  organizationId:
                    editContract.organizations?.[0]?.id ||
                    editContract.organization?.id ||
                    "",
                  fileStoragePath: editContract.contract.fileStoragePath,
                  fileName: editContract.contract.fileName,
                  fileSizeBytes: editContract.contract.fileSizeBytes,
                  requiresPortalSignature:
                    editContract.contract.requiresPortalSignature,
                  projects:
                    editContract.projects ||
                    (editContract.project ? [editContract.project] : []),
                }}
                onSuccess={handleEditSuccess}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

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
