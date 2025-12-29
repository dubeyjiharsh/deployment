import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { linkTo } from "@/lib/router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";



export function DashboardPage(): React.ReactElement {
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [selectedCanvas, setSelectedCanvas] = useState<any | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>("newest");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<'grid' | 'list'>("grid");
  const [canvases, setCanvases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCanvases = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get("http://0.0.0.0:8020/api/canvas/list", {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}`,
          },
        });
        setCanvases(response.data.canvases || []);
        window.dispatchEvent(new Event("canvasListUpdated"));
        console.log('Fetched canvases:', response.data.canvases);
      } catch (err) {
        setError("Failed to load canvases");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCanvases();
  }, []);

  // Sort and filter canvases
  const filteredCanvases = useMemo(() => {
    let filtered = canvases.filter((c) => {
      const title = c.title?.value?.toLowerCase?.() || c.title?.toLowerCase?.() || "";
      return title.includes(search.toLowerCase());
    });
    filtered = filtered.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
    return filtered;
  }, [canvases, search, sortOrder]);

  return (
    <div className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-blue-500">Dashboard</h1>
            <p className="text-sm text-blue-500">Manage and view your AI-generated business canvases</p>
          </div>
          <div className="flex items-center justify-end gap-1">
            <div className="relative w-48 h-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <Input
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 w-48 h-12"
                aria-label="Search"
              />
            </div>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="border rounded px-2 py-1 text-sm bg-background w-48 h-12"
              aria-label="Sort by time"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <div className="flex items-center space-x-1">
              <Button
                variant={view === 'grid' ? 'default' : 'outline'}
                size="icon"
                className="w-12 h-12 flex justify-center items-center"
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
                className="w-12 h-12 flex justify-center items-center"
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
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading canvases...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : (
          <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4' : 'flex flex-col gap-4'}>
            {filteredCanvases.length === 0 && (
              <div className="text-center text-muted-foreground py-8">No canvases found.</div>
            )}
            {filteredCanvases.map((canvas) => (
              <div key={canvas.canvas_id} className="block">
                <Card className="border cursor-pointer transition-colors hover:bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base text-blue-500">{canvas.title || "Untitled Canvas"} <span className="text-xs text-gray-400">{canvas.canvas_id}</span></CardTitle>
                    <CardDescription className="line-clamp-2">
                      {canvas.problem_statement || "Canvas ID: " + canvas.canvas_id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      {canvas.created_at ? formatDistanceToNow(new Date(canvas.created_at), { addSuffix: true }) : ""}
                    </div>
                    <div
                      className="text-sm text-primary cursor-pointer underline"
                      onClick={() => {
                        setSelectedCanvas(canvas);
                        setJsonModalOpen(true);
                      }}
                    >
                      Open canvas
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
                {/* Modal for displaying JSON */}
                <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Canvas JSON</DialogTitle>
                      <DialogDescription>
                        Below is the JSON output for the selected canvas.
                      </DialogDescription>
                    </DialogHeader>
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs bg-gray-100 p-4 rounded">
                      {selectedCanvas ? JSON.stringify(selectedCanvas, null, 2) : ""}
                    </pre>
                  </DialogContent>
                </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
