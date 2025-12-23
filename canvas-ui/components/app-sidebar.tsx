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
      title: "Dashboard",
      url: "/",
      icon: IconDashboard,
    },
  ];
  // Handler for creating a new canvas (calls API, stores id, navigates)
  const handleCreateNewCanvas = async () => {
    try {
      const res = await fetch("http://0.0.0.0:8020/api/canvas/create", { method: "POST" });
      const data = await res.json();
      if (data?.canvas_id) {
        sessionStorage.setItem("canvasId", data.canvas_id);
      }
    } catch (err) {
      console.error("Failed to call canvas create API", err);
    }
    window.location.hash = linkTo("/canvas/create");
  };

  // Get canvas title from sessionStorage
  const [canvasTitle, setCanvasTitle] = React.useState<string | null>(null);
  React.useEffect(() => {
    setCanvasTitle(sessionStorage.getItem("canvasTitle"));
    window.addEventListener("storage", () => {
      setCanvasTitle(sessionStorage.getItem("canvasTitle"));
    });
    return () => {
      window.removeEventListener("storage", () => {
        setCanvasTitle(sessionStorage.getItem("canvasTitle"));
      });
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
              {/* Create New Canvas button */}
              <SidebarMenuItem key="create-canvas">
                <SidebarMenuButton
                  tooltip="Create Canvas"
                  isActive={pathname === "/canvas/create"}
                  className="px-2.5 md:px-2"
                  onClick={handleCreateNewCanvas}
                >
                  <IconCirclePlusFilled />
                  <span className="group-data-[collapsible=icon]:hidden">Create Canvas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* Other nav items */}
              {navMainItems.map((item) => {
                const isActive = pathname === item.url;
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
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          {/* Grey separator below main nav */}
          <div className="px-2 pt-2 pb-1">
            <div className="bg-gray-300 h-px w-full" />
          </div>
          {/* Chat history will be rendered here */}
          <SidebarGroupContent className="px-1.5 md:px-0 group-data-[collapsible=icon]:hidden">
            {/* Show canvas title if available */}
            {canvasTitle ? (
              <div className="flex flex-col gap-2 mt-2">
                <div className="block px-3 py-2 rounded bg-blue-100 text-blue-900">
                  <div className="font-semibold text-sm truncate">{canvasTitle}</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-2">
                {/* Hardcoded chat history samples, only visible when sidebar is open */}
                <a href="#/canvas/result?chat=1" className="block px-3 py-2 rounded bg-blue-100 text-blue-900 hover:bg-blue-200 transition-colors">
                  <div className="font-semibold text-sm truncate">Market Entry Strategy</div>
                  <div className="text-xs text-blue-700 truncate">How can we enter the US market?</div>
                </a>
                <a href="#/canvas/result?chat=2" className="block px-3 py-2 rounded bg-blue-100 text-blue-900 hover:bg-blue-200 transition-colors">
                  <div className="font-semibold text-sm truncate">Product Launch Plan</div>
                  <div className="text-xs text-blue-700 truncate">Steps to launch our new app</div>
                </a>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
