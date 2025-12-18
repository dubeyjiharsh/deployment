import * as React from "react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoCanvases } from "@/lib/demo-canvas";
import { linkTo } from "@/lib/router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";


export function DashboardPage(): React.ReactElement {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>("newest");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<'grid' | 'list'>("grid");

  // Sort and filter canvases
  const canvases = useMemo(() => {
    let filtered = demoCanvases.filter((c) => {
      const title = c.title?.value?.toLowerCase?.() || "";
      return title.includes(search.toLowerCase());
    });
    filtered = filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
    return filtered;
  }, [search, sortOrder]);

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-primary">Business canvases</h1>
            <p className="text-sm text-muted-foreground">Manage and view your AI-generated business canvases</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search canvases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-48"
              aria-label="Search canvases"
            />
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="border rounded px-2 py-1 text-sm bg-background"
              aria-label="Sort by time"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <div className="flex items-center space-x-3 ml-4">
              <Button
                variant={view === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setView('grid')}
                aria-label="Grid view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                </svg>
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setView('list')}
                aria-label="List view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="4" y="6" width="16" height="2" rx="1"/>
                  <rect x="4" y="11" width="16" height="2" rx="1"/>
                  <rect x="4" y="16" width="16" height="2" rx="1"/>
                </svg>
              </Button>
            </div>
          </div>
        </div>
        <Separator />
        <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4' : 'flex flex-col gap-4'}>
          {canvases.length === 0 && (
            <div className="text-center text-muted-foreground py-8">No canvases found.</div>
          )}
          {canvases.map((canvas) => (
            <a key={canvas.id} href={linkTo(`/canvas/${canvas.id}`)} className="block">
              <Card className="border cursor-pointer transition-colors hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-base">{canvas?.title?.value || "Demo Canvas"}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {canvas?.problemStatement?.value || "Click to open the demo canvas."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {canvas.createdAt ? new Date(canvas.createdAt).toLocaleString() : ""}
                  </div>
                  <div className="text-sm text-primary">Open canvas</div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
