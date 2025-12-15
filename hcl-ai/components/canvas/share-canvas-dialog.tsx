"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Loader2, X, Search, Users as UsersIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface User {
  id: string;
  email: string;
  name: string;
  teamId?: string | null;
}

interface Team {
  id: string;
  name: string;
  ownerId: string;
}

interface Permission {
  id: string;
  canvasId: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  createdAt: string;
  user: User | null;
}

interface ShareCanvasDialogProps {
  canvasId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Figma-style dialog for sharing canvases with users and teams
 */
export function ShareCanvasDialog({ canvasId, isOpen: controlledIsOpen, onClose }: ShareCanvasDialogProps): React.ReactElement {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onClose !== undefined ? (open: boolean) => { if (!open) onClose(); } : setInternalIsOpen;
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [availableUsers, setAvailableUsers] = React.useState<User[]>([]);
  const [availableTeams, setAvailableTeams] = React.useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRole, setSelectedRole] = React.useState<"owner" | "editor" | "viewer">("viewer");

  // Fetch permissions, available users, and teams
  const fetchData = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [permissionsResponse, usersResponse, teamsResponse] = await Promise.all([
        fetch(`/api/canvas/share?canvasId=${canvasId}`),
        fetch("/api/canvas/share-users"),
        fetch("/api/teams"),
      ]);

      if (permissionsResponse.ok) {
        const { permissions: fetchedPermissions } = await permissionsResponse.json();
        setPermissions(fetchedPermissions);
      }

      if (usersResponse.ok) {
        const { users } = await usersResponse.json();
        setAvailableUsers(users);
      }

      if (teamsResponse.ok) {
        const { teams } = await teamsResponse.json();
        setAvailableTeams(teams);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [canvasId]);

  React.useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Filter users that don't have access yet
  const usersWithoutAccess = availableUsers.filter(
    (user) => !permissions.some((p) => p.userId === user.id)
  );

  // Filter users based on search query
  const filteredUsers = usersWithoutAccess.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter teams based on search query
  const filteredTeams = availableTeams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShareWithUser = async (userId: string): Promise<void> => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/canvas/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          userId,
          role: selectedRole,
        }),
      });

      if (response.ok) {
        await fetchData();
        setSearchQuery("");
      } else {
        const { error } = await response.json();
        alert(error || "Failed to share canvas");
      }
    } catch (error) {
      console.error("Failed to share canvas:", error);
      alert("Failed to share canvas");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareWithTeam = async (teamId: string): Promise<void> => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/canvas/share-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          teamId,
          role: selectedRole,
        }),
      });

      if (response.ok) {
        await fetchData();
        setSearchQuery("");
      } else {
        const { error } = await response.json();
        alert(error || "Failed to share with team");
      }
    } catch (error) {
      console.error("Failed to share with team:", error);
      alert("Failed to share with team");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: "owner" | "editor" | "viewer"): Promise<void> => {
    try {
      const response = await fetch("/api/canvas/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          userId,
          role: newRole,
        }),
      });

      if (response.ok) {
        await fetchData();
      } else {
        const { error } = await response.json();
        alert(error || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("Failed to update role");
    }
  };

  const handleRemovePermission = async (userId: string): Promise<void> => {
    if (!confirm("Remove access for this user?")) return;

    try {
      const response = await fetch(
        `/api/canvas/share?canvasId=${canvasId}&userId=${userId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        await fetchData();
      } else {
        const { error } = await response.json();
        alert(error || "Failed to remove permission");
      }
    } catch (error) {
      console.error("Failed to remove permission:", error);
      alert("Failed to remove permission");
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {controlledIsOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4" />
            Share Canvas
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Canvas</DialogTitle>
          <DialogDescription>
            Invite people or teams to collaborate on this canvas
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search and Add Section */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search people or teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Role selector */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">as</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) =>
                    setSelectedRole(value as "owner" | "editor" | "viewer")
                  }
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Results */}
              {searchQuery && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  <Tabs defaultValue="people" className="w-full">
                    <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
                      <TabsTrigger value="people" className="text-xs">
                        People
                      </TabsTrigger>
                      <TabsTrigger value="teams" className="text-xs">
                        Teams
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="people" className="m-0 p-0">
                      {filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No users found
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleShareWithUser(user.id)}
                              disabled={isSubmitting}
                              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                            >
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {getInitials(user.name)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {user.email}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="teams" className="m-0 p-0">
                      {filteredTeams.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No teams found
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredTeams.map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => handleShareWithTeam(team.id)}
                              disabled={isSubmitting}
                              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                            >
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <UsersIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{team.name}</p>
                                <p className="text-xs text-muted-foreground">Team</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>

            <Separator />

            {/* Current Collaborators */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                People with access ({permissions.length})
              </Label>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {permissions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground rounded-md border border-dashed">
                    No collaborators yet
                  </div>
                ) : (
                  permissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {permission.user ? getInitials(permission.user.name) : "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {permission.user?.name || "Unknown User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {permission.user?.email}
                        </p>
                      </div>
                      <Select
                        value={permission.role}
                        onValueChange={(value) =>
                          handleUpdateRole(permission.userId, value as "owner" | "editor" | "viewer")
                        }
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      {permission.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemovePermission(permission.userId)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Help text */}
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p>
                <strong>Viewer:</strong> Can view canvas and comments
              </p>
              <p>
                <strong>Editor:</strong> Can view and edit canvas fields
              </p>
              <p>
                <strong>Owner:</strong> Full access including sharing and deletion
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
