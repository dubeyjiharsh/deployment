"use client"

import { linkTo, useHashPath } from "@/lib/router"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function SiteHeader() {
  const pathname = useHashPath()
  const isCanvasPage = pathname.startsWith("/canvas/")

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
            <Button
              onClick={async () => {
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
              }}
            >
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
