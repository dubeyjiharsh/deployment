"use client"

import * as React from "react"
import {
  IconDashboard,
  IconCirclePlusFilled,
  IconUsers,
} from "@tabler/icons-react"

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
        const response = await axios.get("http://0.0.0.0:8020/api/canvas/list", {
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
          {/* Live chat/canvas history */}
          <SidebarGroupContent className="px-1.5 md:px-0 group-data-[collapsible=icon]:hidden">
            <div className="flex flex-col gap-2 mt-2">
              {loading ? (
                <div className="text-xs text-muted-foreground px-3">Loading...</div>
              ) : error ? (
                <div className="text-xs text-red-500 px-3">{error}</div>
              ) : canvases.length === 0 ? (
                <div className="text-xs text-muted-foreground px-3">No chats yet.</div>
              ) : (
                canvases.map((canvas) => (
                  <div
                    key={canvas.canvas_id}
                    className="block px-3 py-2 rounded bg-blue-100 text-blue-900 hover:bg-blue-200 transition-colors cursor-pointer"
                    onClick={() => navigate(`/canvas/${canvas.canvas_id}`)}
                    title={canvas.title + (canvas.problem_statement ? `: ${canvas.problem_statement}` : "")}
                  >
                    <div className="font-semibold text-sm truncate" style={{ maxWidth: '180px' }}>{canvas.title || "Untitled Canvas"}</div>
                    <div className="text-xs text-blue-700 truncate" style={{ maxWidth: '180px' }}>{canvas.problem_statement || "No problem statement."}</div>
                  </div>
                ))
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
