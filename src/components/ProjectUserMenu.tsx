"use client";

import { IconLogout, IconUserCircle, IconDashboard } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ProjectUserMenu({
  user,
  organization,
  showAdminLink = false,
  onAccountClick,
}: {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  organization?: string;
  showAdminLink?: boolean;
  onAccountClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="fixed top-12 right-10 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center justify-between gap-4 h-auto p-2 rounded-xl hover:bg-transparent outline-none focus-visible:outline-none focus-visible:ring-0"
          >
            <div className="flex flex-col items-end justify-center">
              <p className="font-semibold text-lg leading-tight text-white">
                {user.name}
              </p>
              {organization && (
                <p className="font-normal text-sm leading-tight text-white/90">
                  {organization}
                </p>
              )}
            </div>
            <Avatar className="h-11 w-11 shrink-0 rounded-full ring-1 ring-white/20">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-full bg-gray-100 text-white font-semibold text-xl">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="z-60 w-56 rounded-lg border border-gray-200 bg-white/95 shadow-lg backdrop-blur-md"
          sideOffset={8}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          {(showAdminLink && !pathname.startsWith("/dashboard")) ||
          onAccountClick ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {showAdminLink && !pathname.startsWith("/dashboard") && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <IconDashboard />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                {onAccountClick && (
                  <DropdownMenuItem onClick={onAccountClick}>
                    <IconUserCircle />
                    Account
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={handleSignOut}>
            <IconLogout />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
