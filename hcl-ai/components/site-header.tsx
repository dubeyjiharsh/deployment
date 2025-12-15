"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function SiteHeader() {
  const pathname = usePathname()
  const isCanvasPage = pathname?.startsWith("/canvas/") && pathname !== "/canvas/create"
  const isCreatePage = pathname === "/canvas/create"

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
          {!isCanvasPage && !isCreatePage && (
            <Button asChild>
              <Link href="/canvas/create">
                <Plus className="h-4 w-4" />
                Create New
              </Link>
            </Button>
          )}
          <div id="page-actions" className="flex items-center gap-2" />
        </div>
      </div>
    </header>
  )
}
