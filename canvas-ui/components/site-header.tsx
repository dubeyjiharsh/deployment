"use client"

import { linkTo, useHashPath } from "@/lib/router"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useEffect } from "react"
import { logout } from "@/src/lib/auth"


export function SiteHeader() {
  const pathname = useHashPath();
  const isDashboardPage = pathname === "/";

  const handleLogout = () => {
    // Use the proper logout function that handles Keycloak logout
    logout();
  };

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-[var(--header-height)]">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        {isDashboardPage ? (
          <div id="page-header" className="flex items-center gap-4">
            <h1 className="text-base font-medium text-primary">Business Canvas AI</h1>
          </div>
        ) : (
          <div id="page-header" className="flex items-center gap-4" />
        )}
        <div className="ml-auto flex items-center gap-2">
          {isDashboardPage && (
            <Button
              onClick={async () => {
                try {
                  const userId = sessionStorage.getItem("userId");
                  if (!userId) {
                    alert("User not logged in");
                    return;
                  }
                } catch (err) {
                  console.error("Failed to call canvas create API", err);
                }
                window.location.hash = linkTo("/canvas/create");
              }}
            >
              <Plus className="h-4 w-4" />
              Create New
            </Button>
          )}
          <Button onClick={handleLogout} className="ml-2">
            Logout
          </Button>
          <div id="page-actions" className="flex items-center gap-2" />
        </div>
      </div>
    </header>
  );
}