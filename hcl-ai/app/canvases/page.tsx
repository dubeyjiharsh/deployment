"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCanvasCompletion, formatStatus } from "@/lib/utils/canvas-helpers";
import { formatDistance } from "date-fns";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";

interface CanvasWithOwner extends BusinessCanvas {
  ownerName?: string;
  ownerEmail?: string;
  isOwned?: boolean;
  sharedRole?: "owner" | "editor" | "viewer";
  sharedUsers?: Array<{ id: string; name: string; email: string }>;
}

/**
 * Canvases list page
 */
export default function CanvasesPage(): React.ReactElement {
  const router = useRouter();
  const [canvases, setCanvases] = React.useState<CanvasWithOwner[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"my" | "shared" | "all">("my");
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    const fetchCanvases = async (): Promise<void> => {
      try {
        // Determine if current user is admin to control tabs
        const sessionRes = await fetch("/api/auth/session");
        const sessionJson = await sessionRes.json().catch(() => ({}));
        setIsAdmin(sessionJson?.user?.role === "admin");

        const response = await fetch("/api/canvas/list");

        if (!response.ok) {
          throw new Error("Failed to fetch canvases");
        }

        const data: CanvasWithOwner[] = await response.json();
        
        // Fetch shared users for each canvas
        const canvasesWithSharedUsers = await Promise.all(
          data.map(async (canvas) => {
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
      } catch (error) {
        console.error("Error fetching canvases:", error);
        alert("Failed to load canvases");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCanvases();
  }, []);

  const getStatusBadgeVariant = (
    status: BusinessCanvas["status"]
  ): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "approved":
        return "default"; // Will style this as success with custom class
      case "in_review":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: BusinessCanvas["status"]): string => {
    switch (status) {
      case "draft":
        return "text-white";
      case "in_review":
        return "text-white";
      case "approved":
        return "text-white";
      case "rejected":
        return "text-white";
      default:
        return "";
    }
  };

  const getStatusBgColor = (status: BusinessCanvas["status"]): string => {
    switch (status) {
      case "draft":
        return "var(--status-draft)";
      case "in_review":
        return "var(--status-pending-review)";
      case "approved":
        return "var(--status-approved)";
      case "rejected":
        return "var(--status-backlog)"; // backlog
      default:
        return "";
    }
  };

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

  // Filter canvases based on search query and active tab
  const filteredCanvases = React.useMemo(() => {
    let filtered = canvases;

    // Filter by tab
    if (activeTab === "my") {
      filtered = filtered.filter((canvas) => canvas.isOwned === true);
    } else if (activeTab === "shared") {
      filtered = filtered.filter((canvas) => canvas.isOwned === false);
    } // "all" shows everything

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (canvas) =>
          canvas.title.value?.toLowerCase().includes(query) ||
          canvas.problemStatement.value?.toLowerCase().includes(query) ||
          canvas.ownerName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [canvases, activeTab, searchQuery]);

  // Count canvases in each category
  const myCanvasesCount = canvases.filter((c) => c.isOwned === true).length;
  const sharedCanvasesCount = canvases.filter((c) => c.isOwned === false).length;
  const allCanvasesCount = canvases.length;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Canvases</h1>
            </div>

            <Button onClick={() => router.push("/")}>
              <Plus className="mr-2 h-4 w-4" />
              New Canvas
            </Button>
          </div>

          {/* Search and Tabs */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search canvases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "shared" | "all")}>
              <TabsList>
                <TabsTrigger value="my" className="gap-2">
                  My Canvases
                  {myCanvasesCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {myCanvasesCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="shared" className="gap-2">
                  Shared with me
                  {sharedCanvasesCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {sharedCanvasesCount}
                    </Badge>
                  )}
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="all" className="gap-2">
                    All Canvases
                    {allCanvasesCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {allCanvasesCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCanvases.length === 0 ? (
          <div className="text-center py-12">
            {searchQuery ? (
              <p className="text-lg text-muted-foreground mb-4">
                No canvases found matching &quot;{searchQuery}&quot;
              </p>
            ) : activeTab === "my" ? (
              <>
                <p className="text-lg text-muted-foreground mb-4">
                  No canvases yet. Create your first one!
                </p>
                <Button onClick={() => router.push("/")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Canvas
                </Button>
              </>
            ) : (
              <p className="text-lg text-muted-foreground mb-4">
                No canvases have been shared with you yet.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCanvases.map((canvas) => {
              const completion = getCanvasCompletion(canvas);
              const updatedAt = new Date(canvas.updatedAt);

              return (
                <Card
                  key={canvas.id}
                  className="cursor-pointer transition-shadow border-0"
                  style={{ backgroundColor: "var(--canvas-card-bg)" }}
                  onClick={() => router.push(`/canvas/${canvas.id}`)}
                >
                  <CardHeader>
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={getStatusBadgeVariant(canvas.status)}
                        className={getStatusColor(canvas.status)}
                        style={{
                          backgroundColor: getStatusBgColor(canvas.status),
                        }}
                      >
                        {formatStatus(canvas.status)}
                      </Badge>
                      {!canvas.isOwned && canvas.sharedRole && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {canvas.sharedRole}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg text-primary">
                      {canvas.title.value || "Untitled Canvas"}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {canvas.problemStatement.value || "No problem statement"}
                    </CardDescription>
                    {!canvas.isOwned && canvas.ownerName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Shared by {canvas.ownerName}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium">{completion}%</span>
                      </div>
                      <Progress value={completion} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Updated {formatDistance(updatedAt, new Date(), { addSuffix: true })}
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
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
