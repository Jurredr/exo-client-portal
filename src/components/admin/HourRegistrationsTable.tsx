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
import { useContacts } from "@/hooks/use-contacts";
import { shouldShowProjectContact } from "@/lib/constants/hour-registration";
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
import {
  Plus,
  ArrowUpDown,
  Pencil,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

interface HourRegistration {
  id: string;
  userId: string;
  projectId: string | null;
  contactId: string | null;
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
    imageStoragePath: string | null;
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
              src={
                user.imageStoragePath
                  ? `/api/users/${user.id}/image`
                  : undefined
              }
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
  // TanStack Query hooks - server-side pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const {
    data: registrationsData,
    isLoading: isLoadingRegistrations,
    refetch,
  } = useHourRegistrations(page, pageSize, debouncedSearch || undefined, true);
  const { data: projectsData, isLoading: isLoadingProjects } = useAllProjects();
  const { data: contactsData = [] } = useContacts();
  const createMutation = useCreateHourRegistration();
  const updateMutation = useUpdateHourRegistration();
  const deleteMutation = useDeleteHourRegistration();

  const registrations = registrationsData?.data || [];
  const pagination = registrationsData?.pagination;
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
    contactId: undefined as string | undefined,
    projectId: undefined as string | undefined,
  });
  const [originalManualEntry, setOriginalManualEntry] = useState({
    date: "",
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
    contactId: undefined as string | undefined,
    projectId: undefined as string | undefined,
  });

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!editingRegistration) return false;

    return (
      manualEntry.date !== originalManualEntry.date ||
      manualEntry.hours !== originalManualEntry.hours ||
      manualEntry.minutes !== originalManualEntry.minutes ||
      manualEntry.description.trim() !== originalManualEntry.description ||
      manualEntry.category !== originalManualEntry.category ||
      manualEntry.contactId !== originalManualEntry.contactId ||
      manualEntry.projectId !== originalManualEntry.projectId
    );
  }, [editingRegistration, manualEntry, originalManualEntry]);

  // Process projects data (include companyId for contact filtering)
  const allProjects = useMemo(() => {
    if (!projectsData) return [];
    return projectsData.map(
      (item: { project: Project & { type?: string; companyId?: string } }) => ({
        id: item.project.id,
        title: item.project.title,
        type: item.project.type || "client",
        companyId: item.project.companyId,
      })
    );
  }, [projectsData]);

  // Selected contact's companyId (for filtering projects)
  const selectedContactCompanyId = useMemo(() => {
    if (!manualEntry.contactId) return null;
    const contact = contactsData.find((c) => c.id === manualEntry.contactId);
    return contact?.companyId ?? null;
  }, [manualEntry.contactId, contactsData]);

  // Projects filtered by category and optionally by contact's company
  const projects = useMemo(() => {
    if (!shouldShowProjectContact(manualEntry.category)) {
      return [];
    }
    let filtered = allProjects;
    // If contact selected, filter to projects linked to that contact's company
    if (selectedContactCompanyId) {
      filtered = allProjects.filter(
        (p: Project & { type?: string; companyId?: string }) =>
          p.companyId === selectedContactCompanyId
      );
    }
    if (manualEntry.category === "labs") {
      return filtered
        .filter((p: Project & { type?: string }) => p.type === "labs")
        .map((p: Project & { type?: string }) => ({
          id: p.id,
          title: p.title,
        }));
    }
    return filtered
      .filter((p: Project & { type?: string }) => p.type === "client")
      .map((p: Project & { type?: string }) => ({ id: p.id, title: p.title }));
  }, [manualEntry.category, allProjects, selectedContactCompanyId]);

  // Clear projectId when category changes to non-project category
  const prevCategoryRef = useRef(manualEntry.category);
  useEffect(() => {
    if (
      prevCategoryRef.current !== manualEntry.category &&
      !shouldShowProjectContact(manualEntry.category)
    ) {
      setTimeout(() => {
        setManualEntry((prev) => ({ ...prev, projectId: undefined }));
      }, 0);
      prevCategoryRef.current = manualEntry.category;
    }
  }, [manualEntry.category]);

  // Clear projectId when contact changes (project list may change)
  const prevContactIdRef = useRef(manualEntry.contactId);
  useEffect(() => {
    if (prevContactIdRef.current !== manualEntry.contactId) {
      prevContactIdRef.current = manualEntry.contactId;
      setManualEntry((prev) => ({ ...prev, projectId: undefined }));
    }
  }, [manualEntry.contactId]);

  // Listen for hour registration saved events (for components not using React Query)
  useEffect(() => {
    const handleRefresh = () => {
      // React Query will automatically refetch, but we can trigger it manually if needed
      refetch();
    };
    window.addEventListener("hour-registration-saved", handleRefresh);
    return () =>
      window.removeEventListener("hour-registration-saved", handleRefresh);
  }, [refetch]);

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

  const handleExportCSV = useCallback(async () => {
    try {
      toast.loading("Exporting hour registrations...", { id: "export-csv" });

      // Fetch all registrations in batches (API limits pageSize to 100)
      const allRegistrations: HourRegistration[] = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 100;

      while (hasMore) {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
          all: "true",
        });

        const response = await fetch(`/api/hour-registrations?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch hour registrations");
        }

        const data = await response.json();
        allRegistrations.push(...data.data);

        hasMore = page < data.pagination.totalPages;
        page++;
      }

      // Convert to CSV
      const headers = [
        "Date",
        "User",
        "User Email",
        "Description",
        "Project",
        "Category",
        "Hours",
        "Logged At",
      ];

      const rows = allRegistrations.map((reg) => {
        const date = new Date(reg.date);
        const loggedAt = new Date(reg.createdAt);
        const hours = parseFloat(reg.hours);
        const hoursFormatted = formatHours(hours);

        return [
          date.toLocaleDateString("en-GB"), // DD/MM/YYYY format
          reg.user.name || reg.user.email,
          reg.user.email,
          `"${reg.description.replace(/"/g, '""')}"`, // Escape quotes in CSV
          reg.project?.title || "",
          reg.category,
          hoursFormatted,
          loggedAt.toLocaleDateString("en-GB"),
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `hour-registrations-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        `Exported ${allRegistrations.length} hour registration(s)`,
        { id: "export-csv" }
      );
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export hour registrations", { id: "export-csv" });
    }
  }, []);

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

    // Validate: non-project categories should not have a project
    if (
      !shouldShowProjectContact(manualEntry.category) &&
      manualEntry.projectId
    ) {
      toast.error(
        `${manualEntry.category.charAt(0).toUpperCase() + manualEntry.category.slice(1)} work should not be associated with a project`
      );
      return;
    }

    // Convert hours and minutes to decimal hours
    const totalHours = hoursNum + minutesNum / 60;

    // Optimistic close: close modal immediately for faster workflow
    setIsManualEntryOpen(false);
    const entryToRestore = { ...manualEntry };
    setManualEntry({
      date: new Date().toISOString().split("T")[0],
      hours: "",
      minutes: "",
      description: "",
      category: "client",
      contactId: undefined,
      projectId: undefined,
    });

    createMutation.mutate(
      {
        description: manualEntry.description.trim(),
        hours: totalHours,
        contactId:
          manualEntry.contactId && manualEntry.contactId !== "none"
            ? manualEntry.contactId
            : null,
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
          window.dispatchEvent(new Event("hour-registration-saved"));
        },
        onError: (error: Error) => {
          console.error("Error saving hour registration:", error);
          toast.error("Failed to save hour registration");
          // Reopen modal on failure so user can retry
          setIsManualEntryOpen(true);
          setManualEntry(entryToRestore);
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

    const entry = {
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
        | "content_creation"
        | "traveling",
      contactId: registration.contactId || undefined,
      projectId: registration.projectId || undefined,
    };

    setManualEntry(entry);
    setOriginalManualEntry(entry);
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

    // Validate: non-project categories should not have a project
    if (
      !shouldShowProjectContact(manualEntry.category) &&
      manualEntry.projectId
    ) {
      toast.error(
        `${manualEntry.category.charAt(0).toUpperCase() + manualEntry.category.slice(1)} work should not be associated with a project`
      );
      return;
    }

    // Convert hours and minutes to decimal hours
    const totalHours = hoursNum + minutesNum / 60;

    // Optimistic close: close modal immediately for faster workflow
    setIsEditOpen(false);
    const entryToRestore = { ...manualEntry };
    const registrationToRestore = editingRegistration;

    updateMutation.mutate(
      {
        id: editingRegistration.id,
        description: manualEntry.description.trim(),
        hours: totalHours,
        contactId:
          manualEntry.contactId && manualEntry.contactId !== "none"
            ? manualEntry.contactId
            : null,
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
          setEditingRegistration(null);
          setManualEntry({
            date: new Date().toISOString().split("T")[0],
            hours: "",
            minutes: "",
            description: "",
            category: "client",
            contactId: undefined,
            projectId: undefined,
          });
          window.dispatchEvent(new Event("hour-registration-saved"));
        },
        onError: (error: Error) => {
          console.error("Error updating hour registration:", error);
          toast.error("Failed to update hour registration");
          // Reopen modal on failure so user can retry
          setIsEditOpen(true);
          setEditingRegistration(registrationToRestore);
          setManualEntry(entryToRestore);
          setOriginalManualEntry(entryToRestore);
        },
      }
    );
  };

  const columns = useMemo(
    () => createColumns(handleDelete, handleEdit),
    [handleDelete, handleEdit]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  const table = useReactTable({
    data: registrations,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Hour Registrations</h2>
          {pagination && (
            <p className="text-muted-foreground">
              {pagination.totalCount} total registrations
            </p>
          )}
        </div>
      </div>

      {/* Server-side search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by description, user, or project..."
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
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
                  <Label htmlFor="manual-contact">Contact (optional)</Label>
                  <Select
                    value={manualEntry.contactId || "none"}
                    onValueChange={(value) =>
                      setManualEntry({
                        ...manualEntry,
                        contactId: value === "none" ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger id="manual-contact" className="w-full">
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contactsData.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                          {c.email ? ` (${c.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                {shouldShowProjectContact(manualEntry.category) && (
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
        </div>
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
              Array.from({ length: 10 }).map((_, rowIndex) => (
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
                  No hour registrations found.
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
              <Label htmlFor="edit-contact">Contact (optional)</Label>
              <Select
                value={manualEntry.contactId || "none"}
                onValueChange={(value) =>
                  setManualEntry({
                    ...manualEntry,
                    contactId: value === "none" ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="edit-contact" className="w-full">
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contactsData.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                      {c.email ? ` (${c.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            {shouldShowProjectContact(manualEntry.category) && (
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
              <Button type="submit" disabled={!hasChanges || isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
