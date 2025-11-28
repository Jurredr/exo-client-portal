"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { EnhancedDataTable } from "@/components/enhanced-data-table";

interface HourRegistration {
  id: string;
  userId: string;
  projectId: string | null;
  description: string;
  hours: string;
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

const createColumns = (onDelete: (id: string) => Promise<void>): ColumnDef<HourRegistration>[] => [
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
      return <div>{date.toLocaleDateString()}</div>;
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
            <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
            <AvatarFallback>
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user.name || user.email}</span>
            {user.name && (
              <span className="text-xs text-muted-foreground">{user.email}</span>
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
          {project ? project.title : <span className="text-muted-foreground">—</span>}
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
      return (
        <div className="font-medium">
          {formatHours(hours)}
        </div>
      );
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
      return (
        <div className="text-muted-foreground text-sm">
          {date.toLocaleString()}
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
        if (!confirm("Are you sure you want to delete this hour registration?")) {
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
  const [registrations, setRegistrations] = useState<HourRegistration[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    hours: "",
    minutes: "",
    description: "",
    projectId: undefined as string | undefined,
  });

  useEffect(() => {
    fetchRegistrations();
    fetchProjects();

    // Listen for hour registration saved events
    const handleRefresh = () => {
      fetchRegistrations();
    };
    window.addEventListener("hour-registration-saved", handleRefresh);
    return () => window.removeEventListener("hour-registration-saved", handleRefresh);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(
          data.map((item: { project: Project }) => ({
            id: item.project.id,
            title: item.project.title,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchRegistrations = async () => {
    try {
      const response = await fetch("/api/hour-registrations");
      if (response.ok) {
        const data = await response.json();
        setRegistrations(data);
      }
    } catch (error) {
      console.error("Error fetching hour registrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/hour-registrations?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete hour registration");
      }

      toast.success("Hour registration deleted successfully");
      fetchRegistrations();
    } catch (error) {
      console.error("Error deleting hour registration:", error);
      toast.error("Failed to delete hour registration");
    }
  };

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

    // Convert hours and minutes to decimal hours
    const totalHours = hoursNum + minutesNum / 60;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/hour-registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: manualEntry.description.trim(),
          hours: totalHours,
          projectId: manualEntry.projectId && manualEntry.projectId !== "none" ? manualEntry.projectId : null,
          date: manualEntry.date,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save hour registration");
      }

      toast.success("Hour registration added successfully");
      setIsManualEntryOpen(false);
      setManualEntry({
        date: new Date().toISOString().split("T")[0],
        hours: "",
        minutes: "",
        description: "",
        projectId: undefined,
      });
      fetchRegistrations();
      window.dispatchEvent(new Event("hour-registration-saved"));
    } catch (error) {
      console.error("Error saving hour registration:", error);
      toast.error("Failed to save hour registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo(() => createColumns(handleDelete), [handleDelete]);

  const projectFilterOptions = useMemo(() => {
    return projects.map((project) => ({ label: project.title, value: project.id }));
  }, [projects]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Hour Registrations</h2>
          <p className="text-muted-foreground">View and manage hour registrations</p>
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
                  options: [{ label: "None", value: "none" }, ...projectFilterOptions],
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-hours">Hours</Label>
                    <Input
                      id="manual-hours"
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
                    <Label htmlFor="manual-minutes">Minutes</Label>
                    <Input
                      id="manual-minutes"
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
                  <Label htmlFor="manual-description">Description *</Label>
                  <Textarea
                    id="manual-description"
                    placeholder="Describe the work..."
                    value={manualEntry.description}
                    onChange={(e) =>
                      setManualEntry({ ...manualEntry, description: e.target.value })
                    }
                    rows={4}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-project">Project (Optional)</Label>
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
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  );
}

