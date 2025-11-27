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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FolderPlus, DollarSign, Calendar, ExternalLink, Copy } from "lucide-react";
import { CreateProjectForm } from "./CreateProjectForm";
import Link from "next/link";

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
}

const PROJECT_STAGES = [
  { value: "kick_off", label: "Kick Off" },
  { value: "pay_first", label: "Pay First" },
  { value: "deliver", label: "Deliver" },
  { value: "revise", label: "Revise" },
  { value: "pay_final", label: "Pay Final" },
  { value: "completed", label: "Completed" },
];

const PROJECT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
];

const columns: ColumnDef<ProjectData>[] = [
  {
    accessorKey: "project.title",
    header: "Title",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.project.title}</div>
    ),
  },
  {
    accessorKey: "organization.name",
    header: "Organization",
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        {row.original.organization.name}
      </div>
    ),
  },
  {
    accessorKey: "project.status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.project.status}</Badge>
    ),
  },
  {
    accessorKey: "project.stage",
    header: "Stage",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.project.stage}</Badge>
    ),
  },
  {
    accessorKey: "project.subtotal",
    header: "Subtotal",
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        ${row.original.project.subtotal}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button
        variant="outline"
        size="sm"
        asChild
        onClick={(e) => e.stopPropagation()}
      >
        <Link href={`/project/${row.original.project.id}`}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open
        </Link>
      </Button>
    ),
  },
];

export function ProjectsTable() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isMobile = useIsMobile();

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

  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const handleRowClick = (project: ProjectData, e: React.MouseEvent) => {
    // Don't open edit modal if clicking on the actions button
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    setSelectedProject(project);
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const status = formData.get("status") as string;
    const stage = formData.get("stage") as string;
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

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const EditContent = () => (
    <>
      <DrawerHeader className="gap-1">
        <DrawerTitle>Edit Project</DrawerTitle>
        <DrawerDescription>
          Update project details
        </DrawerDescription>
      </DrawerHeader>
      <form id="edit-form" onSubmit={handleUpdate} className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
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
            <Select
              name="status"
              defaultValue={selectedProject?.project.status}
            >
              <SelectTrigger id="edit-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="edit-stage">Stage</Label>
            <Select
              name="stage"
              defaultValue={selectedProject?.project.stage}
            >
              <SelectTrigger id="edit-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  ? new Date(selectedProject.project.startDate).toISOString().split("T")[0]
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
                  ? new Date(selectedProject.project.deadline).toISOString().split("T")[0]
                  : ""
              }
            />
          </div>
        </div>
      </form>
      <DrawerFooter>
        <Button type="submit" form="edit-form">Save Changes</Button>
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
          <h2 className="text-2xl font-semibold">Projects</h2>
          <p className="text-muted-foreground">
            Create and configure projects for client organizations
          </p>
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
                  onClick={(e) => handleRowClick(row.original, e)}
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
                  No projects found.
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
          <DrawerContent>
            {selectedProject && <EditContent />}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedProject && (
              <>
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                  <DialogDescription>
                    Update project details
                  </DialogDescription>
                </DialogHeader>
                <form id="edit-form" onSubmit={handleUpdate} className="space-y-4">
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
                          navigator.clipboard.writeText(selectedProject.project.id);
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
                      <Select
                        name="status"
                        defaultValue={selectedProject.project.status}
                      >
                        <SelectTrigger id="edit-status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-stage">Stage</Label>
                      <Select
                        name="stage"
                        defaultValue={selectedProject.project.stage}
                      >
                        <SelectTrigger id="edit-stage" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_STAGES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                            ? new Date(selectedProject.project.startDate).toISOString().split("T")[0]
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
                            ? new Date(selectedProject.project.deadline).toISOString().split("T")[0]
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
    </div>
  );
}

