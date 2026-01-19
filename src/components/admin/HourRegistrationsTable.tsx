"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  useHourRegistrations,
  useCreateHourRegistration,
  useUpdateHourRegistration,
  useDeleteHourRegistration,
} from "@/hooks/use-hour-registrations";
import { useAllProjects } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { IconDotsVertical } from "@tabler/icons-react";
import { Plus, ArrowUpDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EnhancedDataTable } from "@/components/enhanced-data-table";

interface HourRegistration {
  id: string;
  userId: string;
  projectId: string | null;
  description: string;
  hours: string;
  category: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    title: string;
  } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

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

// Get user initials for avatar fallback
const getInitials = (name: string | null, email: string) => {
  if (name) {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
};

const createColumns = (
  onDelete: (id: string) => Promise<void>,
  onEdit: (registration: HourRegistration) => void
): ColumnDef<HourRegistration>[] => [
  {
    accessorKey: "date",
    id: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.original.date);
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return <div>{`${day}/${month}/${year}`}</div>;
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const dateA = new Date(rowA.original.date).getTime();
      const dateB = new Date(rowB.original.date).getTime();
      return dateA - dateB;
    },
  },
  {
    accessorKey: "user",
    id: "user",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const user = row.original.user;
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || user.email}
            />
            <AvatarFallback>
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {user.name || user.email}
            </span>
            {user.name && (
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </div>
        </div>
      );
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.user.name || rowA.original.user.email;
      const nameB = rowB.original.user.name || rowB.original.user.email;
      return nameA.localeCompare(nameB);
    },
  },
  {
    accessorKey: "description",
    id: "description",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          Description
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="max-w-md truncate">{row.original.description}</div>
    ),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.description.localeCompare(rowB.original.description);
    },
  },
  {
    accessorKey: "project",
    id: "project",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          Project
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const project = row.original.project;
      return (
        <div className="font-medium">
          {project ? (
            project.title
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      );
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const projectA = rowA.original.project?.title || "";
      const projectB = rowB.original.project?.title || "";
      return projectA.localeCompare(projectB);
    },
  },
  {
    accessorKey: "hours",
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
      const hours = parseFloat(row.original.hours);
      return <div className="font-medium">{formatHours(hours)}</div>;
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const hoursA = parseFloat(rowA.original.hours);
      const hoursB = parseFloat(rowB.original.hours);
      return hoursA - hoursB;
    },
  },
  {
    accessorKey: "createdAt",
    id: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          Logged At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return (
        <div className="text-muted-foreground text-sm">
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
    cell: ({ row }) => {
      const handleDelete = async () => {
        if (
          !confirm("Are you sure you want to delete this hour registration?")
        ) {
          return;
        }

        await onDelete(row.original.id);
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <IconDotsVertical />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
  },
];

interface Project {
  id: string;
  title: string;
}

export function HourRegistrationsTable() {
  // TanStack Query hooks
  const { data: registrationsData, isLoading: isLoadingRegistrations } =
    useHourRegistrations(1, undefined, true);
  const { data: projectsData, isLoading: isLoadingProjects } = useAllProjects();
  const createMutation = useCreateHourRegistration();
  const updateMutation = useUpdateHourRegistration();
  const deleteMutation = useDeleteHourRegistration();

  const registrations = registrationsData?.data || [];
  const loading = isLoadingRegistrations || isLoadingProjects;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Local state
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRegistration, setEditingRegistration] =
    useState<HourRegistration | null>(null);
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    hours: "",
    minutes: "",
    description: "",
    category: "client" as
      | "client"
      | "administration"
      | "brainstorming"
      | "research"
      | "labs"
      | "client_acquisition"
      | "content_creation"
      | "traveling",
    projectId: undefined as string | undefined,
  });

  // Process projects data
  const allProjects = useMemo(() => {
    if (!projectsData) return [];
    return projectsData.map(
      (item: { project: Project & { type?: string } }) => ({
        id: item.project.id,
        title: item.project.title,
        type: item.project.type || "client",
      })
    );
  }, [projectsData]);

  // Projects filtered by category - computed with useMemo
  const projects = useMemo(() => {
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
      "client_acquisition",
      "content_creation",
    ];

    if (nonProjectCategories.includes(manualEntry.category)) {
      return [];
    } else if (manualEntry.category === "labs") {
      return allProjects
        .filter((p: Project & { type?: string }) => p.type === "labs")
        .map((p: Project & { type?: string }) => ({
          id: p.id,
          title: p.title,
        }));
    } else {
      // client
      return allProjects
        .filter((p: Project & { type?: string }) => p.type === "client")
        .map((p: Project & { type?: string }) => ({
          id: p.id,
          title: p.title,
        }));
    }
  }, [manualEntry.category, allProjects]);

  // Clear projectId when category changes
  const prevCategoryRef = useRef(manualEntry.category);
  useEffect(() => {
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
      "client_acquisition",
      "content_creation",
    ];
    if (
      prevCategoryRef.current !== manualEntry.category &&
      (nonProjectCategories.includes(manualEntry.category) ||
        manualEntry.category === "client")
    ) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setManualEntry((prev) => ({ ...prev, projectId: undefined }));
      }, 0);
      prevCategoryRef.current = manualEntry.category;
    }
  }, [manualEntry.category]);

  // Listen for hour registration saved events (for components not using React Query)
  useEffect(() => {
    const handleRefresh = () => {
      // React Query will automatically refetch, but we can trigger it manually if needed
      // The mutation hooks already handle invalidation
    };
    window.addEventListener("hour-registration-saved", handleRefresh);
    return () =>
      window.removeEventListener("hour-registration-saved", handleRefresh);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Are you sure you want to delete this hour registration?")) {
        return;
      }

      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast.success("Hour registration deleted successfully");
        },
        onError: (error: Error) => {
          console.error("Error deleting hour registration:", error);
          toast.error("Failed to delete hour registration");
        },
      });
    },
    [deleteMutation]
  );

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    const hoursNum = parseInt(manualEntry.hours) || 0;
    const minutesNum = parseInt(manualEntry.minutes) || 0;

    if (hoursNum === 0 && minutesNum === 0) {
      toast.error("Please enter at least 1 hour or minute");
      return;
    }

    if (!manualEntry.description.trim()) {
      toast.error("Description is required");
      return;
    }

    // Validate: non-project categories (administration, brainstorming, research, client_acquisition, content_creation, traveling) should not have a project
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
      "client_acquisition",
      "content_creation",
      "traveling",
    ];
    if (
      nonProjectCategories.includes(manualEntry.category) &&
      manualEntry.projectId
    ) {
      toast.error(
        `${manualEntry.category.charAt(0).toUpperCase() + manualEntry.category.slice(1)} work should not be associated with a project`
      );
      return;
    }

    // Convert hours and minutes to decimal hours
    const totalHours = hoursNum + minutesNum / 60;

    createMutation.mutate(
      {
        description: manualEntry.description.trim(),
        hours: totalHours,
        projectId:
          manualEntry.projectId && manualEntry.projectId !== "none"
            ? manualEntry.projectId
            : null,
        date: manualEntry.date,
        category: manualEntry.category,
      },
      {
        onSuccess: () => {
          toast.success("Hour registration added successfully");
          setIsManualEntryOpen(false);
          setManualEntry({
            date: new Date().toISOString().split("T")[0],
            hours: "",
            minutes: "",
            description: "",
            category: "client",
            projectId: undefined,
          });
          window.dispatchEvent(new Event("hour-registration-saved"));
        },
        onError: (error: Error) => {
          console.error("Error saving hour registration:", error);
          toast.error("Failed to save hour registration");
        },
      }
    );
  };

  const handleEdit = useCallback((registration: HourRegistration) => {
    setEditingRegistration(registration);
    // Convert hours to hours and minutes
    const totalHours = parseFloat(registration.hours);
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);

    setManualEntry({
      date: new Date(registration.date).toISOString().split("T")[0],
      hours: hours.toString(),
      minutes: minutes.toString(),
      description: registration.description,
      category: (registration.category || "client") as
        | "client"
        | "administration"
        | "brainstorming"
        | "research"
        | "labs"
        | "client_acquisition"
        | "content_creation",
      projectId: registration.projectId || undefined,
    });
    setIsEditOpen(true);
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistration) return;

    const hoursNum = parseInt(manualEntry.hours) || 0;
    const minutesNum = parseInt(manualEntry.minutes) || 0;

    if (hoursNum === 0 && minutesNum === 0) {
      toast.error("Please enter at least 1 hour or minute");
      return;
    }

    if (!manualEntry.description.trim()) {
      toast.error("Description is required");
      return;
    }

    // Validate: non-project categories (administration, brainstorming, research, client_acquisition, content_creation, traveling) should not have a project
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
      "client_acquisition",
      "content_creation",
      "traveling",
    ];
    if (
      nonProjectCategories.includes(manualEntry.category) &&
      manualEntry.projectId
    ) {
      toast.error(
        `${manualEntry.category.charAt(0).toUpperCase() + manualEntry.category.slice(1)} work should not be associated with a project`
      );
      return;
    }

    // Convert hours and minutes to decimal hours
    const totalHours = hoursNum + minutesNum / 60;

    updateMutation.mutate(
      {
        id: editingRegistration.id,
        description: manualEntry.description.trim(),
        hours: totalHours,
        projectId:
          manualEntry.projectId && manualEntry.projectId !== "none"
            ? manualEntry.projectId
            : null,
        date: manualEntry.date,
        category: manualEntry.category,
      },
      {
        onSuccess: () => {
          toast.success("Hour registration updated successfully");
          setIsEditOpen(false);
          setEditingRegistration(null);
          setManualEntry({
            date: new Date().toISOString().split("T")[0],
            hours: "",
            minutes: "",
            description: "",
            category: "client",
            projectId: undefined,
          });
          window.dispatchEvent(new Event("hour-registration-saved"));
        },
        onError: (error: Error) => {
          console.error("Error updating hour registration:", error);
          toast.error("Failed to update hour registration");
        },
      }
    );
  };

  const columns = useMemo(
    () => createColumns(handleDelete, handleEdit),
    [handleDelete, handleEdit]
  );

  const projectFilterOptions = useMemo(() => {
    return projects.map((project: Project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Hour Registrations</h2>
          <p className="text-muted-foreground">
            View and manage hour registrations
          </p>
        </div>
      </div>
      <EnhancedDataTable
        columns={columns}
        data={registrations}
        searchPlaceholder="Search by description, user, or project..."
        searchFn={(row, query) => {
          const description = row.description.toLowerCase();
          const userName = (row.user.name || "").toLowerCase();
          const userEmail = row.user.email.toLowerCase();
          const projectTitle = (row.project?.title || "").toLowerCase();
          return (
            description.includes(query) ||
            userName.includes(query) ||
            userEmail.includes(query) ||
            projectTitle.includes(query)
          );
        }}
        filterConfig={
          projectFilterOptions.length > 0
            ? {
                project: {
                  label: "Project",
                  options: [
                    { label: "None", value: "none" },
                    ...projectFilterOptions,
                  ],
                  getValue: (row) => row.project?.id || "none",
                },
              }
            : undefined
        }
        initialSorting={[{ id: "date", desc: true }]}
        emptyMessage="No hour registrations found."
        isLoading={loading}
        toolbar={
          <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Manual Entry</DialogTitle>
                <DialogDescription>
                  Manually log hours for a specific date
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleManualEntry} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-date">Date *</Label>
                  <Input
                    id="manual-date"
                    type="date"
                    value={manualEntry.date}
                    onChange={(e) =>
                      setManualEntry({ ...manualEntry, date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-category">Work Category *</Label>
                  <Select
                    value={manualEntry.category}
                    onValueChange={(value) =>
                      setManualEntry({
                        ...manualEntry,
                        category: value as
                          | "client"
                          | "administration"
                          | "brainstorming"
                          | "research"
                          | "labs"
                          | "client_acquisition"
                          | "content_creation"
                          | "traveling",
                      })
                    }
                  >
                    <SelectTrigger id="manual-category" className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client Work</SelectItem>
                      <SelectItem value="administration">
                        Administration
                      </SelectItem>
                      <SelectItem value="brainstorming">
                        Brainstorming
                      </SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="client_acquisition">
                        Client Acquisition
                      </SelectItem>
                      <SelectItem value="labs">EXO Labs</SelectItem>
                      <SelectItem value="content_creation">
                        Content Creation
                      </SelectItem>
                      <SelectItem value="traveling">Traveling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(manualEntry.category === "client" ||
                  manualEntry.category === "labs" ||
                  manualEntry.category === "content_creation") && (
                  <div className="space-y-2">
                    <Label htmlFor="manual-project">
                      Project{" "}
                      {manualEntry.category === "client" ? "(Optional)" : ""}
                    </Label>
                    <Select
                      value={manualEntry.projectId || "none"}
                      onValueChange={(value) =>
                        setManualEntry({
                          ...manualEntry,
                          projectId: value === "none" ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger id="manual-project" className="w-full">
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((project: Project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-hours">Hours</Label>
                    <Input
                      id="manual-hours"
                      type="number"
                      min="0"
                      value={manualEntry.hours}
                      onChange={(e) =>
                        setManualEntry({
                          ...manualEntry,
                          hours: e.target.value,
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-minutes">Minutes</Label>
                    <Input
                      id="manual-minutes"
                      type="number"
                      min="0"
                      max="59"
                      value={manualEntry.minutes}
                      onChange={(e) =>
                        setManualEntry({
                          ...manualEntry,
                          minutes: e.target.value,
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-description">Description *</Label>
                  <Textarea
                    id="manual-description"
                    placeholder={
                      manualEntry.category === "administration"
                        ? "Describe the administrative work you did..."
                        : manualEntry.category === "brainstorming"
                          ? "Describe your brainstorming session..."
                          : manualEntry.category === "research"
                            ? "Describe the research you conducted..."
                            : manualEntry.category === "client_acquisition"
                              ? "Describe the client acquisition activities..."
                              : manualEntry.category === "content_creation"
                                ? "Describe the content you created..."
                                : manualEntry.category === "traveling"
                                  ? "Describe your travel activities..."
                                  : "Describe the work you did..."
                    }
                    value={manualEntry.description}
                    onChange={(e) =>
                      setManualEntry({
                        ...manualEntry,
                        description: e.target.value,
                      })
                    }
                    rows={4}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsManualEntryOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Add Entry"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hour Registration</DialogTitle>
            <DialogDescription>
              Update the hour registration details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date *</Label>
              <Input
                id="edit-date"
                type="date"
                value={manualEntry.date}
                onChange={(e) =>
                  setManualEntry({ ...manualEntry, date: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Work Category *</Label>
              <Select
                value={manualEntry.category}
                onValueChange={(value) =>
                  setManualEntry({
                    ...manualEntry,
                    category: value as
                      | "client"
                      | "administration"
                      | "brainstorming"
                      | "research"
                      | "labs"
                      | "client_acquisition"
                      | "content_creation"
                      | "traveling",
                  })
                }
              >
                <SelectTrigger id="edit-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client Work</SelectItem>
                  <SelectItem value="administration">Administration</SelectItem>
                  <SelectItem value="brainstorming">Brainstorming</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="client_acquisition">
                    Client Acquisition
                  </SelectItem>
                  <SelectItem value="labs">EXO Labs</SelectItem>
                  <SelectItem value="content_creation">
                    Content Creation
                  </SelectItem>
                  <SelectItem value="traveling">Traveling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(manualEntry.category === "client" ||
              manualEntry.category === "labs" ||
              manualEntry.category === "content_creation") && (
              <div className="space-y-2">
                <Label htmlFor="edit-project">
                  Project{" "}
                  {manualEntry.category === "client" ? "(Optional)" : ""}
                </Label>
                <Select
                  value={manualEntry.projectId || "none"}
                  onValueChange={(value) =>
                    setManualEntry({
                      ...manualEntry,
                      projectId: value === "none" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger id="edit-project" className="w-full">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((project: Project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-hours">Hours</Label>
                <Input
                  id="edit-hours"
                  type="number"
                  min="0"
                  value={manualEntry.hours}
                  onChange={(e) =>
                    setManualEntry({ ...manualEntry, hours: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-minutes">Minutes</Label>
                <Input
                  id="edit-minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={manualEntry.minutes}
                  onChange={(e) =>
                    setManualEntry({ ...manualEntry, minutes: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                placeholder={
                  manualEntry.category === "administration"
                    ? "Describe the administrative work you did..."
                    : manualEntry.category === "brainstorming"
                      ? "Describe your brainstorming session..."
                      : manualEntry.category === "research"
                        ? "Describe the research you conducted..."
                        : manualEntry.category === "client_acquisition"
                          ? "Describe the client acquisition activities..."
                          : manualEntry.category === "content_creation"
                            ? "Describe the content you created..."
                            : manualEntry.category === "traveling"
                              ? "Describe your travel activities..."
                              : "Describe the work you did..."
                }
                value={manualEntry.description}
                onChange={(e) =>
                  setManualEntry({
                    ...manualEntry,
                    description: e.target.value,
                  })
                }
                rows={4}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingRegistration(null);
                  setManualEntry({
                    date: new Date().toISOString().split("T")[0],
                    hours: "",
                    minutes: "",
                    description: "",
                    category: "client",
                    projectId: undefined,
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
