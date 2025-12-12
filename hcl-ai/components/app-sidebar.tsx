"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  IconDashboard,
  IconCirclePlusFilled,
  IconPlug,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const user = {
    name: session?.user?.name || "User",
    email: session?.user?.email || "user@example.com",
    avatar: undefined, // No avatar support with credentials auth
    role: session?.user?.role as string | undefined,
  }

  // Check if user is admin
  const isAdmin = session?.user?.role === "admin"

  // Filter navigation items based on user role
  const navMainItems = [
    {
      title: "Create Canvas",
      url: "/canvas/create",
      icon: IconCirclePlusFilled,
    },
    {
      title: "Dashboard",
      url: "/",
      icon: IconDashboard,
    },
    {
      title: "MCP Configuration",
      url: "/connections",
      icon: IconPlug,
    },
    ...(isAdmin ? [{
      title: "User Management",
      url: "/admin",
      icon: IconUsers,
    }] : []),
    ...(isAdmin ? [{
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    }] : []),
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0 hover:bg-white/10 active:bg-white/10 hover:text-sidebar-foreground active:text-sidebar-foreground">
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                  <Image src="/images/logo.svg" alt="AI Force Canvas" width={32} height={32} className="object-contain p-1.5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium text-sidebar-foreground">AI Force</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Canvas</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-1.5 md:px-0">
            <SidebarMenu>
              {navMainItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      asChild
                      isActive={isActive}
                      className={
                        item.title === "Create Canvas" && isActive
                          ? "bg-white text-sidebar hover:bg-white/90 hover:text-sidebar active:bg-white/90 active:text-sidebar px-2.5 md:px-2 [&>svg]:text-sidebar"
                          : "px-2.5 md:px-2"
                      }
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
