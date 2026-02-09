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
import {
  useOffers,
  useDeleteOffer,
  useUpdateOffer,
  OFFER_STATUS_OPTIONS,
} from "@/hooks/use-offers";
import { useAllProjects } from "@/hooks/use-projects";
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
import { toast } from "sonner";
import {
  Download,
  Trash2,
  Plus,
  ArrowUpDown,
  MoreVertical,
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
import { StatusCombobox } from "@/components/status-combobox";
import { CreateOfferForm } from "./CreateOfferForm";

interface OfferData {
  offer: {
    id: string;
    projectId: string | null;
    note: string | null;
    fileStoragePath: string | null;
    fileName: string | null;
    fileSizeBytes: number | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  project: {
    id: string;
    title: string;
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

export function OffersTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [projectFilter, setProjectFilter] = useState<string | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: offersData, isLoading: isLoadingOffers } = useOffers(
    page,
    pageSize,
    {
      ...(projectFilter && { projectId: projectFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    }
  );
  const { data: projectsData } = useAllProjects();
  const deleteMutation = useDeleteOffer();
  const updateMutation = useUpdateOffer();

  const offers = offersData?.data || [];
  const pagination = offersData?.pagination;
  const loading = isLoadingOffers;

  const projects = useMemo(
    () =>
      projectsData?.map((item: { project: { id: string; title: string } }) => ({
        id: item.project.id,
        title: item.project.title,
      })) || [],
    [projectsData]
  );

  const [deleteOffer, setDeleteOffer] = useState<OfferData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isMobile = useIsMobile();

  const columns: ColumnDef<OfferData>[] = useMemo(
    () => [
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
          <div className="font-medium">
            {row.original.project?.title ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.project?.title || "";
          const b = rowB.original.project?.title || "";
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "offer.status",
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
          const offer = row.original.offer;
          return (
            <StatusCombobox
              options={OFFER_STATUS_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                state: o.state,
              }))}
              value={offer.status || "draft"}
              onValueChange={(value) => {
                updateMutation.mutate({ id: offer.id, status: value });
              }}
              disabled={updateMutation.isPending}
              className="min-w-[110px]"
            />
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const order = ["draft", "sent", "signed", "discarded"];
          const a = order.indexOf(rowA.original.offer.status || "draft");
          const b = order.indexOf(rowB.original.offer.status || "draft");
          return a - b;
        },
      },
      {
        accessorKey: "offer.note",
        id: "note",
        header: "Note",
        cell: ({ row }) => (
          <div className="max-w-md truncate">
            {row.original.offer.note ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "offer.createdAt",
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
              Uploaded
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {formatDate(row.original.offer.createdAt)}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = new Date(rowA.original.offer.createdAt).getTime();
          const b = new Date(rowB.original.offer.createdAt).getTime();
          return a - b;
        },
      },
      {
        id: "file",
        header: "Offer",
        cell: ({ row }) => {
          const hasFile =
            !!row.original.offer.fileStoragePath ||
            !!row.original.offer.fileName;
          return hasFile ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (row.original.offer.fileStoragePath) {
                  window.open(
                    `/api/offers/${row.original.offer.id}/download`,
                    "_blank"
                  );
                } else {
                  toast.error("File not available");
                }
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
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
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOffer(row.original);
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
    { id: "createdAt", desc: true },
  ]);

  const table = useReactTable({
    data: offers,
    columns,
    pageCount: pagination?.totalPages ?? 1,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
  };

  const handleCreateError = () => {
    setIsCreateOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteOffer) return;

    deleteMutation.mutate(deleteOffer.offer.id, {
      onSuccess: () => {
        toast.success("Offer deleted successfully");
        setDeleteOffer(null);
      },
      onError: (error: Error) => {
        console.error("Error deleting offer:", error);
        toast.error("Failed to delete offer");
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Offers</h2>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              ({pagination.totalCount} total)
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          Upload and manage project offers
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by note or project..."
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
          {projects.length > 0 && (
            <Select
              value={projectFilter || "all"}
              onValueChange={(value) => {
                setProjectFilter(value === "all" ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
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
                <Plus className="h-4 w-4 mr-2" />
                Add Offer
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Upload Offer</DrawerTitle>
                <DrawerDescription>
                  Upload an offer and link it to a project
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <CreateOfferForm
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
                <Plus className="h-4 w-4 mr-2" />
                Add Offer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload Offer</DialogTitle>
                <DialogDescription>
                  Upload an offer and link it to a project
                </DialogDescription>
              </DialogHeader>
              <CreateOfferForm
                onSuccess={handleCreateSuccess}
                onError={handleCreateError}
              />
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
                  No offers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Offer"
        description={`Are you sure you want to delete this offer? This action cannot be undone.`}
        itemName="Offer"
        confirmationText={deleteOffer?.offer.fileName || "this offer"}
        warningMessage="This will permanently delete the offer and its file. This action cannot be undone."
      />
    </div>
  );
}
