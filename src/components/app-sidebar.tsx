"use client";

import * as React from "react";
import {
  IconDashboard,
  IconClock,
  IconBuilding,
  IconUsers,
  IconFolder,
} from "@tabler/icons-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { NavMain } from "@/components/nav-main";
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [userImage, setUserImage] = useState<string | undefined>(undefined);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userOrganizationId, setUserOrganizationId] = useState<string | null>(
    null
  );
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [organizations, setOrganizations] = useState<
    { id: string; name: string }[]
  >([]);
  const [accountImagePreview, setAccountImagePreview] = useState<string | null>(
    null
  );
  const [accountImageBase64, setAccountImageBase64] = useState<string | null>(
    null
  );
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);

  const fetchUserData = async () => {
    setIsUserDataLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);

    // Fetch user data from database
    if (user?.email) {
      try {
        const response = await fetch("/api/users/me");
        if (response.ok) {
          const dbUser = await response.json();
          if (dbUser?.image) {
            setUserImage(dbUser.image);
          }
          if (dbUser?.name) {
            setUserName(dbUser.name);
          }
          if (dbUser?.id) {
            setUserId(dbUser.id);
          }
          if (dbUser?.organizationId) {
            setUserOrganizationId(dbUser.organizationId);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsUserDataLoading(false);
      }
    } else {
      setIsUserDataLoading(false);
    }
  };

  useEffect(() => {
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
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (isAccountModalOpen && userImage) {
      setAccountImagePreview(userImage);
      setAccountImageBase64(null);
    } else if (!isAccountModalOpen) {
      setAccountImagePreview(null);
      setAccountImageBase64(null);
    }
  }, [isAccountModalOpen, userImage]);

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
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAccountImageBase64(base64String);
        setAccountImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get("name") as string;
    const organizationId = formData.get("organizationId") as string;

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userId,
          name: name.trim() || null,
          organizationId:
            organizationId && organizationId !== "none" ? organizationId : null,
          image: accountImageBase64 || userImage || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update account");
      }

      toast.success("Account updated successfully");
      setIsAccountModalOpen(false);
      setAccountImagePreview(null);
      setAccountImageBase64(null);
      fetchUserData();
      window.dispatchEvent(new Event("user-updated"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update account"
      );
    }
  };

  useEffect(() => {
    fetchUserData();

    // Listen for user update events
    const handleUserUpdate = () => {
      fetchUserData();
    };
    window.addEventListener("user-updated", handleUserUpdate);
    return () => window.removeEventListener("user-updated", handleUserUpdate);
  }, []);

  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
      isActive: pathname === "/dashboard",
    },
    {
      title: "Clients",
      url: "/dashboard/users",
      icon: IconUsers,
      isActive: pathname === "/dashboard/users",
    },
    {
      title: "Projects",
      url: "/dashboard/projects",
      icon: IconFolder,
      isActive: pathname === "/dashboard/projects",
    },
    {
      title: "Organizations",
      url: "/dashboard/organizations",
      icon: IconBuilding,
      isActive: pathname === "/dashboard/organizations",
    },
    {
      title: "Hour Registration",
      url: "/dashboard/hours",
      icon: IconClock,
      isActive: pathname === "/dashboard/hours",
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
          avatar: userImage || user.user_metadata?.avatar_url || undefined,
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
              className="data-[slot=sidebar-menu-button]:!p-1.5"
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
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={userData}
          onAccountClick={() => setIsAccountModalOpen(true)}
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
                    Max 5MB. Image will be converted to base64.
                  </p>
                </div>
                {accountImagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setAccountImagePreview(null);
                      setAccountImageBase64(null);
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
                  setAccountImageBase64(null);
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
