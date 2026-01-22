"use client";

import * as React from "react";
import {
  IconDashboard,
  IconClock,
  IconBuilding,
  IconUsers,
  IconFolder,
  IconFileInvoice,
  IconFileText,
  IconReceipt,
} from "@tabler/icons-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo, useRef } from "react";
import type { User } from "@supabase/supabase-js";

import { NavMain, type NavGroup } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useCurrentUser, useUpdateUser } from "@/hooks/use-users";
import { useOrganizations } from "@/hooks/use-organizations";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  // TanStack Query hooks
  const { data: currentUserData, isLoading: isUserDataLoading } =
    useCurrentUser();
  const { data: organizationsData = [] } = useOrganizations();
  const updateUserMutation = useUpdateUser();

  const [user, setUser] = useState<User | null>(null);
  const userImageStoragePath =
    currentUserData?.user?.imageStoragePath || undefined;
  const userName = currentUserData?.user?.name || null;
  const userId = currentUserData?.user?.id || null;
  const userOrganizationId = currentUserData?.user?.organizationId || null;

  // Memoize organizations to prevent dependency changes on every render
  const organizations = useMemo(
    () =>
      organizationsData?.map((org) => ({ id: org.id, name: org.name })) || [],
    [organizationsData]
  );

  // Derive isInEXO from organizations and userOrganizationId
  const isInEXO = useMemo(() => {
    const exoOrg = organizations.find((org) => org.name === "EXO");
    return exoOrg ? userOrganizationId === exoOrg.id : false;
  }, [userOrganizationId, organizations]);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountImagePreview, setAccountImagePreview] = useState<string | null>(
    null
  );
  const [accountImageFile, setAccountImageFile] = useState<File | null>(null);

  // Fetch auth user for email check
  useEffect(() => {
    const fetchAuthUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchAuthUser();
  }, []);

  // Update account image preview when modal opens/closes
  const prevIsAccountModalOpenRef = useRef(false);
  useEffect(() => {
    if (prevIsAccountModalOpenRef.current !== isAccountModalOpen) {
      prevIsAccountModalOpenRef.current = isAccountModalOpen;
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        if (isAccountModalOpen && !accountImageFile) {
          // Show Storage image if available
          if (currentUserData?.user?.imageStoragePath) {
            setAccountImagePreview(
              `/api/users/${currentUserData.user.id}/image`
            );
          } else {
            setAccountImagePreview(null);
          }
        } else if (!isAccountModalOpen) {
          setAccountImagePreview(null);
          setAccountImageFile(null);
        }
      }, 0);
    }
  }, [isAccountModalOpen, accountImageFile, currentUserData]);

  const handleAccountImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAccountImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setAccountImageFile(file);
    }
  };

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get("name") as string;
    const organizationId = formData.get("organizationId") as string;

    // Upload image to Storage if a new file is provided
    let imageStoragePath: string | null = null;
    let imageSizeBytes: number | null = null;

    if (accountImageFile) {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", accountImageFile);
        uploadFormData.append("userId", userId);

        const uploadResponse = await fetch("/api/users/upload-image", {
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
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error("Failed to upload image. Please try again.");
        return;
      }
    }

    updateUserMutation.mutate(
      {
        id: userId,
        name: name.trim() || null,
        organizationId:
          organizationId && organizationId !== "none" ? organizationId : null,
        // Only include image fields if a new file was uploaded
        ...(accountImageFile
          ? {
              imageStoragePath: imageStoragePath ?? null,
              imageSizeBytes: imageSizeBytes ?? null,
            }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success("Account updated successfully");
          setIsAccountModalOpen(false);
          setAccountImagePreview(null);
          setAccountImageFile(null);
          window.dispatchEvent(new Event("user-updated"));
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to update account");
        },
      }
    );
  };

  const navMain = [
    {
      label: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: IconDashboard,
          isActive: pathname === "/dashboard",
        },
      ],
    },
    {
      label: "Work",
      items: [
        {
          title: "Projects",
          url: "/dashboard/projects",
          icon: IconFolder,
          isActive: pathname === "/dashboard/projects",
        },
        {
          title: "Hour Registration",
          url: "/dashboard/hours",
          icon: IconClock,
          isActive: pathname === "/dashboard/hours",
        },
      ],
    },
    {
      label: "Clients",
      items: [
        {
          title: "Users",
          url: "/dashboard/users",
          icon: IconUsers,
          isActive: pathname === "/dashboard/users",
        },
        {
          title: "Organizations",
          url: "/dashboard/organizations",
          icon: IconBuilding,
          isActive: pathname === "/dashboard/organizations",
        },
      ],
    },
    {
      label: "Business",
      items: [
        {
          title: "Invoices",
          url: "/dashboard/invoices",
          icon: IconFileInvoice,
          isActive: pathname === "/dashboard/invoices",
        },
        {
          title: "Expenses",
          url: "/dashboard/expenses",
          icon: IconReceipt,
          isActive: pathname === "/dashboard/expenses",
        },
        {
          title: "Contracts",
          url: "/dashboard/contracts",
          icon: IconFileText,
          isActive: pathname === "/dashboard/contracts",
        },
      ],
    },
  ];

  // Only show user data once we've loaded from database to avoid flash of incorrect data
  const userData =
    user && !isUserDataLoading
      ? {
          name:
            userName ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "User",
          email: user.email || "",
          avatar: userImageStoragePath
            ? `/api/users/${currentUserData?.user?.id}/image`
            : user.user_metadata?.avatar_url || undefined,
        }
      : user
        ? {
            // Loading state - show minimal info
            name: user.user_metadata?.name || "Loading...",
            email: user.email || "",
            avatar: undefined,
          }
        : {
            name: "User",
            email: "",
            avatar: undefined,
          };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <Image
                  src="/exo.svg"
                  alt="EXO"
                  width={32}
                  height={24}
                  className="h-10 w-auto"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navMain as NavGroup[]} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={userData}
          onAccountClick={() => setIsAccountModalOpen(true)}
          showAdminLink={isInEXO && !pathname.startsWith("/dashboard")}
        />
      </SidebarFooter>

      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update your account details</DialogDescription>
          </DialogHeader>
          <form
            id="account-form"
            onSubmit={handleAccountUpdate}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input
                id="account-email"
                type="email"
                value={userData.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">Name</Label>
              <Input
                id="account-name"
                name="name"
                defaultValue={userData.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-org">Organization</Label>
              <Select
                name="organizationId"
                defaultValue={userOrganizationId || "none"}
              >
                <SelectTrigger id="account-org" className="w-full">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Profile Image</Label>
              <div className="flex items-center gap-4">
                {accountImagePreview && (
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={accountImagePreview} alt="Profile" />
                    <AvatarFallback>
                      {userData.name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "U"}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">
                  <Input
                    id="account-image"
                    type="file"
                    accept="image/*"
                    onChange={handleAccountImageChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 5MB. Image will be compressed and stored.
                  </p>
                </div>
                {accountImagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setAccountImagePreview(null);
                      setAccountImageFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAccountModalOpen(false);
                  setAccountImagePreview(null);
                  setAccountImageFile(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
