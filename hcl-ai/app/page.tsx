"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";
import { Search, Grid3x3, List, MoreVertical, Trash2, CheckCircle2 } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { formatStatus } from "@/lib/utils/canvas-helpers";
import { cn } from "@/lib/utils";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { toast } from "sonner";

interface CanvasWithOwner extends BusinessCanvas {
  ownerName?: string;
  ownerEmail?: string;
  isOwned?: boolean;
  sharedRole?: "owner" | "editor" | "viewer";
  sharedUsers?: Array<{ id: string; name: string; email: string }>;
}

/**
 * Dashboard page showing all canvases
 */
type StatusFilter = "all" | "draft" | "in_review" | "approved" | "rejected";
type OwnershipFilter = "my" | "shared";
type ViewMode = "grid" | "list";
type SortOption = "newest" | "oldest" | "title";

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const [canvases, setCanvases] = React.useState<CanvasWithOwner[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [ownershipFilter, setOwnershipFilter] = React.useState<OwnershipFilter>("my");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [canvasToDelete, setCanvasToDelete] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Fetch canvases from the API
    fetch("/api/canvas/list")
      .then((res) => res.json())
      .then(async (data) => {
        // Handle both array response and object with canvases property
        const canvases = Array.isArray(data) ? data : data.canvases || [];
        
        // Fetch shared users for each canvas
        const canvasesWithSharedUsers = await Promise.all(
          canvases.map(async (canvas: CanvasWithOwner) => {
            try {
              const shareResponse = await fetch(`/api/canvas/share?canvasId=${canvas.id}`);
              if (shareResponse.ok) {
                const { permissions } = await shareResponse.json();
                // Get unique users (excluding the owner)
                const sharedUsers = permissions
                  .filter((p: { user: { name: string } | null }) => p.user && p.user.name !== canvas.ownerName)
                  .map((p: { user: { id: string; name: string; email: string } }) => p.user)
                  .slice(0, 2); // Max 2 shared users (owner + 2 shared = 3 total)
                return { ...canvas, sharedUsers };
              }
            } catch (error) {
              console.error(`Failed to fetch shared users for canvas ${canvas.id}:`, error);
            }
            return canvas;
          })
        );
        
        setCanvases(canvasesWithSharedUsers);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch canvases:", error);
        setIsLoading(false);
      });
  }, []);

  const handleCanvasClick = (canvasId: string) => {
    router.push(`/canvas/${canvasId}`);
  };

  const handleDeleteCanvas = async (canvasId: string) => {
    try {
      const response = await fetch(`/api/canvas/${canvasId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete canvas");
      }

      // Remove from local state
      setCanvases((prev) => prev.filter((c) => c.id !== canvasId));
      toast.success("Canvas deleted successfully");
    } catch (error) {
      console.error("Error deleting canvas:", error);
      toast.error("Failed to delete canvas");
    } finally {
      setCanvasToDelete(null);
    }
  };

  const handleStatusChange = async (canvasId: string, newStatus: BusinessCanvas["status"]) => {
    try {
      const canvas = canvases.find((c) => c.id === canvasId);
      if (!canvas) return;

      const updatedCanvas = {
        ...canvas,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(`/api/canvas/${canvasId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedCanvas),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Update local state
      setCanvases((prev) =>
        prev.map((c) => (c.id === canvasId ? { ...c, status: newStatus, updatedAt: updatedCanvas.updatedAt } : c))
      );
      toast.success(`Status updated to ${formatStatus(newStatus)}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  // Filter and sort canvases
  const filteredAndSortedCanvases = React.useMemo(() => {
    let filtered = canvases;

    // Apply ownership filter
    if (ownershipFilter === "my") {
      filtered = filtered.filter((canvas) => canvas.isOwned === true);
    } else {
      filtered = filtered.filter((canvas) => canvas.isOwned === false);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((canvas) => canvas.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (canvas) =>
          canvas.title?.value?.toLowerCase().includes(query) ||
          canvas.problemStatement?.value?.toLowerCase().includes(query) ||
          canvas.ownerName?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "oldest":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "title":
          return (a.title?.value || "").localeCompare(b.title?.value || "");
        default:
          return 0;
      }
    });

    return sorted;
  }, [canvases, ownershipFilter, statusFilter, searchQuery, sortBy]);

  // Count canvases in each ownership category
  const myCanvasesCount = canvases.filter((c) => c.isOwned === true).length;
  const sharedCanvasesCount = canvases.filter((c) => c.isOwned === false).length;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex h-full min-h-[400px] items-center justify-center px-4 lg:px-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading canvases...</p>
          </div>
        </div>
      </div>
    );
  }

  if (canvases.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex h-full min-h-[400px] items-center justify-center px-4 lg:px-6">
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconSparkles />
              </EmptyMedia>
              <EmptyTitle>No canvases yet</EmptyTitle>
              <EmptyDescription>
                Get started by creating your first business canvas with AI
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <p className="text-sm text-muted-foreground">
                Click &quot;Create Canvas&quot; in the sidebar to get started
              </p>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    );
  }

  const statusFilters: { value: StatusFilter; label: string; color: string }[] = [
    { value: "all", label: "All", color: "var(--primary)" },
    { value: "draft", label: "Drafts", color: "var(--status-draft)" },
    { value: "in_review", label: "Pending Review", color: "var(--status-pending-review)" },
    { value: "approved", label: "Approved", color: "var(--status-approved)" },
    { value: "rejected", label: "Backlog", color: "var(--status-backlog)" },
  ];

  // Generate a consistent color from a name
  const getNameColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Get initials from a name
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Get users to display (owner + shared users, max 3)
  const getUsersToDisplay = (canvas: CanvasWithOwner): Array<{ name: string; color: string; initials: string }> => {
    const users: Array<{ name: string; color: string; initials: string }> = [];
    
    if (canvas.ownerName) {
      users.push({
        name: canvas.ownerName,
        color: getNameColor(canvas.ownerName),
        initials: getInitials(canvas.ownerName),
      });
    }
    
    if (canvas.sharedUsers) {
      canvas.sharedUsers.forEach((user) => {
        if (users.length < 3) {
          users.push({
            name: user.name,
            color: getNameColor(user.name),
            initials: getInitials(user.name),
          });
        }
      });
    }
    
    return users.slice(0, 3);
  };

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        {/* Filters and Controls */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          {/* Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                style={statusFilter === filter.value ? { borderColor: 'white' } : undefined}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors border",
                  statusFilter === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-gray-700 hover:bg-gray-50 border-transparent"
                )}
              >
                <div
                  className="w-1 h-4 rounded-full"
                  style={{ backgroundColor: statusFilter === filter.value ? 'white' : filter.color }}
                />
                {filter.label}
              </button>
            ))}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Ownership Filter Tabs */}
            <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setOwnershipFilter("my")}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5",
                  ownershipFilter === "my"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                My Canvases
                {myCanvasesCount > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    ownershipFilter === "my"
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {myCanvasesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setOwnershipFilter("shared")}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 border-l border-gray-200",
                  ownershipFilter === "shared"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                Shared with me
                {sharedCanvasesCount > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    ownershipFilter === "shared"
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {sharedCanvasesCount}
                  </span>
                )}
              </button>
            </div>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-md p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 rounded transition-colors",
                  viewMode === "list"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCanvases.map((canvas) => (
            <Card
              key={canvas.id}
              className="cursor-pointer transition-all hover:scale-[1.02] border-0 relative group"
              style={{ backgroundColor: "var(--canvas-card-bg)" }}
              onClick={() => handleCanvasClick(canvas.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  {canvas.status && (
                    <span
                      className="capitalize px-2 py-1 rounded-full text-xs text-white"
                      style={{
                        backgroundColor:
                          canvas.status === "draft"
                            ? "var(--status-draft)"
                            : canvas.status === "in_review"
                            ? "var(--status-pending-review)"
                            : canvas.status === "approved"
                            ? "var(--status-approved)"
                            : "var(--status-backlog)",
                      }}
                    >
                      {formatStatus(canvas.status)}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <CheckCircle2 className="h-4 w-4" />
                          Change Status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "draft")}>
                            Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "in_review")}>
                            In Review
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "approved")}>
                            Approved
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "rejected")}>
                            Rejected
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setCanvasToDelete(canvas.id)}
                        variant="destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="line-clamp-1 text-xl font-semibold text-primary">{canvas.title?.value || "Untitled Canvas"}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {canvas.problemStatement?.value || "No description"}
                </CardDescription>
                {!canvas.isOwned && canvas.ownerName && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                    <span>Shared by {canvas.ownerName}</span>
                    {canvas.sharedRole && (
                      <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {canvas.sharedRole}
                      </span>
                    )}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Updated {formatDistanceToNow(new Date(canvas.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <div className="flex items-center gap-1">
                    {getUsersToDisplay(canvas).map((user, index) => (
                      <Tooltip key={`${canvas.id}-${user.name}-${index}`}>
                        <TooltipTrigger asChild>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white border-2 border-white shadow-sm cursor-pointer"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.initials}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{user.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedCanvases.map((canvas) => (
              <Card
                key={canvas.id}
                className="cursor-pointer transition-all border-0 relative group"
                style={{ backgroundColor: "var(--canvas-card-bg)" }}
                onClick={() => handleCanvasClick(canvas.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {canvas.status && (
                        <span
                          className="inline-block capitalize px-2 py-1 rounded-full text-xs text-white mb-2"
                          style={{
                            backgroundColor:
                              canvas.status === "draft"
                                ? "var(--status-draft)"
                                : canvas.status === "in_review"
                                ? "var(--status-pending-review)"
                                : canvas.status === "approved"
                                ? "var(--status-approved)"
                                : "var(--status-backlog)",
                          }}
                        >
                          {formatStatus(canvas.status)}
                        </span>
                      )}
                        <CardTitle className="line-clamp-1 text-xl font-semibold text-primary">
                          {canvas.title?.value || "Untitled Canvas"}
                        </CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {canvas.problemStatement?.value || "No description"}
                      </CardDescription>
                      {!canvas.isOwned && canvas.ownerName && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                          <span>Shared by {canvas.ownerName}</span>
                          {canvas.sharedRole && (
                            <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {canvas.sharedRole}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <CheckCircle2 className="h-4 w-4" />
                            Change Status
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "draft")}>
                              Draft
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "in_review")}>
                              In Review
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "approved")}>
                              Approved
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(canvas.id, "rejected")}>
                              Rejected
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setCanvasToDelete(canvas.id)}
                          variant="destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Updated {formatDistanceToNow(new Date(canvas.updatedAt), { addSuffix: true })}
                    </span>
                    <div className="flex items-center gap-1">
                      {getUsersToDisplay(canvas).map((user, index) => (
                        <Tooltip key={`${canvas.id}-${user.name}-${index}`}>
                          <TooltipTrigger asChild>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white border-2 border-white shadow-sm cursor-pointer"
                              style={{ backgroundColor: user.color }}
                            >
                              {user.initials}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{user.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredAndSortedCanvases.length === 0 && canvases.length > 0 && (
          <div className="text-center py-12">
            {searchQuery ? (
              <p className="text-muted-foreground">No canvases found matching &quot;{searchQuery}&quot;</p>
            ) : ownershipFilter === "shared" && sharedCanvasesCount === 0 ? (
              <p className="text-muted-foreground">No canvases have been shared with you yet</p>
            ) : ownershipFilter === "my" && myCanvasesCount === 0 ? (
              <p className="text-muted-foreground">You haven&apos;t created any canvases yet. Click &quot;Create New&quot; to get started!</p>
            ) : (
              <p className="text-muted-foreground">No canvases match your filters</p>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={canvasToDelete !== null} onOpenChange={(open) => !open && setCanvasToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Canvas</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this canvas? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => canvasToDelete && handleDeleteCanvas(canvasToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
