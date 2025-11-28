"use client"

import {
  IconDotsVertical,
  IconLogout,
  IconUserCircle,
  IconDashboard,
} from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function ProjectUserMenu({
  user,
  showAdminLink = false,
  onAccountClick,
}: {
  user: {
    name: string
    email: string
    avatar?: string
  }
  showAdminLink?: boolean
  onAccountClick?: () => void
}) {
  const router = useRouter()

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
    <div className="fixed top-6 right-6 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-3 h-auto p-3 bg-white/60 backdrop-blur-md rounded-[73px] hover:bg-white/80 transition-opacity"
          >
            <Avatar className="h-14 w-14 rounded-full">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold text-xl">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="font-semibold text-2xl leading-tight tracking-[-0.72px] text-white">
                {user.name}
              </p>
              <p className="font-normal text-xl leading-tight tracking-[-0.6px] text-white/80">
                {user.email?.split("@")[0] || "User"}
              </p>
            </div>
            <IconDotsVertical className="ml-2 size-5 text-white" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-white/95 backdrop-blur-md border border-gray-200 rounded-lg shadow-lg z-[60]"
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
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {showAdminLink && (
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
          <DropdownMenuItem onClick={handleSignOut}>
            <IconLogout />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

