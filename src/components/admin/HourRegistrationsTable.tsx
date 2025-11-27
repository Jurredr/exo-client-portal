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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { IconDotsVertical } from "@tabler/icons-react";
import { toast } from "sonner";

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
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.original.date);
      return <div>{date.toLocaleDateString()}</div>;
    },
  },
  {
    accessorKey: "user",
    header: "User",
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
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <div className="max-w-md truncate">{row.original.description}</div>
    ),
  },
  {
    accessorKey: "project",
    header: "Project",
    cell: ({ row }) => {
      const project = row.original.project;
      return (
        <div className="font-medium">
          {project ? project.title : <span className="text-muted-foreground">—</span>}
        </div>
      );
    },
  },
  {
    accessorKey: "hours",
    header: "Hours",
    cell: ({ row }) => {
      const hours = parseFloat(row.original.hours);
      return (
        <div className="font-medium">
          {formatHours(hours)}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Logged At",
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return (
        <div className="text-muted-foreground text-sm">
          {date.toLocaleString()}
        </div>
      );
    },
  },
  {
    id: "actions",
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
  },
];

export function HourRegistrationsTable() {
  const [registrations, setRegistrations] = useState<HourRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  useEffect(() => {
    fetchRegistrations();

    // Listen for hour registration saved events
    const handleRefresh = () => {
      fetchRegistrations();
    };
    window.addEventListener("hour-registration-saved", handleRefresh);
    return () => window.removeEventListener("hour-registration-saved", handleRefresh);
  }, []);

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

  const columns = createColumns(handleDelete);

  const table = useReactTable({
    data: registrations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-4">
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
    </div>
  );
}

