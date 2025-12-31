"use client"

import { linkTo, useHashPath } from "@/lib/router"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { API_ENDPOINTS } from '@/config/api';

export function SiteHeader() {
  const pathname = useHashPath()
  const isCanvasPage = pathname.startsWith("/canvas/")

  const handleCreateNew = () => {
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
      alert('User not logged in');
      return;
    }

    // Navigate to Create Canvas page without making an API call
    window.location.hash = linkTo('/canvas/create');
  };

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-[var(--header-height)]">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        {!isCanvasPage && (
          <div id="page-header" className="flex items-center gap-4">
            <h1 className="text-base font-medium text-primary">Business Canvas AI</h1>
          </div>
        )}
        {isCanvasPage && <div id="page-header" className="flex items-center gap-4" />}
        <div className="ml-auto flex items-center gap-2">
          {!isCanvasPage && (
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4" />
              Create New
            </Button>
          )}
          <div id="page-actions" className="flex items-center gap-2" />
        </div>
      </div>
    </header>
  )
}