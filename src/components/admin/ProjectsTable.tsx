"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ColumnDef,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { StatusCombobox, StatusOption } from "@/components/status-combobox";
import { cn } from "@/lib/utils";
import {
  FolderPlus,
  DollarSign,
  Calendar,
  ExternalLink,
  Copy,
  Trash2,
  Pencil,
  ArrowUpDown,
  MoreVertical,
} from "lucide-react";
import { CreateProjectForm } from "./CreateProjectForm";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import Link from "next/link";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectData {
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    stage: string;
    startDate: string | null;
    deadline: string | null;
    subtotal: string;
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

const PROJECT_STAGES: StatusOption[] = [
  { value: "kick_off", label: "Kick Off", state: "bg-blue-500" },
  { value: "pay_first", label: "Pay First", state: "bg-yellow-500" },
  { value: "deliver", label: "Deliver", state: "bg-purple-500" },
  { value: "revise", label: "Revise", state: "bg-orange-500" },
  { value: "pay_final", label: "Pay Final", state: "bg-cyan-500" },
  { value: "completed", label: "Completed", state: "bg-green-500" },
];

const PROJECT_STATUSES: StatusOption[] = [
  { value: "active", label: "Active", state: "bg-green-500" },
  { value: "completed", label: "Completed", state: "bg-blue-500" },
  { value: "on_hold", label: "On Hold", state: "bg-yellow-500" },
  { value: "cancelled", label: "Cancelled", state: "bg-red-500" },
];

// Format stage value to readable label
const formatStage = (stage: string) => {
  const stageConfig = PROJECT_STAGES.find((s) => s.value === stage);
  return stageConfig
    ? stageConfig.label
    : stage
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

// Format status value to readable label
const formatStatus = (status: string) => {
  const statusConfig = PROJECT_STATUSES.find((s) => s.value === status);
  return statusConfig
    ? statusConfig.label
    : status.charAt(0).toUpperCase() + status.slice(1);
};

// Get status indicator color from PROJECT_STATUSES
const getStatusColor = (status: string) => {
  const statusConfig = PROJECT_STATUSES.find((s) => s.value === status);
  return statusConfig ? statusConfig.state : "bg-gray-500";
};

// Get stage indicator color from PROJECT_STAGES
const getStageColor = (stage: string) => {
  const stageConfig = PROJECT_STAGES.find((s) => s.value === stage);
  return stageConfig ? stageConfig.state : "bg-gray-500";
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
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [organizations, setOrganizations] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(
    null
  );
  const [editStatus, setEditStatus] = useState<string>("");
  const [editStage, setEditStage] = useState<string>("");
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
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
          return rowA.original.project.title.localeCompare(rowB.original.project.title);
        },
      },
      {
        accessorKey: "organization.name",
        id: "organization",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
          return rowA.original.organization.name.localeCompare(rowB.original.organization.name);
        },
      },
      {
        accessorKey: "project.status",
        id: "status",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="-ml-3 h-8"
            >
              Status
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const status = row.original.project.status;
          return (
            <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
              <span
                className={cn("size-1.5 rounded-full", getStatusColor(status))}
              />
              {formatStatus(status)}
            </Badge>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.project.status.localeCompare(rowB.original.project.status);
        },
      },
      {
        accessorKey: "project.stage",
        id: "stage",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="-ml-3 h-8"
            >
              Stage
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const stage = row.original.project.stage;
          return (
            <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
              <span
                className={cn("size-1.5 rounded-full", getStageColor(stage))}
              />
              {formatStage(stage)}
            </Badge>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.project.stage.localeCompare(rowB.original.project.stage);
        },
      },
      {
        accessorKey: "project.subtotal",
        id: "subtotal",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="-ml-3 h-8"
            >
              Subtotal
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            ${row.original.project.subtotal}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.project.subtotal) || 0;
          const b = parseFloat(rowB.original.project.subtotal) || 0;
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
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
              <DropdownMenuItem
                asChild
                onClick={(e) => e.stopPropagation()}
              >
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

  useEffect(() => {
    fetchProjects();
    fetchOrganizations();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Error fetching projects:", errorData);
        toast.error(errorData.error || "Failed to load projects");
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
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

  const handleRowClick = (project: ProjectData) => {
    setSelectedProject(project);
    setEditStatus(project.project.status);
    setEditStage(project.project.stage);
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const status = editStatus;
    const stage = editStage;
    const subtotal = formData.get("subtotal") as string;
    const startDate = formData.get("startDate") as string;
    const deadline = formData.get("deadline") as string;

    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedProject.project.id,
          title,
          description: description || null,
          status,
          stage,
          subtotal,
          startDate: startDate || null,
          deadline: deadline || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update project");
      }

      toast.success("Project updated successfully");
      setIsEditOpen(false);
      fetchProjects();
    } catch (error) {
      toast.error("Failed to update project");
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    fetchProjects();
  };

  const handleDelete = async () => {
    if (!deleteProject) return;

    try {
      const response = await fetch(
        `/api/projects?id=${deleteProject.project.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      toast.success("Project deleted successfully");
      fetchProjects();
      setDeleteProject(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

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
            defaultValue={selectedProject?.project.title}
            required
          />
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            name="description"
            defaultValue={selectedProject?.project.description || ""}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-status">Status</Label>
            <StatusCombobox
              options={PROJECT_STATUSES}
              value={editStatus}
              onValueChange={setEditStatus}
              placeholder="Select status..."
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-stage">Stage</Label>
            <StatusCombobox
              options={PROJECT_STAGES}
              value={editStage}
              onValueChange={setEditStage}
              placeholder="Select stage..."
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="edit-subtotal">Subtotal</Label>
          <Input
            id="edit-subtotal"
            name="subtotal"
            type="text"
            defaultValue={selectedProject?.project.subtotal}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-start-date">Start Date</Label>
            <Input
              id="edit-start-date"
              name="startDate"
              type="date"
              defaultValue={
                selectedProject?.project.startDate
                  ? new Date(selectedProject.project.startDate)
                      .toISOString()
                      .split("T")[0]
                  : ""
              }
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-deadline">Deadline</Label>
            <Input
              id="edit-deadline"
              name="deadline"
              type="date"
              defaultValue={
                selectedProject?.project.deadline
                  ? new Date(selectedProject.project.deadline)
                      .toISOString()
                      .split("T")[0]
                  : ""
              }
            />
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
        <h2 className="text-2xl font-semibold">All Projects</h2>
        <p className="text-muted-foreground">
          Create and configure projects for client organizations
        </p>
      </div>

      <EnhancedDataTable
        columns={columns}
        data={projects}
        searchPlaceholder="Search projects by title or organization..."
        searchFn={(row, query) => {
          const title = row.project.title.toLowerCase();
          const org = row.organization.name.toLowerCase();
          return title.includes(query) || org.includes(query);
        }}
        filterConfig={{
          status: {
            label: "Status",
            options: PROJECT_STATUSES.map((s) => ({ label: s.label, value: s.value })),
            getValue: (row) => row.project.status,
          },
          stage: {
            label: "Stage",
            options: PROJECT_STAGES.map((s) => ({ label: s.label, value: s.value })),
            getValue: (row) => row.project.stage,
          },
        }}
        initialSorting={[{ id: "title", desc: false }]}
        onRowClick={handleRowClick}
        emptyMessage="No projects found."
        toolbar={
          isMobile ? (
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
                  <CreateProjectForm onSuccess={handleCreateSuccess} />
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
                <CreateProjectForm onSuccess={handleCreateSuccess} />
              </DialogContent>
            </Dialog>
          )
        }
      />

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
                      defaultValue={selectedProject.project.title}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      name="description"
                      defaultValue={selectedProject.project.description || ""}
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
                        options={PROJECT_STAGES}
                        value={editStage}
                        onValueChange={setEditStage}
                        placeholder="Select stage..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-subtotal">Subtotal</Label>
                    <Input
                      id="edit-subtotal"
                      name="subtotal"
                      type="text"
                      defaultValue={selectedProject.project.subtotal}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-start-date">Start Date</Label>
                      <Input
                        id="edit-start-date"
                        name="startDate"
                        type="date"
                        defaultValue={
                          selectedProject.project.startDate
                            ? new Date(selectedProject.project.startDate)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-deadline">Deadline</Label>
                      <Input
                        id="edit-deadline"
                        name="deadline"
                        type="date"
                        defaultValue={
                          selectedProject.project.deadline
                            ? new Date(selectedProject.project.deadline)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditOpen(false)}
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
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteProject?.project.title}"? This action cannot be undone.`}
        itemName="Project"
        confirmationText={deleteProject?.project.title || ""}
        warningMessage="This will permanently delete the project and all associated data including hour registrations, deliverables, and client assets. This action cannot be undone."
      />
    </div>
  );
}
