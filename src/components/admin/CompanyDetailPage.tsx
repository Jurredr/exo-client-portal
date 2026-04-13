"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { useCompanyDetails, CompanyDetails } from "@/hooks/use-company-details";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { ArrowLeft, ArrowUpDown, Loader2, Pencil } from "lucide-react";

interface CompanyDetailPageProps {
  companyId: string;
}

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-purple-500",
  active: "bg-green-500",
  completed: "bg-blue-500",
  on_hold: "bg-yellow-500",
  cancelled: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  lead: "Discussing",
  active: "Active",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "€0";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatHours(decimalHours: string | number): string {
  const num =
    typeof decimalHours === "string" ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num) || num === 0) return "0h";
  const totalMinutes = Math.round(num * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  return parts.join(" ");
}

type CompanyProject = CompanyDetails["projects"][number];

export function CompanyDetailPage({ companyId }: CompanyDetailPageProps) {
  const router = useRouter();
  const { data, isLoading } = useCompanyDetails(companyId);

  const projectColumns: ColumnDef<CompanyProject>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.original.title}</div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] || "bg-gray-500"}`}
              />
              <span className="text-sm">{STATUS_LABELS[status] || status}</span>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "subtotal",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Budget
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const subtotal = row.original.subtotal;
          if (!subtotal)
            return <span className="text-muted-foreground">—</span>;
          return <div>{formatCurrency(subtotal)}</div>;
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.subtotal || "0");
          const b = parseFloat(rowB.original.subtotal || "0");
          return a - b;
        },
      },
      {
        accessorKey: "totalHours",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Hours
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => <div>{formatHours(row.original.totalHours)}</div>,
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.totalHours || "0");
          const b = parseFloat(rowB.original.totalHours || "0");
          return a - b;
        },
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-muted-foreground">Company not found</p>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/organizations")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Button>
      </div>
    );
  }

  const { company, projects: companyProjects, revenue, hours } = data;
  const currentYear = new Date().getFullYear();

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/organizations")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-14 w-14">
          <AvatarImage
            src={
              company.imageStoragePath
                ? `/api/organizations/${company.id}/image`
                : undefined
            }
            alt={company.name}
          />
          <AvatarFallback className="text-lg">
            {getInitials(company.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/organizations?edit=${company.id}`)
              }
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            {company.email && <span>{company.email}</span>}
            {company.telephone && <span>{company.telephone}</span>}
            {company.address && <span>{company.address}</span>}
            {company.kvkNumber && <span>KVK: {company.kvkNumber}</span>}
            {company.btwNumber && <span>BTW: {company.btwNumber}</span>}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenue.paidAllTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(revenue.paidCurrentYear)} in {currentYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue Invoiced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenue.invoicedAllTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(revenue.invoicedCurrentYear)} in {currentYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(hours.allTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatHours(hours.currentYear)} in {currentYear}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        <EnhancedDataTable
          columns={projectColumns}
          data={companyProjects}
          searchPlaceholder="Search projects..."
          searchableFields={["title"]}
          initialSorting={[{ id: "title", desc: false }]}
          emptyMessage="No projects found for this company."
        />
      </div>
    </div>
  );
}
