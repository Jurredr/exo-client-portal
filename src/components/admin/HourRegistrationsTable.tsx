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

interface HourRegistration {
  id: string;
  userId: string;
  projectId: string | null;
  description: string;
  hours: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

const columns: ColumnDef<HourRegistration>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.original.date);
      return <div>{date.toLocaleDateString()}</div>;
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
    accessorKey: "hours",
    header: "Hours",
    cell: ({ row }) => {
      const hours = parseFloat(row.original.hours);
      return (
        <div className="font-medium">
          {hours.toFixed(2)} {hours === 1 ? "hour" : "hours"}
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

