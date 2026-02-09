"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  useProjects,
  useDeleteProject,
  useUpdateProject,
} from "@/hooks/use-projects";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";
import { cn } from "@/lib/utils";
import {
  CLIENT_PROJECT_STAGES,
  LABS_PROJECT_STAGES,
  formatStage as formatStageHelper,
  getProjectStages,
} from "@/lib/constants/stages";
import {
  FolderPlus,
  ExternalLink,
  Copy,
  Trash2,
  Pencil,
  ArrowUpDown,
  MoreVertical,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Loader2,
  ChevronsRight,
} from "lucide-react";
import { CreateProjectForm } from "./CreateProjectForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectData {
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    stage: string;
    startDate: string | null;
    deadline: string | null;
    subtotal: string | null;
    currency: string;
    type: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
  };
  organization: {
    id: string;
    name: string;
  };
  totalHours?: number;
}

// Keep for backward compatibility, but use the new helpers
// const PROJECT_STAGES = CLIENT_PROJECT_STAGES; // Unused but kept for potential future use

const PROJECT_STATUSES: StatusOption[] = [
  { value: "lead", label: "Lead", state: "bg-purple-500" },
  { value: "active", label: "Active", state: "bg-green-500" },
  { value: "completed", label: "Completed", state: "bg-blue-500" },
  { value: "on_hold", label: "On Hold", state: "bg-yellow-500" },
  { value: "cancelled", label: "Cancelled", state: "bg-red-500" },
];

// Format stage value to readable label
const formatStage = (stage: string, projectType?: "client" | "labs") => {
  return formatStageHelper(stage, projectType);
};

// Format status value to readable label
const formatStatus = (status: string) => {
  const statusConfig = PROJECT_STATUSES.find((s) => s.value === status);
  return statusConfig
    ? statusConfig.label
    : status.charAt(0).toUpperCase() + status.slice(1);
};

// Format hours (as decimal) to "xhrs ymin" format
const formatHours = (decimalHours: number) => {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) {
    return "0min";
  }

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}hr${hours !== 1 ? "s" : ""}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}min`);
  }

  return parts.join(" ");
};

export function ProjectsTable() {
  // Separate pagination for client projects
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [clientStatusFilter, setClientStatusFilter] = useState<
    string | undefined
  >(undefined);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  // Separate pagination for labs projects
  const [labsPage, setLabsPage] = useState(1);
  const [labsPageSize, setLabsPageSize] = useState(10);
  const [labsStatusFilter, setLabsStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [labsSearchQuery, setLabsSearchQuery] = useState("");

  // Debounce search queries
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [debouncedLabsSearch, setDebouncedLabsSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearch(clientSearchQuery);
      setClientPage(1); // Reset to first page when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLabsSearch(labsSearchQuery);
      setLabsPage(1); // Reset to first page when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [labsSearchQuery]);

  // TanStack Query hooks - separate queries for client and labs projects
  const { data: clientProjectsData, isLoading: isLoadingClientProjects } =
    useProjects(clientPage, clientPageSize, {
      type: "client",
      ...(clientStatusFilter && { status: clientStatusFilter }),
      ...(debouncedClientSearch && { search: debouncedClientSearch }),
    });
  const { data: labsProjectsData, isLoading: isLoadingLabsProjects } =
    useProjects(labsPage, labsPageSize, {
      type: "labs",
      ...(labsStatusFilter && { status: labsStatusFilter }),
      ...(debouncedLabsSearch && { search: debouncedLabsSearch }),
    });
  const { isLoading: isLoadingOrganizations } = useOrganizations();
  const deleteMutation = useDeleteProject();
  const updateMutation = useUpdateProject();

  const clientProjects = clientProjectsData?.data || [];
  const clientPagination = clientProjectsData?.pagination;
  const labsProjects = labsProjectsData?.data || [];
  const labsPagination = labsProjectsData?.pagination;
  const loading =
    isLoadingClientProjects || isLoadingLabsProjects || isLoadingOrganizations;

  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(
    null
  );
  const [editStatus, setEditStatus] = useState<string>("");
  const [editStage, setEditStage] = useState<string>("");
  const [editCurrency, setEditCurrency] = useState<"USD" | "EUR">("EUR");
  const [editTitle, setEditTitle] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editSubtotal, setEditSubtotal] = useState<string>("");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editDeadline, setEditDeadline] = useState<string>("");
  const [originalTitle, setOriginalTitle] = useState<string>("");
  const [originalDescription, setOriginalDescription] = useState<string>("");
  const [originalStatus, setOriginalStatus] = useState<string>("");
  const [originalStage, setOriginalStage] = useState<string>("");
  const [originalCurrency, setOriginalCurrency] = useState<"USD" | "EUR">(
    "EUR"
  );
  const [originalSubtotal, setOriginalSubtotal] = useState<string>("");
  const [originalStartDate, setOriginalStartDate] = useState<string>("");
  const [originalDeadline, setOriginalDeadline] = useState<string>("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteProject, setDeleteProject] = useState<ProjectData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const isMobile = useIsMobile();

  const columns: ColumnDef<ProjectData>[] = useMemo(
    () => [
      {
        accessorKey: "project.title",
        id: "title",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Title
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="font-medium">{row.original.project.title}</div>
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
        accessorKey: "project.status",
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
          const project = row.original.project;
          return (
            <StatusCombobox
              options={PROJECT_STATUSES.map((o) => ({
                value: o.value,
                label: o.label,
                state: o.state,
              }))}
              value={project.status || "active"}
              onValueChange={(value) => {
                updateMutation.mutate({ id: project.id, status: value });
              }}
              disabled={updateMutation.isPending}
              className="min-w-[110px]"
            />
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.project.status.localeCompare(
            rowB.original.project.status
          );
        },
      },
      {
        accessorKey: "project.stage",
        id: "stage",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Stage
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const project = row.original.project;
          const projectType = project.type === "labs" ? "labs" : "client";
          const stageOptions = getProjectStages(projectType);
          return (
            <StatusCombobox
              options={stageOptions.map((o) => ({
                value: o.value,
                label: o.label,
                state: o.state,
              }))}
              value={
                project.stage ||
                (projectType === "labs" ? "concept" : "kick_off")
              }
              onValueChange={(value) => {
                updateMutation.mutate({ id: project.id, stage: value });
              }}
              disabled={updateMutation.isPending}
              className="min-w-[110px]"
            />
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.project.stage.localeCompare(
            rowB.original.project.stage
          );
        },
      },
      {
        accessorKey: "project.subtotal",
        id: "subtotal",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Subtotal
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const { subtotal, currency } = row.original.project;
          if (!subtotal) return <div className="text-muted-foreground">-</div>;
          const symbol = currency === "USD" ? "$" : "€";
          return (
            <div className="text-muted-foreground">
              {symbol}
              {subtotal}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.project.subtotal || "0") || 0;
          const b = parseFloat(rowB.original.project.subtotal || "0") || 0;
          return a - b;
        },
      },
      {
        accessorKey: "totalHours",
        id: "hours",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-8"
            >
              Hours
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const hours = row.original.totalHours || 0;
          return <div className="font-medium">{formatHours(hours)}</div>;
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.totalHours || 0;
          const b = rowB.original.totalHours || 0;
          return a - b;
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
                  setSelectedProject(row.original);
                  setIsEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()}>
                <Link href={`/project/${row.original.project.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteProject(row.original);
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

  // Columns for labs projects (without subtotal)
  const labsColumns: ColumnDef<ProjectData>[] = useMemo(
    () => columns.filter((col) => col.id !== "subtotal"),
    [columns]
  );

  const [clientSorting, setClientSorting] = useState<SortingState>([
    { id: "title", desc: false },
  ]);
  const [labsSorting, setLabsSorting] = useState<SortingState>([
    { id: "title", desc: false },
  ]);

  const clientTable = useReactTable({
    data: clientProjects,
    columns,
    pageCount: clientPagination?.totalPages ?? 1,
    state: {
      sorting: clientSorting,
    },
    onSortingChange: setClientSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, // Server-side pagination
  });

  const labsTable = useReactTable({
    data: labsProjects,
    columns: labsColumns,
    pageCount: labsPagination?.totalPages ?? 1,
    state: {
      sorting: labsSorting,
    },
    onSortingChange: setLabsSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, // Server-side pagination
  });

  // Projects and organizations are now fetched via TanStack Query

  const handleRowClick = (project: ProjectData) => {
    setSelectedProject(project);
    setEditStatus(project.project.status);
    setEditStage(project.project.stage);
    setEditCurrency((project.project.currency as "USD" | "EUR") || "EUR");
    setIsEditOpen(true);
  };

  // Sync edit form values when selected project changes
  useEffect(() => {
    if (selectedProject && isEditOpen) {
      const project = selectedProject.project;
      const title = project.title || "";
      const description = project.description || "";
      const status = project.status || "";
      const stage = project.stage || "";
      const projectCurrency = project.currency;
      const currency =
        projectCurrency === "USD" || projectCurrency === "EUR"
          ? (projectCurrency as "USD" | "EUR")
          : "EUR";
      const subtotal = project.subtotal || "";
      const startDate = project.startDate
        ? new Date(project.startDate).toISOString().split("T")[0]
        : "";
      const deadline = project.deadline
        ? new Date(project.deadline).toISOString().split("T")[0]
        : "";

      // Set form values
      setEditTitle(title);
      setEditDescription(description);
      setEditStatus(status);
      setEditStage(stage);
      setEditCurrency(currency);
      setEditSubtotal(subtotal);
      setEditStartDate(startDate);
      setEditDeadline(deadline);

      // Store original values
      setOriginalTitle(title);
      setOriginalDescription(description);
      setOriginalStatus(status);
      setOriginalStage(stage);
      setOriginalCurrency(currency);
      setOriginalSubtotal(subtotal);
      setOriginalStartDate(startDate);
      setOriginalDeadline(deadline);
    }
  }, [selectedProject, isEditOpen]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!selectedProject || !isEditOpen) return false;

    return (
      editTitle.trim() !== originalTitle ||
      editDescription.trim() !== originalDescription ||
      editStatus !== originalStatus ||
      editStage !== originalStage ||
      editCurrency !== originalCurrency ||
      editSubtotal.trim() !== originalSubtotal ||
      editStartDate !== originalStartDate ||
      editDeadline !== originalDeadline
    );
  }, [
    selectedProject,
    isEditOpen,
    editTitle,
    originalTitle,
    editDescription,
    originalDescription,
    editStatus,
    originalStatus,
    editStage,
    originalStage,
    editCurrency,
    originalCurrency,
    editSubtotal,
    originalSubtotal,
    editStartDate,
    originalStartDate,
    editDeadline,
    originalDeadline,
  ]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const status = editStatus;
    const stage = editStage;
    const projectType = selectedProject.project.type as "client" | "labs";

    // Convert empty string to null for subtotal
    const subtotal =
      editSubtotal && editSubtotal.trim() ? editSubtotal.trim() : null;

    updateMutation.mutate(
      {
        id: selectedProject.project.id,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        status,
        stage,
        type: projectType,
        subtotal: projectType === "labs" ? null : subtotal,
        currency: editCurrency,
        startDate: editStartDate || null,
        deadline: projectType === "labs" ? null : editDeadline || null,
      },
      {
        onSuccess: () => {
          toast.success("Project updated successfully");
          setIsEditOpen(false);
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to update project");
        },
      }
    );
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    // React Query will automatically refetch projects
  };

  const handleCreateError = () => {
    setIsCreateOpen(true); // Reopen modal on failure so user can retry
  };

  const handleDelete = async () => {
    if (!deleteProject) return;

    deleteMutation.mutate(deleteProject.project.id, {
      onSuccess: () => {
        toast.success("Project deleted successfully");
        setDeleteProject(null);
      },
      onError: (error: Error) => {
        console.error("Error deleting project:", error);
        toast.error("Failed to delete project");
      },
    });
  };

  const EditContent = () => (
    <>
      <DrawerHeader className="gap-1">
        <DrawerTitle>Edit Project</DrawerTitle>
        <DrawerDescription>Update project details</DrawerDescription>
      </DrawerHeader>
      <form
        id="edit-form"
        onSubmit={handleUpdate}
        className="flex flex-col gap-4 overflow-y-auto px-4 text-sm"
      >
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-id">Project ID</Label>
          <div className="flex gap-2">
            <Input
              id="edit-id"
              value={selectedProject?.project.id || ""}
              disabled
              className="bg-muted font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (selectedProject?.project.id) {
                  navigator.clipboard.writeText(selectedProject.project.id);
                  toast.success("Project ID copied to clipboard");
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-title">Title</Label>
          <Input
            id="edit-title"
            name="title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            name="description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-status">Status</Label>
            <StatusCombobox
              key={`status-${selectedProject?.project.id}-${editStatus}`}
              options={PROJECT_STATUSES}
              value={editStatus}
              onValueChange={setEditStatus}
              placeholder="Select status..."
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-stage">Stage</Label>
            <StatusCombobox
              key={`stage-${selectedProject?.project.id}-${editStage}`}
              options={
                selectedProject?.project.type === "labs"
                  ? LABS_PROJECT_STAGES
                  : CLIENT_PROJECT_STAGES
              }
              value={editStage}
              onValueChange={setEditStage}
              placeholder="Select stage..."
            />
          </div>
        </div>
        {(selectedProject?.project.type === "client" ||
          !selectedProject?.project.type) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="edit-subtotal">Subtotal</Label>
              <Input
                id="edit-subtotal"
                name="subtotal"
                type="text"
                value={editSubtotal}
                onChange={(e) => setEditSubtotal(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="edit-currency">Currency</Label>
              <Select
                value={editCurrency}
                onValueChange={(value) =>
                  setEditCurrency(value as "USD" | "EUR")
                }
              >
                <SelectTrigger id="edit-currency" className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-start-date">Start Date</Label>
            <Input
              id="edit-start-date"
              name="startDate"
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
            />
          </div>
          {(selectedProject?.project.type === "client" ||
            !selectedProject?.project.type) && (
            <div className="flex flex-col gap-3">
              <Label htmlFor="edit-deadline">Deadline</Label>
              <Input
                id="edit-deadline"
                name="deadline"
                type="date"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
              />
            </div>
          )}
        </div>
      </form>
      <DrawerFooter>
        <Button
          type="submit"
          form="edit-form"
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        <DrawerClose asChild>
          <Button variant="outline">Cancel</Button>
        </DrawerClose>
      </DrawerFooter>
    </>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">All Projects</h2>
        <p className="text-muted-foreground">
          Create and configure projects for client organizations
        </p>
      </div>

      {/* Client Projects Table */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-semibold">Client Projects</h3>
          {clientPagination && (
            <span className="text-sm text-muted-foreground">
              ({clientPagination.totalCount} total)
            </span>
          )}
        </div>

        {/* Client Projects Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search client projects..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {clientSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setClientSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={clientStatusFilter || "all"}
              onValueChange={(value) => {
                setClientStatusFilter(value === "all" ? undefined : value);
                setClientPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isMobile ? (
            <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DrawerTrigger asChild>
                <Button>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Project
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Create Project</DrawerTitle>
                  <DrawerDescription>
                    Create and configure a new project
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4">
                  <CreateProjectForm
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
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                  <DialogDescription>
                    Create and configure a new project for a client organization
                  </DialogDescription>
                </DialogHeader>
                <CreateProjectForm
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
              {clientTable.getHeaderGroups().map((headerGroup) => (
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
                Array.from({ length: clientPageSize }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    {columns.map((_, colIndex) => (
                      <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : clientTable.getRowModel().rows?.length ? (
                clientTable.getRowModel().rows.map((row) => (
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
                    No client projects found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Client Projects Pagination */}
        {clientPagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Rows per page</p>
              <Select
                value={`${clientPageSize}`}
                onValueChange={(value) => {
                  const newPageSize = Number(value);
                  setClientPageSize(newPageSize);
                  setClientPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={clientPageSize} />
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
                Page {clientPagination.page} of {clientPagination.totalPages}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setClientPage(1)}
                  disabled={clientPage === 1}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setClientPage(clientPage - 1)}
                  disabled={clientPage === 1}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setClientPage(clientPage + 1)}
                  disabled={clientPage >= clientPagination.totalPages}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setClientPage(clientPagination.totalPages)}
                  disabled={clientPage >= clientPagination.totalPages}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EXO Labs Projects Table */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-semibold">EXO Labs Projects</h3>
          {labsPagination && (
            <span className="text-sm text-muted-foreground">
              ({labsPagination.totalCount} total)
            </span>
          )}
        </div>

        {/* Labs Projects Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search EXO Labs projects..."
                value={labsSearchQuery}
                onChange={(e) => setLabsSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {labsSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setLabsSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={labsStatusFilter || "all"}
              onValueChange={(value) => {
                setLabsStatusFilter(value === "all" ? undefined : value);
                setLabsPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {labsTable.getHeaderGroups().map((headerGroup) => (
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
                Array.from({ length: labsPageSize }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    {labsColumns.map((_, colIndex) => (
                      <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : labsTable.getRowModel().rows?.length ? (
                labsTable.getRowModel().rows.map((row) => (
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
                    colSpan={labsColumns.length}
                    className="h-24 text-center"
                  >
                    No EXO Labs projects found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Labs Projects Pagination */}
        {labsPagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Rows per page</p>
              <Select
                value={`${labsPageSize}`}
                onValueChange={(value) => {
                  const newPageSize = Number(value);
                  setLabsPageSize(newPageSize);
                  setLabsPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={labsPageSize} />
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
                Page {labsPagination.page} of {labsPagination.totalPages}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setLabsPage(1)}
                  disabled={labsPage === 1}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setLabsPage(labsPage - 1)}
                  disabled={labsPage === 1}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setLabsPage(labsPage + 1)}
                  disabled={labsPage >= labsPagination.totalPages}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setLabsPage(labsPagination.totalPages)}
                  disabled={labsPage >= labsPagination.totalPages}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isMobile ? (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent>{selectedProject && <EditContent />}</DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedProject && (
              <>
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                  <DialogDescription>Update project details</DialogDescription>
                </DialogHeader>
                <form
                  id="edit-form"
                  onSubmit={handleUpdate}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="edit-id">Project ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit-id"
                        value={selectedProject.project.id}
                        disabled
                        className="bg-muted font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            selectedProject.project.id
                          );
                          toast.success("Project ID copied to clipboard");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input
                      id="edit-title"
                      name="title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      name="description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <StatusCombobox
                        options={PROJECT_STATUSES}
                        value={editStatus}
                        onValueChange={setEditStatus}
                        placeholder="Select status..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-stage">Stage</Label>
                      <StatusCombobox
                        options={
                          selectedProject.project.type === "labs"
                            ? LABS_PROJECT_STAGES
                            : CLIENT_PROJECT_STAGES
                        }
                        value={editStage}
                        onValueChange={setEditStage}
                        placeholder="Select stage..."
                      />
                    </div>
                  </div>
                  {(selectedProject.project.type === "client" ||
                    !selectedProject.project.type) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-subtotal">Subtotal</Label>
                        <Input
                          id="edit-subtotal"
                          name="subtotal"
                          type="text"
                          value={editSubtotal}
                          onChange={(e) => setEditSubtotal(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-currency">Currency</Label>
                        <Select
                          value={editCurrency}
                          onValueChange={(value) =>
                            setEditCurrency(value as "USD" | "EUR")
                          }
                        >
                          <SelectTrigger id="edit-currency" className="w-full">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-start-date">Start Date</Label>
                      <Input
                        id="edit-start-date"
                        name="startDate"
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                      />
                    </div>
                    {(selectedProject.project.type === "client" ||
                      !selectedProject.project.type) && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-deadline">Deadline</Label>
                        <Input
                          id="edit-deadline"
                          name="deadline"
                          type="date"
                          value={editDeadline}
                          onChange={(e) => setEditDeadline(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!hasChanges || updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
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
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteProject?.project.title}"? This action cannot be undone.`}
        itemName="Project"
        confirmationText={deleteProject?.project.title || ""}
        warningMessage="This will permanently delete the project and all associated data including hour registrations, deliverables, and client assets. This action cannot be undone."
      />
    </div>
  );
}
