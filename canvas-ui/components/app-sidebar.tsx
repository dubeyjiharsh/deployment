"use client"

import * as React from "react"
import {
  IconDashboard,
  IconCirclePlusFilled,
  IconUsers,
} from "@tabler/icons-react"

import { NavUser } from "@/components/nav-user"
import { linkTo, useHashPath } from "@/lib/router"
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
  const pathname = useHashPath()

  const user = {
    name: "Demo User",
    email: "demo@example.com",
    avatar: undefined,
  }

  const navMainItems = [
    {
      title: "Create Canvas",
      url: "/canvas/create",
      icon: IconCirclePlusFilled,
    },
    // Removed User Management
    {
      title: "Dashboard",
      url: "/",
      icon: IconDashboard,
      
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0 hover:bg-white/10 active:bg-white/10 hover:text-sidebar-foreground active:text-sidebar-foreground">
              <a href={linkTo("/")}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                  <img src="/images/logo.svg" alt="AI Force Canvas" width={32} height={32} className="object-contain p-1.5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium text-sidebar-foreground">AI Force</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Canvas</span>
                </div>
              </a>
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
                      className="px-2.5 md:px-2"
                    >
                      <a href={linkTo(item.url)}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </a>
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
