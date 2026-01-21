"use client"

import * as React from "react"
import {
  IconDashboard,
  IconCirclePlusFilled,
  IconSettings,
} from "@tabler/icons-react"
import { API_ENDPOINTS } from '@/config/api';

import { NavUser } from "@/components/nav-user"
import { linkTo, useHashPath, navigate } from "@/lib/router"
import axios from "axios"
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
import { isProjectAdmin } from "@/src/lib/auth"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = useHashPath()
  const [isAdmin, setIsAdmin] = React.useState(false)

  // Check if user is project admin
  React.useEffect(() => {
    setIsAdmin(isProjectAdmin())
  }, [])

  // Updated the user object to fetch dynamic user details from localStorage
  const user = React.useMemo(() => {
    const userDetails = JSON.parse(localStorage.getItem("user-info") || "{}") || {};
    return {
      name: userDetails.first_name + " " + userDetails.last_name || "Unknown User",
      email: userDetails.email_id || "unknown@example.com",
      avatar: userDetails.avatar || undefined,
    };
  }, []);

  // Build navigation items based on user role
  const navMainItems = React.useMemo(() => {
    const items = [
      {
        title: "Dashboard",
        url: "/",
        icon: IconDashboard,
      },
      {
        title: "Create Canvas",
        url: "/canvas/create",
        icon: IconCirclePlusFilled,
      },
    ]

    // Add Configure option only for Project Admins
    if (isAdmin) {
      items.push({
        title: "Configure",
        url: "/admin-configure",
        icon: IconSettings,
      })
    }

    return items
  }, [isAdmin])

  // Live chat/canvas history
  const [canvases, setCanvases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch canvases on mount and when storage changes (for live update)
  React.useEffect(() => {
    const fetchCanvases = async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = sessionStorage.getItem("userId");
        if (!userId) {
          setError("User not logged in");
          return;
        }

        const response = await axios.get(API_ENDPOINTS.canvasList(userId), {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}`,
          },
        });
        setCanvases(response.data.canvases || []);
      } catch (err) {
        setError("Failed to load chat history");
      } finally {
        setLoading(false);
      }
    };
    fetchCanvases();
    // Listen for storage changes and custom canvasListUpdated event to update live
    const onStorage = () => fetchCanvases();
    const onCanvasListUpdated = () => fetchCanvases();
    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasListUpdated", onCanvasListUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("canvasListUpdated", onCanvasListUpdated);
    };
  }, []);

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
          {/* Grey separator below main nav */}
          <div className="px-2 pt-2 pb-1">
            <div className="bg-gray-300 h-px w-full" />
          </div>
          {/* Live chat/canvas history removed as requested */}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}