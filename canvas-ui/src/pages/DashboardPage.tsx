import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { linkTo, navigate } from "@/lib/router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Trash2 } from "lucide-react";
import axios from "axios";
import { API_ENDPOINTS } from '@/config/api';
 
export function DashboardPage(): React.ReactElement {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>("newest");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<'grid' | 'list'>("grid");
  const [canvases, setCanvases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [canvasToDelete, setCanvasToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
 
  useEffect(() => {
    const fetchCanvases = async () => {
      setIsLoading(true);
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
 
  const handleDeleteClick = (canvas: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setCanvasToDelete(canvas);
    setDeleteDialogOpen(true);
  };
 
  const handleDeleteConfirm = async () => {
    if (!canvasToDelete) return;

    setIsDeleting(true);
    try {
      await axios.post(API_ENDPOINTS.canvasDelete(canvasToDelete.canvas_id), {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}`,
        },
      });

      setCanvases(canvases.filter(c => c.canvas_id !== canvasToDelete.canvas_id));
      window.dispatchEvent(new Event("canvasListUpdated"));

      setDeleteDialogOpen(false);
      setCanvasToDelete(null);
    } catch (err) {
      console.error("Failed to delete canvas:", err);
      alert("Failed to delete canvas. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
 
  const handleEditCanvas = (canvasId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Set session storage to signal CreateCanvasPage to restore history
    sessionStorage.setItem("canvasId", canvasId);
    sessionStorage.setItem("isEditingCanvas", "true");
    sessionStorage.removeItem("chatState"); // Ensure fresh history fetch
 
    navigate(`/canvas/create`);
  };

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
                <Card className="border cursor-pointer transition-colors hover:bg-muted/30 relative w-full h-48 min-h-48 max-h-48 flex flex-col justify-between">
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-black focus:text-black cursor-pointer"
                          onClick={(e) => handleDeleteClick(canvas, e)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-base text-blue-500 pr-8">
                      {canvas.title || "Untitled Canvas"}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {canvas.problem_statement || "Canvas ID: " + canvas.canvas_id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      {canvas.created_at ? (() => {
                        const minutes = Math.floor((Date.now() - new Date(canvas.created_at).getTime()) / 60000);
                        if (minutes < 1) return "Updated just now";
                        if (minutes === 1) return "Updated about 1 min ago";
                        return `Updated about ${minutes} min ago`;
                      })() : ""}
                    </div>
                    <div className="flex gap-4 items-center">
                      <div
                        className="text-sm text-primary cursor-pointer underline"
                        style={{ textDecoration: 'underline' }}
                        onClick={(e) => handleEditCanvas(canvas.canvas_id, e)}
                      >
                        Edit canvas
                      </div>
                      <div
                        className="text-sm text-primary cursor-pointer underline"
                        onClick={() => {
                          sessionStorage.setItem("canvasJson", JSON.stringify(canvas));
                          sessionStorage.setItem("canvasId", canvas.canvas_id);
                          navigate(`/canvas-preview/${canvas.canvas_id}`);
                        }}
                      >
                        Open canvas
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
 
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{canvasToDelete?.title || 'this canvas'}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}