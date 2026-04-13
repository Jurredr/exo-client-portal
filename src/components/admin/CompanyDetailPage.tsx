"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useCompanyDetails, CompanyDetails } from "@/hooks/use-company-details";
import {
  useUpdateOrganization,
  organizationKeys,
} from "@/hooks/use-organizations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { ArrowLeft, ArrowUpDown, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

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
    minimumFractionDigits: 2,
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
  const queryClient = useQueryClient();
  const { data, isLoading } = useCompanyDetails(companyId);
  const updateMutation = useUpdateOrganization();

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editKvk, setEditKvk] = useState("");
  const [editBtw, setEditBtw] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelephone, setEditTelephone] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate edit form when dialog opens
  useEffect(() => {
    if (isEditOpen && data?.company) {
      const c = data.company;
      setEditName(c.name);
      setEditAddress(c.address || "");
      setEditKvk(c.kvkNumber || "");
      setEditBtw(c.btwNumber || "");
      setEditEmail(c.email || "");
      setEditTelephone(c.telephone || "");
      setImageFile(null);
      setRemoveImage(false);
      setImagePreview(
        c.imageStoragePath ? `/api/organizations/${c.id}/image` : null
      );
    }
  }, [isEditOpen, data?.company]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setImageFile(file);
      setRemoveImage(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.company) return;
    setIsSubmitting(true);

    if (!editName.trim()) {
      toast.error("Company name is required");
      setIsSubmitting(false);
      return;
    }

    let imageStoragePath: string | null = null;
    let imageSizeBytes: number | null = null;

    if (imageFile) {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", imageFile);
        uploadFormData.append("organizationId", data.company.id);
        const uploadResponse = await fetch("/api/organizations/upload-image", {
          method: "POST",
          body: uploadFormData,
        });
        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || "Failed to upload image");
        }
        const uploadResult = await uploadResponse.json();
        imageStoragePath = uploadResult.storagePath;
        imageSizeBytes = uploadResult.sizeBytes;
      } catch {
        toast.error("Failed to upload image. Please try again.");
        setIsSubmitting(false);
        return;
      }
    }

    updateMutation.mutate(
      {
        id: data.company.id,
        name: editName.trim(),
        imageStoragePath: removeImage
          ? null
          : imageFile
            ? (imageStoragePath ?? null)
            : (data.company.imageStoragePath ?? null),
        imageSizeBytes: removeImage
          ? null
          : imageFile
            ? (imageSizeBytes ?? null)
            : (data.company.imageSizeBytes ?? null),
        address: editAddress.trim() || null,
        kvkNumber: editKvk.trim() || null,
        btwNumber: editBtw.trim() || null,
        email: editEmail.trim() || null,
        telephone: editTelephone.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Company updated successfully");
          setIsEditOpen(false);
          setIsSubmitting(false);
          queryClient.invalidateQueries({
            queryKey: organizationKeys.detail(companyId),
          });
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to update organization");
          setIsSubmitting(false);
        },
      }
    );
  };

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
              onClick={() => setIsEditOpen(true)}
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
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenue.outstandingAllTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(revenue.outstandingCurrentYear)} in {currentYear}
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update company details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="detail-edit-name">Name</Label>
              <Input
                id="detail-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Logo Image</Label>
              <div className="flex items-center gap-4">
                {imagePreview && (
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={imagePreview} alt="Logo" />
                    <AvatarFallback>
                      {getInitials(editName || "O")}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">
                  <Input
                    id="detail-edit-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                </div>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      setRemoveImage(true);
                      const fileInput = document.getElementById(
                        "detail-edit-image"
                      ) as HTMLInputElement;
                      if (fileInput) fileInput.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-4 border rounded-lg p-4">
              <Label className="text-base font-semibold">
                Contact Information (Optional)
              </Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="detail-edit-address">Address</Label>
                  <Input
                    id="detail-edit-address"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Street address, city, postal code, country"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="detail-edit-kvk">KVK Number</Label>
                    <Input
                      id="detail-edit-kvk"
                      value={editKvk}
                      onChange={(e) => setEditKvk(e.target.value)}
                      placeholder="e.g., 90251695"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="detail-edit-btw">BTW Number</Label>
                    <Input
                      id="detail-edit-btw"
                      value={editBtw}
                      onChange={(e) => setEditBtw(e.target.value)}
                      placeholder="e.g., NL004799795B92"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="detail-edit-email">Email</Label>
                    <Input
                      id="detail-edit-email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="detail-edit-telephone">Telephone</Label>
                    <Input
                      id="detail-edit-telephone"
                      type="tel"
                      value={editTelephone}
                      onChange={(e) => setEditTelephone(e.target.value)}
                      placeholder="e.g., +31 6 13458011"
                    />
                  </div>
                </div>
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
              <Button
                type="submit"
                disabled={isSubmitting || updateMutation.isPending}
              >
                {isSubmitting || updateMutation.isPending ? (
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
